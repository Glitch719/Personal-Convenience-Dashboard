import { loadJSON, saveJSON } from "../storage.js";
import { createId, reportStatus } from "../utils.js";

const LINKS_KEY = "dashboard.links";

export function initLinks() {
  let links = loadJSON(LINKS_KEY, []);

  const grid       = document.getElementById("links-grid");
  const labelInput = document.getElementById("link-label");
  const urlInput   = document.getElementById("link-url");

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

      chip.append(a, del);
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
    add(label, normalized.href);
    labelInput.value = "";
    urlInput.value = "";
    labelInput.focus();
  }

  document.getElementById("link-add").addEventListener("click", submit);
  labelInput.addEventListener("keydown", function (e) { if (e.key === "Enter") submit(); });
  urlInput.addEventListener("keydown", function (e) { if (e.key === "Enter") submit(); });
  render();
}
