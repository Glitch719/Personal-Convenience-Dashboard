// Shared, in-memory state: how widgets talk to each other WITHOUT importing
// one another directly. One widget writes a value here, another reads it.
//
// This is different from storage.js. Storage is the disk: it survives a
// refresh. State is live memory: it exists only for the current session.
//
// Think of each field below as a small "snapshot" a widget publishes. The
// Today summary reads all of them and composes the at-a-glance view.

export const state = {
  currentWeather: null,   // weather   -> greeting, summary   { city, temp, cond, ... }
  taskSummary: null,      // tasks     -> summary             { total, remaining, top }
  nextReminder: null,     // reminders -> summary             { text, time }
  nextEvent: null,        // calendar  -> summary             { title, time, whenMs, ... }
  expenseTotal: null,     // expenses  -> summary             { amount, currency }
  focusSession: null,     // focus     -> Now & Next          { mode, running, seconds }
};
