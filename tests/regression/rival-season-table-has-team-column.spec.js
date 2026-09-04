// Phase 13a: rival hitters now change teams in free agency (1976+), and a rival's profile shows a
// Team column in his season-by-season table so a multi-team career is visible. This walks a real
// modern-era career, then confirms (a) the Team column exists and is populated, and (b) at least
// one tracked hitter has played for 2+ franchises.
import { test, expect } from "@playwright/test";
import { startCareer, advanceSeasons, readActiveCareer } from "../helpers/careerFlow.mjs";
import { installSeededRandom } from "../helpers/seededRandom.mjs";

test("rival profile season table has a Team column; hitters change teams in FA", async ({ page }) => {
  test.setTimeout(300_000);
  await installSeededRandom(page, 55221);
  await startCareer(page, { decadeIndex: 4 });
  await advanceSeasons(page, 18);

  const saved = await readActiveCareer(page);
  test.skip(!saved, "career ended before the sweep completed");

  const everyone = [...(saved.career.leagueRivals || []), ...Object.values(saved.career.qbsById || {})];
  const seen = new Set();
  let movers = 0;
  let anyWithSeasons = null;
  for (const r of everyone) {
    if (!r || seen.has(r.id) || !Array.isArray(r.seasons)) continue;
    seen.add(r.id);
    const teams = new Set(r.seasons.map(s => s.teamId).filter(Boolean));
    if (teams.size >= 2) movers++;
    if (r.seasons.length >= 3 && !anyWithSeasons) anyWithSeasons = r;
  }
  expect(movers, "at least one tracked hitter should have changed teams over 18 modern seasons").toBeGreaterThan(0);

  // Open one rival profile and confirm the Team column renders with a real team name.
  expect(anyWithSeasons).toBeTruthy();
  await page.evaluate(() => document.querySelector('.dash-tab[data-tab="league"]')?.click());
  await page.waitForTimeout(150);
  await page.evaluate((id) => {
    const link = document.querySelector(`[data-rival-id="${id}"]`);
    if (link) link.click();
  }, anyWithSeasons.id);
  await page.waitForTimeout(200);
  const tbl = await page.evaluate(() => {
    const o = document.getElementById("rivalProfileOverlay");
    const t = [...o.querySelectorAll("table")].find(x => (x.querySelector("thead")?.textContent || "").includes("Team"));
    if (!t) return null;
    const headers = [...t.querySelectorAll("thead th")].map(h => h.textContent.trim());
    const firstRow = [...t.querySelectorAll("tbody tr")][0];
    const cells = firstRow ? [...firstRow.querySelectorAll("td")].map(c => c.textContent.trim()) : [];
    return { headers, teamCell: cells[2] };
  });
  expect(tbl, "rival season table with a Team column").toBeTruthy();
  expect(tbl.headers.slice(0, 3)).toEqual(["Year", "Age", "Team"]);
  expect(tbl.teamCell && tbl.teamCell.length, "the Team cell is populated").toBeGreaterThan(0);
});
