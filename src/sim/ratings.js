// Pure rating and draft-order calculations shared by the browser game and the
// headless balance audit. Keep this module free of DOM and career-state access.

export const FOOTBALL_OVERALL_WEIGHTS = Object.freeze({
  SHA: 0.16,
  TCH: 0.12,
  DAC: 0.12,
  PKT: 0.12,
  ANT: 0.14,
  DEC: 0.14,
  CLU: 0.10,
  ARM: 0.06,
  REL: 0.02,
  MOB: 0.01,
  IMP: 0.01,
});

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export function weightedRating(values, weights = FOOTBALL_OVERALL_WEIGHTS) {
  let total = 0;
  let weightTotal = 0;
  for (const [key, weight] of Object.entries(weights)) {
    total += Number(values?.[key] ?? 0) * weight;
    weightTotal += weight;
  }
  return weightTotal > 0 ? total / weightTotal : 0;
}

export function footballOverall(values) {
  return weightedRating(values, FOOTBALL_OVERALL_WEIGHTS);
}

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
