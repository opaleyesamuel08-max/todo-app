import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";

async function addReminder(page) {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const date = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, "0")}-${String(tomorrow.getDate()).padStart(2, "0")}`;
  await page.getByLabel("Task name").fill("Review portfolio");
  await page.getByLabel("Due date").fill(date);
  await page.getByLabel("Reminder time").fill("09:30");
  await page.getByRole("button", { name: "Add task", exact: true }).click();
}

test("calendar reminders persist, export, and exclude completed or deleted tasks", async ({ page }) => {
  const apiRequests = [];
  page.on("request", request => {
    if (request.url().includes("/api/")) apiRequests.push(request.url());
  });
  await page.goto("/");
  await addReminder(page);
  await page.reload();
  await page.getByRole("button", { name: "Edit Review portfolio", exact: true }).click();
  await expect(page.getByLabel("Reminder time")).toHaveValue("09:30");
  await page.getByLabel("Reminder time").fill("10:30");
  await page.getByRole("button", { name: "Save changes" }).click();
  const downloaded = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export 1 reminder to calendar" }).click();
  const file = await downloaded;
  expect(file.suggestedFilename()).toBe("dayline-reminders.ics");
  const calendar = await readFile(await file.path(), "utf8");
  expect(calendar).toContain("SUMMARY:Review portfolio\r\n");
  expect(calendar).toContain("BEGIN:VALARM\r\n");
  await expect(page.getByRole("status")).toContainText("Calendar file downloaded");
  await page.getByRole("checkbox", { name: "Review portfolio" }).check();
  await expect(page.getByRole("button", { name: /Export.*to calendar/ })).toBeDisabled();
  await page.getByRole("checkbox", { name: "Review portfolio" }).uncheck();
  await expect(page.getByRole("button", { name: "Export 1 reminder to calendar" })).toBeEnabled();
  await page.getByRole("button", { name: "Delete Review portfolio", exact: true }).click();
  await expect(page.getByRole("button", { name: /Export.*to calendar/ })).toBeDisabled();
  expect(apiRequests).toEqual([]);
});

test("calendar controls fit a phone screen and explain import behavior", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Calendar reminders" })).toBeVisible();
  await expect(page.getByText(/Changes or deletions in Dayline do not update/)).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
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
