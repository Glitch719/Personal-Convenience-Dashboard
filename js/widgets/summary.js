import { state } from "../state.js";
import { formatRelative } from "../utils.js";

// The summary owns no data of its own. It only READS the snapshots that
// other widgets publish to shared state, and composes them into a glance.

export function initSummary() {
  const body = document.getElementById("summary-body");

  function line(label, text) {
    return { label: label, text: text };
  }

  function build() {
    const lines = [];

    // Weather (published by the weather widget)
    if (state.currentWeather) {
      const w = state.currentWeather;
      lines.push(line("Weather", w.temp + "\u00B0 and " + w.cond.toLowerCase() + " in " + w.city));
    }

    // Next event (published by the calendar)
    if (state.nextEvent) {
      const ev = state.nextEvent;
      const when = ev.time ? " at " + ev.time : "";
      lines.push(line("Next event", ev.title + when + "  \u00B7  " + formatRelative(ev.whenMs)));
    } else {
      lines.push(line("Next event", "Nothing scheduled"));
    }

    // Tasks (published by the tasks widget)
    if (state.taskSummary && state.taskSummary.total > 0) {
      const t = state.taskSummary;
      let txt = t.remaining + " of " + t.total + " left";
      if (t.top) txt += "  \u00B7  next: " + t.top;
      if (t.due) txt += " (due " + t.due + ")";
      lines.push(line("Tasks", txt));
    } else {
      lines.push(line("Tasks", "All clear"));
    }

    // Spending this month (published by the expenses widget)
    if (state.expenseTotal) {
      const e = state.expenseTotal;
      let spending = e.currency + e.amount.toFixed(2) + " this month";
      if (e.budget > 0) spending += " of " + e.currency + e.budget.toFixed(2) + " budget";
      lines.push(line("Spending", spending));
    }

    // Next reminder (published by the reminders widget)
    if (state.nextReminder) {
      const r = state.nextReminder;
      lines.push(line("Reminder", r.text + "  \u00B7  " + formatRelative(r.time)));
    }

    return lines;
  }

  function render() {
    body.innerHTML = "";
    build().forEach(function (l) {
      const row = document.createElement("div");
      row.className = "summary-row";

      const key = document.createElement("span");
      key.className = "summary-key";
      key.textContent = l.label;

      const val = document.createElement("span");
      val.className = "summary-val";
      val.textContent = l.text;

      row.append(key, val);
      body.appendChild(row);
    });
  }

  // Poll and recompose. Widgets publish their snapshots on their own
  // schedules; the summary just re-reads the latest every few seconds.
  render();
  setInterval(render, 5000);
}
