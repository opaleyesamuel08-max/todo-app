import assert from "node:assert/strict";
import { test } from "node:test";
import { syncDevice, deliverReminder } from "./reminderJobs.js";
import { deviceId, nextDelivery, validateReminders, validateSubscription } from "./reminderValidation.js";

const now = Date.parse("2026-11-14T20:00:00Z");
const task = { id: "task-one", name: "Review portfolio", at: "2026-11-14T21:00:00.000Z" };
const subscription = { endpoint: "https://web.push.apple.com/test", keys: { p256dh: "a".repeat(87), auth: "b".repeat(22) } };

function memory() {
  return {
    record: null, queued: [], sent: [],
    async save(record) { this.record = structuredClone(record); },
    async enqueue(task) { this.queued.push(structuredClone(task)); },
    async send(subscription, payload) { this.sent.push({ subscription, payload }); },
    async remove() { this.record = null; },
    get deps() {
      return Object.fromEntries(["save", "enqueue", "send", "remove"].map(key => [key, this[key].bind(this)]));
    },
  };
}

test("server validates device authorization, subscriptions and dates", () => {
  assert.match(deviceId(`Bearer ${"a".repeat(64)}`), /^[a-f0-9]{64}$/);
  assert.throws(() => deviceId("Bearer short"));
  assert.deepEqual(validateSubscription(subscription), subscription);
  for (const endpoint of ["http://127.0.0.1/push", "https://attacker.example/push", "https://fcm.googleapis.com.evil.example/push", "https://web.push.apple.com:8443/push"]) {
    assert.throws(() => validateSubscription({ ...subscription, endpoint }));
  }
  assert.deepEqual(validateReminders([task], now), [task]);
  assert.throws(() => validateReminders([task, task], now));
  assert.throws(() => validateReminders([{ ...task, at: "invalid" }], now));
  assert.throws(() => validateReminders([{ ...task, at: "2030-01-01" }], now));
  assert.throws(() => validateReminders([task], now + 86400000));
});

test("long-term reminders wake within six days, short-term reminders at due time", () => {
  assert.equal(nextDelivery(task.at, now), Date.parse(task.at) / 1000);
  assert.equal(nextDelivery("2027-01-01T00:00:00Z", now), (now + 6 * 86400000) / 1000);
});

test("syncing unchanged tasks does not republish; edits invalidate the old callback", async () => {
  const store = memory();
  await syncDevice(null, { subscription, tasks: [task] }, store.deps);
  const version = store.record.tasks[0].version;
  await syncDevice(store.record, { subscription, tasks: [task] }, store.deps);
  assert.equal(store.queued.length, 1);
  await syncDevice(store.record, { subscription, tasks: [{ ...task, name: "Updated title" }] }, store.deps);
  assert.equal(store.queued.length, 2);
  assert.notEqual(store.record.tasks[0].version, version);
  assert.deepEqual(await deliverReminder(store.record, { taskId: task.id, version }, store.deps, now + 7200000), { skipped: true });
  assert.equal(store.sent.length, 0);
});

test("completed/deleted tasks and disabled devices never send queued reminders", async () => {
  const store = memory();
  await syncDevice(null, { subscription, tasks: [task] }, store.deps);
  const job = { taskId: task.id, version: store.record.tasks[0].version };
  await syncDevice(store.record, { subscription, tasks: [] }, store.deps);
  assert.deepEqual(await deliverReminder(store.record, job, store.deps, now + 7200000), { skipped: true });
  assert.deepEqual(await deliverReminder(null, job, store.deps, now + 7200000), { skipped: true });
  assert.equal(store.sent.length, 0);
});

test("future callbacks requeue, due callbacks send once, duplicate callbacks skip", async () => {
  const store = memory();
  await syncDevice(null, { subscription, tasks: [task] }, store.deps);
  const job = { taskId: task.id, version: store.record.tasks[0].version };
  assert.deepEqual(await deliverReminder(store.record, job, store.deps, now), { rescheduled: true });
  assert.equal(store.sent.length, 0);
  assert.deepEqual(await deliverReminder(store.record, job, store.deps, now + 3600000), { delivered: true });
  assert.equal(store.sent[0].payload.body, task.name);
  assert.deepEqual(await deliverReminder(store.record, job, store.deps, now + 3600000), { skipped: true });
  assert.equal(store.sent.length, 1);
});

test("failed publishing is retryable without losing edits or cancellations", async () => {
  const store = memory();
  await assert.rejects(syncDevice(null, { subscription, tasks: [task] }, {
    ...store.deps, enqueue: async () => { throw new Error("Queue unavailable"); },
  }));
  assert.equal(store.record.tasks[0].queued, false);
  const version = store.record.tasks[0].version;
  await syncDevice(store.record, { subscription, tasks: [task] }, store.deps);
  assert.equal(store.record.tasks[0].queued, true);
  assert.equal(store.record.tasks[0].version, version);
});

test("expired subscriptions are removed; transient push failures remain retryable", async () => {
  const store = memory();
  await syncDevice(null, { subscription, tasks: [task] }, store.deps);
  const job = { taskId: task.id, version: store.record.tasks[0].version };
  await assert.rejects(deliverReminder(store.record, job, {
    ...store.deps, send: async () => { throw new Error("Temporary outage"); },
  }, now + 3600000));
  assert.equal(store.record.tasks[0].delivered, false);
  assert.deepEqual(await deliverReminder(store.record, job, {
    ...store.deps, send: async () => { throw Object.assign(new Error("Gone"), { statusCode: 410 }); },
  }, now + 3600000), { expired: true });
  assert.equal(store.record, null);
});
