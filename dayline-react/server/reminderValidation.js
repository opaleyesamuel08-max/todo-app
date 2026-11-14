import { createHash } from "node:crypto";

export function deviceId(authorization = "") {
  const match = /^Bearer ([a-f0-9]{64})$/.exec(authorization);
  if (!match) throw new Error("Invalid device authorization.");
  return createHash("sha256").update(match[1]).digest("hex");
}

export function validateSubscription(subscription) {
  const endpoint = new URL(subscription?.endpoint);
  const allowed = ["fcm.googleapis.com", "web.push.apple.com", "updates.push.services.mozilla.com"];
  if (endpoint.protocol !== "https:" || !allowed.includes(endpoint.hostname) ||
      endpoint.port || endpoint.username || endpoint.password || endpoint.href.length > 2048 ||
      !/^[\w-]{87}=?$/.test(subscription?.keys?.p256dh || "") ||
      !/^[\w-]{22}={0,2}$/.test(subscription?.keys?.auth || "")) {
    throw new Error("Invalid or unsupported push subscription.");
  }
  return { endpoint: endpoint.href, keys: { p256dh: subscription.keys.p256dh, auth: subscription.keys.auth } };
}

export function validateReminders(tasks, now = Date.now()) {
  if (!Array.isArray(tasks) || tasks.length > 100) throw new Error("A phone can schedule up to 100 reminders.");
  const ids = new Set();
  return tasks.map(task => {
    const at = Date.parse(task?.at);
    if (!task || typeof task.id !== "string" || !/^[\w-]{1,100}$/.test(task.id) || ids.has(task.id) ||
        typeof task.name !== "string" || !task.name.trim() || task.name.length > 120 ||
        typeof task.at !== "string" || !Number.isFinite(at) ||
        at <= now || at > now + 366 * 86400000) {
      throw new Error("Reminder dates must be in the future and within the next year.");
    }
    ids.add(task.id);
    return { id: task.id, name: task.name.trim(), at: new Date(at).toISOString() };
  });
}

export function nextDelivery(at, now = Date.now()) {
  // Requeue distant reminders in six-day hops, within QStash's free delay limit.
  return Math.ceil(Math.min(Date.parse(at), now + 6 * 86400000) / 1000);
}

export function reconcileReminders(existing = [], requested) {
  return requested.map(task => {
    const previous = existing.find(item => item.id === task.id && item.name === task.name && item.at === task.at);
    return previous || { ...task, version: crypto.randomUUID(), queued: false, delivered: false };
  });
}
