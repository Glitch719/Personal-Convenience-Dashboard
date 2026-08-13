import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

class MemoryStorage {
  constructor() { this.values = new Map(); }
  get length() { return this.values.size; }
  key(index) { return Array.from(this.values.keys())[index] ?? null; }
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  setItem(key, value) { this.values.set(String(key), String(value)); }
  removeItem(key) { this.values.delete(String(key)); }
  clear() { this.values.clear(); }
}

globalThis.localStorage = new MemoryStorage();

const { exportDashboardData, importDashboardData, loadArray, loadJSON, loadObject, saveJSON } = await import("../js/storage.js");
const { createId, formatRelative, isValidTimeZone, restoreRemovedItems } = await import("../js/utils.js");
const { LOCATIONS, NEWS_FEEDS } = await import("../js/config.js");
const { remainingSecondsUntil } = await import("../js/widgets/focus.js");
const { moveInOrder, normalizeOrder } = await import("../js/widgets/layout.js");
const { normalizeCalendarEvent, sortCalendarItems, sortUpcomingItems } = await import("../js/widgets/calendar.js");
const { normalizeHabit } = await import("../js/widgets/habits.js");
const { projectHabitItems, projectReminderItems, projectTaskItems } = await import("../js/planner.js");

test("storage round-trips dashboard data", function () {
  localStorage.clear();
  saveJSON("dashboard.tasks", [{ id: "1", text: "Test" }]);
  assert.deepEqual(loadJSON("dashboard.tasks", []), [{ id: "1", text: "Test" }]);

  const backup = exportDashboardData();
  localStorage.clear();
  importDashboardData(backup);
  assert.deepEqual(loadJSON("dashboard.tasks", []), [{ id: "1", text: "Test" }]);
});

test("invalid backups are rejected before changing storage", function () {
  localStorage.clear();
  localStorage.setItem("dashboard.keep", JSON.stringify("original"));
  assert.throws(function () {
    importDashboardData({
      version: 1,
      data: {
        "dashboard.new": JSON.stringify("new value"),
        "dashboard.broken": "not-json",
      },
    });
  });
  assert.equal(localStorage.getItem("dashboard.new"), null);
  assert.equal(loadJSON("dashboard.keep", null), "original");
});

test("typed storage helpers contain malformed values", function () {
  localStorage.setItem("dashboard.array", JSON.stringify({ wrong: true }));
  localStorage.setItem("dashboard.object", JSON.stringify(["wrong"]));
  assert.deepEqual(loadArray("dashboard.array"), []);
  assert.deepEqual(loadObject("dashboard.object"), {});
});

test("generated IDs are unique", function () {
  const ids = new Set(Array.from({ length: 500 }, createId));
  assert.equal(ids.size, 500);
});

test("removed records can be restored without losing newer records", function () {
  const newer = [{ id: "new", text: "Added afterwards" }];
  const restored = restoreRemovedItems(newer, [
    { index: 0, item: { id: "first", text: "First" } },
    { index: 1, item: { id: "second", text: "Second" } },
  ]);
  assert.deepEqual(restored.map(function (item) { return item.id; }), ["first", "second", "new"]);
  assert.deepEqual(restoreRemovedItems(restored, [{ index: 0, item: restored[0] }]), restored);
});

test("focus timer derives reload-safe remaining time from its end timestamp", function () {
  const now = 1_000_000;
  assert.equal(remainingSecondsUntil(now + 90_000, now), 90);
  assert.equal(remainingSecondsUntil(now + 1, now), 1);
  assert.equal(remainingSecondsUntil(now - 1, now), 0);
});

test("saved widget layouts are normalized and movable", function () {
  assert.deepEqual(
    normalizeOrder(["tasks", "tasks", "missing"], ["weather", "tasks", "focus"]),
    ["tasks", "weather", "focus"],
  );
  assert.deepEqual(moveInOrder(["weather", "tasks", "focus"], "focus", -1), ["weather", "focus", "tasks"]);
  assert.deepEqual(moveInOrder(["weather", "tasks", "focus"], "weather", -1), ["weather", "tasks", "focus"]);
});

