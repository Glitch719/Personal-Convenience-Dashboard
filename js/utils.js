// Generic helpers used by more than one widget.

// Run a piece of setup without letting its failure touch anything else.
export function runSafely(label, fn) {
  try {
    fn();
  } catch (err) {
    console.error("[" + label + "] failed to start:", err);
  }
}

// Collision-resistant IDs for persisted user data. The fallback keeps the
// dashboard working in older browsers and non-secure local environments.
export function createId() {
  if (globalThis.crypto && typeof globalThis.crypto.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return Date.now().toString(36) + "-" + Math.random().toString(36).slice(2);
}

// Give inline forms consistent, accessible validation instead of failing
// silently. The message is announced by the shared live region in index.html.
export function reportStatus(message, input) {
  const region = document.getElementById("app-status");
  if (region) {
    region.textContent = "";
    requestAnimationFrame(function () { region.textContent = message; });
  }
  if (input) {
    input.setAttribute("aria-invalid", "true");
    input.focus();
    const clear = function () {
      input.removeAttribute("aria-invalid");
      input.removeEventListener("input", clear);
    };
    input.addEventListener("input", clear);
  }
}

let undoTimer = null;

// Surface destructive actions without interrupting the user's flow. A new
// action replaces the previous offer, matching the familiar one-level undo
// pattern used by mail and task apps.
export function offerUndo(message, restore, restoredMessage = "Action undone.") {
  const toast = document.getElementById("undo-toast");
  const messageEl = document.getElementById("undo-message");
  const undoBtn = document.getElementById("undo-action");
  const dismissBtn = document.getElementById("undo-dismiss");

  reportStatus(message + " Undo is available.");
  if (!toast || !messageEl || !undoBtn || !dismissBtn) return;

  if (undoTimer) clearTimeout(undoTimer);
  messageEl.textContent = message;
  toast.hidden = false;

  function close() {
    toast.hidden = true;
    undoBtn.onclick = null;
    dismissBtn.onclick = null;
    if (undoTimer) clearTimeout(undoTimer);
    undoTimer = null;
  }

  undoBtn.onclick = function () {
    close();
    restore();
    reportStatus(restoredMessage);
  };
  dismissBtn.onclick = close;
  undoTimer = setTimeout(close, 8000);
}

// Reinsert records at their former positions while preserving anything the
// user added after the deletion. Exported so bulk-undo behavior is testable.
export function restoreRemovedItems(current, removed) {
  const next = current.slice();
  removed.slice().sort(function (a, b) { return a.index - b.index; }).forEach(function (entry) {
    if (entry.item && entry.item.id && next.some(function (item) { return item.id === entry.item.id; })) return;
    next.splice(Math.min(Math.max(entry.index, 0), next.length), 0, entry.item);
  });
  return next;
}

// Is this a real IANA timezone? Ask Intl once, safely.
export function isValidTimeZone(zone) {
  try {
    new Intl.DateTimeFormat("en-GB", { timeZone: zone });
    return true;
  } catch (err) {
    return false;
  }
}

// The current time in a given zone, split into named parts.
// e.g. { hour:"21", minute:"04", second:"33", weekday:"Sat", day:"9", month:"Aug" }
export function partsFor(zone) {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: zone,
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
    weekday: "short", day: "numeric", month: "short",
  });
  const p = {};
  fmt.formatToParts(new Date()).forEach(function (part) { p[part.type] = part.value; });
  return p;
}

// Turn a moment into "in 2 hours", "5 minutes ago", "tomorrow", etc.
// Shared by the reminders widget and the Today summary.
const _relFmt = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

export function formatRelative(ms) {
  const diff = ms - Date.now();            // positive = future, negative = past
  const abs = Math.abs(diff);
  const MIN = 60000, HOUR = 60 * MIN, DAY = 24 * HOUR;
  if (abs < MIN)  return "now";
  if (abs < HOUR) return _relFmt.format(Math.round(diff / MIN), "minute");
  if (abs < DAY)  return _relFmt.format(Math.round(diff / HOUR), "hour");
  return _relFmt.format(Math.round(diff / DAY), "day");
}
