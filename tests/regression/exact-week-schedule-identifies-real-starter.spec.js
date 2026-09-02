// Wave 2B (MASTER_REMEDIATION_SPEC.md) exit criterion: "Exact-week schedule cards identify the QB
// who actually played." Before this wave, a week the named incumbent started while the player was
// a backup (career.isBackup) was tagged startedByBackup:true on career.currentSeasonSchedules[
// career.teamId] but carried no qbId/qbName at all -- the Schedule tab's own card renderer
// (weekMatchupTeamLineHTML) hardcoded `null` for the player's own side unconditionally, so it
// always looked like the player played every game, even ones he didn't. This forces a real backup
// season (a genuine incumbent, not a synthetic one, so simulateRegularSeasonGames's own
// missedGamesBackup/incumbent-week selection is exercised for real) and confirms at least one game
// on career.teamId's real per-game log is tagged with the incumbent's own id -- the exact field the
// Schedule tab and box-score modal now both read.
import { test, expect } from "@playwright/test";
import { startCareer, advanceOneSeason, readActiveCareer, writeActiveCareer } from "../helpers/careerFlow.mjs";
import { installSeededRandom } from "../helpers/seededRandom.mjs";

test("exact-week-schedule-identifies-real-starter", async ({ page }) => {
  test.setTimeout(180_000);
  await installSeededRandom(page, 90210);
  await startCareer(page);

  const saved = await readActiveCareer(page);
  const teamId = saved.career.teamId;
  // Same synthetic-incumbent pattern as backup-incumbent-double-simulation.spec.js: whether the
  // player is drafted straight into the job or lands behind a real incumbent is itself random --
  // reassign an existing, already-valid rival from elsewhere onto the player's team rather than
  // skip whenever this run's draft didn't naturally produce one.
  let incumbentId = (saved.career.leagueRivals || []).find(r => r.teamId === teamId && !r.retired)?.id;
  if (!incumbentId) {
    const other = (saved.career.leagueRivals || []).find(r => r.teamId !== teamId && !r.retired);
    test.skip(!other, "no usable rival exists anywhere in the league this run");
    other.teamId = teamId;
    incumbentId = other.id;
    // The loop below re-reads from localStorage on its very first iteration -- this reassignment
    // must actually be persisted first, or that read sees the original, un-reassigned save.
    await writeActiveCareer(page, saved);
  }

  let incumbentWeeks = [];
  let incumbentName = null;
  // The incumbent's own missed-games roll (30% chance per season, see simulatePlayerSeasonStats)
  // means a single season has a real chance of him playing every game -- try up to 8 seasons,
  // re-forcing career.isBackup with a fresh strong incumbent before each, so this test reliably
  // finds real evidence instead of skipping most of the time on an unlucky single draw.
  for (let attempt = 0; attempt < 8 && incumbentWeeks.length === 0; attempt++) {
    const current = await readActiveCareer(page);
    const incumbent = current.career.qbsById[incumbentId];
    if (!incumbent || incumbent.retired) break; // he aged out or was otherwise removed -- stop trying
    incumbent.age = 27; incumbent.retireAge = 40; incumbent.talent = Math.max(incumbent.talent, 80);
    incumbentName = incumbent.name;
    current.career.isBackup = true;
    await writeActiveCareer(page, current);
    await page.reload();
    const resumeBtn = page.locator("#resumeCareerBtn");
    if (await resumeBtn.count()) await resumeBtn.click();

    const ok = await advanceOneSeason(page);
    if (!ok) break;

    const after = await readActiveCareer(page);
    const myLog = after.career.currentSeasonSchedules && after.career.currentSeasonSchedules[teamId];
    if (myLog && myLog.length) {
      incumbentWeeks = myLog.filter(g => g.startedByBackup && g.qbId === incumbentId);
    }
  }

  expect(
    incumbentWeeks.length,
    "expected the incumbent to start at least one real game across up to 8 attempted backup seasons"
  ).toBeGreaterThan(0);
  incumbentWeeks.forEach(g => {
    expect(g.qbName, "a tagged incumbent week must also carry his name for display").toBe(incumbentName);
  });
});
