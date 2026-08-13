import { loadArray, saveJSON } from "../storage.js";
import { createId, offerUndo, reportStatus, restoreRemovedItems } from "../utils.js";

const HABITS_KEY = "dashboard.habits";

// "YYYY-MM-DD" for a Date. Same sortable key format used elsewhere.
function dayKey(d) {
  return d.getFullYear() + "-" +
    String(d.getMonth() + 1).padStart(2, "0") + "-" +
    String(d.getDate()).padStart(2, "0");
}

export function initHabits() {
  let habits = loadArray(HABITS_KEY);

  const input  = document.getElementById("habit-input");
  const listEl = document.getElementById("habits-list");
  const progressEl = document.getElementById("habits-progress");
  const progressRing = document.getElementById("habit-progress-ring");
  const progressNumber = document.getElementById("habit-progress-number");

  function save() { saveJSON(HABITS_KEY, habits); }

  function addHabit(name) {
    habits.push({ id: createId(), name: name, dates: [] });
    save(); render();
  }
  function removeHabit(id) {
    const index = habits.findIndex(function (habit) { return habit.id === id; });
    if (index === -1) return;
    const removed = [{ index: index, item: habits[index] }];
    habits.splice(index, 1);
    save(); render();
    offerUndo("Habit removed.", function () {
      habits = restoreRemovedItems(habits, removed);
      save(); render();
    }, "Habit restored.");
  }
  // Mark or unmark a habit as done on a given day.
  function toggleDay(id, key) {
    const h = habits.find(function (x) { return x.id === id; });
    if (!h) return;
    const i = h.dates.indexOf(key);
    if (i === -1) h.dates.push(key); else h.dates.splice(i, 1);
    save(); render();
  }

  // The last n calendar days, oldest first, as Date objects.
  function lastDays(n) {
    const days = [];
    for (let i = n - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      days.push(d);
    }
    return days;
  }

  // Count consecutive completed days ending today. If today isn't done yet,
  // we start from yesterday so an unfinished today doesn't zero the streak.
  function streakOf(doneSet) {
    let count = 0;
    const d = new Date();
    if (!doneSet.has(dayKey(d))) d.setDate(d.getDate() - 1);
    while (doneSet.has(dayKey(d))) {
      count++;
      d.setDate(d.getDate() - 1);   // step back one day and check again
    }
    return count;
  }

  function render() {
    listEl.innerHTML = "";
    const today = dayKey(new Date());
    const doneToday = habits.filter(function (habit) { return habit.dates.includes(today); }).length;
    const percent = habits.length ? Math.round(doneToday / habits.length * 100) : 0;
    progressEl.textContent = habits.length ? doneToday + " of " + habits.length + " done today" : "";
    progressNumber.textContent = percent + "%";
    progressRing.style.setProperty("--habit-progress", (percent * 3.6) + "deg");
    if (habits.length === 0) {
      listEl.innerHTML = '<p class="habits-empty">No habits yet. Add one above.</p>';
      return;
    }

    const days = lastDays(7);

    habits.forEach(function (h) {
      // A Set gives O(1) "is this day done?" lookups.
      const doneSet = new Set(h.dates);

      const row = document.createElement("div");
      row.className = "habit-row";

      const head = document.createElement("div");
      head.className = "habit-head";

      const name = document.createElement("span");
      name.className = "habit-name";
      name.textContent = h.name;

      const s = streakOf(doneSet);
      const streakEl = document.createElement("span");
      streakEl.className = "habit-streak" + (s > 0 ? " active" : "");
      streakEl.textContent = s > 0 ? s + " day streak" : "no streak";

      const del = document.createElement("button");
      del.className = "habit-del";
      del.textContent = "\u00D7";
      del.title = "Remove habit";
      del.setAttribute("aria-label", "Remove habit: " + h.name);
      del.addEventListener("click", function () { removeHabit(h.id); });

      head.append(name, streakEl, del);

      const daysRow = document.createElement("div");
      daysRow.className = "habit-days";
      days.forEach(function (d) {
        const key = dayKey(d);
        const btn = document.createElement("button");
        btn.className = "habit-day" + (doneSet.has(key) ? " done" : "");
        btn.textContent = d.toLocaleDateString("en-GB", { weekday: "narrow" });
        btn.title = key;
        btn.setAttribute("aria-label", h.name + " on " + key);
        btn.setAttribute("aria-pressed", String(doneSet.has(key)));
        btn.addEventListener("click", function () { toggleDay(h.id, key); });
        daysRow.appendChild(btn);
      });

      row.append(head, daysRow);
      listEl.appendChild(row);
    });
  }

  function submit() {
    const name = input.value.trim();
    if (!name) return reportStatus("Enter a habit first.", input);
    if (habits.some(function (habit) { return habit.name.toLowerCase() === name.toLowerCase(); })) {
      return reportStatus("That habit already exists.", input);
    }
    addHabit(name);
    input.value = "";
    input.focus();
  }

  input.addEventListener("keydown", function (e) { if (e.key === "Enter") submit(); });
  document.getElementById("habit-add").addEventListener("click", submit);
  render();
}
