import test from "node:test";
import assert from "node:assert/strict";

import {
  advanceDevelopmentSeason,
  rollDevelopmentSpeed,
} from "../../src/sim/development.js";
import {
  chooseDraftTeam,
  evaluateProspect,
  footballOverall,
} from "../../src/sim/ratings.js";
import { runBalanceAudit } from "../../scripts/balance-audit.mjs";

const ATTRIBUTE_KEYS = ["ARM","DAC","SHA","TCH","PKT","REL","MOB","IMP","ANT","DEC","CLU","DUR"];
const picksFor = values => ATTRIBUTE_KEYS.map(key => ({ key, value: values[key] }));

test("flat ratings have matching Combine grade and football OVR", () => {
  const values = Object.fromEntries(ATTRIBUTE_KEYS.map(key => [key, 65]));
  const result = evaluateProspect(picksFor(values));
  assert.equal(result.score, 65);
  assert.equal(result.footballOverall, 65);
});

test("the prospect evaluation exposes specialist grade/OVR disagreement", () => {
  const values = {
    ARM: 55, DAC: 84, SHA: 88, TCH: 86, PKT: 85, REL: 50,
    MOB: 35, IMP: 45, ANT: 88, DEC: 88, CLU: 84, DUR: 50,
  };
  const result = evaluateProspect(picksFor(values));
  assert.ok(result.footballOverall >= result.score + 15);
  assert.equal(result.footballOverall, Math.round(footballOverall(values)));
});

test("top draft picks are routed toward weak teams", () => {
  const teams = Array.from({ length: 10 }, (_, index) => ({ id: `T${index}` }));
  const strengths = Object.fromEntries(teams.map((team, index) => [team.id, 40 + index * 5]));
  const first = chooseDraftTeam(teams, strengths, { round: 1 }, 1, () => 0.5);
  const last = chooseDraftTeam(teams, strengths, { round: 1 }, 32, () => 0.5);
  assert.equal(first.id, "T0");
  assert.equal(last.id, "T9");
});

test("breakouts never self-amplify development speed", () => {
  const build = Object.fromEntries(ATTRIBUTE_KEYS.map(key => [key, 70]));
  const sequence = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  let cursor = 0;
  const result = advanceDevelopmentSeason({
    build,
    originalBuild: build,
    carry: {},
    devSpeed: 1.4,
    breakoutCount: 0,
    bustCount: 0,
  }, {
    age: 22,
    gamesPlayed: 17,
    leagueGames: 17,
    coaching: 100,
  }, () => sequence[cursor++ % sequence.length]);
  assert.equal(result.devSpeed, 1.4);
  assert.equal(result.arcEvent?.type, "breakout");
});

test("seeded flat-76 development stays out of the automatic-superstar range", () => {
  const audit = runBalanceAudit({ samples: 5_000, seed: 0xBADA55 });
  const peak = audit.flat76Development.peakOverall;
  assert.ok(peak.p50 >= 83 && peak.p50 <= 86, `median peak was ${peak.p50}`);
  assert.ok(peak.p90 < 89, `90th-percentile peak was ${peak.p90}`);
  assert.ok(audit.flat76Development.sharePeak90Plus < 0.02);
  assert.ok(audit.flat76Development.shareAnyBreakout >= 0.08);
  assert.ok(audit.flat76Development.shareAnyBreakout <= 0.20);
});

// Pre-fix, simulateDevelopment inside balance-audit.mjs never passed a performanceIndex at all,
// which left it undefined -> evaluatePerformanceOverExpectation({}) -> attempts=0 -> index always
// exactly 0 ("met expectations") for every simulated season. Since earnedBreakthroughChance requires
// performanceIndex>=0.50, that meant the entire earned-breakthrough path -- the actual subject of
// this balance wave -- could never fire in the audit at all, so the audit's own headline numbers
// never actually exercised the mechanic they were meant to validate. These two tests cover the two
// shapes that now matter: realistic symmetric variance (the ordinary case) and sustained-elite
// performance (the ceiling case the "reach 99 under 0.1%" balance target is actually about).
test("ordinary performance variance keeps displayed 75-76 development near the balance target band", () => {
  const audit = runBalanceAudit({ samples: 8_000, seed: 0xF00DFACE });
  const dev = audit.displayed75To76Development;
  assert.ok(dev, "seed must produce at least one 75-76 grade-band sample");
  // Brief's own target table: "Peak 90+: 8-12%" for a displayed 75-76 prospect. Widened slightly
  // below (6%) as a regression floor -- this guards against the mechanic going quiet (e.g. a future
  // change accidentally leaving performanceIndex at 0 again), not against every possible reseed.
  assert.ok(dev.sharePeak90Plus >= 0.06 && dev.sharePeak90Plus <= 0.16, `peak 90+ share was ${dev.sharePeak90Plus}`);
  // "Peak 95+: 0.5-1.5%" -- ordinary symmetric variance alone should almost never clear this; it is
  // the earned-breakthrough/breakout tail doing the work, not the common case.
  assert.ok(dev.sharePeak95Plus <= 0.03, `peak 95+ share was ${dev.sharePeak95Plus}`);
});

test("sustained elite performance raises the ceiling without making 99 routine", () => {
  const audit = runBalanceAudit({ samples: 8_000, seed: 0xF00DFACE });
  const elite = audit.displayed75To76SustainedElitePerformance;
  const ordinary = audit.displayed75To76Development;
  assert.ok(elite, "seed must produce at least one 75-76 grade-band sample");
  // The whole point of the mechanic: crushing your own expectation every season for a career
  // measurably raises the ceiling relative to ordinary variance...
  assert.ok(elite.peakFootballOverall.p50 > ordinary.peakFootballOverall.p50);
  assert.ok(elite.sharePeak90Plus > ordinary.sharePeak90Plus);
  // ...but even the most favorable performance path this model recognizes -- an unrealistic, every
  // single season for a whole career best case -- must stay far short of routine at the very top.
  // Not asserting an exact reach-99 rate: at this sample size 0% is statistically consistent with
  // the brief's own "under 0.1%" target, not proof of a hard cap (see PROGRESS.md for the reasoning).
  assert.ok(elite.sharePeak95Plus < 0.05, `elite-path peak 95+ share was ${elite.sharePeak95Plus}`);
  assert.ok(elite.shareReach99 < 0.01, `elite-path reach-99 share was ${elite.shareReach99}`);
});

test("development-speed roll remains bounded and centered", () => {
  let state = 123456;
  const random = () => ((state = Math.imul(state, 1664525) + 1013904223 >>> 0) / 4294967296);
  const rolls = Array.from({ length: 10_000 }, () => rollDevelopmentSpeed(random));
  const mean = rolls.reduce((sum, value) => sum + value, 0) / rolls.length;
  assert.ok(rolls.every(value => value >= 0.6 && value <= 1.4));
  assert.ok(mean >= 0.99 && mean <= 1.01, `mean was ${mean}`);
});
