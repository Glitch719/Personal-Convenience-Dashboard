import { loadJSON, saveJSON } from "../storage.js";
import { state } from "../state.js";
import { reportStatus } from "../utils.js";

const FOCUS_KEY = "dashboard.focusTimer";

export function remainingSecondsUntil(endsAt, now) {
  const current = Number.isFinite(now) ? now : Date.now();
  return Math.max(0, Math.ceil((endsAt - current) / 1000));
}

export function elapsedSecondsSince(startedAt, accumulated, now) {
  const current = Number.isFinite(now) ? now : Date.now();
  return Math.max(0, Math.floor((Number(accumulated) || 0) + (current - startedAt) / 1000));
}

export function initFocus() {
  const display = document.getElementById("focus-time");
  const label = document.getElementById("focus-label");
  const startBtn = document.getElementById("focus-start");
  const resetBtn = document.getElementById("focus-reset");
  const presets = document.querySelectorAll("[data-focus-min]");
  const modeButtons = document.querySelectorAll("[data-focus-mode]");
  const countdownSetup = document.getElementById("focus-countdown-setup");
  const customInput = document.getElementById("focus-custom-min");
  const customApply = document.getElementById("focus-custom-apply");
  const soundInput = document.getElementById("focus-sound");
  const dial = document.getElementById("focus-dial");

  const stored = loadJSON(FOCUS_KEY, {});
  const saved = stored && typeof stored === "object" ? stored : {};
  let mode = saved.mode === "stopwatch" ? "stopwatch" : "countdown";
  let durationSec = Number.isFinite(saved.durationSec) && saved.durationSec > 0 ? saved.durationSec : 25 * 60;
  let remaining = Number.isFinite(saved.remaining) && saved.remaining >= 0 ? Math.min(saved.remaining, durationSec) : durationSec;
  let elapsed = Number.isFinite(saved.elapsed) && saved.elapsed >= 0 ? saved.elapsed : 0;
  let running = saved.running === true;
  let endsAt = Number.isFinite(saved.endsAt) ? saved.endsAt : null;
  let startedAt = Number.isFinite(saved.startedAt) ? saved.startedAt : null;
  let soundEnabled = saved.soundEnabled !== false;
  let ticker = null;

  function format(totalSec) {
    const hours = Math.floor(totalSec / 3600);
    const minutes = Math.floor(totalSec % 3600 / 60);
    const seconds = totalSec % 60;
    return hours > 0
      ? String(hours).padStart(2, "0") + ":" + String(minutes).padStart(2, "0") + ":" + String(seconds).padStart(2, "0")
      : String(minutes).padStart(2, "0") + ":" + String(seconds).padStart(2, "0");
  }

  function currentSeconds() { return mode === "countdown" ? remaining : elapsed; }

  function publish() {
    state.focusSession = {
      mode: mode, running: running, seconds: currentSeconds(), durationSec: durationSec,
      label: mode === "countdown" ? "Focus timer" : "Stopwatch",
    };
    window.dispatchEvent(new CustomEvent("dashboard:focus-changed"));
  }

  function persist() {
    saveJSON(FOCUS_KEY, {
      mode: mode, durationSec: durationSec, remaining: remaining, elapsed: elapsed,
      running: running, endsAt: mode === "countdown" && running ? endsAt : null,
      startedAt: mode === "stopwatch" && running ? startedAt : null, soundEnabled: soundEnabled,
    });
    publish();
  }

  function updateDisplay() {
    display.textContent = format(currentSeconds());
    const progress = mode === "countdown" && durationSec > 0 ? remaining / durationSec : (elapsed % 60) / 60;
    dial.style.setProperty("--focus-progress", (Math.max(0, Math.min(1, progress)) * 360) + "deg");
    label.textContent = mode === "countdown" ? "Deep work" : (running ? "Timing" : "Stopwatch");
    countdownSetup.hidden = mode !== "countdown";
    modeButtons.forEach(function (button) {
      button.setAttribute("aria-pressed", String(button.dataset.focusMode === mode));
    });
    soundInput.checked = soundEnabled;
    publish();
  }

  function playCue() {
    if (!soundEnabled) return;
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;
      const context = new AudioContextClass();
      [0, 0.18].forEach(function (delay, index) {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.frequency.value = index ? 880 : 660;
        gain.gain.setValueAtTime(0.0001, context.currentTime + delay);
        gain.gain.exponentialRampToValueAtTime(0.16, context.currentTime + delay + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + delay + 0.16);
        oscillator.connect(gain); gain.connect(context.destination);
        oscillator.start(context.currentTime + delay); oscillator.stop(context.currentTime + delay + 0.18);
      });
      setTimeout(function () { context.close(); }, 700);
    } catch (error) {}
  }

  function tick() {
    if (!running) return;
    if (mode === "countdown") {
      remaining = remainingSecondsUntil(endsAt);
      if (remaining <= 0) return finish(true);
    } else {
      elapsed = elapsedSecondsSince(startedAt, elapsed, Date.now());
      startedAt = Date.now();
    }
    updateDisplay();
  }

  function start(requestPermission, restoredTimestamp) {
    if (running && ticker) return;
    display.classList.remove("done");
    running = true;
    if (mode === "countdown") {
      if (remaining <= 0) remaining = durationSec;
      endsAt = restoredTimestamp || Date.now() + remaining * 1000;
    } else {
      startedAt = restoredTimestamp || Date.now();
    }
    startBtn.textContent = "Pause";
    startBtn.setAttribute("aria-pressed", "true");
    if (requestPermission && "Notification" in window && Notification.permission === "default") Notification.requestPermission();
    clearInterval(ticker); ticker = setInterval(tick, 1000);
    persist(); updateDisplay();
  }

  function pause() {
    if (running) {
      if (mode === "countdown" && endsAt) remaining = remainingSecondsUntil(endsAt);
      if (mode === "stopwatch" && startedAt) elapsed = elapsedSecondsSince(startedAt, elapsed, Date.now());
    }
    running = false; endsAt = null; startedAt = null;
    clearInterval(ticker); ticker = null;
    startBtn.textContent = "Start"; startBtn.setAttribute("aria-pressed", "false");
    persist(); updateDisplay();
  }

  function reset() {
    pause();
    remaining = durationSec; elapsed = 0;
    display.classList.remove("done");
    persist(); updateDisplay();
  }

  function finish(shouldNotify) {
    running = false; endsAt = null; clearInterval(ticker); ticker = null;
    remaining = 0; startBtn.textContent = "Start"; startBtn.setAttribute("aria-pressed", "false");
    display.classList.add("done"); persist(); updateDisplay();
    if (shouldNotify) {
      playCue();
      reportStatus("Focus session complete.");
      if ("Notification" in window && Notification.permission === "granted") new Notification("Focus session complete", { body: "Time for a break." });
    }
  }

  function setDuration(minutes) {
    durationSec = minutes * 60; mode = "countdown"; customInput.value = String(minutes); reset();
    presets.forEach(function (button) {
      const selected = Number(button.dataset.focusMin) === minutes;
      button.classList.toggle("active", selected); button.setAttribute("aria-pressed", String(selected));
    });
  }

  function setMode(next) {
    if (next === mode) return;
    pause(); mode = next; reset(); reportStatus(next === "countdown" ? "Countdown mode selected." : "Stopwatch mode selected.");
  }

  startBtn.addEventListener("click", function () { if (running) pause(); else start(true); });
  resetBtn.addEventListener("click", reset);
  presets.forEach(function (button) { button.addEventListener("click", function () { setDuration(Number(button.dataset.focusMin)); }); });
  modeButtons.forEach(function (button) { button.addEventListener("click", function () { setMode(button.dataset.focusMode); }); });
  customApply.addEventListener("click", function () {
    const minutes = Number(customInput.value);
    if (!Number.isInteger(minutes) || minutes < 1 || minutes > 240) return reportStatus("Choose a custom timer from 1 to 240 minutes.", customInput);
    setDuration(minutes); reportStatus(minutes + " minute countdown set.");
  });
  soundInput.addEventListener("change", function () { soundEnabled = soundInput.checked; persist(); });

  presets.forEach(function (button) {
    const selected = Number(button.dataset.focusMin) * 60 === durationSec;
    button.classList.toggle("active", selected); button.setAttribute("aria-pressed", String(selected));
  });
  soundInput.checked = soundEnabled;
  customInput.value = String(Math.round(durationSec / 60));

  if (running) {
    if (mode === "countdown" && endsAt) {
      remaining = remainingSecondsUntil(endsAt);
      if (remaining > 0) start(false, endsAt); else finish(false);
    } else if (mode === "stopwatch" && startedAt) {
      elapsed = elapsedSecondsSince(startedAt, elapsed, Date.now());
      start(false, Date.now());
    } else {
      running = false; persist();
    }
  } else {
    startBtn.setAttribute("aria-pressed", "false");
    if (mode === "countdown" && remaining === 0) display.classList.add("done");
    persist();
  }

  document.addEventListener("visibilitychange", function () { if (running && !document.hidden) tick(); });
  updateDisplay();
}
