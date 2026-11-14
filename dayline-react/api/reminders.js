import { deviceId, validateReminders, validateSubscription } from "../server/reminderValidation.js";
import { syncDevice } from "../server/reminderJobs.js";
import { configured, enqueue, rateLimit, recordKey, respondError, saveRecord, sendPush, services, withDeviceLock } from "../server/reminders.js";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (!["GET", "PUT", "POST", "DELETE"].includes(req.method)) {
    res.setHeader("Allow", "GET, PUT, POST, DELETE");
    return res.status(405).end();
  }
  if (!configured()) return res.status(503).json({ error: "Phone reminders need server setup. Connect Upstash and add the notification environment variables in Vercel." });
  if (req.method === "GET") return res.json({ publicKey: process.env.VAPID_PUBLIC_KEY });

  let device;
  let input;
  try {
    device = deviceId(req.headers.authorization);
    if (req.method === "PUT") {
      if (Number(req.headers["content-length"]) > 64000) throw new Error("Reminder request is too large.");
      const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
      input = { subscription: validateSubscription(body?.subscription), tasks: validateReminders(body?.tasks) };
    }
  } catch (error) { return res.status(device ? 400 : 401).json({ error: error.message }); }

  try {
    const { redis, queue, callback } = services();
    await rateLimit(redis, req);
    await withDeviceLock(redis, device, async () => {
      if (req.method === "DELETE") {
        // Queued callbacks check this record, so removed tasks cannot send later.
        await redis.del(recordKey(device));
        return res.json({ enabled: false });
      }
      const existing = await redis.get(recordKey(device));
      if (req.method === "POST") {
        if (!existing) return res.status(404).json({ error: "Enable reminders on this phone first." });
        await sendPush(existing.subscription, { title: "Dayline reminders are ready", body: "Your phone can receive task reminders.", tag: "dayline-test" });
        return res.json({ sent: true });
      }
      const record = await syncDevice(existing, input, {
        save: record => saveRecord(redis, device, record),
        enqueue: task => enqueue(queue, callback, device, task),
      });
      res.json({ scheduled: record.tasks.filter(task => !task.delivered).length });
    });
  } catch (error) { respondError(res, error); }
}
