import { loadJSON, saveJSON } from "../storage.js";

const REMINDERS_KEY = "dashboard.reminders";

// Formatters, built once and reused. Same Intl family as the clock.
const absFmt = new Intl.DateTimeFormat("en-GB", {
  weekday: "short", day: "numeric", month: "short",
  hour: "2-digit", minute: "2-digit", hour12: false,
});
const relFmt = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

function formatAbsolute(ms) {
  return absFmt.format(new Date(ms));
}

// Turn a moment into "in 2 hours", "5 minutes ago", "tomorrow", etc.
// Intl picks the right words and handles plurals for us.
function formatRelative(ms) {
  const diff = ms - Date.now();           // positive = future, negative = past
  const abs = Math.abs(diff);
  const MIN = 60000, HOUR = 60 * MIN, DAY = 24 * HOUR;
  if (abs < HOUR) return relFmt.format(Math.round(diff / MIN), "minute");
  if (abs < DAY)  return relFmt.format(Math.round(diff / HOUR), "hour");
  return relFmt.format(Math.round(diff / DAY), "day");
}

export function initReminders() {
  // Reuses the exact same storage helpers the tasks widget uses.
  let reminders = loadJSON(REMINDERS_KEY, []);

  const textInput = document.getElementById("reminder-text");
  const timeInput = document.getElementById("reminder-time");
  const list      = document.getElementById("reminder-list");

  function save() { saveJSON(REMINDERS_KEY, reminders); }

  function addReminder(text, whenMs) {
    reminders.push({
      id: Date.now().toString(),
      text: text,
      time: whenMs,                    // stored as a millisecond timestamp (a number)
      notified: whenMs <= Date.now(),  // if it's already past, don't fire on arrival
    });
    save();
    render();
  }

  function deleteReminder(id) {
    reminders = reminders.filter(function (r) { return r.id !== id; });
    save();
    render();
  }

  function render() {
    reminders.sort(function (a, b) { return a.time - b.time; });   // soonest first

    list.innerHTML = "";
    if (reminders.length === 0) {
      list.innerHTML = '<li class="reminder-empty">No reminders set.</li>';
      return;
    }

    const now = Date.now();
    reminders.forEach(function (r) {
      const li = document.createElement("li");
      li.className = "reminder" + (r.time <= now ? " overdue" : "");

      const main = document.createElement("div");
      main.className = "reminder-main";

      const text = document.createElement("div");
      text.className = "reminder-text";
      text.textContent = r.text;

      const when = document.createElement("div");
      when.className = "reminder-when";
      when.textContent = formatAbsolute(r.time) + "  \u00B7  " + formatRelative(r.time);

      main.append(text, when);

      const del = document.createElement("button");
      del.className = "reminder-del";
      del.textContent = "\u00D7";
      del.title = "Delete";
      del.addEventListener("click", function () { deleteReminder(r.id); });

      li.append(main, del);
      list.appendChild(li);
    });
  }

  function submit() {
    const text = textInput.value.trim();
    const when = timeInput.value;              // e.g. "2026-08-09T14:30"
    if (!text || !when) return;

    const whenMs = new Date(when).getTime();   // string -> timestamp
    if (Number.isNaN(whenMs)) return;          // guard against a bad value

    // The browser only shows the permission prompt in response to a click,
    // so this is the right moment to ask.
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }

    addReminder(text, whenMs);
    textInput.value = "";
    timeInput.value = "";
    textInput.focus();
  }

  // Fire a real desktop notification, if the user allowed them.
  function notify(reminder) {
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification("Reminder", { body: reminder.text });
    }
    // If notifications are blocked, the "overdue" highlight is the fallback.
  }

  // The scheduler. Every 15 seconds it looks for reminders whose time has
  // arrived and fires each one exactly once (the 'notified' flag ensures
  // that). It also re-renders so the relative times stay fresh.
  function checkDue() {
    const now = Date.now();
    let changed = false;
    reminders.forEach(function (r) {
      if (!r.notified && r.time <= now) {
        notify(r);
        r.notified = true;
        changed = true;
      }
    });
    if (changed) save();
    render();
  }

  document.getElementById("reminder-add").addEventListener("click", submit);
  textInput.addEventListener("keydown", function (e) { if (e.key === "Enter") submit(); });

  render();
  setInterval(checkDue, 15000);
}
