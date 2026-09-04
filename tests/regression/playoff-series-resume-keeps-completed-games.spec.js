// Phase 13b: a decided playoff series must survive a reload without being re-revealed / re-counted.
// Fabricates a finished multi-game series directly into the save, reloads, and confirms the series
// record and ring count are unchanged (the static-run settle path, not a fresh reveal).
import { test, expect } from "@playwright/test";
import { startCareer, readActiveCareer, writeActiveCareer } from "../helpers/careerFlow.mjs";
import { installSeededRandom } from "../helpers/seededRandom.mjs";

const game = (myWon) => ({
  myScore: myWon ? 5 : 2, oppScore: myWon ? 2 : 5, won: myWon,
  quarters: Array.from({ length: 9 }, (_, i) => ({ q: i + 1, myQ: 0, oppQ: 0, myTotal: myWon ? 5 : 2, oppTotal: myWon ? 2 : 5 })),
  box: { comp: 1, att: 4, td: myWon ? 1 : 0, int: 1, yards: 4 },
  _revealedCount: 9, _keyMomentChecked: true,
});

test("a decided playoff series survives a reload without re-counting", async ({ page }) => {
  test.setTimeout(120_000);
  await installSeededRandom(page, 999);
  await startCareer(page, { decadeIndex: 5 });

  const saved = await readActiveCareer(page);
  const last = saved.career.seasonLog[saved.career.seasonLog.length - 1];
  const ringsBefore = saved.career.totals.rings || 0;
  // a completed 4-1 World Series win
  last.playoffs = {
    made: true, done: true, wonSuperBowl: true, wonRing: true, ringLabel: "World Series Champion",
    rounds: [{
      round: "Super Bowl", opponent: "Test Rival", oppId: "BUF",
      seriesTarget: 4, seriesWins: [4, 1], _gameIdx: 4, won: true,
      myScore: 4, oppScore: 1,
      games: [game(true), game(true), game(false), game(true), game(true)],
    }],
  };
  await writeActiveCareer(page, saved);

  for (let r = 0; r < 3; r++) {
    await page.reload();
    const rb = page.locator("#resumeCareerBtn");
    if (await rb.count()) await rb.click();
    await page.waitForTimeout(300);
    const after = await readActiveCareer(page);
    if (!after) break;
    const round = after.career.seasonLog[after.career.seasonLog.length - 1].playoffs.rounds[0];
    expect(round.seriesWins, `reload ${r}: series record must not change`).toEqual([4, 1]);
    expect(round.games.length, `reload ${r}: game count must not grow`).toBe(5);
    expect(after.career.totals.rings, `reload ${r}: no extra ring`).toBe(ringsBefore + 1);
  }
});
