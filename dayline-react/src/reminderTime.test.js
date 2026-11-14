import assert from "node:assert/strict";
import { test } from "node:test";
import { reminderInstant, scheduledTasks } from "./reminderTime.js";

test("reminders use the device's local time and reject nonexistent DST times", () => {
  const previous = process.env.TZ;
  process.env.TZ = "America/Los_Angeles";
  try {
    assert.equal(reminderInstant("2026-11-14", "09:30"), "2026-11-14T17:30:00.000Z");
    assert.equal(reminderInstant("2026-07-01", "09:30"), "2026-07-01T16:30:00.000Z");
    assert.equal(reminderInstant("2027-03-14", "02:30"), null);
    assert.equal(reminderInstant("", "09:30"), null);
    assert.equal(reminderInstant("2026-11-14", ""), null);
  } finally {
    if (previous === undefined) delete process.env.TZ;
    else process.env.TZ = previous;
  }
});

test("only active future reminders are included in calendar exports", () => {
  const now = Date.parse("2026-11-14T20:00:00Z");
  const task = { id: "one", name: "Review", reminderAt: "2026-11-14T21:00:00.000Z" };
  assert.deepEqual(scheduledTasks([task, { ...task, done: true }, { ...task, reminderAt: "2026-11-13T20:00:00Z" }, { id: "two", name: "No reminder" }], now),
    [{ id: "one", name: "Review", at: task.reminderAt }]);
});
