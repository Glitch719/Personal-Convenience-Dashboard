/* ============================================================
   CONFIG  -  the parts you edit to make the dashboard yours
   ============================================================ */

const LOCATIONS = [
  { city: "Chennai",           zone: "Asia/Kolkata", local: true },
  { city: "Frankfurt am Main", zone: "Europe/Berlin" },
  { city: "London",            zone: "Europe/London" },
  { city: "Bishkek",           zone: "Asia/Bishkek" },
];

const WEATHER_LOCATION = { city: "Chennai", latitude: 12.9326, longitude: 80.1313 };

const WEATHER_CODES = {
  0: "Clear sky",        1: "Mainly clear",   2: "Partly cloudy",  3: "Overcast",
  45: "Fog",             48: "Rime fog",
  51: "Light drizzle",   53: "Drizzle",       55: "Heavy drizzle",
  61: "Light rain",      63: "Rain",          65: "Heavy rain",
  66: "Freezing rain",   67: "Freezing rain",
  71: "Light snow",      73: "Snow",          75: "Heavy snow",     77: "Snow grains",
  80: "Rain showers",    81: "Rain showers",  82: "Violent showers",
  85: "Snow showers",    86: "Snow showers",
  95: "Thunderstorm",    96: "Thunderstorm",  99: "Thunderstorm",
};

let currentWeather = null;


/* ============================================================
   HELPERS  -  small tools for failing safely
   ============================================================ */

// Run a chunk of setup without letting its failure touch anything else.
// If it throws, we log it and carry on instead of crashing the page.
function runSafely(label, fn) {
  try {
    fn();
  } catch (err) {
    console.error("[" + label + "] failed to start:", err);
  }
}

// Is this a real IANA timezone? Ask Intl once, safely, at the boundary.
function isValidTimeZone(zone) {
  try {
    new Intl.DateTimeFormat("en-GB", { timeZone: zone });
    return true;
  } catch (err) {
    return false;
  }
}


/* ============================================================
   CLOCK WIDGET
   ============================================================ */

const grid = document.getElementById("clock-grid");

// Build one card per location. We validate the zone right here, as the
// card is created, so a bad entry is quarantined to its own card.
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

  // If this one is broken, mark it clearly and it will simply be skipped
  // by the ticking loop. The other clocks never touch its bad zone.
  if (!handle.valid) {
    card.classList.add("broken");
    handle.timeEl.textContent = "--:--";
    handle.labelEl.textContent = "Unknown timezone: " + loc.zone;
    console.warn("[clock] skipping invalid zone:", loc.zone);
  }

  return handle;
});

function partsFor(zone) {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: zone,
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
    weekday: "short", day: "numeric", month: "short",
  });
  const p = {};
  fmt.formatToParts(new Date()).forEach(function (part) { p[part.type] = part.value; });
  return p;
}

function tick() {
  cards.forEach(function (c) {
    if (!c.valid) return;   // skip quarantined cards
    try {
      const p = partsFor(c.loc.zone);
      const hour = Number(p.hour);
      const state = (hour >= 6 && hour < 18) ? "day" : "night";

      c.timeEl.textContent  = p.hour + ":" + p.minute + ":" + p.second;
      c.labelEl.textContent = p.weekday + ", " + p.day + " " + p.month;
      c.dotEl.className   = "dot " + state;
      c.stripEl.className = "daynight-strip " + state;
    } catch (err) {
      // Belt and suspenders: if a card somehow fails at runtime, retire
      // just that card rather than stopping the whole loop.
      c.valid = false;
      c.cardEl.classList.add("broken");
      c.labelEl.textContent = "Clock error";
      console.error("[clock:" + c.loc.city + "]", err);
    }
  });
}

function updateGreeting() {
  // Prefer the local card, but fall back to any valid one so a broken
  // local zone can't blank out the greeting.
  const localLoc = LOCATIONS.find(function (l) { return l.local && isValidTimeZone(l.zone); })
                || LOCATIONS.find(function (l) { return isValidTimeZone(l.zone); });

  if (!localLoc) {
    document.getElementById("greeting-text").textContent = "Hello.";
    document.getElementById("greeting-sub").textContent = "No valid location set. Check your LOCATIONS list.";
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

  if (currentWeather) {
    sub += ". " + currentWeather.temp + "\u00B0 and " + currentWeather.cond.toLowerCase();
  }

  document.getElementById("greeting-text").textContent = word + ".";
  document.getElementById("greeting-sub").textContent = sub + ".";
}


/* ============================================================
   WEATHER WIDGET
   ============================================================ */

const weatherStatsEl = document.getElementById("weather-stats");

async function loadWeather() {
  const { latitude, longitude, city } = WEATHER_LOCATION;

  const url = "https://api.open-meteo.com/v1/forecast"
    + "?latitude=" + latitude
    + "&longitude=" + longitude
    + "&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m"
    + "&timezone=auto";

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error("Weather request failed: " + res.status);

    const data = await res.json();
    const c = data.current;

    currentWeather = {
      city: city,
      temp: Math.round(c.temperature_2m),
      feels: Math.round(c.apparent_temperature),
      humidity: c.relative_humidity_2m,
      wind: Math.round(c.wind_speed_10m),
      cond: WEATHER_CODES[c.weather_code] || "Unknown",
    };

    renderWeather(currentWeather);
    runSafely("greeting-refresh", updateGreeting);
  } catch (err) {
    document.getElementById("weather-cond").textContent = "";
    document.getElementById("weather-temp").textContent = "";
    weatherStatsEl.innerHTML =
      '<span class="weather-error">Could not load weather. Check your connection and refresh.</span>';
    console.error("[weather]", err);
  }
}

function renderWeather(w) {
  document.getElementById("weather-city").textContent = w.city;
  document.getElementById("weather-temp").textContent = w.temp + "\u00B0";
  document.getElementById("weather-cond").textContent = w.cond;

  const stats = [
    { key: "Feels like", val: w.feels + "\u00B0" },
    { key: "Humidity",   val: w.humidity + "%" },
    { key: "Wind",       val: w.wind + " km/h" },
  ];
  weatherStatsEl.innerHTML = stats.map(function (s) {
    return '<div class="stat"><div class="val">' + s.val + '</div>'
         + '<div class="key">' + s.key + '</div></div>';
  }).join("");
}


/* ============================================================
   START  -  each widget starts inside its own safety net
   ============================================================ */

runSafely("clock", function () {
  tick();
  updateGreeting();
  setInterval(function () { tick(); updateGreeting(); }, 1000);
});

runSafely("weather", function () {
  loadWeather();
  setInterval(loadWeather, 10 * 60 * 1000);
});
