// Wave 4 exit criterion: "Postseason games never end tied." Phase 13b: the postseason is now
// best-of-N series -- a series can't tie (one side always reaches the target), and no individual
// game of a postseason series may end tied either (canEndInTie:false for postseason, every era).
// Sweeps a modern-era career (full bracket every season, so the flat other-conference rounds are
// always produced) and checks: every recorded flat round, every game of the player's own series,
// and the World Series record + its games.
import { test, expect } from "@playwright/test";
import { startCareer, advanceOneSeason, readActiveCareer } from "../helpers/careerFlow.mjs";
import { installSeededRandom } from "../helpers/seededRandom.mjs";

test("postseason-never-produces-tie", async ({ page }) => {
  test.setTimeout(240_000);
  await installSeededRandom(page, 55221);
  await startCareer(page, { decadeIndex: 5 });

  let checkedFlatRound = false, checkedPlayerSeries = false;
  for (let season = 0; season < 12; season++) {
    const stillActive = await page.evaluate(() => !!localStorage.getItem("diamondlab.activeCareer"));
    if (!stillActive) break;
    const ok = await advanceOneSeason(page);
    const saved = await readActiveCareer(page);
    if (!saved) break;
    // the season that just finished is the second-to-last entry (last is the freshly-generated one)
    const done = saved.career.seasonLog[saved.career.seasonLog.length - 2];
    if (!done) { if (!ok) break; continue; }

    const bd = done.leagueStandings && done.leagueStandings.bracket;
    if (bd) {
      [...(bd.myRounds || []), ...(bd.otherRounds || [])].forEach(round => {
        (round.matchups || []).forEach(m => {
          if (m.isMine) {
            expect(typeof m.round.won, `player round ${done.year} ${round.label} needs a won boolean`).toBe("boolean");
            (m.round.games || []).forEach((g, gi) => {
              expect(g.myScore, `player ${done.year} ${round.label} game ${gi + 1} must not tie`).not.toBe(g.oppScore);
            });
          } else {
            checkedFlatRound = true;
            expect(m.aScore, `flat ${done.year} ${round.label} series must not be even`).not.toBe(m.bScore);
            expect(m.winnerId, `flat ${done.year} ${round.label} needs a winnerId`).toBeTruthy();
            (m.gameScores || []).forEach((g, gi) => {
              expect(g[0], `flat ${done.year} ${round.label} game ${gi + 1} must not tie`).not.toBe(g[1]);
            });
          }
        });
      });
      const pb = done.leagueStandings.playoffBracket;
      if (pb && pb.superBowlScore) {
        const [a, b] = String(pb.superBowlScore).split("-").map(Number);
        expect(a, `the World Series in ${done.year} must have a winner`).not.toBe(b);
      }
    }
    if (done.playoffs && done.playoffs.made) {
      (done.playoffs.rounds || []).forEach(r => {
        checkedPlayerSeries = true;
        expect(r.myScore, `player ${r.round} ${done.year}: a decided series can't be even`).not.toBe(r.oppScore);
        (r.games || []).forEach((g, gi) => {
          expect(g.myScore, `player ${r.round} ${done.year} game ${gi + 1} must not tie`).not.toBe(g.oppScore);
        });
      });
    }
    if (!ok) break;
  }

  expect(checkedFlatRound || checkedPlayerSeries, "expected at least one postseason series across 12 seasons").toBe(true);
});
