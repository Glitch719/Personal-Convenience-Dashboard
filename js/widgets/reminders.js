import { loadArray, saveJSON } from "../storage.js";
import { createId, formatRelative, offerUndo, reportStatus, restoreRemovedItems } from "../utils.js";
import { state } from "../state.js";
import { notifyPlannerChanged } from "../planner.js";

const REMINDERS_KEY = "dashboard.reminders";

// Absolute time formatting stays here (it's reminder-specific). The
// relative formatter now lives in utils.js and is shared with the summary.
const absFmt = new Intl.DateTimeFormat("en-GB", {
  weekday: "short", day: "numeric", month: "short",
  hour: "2-digit", minute: "2-digit", hour12: false,
});

function formatAbsolute(ms) {
  return absFmt.format(new Date(ms));
}

export function initReminders() {
  // Reuses the exact same storage helpers the tasks widget uses.
  let reminders = loadArray(REMINDERS_KEY);

  const textInput = document.getElementById("reminder-text");
  const timeInput = document.getElementById("reminder-time");
  const list      = document.getElementById("reminder-list");

  function toInputValue(date) {
    return date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0") + "-" +
      String(date.getDate()).padStart(2, "0") + "T" + String(date.getHours()).padStart(2, "0") + ":" +
      String(date.getMinutes()).padStart(2, "0");
  }

  function save() { saveJSON(REMINDERS_KEY, reminders); notifyPlannerChanged(); }

  function addReminder(text, whenMs) {
    reminders.push({
      id: createId(),
      text: text,
      time: whenMs,                    // stored as a millisecond timestamp (a number)
      notified: whenMs <= Date.now(),  // if it's already past, don't fire on arrival
    });
    save();
    render();
  }

  function deleteReminder(id) {
    const index = reminders.findIndex(function (reminder) { return reminder.id === id; });
    if (index === -1) return;
    const removed = [{ index: index, item: reminders[index] }];
    reminders.splice(index, 1);
    save();
    render();
    offerUndo("Reminder deleted.", function () {
      reminders = restoreRemovedItems(reminders, removed);
      save(); render();
    }, "Reminder restored.");
  }

  function snooze(id, minutes) {
    const reminder = reminders.find(function (r) { return r.id === id; });
    if (!reminder) return;
    reminder.time = Date.now() + minutes * 60000;
    reminder.notified = false;
    save();
    render();
  }

  function render() {
    reminders.sort(function (a, b) { return a.time - b.time; });   // soonest first

    // Publish the next still-upcoming reminder for the Today summary.
    const upcoming = reminders.filter(function (r) { return r.time >= Date.now(); });
    state.nextReminder = upcoming.length
      ? { text: upcoming[0].text, time: upcoming[0].time }
      : null;

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
      del.setAttribute("aria-label", "Delete reminder: " + r.text);
      del.addEventListener("click", function () { deleteReminder(r.id); });

      const actions = document.createElement("div");
      actions.className = "reminder-actions";
      const snoozeBtn = document.createElement("button");
      snoozeBtn.className = "reminder-snooze";
      snoozeBtn.textContent = "10m";
      snoozeBtn.setAttribute("aria-label", "Snooze " + r.text + " for 10 minutes");
      snoozeBtn.addEventListener("click", function () { snooze(r.id, 10); });
      actions.append(snoozeBtn, del);

      li.append(main, actions);
      list.appendChild(li);
    });
  }

  function submit() {
    const text = textInput.value.trim();
    const when = timeInput.value;              // e.g. "2026-08-09T14:30"
    if (!text) return reportStatus("Enter what you want to be reminded about.", textInput);
    if (!when) return reportStatus("Choose a reminder date and time.", timeInput);

    const whenMs = new Date(when).getTime();   // string -> timestamp
    if (Number.isNaN(whenMs)) return reportStatus("Choose a valid reminder date and time.", timeInput);
    if (whenMs <= Date.now()) return reportStatus("Choose a reminder time in the future.", timeInput);

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

  document.querySelectorAll("[data-reminder-min]").forEach(function (button) {
    button.addEventListener("click", function () {
      const minutes = Number(button.getAttribute("data-reminder-min"));
      timeInput.value = toInputValue(new Date(Date.now() + minutes * 60000));
      timeInput.removeAttribute("aria-invalid");
      textInput.focus();
    });
  });

  timeInput.min = toInputValue(new Date());
  render();
  setInterval(checkDue, 15000);
}
