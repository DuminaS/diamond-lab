// career.currentSeasonSchedules is the shared, per-team schedule every OTHER team's standings
// result and the player's own week-by-week board both read from (buildScheduleResults,
// scheduleGamesIntoWeeks). The project's own PROGRESS.md documents a known, "rare" odd-team-count
// repair-pass shortfall -- described as graceful, never proven. This test proves the actual
// schedule produced for a real seeded career: every team gets the same game count as the league's
// own mode (allowing at most one team short, the documented edge case), no team is scheduled twice
// in the same week, and no team is scheduled against itself.
import { test, expect } from "@playwright/test";
import { startCareer, readActiveCareer } from "../helpers/careerFlow.mjs";
import { installSeededRandom } from "../helpers/seededRandom.mjs";

test("every-active-team-completes-era-game-count", async ({ page }) => {
  await installSeededRandom(page, 13);
  await startCareer(page);

  const saved = await readActiveCareer(page);
  const schedules = saved.career.currentSeasonSchedules || {};
  const teamIds = Object.keys(schedules);
  expect(teamIds.length, "expected a real per-team schedule to exist after the first season").toBeGreaterThan(0);

  const counts = teamIds.map(id => schedules[id].length);
  const mode = counts
    .reduce((freq, c) => (freq.set(c, (freq.get(c) || 0) + 1), freq), new Map());
  const expectedGames = [...mode.entries()].sort((a, b) => b[1] - a[1])[0][0];

  const shortTeams = teamIds.filter(id => schedules[id].length < expectedGames - 1);
  expect(shortTeams, `team(s) fell more than one game short of the league's own game count (${expectedGames}): ${JSON.stringify(shortTeams)}`).toEqual([]);

  const overScheduled = teamIds.filter(id => schedules[id].length > expectedGames);
  expect(overScheduled, `team(s) exceeded the league's own game count (${expectedGames}): ${JSON.stringify(overScheduled)}`).toEqual([]);

  const duplicateWeekViolations = [];
  const selfScheduledViolations = [];
  teamIds.forEach(id => {
    const weeks = new Set();
    schedules[id].forEach(g => {
      if (weeks.has(g.week)) duplicateWeekViolations.push({ id, week: g.week });
      weeks.add(g.week);
      if (g.opponentId === id) selfScheduledViolations.push({ id, week: g.week });
    });
  });
  expect(duplicateWeekViolations, `team(s) scheduled twice in the same week: ${JSON.stringify(duplicateWeekViolations)}`).toEqual([]);
  expect(selfScheduledViolations, `team(s) scheduled against themselves: ${JSON.stringify(selfScheduledViolations)}`).toEqual([]);

  // Both sides of every game must agree on the game having happened -- team A's opponent-B-in-
  // week-W entry must be mirrored by team B's opponent-A-in-week-W entry (Section 3 invariant #9).
  const mismatches = [];
  teamIds.forEach(id => {
    schedules[id].forEach(g => {
      const opp = schedules[g.opponentId];
      if (!opp) { mismatches.push({ id, week: g.week, reason: "opponent has no schedule at all" }); return; }
      const mirror = opp.find(x => x.week === g.week && x.opponentId === id);
      if (!mirror) mismatches.push({ id, week: g.week, reason: "opponent has no matching entry for this week" });
    });
  });
  expect(mismatches, `game(s) where both sides disagree on having played: ${JSON.stringify(mismatches.slice(0, 5))}`).toEqual([]);
});
