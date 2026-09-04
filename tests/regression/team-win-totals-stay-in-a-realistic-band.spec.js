// Phase 13c item #9: the player's own team win rate is now clamped the way flat teams are
// (scoreForInning clamps the lineup-vs-staff grade gap to +/-35, mirroring simpleWinProb's
// [.35,.66]). Before, a grade-90+ team the player was on could win 115-122 games while the best
// flat team topped out ~100. This sweeps several seeded careers and checks that NO team in any
// season's final standings -- the player's included -- blows past a realistic single-season win
// total (the real MLB record is 116).
import { test, expect } from "@playwright/test";
import { startCareer, advanceOneSeason, readActiveCareer } from "../helpers/careerFlow.mjs";
import { installSeededRandom } from "../helpers/seededRandom.mjs";

test("no team runs away with an unrealistic win total", async ({ page }) => {
  test.setTimeout(360_000);

  const offenders = [];
  let seasonsChecked = 0, playerSeasonsChecked = 0;

  for (const seed of [11, 4242, 909090]) {
    await installSeededRandom(page, seed);
    await startCareer(page, { decadeIndex: 5 });

    for (let i = 0; i < 12; i++) {
      const active = await page.evaluate(() => !!localStorage.getItem("diamondlab.activeCareer"));
      if (!active) break;
      await advanceOneSeason(page);
      const saved = await readActiveCareer(page);
      if (!saved) break;
      const done = saved.career.seasonLog[saved.career.seasonLog.length - 2];
      if (!done) continue;

      const results = done.leagueStandings && done.leagueStandings.results;
      if (results) {
        seasonsChecked++;
        Object.values(results).forEach(r => {
          const g = (r.wins || 0) + (r.losses || 0) + (r.ties || 0);
          if (g < 100) return; // partial / short season -- not comparable
          if ((r.wins || 0) > 118) offenders.push({ seed, year: done.year, team: r.id, wins: r.wins, losses: r.losses });
        });
      }
      // the player's own team, from the season card's own tallied totals
      if ((done.teamWins || 0) + (done.teamLosses || 0) >= 150) {
        playerSeasonsChecked++;
        if ((done.teamWins || 0) > 118) {
          offenders.push({ seed, year: done.year, team: "PLAYER", wins: done.teamWins, losses: done.teamLosses });
        }
      }
    }
  }

  expect(seasonsChecked, "expected to check several full league standings").toBeGreaterThan(8);
  expect(playerSeasonsChecked, "expected to check several full player-team seasons").toBeGreaterThan(4);
  expect(offenders, `team(s) exceeded a realistic single-season win total: ${JSON.stringify(offenders)}`).toEqual([]);
});
