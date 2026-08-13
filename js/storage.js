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

export function loadArray(key) {
  const value = loadJSON(key, []);
  return Array.isArray(value) ? value : [];
}

export function loadObject(key) {
  const value = loadJSON(key, {});
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

export function exportDashboardData() {
  const data = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith("dashboard.")) data[key] = localStorage.getItem(key);
  }
  return { version: 1, exportedAt: new Date().toISOString(), data: data };
}

export function importDashboardData(backup) {
  if (!backup || backup.version !== 1 || !backup.data || typeof backup.data !== "object") {
    throw new Error("This is not a valid dashboard backup.");
  }
  const validEntries = Object.keys(backup.data).filter(function (key) {
    if (!key.startsWith("dashboard.") || typeof backup.data[key] !== "string") return;
    JSON.parse(backup.data[key]);
    return true;
  });
  validEntries.forEach(function (key) {
    localStorage.setItem(key, backup.data[key]);
  });
}
