import { loadJSON, saveJSON } from "../storage.js";

const THEME_KEY = "dashboard.theme";

// Add a theme here and define its variables under [data-theme="id"] in the
// CSS. That is the whole cost of a new theme, thanks to CSS variables.
export const THEMES = [
  { id: "bold",    label: "Bold" },
  { id: "light",   label: "Light" },
  { id: "control", label: "Control panel" },
];

export function initTheme() {
  let current = loadJSON(THEME_KEY, "bold");
  applyTheme(current);

  function applyTheme(id) {
    document.documentElement.setAttribute("data-theme", id);
    current = id;
  }

  const container = document.getElementById("theme-options");
  if (!container) return;

  THEMES.forEach(function (t) {
    const btn = document.createElement("button");
    btn.className = "theme-option" + (t.id === current ? " active" : "");
    btn.textContent = t.label;
    btn.addEventListener("click", function () {
      applyTheme(t.id);
      saveJSON(THEME_KEY, t.id);
      container.querySelectorAll(".theme-option").forEach(function (b) {
        b.classList.toggle("active", b === btn);
      });
    });
    container.appendChild(btn);
  });
}
