import { reconcileReminders } from "./reminderValidation.js";

// Storage and transport are injected so cancellation/retry behavior can be tested
// without a real database or sending notifications to a phone.
export async function syncDevice(existing, input, { save, enqueue }) {
  const record = { subscription: input.subscription, tasks: reconcileReminders(existing?.tasks, input.tasks) };
  await save(record);
  for (const task of record.tasks) {
    if (task.queued || task.delivered) continue;
    await enqueue(task);
    task.queued = true;
    await save(record);
  }
  return record;
}

export async function deliverReminder(record, job, { save, remove, enqueue, send }, now = Date.now()) {
  const task = record?.tasks.find(item => item.id === job.taskId && item.version === job.version && !item.delivered);
  if (!task) return { skipped: true };
  if (Date.parse(task.at) > now) {
    await enqueue(task);
    return { rescheduled: true };
  }
  if (now - Date.parse(task.at) < 86400000) {
    try {
      await send(record.subscription, { title: "Dayline task reminder", body: task.name, tag: `dayline-${task.id}` });
    } catch (error) {
      if (error.statusCode !== 404 && error.statusCode !== 410) throw error;
      await remove();
      return { expired: true };
    }
  }
  task.delivered = true;
  await save(record);
  return { delivered: true };
}
