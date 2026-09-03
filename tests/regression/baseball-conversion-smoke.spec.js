import { test, expect } from "@playwright/test";
import { startCareer, advanceOneSeason } from "../helpers/careerFlow.mjs";

// Phase 3 smoke: a career can be built and run for several seasons without a page error, and the
// season card shows a real batting line (not football stats).
test("baseball career runs several seasons without errors", async ({ page }) => {
  const errors = [];
  page.on("pageerror", e => errors.push(String(e)));
  page.on("console", m => { if (m.type() === "error") errors.push(m.text()); });

  await startCareer(page, { decadeIndex: 4 });
  await expect(page.locator("#careerContent .season-card")).toBeVisible();

  for (let i = 0; i < 6; i++) {
    const ok = await advanceOneSeason(page);
    if (!ok) break;
  }

  const save = await page.evaluate(() => JSON.parse(localStorage.getItem("diamondlab.activeCareer")));
  const seasons = save.career.seasonLog;
  expect(seasons.length).toBeGreaterThanOrEqual(3);
  const s = seasons[0];
  // real batting fields present and plausible
  expect(s.pa).toBeGreaterThan(200);
  expect(s.hr).toBeGreaterThanOrEqual(0);
  expect(s.avg).toBeGreaterThan(0.15);
  expect(s.avg).toBeLessThan(0.45);
  expect(s.obp).toBeGreaterThan(s.avg - 0.01);
  expect(s.opsPlus).toBeGreaterThan(20);

  expect(errors, errors.join("\n")).toEqual([]);
});
