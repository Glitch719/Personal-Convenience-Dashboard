// Generic helpers used by more than one widget.

// Run a piece of setup without letting its failure touch anything else.
export function runSafely(label, fn) {
  try {
    fn();
  } catch (err) {
    console.error("[" + label + "] failed to start:", err);
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
