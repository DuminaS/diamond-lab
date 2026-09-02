import { test, expect } from "@playwright/test";
import { clickThroughToSeasonCard, readActiveCareer } from "../helpers/careerFlow.mjs";
import { installSeededRandom } from "../helpers/seededRandom.mjs";

test("combine exposes football OVR and draft order influences destination", async ({ page }) => {
  await installSeededRandom(page, 0xD4A47);
  await page.goto("/");
  await page.click("#startBtn");
  for (let round = 0; round < 12; round++) {
    await page.waitForSelector(".player-card", { timeout: 10_000 });
    // Pick the best visible value so this reliably exercises an early-round prospect.
    const cards = page.locator(".player-card");
    let bestIndex = 0;
    let bestValue = -1;
    for (let index = 0; index < await cards.count(); index++) {
      const value = Number(await cards.nth(index).locator(".pc-value").textContent());
      if (value > bestValue) { bestValue = value; bestIndex = index; }
    }
    await cards.nth(bestIndex).click();
  }

  await page.waitForSelector("#goProBtn", { timeout: 10_000 });
  const combineGrade = Number(await page.locator("#resultScore").textContent());
  const breakdown = await page.locator("#resultBreakdown").textContent();
  const footballMatch = breakdown.match(/Football OVR\s+(\d+)/);
  expect(footballMatch, "results must show the actual career-weighted football rating").toBeTruthy();
  const footballOverall = Number(footballMatch[1]);

  await page.click("#goProBtn");
  await page.click(".decade-card >> nth=5");
  await page.click("#enterDraftNightBtn");
  await page.waitForSelector("#startCareerBtn", { state: "visible", timeout: 10_000 });
  await page.click("#startCareerBtn");
  await clickThroughToSeasonCard(page);

  const saved = await readActiveCareer(page);
  expect(saved.career.prospectGrade).toBe(combineGrade);
  expect(saved.career.draftOverall).toBe(footballOverall);

  if (saved.career.overallPick <= 10) {
    const activeIds = new Set([
      saved.career.teamId,
      ...Object.keys(saved.career.teamQbDepth || {}),
    ]);
    const activeStrengths = [...activeIds]
      .map(id => saved.career.leagueStrength[id])
      .filter(Number.isFinite)
      .sort((a, b) => a - b);
    const destination = saved.career.leagueStrength[saved.career.teamId];
    const median = activeStrengths[Math.floor(activeStrengths.length / 2)];
    expect(destination, "a top-ten pick should begin on the weak half of the league").toBeLessThanOrEqual(median);
  }
});
