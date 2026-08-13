import { loadJSON, saveJSON } from "../storage.js";
import { createId, reportStatus } from "../utils.js";

const GROCERY_KEY = "dashboard.grocery";

export function initGrocery() {
  let items = loadJSON(GROCERY_KEY, []);

  const input = document.getElementById("grocery-input");
  const list  = document.getElementById("grocery-list");

  function save() { saveJSON(GROCERY_KEY, items); }

  function add(text) {
    items.push({ id: createId(), text: text, done: false });
    save(); render();
  }
  function toggle(id) {
    const it = items.find(function (i) { return i.id === id; });
    if (it) it.done = !it.done;
    save(); render();
  }
  function remove(id) {
    items = items.filter(function (i) { return i.id !== id; });
    save(); render();
  }
  // Bulk operation: drop everything already ticked off, in one go.
  function clearChecked() {
    items = items.filter(function (i) { return !i.done; });
    save(); render();
  }

  function render() {
    list.innerHTML = "";
    if (items.length === 0) {
      list.innerHTML = '<li class="grocery-empty">Your list is empty.</li>';
      return;
    }
    items.forEach(function (it) {
      const li = document.createElement("li");
      li.className = "grocery-item" + (it.done ? " done" : "");

      const box = document.createElement("input");
      box.type = "checkbox";
      box.checked = it.done;
      box.setAttribute("aria-label", "Mark " + it.text + " as " + (it.done ? "not purchased" : "purchased"));
      box.addEventListener("change", function () { toggle(it.id); });

      const text = document.createElement("span");
      text.className = "grocery-text";
      text.textContent = it.text;

      const del = document.createElement("button");
      del.className = "grocery-del";
      del.textContent = "\u00D7";
      del.title = "Remove";
      del.setAttribute("aria-label", "Remove grocery item: " + it.text);
      del.addEventListener("click", function () { remove(it.id); });

      li.append(box, text, del);
      list.appendChild(li);
    });
  }

  function submit() {
    const text = input.value.trim();
    if (!text) return reportStatus("Enter a grocery item first.", input);
    add(text); input.value = ""; input.focus();
  }

  input.addEventListener("keydown", function (e) { if (e.key === "Enter") submit(); });
  document.getElementById("grocery-add").addEventListener("click", submit);
  document.getElementById("grocery-clear").addEventListener("click", clearChecked);
  render();
}
