// Phase 16: the pure pitcher season-stat engine. Sweeps synthetic talent levels through
// simulatePitcherLine across every era and asserts the output distribution is era-realistic --
// a neutral (65) build pitches league-average ball, an ace separates cleanly, and no build breaks
// the sport's real record ceilings. This is the permanent guardrail the diagnostic tuning of the
// coefficients in src/sim/pitching.js is done against.
import test from "node:test";
import assert from "node:assert/strict";

import {
  PITCH_LEAGUE, PITCH_STAT_CAL, pitcherExpectedRates, simulatePitcherLine, fip, cyYoungScore,
  pitcherPrimeMultiplier, ROTATION_STAT_SCALE,
} from "../../src/sim/pitching.js";
import { pitcherOverall, PITCHER_OVERALL_WEIGHTS, evaluateProspect } from "../../src/sim/ratings.js";

const DECADES = ["1960s", "1970s", "1980s", "1990s", "2000s", "2010s", "2020s"];

// deterministic bell-ish stream so the sweeps are reproducible
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function median(xs) { const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; }
function sweep(opts, n = 400, seed = 1) {
  const rnd = mulberry32(seed);
  return Array.from({ length: n }, () => simulatePitcherLine({ ...opts, random: rnd }));
}

test("PITCHER_OVERALL_WEIGHTS sum to 1 and cover exactly the 12 pitching tools", () => {
  const keys = Object.keys(PITCHER_OVERALL_WEIGHTS);
  assert.equal(keys.length, 12);
  const sum = Object.values(PITCHER_OVERALL_WEIGHTS).reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(sum - 1) < 1e-9, `weights sum to ${sum}`);
  for (const k of ["VELO", "FBL", "BRK", "CHG", "CMD", "TUN", "SEQ", "PIK", "STM", "PSE", "CMP", "DUR"]) {
    assert.ok(k in PITCHER_OVERALL_WEIGHTS, `missing tool ${k}`);
  }
});

test("a flat-65 pitcher is league average: ERA+ ~100 and ERA within a hair of the era baseline", () => {
  for (const decade of DECADES) {
    const exp = pitcherExpectedRates(65, 28, decade);
    assert.ok(Math.abs(exp.eraPlus - 100) < 1, `${decade}: ERA+ ${exp.eraPlus}`);
    assert.ok(Math.abs(exp.era - PITCH_LEAGUE[decade].era) < 0.05, `${decade}: ERA ${exp.era} vs lg ${PITCH_LEAGUE[decade].era}`);
  }
});

test("talent separates: a #2-starter, an ace, and an inner-circle arm land in believable ERA+ bands", () => {
  for (const decade of DECADES) {
    const good = pitcherExpectedRates(82, 28, decade);   // solid mid-rotation
    const ace = pitcherExpectedRates(92, 28, decade);    // staff ace
    const elite = pitcherExpectedRates(99, 27, decade);  // perennial Cy Young
    assert.ok(good.eraPlus > 108 && good.eraPlus < 135, `${decade}: good ERA+ ${good.eraPlus}`);
    assert.ok(ace.eraPlus > 130 && ace.eraPlus < 185, `${decade}: ace ERA+ ${ace.eraPlus}`);
    assert.ok(elite.eraPlus > 165 && elite.eraPlus < 250, `${decade}: elite ERA+ ${elite.eraPlus}`);
    assert.ok(ace.eraPlus > good.eraPlus + 12 && elite.eraPlus > ace.eraPlus + 8, `${decade}: monotone separation`);
  }
});

test("even a maxed 99 build in a full season never clears the sport's real ERA / ERA+ ceilings", () => {
  for (const decade of DECADES) {
    const cal = PITCH_STAT_CAL[decade];
    const lines = sweep({ talent: 99, age: 27, decade, role: "SP", teamGrade: 78 }, 500, 42);
    for (const ln of lines) {
      assert.ok(ln.era >= cal.eraLo - 1e-9, `${decade}: ERA ${ln.era} below floor ${cal.eraLo}`);
      assert.ok(ln.eraPlus <= 340, `${decade}: ERA+ ${ln.eraPlus} absurd`);
      assert.ok(ln.k9 <= cal.k9.hi + 1e-9, `${decade}: K/9 ${ln.k9} over ceiling`);
      assert.ok(ln.bb9 >= cal.bb9.lo - 1e-9, `${decade}: BB/9 ${ln.bb9} under floor`);
    }
    const bestEraPlus = Math.max(...lines.map(l => l.eraPlus));
    // Pedro 2000 was 291; allow the sim's single best of 500 maxed seasons to approach but not
    // blow past the all-time mark by a wide margin.
    assert.ok(bestEraPlus <= 320, `${decade}: best-of-500 ERA+ ${bestEraPlus} exceeds the all-time neighborhood`);
  }
});

