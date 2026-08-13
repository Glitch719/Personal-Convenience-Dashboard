import { loadJSON, saveJSON } from "../storage.js";
import { state } from "../state.js";
import { createId, reportStatus } from "../utils.js";

const TASKS_KEY = "dashboard.tasks";

export function initTasks() {
  // The widget's state and its helpers live inside init, so they are
  // private to this widget. Nothing outside can touch the tasks array.
  let tasks = loadJSON(TASKS_KEY, []);

  const input = document.getElementById("task-input");
  const list  = document.getElementById("task-list");
  const count = document.getElementById("tasks-count");

  // Each operation follows the same rhythm: change state, save, re-render.
  function addTask(text) {
    tasks.push({ id: createId(), text: text, done: false });
    saveJSON(TASKS_KEY, tasks);
    render();
  }

  function toggleTask(id) {
    const t = tasks.find(function (t) { return t.id === id; });
    if (t) t.done = !t.done;
    saveJSON(TASKS_KEY, tasks);
    render();
  }

  function deleteTask(id) {
    tasks = tasks.filter(function (t) { return t.id !== id; });
    saveJSON(TASKS_KEY, tasks);
    render();
  }

  // Rebuild the whole list from the tasks array.
  function render() {
    list.innerHTML = "";

    if (tasks.length === 0) {
      list.innerHTML = '<li class="task-empty">Nothing yet. Add your first task above.</li>';
    } else {
      tasks.forEach(function (task) {
        const li = document.createElement("li");
        li.className = "task" + (task.done ? " done" : "");

        const box = document.createElement("input");
        box.type = "checkbox";
        box.checked = task.done;
        box.addEventListener("change", function () { toggleTask(task.id); });

        const text = document.createElement("span");
        text.className = "task-text";
        text.textContent = task.text;   // textContent, not innerHTML: safe from injected markup

        const del = document.createElement("button");
        del.className = "task-del";
        del.textContent = "\u00D7";
        del.title = "Delete";
        del.setAttribute("aria-label", "Delete task: " + task.text);
        del.addEventListener("click", function () { deleteTask(task.id); });

        li.append(box, text, del);
        list.appendChild(li);
      });
    }

    const remaining = tasks.filter(function (t) { return !t.done; }).length;
    count.textContent = tasks.length === 0 ? "" : remaining + " of " + tasks.length + " left";

    // Publish a snapshot for the Today summary: totals plus the first
    // unfinished task, so the summary can show "next: ...".
    const firstUndone = tasks.find(function (t) { return !t.done; });
    state.taskSummary = {
      total: tasks.length,
      remaining: remaining,
      top: firstUndone ? firstUndone.text : null,
    };
  }

  function submit() {
    const text = input.value.trim();
    if (!text) return reportStatus("Enter a task first.", input);
    addTask(text);
    input.value = "";
    input.focus();
  }

  input.addEventListener("keydown", function (e) { if (e.key === "Enter") submit(); });
  document.getElementById("task-add").addEventListener("click", submit);
  render();
}
