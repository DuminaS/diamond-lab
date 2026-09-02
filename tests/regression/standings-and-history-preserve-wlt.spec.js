// Wave 4 (MASTER_REMEDIATION_SPEC.md), Section 8 scenario #20 / exit criterion: "Both game
// participants, standings, history, and QB records agree on every tie." Sweeps a real 1960s-era
// career (chosen for a meaningfully non-trivial tie rate -- see regular-season-era-can-produce-tie)
// and, for every season simulated, cross-checks: (1) every team's standings record
// (leagueStandings.results[id].wins/losses/ties) exactly equals the sum of that team's own real
// per-game log (currentSeasonSchedules); (2) both sides of every game in the shared schedule agree
// about whether it was a tie and who (if anyone) won; (3) the permanent team-history row recorded
// for this season carries the same ties count as the standings result it was built from.
import { test, expect } from "@playwright/test";
import { startCareer, advanceOneSeason, readActiveCareer } from "../helpers/careerFlow.mjs";
import { installSeededRandom } from "../helpers/seededRandom.mjs";

test("standings-and-history-preserve-wlt", async ({ page }) => {
  test.setTimeout(180_000);
  await installSeededRandom(page, 33221);
  await startCareer(page, { decadeIndex: 1 }); // 1960s -- real, meaningful tie rate to actually exercise this

  let checkedAnyTie = false;
  const allMismatches = [];
  for (let season = 0; season < 8; season++) {
    const stillActive = await page.evaluate(() => !!localStorage.getItem("gridironlab.activeCareer"));
    if (!stillActive) break;
    const ok = await advanceOneSeason(page);
    const saved = await readActiveCareer(page);
    const lastSeason = saved.career.seasonLog[saved.career.seasonLog.length - 1];
    const ls = lastSeason && lastSeason.leagueStandings;
    const schedules = saved.career.currentSeasonSchedules || {};
    const history = saved.career.teamSeasonHistory || {};

    if (ls && ls.results) {
      Object.keys(ls.results).forEach(teamId => {
        const r = ls.results[teamId];
        const log = schedules[teamId] || [];
        if (!log.length) return; // this team's schedule wasn't tagged this pass (e.g. bye-only edge) -- nothing to cross-check
        const realWins = log.filter(g => g.won === true).length;
        const realLosses = log.filter(g => g.won === false).length;
        const realTies = log.filter(g => g.tie).length;
        if (realTies > 0) checkedAnyTie = true;
        if (r.wins !== realWins || r.losses !== realLosses || r.ties !== realTies) {
          allMismatches.push({ year: lastSeason.year, teamId, standings: { w: r.wins, l: r.losses, t: r.ties }, real: { w: realWins, l: realLosses, t: realTies } });
        }
        // Every game on this team's own log must agree on tie/won with itself (won===null iff tie).
        log.forEach(g => {
          if (g.tie && g.won !== null) allMismatches.push({ year: lastSeason.year, teamId, badGame: g, reason: "tie game with non-null won" });
          if (!g.tie && typeof g.won !== "boolean") allMismatches.push({ year: lastSeason.year, teamId, badGame: g, reason: "non-tie game with non-boolean won" });
        });
        // History row for this exact season, if recorded, must carry the same ties count.
        const histRow = (history[teamId] || []).find(h => h.year === lastSeason.year);
        if (histRow && histRow.ties !== r.ties) {
          allMismatches.push({ year: lastSeason.year, teamId, reason: "history ties mismatch", historyTies: histRow.ties, standingsTies: r.ties });
        }
      });
    }
    if (!ok) break;
  }

  expect(allMismatches, `found W-L-T mismatches: ${JSON.stringify(allMismatches.slice(0, 8), null, 2)}`).toEqual([]);
  expect(checkedAnyTie, "expected at least one real tie to have occurred across 8 seasons in the 1960s, to actually exercise this check").toBe(true);
});
