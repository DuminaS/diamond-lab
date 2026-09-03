// Pure rating and draft-order calculations shared by the browser game and the
// headless balance audit. Keep this module free of DOM and career-state access.

// What actually predicts a hitter's value: getting on base and driving the ball. Power and
// contact and plate discipline carry the load; approach and pitch recognition feed them; bat
// speed, speed, baserunning and (fielding) arm are real but secondary; durability is excluded
// (it gates how much of a career happens, not how good a season is). Sums to 1.0.
export const HITTER_OVERALL_WEIGHTS = Object.freeze({
  DAC: 0.16,
  SHA: 0.15,
  PKT: 0.15,
  DEC: 0.12,
  ANT: 0.12,
  TCH: 0.09,
  CLU: 0.06,
  REL: 0.06,
  MOB: 0.05,
  IMP: 0.03,
  ARM: 0.01,
});
// Back-compat alias -- main.js still imports the old name until the rename pass.
export const FOOTBALL_OVERALL_WEIGHTS = HITTER_OVERALL_WEIGHTS;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export function weightedRating(values, weights = HITTER_OVERALL_WEIGHTS) {
  let total = 0;
  let weightTotal = 0;
  for (const [key, weight] of Object.entries(weights)) {
    total += Number(values?.[key] ?? 0) * weight;
    weightTotal += weight;
  }
  return weightTotal > 0 ? total / weightTotal : 0;
}

export function hitterOverall(values) {
  return weightedRating(values, HITTER_OVERALL_WEIGHTS);
}
// Back-compat alias.
export const footballOverall = hitterOverall;

// The Combine grade intentionally measures completeness. Football OVR is kept
// alongside it because the career engine values the attributes unequally. These
// are two useful but different scouting facts and must not be presented as if
// they were the same rating.
export function evaluateProspect(picks) {
  const values = picks.map(pick => Number(pick.value));
  const average = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + (value - average) ** 2, 0) / values.length;
  const standardDeviation = Math.sqrt(variance);
  const balancePenalty = standardDeviation * 0.55;
  const floorBonus = Math.min(...values) >= 85 ? 2 : 0;
  const build = Object.fromEntries(picks.map(pick => [pick.key, Number(pick.value)]));
  const score = Math.round(clamp(average - balancePenalty + floorBonus, 0, 98));

  return {
    score,
    footballOverall: Math.round(footballOverall(build)),
    footballOverallExact: footballOverall(build),
    avg: Math.round(average * 10) / 10,
    std: Math.round(standardDeviation * 10) / 10,
    balancePenalty: Math.round(balancePenalty * 10) / 10,
    floorBonus,
  };
}

// Draft order now has a real relationship to team quality. Pick 1 maps near
// the bottom of the league and the last pick of a round maps near the top, with
// a small rank jitter representing traded picks and imperfect draft order.
// Later rounds repeat the order. UDFAs may sign anywhere.
export function chooseDraftTeam(teams, leagueStrength, slot, overallPick, random = Math.random) {
  if (!teams.length) return null;
  if (!slot || slot.round === 0 || !Number.isFinite(overallPick)) {
    return teams[Math.floor(random() * teams.length)];
  }

  const ordered = [...teams].sort((a, b) => {
    const strengthDelta = Number(leagueStrength[a.id] ?? 60) - Number(leagueStrength[b.id] ?? 60);
    return strengthDelta || String(a.id).localeCompare(String(b.id));
  });
  const leaguePick = ((Math.max(1, overallPick) - 1) % 32) + 1;
  const expectedIndex = Math.round(((leaguePick - 1) / 31) * (ordered.length - 1));
  const jitter = Math.floor(random() * 5) - 2;
  return ordered[clamp(expectedIndex + jitter, 0, ordered.length - 1)];
}
