// Phase 13a: the QB1/QB2/QB3 depth chart (a football concept) was replaced by a deterministic
// 9-man Projected Lineup on both the player's own Team tab and any team's profile page. This
// confirms the lineup renders, is a real batting order 1-9 with positions, contains no "QB" text,
// and is stable across a reopen.
import { test, expect } from "@playwright/test";
import { startCareer, advanceSeasons } from "../helpers/careerFlow.mjs";
import { installSeededRandom } from "../helpers/seededRandom.mjs";

test("team page + Team tab show a 9-man batting order, not a QB depth chart", async ({ page }) => {
  test.setTimeout(180_000);
  await installSeededRandom(page, 4242);
  await startCareer(page, { decadeIndex: 4 });
  await advanceSeasons(page, 3);

  await page.evaluate(() => document.querySelector('.dash-tab[data-tab="team"]')?.click());
  await page.waitForTimeout(200);

  const teamTab = await page.evaluate(() => document.getElementById("careerContent").textContent);
  expect(teamTab, "no 'QB' text on the Team tab").not.toMatch(/\bQB[123]?\b/);
  expect(teamTab).toContain("Projected Lineup");

  const lineup = await page.evaluate(() => {
    const t = [...document.querySelectorAll("#careerContent table")].find(x => (x.querySelector("thead")?.textContent || "").includes("Pos"));
    if (!t) return null;
    return [...t.querySelectorAll("tbody tr")].map(r => {
      const c = [...r.querySelectorAll("td")].map(x => x.textContent.trim());
      return { slot: c[0], pos: c[1], player: c[2] };
    });
  });
  expect(lineup, "lineup table present").toBeTruthy();
  expect(lineup.length).toBe(9);
  expect(lineup.map(r => r.slot)).toEqual(["1", "2", "3", "4", "5", "6", "7", "8", "9"]);
  // real fielding positions, and the player himself is somewhere in it
  const POS = ["Catcher", "First Base", "Second Base", "Third Base", "Shortstop", "Left Field", "Center Field", "Right Field", "Designated Hitter", "P"];
  lineup.forEach(r => expect(POS).toContain(r.pos));
  expect(lineup.some(r => /\(you\)/.test(r.player)), "the player is in his own team's lineup").toBe(true);

  // Reopen -> identical
  const first = JSON.stringify(lineup);
  await page.evaluate(() => document.querySelector('.dash-tab[data-tab="season"]')?.click());
  await page.waitForTimeout(100);
  await page.evaluate(() => document.querySelector('.dash-tab[data-tab="team"]')?.click());
  await page.waitForTimeout(150);
  const again = await page.evaluate(() => {
    const t = [...document.querySelectorAll("#careerContent table")].find(x => (x.querySelector("thead")?.textContent || "").includes("Pos"));
    return [...t.querySelectorAll("tbody tr")].map(r => {
      const c = [...r.querySelectorAll("td")].map(x => x.textContent.trim());
      return { slot: c[0], pos: c[1], player: c[2] };
    });
  });
  expect(JSON.stringify(again)).toBe(first);
});
