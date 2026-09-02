// Wave 5 (MASTER_REMEDIATION_SPEC.md), Section 8 exit-criteria scenario #21 and the wave's own
// stated exit criteria: "opening any team from standings shows the same persistent grades before/
// after navigation/reload" and "unit ranks equal a direct sort of active-team profiles" and "team
// overall calculations are reproducible from displayed components." Opens a real OTHER team's
// generic page from the Standings tab, captures its five components/overall/ranks, reloads the
// page (forcing every render to recompute from the persisted save from scratch), reopens the same
// team, and confirms byte-for-byte identical numbers. Separately re-derives that team's overall
// from its own displayed components (the documented weights) and its rank from a plain sort of
// every other active team's own leagueTeamGrades, confirming both match what the page showed.
import { test, expect } from "@playwright/test";
import { startCareer, advanceOneSeason, readActiveCareer } from "../helpers/careerFlow.mjs";
import { installSeededRandom } from "../helpers/seededRandom.mjs";

test("team-page-grades-persist-and-rank", async ({ page }) => {
  test.setTimeout(180_000);
  await installSeededRandom(page, 42042);
  await startCareer(page, { decadeIndex: 3 });

  for (let i = 0; i < 3; i++) {
    const stillActive = await page.evaluate(() => !!localStorage.getItem("gridironlab.activeCareer"));
    if (!stillActive) break;
    await advanceOneSeason(page);
  }

  // Open the Standings tab and click into the first OTHER team's name link.
  await page.evaluate(() => {
    const btn = document.querySelector('.dash-tab[data-tab="standings"]');
    if (btn) btn.click();
  });
  await page.waitForTimeout(150);
  const myTeamId = (await readActiveCareer(page)).career.teamId;
  const otherTeamId = await page.evaluate((mine) => {
    const link = Array.from(document.querySelectorAll("#tabpanel-standings [data-team-id]"))
      .find(el => el.dataset.teamId && el.dataset.teamId !== mine);
    return link ? link.dataset.teamId : null;
  }, myTeamId);
  expect(otherTeamId, "expected at least one other team's link on the Standings tab").toBeTruthy();

  async function openAndCapture(teamId) {
    await page.evaluate((tid) => {
      const link = Array.from(document.querySelectorAll("#tabpanel-standings [data-team-id]")).find(el => el.dataset.teamId === tid);
      link.click();
    }, teamId);
    await page.waitForTimeout(150);
    const data = await page.evaluate(() => {
      const overallEl = document.querySelector("#teamProfileOverlay .rival-meta");
      const nums = Array.from(document.querySelectorAll("#teamProfileOverlay .tg-num")).map(el => parseInt(el.textContent.replace(/[()]/g, ""), 10));
      const ranks = Array.from(document.querySelectorAll("#teamProfileOverlay .tg-rank")).map(el => el.textContent.trim());
      return { overallText: overallEl ? overallEl.textContent : null, nums, ranks };
    });
    await page.evaluate(() => document.querySelector("#teamProfileOverlay .rival-close")?.click());
    return data;
  }

  const before = await openAndCapture(otherTeamId);
  expect(before.nums.length).toBe(5);
  expect(before.ranks.length).toBe(5);

  await page.reload();
  const resumeBtn = page.locator("#resumeCareerBtn");
  if (await resumeBtn.count()) await resumeBtn.click();
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    const btn = document.querySelector('.dash-tab[data-tab="standings"]');
    if (btn) btn.click();
  });
  await page.waitForTimeout(150);
  const after = await openAndCapture(otherTeamId);

  expect(after.nums, "the same team's five grades must be byte-for-byte identical after a reload").toEqual(before.nums);
  expect(after.overallText).toBe(before.overallText);
  expect(after.ranks).toEqual(before.ranks);

  // Overall must be exactly the documented weighted derivation of the five displayed components.
  const [oline, weapons, defense, coaching, gmGrade] = after.nums;
  const expectedOverall = Math.round(oline * 0.20 + weapons * 0.20 + defense * 0.30 + coaching * 0.20 + gmGrade * 0.10);
  const overallNum = parseInt((after.overallText.match(/Team Grade\s*(\d+)/) || [])[1], 10);
  expect(overallNum).toBe(expectedOverall);

  // Rank must equal a plain sort of every ACTIVE team's own persisted overall (career.leagueStrength
  // for everyone but the player's own team, whose real teamStrength is the same derivation) --
  // restricted to founded franchises only (every one of which has exactly one live rival, or is the
  // player's own team), since career.leagueStrength itself is pre-seeded at career start for every
  // team that will EVER exist, including ones not founded yet in this exact season.
  const saved = await readActiveCareer(page);
  const activeTeamIds = new Set([...(saved.career.leagueRivals || []).map(r => r.teamId), saved.career.teamId]);
  const strengths = { ...saved.career.leagueStrength, [saved.career.teamId]: saved.career.teamStrength };
  const sortedDesc = Object.entries(strengths)
    .filter(([id]) => activeTeamIds.has(id))
    .sort((a, b) => b[1] - a[1]).map(([id]) => id);
  const expectedRank = sortedDesc.indexOf(otherTeamId) + 1;
  const shownOverallRank = parseInt((after.overallText.match(/#(\d+) of/) || [])[1], 10);
  expect(shownOverallRank).toBe(expectedRank);
});
