import { loadArray, loadJSON, loadObject, saveJSON } from "../storage.js";
import { reportStatus } from "../utils.js";

const ORDER_KEY = "dashboard.widgetOrder";
const COLLAPSED_KEY = "dashboard.collapsedWidgets";
const DENSITY_KEY = "dashboard.density";

export const DEFAULT_WIDGET_ORDER = [
  "weather", "focus", "clock", "tasks", "habits", "expenses",
  "reminders", "grocery", "links", "calendar", "news",
];

export function normalizeOrder(order, availableIds) {
  const available = new Set(availableIds);
  const normalized = [];
  (Array.isArray(order) ? order : []).forEach(function (id) {
    if (available.has(id) && !normalized.includes(id)) normalized.push(id);
  });
  availableIds.forEach(function (id) {
    if (!normalized.includes(id)) normalized.push(id);
  });
  return normalized;
}

export function moveInOrder(order, id, delta) {
  const next = order.slice();
  const current = next.indexOf(id);
  if (current === -1) return next;
  const target = Math.max(0, Math.min(next.length - 1, current + delta));
  if (target === current) return next;
  next.splice(current, 1);
  next.splice(target, 0, id);
  return next;
}

let layoutApi = null;

export function getLayoutApi() {
  return layoutApi;
}

export function initLayout() {
  const grid = document.querySelector(".widget-grid");
  if (!grid) return;

  const cards = Array.from(grid.querySelectorAll(":scope > [data-widget]"));
  const availableIds = cards.map(function (card) { return card.dataset.widget; });
  const defaults = normalizeOrder(DEFAULT_WIDGET_ORDER, availableIds);
  let order = normalizeOrder(loadArray(ORDER_KEY), defaults);
  let collapsed = loadObject(COLLAPSED_KEY);
  let density = loadJSON(DENSITY_KEY, "comfortable") === "compact" ? "compact" : "comfortable";
  let arranging = false;
  let draggedId = null;
  let pointerDrag = null;

  function cardFor(id) {
    return cards.find(function (card) { return card.dataset.widget === id; });
  }

  function announce(message) {
    reportStatus(message);
    window.dispatchEvent(new CustomEvent("dashboard:layout-changed", { detail: getState() }));
  }

  function applyOrder() {
    order.forEach(function (id, index) {
      const card = cardFor(id);
      if (card) card.style.order = String(index + 1);
    });
  }

  function applyDensity() {
    document.documentElement.dataset.density = density;
  }

  function applyCollapsed() {
    cards.forEach(function (card) {
      const id = card.dataset.widget;
      const isCollapsed = collapsed[id] === true;
      card.classList.toggle("widget-collapsed", isCollapsed);
      const expand = card.querySelector(".widget-collapsed-summary button");
      if (expand) expand.setAttribute("aria-expanded", String(!isCollapsed));
    });
  }

  function persistOrder() { saveJSON(ORDER_KEY, order); }
  function persistCollapsed() { saveJSON(COLLAPSED_KEY, collapsed); }

  function move(id, delta) {
    const next = moveInOrder(order, id, delta);
    if (next.join("|") === order.join("|")) return;
    order = next;
    persistOrder();
    applyOrder();
    const position = order.indexOf(id) + 1;
    announce((cardFor(id)?.dataset.widgetLabel || id) + " moved to position " + position + ".");
  }

  function moveBefore(id, targetId) {
    if (id === targetId || !order.includes(id) || !order.includes(targetId)) return;
    const next = order.filter(function (item) { return item !== id; });
    next.splice(next.indexOf(targetId), 0, id);
    order = next;
    persistOrder();
    applyOrder();
  }

  function toggleCollapsed(id) {
    collapsed[id] = collapsed[id] !== true;
    persistCollapsed();
    applyCollapsed();
    announce((cardFor(id)?.dataset.widgetLabel || id) + (collapsed[id] ? " collapsed." : " expanded."));
  }

  function setDensity(value) {
    density = value === "compact" ? "compact" : "comfortable";
    saveJSON(DENSITY_KEY, density);
    applyDensity();
    announce((density === "compact" ? "Compact" : "Comfortable") + " density applied.");
  }

  function setArranging(value) {
    arranging = Boolean(value);
    document.body.classList.toggle("layout-arranging", arranging);
    cards.forEach(function (card) {
      card.draggable = arranging;
    });
    announce(arranging ? "Arrange mode enabled. Drag cards or use arrow keys." : "Widget arrangement saved.");
  }

  function reset() {
    order = defaults.slice();
    collapsed = {};
    density = "comfortable";
    saveJSON(ORDER_KEY, order);
    saveJSON(COLLAPSED_KEY, collapsed);
    saveJSON(DENSITY_KEY, density);
    applyOrder();
    applyCollapsed();
    applyDensity();
    announce("Default dashboard layout restored.");
  }

  function getState() {
    return { order: order.slice(), collapsed: Object.assign({}, collapsed), density: density, arranging: arranging };
  }

  cards.forEach(function (card) {
    const id = card.dataset.widget;
    const label = card.dataset.widgetLabel || id;

    const collapsedSummary = document.createElement("div");
    collapsedSummary.className = "widget-collapsed-summary";
    const collapsedLabel = document.createElement("strong");
    collapsedLabel.textContent = label;
    const expandButton = document.createElement("button");
    expandButton.type = "button";
    expandButton.textContent = "Expand";
    expandButton.setAttribute("aria-label", "Expand " + label);
    expandButton.addEventListener("click", function () { toggleCollapsed(id); });
    collapsedSummary.append(collapsedLabel, expandButton);
    card.appendChild(collapsedSummary);

    const dragHandle = document.createElement("button");
    dragHandle.type = "button";
    dragHandle.className = "widget-drag-handle";
    dragHandle.textContent = "Drag to move";
    dragHandle.setAttribute("aria-label", "Move " + label + ". Use arrow keys or drag.");
    dragHandle.addEventListener("keydown", function (event) {
      if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
        event.preventDefault();
        move(id, -1);
      } else if (event.key === "ArrowDown" || event.key === "ArrowRight") {
        event.preventDefault();
        move(id, 1);
      }
    });
    dragHandle.addEventListener("pointerdown", function (event) {
      if (!arranging || event.button !== 0) return;
      event.preventDefault();
      pointerDrag = { id: id, startX: event.clientX, startY: event.clientY, moved: false };
      dragHandle.setPointerCapture(event.pointerId);
    });
    dragHandle.addEventListener("pointermove", function (event) {
      if (!pointerDrag || pointerDrag.id !== id) return;
      if (!pointerDrag.moved && Math.hypot(event.clientX - pointerDrag.startX, event.clientY - pointerDrag.startY) < 6) return;
      event.preventDefault();
      pointerDrag.moved = true;
      card.classList.add("widget-dragging");
      const target = document.elementFromPoint(event.clientX, event.clientY)?.closest(".widget-grid > [data-widget]");
      if (target) moveBefore(id, target.dataset.widget);
    });
    dragHandle.addEventListener("pointerup", function (event) {
      if (!pointerDrag || pointerDrag.id !== id) return;
      if (dragHandle.hasPointerCapture(event.pointerId)) dragHandle.releasePointerCapture(event.pointerId);
      const moved = pointerDrag.moved;
      pointerDrag = null;
      card.classList.remove("widget-dragging");
      if (moved) announce("Widget order saved.");
    });
    card.appendChild(dragHandle);

    card.addEventListener("dragstart", function (event) {
      if (!arranging) return event.preventDefault();
      draggedId = id;
      card.classList.add("widget-dragging");
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", id);
    });
    card.addEventListener("dragover", function (event) {
      if (!arranging || !draggedId || draggedId === id) return;
      event.preventDefault();
      moveBefore(draggedId, id);
    });
    card.addEventListener("dragend", function () {
      draggedId = null;
      card.classList.remove("widget-dragging");
      announce("Widget order saved.");
    });
  });

  grid.addEventListener("dragover", function (event) {
    if (arranging) event.preventDefault();
  });

  layoutApi = { getState, move, toggleCollapsed, setDensity, setArranging, reset };
  applyOrder();
  applyCollapsed();
  applyDensity();
  window.dispatchEvent(new CustomEvent("dashboard:layout-ready", { detail: getState() }));
}
