// Wave 2A (MASTER_REMEDIATION_SPEC.md), Section 3 invariants #1/#5: every active franchise has one
// QB1, and no two teams' QB1 slot points at the same id. Exercises the canonical
// career.teamQbDepth registry (not just what's visually rendered) across a real multi-season
// sweep, via the narrow, read-only window.__glValidateLeagueState() test hook -- a UI element
// existing is not proof the underlying ownership model is correct (Section 3's own rule), so this
// checks the registry's own state, not a rendered table.
import { test, expect } from "@playwright/test";
import { startCareer, advanceOneSeason, readActiveCareer } from "../helpers/careerFlow.mjs";
import { installSeededRandom } from "../helpers/seededRandom.mjs";

test("one-active-qb1-per-team", async ({ page }) => {
  test.setTimeout(180_000);
  await installSeededRandom(page, 8675309);
  await startCareer(page);

  const allIssues = [];
  for (let season = 0; season < 12; season++) {
    const stillActive = await page.evaluate(() => !!localStorage.getItem("diamondlab.activeCareer"));
    if (!stillActive) break;
    const ok = await advanceOneSeason(page);
    const saved = await readActiveCareer(page);
    const issues = await page.evaluate(() => (window.__glValidateLeagueState ? window.__glValidateLeagueState() : null));
    expect(issues, "window.__glValidateLeagueState() must be reachable in this build").not.toBeNull();
    const relevant = (issues || []).filter(i => i.type === "duplicate-qb1" || i.type === "duplicate-roster-slot");
    if (relevant.length) allIssues.push({ season, year: saved?.career?.year, relevant });
    if (!ok) break;
  }

  expect(
    allIssues,
    `found team-ownership duplicates across the sweep: ${JSON.stringify(allIssues.slice(0, 5))}`
  ).toEqual([]);
});
