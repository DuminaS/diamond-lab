// Wave 4 (MASTER_REMEDIATION_SPEC.md), Section 8 scenario #19 / exit criterion: "Postseason games
// never end tied." simulateGameScore/resolveOvertime's postseason branch (overtimeRulesForYear's
// canEndInTie:false) must always resolve a winner, in EVERY era -- including the pre-1974 era where
// the regular season now genuinely can end level. Sweeps a 1960s-era career (the one era where ties
// are common enough that this would be most likely to accidentally leak into the postseason if the
// wiring were wrong) and checks EVERY confirmed playoff round in BOTH conferences' lockstep bracket
// (season.leagueStandings.bracket.myRounds/otherRounds -- populated every season regardless of
// whether the player personally made the playoffs, since the whole bracket must resolve before
// Continue unlocks) plus the player's own rounds and the league championship game specifically.
import { test, expect } from "@playwright/test";
import { startCareer, advanceOneSeason, readActiveCareer } from "../helpers/careerFlow.mjs";
import { installSeededRandom } from "../helpers/seededRandom.mjs";

test("postseason-never-produces-tie", async ({ page }) => {
  test.setTimeout(180_000);
  await installSeededRandom(page, 55221);
  await startCareer(page, { decadeIndex: 1 }); // 1960s -- the era most likely to leak a regular-season-style tie into the postseason if the wiring were wrong

  let checkedAnyPlayoffRound = false;
  for (let season = 0; season < 10; season++) {
    const stillActive = await page.evaluate(() => !!localStorage.getItem("gridironlab.activeCareer"));
    if (!stillActive) break;
    const ok = await advanceOneSeason(page);
    const saved = await readActiveCareer(page);
    const lastSeason = saved.career.seasonLog[saved.career.seasonLog.length - 1];
    const bd = lastSeason && lastSeason.leagueStandings && lastSeason.leagueStandings.bracket;
    if (bd) {
      // Each confirmed round is {label, matchups: [...]} -- every matchup is either the REAL shape
      // (isMine:true, myScore/oppScore/won, from the player's own reveal) or the FLAT shape
      // (isMine:false, aScore/bScore/winnerId, from a "Simulate Next Round" flat resolution).
      [...(bd.myRounds || []), ...(bd.otherRounds || [])].forEach(round => {
        (round.matchups || []).forEach(m => {
          checkedAnyPlayoffRound = true;
          if(m.isMine){
            expect(m.round.myScore, `a real ${lastSeason.year} ${round.label} must not end tied`).not.toBe(m.round.oppScore);
            expect(typeof m.round.won, `a real ${lastSeason.year} ${round.label} must have a real won boolean`).toBe("boolean");
          } else {
            expect(m.aScore, `a flat-resolved ${lastSeason.year} ${round.label} must not end tied`).not.toBe(m.bScore);
            expect(m.winnerId, `a flat-resolved ${lastSeason.year} ${round.label} must have a real winnerId`).toBeTruthy();
          }
        });
      });
      const playoffBracket = lastSeason.leagueStandings.playoffBracket;
      if (playoffBracket && playoffBracket.superBowlScore) {
        const [a, b] = String(playoffBracket.superBowlScore).split("-").map(Number);
        expect(a, `the league championship game in ${lastSeason.year} must not end tied`).not.toBe(b);
      }
    }
    if (lastSeason && lastSeason.playoffs && lastSeason.playoffs.made) {
      (lastSeason.playoffs.rounds || []).forEach(r => {
        checkedAnyPlayoffRound = true;
        expect(r.myScore, `the player's own ${r.round} in ${lastSeason.year} must not end tied`).not.toBe(r.oppScore);
      });
    }
    if (!ok) break;
  }

  expect(checkedAnyPlayoffRound, "expected at least one confirmed playoff round across 10 seasons").toBe(true);
});
