# Daymark

A privacy-friendly personal command center that brings planning, routines, time,
weather, news, and lightweight money tracking into one responsive browser app.
It is built with plain HTML, CSS, and JavaScript to demonstrate accessible UI,
resilient client-side state, and maintainable modular code without a framework.

## What it can do

- Summarize today across weather, calendar, tasks, spending, and reminders
- Show live weather with manual refresh and an offline last-known-data fallback
- Track world clocks in 12-hour or 24-hour format
- Plan tasks with priorities, due dates, filters, and overdue highlighting
- Schedule reminders with quick times, notifications, and snoozing
- Manage a grocery list with duplicate prevention and progress counts
- Run a reload-safe focus timer that stays accurate while the tab is asleep
- Track categorized expenses, monthly budgets, descriptions, and CSV exports
- Build habits with a seven-day view, daily progress, and streaks
- Create and edit validated quick links
- Plan calendar events with optional times and autosaved preparation notes
- Merge configurable news feeds with caching, deduplication, and safe links
- Personalize the greeting, theme, and visible widgets
- Reorder widgets by dragging or keyboard controls, collapse cards, and choose
  comfortable or compact density; the layout persists across reloads
- Export or restore all dashboard data from a JSON backup

## Design direction

Daymark uses a calm, editorial “productivity command center” aesthetic instead
of a uniform wall of cards. A responsive bento layout gives important tools more
space, the hero surfaces the day’s most useful context, and widget-specific
accents make the interface easier to scan. Weather, focus, habits, spending, and
news use distinct data-driven visuals while sharing one consistent type, spacing,
surface, and interaction system.

The Midnight, Daylight, and Ember themes all use the same semantic design tokens,
and the interface adapts from a wide 12-column workspace to a single-column
mobile flow without changing functionality.

All personal data stays in browser storage. Weather comes from Open-Meteo, and
news uses the RSS sources in `js/config.js` through public CORS proxies.

## Run locally

The app uses JavaScript modules, so serve the folder instead of opening the HTML
file directly. Any local static server works. For example:

```powershell
python -m http.server 4173
```

Then open `http://localhost:4173`.

## Test

No dependencies are required:

```powershell
node --test
```

The tests cover persistence and backup safety, generated IDs, configuration,
relative time behavior, duplicate HTML IDs, and JavaScript-to-HTML element
contracts. JavaScript syntax is also compatible with `node --check`.

## Customize

Edit `js/config.js` to change:

- `LOCATIONS` for world clocks and the local greeting timezone
- `WEATHER_LOCATION` for weather coordinates
- `NEWS_FEEDS` for RSS/Atom sources
- `CURRENCY` and `EXPENSE_CATEGORIES` for expense tracking

The Settings panel handles the user-facing name, theme, widget visibility, and
data backup without code changes.

## Architecture

Each widget owns its DOM and persisted records in `js/widgets/`. Shared storage,
formatting helpers, configuration, and live summary snapshots remain separate,
so one widget can fail without taking down the rest of the dashboard.
