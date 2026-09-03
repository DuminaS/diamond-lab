// Wave 4 (MASTER_REMEDIATION_SPEC.md), Section 8 scenario #18 / exit criteria: "Pre-overtime-era
// regular seasons can end tied" and "Modern regular seasons produce plausible but uncommon ties."
// Before this wave, a level-after-regulation PRE-1974 game still ran a fictional coin-flip "OT"
// period 67% of the time (resolveOvertime's predecessor had no concept of "overtime didn't exist
// yet") -- historically false, since regular-season overtime was not introduced until 1974. This
// sweeps a real 1960s-era career under a seeded RNG and confirms real ties actually occur (both for
// the player's own quarter-by-quarter games and for flat-resolved rivals), and separately confirms
// a real ring/box-score is never awarded on a tied game (both sides get null `won`, not one side
// incorrectly reading `!otherSide.won` as a win).
import { test, expect } from "@playwright/test";
import { startCareer, advanceOneSeason, readActiveCareer } from "../helpers/careerFlow.mjs";
import { installSeededRandom } from "../helpers/seededRandom.mjs";

test("regular-season-era-can-produce-tie", async ({ page }) => {
  test.setTimeout(180_000);
  // Balance Wave 1 changes the number of random draws during draft/development, so the old fixture
  // no longer reaches a player tie inside its bounded career. Seed 86420 was re-verified against
  // the current production build and produces both player and league ties without changing odds.
  await installSeededRandom(page, 86420);
  await startCareer(page, { decadeIndex: 1 }); // 1960s -- pre-1974, no regular-season overtime

  let foundMyTie = false, foundLeagueTie = false;
  for (let season = 0; season < 15 && !(foundMyTie && foundLeagueTie); season++) {
    const stillActive = await page.evaluate(() => !!localStorage.getItem("diamondlab.activeCareer"));
    if (!stillActive) break;
    const ok = await advanceOneSeason(page);
    const saved = await readActiveCareer(page);
    const lastSeason = saved.career.seasonLog[saved.career.seasonLog.length - 1];
    if (lastSeason && lastSeason.gameLog) {
      const myTieGame = lastSeason.gameLog.find(g => g.tie && !g.startedByBackup);
      if (myTieGame) {
        foundMyTie = true;
        expect(myTieGame.won, "a tied game must record won as null/false on the tied side, never true").not.toBe(true);
        expect(myTieGame.myScore, "a tied game's two scores must actually be equal").toBe(myTieGame.oppScore);
      }
    }
    const schedules = saved.career.currentSeasonSchedules || {};
    for (const teamId of Object.keys(schedules)) {
      if (teamId === saved.career.teamId) continue;
      const tieGame = (schedules[teamId] || []).find(g => g.tie);
      if (tieGame) { foundLeagueTie = true; break; }
    }
    if (!ok) break;
  }

  expect(foundMyTie, "expected at least one of the player's own real games to end in a tie across 15 seasons in the 1960s").toBe(true);
  expect(foundLeagueTie, "expected at least one flat-resolved league game to end in a tie across 15 seasons in the 1960s").toBe(true);
});
