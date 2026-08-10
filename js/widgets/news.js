import { NEWS_FEEDS } from "../config.js";
import { formatRelative } from "../utils.js";

const MAX_ARTICLES = 12;   // how many headlines to show after merging feeds

// Public CORS proxies, tried in order until one works. Free public proxies
// are individually flaky, so a fallback chain makes the widget resilient:
// if the first is down or rate-limited, we quietly try the next. All of
// this disappears in the Electron build, where feeds fetch directly.
const PROXIES = [
  function (u) { return "https://api.codetabs.com/v1/proxy/?quest=" + u; },
  function (u) { return "https://api.allorigins.win/raw?url=" + encodeURIComponent(u); },
  function (u) { return "https://corsproxy.io/?url=" + encodeURIComponent(u); },
];

// Try each proxy in turn; return the first successful response text.
async function fetchViaProxies(feedUrl) {
  let lastError;
  for (const build of PROXIES) {
    try {
      const res = await fetch(build(feedUrl));
      if (!res.ok) throw new Error("status " + res.status);
      const text = await res.text();
      if (text && text.trim()) return text;
      throw new Error("empty response");
    } catch (err) {
      lastError = err;   // this proxy failed; fall through to the next
    }
  }
  throw lastError || new Error("all proxies failed");
}

// Pull the text of the first matching child, trimmed, or "" if absent.
function textOf(node, selector) {
  const el = node.querySelector(selector);
  return el ? el.textContent.trim() : "";
}

// Turn one feed's raw XML into an array of article objects. Handles RSS
// (<item>) and, as a fallback, Atom (<entry>).
function parseFeed(xmlText, sourceName) {
  const doc = new DOMParser().parseFromString(xmlText, "text/xml");
  if (doc.querySelector("parsererror")) throw new Error("Feed XML was malformed");

  let nodes = Array.from(doc.querySelectorAll("item"));   // RSS
  const isAtom = nodes.length === 0;
  if (isAtom) nodes = Array.from(doc.querySelectorAll("entry"));   // Atom fallback

  return nodes.map(function (node) {
    let link, dateStr;
    if (isAtom) {
      const linkEl = node.querySelector("link");
      link = linkEl ? linkEl.getAttribute("href") : "";
      dateStr = textOf(node, "updated") || textOf(node, "published");
    } else {
      link = textOf(node, "link");
      dateStr = textOf(node, "pubDate");
    }
    return {
      title: textOf(node, "title"),
      link: link,
      date: dateStr ? new Date(dateStr).getTime() : 0,
      source: sourceName,
    };
  });
}

async function fetchFeed(feed) {
  const xml = await fetchViaProxies(feed.url);
  return parseFeed(xml, feed.name);
}

export function initNews() {
  const listEl = document.getElementById("news-list");

  async function load() {
    listEl.innerHTML = '<li class="news-loading">Loading news...</li>';

    // Fetch every feed in parallel. allSettled means one failing feed does
    // not sink the others: we keep whatever succeeded.
    const results = await Promise.allSettled(NEWS_FEEDS.map(fetchFeed));

    const articles = [];
    results.forEach(function (r, i) {
      if (r.status === "fulfilled") {
        r.value.forEach(function (a) { if (a.title && a.link) articles.push(a); });
      } else {
        console.error("[news] feed failed:", NEWS_FEEDS[i].name, r.reason);
      }
    });

    if (articles.length === 0) {
      listEl.innerHTML =
        '<li class="news-error">Could not load news right now. The proxies may be down or rate-limited; try again shortly.</li>';
      return;
    }

    articles.sort(function (a, b) { return b.date - a.date; });   // newest first
    render(articles.slice(0, MAX_ARTICLES));
  }

  function render(articles) {
    listEl.innerHTML = "";
    articles.forEach(function (a) {
      const li = document.createElement("li");
      li.className = "news-item";

      const link = document.createElement("a");
      link.className = "news-link";
      link.href = a.link;
      link.target = "_blank";
      link.rel = "noopener noreferrer";   // security: the new tab can't touch this page
      link.textContent = a.title;

      const meta = document.createElement("div");
      meta.className = "news-meta";
      meta.textContent = a.source + (a.date ? "  \u00B7  " + formatRelative(a.date) : "");

      li.append(link, meta);
      listEl.appendChild(li);
    });
  }

  load();
  setInterval(load, 15 * 60 * 1000);   // refresh every 15 minutes
}
