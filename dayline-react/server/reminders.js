import { createHash, randomUUID } from "node:crypto";
import { Redis } from "@upstash/redis";
import { Client, Receiver } from "@upstash/qstash";
import * as webpush from "web-push";
import { nextDelivery } from "./reminderValidation.js";

const REQUIRED = ["UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN", "QSTASH_TOKEN",
  "QSTASH_CURRENT_SIGNING_KEY", "QSTASH_NEXT_SIGNING_KEY", "VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY", "VAPID_SUBJECT", "APP_URL"];

export function configured() {
  return REQUIRED.every(key => Boolean(process.env[key]));
}

export function services() {
  if (!configured()) throw new Error("Phone reminders need server setup. See the notification setup guide.");
  const origin = new URL(process.env.APP_URL);
  if (origin.protocol !== "https:" || origin.pathname !== "/" || origin.search || origin.hash) throw new Error("APP_URL must be the public HTTPS origin.");
  const redis = new Redis({ url: process.env.UPSTASH_REDIS_REST_URL, token: process.env.UPSTASH_REDIS_REST_TOKEN });
  const queue = new Client({ token: process.env.QSTASH_TOKEN, baseUrl: process.env.QSTASH_URL });
  const receiver = new Receiver({ currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY, nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY });
  webpush.setVapidDetails(process.env.VAPID_SUBJECT, process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);
  return { redis, queue, receiver, callback: `${origin.origin}/api/push` };
}

export const recordKey = id => `dayline:device:${id}`;
export const saveRecord = (redis, id, value) => redis.set(recordKey(id), value, { ex: 400 * 86400 });

export async function withDeviceLock(redis, id, action) {
  const key = `dayline:lock:${id}`;
  const owner = randomUUID();
  if (!await redis.set(key, owner, { nx: true, ex: 120 })) {
    const error = new Error("Reminders are busy syncing. Please retry.");
    error.status = 409;
    throw error;
  }
  try { return await action(); }
  finally {
    await redis.eval("if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end", [key], [owner]);
  }
}

export async function rateLimit(redis, req) {
  const ip = req.headers["x-vercel-forwarded-for"] || req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "unknown";
  const hash = createHash("sha256").update(String(ip)).digest("hex");
  const key = `dayline:rate:${hash}:${Math.floor(Date.now() / 3600000)}`;
  const requests = await redis.incr(key);
  if (requests === 1) await redis.expire(key, 3600);
  if (requests > 300) {
    const error = new Error("Too many reminder requests. Please try again later.");
    error.status = 429;
    throw error;
  }
}

export async function enqueue(queue, callback, device, task) {
  const wakeAt = nextDelivery(task.at);
  return queue.publishJSON({
    url: callback,
    body: { device, taskId: task.id, version: task.version },
    notBefore: wakeAt,
    deduplicationId: `${task.version}:${wakeAt}`,
    retries: 5,
    headers: process.env.VERCEL_AUTOMATION_BYPASS_SECRET
      ? { "x-vercel-protection-bypass": process.env.VERCEL_AUTOMATION_BYPASS_SECRET }
      : undefined,
  });
}

export async function sendPush(subscription, payload) {
  return webpush.sendNotification(subscription, JSON.stringify(payload), { TTL: 3600, urgency: "high", timeout: 10000 });
}

export function respondError(res, error) {
  // Avoid leaking provider credentials or subscription endpoints through API errors.
  const status = error.status || 503;
  res.status(status).json({ error: error.status ? error.message : "Reminders could not sync. Check the server setup or retry shortly." });
}
