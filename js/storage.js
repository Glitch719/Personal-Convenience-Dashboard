// Persistence helpers. Anything that must survive a refresh goes through
// here, so the save/load logic lives in exactly one place. Every future
// widget (reminders, notes, settings) will reuse these two functions.

export function loadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);      // a string, or null if unset
    return raw ? JSON.parse(raw) : fallback;    // text back into objects
  } catch (err) {
    console.error("[storage] could not load " + key + ", using fallback:", err);
    return fallback;
  }
}

export function saveJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));   // objects into text
  } catch (err) {
    console.error("[storage] could not save " + key + ":", err);
  }
}
