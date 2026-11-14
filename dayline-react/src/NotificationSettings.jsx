import { useEffect, useState } from "react";
import { disableNotifications, enableNotifications, notificationSupport,
  notificationsEnabled, syncReminders, testNotification } from "./notifications.js";

export default function NotificationSettings({ tasks }) {
  const [enabled, setEnabled] = useState(notificationsEnabled);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const support = notificationSupport();

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    function sync() {
      syncReminders(tasks).then(() => {
        if (active) setMessage("Reminders synced to this phone.");
      }).catch(error => {
        if (active) setMessage(`${error.message} Changes to reminders are not synced yet.`);
      });
    }
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("focus", sync);
    return () => {
      active = false;
      window.removeEventListener("online", sync);
      window.removeEventListener("focus", sync);
    };
  }, [tasks, enabled]);

  async function run(action, success) {
    setBusy(true);
    try {
      await action();
      setEnabled(notificationsEnabled());
      setMessage(success);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="notification-settings" aria-labelledby="reminders-title">
      <h2 id="reminders-title">Phone reminders</h2>
      <p>Choose a due date and reminder time for a task. Enable notifications on each phone you use.</p>
      <p>Enabling reminders saves scheduled task names and times on the server so they can reach you while the app is closed.</p>
      {support && <p>{support}</p>}
      <div className="form-actions">
        <button type="button" disabled={busy || (!enabled && Boolean(support))}
          onClick={() => enabled
            ? run(disableNotifications, "Reminders are off on this phone.")
            : run(() => enableNotifications(tasks), "Reminders enabled on this phone.")}>
          {busy ? "Please wait…" : enabled ? "Turn off reminders" : "Enable reminders"}
        </button>
        {enabled && <>
          <button type="button" disabled={busy} onClick={() => run(testNotification, "Test notification sent. Check your phone's notifications.")}>Send test</button>
          <button type="button" disabled={busy} onClick={() => run(() => syncReminders(tasks), "Reminders synced to this phone.")}>Retry sync</button>
        </>}
      </div>
      <p role="status">{message || (enabled ? "Reminders are enabled on this phone." : "Reminders are off.")}</p>
    </section>
  );
}
