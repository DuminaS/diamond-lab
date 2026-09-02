// Confirmed live against HEAD (67b425c): buildAllTimeLeaderboardRows() only iterates
// career.leagueRivals -- it never reads career.leagueDepthCharts (where QB2/QB3 bench players
// live). A bench player who has actually played real relief games (totals.games > 0, via
// applyStatLineToGames/reconcileWinLossFromGames) is therefore permanently invisible to the
// All-Time table. This directly tests the product intent statement: "Every quarterback who plays
// at least one real game remains visible in league history and the All-Time table."
import { test, expect } from "@playwright/test";
import { startCareer, readActiveCareer, writeActiveCareer } from "../helpers/careerFlow.mjs";

test("played-bench-qb-survives-retirement-and-appears-all-time", async ({ page }) => {
  await startCareer(page);

  const saved = await readActiveCareer(page);
  const teamId = saved.career.teamId;
  const chart = (saved.career.leagueDepthCharts || {})[teamId];
  test.skip(!chart || !chart.qb2, "no depth chart exists for the player's own team this run");

  // Give QB2 a real, played season -- exactly the state applyStatLineToGames/
  // reconcileWinLossFromGames produce for a bench QB who took real relief snaps.
  const benchName = "Regression Bench Tester";
  chart.qb2.name = benchName;
  chart.qb2.totals = { ...chart.qb2.totals, games: 4, comp: 60, att: 100, yards: 700, td: 4, int: 3, wins: 2, losses: 2 };
  await writeActiveCareer(page, saved);
  await page.reload();
  const resumeBtn = page.locator("#resumeCareerBtn");
  if (await resumeBtn.count()) await resumeBtn.click();

  await page.evaluate(() => { document.querySelector('.dash-tab[data-tab="league"]')?.click(); });
  await page.waitForTimeout(150);
  await page.evaluate(() => { document.querySelector('[data-league-subtab="alltime"]')?.click(); });
  await page.waitForTimeout(150);

  const panelText = await page.evaluate(() => document.querySelector('[data-league-panel="alltime"]')?.textContent || "");
  expect(
    panelText.includes(benchName),
    `expected the played bench QB "${benchName}" to appear in the All-Time table; panel text did not contain the name`
  ).toBeTruthy();
});
