import { enqueue, recordKey, respondError, saveRecord, sendPush, services, withDeviceLock } from "../server/reminders.js";
import { deliverReminder } from "../server/reminderJobs.js";

// QStash signs the exact raw body; never verify a reserialized parsed object.
export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).end();
  try {
    const { redis, queue, receiver, callback } = services();
    let body = "";
    for await (const chunk of req) {
      body += chunk.toString();
      if (body.length > 4096) return res.status(413).end();
    }
    let valid = false;
    try {
      valid = await receiver.verify({ body, signature: req.headers["upstash-signature"] || "", url: callback });
    } catch { /* Invalid signatures must never reach Redis or the push service. */ }
    if (!valid) return res.status(401).end();
    const { device, taskId, version } = JSON.parse(body);
    if (!/^[a-f0-9]{64}$/.test(device) || typeof taskId !== "string" || typeof version !== "string") return res.status(400).end();

    await withDeviceLock(redis, device, async () => {
      const record = await redis.get(recordKey(device));
      res.json(await deliverReminder(record, { taskId, version }, {
        save: record => saveRecord(redis, device, record),
        remove: () => redis.del(recordKey(device)),
        enqueue: task => enqueue(queue, callback, device, task),
        send: sendPush,
      }));
    });
  } catch (error) { respondError(res, error); }
}
