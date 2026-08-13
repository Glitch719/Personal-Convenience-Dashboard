import { loadArray, loadJSON, saveJSON } from "../storage.js";
import { CURRENCY, EXPENSE_CATEGORIES } from "../config.js";
import { state } from "../state.js";
import { createId, reportStatus } from "../utils.js";

const EXPENSES_KEY = "dashboard.expenses";
const BUDGET_KEY = "dashboard.expenseBudget";
const monthFmt = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric" });

export function initExpenses() {
  let entries = loadArray(EXPENSES_KEY);
  let budget = Number(loadJSON(BUDGET_KEY, 0)) || 0;

  const now = new Date();
  let viewYear = now.getFullYear();
  let viewMonth = now.getMonth();   // 0-indexed

  const amountInput = document.getElementById("exp-amount");
  const catSelect   = document.getElementById("exp-category");
  const dateInput   = document.getElementById("exp-date");
  const listEl      = document.getElementById("exp-list");
  const totalEl     = document.getElementById("exp-total");
  const titleEl     = document.getElementById("exp-title");
  const chartEl     = document.getElementById("exp-chart");
  const noteInput   = document.getElementById("exp-note");
  const budgetInput = document.getElementById("exp-budget");
  const budgetStatus = document.getElementById("exp-budget-status");
  const exportBtn = document.getElementById("exp-export");

  function save() { saveJSON(EXPENSES_KEY, entries); }

  // Publish the ACTUAL current month's total for the summary (independent of
  // which month the user is currently browsing in the widget).
  function publishSummary() {
    const t = new Date();
    const prefix = t.getFullYear() + "-" + String(t.getMonth() + 1).padStart(2, "0");
    const total = entries
      .filter(function (e) { return e.date.startsWith(prefix); })
      .reduce(function (sum, e) { return sum + e.amount; }, 0);
    state.expenseTotal = { amount: total, currency: CURRENCY, budget: budget };
  }

  function money(n) { return CURRENCY + n.toFixed(2); }

  function todayStr() {
    const t = new Date();
    return t.getFullYear() + "-" +
      String(t.getMonth() + 1).padStart(2, "0") + "-" +
      String(t.getDate()).padStart(2, "0");
  }

  // "2026-08" for the month currently being viewed.
  function monthPrefix() {
    return viewYear + "-" + String(viewMonth + 1).padStart(2, "0");
  }

  // Entries whose date falls in the viewed month, newest first.
  function entriesThisMonth() {
    const prefix = monthPrefix();
    return entries
      .filter(function (e) { return e.date.startsWith(prefix); })
      .sort(function (a, b) { return b.date.localeCompare(a.date); });
  }

  function addEntry(amount, category, date, note) {
    entries.push({ id: createId(), amount: amount, category: category, date: date, note: note || "" });
    save(); publishSummary(); render();
  }

  function deleteEntry(id) {
    entries = entries.filter(function (e) { return e.id !== id; });
    save(); publishSummary(); render();
  }

  function render() {
    titleEl.textContent = monthFmt.format(new Date(viewYear, viewMonth, 1));

    const monthEntries = entriesThisMonth();

    // reduce: fold the list of entries down to a single running total.
    const total = monthEntries.reduce(function (sum, e) { return sum + e.amount; }, 0);
    totalEl.textContent = money(total);

    if (budget > 0) {
      const left = budget - total;
      budgetStatus.textContent = left >= 0 ? money(left) + " remaining" : money(Math.abs(left)) + " over budget";
      budgetStatus.classList.toggle("over", left < 0);
    } else {
      budgetStatus.textContent = "No budget set";
      budgetStatus.classList.remove("over");
    }
    exportBtn.disabled = monthEntries.length === 0;

    renderChart(monthEntries);
    renderList(monthEntries);
  }

  function renderChart(monthEntries) {
    // Step 1: aggregate. Group entries by category, summing each group.
    const byCat = {};
    monthEntries.forEach(function (e) {
      byCat[e.category] = (byCat[e.category] || 0) + e.amount;
    });

    const cats = Object.keys(byCat).sort(function (a, b) { return byCat[b] - byCat[a]; });

    chartEl.innerHTML = "";
    if (cats.length === 0) {
      chartEl.innerHTML = '<p class="exp-empty">No spending recorded this month.</p>';
      return;
    }

    // Step 2: find the biggest category, so we can scale bars relative to it.
    const max = Math.max.apply(null, cats.map(function (c) { return byCat[c]; }));

    // Step 3: draw a bar per category. The one visual trick: map an amount
    // to a width percentage of the widest category.
    cats.forEach(function (c) {
      const row = document.createElement("div");
      row.className = "exp-bar-row";

      const label = document.createElement("span");
      label.className = "exp-bar-label";
      label.textContent = c;

      const track = document.createElement("div");
      track.className = "exp-bar-track";
      const fill = document.createElement("div");
      fill.className = "exp-bar-fill";
      fill.style.width = (byCat[c] / max * 100) + "%";
      track.appendChild(fill);

      const val = document.createElement("span");
      val.className = "exp-bar-val";
      val.textContent = money(byCat[c]);

      row.append(label, track, val);
      chartEl.appendChild(row);
    });
  }

  function renderList(monthEntries) {
    listEl.innerHTML = "";
    if (monthEntries.length === 0) {
      listEl.innerHTML = '<li class="exp-empty">No entries yet this month.</li>';
      return;
    }
    monthEntries.forEach(function (e) {
      const li = document.createElement("li");
      li.className = "exp-item";

      const left = document.createElement("div");
      left.className = "exp-item-left";
      const cat = document.createElement("span");
      cat.className = "exp-item-cat";
      cat.textContent = e.category;
      if (e.note) {
        const note = document.createElement("span");
        note.className = "exp-item-note";
        note.textContent = e.note;
        cat.appendChild(note);
      }
      const date = document.createElement("span");
      date.className = "exp-item-date";
      date.textContent = e.date;
      left.append(cat, date);

      const amount = document.createElement("span");
      amount.className = "exp-item-amount";
      amount.textContent = money(e.amount);

      const del = document.createElement("button");
      del.className = "exp-del";
      del.textContent = "\u00D7";
      del.title = "Delete";
      del.setAttribute("aria-label", "Delete " + money(e.amount) + " " + e.category + " expense from " + e.date);
      del.addEventListener("click", function () { deleteEntry(e.id); });

      li.append(left, amount, del);
      listEl.appendChild(li);
    });
  }

  function submit() {
    const amount = parseFloat(amountInput.value);   // text input -> number
    const category = catSelect.value;
    const date = dateInput.value || todayStr();
    if (!(amount > 0)) return reportStatus("Enter an expense amount greater than zero.", amountInput);
    addEntry(amount, category, date, noteInput.value.trim());
    amountInput.value = "";
    noteInput.value = "";
    amountInput.focus();
  }

  function shiftMonth(delta) {
    const d = new Date(viewYear, viewMonth + delta, 1);
    viewYear = d.getFullYear();
    viewMonth = d.getMonth();
    render();
  }

  function saveBudget() {
    const value = parseFloat(budgetInput.value);
    if (budgetInput.value && !(value > 0)) {
      return reportStatus("Enter a budget greater than zero, or leave it blank to clear.", budgetInput);
    }
    budget = value > 0 ? value : 0;
    saveJSON(BUDGET_KEY, budget);
    publishSummary();
    render();
  }

  function csvCell(value) {
    return '"' + String(value == null ? "" : value).replace(/"/g, '""') + '"';
  }

  function exportMonth() {
    const rows = [["Date", "Category", "Description", "Amount"]].concat(entriesThisMonth().map(function (entry) {
      return [entry.date, entry.category, entry.note || "", entry.amount.toFixed(2)];
    }));
    const csv = rows.map(function (row) { return row.map(csvCell).join(","); }).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "expenses-" + monthPrefix() + ".csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 0);
  }

  // Fill the category dropdown from config.
  EXPENSE_CATEGORIES.forEach(function (c) {
    const opt = document.createElement("option");
    opt.value = c;
    opt.textContent = c;
    catSelect.appendChild(opt);
  });

  dateInput.value = todayStr();
  budgetInput.value = budget || "";

  document.getElementById("exp-add").addEventListener("click", submit);
  amountInput.addEventListener("keydown", function (e) { if (e.key === "Enter") submit(); });
  document.getElementById("exp-prev").addEventListener("click", function () { shiftMonth(-1); });
  document.getElementById("exp-next").addEventListener("click", function () { shiftMonth(1); });
  document.getElementById("exp-today").addEventListener("click", function () {
    const today = new Date();
    viewYear = today.getFullYear();
    viewMonth = today.getMonth();
    render();
  });
  document.getElementById("exp-budget-save").addEventListener("click", saveBudget);
  exportBtn.addEventListener("click", exportMonth);

  publishSummary();
  render();
}
