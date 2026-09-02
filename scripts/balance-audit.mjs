import { QBS } from "../src/data/qbs.js";
import { pathToFileURL } from "node:url";
import {
  DEVELOPMENT_ATTRIBUTE_KEYS,
  advanceDevelopmentSeason,
  rollDevelopmentSpeed,
} from "../src/sim/development.js";
import { evaluateProspect, footballOverall } from "../src/sim/ratings.js";

const ATTRIBUTES = DEVELOPMENT_ATTRIBUTE_KEYS;
const DECADES = ["1960s", "1970s", "1980s", "1990s", "2000s", "2010s", "2020s"];

function mulberry32(seed) {
  let state = seed >>> 0;
  return () => {
    state |= 0;
    state = (state + 0x6D2B79F5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const percentile = (values, fraction) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor((sorted.length - 1) * fraction)];
};

const pools = Object.fromEntries(DECADES.map(decade => [decade, QBS.filter(qb => qb.decade === decade)]));
const eraAverages = Object.fromEntries(DECADES.map(decade => [decade, Object.fromEntries(
  ATTRIBUTES.map(key => [key, pools[decade].reduce((sum, qb) => sum + qb.r[key], 0) / pools[decade].length]),
)]));

function normalizedValue(qb, key) {
  return clamp(Math.round(65 + qb.r[key] - eraAverages[qb.decade][key]), 15, 99);
}

function rollClassicProspect(random) {
  const decade = DECADES[Math.floor(random() * DECADES.length)];
  const picks = ATTRIBUTES.map(key => {
    let selected = null;
    for (let index = 0; index < 4; index++) {
      const qb = pools[decade][Math.floor(random() * pools[decade].length)];
      const value = normalizedValue(qb, key);
      if (!selected || value > selected.value) selected = { key, value, player: qb };
    }
    return selected;
  });
  return { decade, picks, evaluation: evaluateProspect(picks) };
}

// A season's own performance-vs-expectation index in the real game comes out of a whole
// attribute-driven stat-generation pipeline that lives in main.js (not a pure, importable module).
// Rather than duplicating that pipeline here (risking exactly the drift this harness exists to
// prevent), advanceDevelopmentSeason already accepts a raw context.performanceIndex that bypasses
// evaluatePerformanceOverExpectation entirely -- so the audit supplies its OWN index each season via
// a pluggable generator, letting it cover the shapes that actually matter: ordinary symmetric
// variance (the common case) and a sustained-elite stress case (the rare tail the balance targets
// explicitly call out, e.g. "reach 99 under 0.1%"). Leaving this unset (as the pre-fix version of
// this script did) silently left performanceIndex at 0 -- "always exactly meets expectations" --
// every season for every simulated career, which means the entire earned-breakthrough path (gated
// on performanceIndex>=0.50) could NEVER fire in the audit, understating the real achievable ceiling
// the moment a real player's variance (or a real hot streak) actually clears that bar.
function ordinaryPerformanceIndex(random) {
  // Bell-shaped, mean 0, in [-1,1] -- the same three-uniform-average trick used elsewhere in this
  // codebase for a cheap dependency-free approximate normal (see rollDevelopmentSpeed).
  return clamp(((random() + random() + random()) / 3) * 2 - 1, -1, 1);
}

function simulateDevelopment(initialBuild, random, {
  coaching = 60, games = 17, performanceIndexFor = ordinaryPerformanceIndex, planId = "balanced",
} = {}) {
  let state = {
    build: { ...initialBuild },
    originalBuild: { ...initialBuild },
    carry: {},
    devSpeed: rollDevelopmentSpeed(random),
    breakoutCount: 0,
    bustCount: 0,
    earnedBreakthroughCount: 0,
    breakthroughMomentum: 0,
  };
  const overalls = [footballOverall(state.build)];
  for (let age = 22; age <= 40; age++) {
    state = advanceDevelopmentSeason(state, {
      age,
      gamesPlayed: games,
      leagueGames: games,
      coaching,
      orgStability: false,
      orgTurmoil: false,
      planId,
      performanceIndex: performanceIndexFor(random, age),
    }, random);
    overalls.push(footballOverall(state.build));
  }
  return {
    startingOverall: overalls[0],
    peakOverall: Math.max(...overalls),
    age27Overall: overalls[6],
    age30Overall: overalls[9],
    age32Overall: overalls[11],
    breakoutCount: state.breakoutCount,
    bustCount: state.bustCount,
    earnedBreakthroughCount: state.earnedBreakthroughCount,
  };
}

function summarize(values) {
  return {
    p10: percentile(values, 0.10),
    p50: percentile(values, 0.50),
    p90: percentile(values, 0.90),
    p99: percentile(values, 0.99),
  };
}

// The impossible-in-practice case: every single season, for a whole career, this build's real
// production clears its own attribute-driven expectation by the maximum the model recognizes.
// Nobody plays like this every year -- it exists purely to measure the model's absolute ceiling
// under the most favorable performance path the mechanic allows, which is exactly what the balance
// targets for "reach 99" and "peak 95+" are targets FOR (see MASTER_REMEDIATION brief: "should
// require an extraordinarily favorable development profile," not merely be impossible outright).
const sustainedElitePerformanceIndex = () => 1;

export function runBalanceAudit({ samples = 20_000, seed = 0x47524944 } = {}) {
  const random = mulberry32(seed);
  const combineRows = [];
  const gradeBandRows = [];
  const flat76Rows = [];
  const eliteBandRows = [];

  for (let index = 0; index < samples; index++) {
    const prospect = rollClassicProspect(random);
    const build = Object.fromEntries(prospect.picks.map(pick => [pick.key, pick.value]));
    combineRows.push(prospect.evaluation);
    if (prospect.evaluation.score >= 75 && prospect.evaluation.score <= 76) {
      gradeBandRows.push({
        ...prospect.evaluation,
        development: simulateDevelopment(build, random),
      });
      eliteBandRows.push(simulateDevelopment(build, random, { performanceIndexFor: sustainedElitePerformanceIndex }));
    }
    flat76Rows.push(simulateDevelopment(Object.fromEntries(ATTRIBUTES.map(key => [key, 76])), random));
  }

  const combineScores = combineRows.map(row => row.score);
  const footballRatings = combineRows.map(row => row.footballOverallExact);
  const flatPeaks = flat76Rows.map(row => row.peakOverall);
  const bandPeaks = gradeBandRows.map(row => row.development.peakOverall);
  const elitePeaks = eliteBandRows.map(row => row.peakOverall);

  return {
    metadata: { samples, seed, gradeBandSampleCount: gradeBandRows.length },
    classicCombine: {
      combineGrade: summarize(combineScores),
      footballOverall: summarize(footballRatings),
      shareGrade75To76: gradeBandRows.length / samples,
    },
    flat76Development: {
      peakOverall: summarize(flatPeaks),
      sharePeak90Plus: flatPeaks.filter(value => value >= 90).length / flatPeaks.length,
      shareAnyBreakout: flat76Rows.filter(row => row.breakoutCount > 0).length / flat76Rows.length,
    },
    displayed75To76Development: gradeBandRows.length ? {
      startingFootballOverall: summarize(gradeBandRows.map(row => row.footballOverallExact)),
      peakFootballOverall: summarize(bandPeaks),
      sharePeak90Plus: bandPeaks.filter(value => value >= 90).length / bandPeaks.length,
      sharePeak95Plus: bandPeaks.filter(value => value >= 95).length / bandPeaks.length,
    } : null,
    // Same 75-76 grade-band prospects, replayed with sustainedElitePerformanceIndex instead of
    // ordinary variance -- the model's ceiling under the best performance path it recognizes, not a
    // realistic distribution. Compare against displayed75To76Development, never in isolation.
    displayed75To76SustainedElitePerformance: eliteBandRows.length ? {
      peakFootballOverall: summarize(elitePeaks),
      sharePeak90Plus: elitePeaks.filter(value => value >= 90).length / elitePeaks.length,
      sharePeak95Plus: elitePeaks.filter(value => value >= 95).length / elitePeaks.length,
      shareReach99: elitePeaks.filter(value => value >= 99).length / elitePeaks.length,
      shareAnyEarnedBreakthrough: eliteBandRows.filter(row => row.earnedBreakthroughCount > 0).length / eliteBandRows.length,
    } : null,
  };
}

function formatPercent(value) {
  return `${(value * 100).toFixed(2)}%`;
}

function printSummary(result) {
  const line = (label, data) => console.log(
    `${label.padEnd(34)} p10 ${data.p10.toFixed(1).padStart(5)}  p50 ${data.p50.toFixed(1).padStart(5)}  p90 ${data.p90.toFixed(1).padStart(5)}  p99 ${data.p99.toFixed(1).padStart(5)}`,
  );
  console.log(`Gridiron Lab balance audit · ${result.metadata.samples.toLocaleString()} seeded careers`);
  line("Classic Combine grade", result.classicCombine.combineGrade);
  line("Classic football OVR", result.classicCombine.footballOverall);
  line("Flat-76 peak football OVR", result.flat76Development.peakOverall);
  console.log(`Flat-76 peak 90+${"".padEnd(21)} ${formatPercent(result.flat76Development.sharePeak90Plus)}`);
  console.log(`Flat-76 any breakout${"".padEnd(18)} ${formatPercent(result.flat76Development.shareAnyBreakout)}`);
  if (result.displayed75To76Development) {
    line("Displayed 75-76 starting OVR", result.displayed75To76Development.startingFootballOverall);
    line("Displayed 75-76 peak OVR", result.displayed75To76Development.peakFootballOverall);
    console.log(`Displayed 75-76 peak 90+${"".padEnd(14)} ${formatPercent(result.displayed75To76Development.sharePeak90Plus)}`);
    console.log(`Displayed 75-76 peak 95+${"".padEnd(14)} ${formatPercent(result.displayed75To76Development.sharePeak95Plus)}`);
  }
  if (result.displayed75To76SustainedElitePerformance) {
    const elite = result.displayed75To76SustainedElitePerformance;
    console.log("-- same 75-76 prospects, replayed under sustained-elite performance (ceiling test, not a realistic distribution) --");
    line("Displayed 75-76 elite-path peak OVR", elite.peakFootballOverall);
    console.log(`Displayed 75-76 elite-path peak 90+${"".padEnd(6)} ${formatPercent(elite.sharePeak90Plus)}`);
    console.log(`Displayed 75-76 elite-path peak 95+${"".padEnd(6)} ${formatPercent(elite.sharePeak95Plus)}`);
    console.log(`Displayed 75-76 elite-path reach 99${"".padEnd(7)} ${formatPercent(elite.shareReach99)}`);
    console.log(`Displayed 75-76 elite-path any earned breakthrough ${formatPercent(elite.shareAnyEarnedBreakthrough)}`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const samplesFlag = process.argv.indexOf("--samples");
  const samples = samplesFlag >= 0 ? Number(process.argv[samplesFlag + 1]) : 20_000;
  printSummary(runBalanceAudit({ samples }));
}
