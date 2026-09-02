import test from "node:test";
import assert from "node:assert/strict";

import {
  KEY_MOMENT_BASE_TRIGGER_CHANCE,
  KEY_MOMENT_SITUATION_FLAGS,
  PLAY_CALLS,
  executeKeyMomentQuality,
  keyMomentCallScore,
} from "../../src/sim/keyMoments.js";

const TENDENCIES = ["runheavy","blitzheavy","lockdowncorners","preventlate","turnoverhunting","physicalfront","disciplinedzone","suddenchange"];

function rankFor(tendencyId, flags) {
  return [...PLAY_CALLS]
    .map(call => ({ id: call.id, score: keyMomentCallScore(call, tendencyId, flags) }))
    .sort((a, b) => b.score - a.score);
}

// This is the exact reported defect: "'control the clock' may be marked correct against prevent
// defense even when trailing late and needing a touchdown." km_h3 ("4th-and-goal from the 4, down
// four, final minute of the fourth") carries needScore/mustConvert/lateAndClose -- controlclock's
// badWhen should now outweigh its tendency-counter bonus against preventlate specifically here.
test("the reported controlclock-vs-preventlate-while-trailing-late defect is fixed", () => {
  const ranked = rankFor("preventlate", KEY_MOMENT_SITUATION_FLAGS.km_h3);
  const controlclock = ranked.find(r => r.id === "controlclock");
  assert.ok(ranked[0].id !== "controlclock", `controlclock ranked first: ${JSON.stringify(ranked)}`);
  assert.ok(controlclock.score < 0, `controlclock should score negative here, got ${controlclock.score}`);
});

// The old system had a single, permanent, memorizable answer for every tendency regardless of
// context. If the textbook counter were STILL always best, this wave's whole premise would be
// false -- assert a real, substantial fraction of tendency x situation combinations produce a
// DIFFERENT best call than the fixed 1:1 mapping used to guarantee.
test("situational context meaningfully overrides the textbook tendency counter", () => {
  const situationIds = Object.keys(KEY_MOMENT_SITUATION_FLAGS);
  let total = 0, overridden = 0;
  for (const tendencyId of TENDENCIES) {
    const textbook = PLAY_CALLS.find(c => c.countersTendencyId === tendencyId);
    for (const situationId of situationIds) {
      total++;
      const ranked = rankFor(tendencyId, KEY_MOMENT_SITUATION_FLAGS[situationId]);
      if (ranked[0].id !== textbook.id) overridden++;
    }
  }
  const share = overridden / total;
  assert.ok(share >= 0.25, `expected at least 25% of combos to override the textbook answer, got ${(share*100).toFixed(1)}% (${overridden}/${total})`);
});

test("every tendency x situation combination produces a usable ranking (no empty/degenerate result)", () => {
  const situationIds = Object.keys(KEY_MOMENT_SITUATION_FLAGS);
  for (const tendencyId of TENDENCIES) {
    for (const situationId of situationIds) {
      const ranked = rankFor(tendencyId, KEY_MOMENT_SITUATION_FLAGS[situationId]);
      assert.equal(ranked.length, PLAY_CALLS.length);
      assert.ok(Number.isFinite(ranked[0].score));
    }
  }
});

test("execution variance: low Clutch can slip a good read, high Clutch can save a bad one", () => {
  const always = () => 0; // forces the "did it happen" branch every time
  assert.equal(executeKeyMomentQuality("good", 20, always), "meh", "a low-Clutch build must be able to blow a good read's execution");
  assert.equal(executeKeyMomentQuality("bad", 95, always), "meh", "a high-Clutch build must be able to save a bad read's execution");
  const never = () => 0.999999;
  assert.equal(executeKeyMomentQuality("good", 95, never), "good", "a high-Clutch build should reliably execute a good read");
  assert.equal(executeKeyMomentQuality("bad", 20, never), "bad", "a low-Clutch build should not get a free save on a bad read");
  // Meh is the designed-neutral tier -- Clutch never moves it in either direction.
  assert.equal(executeKeyMomentQuality("meh", 99, always), "meh");
  assert.equal(executeKeyMomentQuality("meh", 1, always), "meh");
});

test("execution variance stays within its documented bounds across the whole Clutch range", () => {
  for (let clu = 0; clu <= 100; clu += 5) {
    // Sample many rolls per Clutch value and confirm the empirical slip/save rate never runs away
    // past the documented clamp bounds (0.03-0.30 slip, 0-0.20 save).
    let goodSlips = 0, badSaves = 0;
    const trials = 4000;
    let seed = clu + 1;
    const random = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
    for (let i = 0; i < trials; i++) {
      if (executeKeyMomentQuality("good", clu, random) === "meh") goodSlips++;
      if (executeKeyMomentQuality("bad", clu, random) === "meh") badSaves++;
    }
    assert.ok(goodSlips / trials <= 0.32, `slip rate too high at Clutch ${clu}: ${goodSlips / trials}`);
    assert.ok(badSaves / trials <= 0.22, `save rate too high at Clutch ${clu}: ${badSaves / trials}`);
  }
});

// Balance Wave 3: Clutch must no longer gate whether the mini-game triggers at all -- the trigger
// chance is now a single flat constant, not a function of any attribute. This test exists mainly
// to catch a future regression that reintroduces a clu parameter here.
test("Key Moment trigger chance is a flat, leverage-only constant", () => {
  assert.equal(typeof KEY_MOMENT_BASE_TRIGGER_CHANCE, "number");
  assert.ok(KEY_MOMENT_BASE_TRIGGER_CHANCE > 0 && KEY_MOMENT_BASE_TRIGGER_CHANCE < 1);
});
