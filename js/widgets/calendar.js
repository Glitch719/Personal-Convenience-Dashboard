import { loadArray, loadObject, saveJSON } from "../storage.js";
import { state } from "../state.js";
import { createId, offerUndo, reportStatus, restoreRemovedItems } from "../utils.js";
import { getPlannerItems } from "../planner.js";

const EVENTS_KEY = "dashboard.events";
const FILTERS_KEY = "dashboard.calendarFilters";

export const CALENDAR_TYPES = {
  event: { label: "Event", color: "#78a9ff" },
  meeting: { label: "Meeting", color: "#b695ff" },
  reminder: { label: "Reminder", color: "#ffb86b" },
  assignment: { label: "Assignment", color: "#ff7d8f" },
  task: { label: "Task", color: "#6fd8b5" },
  habit: { label: "Habit", color: "#b7e36b" },
  custom: { label: "Custom", color: "#aab4c5" },
};

const PRIORITIES = {
  high: { label: "High", marker: "!!!", rank: 0 },
  normal: { label: "Normal", marker: "", rank: 1 },
  low: { label: "Low", marker: "", rank: 2 },
};

function dateKey(year, month, day) {
  return year + "-" + String(month + 1).padStart(2, "0") + "-" + String(day).padStart(2, "0");
}

export function normalizeCalendarEvent(event) {
  const type = CALENDAR_TYPES[event?.type] ? event.type : "event";
  const priority = PRIORITIES[event?.priority] ? event.priority : "normal";
  return {
    id: event?.id || createId(),
    date: typeof event?.date === "string" ? event.date : "",
    time: typeof event?.time === "string" ? event.time : "",
    title: typeof event?.title === "string" ? event.title : "Untitled item",
    type: type,
    label: type === "custom" && typeof event?.label === "string" && event.label.trim()
      ? event.label.trim() : CALENDAR_TYPES[type].label,
    color: /^#[0-9a-f]{6}$/i.test(event?.color || "") ? event.color : CALENDAR_TYPES[type].color,
    priority: priority,
    location: typeof event?.location === "string" ? event.location : "",
    url: typeof event?.url === "string" ? event.url : "",
    notes: typeof event?.notes === "string" ? event.notes : "",
  };
}

function eventWhenMs(event) {
  return new Date(event.date + "T" + (event.time || "23:59:59")).getTime();
}

export function sortCalendarItems(items) {
  return items.slice().sort(function (a, b) {
    const priority = PRIORITIES[a.priority]?.rank - PRIORITIES[b.priority]?.rank;
    if (priority) return priority;
    return eventWhenMs(a) - eventWhenMs(b) || a.title.localeCompare(b.title);
  });
}

export function sortUpcomingItems(items) {
  return items.slice().sort(function (a, b) {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    const priority = PRIORITIES[a.priority]?.rank - PRIORITIES[b.priority]?.rank;
    if (priority) return priority;
    return (a.time || "23:59").localeCompare(b.time || "23:59") || a.title.localeCompare(b.title);
  });
}

const titleFmt = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric" });
const panelFmt = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long" });
const agendaFmt = new Intl.DateTimeFormat("en-GB", {
  weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
});
const agendaDayFmt = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short" });