test("calendar items migrate safely and respect day and agenda ordering", function () {
  const legacy = normalizeCalendarEvent({ id: "old", date: "2026-08-14", title: "Legacy item", notes: "Kept" });
  assert.equal(legacy.type, "event");
  assert.equal(legacy.priority, "normal");
  assert.equal(legacy.notes, "Kept");

  const lowEarly = normalizeCalendarEvent({ id: "low", date: "2026-08-14", time: "08:00", title: "Low", priority: "low" });
  const highLate = normalizeCalendarEvent({ id: "high", date: "2026-08-14", time: "18:00", title: "High", priority: "high" });
  const tomorrow = normalizeCalendarEvent({ id: "tomorrow", date: "2026-08-15", time: "07:00", title: "Tomorrow", priority: "high" });
  assert.deepEqual(sortCalendarItems([lowEarly, highLate]).map(function (item) { return item.id; }), ["high", "low"]);
  assert.deepEqual(sortUpcomingItems([tomorrow, lowEarly, highLate]).map(function (item) { return item.id; }), ["high", "low", "tomorrow"]);
});

test("tasks, reminders, and scheduled habits project into the calendar without duplicate storage", function () {
  const taskItems = projectTaskItems([
    { id: "t1", text: "Submit work", due: "2026-08-17", priority: "high", done: false },
    { id: "t2", text: "No date", due: "", priority: "normal", done: false },
  ]);
  assert.equal(taskItems.length, 1);
  assert.deepEqual(
    { id: taskItems[0].id, type: taskItems[0].type, priority: taskItems[0].priority, external: taskItems[0].external },
    { id: "task:t1", type: "task", priority: "high", external: true },
  );

  const reminderTime = new Date(2026, 7, 18, 9, 30).getTime();
  const reminderItems = projectReminderItems([{ id: "r1", text: "Call", time: reminderTime }]);
  assert.equal(reminderItems[0].date, "2026-08-18");
  assert.equal(reminderItems[0].time, "09:30");

  const legacyHabit = normalizeHabit({ id: "h0", name: "Legacy", dates: [] });
  assert.deepEqual(legacyHabit.schedule, { days: [], time: "", notify: false });
  const scheduledHabit = normalizeHabit({
    id: "h1", name: "Exercise", dates: ["2026-08-17"],
    schedule: { days: [1], time: "07:00", notify: true },
  });
  const habitItems = projectHabitItems(scheduledHabit ? [scheduledHabit] : [], new Date(2026, 7, 17), new Date(2026, 7, 18));
  assert.equal(habitItems.length, 1);
  assert.equal(habitItems[0].date, "2026-08-17");
  assert.equal(habitItems[0].completed, true);
});

test("configured timezones and feed URLs are valid", function () {
  LOCATIONS.forEach(function (location) { assert.equal(isValidTimeZone(location.zone), true); });
  NEWS_FEEDS.forEach(function (feed) { assert.equal(new URL(feed.url).protocol, "https:"); });
});

test("relative time handles past, present, and future", function () {
  assert.equal(formatRelative(Date.now()), "now");
  assert.match(formatRelative(Date.now() + 2 * 60 * 60 * 1000), /2 hours|in 2 hours/);
  assert.match(formatRelative(Date.now() - 24 * 60 * 60 * 1000), /yesterday|1 day ago/);
});

test("every JavaScript element ID exists once in the page", async function () {
  const root = new URL("../", import.meta.url);
  const html = await readFile(new URL("index.html", root), "utf8");
  const ids = Array.from(html.matchAll(/\bid="([^"]+)"/g), function (match) { return match[1]; });
  assert.equal(new Set(ids).size, ids.length, "HTML contains duplicate IDs");

  const jsRoot = new URL("js/", root);
  const widgetNames = await readdir(new URL("widgets/", jsRoot));
  const files = ["main.js", "storage.js", "state.js", "utils.js", "config.js"]
    .map(function (name) { return new URL(name, jsRoot); })
    .concat(widgetNames.filter(function (name) { return name.endsWith(".js"); }).map(function (name) {
      return new URL("widgets/" + name, jsRoot);
    }));

  for (const file of files) {
    const source = await readFile(file, "utf8");
    for (const match of source.matchAll(/getElementById\("([^"]+)"\)/g)) {
      assert.ok(ids.includes(match[1]), `${match[1]} referenced by ${join(file.pathname)} is missing from index.html`);
    }
  }
});

test("every widget module loads without top-level errors", async function () {
  const widgetFiles = (await readdir(new URL("../js/widgets/", import.meta.url)))
    .filter(function (name) { return name.endsWith(".js"); });
  const modules = await Promise.all(widgetFiles.map(function (name) {
    return import(new URL("../js/widgets/" + name, import.meta.url));
  }));
  modules.forEach(function (module, index) {
    assert.ok(Object.keys(module).length > 0, widgetFiles[index] + " has no exports");
  });
});
