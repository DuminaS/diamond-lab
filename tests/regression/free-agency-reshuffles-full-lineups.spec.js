// Phase 15d: free agency at roster scale -- each offseason a realistic trickle of the league's
// non-franchise-face lineup bats hit the market and move to teams that need help at their position
// (or retire). This sweeps a career and checks the reshuffle happens, stays position-consistent,
// and never corrupts the roster model (no bat in two lineups, sizes hold, the save stays bounded).
import { test, expect } from "@playwright/test";
import { startCareer, advanceOneSeason, readActiveCareer } from "../helpers/careerFlow.mjs";
import { installSeededRandom } from "../helpers/seededRandom.mjs";

test("free agency moves lineup bats between teams without corrupting the rosters", async ({ page }) => {
  test.setTimeout(300_000);
  await installSeededRandom(page, 909090);
  await startCareer(page, { decadeIndex: 5 });

  const s0 = await readActiveCareer(page);
  const startTeamOf = {};
  Object.entries(s0.career.teamLineups || {}).forEach(([tid, arr]) => arr.forEach(id => { if (id !== "user") startTeamOf[id] = tid; }));

  let last = s0;
  for (let i = 0; i < 10; i++) {
    if (!(await advanceOneSeason(page))) break;
    const s = await readActiveCareer(page);
    if (s) last = s;
  }
  const c = last.career;

  // FA activity happened -- a realistic per-year trickle, not chaos and not nothing
  const faNews = (c.leagueNewsLog || []).filter(n => /Free-Agent Bat Signs/.test(n.title));
  const seasons = c.seasonLog.length;
  expect(faNews.length, "free-agent bat signings over the career").toBeGreaterThan(seasons * 2);
  expect(faNews.length).toBeLessThan(seasons * 22);

  // roster integrity: no bat in two lineups; every team fields 8-9; the player is in exactly one
  const seen = new Map();
  let userSlots = 0;
  Object.entries(c.teamLineups || {}).forEach(([tid, arr]) => {
    expect(arr.length).toBeGreaterThanOrEqual(8);
    expect(arr.length).toBeLessThanOrEqual(9);
    arr.forEach(id => {
      if (id === "user") { userSlots++; return; }
      expect(seen.has(id), `bat ${id} is in two lineups (${seen.get(id)} and ${tid})`).toBe(false);
      seen.set(id, tid);
    });
  });
  expect(userSlots, "the player occupies exactly one lineup slot").toBe(1);

  // position consistency: a bat that changed teams still plays his position on the new club
  let movers = 0;
  Object.entries(c.teamLineups || {}).forEach(([tid, arr]) => arr.forEach(id => {
    if (id === "user" || !startTeamOf[id] || startTeamOf[id] === tid) return;
    movers++;
    const e = c.qbsById[id];
    if (e) {
      // he's in this team's lineup and it covers his own position with him
      const covered = arr.map(x => (c.qbsById[x] || {}).position);
      expect(covered.filter(p => p === e.position).length, `${id} at ${e.position} on ${tid}`).toBe(1);
    }
  }));
  expect(movers, "some bats changed teams over the decade").toBeGreaterThan(3);

  // save size still under the ceiling with a full, churning league
  const mb = JSON.stringify(last).length / 1048576;
  expect(mb, `save ${mb.toFixed(2)} MB`).toBeLessThan(4.7);
});
