// Phase 15c: a team's "Lineup" grade (the `weapons` component of its five) is re-derived every
// offseason from its actual nine bats -- so team quality, and through teamStrength the run scoring,
// tracks the real roster. This checks the league-wide correlation: the teams with the best lineups
// carry the best Lineup grades, and the worst lineups the worst.
import { test, expect } from "@playwright/test";
import { startCareer, advanceSeasons, readActiveCareer } from "../helpers/careerFlow.mjs";
import { installSeededRandom } from "../helpers/seededRandom.mjs";

test("the Lineup grade tracks the real roster across the league", async ({ page }) => {
  test.setTimeout(220_000);
  await installSeededRandom(page, 4242);
  await startCareer(page, { decadeIndex: 5 });
  await advanceSeasons(page, 6);

  const s = await readActiveCareer(page);
  expect(s).toBeTruthy();
  const c = s.career;

  // age-adjusted talent, mirroring rivalEffTalent
  const prime = age => {
    const pts = [[22,0.90],[24,0.95],[26,0.99],[29,1.0],[32,1.0],[34,0.90],[36,0.78],[38,0.65],[40,0.5],[42,0.38]];
    if (age <= pts[0][0]) return pts[0][1];
    for (let i = 1; i < pts.length; i++) if (age <= pts[i][0]) {
      const [a0, m0] = pts[i - 1], [a1, m1] = pts[i];
      return m0 + (m1 - m0) * (age - a0) / (a1 - a0);
    }
    return pts[pts.length - 1][1];
  };
  const effTalent = e => Math.max(20, Math.min(99, Math.round(65 + (e.talent - 65) * prime(e.age))));

  const points = [];
  Object.keys(c.teamLineups || {}).forEach(tid => {
    if (tid === c.teamId) return;
    const lg = c.leagueTeamGrades[tid];
    if (!lg || lg.weapons == null) return;
    const ovrs = (c.teamLineups[tid] || [])
      .filter(id => id !== "user" && c.qbsById[id])
      .map(id => effTalent(c.qbsById[id]));
    if (ovrs.length < 7) return;
    const lineupAvg = ovrs.reduce((a, b) => a + b, 0) / ovrs.length;
    points.push({ tid, weapons: lg.weapons, lineupAvg });
  });
  expect(points.length, "enough teams with a real lineup + grade").toBeGreaterThan(15);

  // Pearson correlation between the Lineup grade and the roster's average effective talent.
  const n = points.length;
  const mx = points.reduce((a, p) => a + p.lineupAvg, 0) / n;
  const my = points.reduce((a, p) => a + p.weapons, 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  points.forEach(p => { const dx = p.lineupAvg - mx, dy = p.weapons - my; sxy += dx * dy; sxx += dx * dx; syy += dy * dy; });
  const r = sxy / Math.sqrt(sxx * syy || 1);
  expect(r, `Lineup grade should strongly track roster talent (r=${r.toFixed(2)})`).toBeGreaterThan(0.55);

  // and the best-lineup third clearly out-grades the worst-lineup third
  points.sort((a, b) => a.lineupAvg - b.lineupAvg);
  const k = Math.floor(n / 3);
  const worstAvg = points.slice(0, k).reduce((a, p) => a + p.weapons, 0) / k;
  const bestAvg = points.slice(-k).reduce((a, p) => a + p.weapons, 0) / k;
  expect(bestAvg - worstAvg, `best-lineup teams out-grade worst-lineup teams (${bestAvg.toFixed(0)} vs ${worstAvg.toFixed(0)})`).toBeGreaterThan(8);
});
