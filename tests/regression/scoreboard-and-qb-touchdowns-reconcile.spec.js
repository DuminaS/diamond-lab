// Wave 7 (MASTER_REMEDIATION_SPEC.md), Section 8 scenario #24 / task #3 exit criterion: "Passing
// plus rushing TDs cannot exceed the team's offensive TD count." Before this wave,
// simulateRegularSeasonGames rolled the QB's per-game passing TD count independently from tdRate,
// completely unrelated to how many touchdowns the scoreboard (simulateGameScore) actually produced
// that same game -- a QB could be credited with 3 passing TDs in a game the scoreboard shows as won
// 9-6 on field goals alone. Fixed by deriving gTd/gRushTd from the game's own real scoreboard TD
// count (scoreSim.myTds), allocating a small, documented share to a QB rush.
//
// The per-game TD/FG breakdown itself isn't persisted on a saved game-log entry (only the final
// score is), so this verifies the same invariant in its observable form: this engine scores a TD as
// exactly 7 points (6 + PAT, no 2-point conversions modeled -- see scoreForQuarter), so
// (td + rushTd) touchdowns can never account for more than (td + rushTd) * 7 points -- which can
// never exceed the team's own final score. A violation here is only possible if td/rushTd were
// still being rolled independently of the real scoreboard.
import { test, expect } from "@playwright/test";
import { startCareer, advanceSeasons, readActiveCareer } from "../helpers/careerFlow.mjs";
import { installSeededRandom } from "../helpers/seededRandom.mjs";

test("scoreboard-and-qb-touchdowns-reconcile", async ({ page }) => {
  test.setTimeout(180_000);
  await installSeededRandom(page, 24601);
  await startCareer(page, { decadeIndex: 5 }); // modern era -- higher scoring, more TDs per game to exercise this
  await advanceSeasons(page, 8);

  const saved = await readActiveCareer(page);
  let checkedGames = 0;
  const violations = [];
  (saved.career.seasonLog || []).forEach(season => {
    (season.gameLog || []).forEach(g => {
      if (g.startedByBackup) return; // no personal stat line attached to a missed-game entry
      if (g.tie === true && g.myScore === 0) return; // scoreless tie -- nothing to check
      checkedGames++;
      const tdPoints = ((g.td || 0) + (g.rushTd || 0)) * 7;
      if (tdPoints > g.myScore) {
        violations.push({ year: season.year, week: g.week, td: g.td, rushTd: g.rushTd, myScore: g.myScore, tdPoints });
      }
    });
  });

  expect(
    violations,
    `found games where passing+rushing TDs implied more points than the team actually scored: ${JSON.stringify(violations.slice(0, 5))}`
  ).toEqual([]);
  expect(checkedGames, "expected to check a meaningful number of real games across 8 seasons").toBeGreaterThan(30);
});
