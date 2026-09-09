// Review finding 2: the season stat line and the game logs must describe the same reality.
// simulateRegularSeasonGames now distributes the season targets across the games it simulated
// (with per-game caps), so season totals are the SUM of the game logs -- HR, TB, hits, K, BB, 2B,
// 3B all reconcile, HR never exceeds the hits or team runs of the game it was hit in.
import { test, expect } from "@playwright/test";
import { startCareer, advanceSeasons, readActiveCareer } from "../helpers/careerFlow.mjs";
import { installSeededRandom } from "../helpers/seededRandom.mjs";

test("a hitter's season totals are exactly the sum of his game logs", async ({ page }) => {
  test.setTimeout(240_000);
  await installSeededRandom(page, 830512);
  await startCareer(page, { decadeIndex: 5 });
  await advanceSeasons(page, 6);

  const saved = await readActiveCareer(page);
  expect(saved).toBeTruthy();
  const seasons = saved.career.seasonLog.filter(s => !s.isPitching && (s.pa || 0) > 50);
  expect(seasons.length, "played seasons").toBeGreaterThanOrEqual(3);

  for (const s of seasons) {
    const g = (s.gameLog || []).filter(x => !x.startedByBackup);
    expect(g.length, `year ${s.year} has started games`).toBeGreaterThan(20);

    const sum = k => g.reduce((a, x) => a + (x[k] || 0), 0);
    // legacy aliases on the game entries: comp=hits, att=PA, td=HR, int=K, yards=TB
    expect(sum("td"), `year ${s.year} HR: season ${s.hr} vs games`).toBe(s.hr);
    expect(sum("comp"), `year ${s.year} hits`).toBe(s.hits);
    expect(sum("int"), `year ${s.year} K`).toBe(s.k);
    expect(sum("bb"), `year ${s.year} BB`).toBe(s.bb);
    expect(sum("doubles"), `year ${s.year} 2B`).toBe(s.doubles);
    expect(sum("triples"), `year ${s.year} 3B`).toBe(s.triples);
    expect(sum("yards"), `year ${s.year} TB`).toBe(s.yards);
    expect(sum("att"), `year ${s.year} PA`).toBe(s.pa);

    // per-game sanity: a HR needs a hit and a run
    for (const x of g) {
      expect(x.td, `year ${s.year}: ${x.td} HR > ${x.comp} hits in one game`).toBeLessThanOrEqual(x.comp);
      expect(x.td, `year ${s.year}: ${x.td} HR > ${x.myScore} team runs`).toBeLessThanOrEqual(x.myScore);
      expect(x.doubles + x.triples + x.td, `year ${s.year}: XBH > hits`).toBeLessThanOrEqual(x.comp);
      expect(x.comp, `year ${s.year}: hits > PA`).toBeLessThanOrEqual(x.att);
    }

    // SLG/OPS+ derived from the reconciled line stays believable
    expect(s.slg).toBeGreaterThan(0.15);
    expect(s.slg).toBeLessThan(0.95);
    if ((s.pa || 0) > 400) {
      expect(s.hr, `year ${s.year} HR in a plausible band`).toBeGreaterThanOrEqual(0);
      expect(s.hr).toBeLessThan(75);
    }
  }
});
