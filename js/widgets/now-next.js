import { loadArray } from "../storage.js";
import { state } from "../state.js";
import { getPlannerItems } from "../planner.js";
import { formatRelative } from "../utils.js";

function whenMs(item) { return new Date(item.date + "T" + (item.time || "23:59:59")).getTime(); }
function formatTimer(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor(seconds % 3600 / 60);
  const secs = seconds % 60;
  return (hours ? String(hours).padStart(2, "0") + ":" : "") + String(minutes).padStart(2, "0") + ":" + String(secs).padStart(2, "0");
}

export function buildNowNextItems(now, plannerItems, calendarEvents, focusSession) {
  const items = [];
  if (focusSession && focusSession.running) {
    items.push({ kind: "active", label: focusSession.label, title: formatTimer(focusSession.seconds), meta: focusSession.mode === "countdown" ? "remaining" : "elapsed" });
  }
  const scheduled = plannerItems.concat(calendarEvents.map(function (event) {
    return Object.assign({ type: event.type || "event", priority: event.priority || "normal" }, event);
  })).filter(function (item) { return !item.completed; }).map(function (item) {
    return Object.assign({}, item, { whenMs: whenMs(item) });
  }).filter(function (item) { return item.whenMs >= now - 24 * 60 * 60 * 1000; }).sort(function (a, b) {
    const overdueA = a.whenMs < now ? 0 : 1, overdueB = b.whenMs < now ? 0 : 1;
    return overdueA - overdueB || a.whenMs - b.whenMs;
  });
  scheduled.slice(0, Math.max(0, 4 - items.length)).forEach(function (item) {
    items.push({
      kind: item.whenMs < now ? "overdue" : item.type,
      label: item.whenMs < now ? "Overdue" : (item.label || item.type || "Scheduled"),
      title: item.title,
      meta: formatRelative(item.whenMs),
    });
  });
  return items;
}

export function initNowNext() {
  const list = document.getElementById("now-next-list");
  function render() {
    const now = new Date();
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 30);
    const items = buildNowNextItems(Date.now(), getPlannerItems(now, end), loadArray("dashboard.events"), state.focusSession);
    list.innerHTML = "";
    if (!items.length) {
      const empty = document.createElement("p"); empty.className = "now-next-empty"; empty.textContent = "Nothing urgent—your next few days are clear.";
      list.appendChild(empty); return;
    }
    items.forEach(function (item) {
      const card = document.createElement("div"); card.className = "now-next-item kind-" + item.kind;
      const label = document.createElement("span"); label.className = "now-next-label"; label.textContent = item.label;
      const title = document.createElement("strong"); title.textContent = item.title;
      const meta = document.createElement("span"); meta.className = "now-next-meta"; meta.textContent = item.meta;
      card.append(label, title, meta); list.appendChild(card);
    });
  }
  render();
  setInterval(render, 1000);
  window.addEventListener("dashboard:planner-changed", render);
  window.addEventListener("dashboard:focus-changed", render);
}
