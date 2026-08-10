// The values you edit to make the dashboard yours. Kept in one place so
// nobody has to read widget code to change a city or a location.

export const LOCATIONS = [
  { city: "Chennai",           zone: "Asia/Kolkata", local: true },
  { city: "Frankfurt am Main", zone: "Europe/Berlin" },
  { city: "London",            zone: "Europe/London" },
  { city: "Bishkek",           zone: "Asia/Bishkek" },
];

export const WEATHER_LOCATION = { city: "Chennai", latitude: 12.9326, longitude: 80.1313 };

export const WEATHER_CODES = {
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

// News feeds. Add or remove any RSS/Atom feed URL here; the widget merges
// them into one list. This is the "customizable sources" hook.
export const NEWS_FEEDS = [
  { name: "BBC World",   url: "https://feeds.bbci.co.uk/news/world/rss.xml" },
  { name: "NPR",         url: "https://feeds.npr.org/1001/rss.xml" },
  { name: "Al Jazeera",  url: "https://www.aljazeera.com/xml/rss/all.xml" },
];
