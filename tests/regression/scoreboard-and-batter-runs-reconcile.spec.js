// Baseball conversion of the old "passing + rushing TDs cannot exceed the team's offensive TD
// count" invariant. The football rule was scoreboard-coupled (TD*6 <= final score). The baseball
// per-game box line is deliberately NOT coupled to the game's run total in general -- one bat's
// hits/total bases aren't the team's runs -- with ONE hard physical exception: a batter cannot hit
// more home runs in a game than his own team scored runs, because every home run scores at least
// the batter himself. simulateRegularSeasonGames caps gTd (the legacy slot now carrying HR) at
// scoreSim.myTotal for exactly this reason; this verifies the invariant holds in the persisted
// game log across a real multi-season career.
import { test, expect } from "@playwright/test";
import { startCareer, advanceOneSeason, readActiveCareer } from "../helpers/careerFlow.mjs";
import { installSeededRandom } from "../helpers/seededRandom.mjs";

test("scoreboard-and-batter-runs-reconcile", async ({ page }) => {
  test.setTimeout(240_000);
  await installSeededRandom(page, 24601);
  await startCareer(page, { decadeIndex: 5 }); // modern era -- more HR per game to exercise this

  // Collect season logs as we go -- a modern career can wash out before 8 full seasons, which
  // would clear the active save.
  let seasonLog = [];
  for (let i = 0; i < 8; i++) {
    const s = await readActiveCareer(page);
    if (s?.career?.seasonLog?.length) seasonLog = s.career.seasonLog;
    if (!(await advanceOneSeason(page))) break;
  }
  const fin = await readActiveCareer(page);
  if (fin?.career?.seasonLog?.length) seasonLog = fin.career.seasonLog;

  let checkedGames = 0;
  const violations = [];
  seasonLog.forEach(season => {
    (season.gameLog || []).forEach(g => {
      if (g.startedByBackup) return; // no personal stat line attached to a missed-game entry
      checkedGames++;
      const hr = g.td || 0; // legacy slot: home runs this game
      // A batter can never hit more home runs than his own team scored runs that game.
      if (hr > (g.myScore || 0)) {
        violations.push({ year: season.year, week: g.week, hr, myScore: g.myScore });
      }
      // Sanity: never an absurd single-game HR count.
      if (hr > 4) violations.push({ year: season.year, week: g.week, hr, reason: "implausible single-game HR" });
    });
  });

  expect(
    violations,
    `found games where the player's HR total is inconsistent with the box score: ${JSON.stringify(violations.slice(0, 5))}`
  ).toEqual([]);
  expect(checkedGames, "expected to check a meaningful number of real games across 8 seasons").toBeGreaterThan(30);
});
