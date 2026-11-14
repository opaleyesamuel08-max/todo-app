import assert from "node:assert/strict";
import { test } from "node:test";
import { createCalendar } from "./calendar.js";

const now = new Date("2026-11-14T12:00:00.000Z");
const task = { id: "one", name: "Review portfolio", reminderAt: "2026-11-15T17:30:00.000Z" };

test("calendar exports active future tasks with UTC times and an event-start alarm", () => {
  const result = createCalendar([task, { ...task, id: "done", done: true },
    { ...task, id: "past", reminderAt: "2026-11-13T12:00:00Z" }], now);
  assert.equal((result.match(/BEGIN:VEVENT/g) || []).length, 1);
  assert.ok(result.startsWith("BEGIN:VCALENDAR\r\nVERSION:2.0\r\n"));
  assert.ok(result.endsWith("END:VCALENDAR\r\n"));
  assert.match(result, /UID:one@dayline.local\r\n/);
  assert.match(result, /DTSTAMP:20261114T120000Z\r\n/);
  assert.match(result, /DTSTART:20261115T173000Z\r\n/);
  assert.match(result, /DTEND:20261115T174500Z\r\n/);
  assert.match(result, /BEGIN:VALARM\r\nACTION:DISPLAY\r\nTRIGGER:PT0S\r\n/);
  assert.throws(() => createCalendar([], now), /future reminder/);
});

test("task text cannot inject calendar properties and Unicode lines stay within 75 bytes", () => {
  const name = "Meet, review; C:\\notes\r\nBEGIN:VEVENT " + "\u{1F600}".repeat(30);
  const result = createCalendar([{ ...task, name }], now);
  const unfolded = result.replace(/\r\n /g, "");
  assert.equal((result.match(/BEGIN:VEVENT\r\n/g) || []).length, 1);
  assert.ok(unfolded.includes("SUMMARY:Meet\\, review\\; C:\\\\notes\\nBEGIN:VEVENT "));
  assert.ok(unfolded.includes("\u{1F600}".repeat(30)));
  for (const line of result.split("\r\n")) assert.ok(Buffer.byteLength(line) <= 75);
});
