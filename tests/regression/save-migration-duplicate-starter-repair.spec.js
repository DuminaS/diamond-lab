// Wave 2A (MASTER_REMEDIATION_SPEC.md), Section 6 migration requirement #6: "Construct
// teamQbDepth... Report and repair duplicate active starters." Writes a synthetic save where two
// different rivals both claim the same team's QB1 slot (career.leagueRivals both have the same
// teamId, both retired:false -- a shape a pre-Wave-2A save could genuinely have ended up in, or
// that any future bug could reintroduce) and confirms the post-migration registry deterministically
// resolves it to exactly one QB1 owner, with the loser moved to free agency rather than left in a
// contradictory "active but unrostered" state.
import { test, expect } from "@playwright/test";
import { startCareer, readActiveCareer, writeActiveCareer } from "../helpers/careerFlow.mjs";

test("save-migration-repairs-duplicate-team-starter", async ({ page }) => {
  await startCareer(page);

  const saved = await readActiveCareer(page);
  const rivals = saved.career.leagueRivals || [];
  test.skip(rivals.length < 2, "not enough rivals generated this run to force a duplicate");

  const [a, b] = rivals;
  const sharedTeamId = a.teamId;
  b.teamId = sharedTeamId; // force the corruption: two different rival ids, same team, both active
  b.retired = false;
  await writeActiveCareer(page, saved);
  await page.reload();
  const resumeBtn = page.locator("#resumeCareerBtn");
  if (await resumeBtn.count()) await resumeBtn.click();
  await page.waitForTimeout(200);

  const migrated = await readActiveCareer(page);
  const depth = migrated.career.teamQbDepth[sharedTeamId];
  expect(depth, "the shared team must have a teamQbDepth entry after migration").toBeTruthy();
  expect([a.id, b.id]).toContain(depth.QB1);

  const loserId = depth.QB1 === a.id ? b.id : a.id;
  expect(
    (migrated.career.freeAgentQbIds || []).includes(loserId),
    `the losing duplicate (${loserId}) must be moved to free agency, not left dangling as an unrostered "active" QB`
  ).toBe(true);

  const issues = await page.evaluate(() => (window.__glValidateLeagueState ? window.__glValidateLeagueState() : null));
  const duplicateIssues = (issues || []).filter(i => i.type === "duplicate-qb1");
  expect(duplicateIssues, `validator must report zero duplicate-QB1 issues after migration repair: ${JSON.stringify(duplicateIssues)}`).toEqual([]);
});
