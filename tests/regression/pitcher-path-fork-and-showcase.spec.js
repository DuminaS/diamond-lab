// Phase 16d: the Hitter / Pitcher fork on the Showcase setup screen is live. Picking "Pitcher"
// swaps the Showcase to the 12 pitching tools drawn from the pitcher pool, carries path onto the
// build, and starts a real pitcher career.
import { test, expect } from "@playwright/test";
import { advanceSeasons, readActiveCareer } from "../helpers/careerFlow.mjs";
import { installSeededRandom } from "../helpers/seededRandom.mjs";

test("picking Pitcher runs the pitching Showcase and starts a pitcher career", async ({ page }) => {
  test.setTimeout(200_000);
  await installSeededRandom(page, 5150);

  // the Showcase draws the 12 pitching tools once Pitcher is selected
  await page.goto("/");
  await page.click("#startBtn");
  await page.waitForSelector("#combineSetupBeginBtn", { timeout: 10_000 });
  await page.click('.path-card[data-path="pitcher"]');
  await page.click("#combineSetupBeginBtn");
  await page.waitForSelector("#draftAttrLabel", { timeout: 10_000 });
  const toolLabels = [];
  for (let i = 0; i < 12; i++) {
    await page.waitForSelector(".player-card", { timeout: 10_000 });
    toolLabels.push(await page.textContent("#draftAttrLabel"));
    await page.click(".player-card >> nth=0");
  }
  expect(toolLabels).toContain("Velocity");
  expect(toolLabels).toContain("Command");
  expect(toolLabels).toContain("Breaking Ball");
  expect(toolLabels.some(l => /Bat Speed|Raw Power|Contact Hitting/.test(l)), "no hitter tools in a pitching Showcase").toBe(false);

  await page.waitForSelector("#goProBtn", { timeout: 10_000 });
  await page.click("#goProBtn");
  await page.waitForSelector(".decade-card", { timeout: 10_000 });
  // identity panel shows Pitcher, no position re-roll
  expect(await page.textContent("#identityPositionValue")).toBe("Pitcher");
  expect(await page.locator("#identityPositionRerollBtn").isVisible()).toBe(false);
  await page.click(`.decade-card >> nth=5`);
  await page.waitForSelector("#enterDraftNightBtn:not([disabled])", { timeout: 10_000 });
  await page.click("#enterDraftNightBtn");
  await page.waitForSelector("#startCareerBtn", { state: "visible", timeout: 15_000 });
  await page.click("#startCareerBtn");
  for (let i = 0; i < 60; i++) {
    if (await page.evaluate(() => !!document.querySelector("#careerContent .season-card"))) break;
    await page.evaluate(() => { const b = document.querySelector("#careerContent .choice-btn, #careerContent button:not([disabled])"); if (b) b.click(); });
    await page.waitForTimeout(120);
  }

  const s0 = await readActiveCareer(page);
  expect(s0.career.path).toBe("pitcher");
  expect(s0.career.pitcherRole).toBe("SP");
  expect(s0.career.position).toBe("P");
  expect(s0.build.path).toBe("pitcher");
  expect(s0.build.VELO).toBeGreaterThan(0);

  await advanceSeasons(page, 4);
  const s = await readActiveCareer(page);
  const pitchSeasons = s.career.seasonLog.filter(x => x.isPitching);
  expect(pitchSeasons.length).toBeGreaterThanOrEqual(3);
  pitchSeasons.forEach(x => {
    expect(x.era).toBeGreaterThan(1.2);
    expect(x.era).toBeLessThan(8);
    expect(x.ip).toBeGreaterThan(40);
  });

  // the season card renders a pitching line, not .000 / 0 HR
  const cardText = await page.textContent("#tabpanel-season");
  expect(cardText).toMatch(/ERA/);
  expect(cardText).toMatch(/WHIP/);
});
