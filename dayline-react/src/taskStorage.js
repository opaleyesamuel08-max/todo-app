export const STORAGE_KEY = "dayline-react-tasks";

function normalizeTask(task) {
  if (!task || typeof task !== "object" || typeof task.id !== "string" ||
      !task.id || typeof task.name !== "string" || !task.name.trim()) {
    return null;
  }

  const due = typeof task.due === "string" && /^\d{4}-\d{2}-\d{2}$/.test(task.due) &&
    Number.isFinite(Date.parse(`${task.due}T12:00:00Z`)) &&
    new Date(`${task.due}T12:00:00Z`).toISOString().slice(0, 10) === task.due
    ? task.due : "";

  return {
    id: task.id,
    name: task.name.trim(),
    due,
    priority: task.priority === "high" ? "high" : "normal",
    done: task.done === true,
    ...(typeof task.reminderTime === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(task.reminderTime) &&
      typeof task.reminderAt === "string" && Number.isFinite(Date.parse(task.reminderAt)) && due
      ? { reminderTime: task.reminderTime, reminderAt: new Date(task.reminderAt).toISOString() }
      : {}),
  };
}

export function loadTasks() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved === null) return { tasks: [], storageError: false };
    if (!Array.isArray(saved)) return { tasks: [], storageError: true };

    const ids = new Set();
    const tasks = [];
    for (const entry of saved) {
      const task = normalizeTask(entry);
      if (task && !ids.has(task.id)) {
        ids.add(task.id);
        tasks.push(task);
      }
    }
    return { tasks, storageError: tasks.length !== saved.length };
  } catch {
    return { tasks: [], storageError: true };
  }
}

export function persistTasks(tasks) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    return false;
  } catch {
    return true;
  }
}
