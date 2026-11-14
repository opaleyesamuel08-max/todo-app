import { scheduledTasks } from "./reminderTime.js";

function calendarDate(date) {
  return new Date(date).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function escapeText(text) {
  return text.replace(/\\/g, "\\\\").replace(/\r\n|\r|\n/g, "\\n").replace(/;/g, "\\;").replace(/,/g, "\\,");
}

// RFC 5545 limits content lines to 75 UTF-8 octets, including the leading
// space on continuation lines.
function foldLine(line) {
  const encoder = new TextEncoder();
  let output = "";
  let bytes = 0;
  for (const character of line) {
    const length = encoder.encode(character).length;
    if (bytes + length > 75) {
      output += "\r\n ";
      bytes = 1;
    }
    output += character;
    bytes += length;
  }
  return output;
}

export function createCalendar(tasks, now = new Date()) {
  const reminders = scheduledTasks(tasks, now.getTime());
  if (!reminders.length) throw new Error("Add a future reminder to an active task first.");
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Dayline//Task Reminders//EN", "CALSCALE:GREGORIAN"];
  for (const task of reminders) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${escapeText(task.id)}@dayline.local`,
      `DTSTAMP:${calendarDate(now)}`,
      `DTSTART:${calendarDate(task.at)}`,
      `DTEND:${calendarDate(Date.parse(task.at) + 15 * 60000)}`,
      `SUMMARY:${escapeText(task.name)}`,
      "DESCRIPTION:Exported from Dayline. Changes in Dayline do not update this calendar event.",
      "BEGIN:VALARM", "ACTION:DISPLAY", "TRIGGER:PT0S",
      `DESCRIPTION:${escapeText(task.name)}`,
      "END:VALARM", "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return `${lines.map(foldLine).join("\r\n")}\r\n`;
}

export function downloadCalendar(tasks) {
  const blob = new Blob([createCalendar(tasks)], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "dayline-reminders.ics";
  document.body.append(link);
  link.click();
  link.remove();
  // Allow mobile browsers to open the download before revoking its URL.
  window.setTimeout(() => URL.revokeObjectURL(url), 60000);
}
