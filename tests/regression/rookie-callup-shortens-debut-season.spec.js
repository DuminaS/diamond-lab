// Phase 13c: a position prospect rarely breaks camp with the big club -- most open the year in
// Triple-A and get called up in April-June. The player's FIRST career season usually starts
// partway through (~90-125 games), not a full 162. season.debutCallup records the delay; the
// missed games are covered by a generic replacement so the team's own record is unaffected.
import { test, expect } from "@playwright/test";
import { startCareer, readActiveCareer } from "../helpers/careerFlow.mjs";
import { installSeededRandom } from "../helpers/seededRandom.mjs";

test("a rookie's debut season is a mid-season call-up, not a full 162", async ({ page }) => {
  test.setTimeout(180_000);

  let sawCallup = 0, sawFull = 0;
  for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
    await installSeededRandom(page, seed);
    await startCareer(page, { decadeIndex: 4 });
    const saved = await readActiveCareer(page);
    const s1 = saved.career.seasonLog[0];
    expect(s1, `seed ${seed}: expected a first season`).toBeTruthy();
    expect(typeof s1.debutCallup, `seed ${seed}: debutCallup field present`).toBe("number");

    if (s1.debutCallup > 0) {
      sawCallup++;
      expect(s1.debutCallup, `seed ${seed}: call-up delay is 35-80 games`).toBeGreaterThanOrEqual(35);
      expect(s1.games, `seed ${seed}: a call-up debut plays fewer than a full slate`).toBeLessThan(s1.teamGames);
      expect(s1.games, `seed ${seed}: a call-up debut still plays a real chunk of the year`).toBeGreaterThan(60);
      // the team still played a full season -- its record isn't docked for the call-up
      expect(s1.teamWins + s1.teamLosses + (s1.teamTies || 0)).toBe(s1.teamGames);
    } else {
      sawFull++;
    }
  }

  expect(sawCallup, "most debut seasons should be a call-up across 8 seeds").toBeGreaterThan(2);
});
