import { loadArray } from "./storage.js";

function localDateKey(date) {
  return date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0") + "-" + String(date.getDate()).padStart(2, "0");
}

function localTime(date) {
  return String(date.getHours()).padStart(2, "0") + ":" + String(date.getMinutes()).padStart(2, "0");
}

export function projectTaskItems(tasks) {
  return tasks.filter(function (task) { return typeof task.due === "string" && task.due; }).map(function (task) {
    return {
      id: "task:" + task.id, sourceId: task.id, source: "tasks", external: true,
      date: task.due, time: "", title: task.text || "Untitled task", type: "task", label: "Task",
      color: "#6fd8b5", priority: ["high", "normal", "low"].includes(task.priority) ? task.priority : "normal",
      location: "", url: "", notes: task.done ? "Completed task" : "Managed in the Tasks widget",
      completed: task.done === true,
    };
  });
}

export function projectReminderItems(reminders) {
  return reminders.filter(function (reminder) { return Number.isFinite(reminder.time); }).map(function (reminder) {
    const date = new Date(reminder.time);
    return {
      id: "reminder:" + reminder.id, sourceId: reminder.id, source: "reminders", external: true,
      date: localDateKey(date), time: localTime(date), title: reminder.text || "Untitled reminder",
      type: "reminder", label: "Reminder", color: "#ffb86b", priority: "normal",
      location: "", url: "", notes: "Managed in the Reminders widget", completed: false,
    };
  });
}

export function projectHabitItems(habits, startDate, endDate) {
  const items = [];
  habits.filter(function (habit) {
    return habit.schedule && Array.isArray(habit.schedule.days) && habit.schedule.days.length;
  }).forEach(function (habit) {
    const cursor = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
    const last = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
    while (cursor <= last) {
      if (habit.schedule.days.includes(cursor.getDay())) {
        const key = localDateKey(cursor);
        items.push({
          id: "habit:" + habit.id + ":" + key, sourceId: habit.id, source: "habits", external: true,
          date: key, time: habit.schedule.time || "", title: habit.name || "Untitled habit",
          type: "habit", label: "Habit", color: "#b7e36b", priority: "normal",
          location: "", url: "", notes: "Managed in the Habits widget",
          completed: Array.isArray(habit.dates) && habit.dates.includes(key),
        });
      }
      cursor.setDate(cursor.getDate() + 1);
    }
  });
  return items;
}

export function getPlannerItems(startDate, endDate) {
  return projectTaskItems(loadArray("dashboard.tasks"))
    .concat(projectReminderItems(loadArray("dashboard.reminders")))
    .concat(projectHabitItems(loadArray("dashboard.habits"), startDate, endDate));
}

export function notifyPlannerChanged() {
  window.dispatchEvent(new CustomEvent("dashboard:planner-changed"));
}
