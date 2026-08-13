import { exportDashboardData, importDashboardData, loadJSON, loadObject, saveJSON } from "../storage.js";
import { reportStatus } from "../utils.js";

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
    widgets.forEach(function (w) {
      const row = document.createElement("label");
      row.className = "settings-row";

      const box = document.createElement("input");
      box.type = "checkbox";
      box.checked = isVisible(w.id);
      box.addEventListener("change", function () {
        visibility[w.id] = box.checked;
        saveJSON(VISIBILITY_KEY, visibility);
        apply();
      });

      const name = document.createElement("span");
      name.textContent = w.label;

      row.append(box, name);
      list.appendChild(row);
    });
  }

  // Open/close the panel.
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
    if (!panel.hidden && !panel.contains(e.target) && e.target !== btn) {
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

  buildList();
  apply();
}
