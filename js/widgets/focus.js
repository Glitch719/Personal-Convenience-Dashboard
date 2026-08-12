// A focus timer. The interesting part is the small STATE MACHINE: at any
// moment the timer is either running or paused, and start / pause / reset
// move it between those states. Guarding those transitions (e.g. not
// starting a second interval while one is already running) is the whole job.

export function initFocus() {
  const display   = document.getElementById("focus-time");
  const startBtn  = document.getElementById("focus-start");
  const resetBtn  = document.getElementById("focus-reset");
  const presets   = document.querySelectorAll("[data-focus-min]");

  let durationSec = 25 * 60;   // the currently selected length
  let remaining   = durationSec;
  let running     = false;
  let ticker      = null;      // the setInterval handle, or null when paused

  function format(totalSec) {
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0");
  }

  function updateDisplay() {
    display.textContent = format(remaining);
  }

  function start() {
    if (running) return;                       // guard: never start twice
    if (remaining <= 0) remaining = durationSec;
    display.classList.remove("done");
    running = true;
    startBtn.textContent = "Pause";

    // Ask for notification permission the first time, like reminders do.
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }

    ticker = setInterval(function () {
      remaining--;
      updateDisplay();
      if (remaining <= 0) finish();
    }, 1000);
  }

  function pause() {
    running = false;
    startBtn.textContent = "Start";
    clearInterval(ticker);   // stop the countdown
    ticker = null;
  }

  function reset() {
    pause();
    remaining = durationSec;
    display.classList.remove("done");
    updateDisplay();
  }

  function finish() {
    pause();
    remaining = 0;
    updateDisplay();
    display.classList.add("done");
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification("Focus session complete", { body: "Time for a break." });
    }
  }

  function setDuration(min) {
    durationSec = min * 60;
    reset();
    presets.forEach(function (b) {
      b.classList.toggle("active", Number(b.getAttribute("data-focus-min")) === min);
    });
  }

  // Start and Pause share one button that toggles based on current state.
  startBtn.addEventListener("click", function () {
    if (running) pause(); else start();
  });
  resetBtn.addEventListener("click", reset);
  presets.forEach(function (b) {
    b.addEventListener("click", function () {
      setDuration(Number(b.getAttribute("data-focus-min")));
    });
  });

  updateDisplay();
}
