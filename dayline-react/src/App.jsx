import { useEffect, useState } from "react";
import { loadTasks, persistTasks } from "./taskStorage";
import NotificationSettings from "./NotificationSettings.jsx";
import { reminderInstant } from "./reminderTime.js";
import "./App.css";

const FILTERS = [
  { value: "all", label: "All tasks" },
  { value: "today", label: "Due today" },
  { value: "active", label: "Active" },
  { value: "completed", label: "Completed" },
];

const EMPTY_DRAFT = { name: "", due: "", priority: "normal", reminderTime: "" };

function getLocalDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDate(date) {
  return new Date(`${date}T12:00:00`).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function App() {
  const [{ tasks, storageError }, setTaskState] = useState(loadTasks);
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [filter, setFilter] = useState("all");
  const [editingId, setEditingId] = useState(null);
  const [now, setNow] = useState(() => new Date());
  const [formError, setFormError] = useState("");

  useEffect(() => {
    function updateDate() {
      setNow(new Date());
    }
    const interval = window.setInterval(updateDate, 1000);
    window.addEventListener("focus", updateDate);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", updateDate);
    };
  }, []);

  function updateTasks(nextTasks) {
    const nextStorageError = persistTasks(nextTasks);
    setTaskState({ tasks: nextTasks, storageError: nextStorageError });
  }

  const today = getLocalDate(now);
  const completedCount = tasks.filter(task => task.done).length;
  const dueTodayCount = tasks.filter(task => !task.done && task.due === today).length;
  const overdueCount = tasks.filter(task => !task.done && task.due && task.due < today).length;

  const visibleTasks = tasks.filter(task => {
    if (filter === "today") return !task.done && task.due === today;
    if (filter === "active") return !task.done;
    if (filter === "completed") return task.done;
    return true;
  });

  function resetForm() {
    setDraft(EMPTY_DRAFT);
    setEditingId(null);
    setFormError("");
  }

  function saveTask(event) {
    event.preventDefault();

    const name = draft.name.trim();
    if (!name) return;

    const reminderAt = draft.reminderTime ? reminderInstant(draft.due, draft.reminderTime) : null;
    const existing = tasks.find(task => task.id === editingId);
    if (draft.reminderTime && (!reminderAt ||
        (Date.parse(reminderAt) <= Date.now() && reminderAt !== existing?.reminderAt))) {
      setFormError("Choose a valid future due date and reminder time.");
      return;
    }
    const details = { ...draft, name, ...(reminderAt ? { reminderAt } : {}) };
    // An explicit null removes a previous reminder when its time is cleared.
    if (!reminderAt) details.reminderAt = null;

    if (editingId !== null) {
      updateTasks(
        tasks.map(task =>
          task.id === editingId ? { ...task, ...details } : task
        )
      );
    } else {
      const newTask = { ...details, id: crypto.randomUUID(), done: false };
      updateTasks([newTask, ...tasks]);
      setFilter("all");
    }

    resetForm();
  }

  function editTask(task) {
    setEditingId(task.id);
    setDraft({
      name: task.name,
      due: task.due ?? "",
      priority: task.priority ?? "normal",
      reminderTime: task.reminderTime ?? "",
    });
    setFormError("");
    document.getElementById("task-name").focus();
  }

  function toggleTask(id) {
    updateTasks(
      tasks.map(task =>
        task.id === id ? { ...task, done: !task.done } : task
      )
    );
  }

  function deleteTask(id) {
    updateTasks(tasks.filter(task => task.id !== id));
    if (editingId === id) resetForm();
  }

  return (
    <main className="dayline">
      <header className="dayline-hero">
        <p className="dayline-date">
          {now.toLocaleDateString(undefined, {
            weekday: "long",
            month: "long",
            day: "numeric",
          })}
        </p>
        <h1>Dayline<span>.</span></h1>
        <p>See what needs your attention today.</p>

        <dl className="dayline-stats">
          <div><dt>Due today</dt><dd>{dueTodayCount}</dd></div>
          <div><dt>Overdue</dt><dd>{overdueCount}</dd></div>
          <div><dt>Completed</dt><dd>{completedCount}</dd></div>
        </dl>

        <label className="progress-label" htmlFor="task-progress">
          {completedCount} of {tasks.length} tasks complete
        </label>
        <progress
          id="task-progress"
          value={completedCount}
          max={Math.max(tasks.length, 1)}
        />
      </header>

      <div className="dayline-content">
        <section aria-labelledby="form-title">
          <h2 id="form-title">{editingId === null ? "New task" : "Edit task"}</h2>

          <form className="task-form" onSubmit={saveTask}>
            <div className="task-name-field">
              <label htmlFor="task-name">Task name</label>
              <input
                id="task-name"
                placeholder="e.g. Review my portfolio"
                value={draft.name}
                onChange={event => setDraft({ ...draft, name: event.target.value })}
                maxLength={120}
                required
              />
            </div>

            <div>
              <label htmlFor="task-date">Due date <small>(optional)</small></label>
              <input
                id="task-date"
                type="date"
                value={draft.due}
                onChange={event => setDraft({ ...draft, due: event.target.value, reminderTime: event.target.value ? draft.reminderTime : "" })}
              />
            </div>

            <div>
              <label htmlFor="task-priority">Priority</label>
              <select
                id="task-priority"
                value={draft.priority}
                onChange={event => setDraft({ ...draft, priority: event.target.value })}
              >
                <option value="normal">Normal</option>
                <option value="high">High</option>
              </select>
            </div>

            <div className="reminder-field">
              <label htmlFor="task-reminder">Reminder time <small>(optional)</small></label>
              <input id="task-reminder" type="time" value={draft.reminderTime}
                disabled={!draft.due}
                onChange={event => setDraft({ ...draft, reminderTime: event.target.value })}
                aria-describedby="reminder-help" />
              <small id="reminder-help">On the due date, in this device's time zone. Enable phone reminders below.</small>
            </div>
            <div className="form-actions">
              <button className="primary-button" type="submit" disabled={!draft.name.trim()}>
                {editingId === null ? "Add task" : "Save changes"}
              </button>
              {editingId !== null && (
                <button type="button" onClick={resetForm}>Cancel</button>
              )}
            </div>
          </form>

          {formError && <p role="alert">{formError}</p>}

          {storageError && (
            <p role="status">Saved tasks could not be fully loaded or saved. Changes may be lost on refresh.</p>
          )}
        </section>

        <section className="task-section" aria-labelledby="tasks-title">
          <h2 id="tasks-title">Your tasks</h2>
          <div className="task-filters" role="group" aria-label="Filter tasks">
            {FILTERS.map(option => (
              <button
                key={option.value}
                type="button"
                aria-pressed={filter === option.value}
                onClick={() => setFilter(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>

          {visibleTasks.length === 0 ? (
            <p className="empty-state">
              {tasks.length === 0 ? "Add your first task above." : "No tasks in this view."}
            </p>
          ) : (
            <ul className="task-list">
              {visibleTasks.map(task => {
                const isOverdue = !task.done && task.due && task.due < today;

                return (
                  <li key={task.id} className="task-row">
                    <div className="task-details">
                      <label className={task.done ? "task-label is-done" : "task-label"}>
                        <input
                          type="checkbox"
                          checked={Boolean(task.done)}
                          onChange={() => toggleTask(task.id)}
                        />
                        <span>{task.name}</span>
                      </label>
                      <div className="task-meta">
                        {task.due && (
                          <time dateTime={task.due} className={isOverdue ? "overdue" : undefined}>
                            {isOverdue ? "Overdue: " : "Due "}
                            {formatDate(task.due)}
                          </time>
                        )}
                        {task.reminderAt && <span>Reminder {new Date(task.reminderAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span>}
                        {task.priority === "high" && <span className="priority">High priority</span>}
                      </div>
                    </div>

                    <div className="task-actions">
                      <button type="button" aria-label={`Edit ${task.name}`} onClick={() => editTask(task)}>
                        Edit
                      </button>
                      <button
                        type="button"
                        className="delete-button"
                        aria-label={`Delete ${task.name}`}
                        onClick={() => deleteTask(task.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
        <NotificationSettings tasks={tasks} />
      </div>
    </main>
  );
}
