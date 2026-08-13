import { loadArray, saveJSON } from "../storage.js";
import { state } from "../state.js";
import { createId, reportStatus } from "../utils.js";

const TASKS_KEY = "dashboard.tasks";

export function initTasks() {
  // The widget's state and its helpers live inside init, so they are
  // private to this widget. Nothing outside can touch the tasks array.
  let tasks = loadArray(TASKS_KEY);

  const input = document.getElementById("task-input");
  const list  = document.getElementById("task-list");
  const count = document.getElementById("tasks-count");
  const priorityInput = document.getElementById("task-priority");
  const dueInput = document.getElementById("task-due");
  const clearBtn = document.getElementById("tasks-clear");
  const filterButtons = document.querySelectorAll("[data-task-filter]");
  let filter = "open";

  function todayKey() {
    const d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }

  // Each operation follows the same rhythm: change state, save, re-render.
  function addTask(text, priority, due) {
    tasks.push({ id: createId(), text: text, done: false, priority: priority, due: due || "", createdAt: Date.now() });
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

  function clearCompleted() {
    tasks = tasks.filter(function (task) { return !task.done; });
    saveJSON(TASKS_KEY, tasks);
    render();
  }

  function visibleTasks() {
    const visible = tasks.filter(function (task) {
      if (filter === "open") return !task.done;
      if (filter === "done") return task.done;
      return true;
    });
    const score = { high: 0, normal: 1, low: 2 };
    return visible.sort(function (a, b) {
      if (a.done !== b.done) return a.done ? 1 : -1;
      const dueA = a.due || "9999-99-99";
      const dueB = b.due || "9999-99-99";
      if (dueA !== dueB) return dueA.localeCompare(dueB);
      return (score[a.priority || "normal"] ?? 1) - (score[b.priority || "normal"] ?? 1);
    });
  }

  // Rebuild the whole list from the tasks array.
  function render() {
    list.innerHTML = "";

    const shown = visibleTasks();
    if (tasks.length === 0) {
      list.innerHTML = '<li class="task-empty">Nothing yet. Add your first task above.</li>';
    } else if (shown.length === 0) {
      list.innerHTML = '<li class="task-empty">No tasks match this filter.</li>';
    } else {
      shown.forEach(function (task) {
        const li = document.createElement("li");
        const overdue = !task.done && task.due && task.due < todayKey();
        li.className = "task" + (task.done ? " done" : "") + (overdue ? " overdue" : "");

        const box = document.createElement("input");
        box.type = "checkbox";
        box.checked = task.done;
        box.setAttribute("aria-label", "Mark " + task.text + " as " + (task.done ? "open" : "completed"));
        box.addEventListener("change", function () { toggleTask(task.id); });

        const content = document.createElement("div");
        content.className = "task-content";
        const text = document.createElement("span");
        text.className = "task-text";
        text.textContent = task.text;   // textContent, not innerHTML: safe from injected markup
        content.appendChild(text);

        const metaParts = [];
        if (task.priority === "high") metaParts.push("High priority");
        if (task.due) metaParts.push((overdue ? "Overdue · " : "Due ") + task.due);
        if (metaParts.length) {
          const meta = document.createElement("div");
          meta.className = "task-meta";
          meta.textContent = metaParts.join(" · ");
          content.appendChild(meta);
        }

        const del = document.createElement("button");
        del.className = "task-del";
        del.textContent = "\u00D7";
        del.title = "Delete";
        del.setAttribute("aria-label", "Delete task: " + task.text);
        del.addEventListener("click", function () { deleteTask(task.id); });

        li.append(box, content, del);
        list.appendChild(li);
      });
    }

    const remaining = tasks.filter(function (t) { return !t.done; }).length;
    count.textContent = tasks.length === 0 ? "" : remaining + " of " + tasks.length + " left";
    clearBtn.disabled = !tasks.some(function (task) { return task.done; });

    // Publish a snapshot for the Today summary: totals plus the first
    // unfinished task, so the summary can show "next: ...".
    const firstUndone = tasks.filter(function (t) { return !t.done; }).sort(function (a, b) {
      return (a.due || "9999-99-99").localeCompare(b.due || "9999-99-99");
    })[0];
    state.taskSummary = {
      total: tasks.length,
      remaining: remaining,
      top: firstUndone ? firstUndone.text : null,
      due: firstUndone ? firstUndone.due || null : null,
      priority: firstUndone ? firstUndone.priority || "normal" : null,
    };
  }

  function submit() {
    const text = input.value.trim();
    if (!text) return reportStatus("Enter a task first.", input);
    addTask(text, priorityInput.value, dueInput.value);
    input.value = "";
    dueInput.value = "";
    input.focus();
  }

  input.addEventListener("keydown", function (e) { if (e.key === "Enter") submit(); });
  document.getElementById("task-add").addEventListener("click", submit);
  clearBtn.addEventListener("click", clearCompleted);
  filterButtons.forEach(function (button) {
    button.addEventListener("click", function () {
      filter = button.getAttribute("data-task-filter");
      filterButtons.forEach(function (item) {
        item.setAttribute("aria-pressed", String(item === button));
      });
      render();
    });
  });
  render();
}
