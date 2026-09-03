// Wave 2A (MASTER_REMEDIATION_SPEC.md), Section 3 invariant #3: a QB marked free_agent (or
// retired) cannot simultaneously be an eligible QB1/QB2/QB3. Before this wave, enterFreeAgentPool
// set retired=true AND pushed into career.freeAgentPool while the SAME object reference could still
// be sitting in a team's leagueRivals/leagueDepthCharts slot for one more tick in some paths --
// this checks the canonical registry directly (career.teamQbDepth vs. career.freeAgentQbIds/
// retiredQbIds) across a real multi-season sweep, not just a single snapshot.
import { test, expect } from "@playwright/test";
import { startCareer, advanceOneSeason, readActiveCareer } from "../helpers/careerFlow.mjs";
import { installSeededRandom } from "../helpers/seededRandom.mjs";

test("free-agent-qb-has-no-active-roster-slot", async ({ page }) => {
  test.setTimeout(180_000);
  await installSeededRandom(page, 24601);
  await startCareer(page);

  const violations = [];
  for (let season = 0; season < 12; season++) {
    const stillActive = await page.evaluate(() => !!localStorage.getItem("diamondlab.activeCareer"));
    if (!stillActive) break;
    const ok = await advanceOneSeason(page);
    const saved = await readActiveCareer(page);
    const c = saved && saved.career;
    if (c && c.teamQbDepth && (c.freeAgentQbIds || c.retiredQbIds)) {
      const rosteredIds = new Set();
      Object.values(c.teamQbDepth).forEach(slots => {
        ["QB1", "QB2", "QB3"].forEach(role => { if (slots[role]) rosteredIds.add(slots[role]); });
      });
      (c.freeAgentQbIds || []).forEach(id => { if (rosteredIds.has(id)) violations.push({ season, year: c.year, id, type: "free-agent-still-rostered" }); });
      (c.retiredQbIds || []).forEach(id => { if (rosteredIds.has(id)) violations.push({ season, year: c.year, id, type: "retired-still-rostered" }); });
      // A free agent and a retiree are mutually exclusive statuses too.
      (c.freeAgentQbIds || []).forEach(id => { if ((c.retiredQbIds || []).includes(id)) violations.push({ season, year: c.year, id, type: "free-agent-and-retired" }); });
    }
    if (!ok) break;
  }

  expect(
    violations,
    `found QBs simultaneously rostered and free-agent/retired: ${JSON.stringify(violations.slice(0, 5))}`
  ).toEqual([]);
});
