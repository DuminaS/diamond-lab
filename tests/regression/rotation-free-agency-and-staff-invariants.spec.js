// Phase 16e: free agency at staff scale. rollRotationFreeAgency moves a realistic per-year
// trickle of non-ace rotation arms and relievers between clubs (or retires them); the staff
// model stays whole (no arm in two rotations, 7-8 slots, every slot a live registered entity).
import { test, expect } from "@playwright/test";
import { startCareer, advanceSeasons, readActiveCareer, writeActiveCareer } from "../helpers/careerFlow.mjs";
import { installSeededRandom } from "../helpers/seededRandom.mjs";

const ACE_BUILD = { VELO: 90, FBL: 88, BRK: 90, CHG: 84, CMD: 90, TUN: 82, SEQ: 90, PIK: 72, STM: 88, PSE: 86, CMP: 86, DUR: 84, path: "pitcher", pitcherRole: "SP" };

test("rotation free agency reshuffles staffs without corrupting them", async ({ page }) => {
  test.setTimeout(260_000);
  await installSeededRandom(page, 616161);
  await startCareer(page, { decadeIndex: 5 });

  const saved = await readActiveCareer(page);
  const c = saved.career;
  c.path = "pitcher"; c.pitcherRole = "SP"; c.position = "P";
  saved.build = { ...ACE_BUILD };
  c.originalBuild = { ...ACE_BUILD };
  await writeActiveCareer(page, saved);
  await page.reload();
  await page.waitForSelector("#resumeCareerBtn", { timeout: 10_000 });
  await page.click("#resumeCareerBtn");
  await page.waitForSelector("#careerContent .season-card", { timeout: 10_000 });

  const advanced = await advanceSeasons(page, 8);
  expect(advanced).toBeGreaterThanOrEqual(6);

  const final = await readActiveCareer(page);
  const fc = final.career;
  const seasons = fc.seasonLog.filter(s => s.isPitching).length;

  // FA activity happened -- a realistic per-year trickle
  const faNews = (fc.leagueNewsLog || []).filter(n => /Free-Agent Arm Signs/.test(n.title));
  expect(faNews.length, "free-agent arm signings over the career").toBeGreaterThan(2);
  expect(faNews.length).toBeLessThan(seasons * 12);

  // staff integrity
  const seen = new Map();
  let userSlots = 0;
  Object.entries(fc.teamRotations || {}).forEach(([tid, arr]) => {
    expect(arr.length).toBeGreaterThanOrEqual(7);
    expect(arr.length).toBeLessThanOrEqual(8);
    arr.forEach(id => {
      if (id === "user") { userSlots++; return; }
      expect(seen.has(id), `arm ${id} in two rotations (${seen.get(id)} / ${tid})`).toBe(false);
      seen.set(id, tid);
      const e = fc.qbsById[id];
      expect(e, `arm ${id} registered`).toBeTruthy();
      expect(e.retired, `arm ${id} not retired`).toBeFalsy();
      expect(e.pitcher).toBe(true);
    });
  });
  expect(userSlots, "the player occupies exactly one rotation slot").toBe(1);

  // the invariant hook agrees
  const violations = await page.evaluate((yr) => (window.__glValidateLeagueState
    ? window.__glValidateLeagueState(JSON.parse(localStorage.getItem("diamondlab.activeCareer")).career, yr)
    : []).filter(v => /rotation|arm-in-two/.test(v.type)), fc.year);
  expect(violations, `rotation invariant violations: ${JSON.stringify(violations)}`).toEqual([]);

  // save still bounded with two full roster models churning
  const mb = JSON.stringify(final).length / 1048576;
  expect(mb, `save ${mb.toFixed(2)} MB`).toBeLessThan(4.9);
});
