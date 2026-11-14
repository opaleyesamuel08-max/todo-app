import { scheduledTasks } from "./reminderTime.js";

const TOKEN_KEY = "dayline-push-token";
const ENABLED_KEY = "dayline-push-enabled";
let pending = Promise.resolve();

export function notificationsEnabled() {
  try { return localStorage.getItem(ENABLED_KEY) === "true"; }
  catch { return false; }
}

export function notificationSupport() {
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const standalone = window.matchMedia("(display-mode: standalone)").matches || navigator.standalone;
  if (ios && !standalone) return "On iPhone or iPad, tap Share, then Add to Home Screen. Open Dayline from that icon to enable notifications.";
  if (!window.isSecureContext || !("serviceWorker" in navigator) ||
      !("PushManager" in window) || !("Notification" in window)) {
    return "This browser does not support phone notifications. Try an up-to-date Safari or Chrome browser over HTTPS.";
  }
  return "";
}

function token() {
  let value = localStorage.getItem(TOKEN_KEY);
  if (!value) {
    value = Array.from(crypto.getRandomValues(new Uint8Array(32)), byte => byte.toString(16).padStart(2, "0")).join("");
    localStorage.setItem(TOKEN_KEY, value);
  }
  return value;
}

async function request(method, body) {
  const response = await fetch("/api/reminders", {
    method,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Reminders could not sync. Check your connection and retry.");
  return data;
}

async function registration() {
  await navigator.serviceWorker.register("/sw.js");
  return navigator.serviceWorker.ready;
}

function applicationKey(value) {
  const padded = value + "=".repeat((4 - value.length % 4) % 4);
  return Uint8Array.from(atob(padded.replace(/-/g, "+").replace(/_/g, "/")), char => char.charCodeAt(0));
}

// Serialize updates so a slow earlier request cannot restore a deleted reminder.
export function syncReminders(tasks) {
  const operation = pending.catch(() => {}).then(async () => {
    if (!notificationsEnabled()) return;
    const support = notificationSupport();
    if (support) throw new Error(support);
    if (Notification.permission !== "granted") throw new Error("Notifications are blocked. Allow them in your phone's notification settings, then enable reminders again.");
    const worker = await registration();
    const subscription = await worker.pushManager.getSubscription();
    if (!subscription) throw new Error("This phone's notification subscription expired. Enable reminders again.");
    return request("PUT", { subscription: subscription.toJSON(), tasks: scheduledTasks(tasks) });
  });
  pending = operation;
  return operation;
}

export async function enableNotifications(tasks) {
  const support = notificationSupport();
  if (support) throw new Error(support);
  // Start the permission prompt directly from the user's tap (required on iOS).
  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("Notifications were not allowed. You can enable them later in your phone's settings.");
  const config = await request("GET");
  const worker = await registration();
  let subscription = await worker.pushManager.getSubscription();
  if (!subscription) subscription = await worker.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: applicationKey(config.publicKey),
  });
  await request("PUT", { subscription: subscription.toJSON(), tasks: scheduledTasks(tasks) });
  localStorage.setItem(ENABLED_KEY, "true");
}

export async function disableNotifications() {
  // Cancel server jobs first; retain enabled state if the network request fails.
  await pending.catch(() => {});
  await request("DELETE");
  localStorage.removeItem(ENABLED_KEY);
  if ("serviceWorker" in navigator) {
    const worker = await navigator.serviceWorker.getRegistration();
    const subscription = await worker?.pushManager.getSubscription();
    await subscription?.unsubscribe();
  }
}

export async function testNotification() {
  await pending;
  return request("POST");
}
