// Pure award-scoring model shared by the browser game and any headless test/audit. Keep this
// module free of DOM and career-state access -- main.js's evaluateSeasonAwards supplies the raw
// season inputs (rating/td/winPct/attempts/gamesPlayed/teamOverall) and calls straight into here.
//
// Balance Wave 5 (difficulty/balance remediation brief item 4): "MVP scoring combines rating,
// touchdowns, and raw win percentage. Because the player's roster and production rise together,
// all three inputs reinforce the same dynasty." Pro Bowl/All-Pro/MVP all used a raw `winPct-0.5`
// term -- a QB whose OWN talent had already (pre-Wave-1) inflated his team's other four grades
// would win MORE games for reasons that had nothing to do with that season's individual case, and
// the award formula rewarded exactly that. winsAboveExpectation replaces it everywhere: how much a
// team actually outperformed what its OWN preseason quality predicted, so "10-7 on a 55-grade
// roster" can outscore "12-5 on a 92-grade roster" the way the brief explicitly asks for. Pro Bowl/
// All-Pro keep their existing efficiency/volume weight shapes (a targeted swap, not a redesign);
// MVP is rebuilt as the brief's own explicit 45% efficiency / 20% volume / 20% wins-above-
// expectation / 10% availability / 5% narrative-clutch composite.

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

// A team's preseason-quality-implied win rate -- the same "team grade vs a neutral 65" shape
// simpleWinProb already uses for a single game, scaled up for a full-season aggregate. 65 is this
// codebase's own established "neutral" team-overall baseline (see TEAM_OVERALL_WEIGHTS/
// neutralEffective elsewhere) -- not a dynamically computed league average, so a randomly weak or
// strong league-wide year doesn't itself change what "expected" means for a given team grade.
export function expectedWinPctForTeamOverall(teamOverall) {
  const overall = Number.isFinite(teamOverall) ? teamOverall : 65;
  return clamp(0.5 + (overall - 65) * 0.011, 0.15, 0.85);
}

export function winsAboveExpectation(winPct, teamOverall) {
  return clamp(winPct - expectedWinPctForTeamOverall(teamOverall), -0.5, 0.5);
}

// MVP_SCALE is chosen so a genuinely elite, deep MVP case (top-tier efficiency, real volume,
// meaningfully outperforming a mediocre team, full availability, an outright winning record) lands
// in roughly the same numeric neighborhood the old formula's own MVP-caliber scores did (~20-30) --
// this is a comparative selection (resolveSeasonMVP picks the single highest score league-wide), so
// the absolute scale doesn't change WHO wins, only keeps the number legible next to its own history
// in the UI/admin calculator.
const MVP_SCALE = 16;

export function evaluateSeasonAwardScores({ ratingEdge, td, winPct, teamOverall, gamesPlayedShare }) {
  const wae = winsAboveExpectation(winPct, teamOverall);

  // Pro Bowl/All-Pro: same shapes as before, `winPct-0.5` swapped for `wae` in place -- both are
  // centered-on-zero fractions in the same +/-0.5 range, so the existing coefficients (10/18) still
  // mean the same thing: how many points a fully-earned (or fully-unearned) win swing is worth.
  const proBowlScore = ratingEdge * 0.6 + Math.max(0, td - 16) * 0.45 + wae * 10;
  const allProScore = ratingEdge * 0.75 + Math.max(0, td - 22) * 0.55 + wae * 18;

  // MVP: the brief's own explicit five-bucket composite. Each component is normalized to a
  // roughly comparable +/-2 range before weighting, so the 45/20/20/10/5 split actually reflects
  // relative importance instead of being swamped by whichever raw input happens to have the
  // largest natural magnitude.
  const efficiencyComponent = clamp(ratingEdge / 15, -2, 2);
  // Volume centers on 20 TD (a real, productive full season, but well short of an outlier year) --
  // unlike the old Pro Bowl/All-Pro formulas' one-sided `max(0, td-N)`, this can go negative too,
  // since a genuine MVP case has never come from a low-volume season no matter how efficient.
  const volumeComponent = clamp((td - 20) / 8, -2, 2);
  const winsComponent = clamp(wae * 8, -2, 2);
  // Rewards clearing the ~85% availability bar MVP eligibility already assumes; doesn't reward
  // barely-more-than-that as heavily as missing significant time punishes it (capped at +1 vs -2).
  const availabilityComponent = clamp((gamesPlayedShare - 0.85) * 4, -2, 1);
  // A distinct signal from winsComponent on purpose: an outright winning record, independent of
  // whether that record was "expected" -- real MVP voting does care that a player's team actually
  // won, not only that it overperformed a modest expectation.
  const narrativeComponent = clamp((winPct - 0.5) * 3, -1.5, 1.5);

  const mvpComposite = efficiencyComponent * 0.45 + volumeComponent * 0.20
    + winsComponent * 0.20 + availabilityComponent * 0.10 + narrativeComponent * 0.05;
  const mvpScore = mvpComposite * MVP_SCALE;

  return {
    proBowlScore, allProScore, mvpScore, winsAboveExpectation: wae,
    mvpComponents: { efficiencyComponent, volumeComponent, winsComponent, availabilityComponent, narrativeComponent, mvpComposite },
  };
}
