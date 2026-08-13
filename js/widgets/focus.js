// A focus timer. The interesting part is the small STATE MACHINE: at any
// moment the timer is either running or paused, and start / pause / reset
// move it between those states. Guarding those transitions (e.g. not
// starting a second interval while one is already running) is the whole job.

import { loadJSON, saveJSON } from "../storage.js";

const FOCUS_KEY = "dashboard.focusTimer";

export function remainingSecondsUntil(endsAt, now) {
  const current = Number.isFinite(now) ? now : Date.now();
  return Math.max(0, Math.ceil((endsAt - current) / 1000));
}

export function initFocus() {
  const display   = document.getElementById("focus-time");
  const startBtn  = document.getElementById("focus-start");
  const resetBtn  = document.getElementById("focus-reset");
  const presets   = document.querySelectorAll("[data-focus-min]");
  const dial      = document.getElementById("focus-dial");

  const stored = loadJSON(FOCUS_KEY, {});
  const saved = stored && typeof stored === "object" ? stored : {};
  let durationSec = Number.isFinite(saved.durationSec) && saved.durationSec > 0
    ? saved.durationSec
    : 25 * 60;
  let remaining = Number.isFinite(saved.remaining) && saved.remaining >= 0
    ? Math.min(saved.remaining, durationSec)
    : durationSec;
  let running = false;
  let ticker      = null;      // the setInterval handle, or null when paused
  let endsAt = Number.isFinite(saved.endsAt) ? saved.endsAt : null;

  function persist() {
    saveJSON(FOCUS_KEY, {
      durationSec: durationSec,
      remaining: remaining,
      running: running,
      endsAt: running ? endsAt : null,
    });
  }

  function format(totalSec) {
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0");
  }

  function updateDisplay() {
    display.textContent = format(remaining);
    const progress = durationSec > 0 ? Math.max(0, Math.min(1, remaining / durationSec)) : 0;
    dial.style.setProperty("--focus-progress", (progress * 360) + "deg");
  }

  function start(requestPermission, restoredEnd) {
    if (running) return;                       // guard: never start twice
    if (remaining <= 0) remaining = durationSec;
    display.classList.remove("done");
    running = true;
    endsAt = restoredEnd || Date.now() + remaining * 1000;
    startBtn.textContent = "Pause";
    startBtn.setAttribute("aria-pressed", "true");
    persist();

    // Ask for notification permission the first time, like reminders do.
    if (requestPermission && "Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }

    ticker = setInterval(function () {
      remaining = remainingSecondsUntil(endsAt);
      updateDisplay();
      if (remaining <= 0) finish(true);
    }, 1000);
  }

  function pause() {
    if (running && endsAt) {
      remaining = remainingSecondsUntil(endsAt);
    }
    running = false;
    endsAt = null;
    startBtn.textContent = "Start";
    startBtn.setAttribute("aria-pressed", "false");
    clearInterval(ticker);   // stop the countdown
    ticker = null;
    persist();
  }

  function reset() {
    pause();
    remaining = durationSec;
    display.classList.remove("done");
    updateDisplay();
    persist();
  }

  function finish(shouldNotify) {
    pause();
    remaining = 0;
    updateDisplay();
    display.classList.add("done");
    persist();
    if (shouldNotify && "Notification" in window && Notification.permission === "granted") {
      new Notification("Focus session complete", { body: "Time for a break." });
    }
  }

  function setDuration(min) {
    durationSec = min * 60;
    reset();
    presets.forEach(function (b) {
      b.classList.toggle("active", Number(b.getAttribute("data-focus-min")) === min);
      b.setAttribute("aria-pressed", String(Number(b.getAttribute("data-focus-min")) === min));
    });
    persist();
  }

  // Start and Pause share one button that toggles based on current state.
  startBtn.addEventListener("click", function () {
    if (running) pause(); else start(true);
  });
  resetBtn.addEventListener("click", reset);
  presets.forEach(function (b) {
    b.addEventListener("click", function () {
      setDuration(Number(b.getAttribute("data-focus-min")));
    });
  });

  presets.forEach(function (b) {
    const selected = Number(b.getAttribute("data-focus-min")) * 60 === durationSec;
    b.classList.toggle("active", selected);
    b.setAttribute("aria-pressed", String(selected));
  });

  // A running session is restored from its absolute end time. If it elapsed
  // while the page was closed, show the completed state without surprising
  // the user with a notification immediately on page load.
  if (saved.running && endsAt) {
    remaining = remainingSecondsUntil(endsAt);
    if (remaining > 0) start(false, endsAt); else finish(false);
  } else {
    startBtn.setAttribute("aria-pressed", "false");
    if (remaining === 0) display.classList.add("done");
    persist();
  }

  document.addEventListener("visibilitychange", function () {
    if (running && !document.hidden) {
      remaining = remainingSecondsUntil(endsAt);
      if (remaining === 0) finish(true); else updateDisplay();
    }
  });
  updateDisplay();
}
