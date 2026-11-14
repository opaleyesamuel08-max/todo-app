import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page, context }) => {
  await context.grantPermissions(["notifications"]);
  await page.addInitScript(() => {
    const subscription = {
      endpoint: "https://fcm.googleapis.com/test-subscription",
      keys: { p256dh: "a".repeat(87), auth: "b".repeat(22) },
    };
    // Exercise the real permission flow and service worker registration while
    // replacing the phone push broker, which is unavailable in browser tests.
    PushManager.prototype.getSubscription = async () => ({
      toJSON: () => subscription, unsubscribe: async () => true,
    });
  });
});

async function addReminder(page) {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const date = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, "0")}-${String(tomorrow.getDate()).padStart(2, "0")}`;
  await page.getByLabel("Task name").fill("Review portfolio");
  await page.getByLabel("Due date").fill(date);
  await page.getByLabel("Reminder time").fill("09:30");
  await page.getByRole("button", { name: "Add task", exact: true }).click();
}

test("reminders persist and edits/completion/deletion sync without stale schedules", async ({ page }) => {
  const updates = [];
  await page.route("**/api/reminders", async route => {
    const request = route.request();
    if (request.method() === "PUT") updates.push(request.postDataJSON());
    await route.fulfill({ json: request.method() === "GET"
      ? { publicKey: "B".repeat(87) } : { scheduled: 1 } });
  });
  await page.goto("/");
  await addReminder(page);
  await page.getByRole("button", { name: "Enable reminders" }).click();
  await expect.poll(() => updates.at(-1)?.tasks.length).toBe(1);
  expect(updates.at(-1).tasks[0].name).toBe("Review portfolio");
  const oldTime = updates.at(-1).tasks[0].at;
  await page.reload();
  await expect(page.getByText("Reminder ", { exact: false }).filter({ hasText: /9:30/ }).first()).toBeVisible();
  await page.getByRole("button", { name: "Edit Review portfolio", exact: true }).click();
  await expect(page.getByLabel("Reminder time")).toHaveValue("09:30");
  await page.getByLabel("Reminder time").fill("10:30");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect.poll(() => updates.at(-1)?.tasks[0]?.at).not.toBe(oldTime);
  await page.getByRole("checkbox", { name: "Review portfolio" }).check();
  await expect.poll(() => updates.at(-1)?.tasks.length).toBe(0);
  await page.getByRole("checkbox", { name: "Review portfolio" }).uncheck();
  await expect.poll(() => updates.at(-1)?.tasks.length).toBe(1);
  await page.getByRole("button", { name: "Delete Review portfolio", exact: true }).click();
  await expect.poll(() => updates.at(-1)?.tasks.length).toBe(0);
});

test("server setup failure is explained without losing the task", async ({ page }) => {
  await page.route("**/api/reminders", route => route.fulfill({
    status: 503, json: { error: "Phone reminders need server setup." },
  }));
  await page.goto("/");
  await addReminder(page);
  await page.getByRole("button", { name: "Enable reminders" }).click();
  await expect(page.getByRole("status")).toHaveText("Phone reminders need server setup.");
  await expect(page.getByRole("checkbox", { name: "Review portfolio" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Enable reminders" })).toBeEnabled();
});

test("iPhone browser explains Home Screen installation", async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, "userAgent", {
    value: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1",
  }));
  await page.goto("/");
  await expect(page.getByText(/On iPhone or iPad, tap Share/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Enable reminders" })).toBeDisabled();
});

test("clearing a due date also clears its reminder time", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Task name").fill("No date");
  await page.getByLabel("Due date").fill("2027-01-01");
  await page.getByLabel("Reminder time").fill("09:30");
  await page.getByLabel("Due date").fill("");
  await expect(page.getByLabel("Reminder time")).toHaveValue("");
  await expect(page.getByLabel("Reminder time")).toBeDisabled();
  await page.getByRole("button", { name: "Add task", exact: true }).click();
  await expect(page.getByRole("checkbox", { name: "No date" })).toBeVisible();
});
