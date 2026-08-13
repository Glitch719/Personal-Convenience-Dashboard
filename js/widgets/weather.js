import { WEATHER_LOCATION, WEATHER_CODES } from "../config.js";
import { state } from "../state.js";
import { loadJSON, saveJSON } from "../storage.js";
import { formatRelative } from "../utils.js";

const WEATHER_CACHE_KEY = "dashboard.weatherCache";

async function loadWeather() {
  const { latitude, longitude, city } = WEATHER_LOCATION;

  const url = "https://api.open-meteo.com/v1/forecast"
    + "?latitude=" + latitude
    + "&longitude=" + longitude
    + "&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m"
    + "&timezone=auto";

  const statsEl = document.getElementById("weather-stats");
  const refreshBtn = document.getElementById("weather-refresh");
  const updatedEl = document.getElementById("weather-updated");
  if (refreshBtn.disabled) return;
  refreshBtn.disabled = true;
  refreshBtn.textContent = "Refreshing...";

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error("Weather request failed: " + res.status);

    const data = await res.json();
    const c = data.current;
    const values = [c.temperature_2m, c.apparent_temperature, c.relative_humidity_2m, c.wind_speed_10m]
      .map(Number);
    if (values.some(function (value) { return !Number.isFinite(value); })) {
      throw new Error("Weather response did not contain valid current conditions");
    }

    const weather = {
      city: city,
      temp: Math.round(values[0]),
      feels: Math.round(values[1]),
      humidity: Math.round(values[2]),
      wind: Math.round(values[3]),
      cond: WEATHER_CODES[c.weather_code] || "Unknown",
    };

    // Publish to shared state. The greeting will pick this up on its own,
    // so we don't need to call the greeting from here.
    state.currentWeather = weather;
    renderWeather(weather, statsEl);
    const fetchedAt = Date.now();
    saveJSON(WEATHER_CACHE_KEY, { weather: weather, fetchedAt: fetchedAt });
    updatedEl.textContent = "Updated " + formatRelative(fetchedAt);
  } catch (err) {
    const cached = loadJSON(WEATHER_CACHE_KEY, null);
    if (cached && cached.weather) {
      state.currentWeather = cached.weather;
      renderWeather(cached.weather, statsEl);
      updatedEl.textContent = "Offline \u00B7 saved " + formatRelative(cached.fetchedAt);
    } else {
      document.getElementById("weather-cond").textContent = "Unavailable";
      document.getElementById("weather-temp").textContent = "--\u00B0";
      statsEl.innerHTML = '<span class="weather-error">Could not load weather.</span>';
      updatedEl.textContent = "Check your connection and try again";
    }
    console.error("[weather]", err);
  } finally {
    refreshBtn.disabled = false;
    refreshBtn.textContent = "Refresh";
  }
}

function renderWeather(w, statsEl) {
  document.getElementById("weather-city").textContent = w.city;
  document.getElementById("weather-temp").textContent = w.temp + "\u00B0";
  document.getElementById("weather-cond").textContent = w.cond;

  const stats = [
    { key: "Feels like", val: w.feels + "\u00B0" },
    { key: "Humidity",   val: w.humidity + "%" },
    { key: "Wind",       val: w.wind + " km/h" },
  ];
  statsEl.innerHTML = stats.map(function (s) {
    return '<div class="stat"><div class="val">' + s.val + '</div>'
         + '<div class="key">' + s.key + '</div></div>';
  }).join("");
}

export function initWeather() {
  const cached = loadJSON(WEATHER_CACHE_KEY, null);
  if (cached && cached.weather) {
    state.currentWeather = cached.weather;
    renderWeather(cached.weather, document.getElementById("weather-stats"));
    document.getElementById("weather-updated").textContent = "Saved " + formatRelative(cached.fetchedAt);
  } else {
    document.getElementById("weather-stats").innerHTML =
      '<div class="skeleton" style="width:170px;height:40px;border-radius:8px"></div>';
  }
  document.getElementById("weather-refresh").addEventListener("click", loadWeather);
  loadWeather();
  setInterval(loadWeather, 10 * 60 * 1000);   // refresh every 10 minutes
}
