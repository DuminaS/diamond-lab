import test from "node:test";
import assert from "node:assert/strict";

import { scoreComponents, computeMatchScore, SCORE_WEIGHTS } from "../../src/sim/multiplayerScore.js";

test("weights sum to 1.0", () => {
  const total = Object.values(SCORE_WEIGHTS).reduce((s, w) => s + w, 0);
  assert.ok(Math.abs(total - 1.0) < 1e-9, `weights summed to ${total}, expected 1.0`);
});

test("an empty/missing summary never throws and scores at the floor", () => {
  const c = scoreComponents({});
  assert.equal(c.total, 0);
  const c2 = scoreComponents(undefined);
  assert.equal(c2.total, 0);
});

test("identical summaries produce identical totals and computeMatchScore reports a tie", () => {
  const summary = { rings: 2, mvps: 1, allPros: 3, proBowls: 5, peakOverall: 88, rating: 98.5, yards: 32000, games: 160, achievementCount: 20, earnings: 90000000 };
  const result = computeMatchScore(summary, { ...summary });
  assert.equal(result.componentsA.total, result.componentsB.total);
  assert.equal(result.winner, "tie");
});

test("more rings, all else equal, scores strictly higher", () => {
  const base = { rings: 1, mvps: 1, allPros: 1, proBowls: 3, peakOverall: 85, rating: 95, yards: 30000, games: 150, achievementCount: 15, earnings: 80000000 };
  const moreRings = { ...base, rings: 4 };
  const a = scoreComponents(base).total;
  const b = scoreComponents(moreRings).total;
  assert.ok(b > a, `expected more rings to score higher: ${b} vs ${a}`);
});

// The exact property this composite exists to guarantee, mirroring the balance brief's own worked
// example for MVP scoring (tests/balance/awards.node.mjs): a short, brilliant career should be able
// to beat a long, unremarkable one on rate-and-accolade quality even with far fewer career totals.
test("a short brilliant career can outscore a long mediocre one despite far lower career totals", () => {
  const shortBrilliant = {
    rings: 3, mvps: 4, allPros: 6, proBowls: 8,
    peakOverall: 97, rating: 108,
    yards: 28000, games: 130,        // a 9-10 season career
    achievementCount: 35, earnings: 140000000,
  };
  const longMediocre = {
    rings: 0, mvps: 0, allPros: 0, proBowls: 1,
    peakOverall: 68, rating: 76,
    yards: 55000, games: 280,        // a ~18-season career, mostly unremarkable
    achievementCount: 5, earnings: 95000000,
  };
  const result = computeMatchScore(shortBrilliant, longMediocre);
  assert.equal(result.winner, "A");
  assert.ok(result.componentsA.total > result.componentsB.total);
});

test("component values are always clamped to a sane 0-100 range even with extreme/malformed input", () => {
  const extreme = { rings: 999, mvps: 999, allPros: 999, proBowls: 999, peakOverall: 500, rating: 999, yards: 99999999, games: 99999, achievementCount: 99999, earnings: 999999999999 };
  const c = scoreComponents(extreme);
  for (const key of ["rings", "accolades", "peakAndRate", "careerTotals", "achievements", "earnings"]) {
    assert.ok(c[key] >= 0 && c[key] <= 100, `${key} was ${c[key]}, expected within [0,100]`);
  }
  assert.ok(c.total >= 0 && c.total <= 100);
});

test("negative/garbage numeric fields never produce a negative component", () => {
  const bad = { rings: -5, mvps: -1, allPros: null, proBowls: undefined, peakOverall: -20, rating: -100, yards: -1, games: -1, achievementCount: -1, earnings: -1 };
  const c = scoreComponents(bad);
  for (const key of ["rings", "accolades", "peakAndRate", "careerTotals", "achievements", "earnings", "total"]) {
    assert.ok(c[key] >= 0, `${key} was ${c[key]}, expected >= 0`);
  }
});
