import { exportDashboardData, importDashboardData, loadJSON, loadObject, saveJSON } from "../storage.js";
import { reportStatus } from "../utils.js";
import { getLayoutApi } from "./layout.js";

const VISIBILITY_KEY = "dashboard.widgetVisibility";
const NAME_KEY = "dashboard.displayName";

export function initSettings() {
  const btn   = document.getElementById("settings-btn");
  const panel = document.getElementById("settings-panel");
  const list  = document.getElementById("settings-list");
  const exportBtn = document.getElementById("settings-export");
  const importInput = document.getElementById("settings-import");
  const importBtn = document.getElementById("settings-import-btn");
  const nameInput = document.getElementById("settings-name");
  const nameSaveBtn = document.getElementById("settings-name-save");
  const densityButtons = document.querySelectorAll("[data-density]");
  const arrangeBtn = document.getElementById("layout-arrange");
  const resetLayoutBtn = document.getElementById("layout-reset");
  const layoutApi = getLayoutApi();

  // Auto-discovery: find every section tagged as a widget. Adding a new
  // widget later needs nothing here, just the data-widget attribute on it.
  const widgets = Array.from(document.querySelectorAll("[data-widget]")).map(function (el) {
    return {
      id:    el.getAttribute("data-widget"),
      label: el.getAttribute("data-widget-label") || el.getAttribute("data-widget"),
      el:    el,
    };
  });

  // Saved visibility map, e.g. { weather: true, tasks: false }.
  let visibility = loadObject(VISIBILITY_KEY);

  // Anything not explicitly turned off counts as visible, so new widgets
  // show up by default.
  function isVisible(id) {
    return visibility[id] !== false;
  }

  // Show or hide each section by toggling one CSS class.
  function apply() {
    widgets.forEach(function (w) {
      w.el.classList.toggle("widget-hidden", !isVisible(w.id));
      w.el.setAttribute("aria-hidden", String(!isVisible(w.id)));
    });
  }

  function buildList() {
    list.innerHTML = "";
    const layoutState = layoutApi ? layoutApi.getState() : { order: [], collapsed: {}, density: "comfortable" };
    const sortedWidgets = widgets.slice().sort(function (a, b) {
      const ai = layoutState.order.indexOf(a.id);
      const bi = layoutState.order.indexOf(b.id);
      if (ai === -1 && bi === -1) return 0;
      if (ai === -1) return -1;
      if (bi === -1) return 1;
      return ai - bi;
    });

    sortedWidgets.forEach(function (w) {
      const row = document.createElement("div");
      row.className = "settings-row";

      const visibilityLabel = document.createElement("label");
      visibilityLabel.className = "settings-widget-label";

      const box = document.createElement("input");
      box.type = "checkbox";
      box.checked = isVisible(w.id);
      box.setAttribute("aria-label", "Show " + w.label);
      box.addEventListener("change", function () {
        visibility[w.id] = box.checked;
        saveJSON(VISIBILITY_KEY, visibility);
        apply();
      });

      const name = document.createElement("span");
      name.textContent = w.label;

      visibilityLabel.append(box, name);
      row.appendChild(visibilityLabel);

      if (layoutApi && layoutState.order.includes(w.id)) {
        const controls = document.createElement("div");
        controls.className = "settings-widget-controls";

        const collapseBtn = document.createElement("button");
        collapseBtn.type = "button";
        collapseBtn.textContent = layoutState.collapsed[w.id] ? "+" : "−";
        collapseBtn.title = layoutState.collapsed[w.id] ? "Expand" : "Collapse";
        collapseBtn.setAttribute("aria-label", (layoutState.collapsed[w.id] ? "Expand " : "Collapse ") + w.label);
        collapseBtn.addEventListener("click", function () { layoutApi.toggleCollapsed(w.id); });

        const upBtn = document.createElement("button");
        upBtn.type = "button";
        upBtn.textContent = "↑";
        upBtn.title = "Move up";
        upBtn.setAttribute("aria-label", "Move " + w.label + " up");
        upBtn.disabled = layoutState.order.indexOf(w.id) === 0;
        upBtn.addEventListener("click", function () { layoutApi.move(w.id, -1); });

        const downBtn = document.createElement("button");
        downBtn.type = "button";
        downBtn.textContent = "↓";
        downBtn.title = "Move down";
        downBtn.setAttribute("aria-label", "Move " + w.label + " down");
        downBtn.disabled = layoutState.order.indexOf(w.id) === layoutState.order.length - 1;
        downBtn.addEventListener("click", function () { layoutApi.move(w.id, 1); });

        controls.append(collapseBtn, upBtn, downBtn);
        row.appendChild(controls);
      }

      list.appendChild(row);
    });

    densityButtons.forEach(function (button) {
      button.setAttribute("aria-pressed", String(button.dataset.density === layoutState.density));
    });
  }

  // Open/close the panel.
  // Keep clicks inside the panel from reaching the outside-click handler.
  // Some layout actions rebuild their own controls during the click, which
  // detaches the original target before the event reaches document.
  panel.addEventListener("click", function (event) { event.stopPropagation(); });

  btn.addEventListener("click", function () {
    panel.hidden = !panel.hidden;
    btn.setAttribute("aria-expanded", String(!panel.hidden));
    if (!panel.hidden) {
      const firstControl = panel.querySelector("button, input");
      if (firstControl) firstControl.focus();
    }
  });

  // Close when clicking anywhere outside the panel or the button.
  document.addEventListener("click", function (e) {
    if (!panel.hidden && !panel.contains(e.target) && !btn.contains(e.target)) {
      panel.hidden = true;
      btn.setAttribute("aria-expanded", "false");
    }
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && !panel.hidden) {
      panel.hidden = true;
      btn.setAttribute("aria-expanded", "false");
      btn.focus();
    }
  });

  exportBtn.addEventListener("click", function () {
    const blob = new Blob([JSON.stringify(exportDashboardData(), null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "daily-dashboard-backup.json";
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 0);
  });

  importBtn.addEventListener("click", function () { importInput.click(); });

  importInput.addEventListener("change", async function () {
    const file = importInput.files && importInput.files[0];
    if (!file) return;
    try {
      importDashboardData(JSON.parse(await file.text()));
      location.reload();
    } catch (err) {
      reportStatus(err.message || "Could not import that backup.", importInput);
      importInput.value = "";
    }
  });

  nameInput.value = String(loadJSON(NAME_KEY, "") || "");
  function saveName() {
    saveJSON(NAME_KEY, nameInput.value.trim());
    window.dispatchEvent(new CustomEvent("dashboard:name-changed"));
    reportStatus("Greeting name saved.");
  }
  nameSaveBtn.addEventListener("click", saveName);
  nameInput.addEventListener("keydown", function (e) { if (e.key === "Enter") saveName(); });

  densityButtons.forEach(function (button) {
    button.addEventListener("click", function () {
      if (layoutApi) layoutApi.setDensity(button.dataset.density);
    });
  });

  arrangeBtn.addEventListener("click", function () {
    if (!layoutApi) return;
    const next = !layoutApi.getState().arranging;
    layoutApi.setArranging(next);
    arrangeBtn.textContent = next ? "Done arranging" : "Arrange widgets";
    arrangeBtn.classList.toggle("active", next);
  });

  resetLayoutBtn.addEventListener("click", function () {
    if (layoutApi) layoutApi.reset();
  });

  window.addEventListener("dashboard:layout-changed", function () {
    buildList();
    if (layoutApi) {
      const state = layoutApi.getState();
      arrangeBtn.textContent = state.arranging ? "Done arranging" : "Arrange widgets";
      arrangeBtn.classList.toggle("active", state.arranging);
    }
  });

  buildList();
  apply();
}
