// Multiplayer Parallel Universe Mode, Phase 0 (see MULTIPLAYER_MODE_SPEC.md section 2): the one
// hard technical prerequisite for "two players get the exact same rolls in order" is a real,
// production seeded-RNG mechanism -- this codebase's entire simulation calls the browser's global
// Math.random() directly, unseeded, everywhere. Rather than threading a PRNG instance as an
// explicit parameter through every call site (a huge, high-risk refactor unrelated to multiplayer
// itself), this reuses the exact technique the test suite already proves works dozens of times
// over (tests/helpers/seededRandom.mjs's page-injected Math.random override): swap the GLOBAL
// Math.random for a seeded generator at session start. Zero call sites change. This module is now
// the one place the algorithm lives -- tests/helpers/seededRandom.mjs should eventually become a
// thin wrapper around this (see that file's own comment), so production and test behavior can
// never quietly drift apart.
//
// mulberry32: small, fast, good-enough statistical quality for this purpose -- picked originally
// for the test harness because it's trivially portable as an inline source string; kept here for
// the same reason it was good enough there (this is about REPRODUCIBILITY between two players, not
// cryptographic randomness).
export function createSeededRandom(seed) {
  let s = seed >>> 0;
  return function mulberry32() {
    s |= 0; s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Tracks the pre-override Math.random so it can be restored -- important for a session that starts
// a multiplayer match, finishes or abandons it, and returns to ordinary solo play (which must go
// back to genuine, unseeded randomness, not silently stay pinned to a stale multiplayer seed).
let _originalRandom = null;

export function installSeededRandom(seed) {
  if (_originalRandom === null) _originalRandom = Math.random;
  Math.random = createSeededRandom(seed);
}

export function restoreRandom() {
  if (_originalRandom !== null) {
    Math.random = _originalRandom;
    _originalRandom = null;
  }
}

export function isSeededRandomActive() {
  return _originalRandom !== null;
}
