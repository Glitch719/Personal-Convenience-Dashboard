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
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
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
