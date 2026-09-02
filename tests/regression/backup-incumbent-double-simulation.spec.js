// Wave 2B (MASTER_REMEDIATION_SPEC.md) fixed the confirmed defect this test targets: before that
// wave, resolveBackupSeasonSnaps() called simulatePlayerSeasonStats(incumbent, ...) directly
// (pushing one season row onto incumbent.seasons and incrementing his totals/age), then later in
// the SAME generateSeason() call, simulateRivalSeasons() processed every non-retired rival --
// including this same incumbent, who is deliberately NOT excluded (PROGRESS.md Round 7: "so he can
// retire naturally and open the job") -- calling simulatePlayerSeasonStats() on him again for the
// SAME year. Fixed at the root: resolveBackupSeasonSnaps now only PLANS his usage (career.
// _backupUsagePlan); simulateRivalSeasons is the one place he's ever actually simulated, using that
// plan's game count as forcedGames. This test forces career.isBackup=true on a real, drafted
// career, advances exactly one season, and asserts the incumbent has exactly one season row for
// that year (Section 3, invariant #6: no more than one (qbId, year) season record) -- a permanent
// regression guard against this exact defect reappearing.
import { test, expect } from "@playwright/test";
import { startCareer, advanceOneSeason, readActiveCareer, writeActiveCareer } from "../helpers/careerFlow.mjs";
import { installSeededRandom } from "../helpers/seededRandom.mjs";

test("backup-incumbent-simulates-once-per-year", async ({ page }) => {
  await installSeededRandom(page, 4242);
  await startCareer(page);

  const before = await readActiveCareer(page);
  const teamId = before.career.teamId;
  // Whether the player is drafted straight into the starting job (no incumbent at all) or lands
  // behind one is itself random -- rather than skip the test whenever this run didn't naturally
  // produce an incumbent, reassign an existing, already-fully-valid rival from another team onto
  // the player's own team. isBackup/resolveBackupSeasonSnaps only care that rivalForTeam(teamId)
  // resolves to a real, non-retired entity -- not how it got there.
  let incumbent = (before.career.leagueRivals || []).find(r => r.teamId === teamId && !r.retired);
  if (!incumbent) {
    incumbent = (before.career.leagueRivals || []).find(r => r.teamId !== teamId && !r.retired);
    test.skip(!incumbent, "no usable rival exists anywhere in the league this run");
    incumbent.teamId = teamId;
  }
  // simulateRivalSeasons() retires (rather than re-simulates) anyone past their own retireAge --
  // pin the incumbent safely young so THIS test is only ever exercising the double-simulation
  // path, not incidentally hitting the natural-retirement branch depending on what the seed
  // happened to roll for age/retireAge.
  incumbent.age = 25;
  incumbent.retireAge = 40;

  before.career.isBackup = true;
  await writeActiveCareer(page, before);
  await page.reload();
  const resumeBtn = page.locator("#resumeCareerBtn");
  if (await resumeBtn.count()) await resumeBtn.click();

  // NOTE: before.career.year is the year of the season already simulated BEFORE isBackup was
  // forced on -- the double-simulation only happens in the season simulated WHILE isBackup is
  // active, i.e. whatever year generateSeason() lands on inside advanceOneSeason() below. Asserting
  // against the wrong (already-complete, pre-existing) year was a real false-negative caught while
  // writing this test -- always read the year AFTER advancing, not before.
  await advanceOneSeason(page);

  const after = await readActiveCareer(page);
  // Wave 2B: look him up via the canonical registry, not by scanning career.leagueRivals -- winning
  // the backup competition this same season (resolveBackupCompetition) now correctly moves the
  // incumbent to a bench slot or free agency instead of leaving him a phantom parallel starter (see
  // two-active-starters-after-backup-win.spec.js), so he may legitimately no longer be IN
  // leagueRivals by the time this reads back, even though he still very much exists.
  const incumbentAfter = after.career.qbsById && after.career.qbsById[incumbent.id];
  expect(incumbentAfter, "the incumbent must still exist after the season advances").toBeTruthy();

  const simulatedYear = after.career.year;
  const seasonsForYear = (incumbentAfter.seasons || []).filter(s => s.year === simulatedYear);
  expect(seasonsForYear.length, `expected exactly one season row for ${simulatedYear}, found ${seasonsForYear.length}: ${JSON.stringify(seasonsForYear)}`).toBe(1);
});
