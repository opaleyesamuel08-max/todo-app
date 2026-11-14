# Dayline

A React task planner with due dates, priorities, editing, completion tracking, and filters for all, active, completed, and today's tasks.

This is a frontend-only app with no backend, accounts, or external services. Optional reminder times can be exported as an .ics file for a compatible calendar app. See [calendar reminder instructions](NOTIFICATIONS.md).

Tasks are saved in this browser's local storage. If storage is unavailable, the app shows a warning; changes in that session may be lost on refresh.

## Development

Requires a Node.js version supported by the installed Vite release.

```sh
npm ci
npm run dev
```

## Checks and production build

```sh
npm run lint
npm test
npm run build
npm run preview
```

The production build is written to `dist`. The preview command serves that build locally.
