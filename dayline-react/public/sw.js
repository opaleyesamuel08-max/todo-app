/* global self, clients */
self.addEventListener("push", event => {
  let data = {};
  try { data = event.data?.json() || {}; } catch { /* Show a default notification. */ }
  event.waitUntil(self.registration.showNotification(data.title || "Dayline reminder", {
    body: data.body || "A task needs your attention.",
    icon: "/icons/dayline-192.png",
    badge: "/icons/dayline-192.png",
    tag: data.tag || "dayline-reminder",
    data: { url: "/" },
  }));
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  event.waitUntil((async () => {
    const windows = await clients.matchAll({ type: "window", includeUncontrolled: true });
    const existing = windows.find(client => new URL(client.url).origin === self.location.origin);
    if (existing) return existing.focus();
    return clients.openWindow("/");
  })());
});
