// Multiplayer Parallel Universe Mode (MULTIPLAYER_MODE_SPEC.md section 5): the weighted composite
// that decides a head-to-head winner from two finished careers' rings/accolades/stats/money/
// achievements. Deliberately reuses this codebase's own established philosophy rather than
// inventing a new one -- the Balance Wave 5 rewrite of MVP scoring exists specifically because raw
// counting-stat/win totals reward a long, unremarkable career over a short, brilliant one; this
// composite makes the same rate-vs-totals distinction on purpose (see the peak/rate component
// below), instead of just summing career totals and calling the bigger pile the winner.
//
// Pure and side-effect-free by the same convention as ratings.js/development.js/keyMoments.js/
// awards.js/achievementRules.js -- callers (main.js) extract these plain-number fields from a
// finished career/Trophy-Room-entry-shaped object; this module only ever does the scoring math on
// numbers it's handed, so the formula itself is unit-testable headlessly against hand-built
// "archetype" careers, the same diagnostic-driven-calibration norm every numeric dial in this
// project gets tuned against.

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

// Every weight and cap below is a first PROPOSAL (see MULTIPLAYER_MODE_SPEC.md section 11), not a
// locked answer -- expected to be tuned from real sweep output before this ships, same as every
// other numeric dial in this codebase.
export const SCORE_WEIGHTS = Object.freeze({
  rings: 0.30,
  accolades: 0.25,
  peakAndRate: 0.20,
  careerTotals: 0.10,
  achievements: 0.10,
  earnings: 0.05,
});

// Caps below which a component is scaled linearly to a 0-100 "how close to legendary" reading, and
// above which more of the same raw stat stops buying additional credit -- a QB with 10 rings and one
// with 6 should both read as maxed-out on THIS component; the gap between them belongs to whichever
// OTHER component still has room to differentiate them.
const CAPS = Object.freeze({
  rings: 6,               // dynasty-tier: this codebase's own "dynasty" achievement uses 4+
  accoladeScore: 60,       // weighted mvps*3 + allPros*2 + proBowls*1 -- a very decorated career
  ratingFloor: 70, ratingCeiling: 130,
  yards: 60000,
  games: 300,
  achievementCount: 85,    // the full current achievement registry size (Balance Wave 7)
  earnings: 300000000,
});

function pct(value, cap) { return clamp((value || 0) / cap, 0, 1) * 100; }

// summary shape: { rings, mvps, allPros, proBowls, peakOverall, rating, yards, td, games,
//                  achievementCount, earnings }
// Every field defaults to 0 if missing so a partial/legacy summary never throws.
export function scoreComponents(summary) {
  const s = summary || {};
  const ringsComponent = pct(s.rings, CAPS.rings);

  const accoladeRaw = (s.mvps || 0) * 3 + (s.allPros || 0) * 2 + (s.proBowls || 0) * 1;
  const accoladesComponent = pct(accoladeRaw, CAPS.accoladeScore);

  // Rate half: peakOverall is already a 0-99 scale, clamped defensively (malformed/legacy input
  // could hand this anything) rather than trusted raw. Career rating is scaled against a
  // floor/ceiling instead of used raw, since ~70 is a replacement-level career passer rating and
  // ~130 is legendary -- the same "normalize before weighting" instinct awards.js's MVP composite
  // already uses, so a rating scale change elsewhere in the codebase doesn't need this reworked.
  const peakOverallClamped = clamp(s.peakOverall || 0, 0, 99);
  const ratingScaled = clamp(((s.rating || 0) - CAPS.ratingFloor) / (CAPS.ratingCeiling - CAPS.ratingFloor), 0, 1) * 100;
  const peakAndRateComponent = (peakOverallClamped + ratingScaled) / 2;

  const careerTotalsComponent = (pct(s.yards, CAPS.yards) + pct(s.games, CAPS.games)) / 2;
  const achievementsComponent = pct(s.achievementCount, CAPS.achievementCount);
  const earningsComponent = pct(s.earnings, CAPS.earnings);

  const total =
    ringsComponent * SCORE_WEIGHTS.rings +
    accoladesComponent * SCORE_WEIGHTS.accolades +
    peakAndRateComponent * SCORE_WEIGHTS.peakAndRate +
    careerTotalsComponent * SCORE_WEIGHTS.careerTotals +
    achievementsComponent * SCORE_WEIGHTS.achievements +
    earningsComponent * SCORE_WEIGHTS.earnings;

  return {
    rings: ringsComponent, accolades: accoladesComponent, peakAndRate: peakAndRateComponent,
    careerTotals: careerTotalsComponent, achievements: achievementsComponent, earnings: earningsComponent,
    total,
  };
}

// Compares two summaries and declares a winner. A genuine exact tie (possible if both summaries are
// literally identical, e.g. comparing a match against itself) reads as "tie" rather than an
// arbitrary tiebreak -- callers can layer a head-to-head-record tiebreak on top for Same League Mode
// (MULTIPLAYER_MODE_SPEC.md section 13.5); Parallel Mode has no such record to break a tie with.
export function computeMatchScore(summaryA, summaryB) {
  const componentsA = scoreComponents(summaryA);
  const componentsB = scoreComponents(summaryB);
  let winner = "tie";
  if (componentsA.total > componentsB.total) winner = "A";
  else if (componentsB.total > componentsA.total) winner = "B";
  return { componentsA, componentsB, winner };
}