test("a modern ace starter posts a realistic full-season shape (IP, K, W, ERA)", () => {
  const lines = sweep({ talent: 93, age: 28, decade: "2010s", role: "SP", teamGrade: 74 }, 400, 7);
  const ip = median(lines.map(l => l.ip));
  const k = median(lines.map(l => l.k));
  const w = median(lines.map(l => l.w));
  const era = median(lines.map(l => l.era));
  assert.ok(ip > 150 && ip < 235, `median IP ${ip}`);
  assert.ok(k > 170 && k < 320, `median K ${k}`);
  assert.ok(w >= 11 && w <= 22, `median W ${w}`);
  assert.ok(era > 2.2 && era < 3.9, `median ERA ${era}`);
  lines.forEach(l => assert.ok(l.qs <= l.gs && l.cg <= l.gs && l.w + l.l <= l.gs, "decisions/QS/CG bounded by GS"));
});

test("a 1970s workhorse throws far more innings and complete games than a 2020s arm of equal talent", () => {
  const old = median(sweep({ talent: 88, age: 29, decade: "1970s", role: "SP", teamGrade: 68 }, 300, 3).map(l => l.ip));
  const now = median(sweep({ talent: 88, age: 29, decade: "2020s", role: "SP", teamGrade: 68 }, 300, 3).map(l => l.ip));
  const oldCg = median(sweep({ talent: 88, age: 29, decade: "1970s", role: "SP", teamGrade: 68 }, 300, 5).map(l => l.cg));
  assert.ok(old > now + 40, `1970s IP ${old} vs 2020s IP ${now}`);
  assert.ok(oldCg >= 6, `1970s CG median ${oldCg}`);
});

test("a closer's line is save-shaped: few innings, lots of appearances, real save totals", () => {
  const lines = sweep({ talent: 90, age: 29, decade: "2010s", role: "CL", teamGrade: 80 }, 300, 11);
  const ip = median(lines.map(l => l.ip));
  const sv = median(lines.map(l => l.sv));
  const gs = Math.max(...lines.map(l => l.gs));
  assert.equal(gs, 0, "a closer makes no starts");
  assert.ok(ip > 45 && ip < 95, `closer IP ${ip}`);
  assert.ok(sv > 22 && sv < 58, `closer SV ${sv}`);
});

test("age curve: same build peaks around 27-28 and is clearly worse at 39", () => {
  const at27 = pitcherExpectedRates(90, 27, "2010s").eraPlus;
  const at33 = pitcherExpectedRates(90, 33, "2010s").eraPlus;
  const at39 = pitcherExpectedRates(90, 39, "2010s").eraPlus;
  assert.ok(at27 > at33 && at33 > at39, `${at27} > ${at33} > ${at39}`);
  assert.ok(pitcherPrimeMultiplier(28) >= pitcherPrimeMultiplier(24));
  assert.ok(pitcherPrimeMultiplier(24) > pitcherPrimeMultiplier(39));
});

test("rotation entities (talent scalar, compressed) top out as aces, not as peak Pedro every year", () => {
  const elite = pitcherExpectedRates(99, 28, "2000s", ROTATION_STAT_SCALE).eraPlus;
  const good = pitcherExpectedRates(88, 28, "2000s", ROTATION_STAT_SCALE).eraPlus;
  assert.ok(elite > 140 && elite < 185, `compressed elite ERA+ ${elite}`);
  assert.ok(good > 112 && good < 145, `compressed good ERA+ ${good}`);
});

test("FIP tracks the event counts and stays on the ERA scale", () => {
  const lg = PITCH_LEAGUE["2010s"];
  const neutralish = fip(160, 55, 22, 190, "2010s");
  assert.ok(Math.abs(neutralish - lg.era) < 1.5, `neutral-ish FIP ${neutralish}`);
  const dominant = fip(280, 30, 12, 210, "2010s");
  assert.ok(dominant < neutralish - 1, `dominant FIP ${dominant} should be well below ${neutralish}`);
});

test("cyYoungScore ranks an ace's season over a compiler's and a closer's elite year is competitive", () => {
  const ace = simulatePitcherLine({ talent: 96, age: 28, decade: "2010s", role: "SP", teamGrade: 72, random: mulberry32(1) });
  const backEnd = simulatePitcherLine({ talent: 74, age: 30, decade: "2010s", role: "SP", teamGrade: 88, random: mulberry32(1) });
  assert.ok(cyYoungScore(ace, "2010s") > cyYoungScore(backEnd, "2010s"), "ace outscores a #4 on a stacked club");
  const closer = simulatePitcherLine({ talent: 95, age: 29, decade: "2010s", role: "CL", teamGrade: 85, random: mulberry32(1) });
  assert.ok(cyYoungScore(closer, "2010s") > 0, "an elite closer scores positively");
});

test("evaluateProspect scores a pitching build on pitcher weights, not hitter weights", () => {
  // a build that's all command/stuff, nothing else
  const picks = Object.keys(PITCHER_OVERALL_WEIGHTS).map(key => ({
    key, value: ["CMD", "BRK", "VELO", "SEQ"].includes(key) ? 95 : 55,
  }));
  const asPitcher = evaluateProspect(picks, "pitcher");
  const asBatter = evaluateProspect(picks, "batter");
  // the pitcher reading should credit the concentrated stuff/command far more than the hitter one
  assert.ok(asPitcher.footballOverall > asBatter.footballOverall + 5,
    `pitcher OVR ${asPitcher.footballOverall} vs batter OVR ${asBatter.footballOverall}`);
});
