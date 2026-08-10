// Shared, in-memory state: how widgets talk to each other WITHOUT importing
// one another directly. One widget writes a value here, another reads it.
//
// This is different from storage.js. Storage is the disk: it survives a
// refresh. State is live memory: it exists only for the current session.

export const state = {
  currentWeather: null,   // weather widget writes this; the greeting reads it
};
