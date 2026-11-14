import { useState } from "react";
import { downloadCalendar } from "./calendar.js";

export default function CalendarReminders({ tasks, now }) {
  const [message, setMessage] = useState("");
  const count = tasks.filter(task => !task.done && task.reminderAt && Date.parse(task.reminderAt) > now.getTime()).length;

  function exportReminders() {
    try {
      downloadCalendar(tasks);
      setMessage("Calendar file downloaded. Import it into your calendar and check that an alert is enabled for each event.");
    } catch (error) {
      setMessage(error.message);
    }
  }

  return (
    <section className="notification-settings" aria-labelledby="reminders-title">
      <h2 id="reminders-title">Calendar reminders</h2>
      <p>Choose a due date and reminder time, then export your reminders to your phone's calendar.</p>
      <button type="button" disabled={count === 0} onClick={exportReminders}>
        Export {count || ""} {count === 1 ? "reminder" : "reminders"} to calendar
      </button>
      <p>Import the .ics file into a compatible calendar app and check its alert settings. Some calendars require importing on a computer before events sync to your phone.</p>
      <p>Changes or deletions in Dayline do not update exported calendar events. Update those events in your calendar. Importing again may create duplicates.</p>
      <p role="status">{message || (count === 0 ? "Add a future reminder to an active task to export it." : `${count} ${count === 1 ? "reminder is" : "reminders are"} ready to export.`)}</p>
    </section>
  );
}
