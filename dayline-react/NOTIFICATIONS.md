# Activate phone reminders

The code supports iPhone and Android push notifications at a task's chosen date and time, including while Dayline is closed. Activation requires an Upstash Redis database, QStash credentials, and environment variables on the existing Vercel project. Without those variables, the task planner still works and enabling reminders displays a setup message.

## 1. Connect Upstash

1. Open the Vercel `todo-app` project and its Storage or Marketplace section. Add **Upstash Redis**, create a database, and connect it to this project for Production. Alternatively, create one in the [Upstash console](https://console.upstash.com/).
2. In Vercel → Settings → Environment Variables, ensure the database credentials are named `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`. Some integrations use a prefix; copy the values to the exact names shown here.
3. In the Upstash console, open **QStash**, select a region, and copy `QSTASH_URL`, `QSTASH_TOKEN`, `QSTASH_CURRENT_SIGNING_KEY`, and `QSTASH_NEXT_SIGNING_KEY` from its Quickstart into Vercel's Production environment variables. Use the URL provided for your selected region.

[Upstash's Vercel integration guide](https://upstash.com/docs/redis/howto/vercelintegration)

## 2. Generate notification keys

In this app directory, run:

```sh
npm run vapid:keys
```

Copy `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` into Vercel's Production environment variables. Keep the private key secret; do not commit it or paste it into chat. Generate these keys once and keep them stable, since changing them requires phones to subscribe again.

Add two more variables:

| Variable | Value |
| --- | --- |
| `VAPID_SUBJECT` | A contact address such as `mailto:you@example.com` |
| `APP_URL` | The stable production HTTPS origin, such as `https://todo-app-yayo2.vercel.app`, without a path |

The complete variable template is in [.env.example](.env.example). These are server variables; do not add a `VITE_` prefix.

## 3. Check Vercel and redeploy

- Set the Vercel project's **Root Directory** to `dayline-react`, using the Vite framework preset. This directory contains the app's `api` routes and `vercel.json`.
- QStash must be able to POST to `APP_URL/api/push`. If production is protected by Vercel Authentication, either make the production deployment public or generate a **Protection Bypass for Automation** secret in Settings → Deployment Protection and set it as `VERCEL_AUTOMATION_BYPASS_SECRET`. The server forwards that secret only to QStash; it is never sent to the browser.
- Redeploy after adding variables. For a local full-stack preview, use `vercel dev` with local environment variables; `npm run dev` serves the frontend only.
- Open `https://YOUR-DOMAIN/api/reminders`. A configured deployment returns JSON containing a public key. A 503 setup message means required server variables are missing.

[Vercel's automation bypass documentation](https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection/protection-bypass-automation)

## 4. Enable on the phone

**iPhone/iPad:** use iOS/iPadOS 16.4 or newer. Open the production site in Safari → Share → Add to Home Screen. Launch Dayline from that icon, tap **Enable reminders**, and allow notifications.

**Android:** open the production site in current Chrome, tap **Enable reminders**, and allow notifications. Installing Dayline through Add to Home Screen is optional.

Then tap **Send test**. Create an incomplete task due today with a reminder a few minutes in the future. Wait for the synced message, close the app, and check the lock screen at the chosen time. Also verify that completing, deleting, or changing the reminder before it is due prevents the old reminder from appearing.

[Apple's web push requirements](https://developer.apple.com/documentation/usernotifications/sending-web-push-notifications-in-web-apps-and-browsers)

## Behavior and limits

- Times use the device's local time zone when saved and are stored as UTC instants. Existing reminders keep that instant if you travel; edit the reminder to choose a new local time. Nonexistent spring daylight-saving times are rejected.
- Tasks remain local to each browser/installed app. Opening Dayline on another device does not transfer the task list. Enable and create reminders on the phone that should receive them.
- Enabling reminders sends scheduled task names, times, and the phone's push subscription to the server. A randomly generated device token isolates each installation. There is no user account or cross-device synchronization.
- Edits, completion, deletion, and disabling reminders update the server while online. If syncing fails, the app shows a warning and retries when it comes online or regains focus. **Retry sync** is also available. Previously scheduled reminders can still arrive until offline changes sync.
- Turn off reminders before clearing browser data or uninstalling the web app. Clearing data removes this device's token and may prevent the app from cancelling its previous server schedules. Push services eventually expire abandoned subscriptions.
- The app allows up to 100 future reminders per device, up to one year ahead. Distant reminders are requeued in six-day steps to stay within QStash's free seven-day maximum delay. This consumes additional messages; check [Upstash usage and plan limits](https://upstash.com/pricing/qstash).
- Network outages, Focus/Do Not Disturb, notification permissions, and phone battery settings can delay or suppress delivery. Notifications use a one-hour push-service TTL; retries more than a day late are discarded. This is best-effort task reminding, not an alarm-clock guarantee.
- QStash verifies webhook signatures. Stale task revisions and completed/deleted reminders are skipped. Successful delivery is recorded to skip retries; the notification tag replaces duplicate deliveries if a send succeeds immediately before a database write fails.

## Validation

```sh
npm test
npm run lint
npm run build
```

For browser checks, install Chrome and run `npm run test:e2e`. These tests use mocked push subscriptions and API responses; they do not send real notifications.

Automated tests cover local time conversion, daylight-saving gaps, persisted reminder details, validation, cancelled and edited jobs, requeueing, duplicate callbacks, queue failures, and expired push subscriptions. Real-device delivery still requires the configuration and phone test above.
