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
// above which more of the same raw stat stops buying additional credit -- a hitter with 6 World
// Series rings and one with 4 should both read as maxed-out on THIS component; the gap between them
// belongs to whichever OTHER component still has room to differentiate them.
const CAPS = Object.freeze({
  rings: 5,                // dynasty-tier: this codebase's own "dynasty" achievement uses 4+ WS titles
  accoladeScore: 70,       // weighted mvps*4 + allPros(Silver Slugger)*2 + proBowls(All-Star)*0.8
  ratingFloor: 90, ratingCeiling: 155,   // career OPS+: ~90 = a below-average bat, ~155 = inner-circle
  yards: 6000,             // career total bases -- an all-time great lands ~5500-6500
  games: 2800,             // ~17 full seasons
  achievementCount: 92,    // the full current achievement registry size
  earnings: 500000000,
});

function pct(value, cap) { return clamp((value || 0) / cap, 0, 1) * 100; }

// summary shape: { rings, mvps, allPros, proBowls, peakOverall, rating, yards, td, games,
//                  achievementCount, earnings } -- for baseball: rings = World Series titles,
//   allPros = Silver Sluggers, proBowls = All-Star nods, rating = career OPS+, yards = total
//   bases, td = home runs.
// Every field defaults to 0 if missing so a partial/legacy summary never throws.
export function scoreComponents(summary) {
  const s = summary || {};
  const ringsComponent = pct(s.rings, CAPS.rings);

  // mvps = MVPs, allPros = Silver Sluggers + All-MLB, proBowls = All-Star selections.
  const accoladeRaw = (s.mvps || 0) * 4 + (s.allPros || 0) * 2 + (s.proBowls || 0) * 0.8;
  const accoladesComponent = pct(accoladeRaw, CAPS.accoladeScore);

  // Rate half: peakOverall is a 0-99 hitter-overall, clamped defensively. Career rating is a
  // career OPS+ index scaled against a floor/ceiling rather than used raw (100 is a league-
  // average bat, so ~90 is a real everyday-regular career and ~155 is an inner-circle one).
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
