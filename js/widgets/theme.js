import { loadJSON, saveJSON } from "../storage.js";

const THEME_KEY = "dashboard.theme";

// Add a theme here and define its variables under [data-theme="id"] in the
// CSS. That is the whole cost of a new theme, thanks to CSS variables.
export const THEMES = [
  { id: "bold",    label: "Midnight" },
  { id: "light",   label: "Daylight" },
  { id: "control", label: "Ember" },
];

export function initTheme() {
  let current = loadJSON(THEME_KEY, "bold");
  if (!THEMES.some(function (theme) { return theme.id === current; })) current = "bold";
  applyTheme(current);

  function applyTheme(id) {
    document.documentElement.setAttribute("data-theme", id);
    current = id;
  }

  const container = document.getElementById("theme-options");
  if (!container) return;

  THEMES.forEach(function (t) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "theme-option" + (t.id === current ? " active" : "");
    btn.setAttribute("aria-pressed", String(t.id === current));
    btn.textContent = t.label;
    btn.addEventListener("click", function () {
      applyTheme(t.id);
      saveJSON(THEME_KEY, t.id);
      container.querySelectorAll(".theme-option").forEach(function (b) {
        b.classList.toggle("active", b === btn);
        b.setAttribute("aria-pressed", String(b === btn));
      });
    });
    container.appendChild(btn);
  });
}
