import { LOCATIONS } from "../config.js";
import { isValidTimeZone, partsFor } from "../utils.js";
import { state } from "../state.js";

function updateGreeting() {
  // Prefer the local card, but fall back to any valid zone so a broken
  // local entry can't blank out the greeting.
  const localLoc = LOCATIONS.find(function (l) { return l.local && isValidTimeZone(l.zone); })
                || LOCATIONS.find(function (l) { return isValidTimeZone(l.zone); });

  const textEl = document.getElementById("greeting-text");
  const subEl  = document.getElementById("greeting-sub");

  if (!localLoc) {
    textEl.textContent = "Hello.";
    subEl.textContent = "No valid location set. Check your LOCATIONS list.";
    return;
  }

  const p = partsFor(localLoc.zone);
  const hour = Number(p.hour);

  let word = "Good evening";
  if (hour < 12)      word = "Good morning";
  else if (hour < 17) word = "Good afternoon";
  else if (hour < 21) word = "Good evening";
  else                word = "Good night";

  let sub = "It's " + p.hour + ":" + p.minute + " in " + localLoc.city
          + ", " + p.weekday + " " + p.day + " " + p.month;

  // Read whatever the weather widget last published. If it hasn't loaded
  // yet this is null, and we simply leave it out. The two widgets never
  // call each other; they meet here, in shared state.
  if (state.currentWeather) {
    sub += ". " + state.currentWeather.temp + "\u00B0 and " + state.currentWeather.cond.toLowerCase();
  }

  textEl.textContent = word + ".";
  subEl.textContent = sub + ".";
}

export function initGreeting() {
  updateGreeting();
  setInterval(updateGreeting, 1000);
}
