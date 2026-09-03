import test from "node:test";
import assert from "node:assert/strict";

import { createSeededRandom, installSeededRandom, restoreRandom, isSeededRandomActive } from "../../src/sim/prng.js";

test("createSeededRandom is deterministic: the same seed produces the same sequence", () => {
  const a = createSeededRandom(12345);
  const b = createSeededRandom(12345);
  const seqA = Array.from({ length: 20 }, () => a());
  const seqB = Array.from({ length: 20 }, () => b());
  assert.deepEqual(seqA, seqB);
});

test("createSeededRandom produces different sequences for different seeds", () => {
  const a = createSeededRandom(1);
  const b = createSeededRandom(2);
  const seqA = Array.from({ length: 10 }, () => a());
  const seqB = Array.from({ length: 10 }, () => b());
  assert.notDeepEqual(seqA, seqB);
});

test("every value stays within [0, 1)", () => {
  const gen = createSeededRandom(999);
  for (let i = 0; i < 1000; i++) {
    const v = gen();
    assert.ok(v >= 0 && v < 1, `value ${v} out of [0,1)`);
  }
});

test("installSeededRandom/restoreRandom actually swap the global Math.random and back", () => {
  const original = Math.random;
  installSeededRandom(42);
  assert.equal(isSeededRandomActive(), true);
  assert.notEqual(Math.random, original);
  const first = Math.random();
  const gen = createSeededRandom(42);
  assert.equal(first, gen()); // the very first draw from the installed generator matches a fresh one seeded identically
  restoreRandom();
  assert.equal(isSeededRandomActive(), false);
  assert.equal(Math.random, original);
});

test("two independent installs from the same seed produce identical draw sequences", () => {
  installSeededRandom(777);
  const seqA = Array.from({ length: 15 }, () => Math.random());
  restoreRandom();
  installSeededRandom(777);
  const seqB = Array.from({ length: 15 }, () => Math.random());
  restoreRandom();
  assert.deepEqual(seqA, seqB);
});

test("two clients that diverge after N identical draws produce identical prefixes and different suffixes", () => {
  // Models the actual multiplayer guarantee: two players starting from the same seed and making the
  // same choices for a while get byte-identical results; the moment one makes a DIFFERENT choice
  // (consuming a different number of random draws), only the sequence from that point on diverges.
  installSeededRandom(555);
  const clientA = Array.from({ length: 5 }, () => Math.random());
  clientA.push(Math.random()); // A's "choice" consumes one more draw here
  restoreRandom();

  installSeededRandom(555);
  const clientB = Array.from({ length: 5 }, () => Math.random());
  // B makes a DIFFERENT choice that consumes two draws instead of one before their next comparable point
  clientB.push(Math.random(), Math.random());
  restoreRandom();

  assert.deepEqual(clientA.slice(0, 5), clientB.slice(0, 5), "the shared prefix before any choice must be identical");
  assert.notEqual(clientA[5], clientB[6], "post-divergence draws should not coincidentally realign");
});
