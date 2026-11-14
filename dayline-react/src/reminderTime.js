export function reminderInstant(date, time) {
  if (!date || !time) return null;
  const local = `${date}T${time}`;
  const parsed = new Date(local);
  if (!Number.isFinite(parsed.getTime())) return null;
  // Reject nonexistent local times during the spring daylight-saving transition.
  if (parsed.getHours() !== Number(time.slice(0, 2)) ||
      parsed.getMinutes() !== Number(time.slice(3, 5))) return null;
  return parsed.toISOString();
}

export function scheduledTasks(tasks, now = Date.now()) {
  return tasks.flatMap(task => {
    const at = task.reminderAt;
    return !task.done && at && Date.parse(at) > now
      ? [{ id: task.id, name: task.name, at }]
      : [];
  });
}
