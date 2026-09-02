// Wave 2A (MASTER_REMEDIATION_SPEC.md), Section 6 migration requirement #3: "Copy every QB2/QB3
// from career.leagueDepthCharts. Do not discard a duplicate ID; detect and resolve duplicate
// references deterministically." Writes a synthetic save where a bench QB currently sitting in a
// live depth-chart slot is ALSO pushed into career.freeAgentPool at the same time (the exact
// dual-membership shape the pre-Wave-2A enterFreeAgentPool/promoteQb2 could produce) and confirms
// migration resolves it to exactly one status -- free agency wins (Section 4: "do not represent
// free agency by setting retired = true without a distinct status") -- never left rostered AND
// free-agent at once.
import { test, expect } from "@playwright/test";
import { startCareer, readActiveCareer, writeActiveCareer } from "../helpers/careerFlow.mjs";

test("save-migration-resolves-depth-player-also-in-free-agent-pool", async ({ page }) => {
  await startCareer(page);

  const saved = await readActiveCareer(page);
  const teamId = saved.career.teamId;
  const chart = (saved.career.leagueDepthCharts || {})[teamId];
  test.skip(!chart || !chart.qb2, "no depth chart exists for the player's own team this run");

  const dual = chart.qb2;
  saved.career.freeAgentPool = [...(saved.career.freeAgentPool || []), dual];
  await writeActiveCareer(page, saved);
  await page.reload();
  const resumeBtn = page.locator("#resumeCareerBtn");
  if (await resumeBtn.count()) await resumeBtn.click();
  await page.waitForTimeout(200);

  const migrated = await readActiveCareer(page);
  const registered = migrated.career.qbsById[dual.id];
  expect(registered, "the dual-listed QB must still be registered by id after migration").toBeTruthy();
  expect(registered.status).toBe("free_agent");

  const stillRostered = Object.values(migrated.career.teamQbDepth || {}).some(slots =>
    slots.QB1 === dual.id || slots.QB2 === dual.id || slots.QB3 === dual.id
  );
  expect(stillRostered, "a free-agent QB must not also occupy a roster slot after migration").toBe(false);
  expect((migrated.career.freeAgentQbIds || []).includes(dual.id)).toBe(true);

  const issues = await page.evaluate(() => (window.__glValidateLeagueState ? window.__glValidateLeagueState() : null));
  const relevant = (issues || []).filter(i => i.qbId === dual.id);
  expect(relevant, `validator must report zero issues for the repaired QB: ${JSON.stringify(relevant)}`).toEqual([]);
});
