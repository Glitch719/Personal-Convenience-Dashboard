import { loadJSON, saveJSON } from "../storage.js";
import { reportStatus } from "../utils.js";

const EDIT_MODE_KEY = "dashboard.editMode";

export function initEditMode() {
  const button = document.getElementById("edit-mode-btn");
  let editing = loadJSON(EDIT_MODE_KEY, true) !== false;

  function apply(announce) {
    document.body.classList.toggle("edit-mode", editing);
    button.textContent = editing ? "Done" : "Edit";
    button.setAttribute("aria-pressed", String(editing));
    button.setAttribute("aria-label", editing ? "Finish editing dashboard" : "Edit dashboard");
    if (announce) reportStatus(editing ? "Edit mode enabled." : "View mode enabled.");
  }

  button.addEventListener("click", function () {
    editing = !editing;
    saveJSON(EDIT_MODE_KEY, editing);
    apply(true);
  });

  apply(false);
}
