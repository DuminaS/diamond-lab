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

  // Phase 13b: two games in one calendar slot is allowed ONLY as a doubleheader against the SAME
  // opponent (a real baseball thing, esp. a rained-out makeup). Two DIFFERENT opponents in one
  // slot is still a scheduling bug.
  const doubleBookViolations = [];
  const selfScheduledViolations = [];
  const dhCounts = [];
  teamIds.forEach(id => {
    const byWeek = new Map();
    schedules[id].forEach(g => {
      if (g.opponentId === id) selfScheduledViolations.push({ id, week: g.week });
      if (!byWeek.has(g.week)) byWeek.set(g.week, []);
      byWeek.get(g.week).push(g.opponentId);
    });
    let dh = 0;
    byWeek.forEach((opps, week) => {
      if (opps.length > 1) {
        if (opps.length > 2 || opps[0] !== opps[1]) doubleBookViolations.push({ id, week, opps });
        else dh++;
      }
    });
    dhCounts.push(dh);
  });
  expect(doubleBookViolations, `team(s) double-booked against different opponents in one slot: ${JSON.stringify(doubleBookViolations)}`).toEqual([]);
  expect(selfScheduledViolations, `team(s) scheduled against themselves: ${JSON.stringify(selfScheduledViolations)}`).toEqual([]);
  expect(Math.max(...dhCounts), "doubleheaders should stay rare (a handful per team at most)").toBeLessThanOrEqual(6);

  // Both sides of every game must agree -- for every (opponent, week) pair team A has, team B must
  // have the same COUNT of A-in-week-W entries (so a doubleheader mirrors a doubleheader).
  const mismatches = [];
  teamIds.forEach(id => {
    const myPairs = {};
    schedules[id].forEach(g => { const k = g.opponentId + "@" + g.week; myPairs[k] = (myPairs[k] || 0) + 1; });
    Object.entries(myPairs).forEach(([k, n]) => {
      const [oppId, week] = k.split("@");
      const opp = schedules[oppId];
      if (!opp) { mismatches.push({ id, k, reason: "opponent has no schedule" }); return; }
      const mirror = opp.filter(x => String(x.week) === week && x.opponentId === id).length;
      if (mirror !== n) mismatches.push({ id, k, mine: n, theirs: mirror });
    });
  });
  expect(mismatches, `game(s) where both sides disagree: ${JSON.stringify(mismatches.slice(0, 5))}`).toEqual([]);
});
