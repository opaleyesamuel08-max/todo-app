import assert from "node:assert/strict";
import { test } from "node:test";
import { loadTasks, persistTasks, STORAGE_KEY } from "./taskStorage.js";

test("task storage handles reloads, invalid data, and unavailable storage", async t => {
  const original = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  t.after(() => {
    if (original) Object.defineProperty(globalThis, "localStorage", original);
    else delete globalThis.localStorage;
  });

  let saved = null;
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: key => { assert.equal(key, STORAGE_KEY); return saved; },
      setItem: (key, value) => { assert.equal(key, STORAGE_KEY); saved = value; },
    },
  });

  await t.test("loads an empty browser", () => {
    assert.deepEqual(loadTasks(), { tasks: [], storageError: false });
  });

  const task = { id: "one", name: "Review portfolio", due: "2026-11-14", priority: "high", done: true };
  await t.test("persists task details and completion across reloads", () => {
    assert.equal(persistTasks([task]), false);
    assert.deepEqual(loadTasks(), { tasks: [task], storageError: false });
  });

  await t.test("rejects broken entries and duplicate identifiers", () => {
    saved = JSON.stringify([null, 42, {}, task, task]);
    assert.deepEqual(loadTasks(), { tasks: [task], storageError: true });
  });

  await t.test("retains reminder times when tasks are reloaded", () => {
    const reminderTask = { ...task, reminderTime: "09:30", reminderAt: "2026-11-14T17:30:00.000Z" };
    assert.equal(persistTasks([reminderTask]), false);
    assert.deepEqual(loadTasks().tasks, [reminderTask]);
  });

  await t.test("normalizes invalid dates and unsupported field values", () => {
    saved = JSON.stringify([{ ...task, due: "2026-02-30", priority: {}, done: "false" }]);
    assert.deepEqual(loadTasks().tasks, [{ ...task, due: "", priority: "normal", done: false }]);
  });

  await t.test("preserves malformed saved data until the user makes changes", () => {
    saved = "{broken json";
    assert.deepEqual(loadTasks(), { tasks: [], storageError: true });
    assert.equal(saved, "{broken json");
    saved = "{}";
    assert.deepEqual(loadTasks(), { tasks: [], storageError: true });
  });

  await t.test("reports blocked reads and failed writes without throwing", () => {
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      get() { throw new Error("Storage blocked"); },
    });
    assert.deepEqual(loadTasks(), { tasks: [], storageError: true });
    assert.equal(persistTasks([task]), true);
  });
});
