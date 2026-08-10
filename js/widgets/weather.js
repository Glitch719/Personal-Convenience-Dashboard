import { WEATHER_LOCATION, WEATHER_CODES } from "../config.js";
import { state } from "../state.js";

async function loadWeather() {
  const { latitude, longitude, city } = WEATHER_LOCATION;

  const url = "https://api.open-meteo.com/v1/forecast"
    + "?latitude=" + latitude
    + "&longitude=" + longitude
    + "&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m"
    + "&timezone=auto";

  const statsEl = document.getElementById("weather-stats");

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error("Weather request failed: " + res.status);

    const data = await res.json();
    const c = data.current;

    const weather = {
      city: city,
      temp: Math.round(c.temperature_2m),
      feels: Math.round(c.apparent_temperature),
      humidity: c.relative_humidity_2m,
      wind: Math.round(c.wind_speed_10m),
      cond: WEATHER_CODES[c.weather_code] || "Unknown",
    };

    // Publish to shared state. The greeting will pick this up on its own,
    // so we don't need to call the greeting from here.
    state.currentWeather = weather;
    renderWeather(weather, statsEl);
  } catch (err) {
    document.getElementById("weather-cond").textContent = "";
    document.getElementById("weather-temp").textContent = "";
    statsEl.innerHTML =
      '<span class="weather-error">Could not load weather. Check your connection and refresh.</span>';
    console.error("[weather]", err);
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
  loadWeather();
  setInterval(loadWeather, 10 * 60 * 1000);   // refresh every 10 minutes
}
