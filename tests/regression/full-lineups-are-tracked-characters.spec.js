// Phase 15a: every batting-order slot on every team is a real registry entity with a position and
// a real season line -- not the old one-tracked-hitter-per-team model. This checks the full league
// of ~250 tracked bats persists, competes on the "Played This Season" leaderboard, keeps the save
// under budget, and that awards still resolve against the deeper field.
import { test, expect } from "@playwright/test";
import { startCareer, advanceOneSeason, readActiveCareer } from "../helpers/careerFlow.mjs";
import { installSeededRandom } from "../helpers/seededRandom.mjs";

test("the whole league is real tracked hitters, and the save stays under budget", async ({ page }) => {
  test.setTimeout(360_000);
  await installSeededRandom(page, 909090);
  await startCareer(page, { decadeIndex: 5 });

  let last = null;
  for (let i = 0; i < 18; i++) {
    const s = await readActiveCareer(page);
    if (s) last = s;
    if (!(await advanceOneSeason(page))) break;
  }
  const fin = await readActiveCareer(page);
  if (fin) last = fin;
  expect(last, "career should have produced seasons").toBeTruthy();
  const c = last.career;

  // every existing team has a full batting order of registry ids covering each position
  const lineups = c.teamLineups || {};
  const teamIds = Object.keys(lineups);
  expect(teamIds.length).toBeGreaterThan(20);
  const POS = ["C", "1B", "2B", "3B", "SS", "LF", "CF", "RF"];
  let teamsChecked = 0;
  const playerTeam = c.teamId;
  teamIds.forEach(tid => {
    const arr = lineups[tid];
    expect(arr.length, `team ${tid} lineup size`).toBeGreaterThanOrEqual(8);
    expect(arr.length).toBeLessThanOrEqual(9);
    const positions = new Set(arr.filter(id => id !== "user").map(id => (c.qbsById[id] || {}).position).filter(Boolean));
    // real entities cover the fielding positions -- the one exception is the single slot the player
    // himself occupies on his own team (stored as "user", no qbsById entry)
    const missing = POS.filter(p => !positions.has(p));
    if (tid === playerTeam) {
      expect(missing.length, `player team ${tid} missing at most his own position: ${missing}`).toBeLessThanOrEqual(1);
    } else {
      expect(missing, `team ${tid} covers every fielding position`).toEqual([]);
    }
    teamsChecked++;
  });
  expect(teamsChecked).toBeGreaterThan(20);

  // the deep field of real tracked bats -- every active lineup hitter keeps at least his most
  // recent season line (supporting cast is trimmed to a rolling window, so older years thin out)
  const withAnyRow = Object.values(c.qbsById || {}).filter(e => (e.seasons || []).length > 0).length;
  expect(withAnyRow, "hundreds of tracked hitters carry a real season line").toBeGreaterThan(200);
  const recentYears = c.seasonLog.slice(-2).map(s => s.year);
  const recentRows = Object.values(c.qbsById || {}).filter(e => (e.seasons || []).some(s => recentYears.includes(s.year))).length;
  expect(recentRows, `real season lines across the last two years ${recentYears}`).toBeGreaterThan(120);

  // an MVP was granted somewhere in the league in a recent year (against the deeper field)
  const mvpCount = Object.values(c.qbsById || {}).filter(e =>
    (e.seasons || []).some(s => (s.awards || []).includes("MVP"))).length
    + (c.seasonLog.some(s => (s.awards || []).includes("MVP")) ? 1 : 0);
  expect(mvpCount, "MVPs are granted against the deeper field").toBeGreaterThanOrEqual(1);

  // save size stays comfortably under the localStorage ceiling
  const mb = JSON.stringify(last).length / 1048576;
  expect(mb, `save size ${mb.toFixed(2)} MB`).toBeLessThan(4.7);
});

test("the Played This Season leaderboard lists the full field and a lineup hitter has a profile", async ({ page }) => {
  test.setTimeout(180_000);
  await installSeededRandom(page, 4242);
  await startCareer(page, { decadeIndex: 5 });
  await advanceOneSeason(page);
  await advanceOneSeason(page);

  await page.evaluate(() => document.querySelector('.dash-tab[data-tab="league"]')?.click());
  await page.waitForTimeout(200);
  const rows = await page.evaluate(() => {
    const panel = document.querySelector('#careerContent [data-league-panel="active"]');
    const tb = panel && panel.querySelector("table tbody");
    return tb ? tb.querySelectorAll("tr").length : 0;
  });
  expect(rows, "the leaderboard shows the whole league of hitters, not ~30").toBeGreaterThan(120);

  // open a rival hitter's profile from the leaderboard
  const opened = await page.evaluate(() => {
    const panel = document.querySelector('#careerContent [data-league-panel="active"]');
    const link = panel && panel.querySelector(".rival-link[data-rival-id]");
    if (!link) return false;
    link.click();
    return true;
  });
  expect(opened).toBe(true);
  await page.waitForTimeout(200);
  const profile = await page.evaluate(() => {
    const o = document.getElementById("rivalProfileOverlay");
    return o ? o.textContent.slice(0, 400) : null;
  });
  expect(profile, "a rival hitter profile renders").toBeTruthy();
  expect(profile).toMatch(/Age \d+/);
});
