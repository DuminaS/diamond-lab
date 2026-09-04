// Phase 13b: the 162-game regular season is scheduled in SERIES -- 2-4 consecutive games against
// the same opponent -- not one scattered game a week. Every game carries seriesId / gameInSeries /
// seriesLen; the schedule tab groups by series.
import { test, expect } from "@playwright/test";
import { startCareer, advanceOneSeason, readActiveCareer } from "../helpers/careerFlow.mjs";
import { installSeededRandom } from "../helpers/seededRandom.mjs";

test("the regular season is scheduled in 2-4-game series", async ({ page }) => {
  test.setTimeout(180_000);
  await installSeededRandom(page, 4242);
  await startCareer(page, { decadeIndex: 4 });
  await advanceOneSeason(page);
  await advanceOneSeason(page);

  const s = await readActiveCareer(page);
  const last = s.career.seasonLog[s.career.seasonLog.length - 2] || s.career.seasonLog[s.career.seasonLog.length - 1];
  const log = last.gameLog || [];
  expect(log.length).toBeGreaterThan(140);

  // every game is series-tagged
  const untagged = log.filter(g => g.seriesId == null);
  expect(untagged.length, "every game should carry a seriesId").toBe(0);

  // group by series
  const bySeries = new Map();
  log.forEach(g => { if (!bySeries.has(g.seriesId)) bySeries.set(g.seriesId, []); bySeries.get(g.seriesId).push(g); });
  const lens = [...bySeries.values()].map(a => a.length);
  const hist = {}; lens.forEach(l => hist[l] = (hist[l] || 0) + 1);

  // most series are 2-4 games; the whole season is ~45-60 series (real MLB is ~52)
  expect(bySeries.size).toBeGreaterThan(35);
  expect(bySeries.size).toBeLessThan(90);
  const threeGame = hist[3] || 0;
  expect(threeGame, `3-game series should dominate: ${JSON.stringify(hist)}`).toBeGreaterThan(bySeries.size * 0.4);

  // each series is against ONE opponent, with consecutive gameInSeries values 1..N
  for (const games of bySeries.values()) {
    games.sort((a, b) => (a.gameInSeries || 0) - (b.gameInSeries || 0));
    const opp = games[0].opponentId;
    games.forEach((g, i) => {
      expect(g.opponentId, "a series is against one opponent").toBe(opp);
      expect(g.gameInSeries).toBe(i + 1);
      expect(g.seriesLen).toBe(games.length);
    });
  }

  // schedule tab shows a Series picker
  await page.evaluate(() => document.querySelector('.dash-tab[data-tab="schedule"]')?.click());
  await page.waitForTimeout(200);
  const picker = await page.evaluate(() => {
    const sel = document.querySelector("#careerContent #scheduleWeekSelect");
    return sel ? { count: sel.options.length, first: sel.options[0].textContent } : null;
  });
  expect(picker).toBeTruthy();
  expect(picker.first).toMatch(/^Series 1 · (vs|at) /);
});
