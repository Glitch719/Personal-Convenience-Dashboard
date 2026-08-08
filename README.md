# Daily Dashboard

A personal dashboard and planner that brings your day into one place: time across
multiple locations, live weather, and (in progress) news, calendar, reminders,
notes, and more. Built to run in the browser now, and to be packaged as a
downloadable desktop app later.

The guiding idea is that the widgets talk to each other. A calendar event can
carry prep notes, the greeting reflects the current weather, and so on, rather
than being a set of boxes that ignore each other.

## Status

Early build. Working so far:

- Multi-location clock with a day/night indicator
- Live weather (via Open-Meteo, no API key needed)

Planned: news, calendar with per-event notes, reminders, tasks, mail, notes,
and a Spotify embed.

## Running it locally

No build step yet. You need a browser and, ideally, a local server.

1. Clone the repo and open the folder in VS Code.
2. Install the "Live Server" extension.
3. Right-click `index.html` -> "Open with Live Server".

The page will open on localhost and reload automatically when you save a file.

## Making it yours

All the settings live at the top of `app.js`:

- `LOCATIONS` controls which clocks appear.
- `WEATHER_LOCATION` sets the coordinates used for weather.

## Contributing

Work on a branch, not on `main`:

```
git checkout -b my-feature
# make changes, then
git add .
git commit -m "Describe what you did"
git push -u origin my-feature
```

Then open a Pull Request on GitHub for review.

## Tech

Plain HTML, CSS, and JavaScript for now. No frameworks yet; React comes in once
the hand-written DOM updates get heavy.
