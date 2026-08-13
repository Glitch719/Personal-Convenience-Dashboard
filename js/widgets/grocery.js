import { loadArray, saveJSON } from "../storage.js";
import { createId, offerUndo, reportStatus, restoreRemovedItems } from "../utils.js";

const GROCERY_KEY = "dashboard.grocery";

export function initGrocery() {
  let items = loadArray(GROCERY_KEY);

  const input = document.getElementById("grocery-input");
  const list  = document.getElementById("grocery-list");
  const count = document.getElementById("grocery-count");
  const clearBtn = document.getElementById("grocery-clear");

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
    const index = items.findIndex(function (item) { return item.id === id; });
    if (index === -1) return;
    const removed = [{ index: index, item: items[index] }];
    items.splice(index, 1);
    save(); render();
    offerUndo("Grocery item removed.", function () {
      items = restoreRemovedItems(items, removed);
      save(); render();
    }, "Grocery item restored.");
  }
  // Bulk operation: drop everything already ticked off, in one go.
  function clearChecked() {
    const removed = items.map(function (item, index) { return { index: index, item: item }; })
      .filter(function (entry) { return entry.item.done; });
    if (removed.length === 0) return;
    items = items.filter(function (i) { return !i.done; });
    save(); render();
    offerUndo(removed.length + " checked item" + (removed.length === 1 ? "" : "s") + " cleared.", function () {
      items = restoreRemovedItems(items, removed);
      save(); render();
    }, "Checked items restored.");
  }

  function render() {
    list.innerHTML = "";
    const remaining = items.filter(function (item) { return !item.done; }).length;
    count.textContent = items.length ? remaining + " to get · " + items.length + " total" : "";
    clearBtn.disabled = !items.some(function (item) { return item.done; });
    if (items.length === 0) {
      list.innerHTML = '<li class="grocery-empty">Your list is empty.</li>';
      return;
    }
    items.slice().sort(function (a, b) { return Number(a.done) - Number(b.done); }).forEach(function (it) {
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
    const existing = items.find(function (item) { return item.text.toLowerCase() === text.toLowerCase(); });
    if (existing) {
      if (existing.done) {
        existing.done = false;
        save();
        render();
      }
      return reportStatus("That item is already on your grocery list.", input);
    }
    add(text); input.value = ""; input.focus();
  }

  input.addEventListener("keydown", function (e) { if (e.key === "Enter") submit(); });
  document.getElementById("grocery-add").addEventListener("click", submit);
  clearBtn.addEventListener("click", clearChecked);
  render();
}
