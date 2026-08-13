import { loadArray, saveJSON } from "../storage.js";
import { state } from "../state.js";
import { createId, offerUndo, reportStatus, restoreRemovedItems } from "../utils.js";

const EVENTS_KEY = "dashboard.events";

// "YYYY-MM-DD" for a given year, 0-indexed month, and day. This string is
// how we tie an event to a day, and it sorts correctly as plain text.
function dateKey(year, month, day) {
  const mm = String(month + 1).padStart(2, "0");   // +1 because months are 0-indexed
  const dd = String(day).padStart(2, "0");
  return year + "-" + mm + "-" + dd;
}

const titleFmt = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric" });
const panelFmt = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long" });

export function initCalendar() {
  let events = loadArray(EVENTS_KEY);

  const now = new Date();
  let viewYear = now.getFullYear();     // which month the grid is showing
  let viewMonth = now.getMonth();
  let selectedDate = dateKey(viewYear, viewMonth, now.getDate());  // day open in the panel

  const grid  = document.getElementById("cal-grid");
  const panel = document.getElementById("cal-panel");

  function save() { saveJSON(EVENTS_KEY, events); }

  // Combine an event's date and optional time into a single timestamp.
  function eventWhenMs(ev) {
    return new Date(ev.date + "T" + (ev.time || "23:59:59")).getTime();
  }

  // Publish the soonest still-upcoming event for the Today summary. This is
  // pure computation, no DOM work, so it's safe to run on a timer without
  // disturbing anything the user is editing.
  function publishNextEvent() {
    const now = Date.now();
    const upcoming = events
      .map(function (e) { return { ev: e, whenMs: eventWhenMs(e) }; })
      .filter(function (x) { return x.whenMs >= now; })
      .sort(function (a, b) { return a.whenMs - b.whenMs; });

    state.nextEvent = upcoming.length
      ? {
          title: upcoming[0].ev.title,
          time: upcoming[0].ev.time,
          notes: upcoming[0].ev.notes,
          whenMs: upcoming[0].whenMs,
        }
      : null;
  }

  function eventsOn(key) {
    return events
      .filter(function (e) { return e.date === key; })
      .sort(function (a, b) { return (a.time || "").localeCompare(b.time || ""); });
  }

  /* ---------- event operations ---------- */

  function addEvent(key, title, time) {
    events.push({ id: createId(), date: key, time: time || "", title: title, notes: "" });
    save();
    publishNextEvent();
    renderCalendar();
    renderPanel();
  }

  function deleteEvent(id) {
    const index = events.findIndex(function (event) { return event.id === id; });
    if (index === -1) return;
    const removed = [{ index: index, item: events[index] }];
    events.splice(index, 1);
    save();
    publishNextEvent();
    renderCalendar();
    renderPanel();
    offerUndo("Calendar event deleted.", function () {
      events = restoreRemovedItems(events, removed);
      save(); publishNextEvent(); renderCalendar(); renderPanel();
    }, "Calendar event restored.");
  }

  // Notes autosave. Crucially this does NOT re-render: rebuilding the panel
  // mid-typing would destroy the textarea and you'd lose focus every
  // keystroke. So we update state and storage, and leave the DOM in place.
  function updateNotes(id, notes) {
    const ev = events.find(function (e) { return e.id === id; });
    if (ev) ev.notes = notes;
    save();
  }

  /* ---------- rendering the month grid ---------- */

  function renderCalendar() {
    document.getElementById("cal-title").textContent =
      titleFmt.format(new Date(viewYear, viewMonth, 1));

    grid.innerHTML = "";

    // weekday headers, Monday first
    ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].forEach(function (name) {
      const h = document.createElement("div");
      h.className = "cal-weekday";
      h.textContent = name;
      grid.appendChild(h);
    });

    // Two key date facts:
    // 1) which weekday the 1st lands on. getDay() is Sun=0..Sat=6; the
    //    (+6)%7 shifts it to a Monday-first index (Mon=0..Sun=6).
    const firstWeekday = (new Date(viewYear, viewMonth, 1).getDay() + 6) % 7;
    // 2) how many days the month has. Day 0 of the NEXT month is the last
    //    day of this one, so getDate() on it gives the count.
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

    // empty cells before the 1st so it lands under the right weekday
    for (let i = 0; i < firstWeekday; i++) {
      const blank = document.createElement("div");
      blank.className = "cal-cell empty";
      grid.appendChild(blank);
    }

    const t = new Date();
    const todayKey = dateKey(t.getFullYear(), t.getMonth(), t.getDate());

    for (let d = 1; d <= daysInMonth; d++) {
      const key = dateKey(viewYear, viewMonth, d);
      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = "cal-cell";
      if (key === todayKey)     cell.classList.add("today");
      if (key === selectedDate) cell.classList.add("selected");

      const num = document.createElement("span");
      num.className = "cal-daynum";
      num.textContent = d;
      cell.appendChild(num);

      const dayEvents = eventsOn(key);
      cell.setAttribute("aria-label", key + (dayEvents.length ? ", " + dayEvents.length + " event" + (dayEvents.length === 1 ? "" : "s") : ", no events"));
      cell.setAttribute("aria-pressed", String(key === selectedDate));
      if (dayEvents.length > 0) {
        const chips = document.createElement("span");
        chips.className = "cal-chips";
        dayEvents.slice(0, 3).forEach(function (ev) {
          const chip = document.createElement("span");
          chip.className = "cal-chip";
          chip.textContent = (ev.time ? ev.time + " " : "") + ev.title;
          chips.appendChild(chip);
        });
        if (dayEvents.length > 3) {
          const more = document.createElement("span");
          more.className = "cal-more";
          more.textContent = "+" + (dayEvents.length - 3) + " more";
          chips.appendChild(more);
        }
        cell.appendChild(chips);
      }

      cell.addEventListener("click", function () {
        selectedDate = key;
        renderCalendar();
        renderPanel();
      });

      grid.appendChild(cell);
    }
  }

  /* ---------- rendering the day panel ---------- */

  function renderPanel() {
    panel.innerHTML = "";
    if (!selectedDate) {
      panel.innerHTML = '<p class="cal-hint">Select a day to see or add events.</p>';
      return;
    }

    // parse the "YYYY-MM-DD" back into numbers for a nice heading
    const parts = selectedDate.split("-");
    const heading = document.createElement("h3");
    heading.textContent = panelFmt.format(
      new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]))
    );
    panel.appendChild(heading);

    // add-event form
    const addRow = document.createElement("div");
    addRow.className = "cal-add-row";

    const titleInput = document.createElement("input");
    titleInput.type = "text";
    titleInput.placeholder = "New event";
    titleInput.setAttribute("aria-label", "Event title");
    titleInput.maxLength = 160;

    const timeInput = document.createElement("input");
    timeInput.type = "time";
    timeInput.setAttribute("aria-label", "Event time, optional");

    const addBtn = document.createElement("button");
    addBtn.textContent = "Add";

    function submit() {
      const title = titleInput.value.trim();
      if (!title) return reportStatus("Enter an event title first.", titleInput);
      addEvent(selectedDate, title, timeInput.value);
    }
    addBtn.addEventListener("click", submit);
    titleInput.addEventListener("keydown", function (e) { if (e.key === "Enter") submit(); });

    addRow.append(titleInput, timeInput, addBtn);
    panel.appendChild(addRow);

    // the day's events, each with its own prep-notes box
    const dayEvents = eventsOn(selectedDate);
    if (dayEvents.length === 0) {
      const empty = document.createElement("p");
      empty.className = "cal-hint";
      empty.textContent = "No events yet for this day.";
      panel.appendChild(empty);
      return;
    }

    dayEvents.forEach(function (ev) {
      const box = document.createElement("div");
      box.className = "cal-event";

      const head = document.createElement("div");
      head.className = "cal-event-head";

      const title = document.createElement("span");
      title.className = "cal-event-title";
      title.textContent = ev.title;

      const time = document.createElement("span");
      time.className = "cal-event-time";
      time.textContent = ev.time || "All day";

      const left = document.createElement("div");
      left.append(title, document.createTextNode(" "), time);

      const del = document.createElement("button");
      del.className = "cal-event-del";
      del.textContent = "\u00D7";
      del.title = "Delete event";
      del.setAttribute("aria-label", "Delete event: " + ev.title);
      del.addEventListener("click", function () { deleteEvent(ev.id); });

      head.append(left, del);
      box.appendChild(head);

      // The signature feature: prep notes attached to this event.
      const label = document.createElement("label");
      label.className = "cal-notes-label";
      label.textContent = "Prep notes";

      const notes = document.createElement("textarea");
      notes.className = "cal-notes";
      notes.placeholder = "What to prepare or say...";
      notes.id = "event-notes-" + ev.id;
      notes.maxLength = 2000;
      label.htmlFor = notes.id;
      notes.value = ev.notes || "";
      // autosave on every keystroke, without re-rendering (keeps focus)
      notes.addEventListener("input", function () { updateNotes(ev.id, notes.value); });

      box.append(label, notes);
      panel.appendChild(box);
    });
  }

  /* ---------- navigation ---------- */

  function shiftMonth(delta) {
    // Let Date normalise year rollover for us (month 12 -> Jan next year).
    const d = new Date(viewYear, viewMonth + delta, 1);
    viewYear = d.getFullYear();
    viewMonth = d.getMonth();
    renderCalendar();
  }

  document.getElementById("cal-prev").addEventListener("click", function () { shiftMonth(-1); });
  document.getElementById("cal-next").addEventListener("click", function () { shiftMonth(1); });
  document.getElementById("cal-today").addEventListener("click", function () {
    const today = new Date();
    viewYear = today.getFullYear();
    viewMonth = today.getMonth();
    selectedDate = dateKey(viewYear, viewMonth, today.getDate());
    renderCalendar();
    renderPanel();
  });

  renderCalendar();
  renderPanel();
  publishNextEvent();
  setInterval(publishNextEvent, 60000);   // keep the summary's "next event" fresh
}
