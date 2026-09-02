// Wave 2B (MASTER_REMEDIATION_SPEC.md) fixed the confirmed defect this test targets: before that
// wave, resolveBackupCompetition() only flipped career.isBackup=false when the player won the job
// -- it never retired, demoted, or reassigned the incumbent still sitting in career.leagueRivals at
// the SAME teamId (reassignRivalsForTeamChange, the fix for the analogous "two starters, one team"
// bug on a trade/sign, is never called here, since the player's teamId never changes when they win
// a backup competition on their own team). Fixed by moving the incumbent to whichever bench slot he
// actually upgrades (or free agency if neither) the moment the player wins the job, via the Wave 2A
// ownership helpers. This asserts Section 3 invariant #5 (no two active QB1 records point to the
// same team) the instant the player wins the job -- a permanent regression guard.
import { test, expect } from "@playwright/test";
import { startCareer, advanceOneSeason, readActiveCareer, writeActiveCareer } from "../helpers/careerFlow.mjs";
import { installSeededRandom } from "../helpers/seededRandom.mjs";

test("winning-user-job-demotes-or-moves-incumbent", async ({ page }) => {
  await installSeededRandom(page, 777);
  await startCareer(page);

  const before = await readActiveCareer(page);
  const teamId = before.career.teamId;
  // See backup-incumbent-double-simulation.spec.js for why a natural incumbent isn't relied on --
  // reassign an existing, already-valid rival onto the player's team instead of skipping whenever
  // this run's random draft happened to hand the player the job outright.
  let incumbent = (before.career.leagueRivals || []).find(r => r.teamId === teamId && !r.retired);
  if (!incumbent) {
    incumbent = (before.career.leagueRivals || []).find(r => r.teamId !== teamId && !r.retired);
    test.skip(!incumbent, "no usable rival exists anywhere in the league this run");
    incumbent.teamId = teamId;
  }
  incumbent.age = 25;
  incumbent.retireAge = 40;

  before.career.isBackup = true;
  // Force the deterministic "3rd bench season" resolution branch in resolveBackupCompetition,
  // which guarantees wonJob=true regardless of the talent-gap coinflip -- this test is about what
  // happens ONCE the job is won, not about the odds of winning it.
  before.career._backupSeasonsCount = 2;
  await writeActiveCareer(page, before);
  await page.reload();
  const resumeBtn = page.locator("#resumeCareerBtn");
  if (await resumeBtn.count()) await resumeBtn.click();

  await advanceOneSeason(page);

  const after = await readActiveCareer(page);
  expect(after.career.isBackup, "the player should have won the starting job this season").toBe(false);

  const stillActiveIncumbent = (after.career.leagueRivals || []).find(
    r => r.id === incumbent.id && r.teamId === after.career.teamId && !r.retired
  );
  expect(
    stillActiveIncumbent,
    "the old incumbent must be retired or reassigned once the player wins the job on the same team -- found them still active at the same team"
  ).toBeFalsy();
});