export function initCalendar() {
  let events = loadArray(EVENTS_KEY).map(normalizeCalendarEvent);
  let filters = loadObject(FILTERS_KEY);
  filters.labels = filters.labels && typeof filters.labels === "object" ? filters.labels : {};
  filters.priorities = filters.priorities && typeof filters.priorities === "object" ? filters.priorities : {};

  const now = new Date();
  let viewYear = now.getFullYear();
  let viewMonth = now.getMonth();
  let selectedDate = dateKey(viewYear, viewMonth, now.getDate());

  const grid = document.getElementById("cal-grid");
  const panel = document.getElementById("cal-panel");
  const filtersEl = document.getElementById("cal-filters");
  const agendaList = document.getElementById("cal-agenda-list");
  const agendaCount = document.getElementById("cal-agenda-count");

  function save() { saveJSON(EVENTS_KEY, events); }
  function allItems() {
    const today = new Date();
    const monthStart = new Date(viewYear, viewMonth, 1);
    const monthEnd = new Date(viewYear, viewMonth + 1, 0);
    const agendaEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 90);
    const start = monthStart < today ? monthStart : today;
    const end = monthEnd > agendaEnd ? monthEnd : agendaEnd;
    return events.concat(getPlannerItems(start, end));
  }
  function filterKey(event) { return event.type === "custom" ? "custom:" + event.label.toLowerCase() : event.type; }
  function itemLabel(event) { return event.type === "custom" ? event.label : CALENDAR_TYPES[event.type].label; }
  function isEnabled(group, key) { return group[key] !== false; }
  function isVisible(event) {
    return isEnabled(filters.labels, filterKey(event)) && isEnabled(filters.priorities, event.priority);
  }

  function publishNextEvent() {
    const current = Date.now();
    const upcoming = sortUpcomingItems(allItems().filter(function (event) { return !event.completed && eventWhenMs(event) >= current; }));
    state.nextEvent = upcoming.length ? {
      title: upcoming[0].title,
      time: upcoming[0].time,
      notes: upcoming[0].notes,
      whenMs: eventWhenMs(upcoming[0]),
    } : null;
  }

  function eventsOn(key) {
    return sortCalendarItems(allItems().filter(function (event) { return event.date === key && isVisible(event); }));
  }

  function addEvent(values) {
    events.push(normalizeCalendarEvent(Object.assign({ id: createId(), date: selectedDate }, values)));
    save(); publishNextEvent(); renderAll();
    reportStatus("Calendar item added.");
  }

  function deleteEvent(id) {
    const index = events.findIndex(function (event) { return event.id === id; });
    if (index === -1) return;
    const removed = [{ index: index, item: events[index] }];
    events.splice(index, 1);
    save(); publishNextEvent(); renderAll();
    offerUndo("Calendar item deleted.", function () {
      events = restoreRemovedItems(events, removed);
      save(); publishNextEvent(); renderAll();
    }, "Calendar item restored.");
  }

  function updateNotes(id, notes) {
    const event = events.find(function (item) { return item.id === id; });
    if (event) event.notes = notes;
    save();
  }

  function createBadge(event) {
    const badge = document.createElement("span");
    badge.className = "cal-type-badge";
    badge.style.setProperty("--item-color", event.color);
    badge.textContent = itemLabel(event);
    return badge;
  }

  function renderFilters() {
    filtersEl.innerHTML = "";
    const labelOptions = Object.keys(CALENDAR_TYPES).filter(function (key) { return key !== "custom"; })
      .map(function (key) { return { key: key, label: CALENDAR_TYPES[key].label }; });
    const customLabels = Array.from(new Set(events.filter(function (event) { return event.type === "custom"; })
      .map(function (event) { return event.label; })))
      .map(function (label) { return { key: "custom:" + label.toLowerCase(), label: label }; });

    function appendGroup(title, options, group) {
      const fieldset = document.createElement("fieldset");
      const legend = document.createElement("legend");
      legend.textContent = title;
      fieldset.appendChild(legend);
      options.forEach(function (option) {
        const label = document.createElement("label");
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.checked = isEnabled(group, option.key);
        checkbox.addEventListener("change", function () {
          group[option.key] = checkbox.checked;
          saveJSON(FILTERS_KEY, filters);
          renderCalendar(); renderPanel(); renderAgenda();
        });
        label.append(checkbox, document.createTextNode(option.label));
        fieldset.appendChild(label);
      });
      filtersEl.appendChild(fieldset);
    }

    appendGroup("Labels", labelOptions.concat(customLabels), filters.labels);
    appendGroup("Priority", Object.keys(PRIORITIES).map(function (key) {
      return { key: key, label: PRIORITIES[key].label };
    }), filters.priorities);
  }

  function renderCalendar() {
    document.getElementById("cal-title").textContent = titleFmt.format(new Date(viewYear, viewMonth, 1));
    grid.innerHTML = "";
    ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].forEach(function (name) {
      const header = document.createElement("div");
      header.className = "cal-weekday";
      header.textContent = name;
      grid.appendChild(header);
    });

    const firstWeekday = (new Date(viewYear, viewMonth, 1).getDay() + 6) % 7;
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    for (let i = 0; i < firstWeekday; i++) {
      const blank = document.createElement("div");
      blank.className = "cal-cell empty";
      grid.appendChild(blank);
    }
    const today = new Date();
    const todayValue = dateKey(today.getFullYear(), today.getMonth(), today.getDate());

    for (let day = 1; day <= daysInMonth; day++) {
      const key = dateKey(viewYear, viewMonth, day);
      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = "cal-cell";
      if (key === todayValue) cell.classList.add("today");
      if (key === selectedDate) cell.classList.add("selected");
      const number = document.createElement("span");
      number.className = "cal-daynum";
      number.textContent = day;
      cell.appendChild(number);

      const dayEvents = eventsOn(key);
      cell.setAttribute("aria-label", key + (dayEvents.length ? ", " + dayEvents.length + " visible item" + (dayEvents.length === 1 ? "" : "s") : ", no visible items"));
      cell.setAttribute("aria-pressed", String(key === selectedDate));
      if (dayEvents.length) {
        const chips = document.createElement("span");
        chips.className = "cal-chips";
        dayEvents.slice(0, 3).forEach(function (event) {
          const chip = document.createElement("span");
          chip.className = "cal-chip priority-" + event.priority;
          chip.style.setProperty("--item-color", event.color);
          chip.textContent = (PRIORITIES[event.priority].marker ? PRIORITIES[event.priority].marker + " " : "") + event.title;
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
      cell.addEventListener("click", function () { selectedDate = key; renderCalendar(); renderPanel(); });
      grid.appendChild(cell);
    }
  }

  function makeEventDetails(event, compact) {
    const details = document.createElement("details");
    details.className = compact ? "cal-agenda-item" : "cal-event";
    if (event.external) details.classList.add("cal-external-item");
    if (event.completed) details.classList.add("completed");
    details.style.setProperty("--item-color", event.color);
    const summary = document.createElement("summary");
    const summaryMain = document.createElement("span");
    summaryMain.className = "cal-event-summary-main";
    const priority = document.createElement("strong");
    priority.className = "cal-priority-marker priority-" + event.priority;
    priority.textContent = PRIORITIES[event.priority].marker;
    const title = document.createElement("span");
    title.className = "cal-event-title";
    title.textContent = event.title;
    summaryMain.append(priority, title, createBadge(event));
    if (event.completed) {
      const done = document.createElement("span");
      done.className = "cal-completed-badge";
      done.textContent = "Done";
      summaryMain.appendChild(done);
    }
    const when = document.createElement("span");
    when.className = "cal-event-time";
    when.textContent = compact
      ? (event.time ? agendaFmt.format(new Date(eventWhenMs(event))) : agendaDayFmt.format(new Date(event.date + "T12:00:00")) + " · All day")
      : (event.time || "All day");
    summary.append(summaryMain, when);
    details.appendChild(summary);

    const content = document.createElement("div");
    content.className = "cal-event-details";
    if (event.location) {
      const location = document.createElement("p");
      location.innerHTML = "<strong>Location</strong> ";
      location.appendChild(document.createTextNode(event.location));
      content.appendChild(location);
    }
    if (event.url) {
      const link = document.createElement("a");
      link.href = event.url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = "Open related link";
      content.appendChild(link);
    }
    if (!compact && !event.external) {
      if (event.notes) {
        const notesCopy = document.createElement("p");
        notesCopy.className = "cal-notes-copy";
        notesCopy.textContent = event.notes;
        content.appendChild(notesCopy);
      }
      const label = document.createElement("label");
      label.className = "cal-notes-label";
      label.textContent = "Notes";
      const notes = document.createElement("textarea");
      notes.className = "cal-notes";
      notes.placeholder = "Add preparation notes...";
      notes.maxLength = 2000;
      notes.value = event.notes;
      notes.addEventListener("input", function () { updateNotes(event.id, notes.value); });
      label.appendChild(notes);
      content.appendChild(label);
      const del = document.createElement("button");
      del.type = "button";
      del.className = "cal-event-del";
      del.textContent = "Delete item";
      del.setAttribute("aria-label", "Delete calendar item: " + event.title);
      del.addEventListener("click", function () { deleteEvent(event.id); });
      content.appendChild(del);
    } else if (event.notes) {
      const notes = document.createElement("p");
      notes.textContent = event.notes;
      content.appendChild(notes);
    }
    if (!content.childElementCount) {
      const hint = document.createElement("p");
      hint.className = "cal-hint";
      hint.textContent = "No additional details.";
      content.appendChild(hint);
    }
    details.appendChild(content);
    return details;
  }

  function renderPanel() {
    panel.innerHTML = "";
    const parts = selectedDate.split("-");
    const heading = document.createElement("h3");
    heading.textContent = panelFmt.format(new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2])));
    panel.appendChild(heading);

    const form = document.createElement("div");
    form.className = "cal-add-form";
    const titleInput = document.createElement("input");
    titleInput.type = "text"; titleInput.placeholder = "New calendar item"; titleInput.maxLength = 160;
    titleInput.setAttribute("aria-label", "Calendar item title");
    const timeInput = document.createElement("input");
    timeInput.type = "time"; timeInput.setAttribute("aria-label", "Time, optional");
    const typeSelect = document.createElement("select");
    typeSelect.setAttribute("aria-label", "Item type");
    Object.keys(CALENDAR_TYPES).forEach(function (key) {
      const option = document.createElement("option"); option.value = key; option.textContent = CALENDAR_TYPES[key].label;
      typeSelect.appendChild(option);
    });
    const customInput = document.createElement("input");
    customInput.type = "text"; customInput.placeholder = "Custom label"; customInput.maxLength = 30; customInput.hidden = true;
    customInput.setAttribute("aria-label", "Custom calendar label");
    const prioritySelect = document.createElement("select");
    prioritySelect.setAttribute("aria-label", "Priority");
    Object.keys(PRIORITIES).forEach(function (key) {
      const option = document.createElement("option"); option.value = key; option.textContent = PRIORITIES[key].label + " priority";
      prioritySelect.appendChild(option);
    });
    prioritySelect.value = "normal";
    const colorInput = document.createElement("input");
    colorInput.type = "color"; colorInput.value = CALENDAR_TYPES.event.color; colorInput.setAttribute("aria-label", "Label color");
    const locationInput = document.createElement("input");
    locationInput.type = "text"; locationInput.placeholder = "Location (optional)"; locationInput.maxLength = 160;
    const urlInput = document.createElement("input");
    urlInput.type = "url"; urlInput.placeholder = "Related link (optional)";
    const notesInput = document.createElement("textarea");
    notesInput.placeholder = "Notes (optional)"; notesInput.maxLength = 2000;
    const addBtn = document.createElement("button"); addBtn.type = "button"; addBtn.textContent = "Add item";

    typeSelect.addEventListener("change", function () {
      customInput.hidden = typeSelect.value !== "custom";
      colorInput.value = CALENDAR_TYPES[typeSelect.value].color;
      if (!customInput.hidden) customInput.focus();
    });
    function submit() {
      const title = titleInput.value.trim();
      if (!title) return reportStatus("Enter a calendar item title first.", titleInput);
      const label = typeSelect.value === "custom" ? customInput.value.trim() : CALENDAR_TYPES[typeSelect.value].label;
      if (!label) return reportStatus("Enter a custom label first.", customInput);
      let url = urlInput.value.trim();
      if (url && !/^https?:\/\//i.test(url)) url = "https://" + url;
      if (url) {
        try { url = new URL(url).href; } catch (error) { return reportStatus("Enter a valid related link.", urlInput); }
      }
      addEvent({
        title: title, time: timeInput.value, type: typeSelect.value, label: label,
        color: colorInput.value, priority: prioritySelect.value, location: locationInput.value.trim(),
        url: url, notes: notesInput.value.trim(),
      });
    }
    addBtn.addEventListener("click", submit);
    titleInput.addEventListener("keydown", function (event) { if (event.key === "Enter") submit(); });
    form.append(titleInput, timeInput, typeSelect, customInput, prioritySelect, colorInput, locationInput, urlInput, notesInput, addBtn);
    panel.appendChild(form);

    const dayEvents = eventsOn(selectedDate);
    if (!dayEvents.length) {
      const empty = document.createElement("p"); empty.className = "cal-hint"; empty.textContent = "No visible items for this day.";
      panel.appendChild(empty);
    } else {
      dayEvents.forEach(function (event) { panel.appendChild(makeEventDetails(event, false)); });
    }
  }

  function renderAgenda() {
    const current = Date.now();
    const upcoming = sortUpcomingItems(allItems().filter(function (event) {
      return !event.completed && eventWhenMs(event) >= current && isVisible(event);
    }));
    agendaCount.textContent = upcoming.length ? "(" + upcoming.length + ")" : "";
    agendaList.innerHTML = "";
    if (!upcoming.length) {
      const empty = document.createElement("p"); empty.className = "cal-hint"; empty.textContent = "No upcoming items match your filters.";
      agendaList.appendChild(empty); return;
    }
    upcoming.forEach(function (event) { agendaList.appendChild(makeEventDetails(event, true)); });
  }

  function renderAll() { renderFilters(); renderCalendar(); renderPanel(); renderAgenda(); }
  function shiftMonth(delta) {
    const date = new Date(viewYear, viewMonth + delta, 1);
    viewYear = date.getFullYear(); viewMonth = date.getMonth(); renderCalendar();
  }

  document.getElementById("cal-prev").addEventListener("click", function () { shiftMonth(-1); });
  document.getElementById("cal-next").addEventListener("click", function () { shiftMonth(1); });
  document.getElementById("cal-today").addEventListener("click", function () {
    const today = new Date(); viewYear = today.getFullYear(); viewMonth = today.getMonth();
    selectedDate = dateKey(viewYear, viewMonth, today.getDate()); renderCalendar(); renderPanel();
  });
  window.addEventListener("dashboard:planner-changed", function () {
    publishNextEvent(); renderAll();
  });

  save();
  renderAll();
  publishNextEvent();
  setInterval(function () { publishNextEvent(); renderAgenda(); }, 60000);
}
