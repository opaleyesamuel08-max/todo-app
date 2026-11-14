import assert from "node:assert/strict";
import { test } from "node:test";
import { Readable } from "node:stream";
import * as webpush from "web-push";
import reminders from "../api/reminders.js";
import push from "../api/push.js";

function response() {
  return {
    statusCode: 200,
    headers: {},
    setHeader(key, value) { this.headers[key] = value; },
    status(value) { this.statusCode = value; return this; },
    json(value) { this.body = value; return this; },
    end() { return this; },
  };
}

test("notification API explains missing setup and rejects unauthorized callbacks", async t => {
  const keys = webpush.generateVAPIDKeys();
  const settings = {
    APP_URL: "https://dayline.example",
    UPSTASH_REDIS_REST_URL: "https://example.upstash.io",
    UPSTASH_REDIS_REST_TOKEN: "test-token",
    QSTASH_TOKEN: "test-token",
    QSTASH_CURRENT_SIGNING_KEY: "current-test-signing-key",
    QSTASH_NEXT_SIGNING_KEY: "next-test-signing-key",
    VAPID_PUBLIC_KEY: keys.publicKey,
    VAPID_PRIVATE_KEY: keys.privateKey,
    VAPID_SUBJECT: "mailto:test@example.com",
  };
  const original = Object.fromEntries(Object.keys(settings).map(key => [key, process.env[key]]));
  const originalFetch = globalThis.fetch;
  let networkCalls = 0;
  globalThis.fetch = async () => { networkCalls++; throw new Error("Unexpected network request"); };
  t.after(() => {
    globalThis.fetch = originalFetch;
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  delete process.env.VAPID_PUBLIC_KEY;
  const notReady = response();
  await reminders({ method: "GET", headers: {} }, notReady);
  assert.equal(notReady.statusCode, 503);
  assert.match(notReady.body.error, /server setup/);

  Object.assign(process.env, settings);
  const publicConfig = response();
  await reminders({ method: "GET", headers: {} }, publicConfig);
  assert.deepEqual(publicConfig.body, { publicKey: keys.publicKey });

  const unauthorized = response();
  await reminders({ method: "DELETE", headers: {} }, unauthorized);
  assert.equal(unauthorized.statusCode, 401);

  const request = Readable.from([JSON.stringify({ device: "a".repeat(64), taskId: "one", version: "test" })]);
  request.method = "POST";
  request.headers = { "upstash-signature": "invalid.signature" };
  const rejected = response();
  await push(request, rejected);
  assert.equal(rejected.statusCode, 401);
  assert.equal(networkCalls, 0);
});
