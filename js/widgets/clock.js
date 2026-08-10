import { LOCATIONS } from "../config.js";
import { isValidTimeZone, partsFor } from "../utils.js";

export function initClock() {
  const grid = document.getElementById("clock-grid");

  // Build one card per location, validating each zone as we go so a bad
  // entry is quarantined to its own card.
  const cards = LOCATIONS.map(function (loc) {
    const card = document.createElement("div");
    card.className = "clock-card" + (loc.local ? " local" : "");
    card.innerHTML =
      '<div class="daynight-strip"></div>' +
      '<div class="city">' + loc.city + '</div>' +
      '<div class="time">--:--:--</div>' +
      '<div class="meta"><span class="dot"></span><span class="label"></span></div>';
    grid.appendChild(card);

    const handle = {
      loc: loc,
      valid: isValidTimeZone(loc.zone),
      timeEl:  card.querySelector(".time"),
      labelEl: card.querySelector(".label"),
      dotEl:   card.querySelector(".dot"),
      stripEl: card.querySelector(".daynight-strip"),
      cardEl:  card,
    };

    if (!handle.valid) {
      card.classList.add("broken");
      handle.timeEl.textContent = "--:--";
      handle.labelEl.textContent = "Unknown timezone: " + loc.zone;
      console.warn("[clock] skipping invalid zone:", loc.zone);
    }

    return handle;
  });

  function tick() {
    cards.forEach(function (c) {
      if (!c.valid) return;
      try {
        const p = partsFor(c.loc.zone);
        const hour = Number(p.hour);
        const phase = (hour >= 6 && hour < 18) ? "day" : "night";

        c.timeEl.textContent  = p.hour + ":" + p.minute + ":" + p.second;
        c.labelEl.textContent = p.weekday + ", " + p.day + " " + p.month;
        c.dotEl.className   = "dot " + phase;
        c.stripEl.className = "daynight-strip " + phase;
      } catch (err) {
        c.valid = false;
        c.cardEl.classList.add("broken");
        c.labelEl.textContent = "Clock error";
        console.error("[clock:" + c.loc.city + "]", err);
      }
    });
  }

  tick();
  setInterval(tick, 1000);
}
