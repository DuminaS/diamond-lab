// Wave 2B (MASTER_REMEDIATION_SPEC.md), Section 8 scenario #8 / required design: "A healthy QB3
// who is clearly the best QB becomes QB1." Before this wave, evaluateSuccession()'s promotion
// checks only ever examined qb2 -- a superior qb3 could never win the job directly, no matter how
// large the talent gap (Section 4's named defect). Forces a team's real QB3 to be dramatically
// better than both the current QB1 and QB2, advances one season, and confirms the depth chart
// reordered to make him QB1 -- deterministically (no promotion-roll dependency): the effective-
// value gap forced here (60+ points) is far past the spec's 3-point promotion threshold, so this
// should succeed on every seed, not just some.
import { test, expect } from "@playwright/test";
import { startCareer, advanceOneSeason, readActiveCareer, writeActiveCareer } from "../helpers/careerFlow.mjs";
import { installSeededRandom } from "../helpers/seededRandom.mjs";

test("best-of-qb1-qb2-qb3-starts", async ({ page }) => {
  await installSeededRandom(page, 31337);
  await startCareer(page);

  const saved = await readActiveCareer(page);
  const teamId = (saved.career.leagueRivals || []).find(r => r.teamId !== saved.career.teamId)?.teamId;
  test.skip(!teamId, "no other team exists to exercise this on");

  const rival = saved.career.leagueRivals.find(r => r.teamId === teamId && !r.retired);
  const chart = (saved.career.leagueDepthCharts || {})[teamId];
  test.skip(!rival || !chart || !chart.qb3, "no real QB1/QB3 pair exists for this team this run");

  // Force a dramatic, unambiguous gap: QB1 and QB2 mediocre and aging, QB3 young and elite.
  rival.talent = 55; rival.age = 34;
  if (chart.qb2) { chart.qb2.talent = 50; chart.qb2.age = 33; }
  chart.qb3.talent = 99; chart.qb3.age = 26; chart.qb3.retired = false;
  const qb3Id = chart.qb3.id;

  await writeActiveCareer(page, saved);
  await page.reload();
  const resumeBtn = page.locator("#resumeCareerBtn");
  if (await resumeBtn.count()) await resumeBtn.click();

  await advanceOneSeason(page);

  const after = await readActiveCareer(page);
  const depth = after.career.teamQbDepth && after.career.teamQbDepth[teamId];
  expect(depth, "the team must still have a teamQbDepth entry").toBeTruthy();
  expect(
    depth.QB1,
    `expected the clearly-superior former QB3 (${qb3Id}) to become QB1; found ${depth.QB1} instead`
  ).toBe(qb3Id);

  const promoted = after.career.qbsById[qb3Id];
  expect(promoted.rosterRole).toBe("QB1");
  expect(promoted.retired).toBe(false);
});
