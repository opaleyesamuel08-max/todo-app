# Calendar reminders

Dayline is a frontend-only React app. Tasks and reminder times are saved in this browser's local storage. There are no API routes, server credentials, push subscriptions, or backend services to configure.

## Export a reminder

1. Add or edit a task and choose a due date and an optional reminder time.
2. Click **Export reminders to calendar** in the Calendar reminders section. The downloaded `dayline-reminders.ics` file contains all active tasks with future reminder times.
3. Import the file into a compatible calendar app. Check that each event has an alert enabled. Calendar apps may change or ignore imported alarm settings.

Your calendar handles alerts after import. Dayline itself cannot send scheduled phone notifications while the browser is closed.

## On a phone

- Apple Calendar supports importing .ics calendar files. Open or import the downloaded file using the options available on your device, then confirm the event and alert settings. Importing on a Mac and using iCloud calendar sync is another option.
- Google Calendar imports .ics files through its website on a computer. Import into a calendar that syncs to your Android phone. Other Android calendar apps may support direct file imports.
- Notification permission and alerts must be enabled for the calendar app on the phone.

[Apple Calendar import instructions](https://support.apple.com/guide/calendar/import-or-export-calendars-icl1023/mac) / [Google Calendar import instructions](https://support.google.com/calendar/answer/37118)

## Editing and deleting tasks

Exported events are independent copies. Editing, completing, or deleting a task in Dayline does not change your calendar. Update or delete the event in the calendar app as well. Reimporting the same tasks may create duplicates, depending on the calendar app.

Reminder times are converted from the device's local time zone to UTC when saved. Existing reminders keep the same instant if you change time zones. Times that do not exist during the spring daylight-saving transition are rejected.

## Develop and verify

```sh
npm ci
npm run dev
npm test
npm run lint
npm run build
```

For browser tests, install Chrome and run `npm run test:e2e`. Deployment only requires static hosting of the Vite `dist` directory. On the linked Vercel project, use `dayline-react` as the Root Directory and the Vite framework preset.
