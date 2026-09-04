// Phase 13b: every postseason round is a best-of-N series (era-accurate). Walks a modern-era
// career to a deep playoff run and confirms the round objects carry series structure, the series
// clinches exactly at the target, and no game of a series ties.
import { test, expect } from "@playwright/test";
import { startCareer, advanceOneSeason, readActiveCareer } from "../helpers/careerFlow.mjs";
import { installSeededRandom } from "../helpers/seededRandom.mjs";

test("every playoff round the player plays is a best-of-N series", async ({ page }) => {
  test.setTimeout(300_000);
  await installSeededRandom(page, 71717);
  await startCareer(page, { decadeIndex: 5 }); // 2000s

  const targets = { "Wild Card": 1, "Divisional": 3, "Conference Championship": 4, "Super Bowl": 4 };
  let sawSeries = false;
  for (let i = 0; i < 14; i++) {
    const ok = await advanceOneSeason(page);
    const s = await readActiveCareer(page);
    if (!s) break;
    const done = s.career.seasonLog[s.career.seasonLog.length - 2];
    (done?.playoffs?.rounds || []).forEach(r => {
      sawSeries = true;
      expect(r.seriesTarget, `${done.year} ${r.round} seriesTarget`).toBe(targets[r.round]);
      expect(Array.isArray(r.seriesWins)).toBe(true);
      expect(Array.isArray(r.games)).toBe(true);
      // a decided round: a side hit the target exactly, and total games <= 2*target-1
      if (r.won !== undefined) {
        expect(Math.max(r.seriesWins[0], r.seriesWins[1])).toBe(r.seriesTarget);
        expect(r.games.length).toBeLessThanOrEqual(2 * r.seriesTarget - 1);
        expect(r.games.length).toBe(r.seriesWins[0] + r.seriesWins[1]);
        expect(r.won).toBe(r.seriesWins[0] > r.seriesWins[1]);
      }
      r.games.forEach((g, gi) => {
        expect(g.myScore, `${done.year} ${r.round} game ${gi + 1} tie`).not.toBe(g.oppScore);
      });
    });
    if (!ok) break;
  }
  test.skip(!sawSeries, "seed produced no playoff appearances in 14 seasons");
});
