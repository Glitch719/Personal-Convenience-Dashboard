import { loadArray, saveJSON } from "../storage.js";
import { createId, reportStatus } from "../utils.js";

const LINKS_KEY = "dashboard.links";

export function initLinks() {
  let links = loadArray(LINKS_KEY);

  const grid       = document.getElementById("links-grid");
  const labelInput = document.getElementById("link-label");
  const urlInput   = document.getElementById("link-url");
  const addBtn     = document.getElementById("link-add");
  const cancelBtn  = document.getElementById("link-cancel");
  let editingId = null;

  function save() { saveJSON(LINKS_KEY, links); }

  // If the user types "example.com" without a scheme, add https:// so the
  // link actually works. The regex tests whether a scheme is already there.
  function normalizeUrl(u) {
    return /^https?:\/\//i.test(u) ? u : "https://" + u;
  }

  function add(label, url) {
    links.push({ id: createId(), label: label, url: url });
    save(); render();
  }
  function remove(id) {
    links = links.filter(function (l) { return l.id !== id; });
    save(); render();
  }

  function edit(link) {
    editingId = link.id;
    labelInput.value = link.label;
    urlInput.value = link.url;
    addBtn.textContent = "Save";
    cancelBtn.hidden = false;
    labelInput.focus();
  }

  function cancelEdit() {
    editingId = null;
    labelInput.value = "";
    urlInput.value = "";
    addBtn.textContent = "Add";
    cancelBtn.hidden = true;
  }

  function render() {
    grid.innerHTML = "";
    if (links.length === 0) {
      grid.innerHTML = '<p class="links-empty">No links yet. Add one below.</p>';
      return;
    }
    links.forEach(function (l) {
      const chip = document.createElement("div");
      chip.className = "link-chip";

      const a = document.createElement("a");
      a.className = "link-anchor";
      a.href = l.url;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.textContent = l.label;

      const del = document.createElement("button");
      del.className = "link-del";
      del.textContent = "\u00D7";
      del.title = "Remove";
      del.setAttribute("aria-label", "Remove link: " + l.label);
      del.addEventListener("click", function () { remove(l.id); });

      const editBtn = document.createElement("button");
      editBtn.className = "link-edit";
      editBtn.textContent = "Edit";
      editBtn.setAttribute("aria-label", "Edit link: " + l.label);
      editBtn.addEventListener("click", function () { edit(l); });

      chip.append(a, editBtn, del);
      grid.appendChild(chip);
    });
  }

  function submit() {
    const label = labelInput.value.trim();
    const url = urlInput.value.trim();
    if (!label) return reportStatus("Enter a label for the link.", labelInput);
    if (!url) return reportStatus("Enter a URL for the link.", urlInput);
    let normalized;
    try {
      normalized = new URL(normalizeUrl(url));
      if (!/^https?:$/.test(normalized.protocol)) throw new Error("unsupported protocol");
    } catch (err) {
      return reportStatus("Enter a valid web address.", urlInput);
    }
    const duplicate = links.find(function (link) { return link.url === normalized.href && link.id !== editingId; });
    if (duplicate) return reportStatus("That web address is already in your quick links.", urlInput);
    if (editingId) {
      const link = links.find(function (item) { return item.id === editingId; });
      if (link) {
        link.label = label;
        link.url = normalized.href;
        save();
        render();
      }
    } else {
      add(label, normalized.href);
    }
    cancelEdit();
    labelInput.focus();
  }

  addBtn.addEventListener("click", submit);
  cancelBtn.addEventListener("click", cancelEdit);
  labelInput.addEventListener("keydown", function (e) { if (e.key === "Enter") submit(); });
  urlInput.addEventListener("keydown", function (e) { if (e.key === "Enter") submit(); });
  render();
}
