// Review finding 8: "storage deserves realistic long-career testing." A ~16-season career (with
// the full ~490-entity league of tracked hitters AND pitching staffs) must keep serializing and
// round-tripping, and the save must stay well under the localStorage ceiling.
import { test, expect } from "@playwright/test";
import { startCareer, advanceSeasons, readActiveCareer, ACTIVE_CAREER_KEY } from "../helpers/careerFlow.mjs";
import { installSeededRandom } from "../helpers/seededRandom.mjs";

test("a long career's save stays bounded and round-trips through a reload", async ({ page }) => {
  test.setTimeout(480_000);
  await installSeededRandom(page, 37);
  await startCareer(page, { decadeIndex: 5 });

  const advanced = await advanceSeasons(page, 15);
  expect(advanced, "the career should play many seasons").toBeGreaterThanOrEqual(12);

  const saved = await readActiveCareer(page);
  expect(saved, "the career must still be persisted").toBeTruthy();

  // every write succeeded -- the visible warning never showed
  expect(await page.locator("#saveWarning").isVisible()).toBe(false);

  const bytes = JSON.stringify(saved).length;
  const mb = bytes / 1048576;
  expect(mb, `save is ${mb.toFixed(2)} MB after ${saved.career.seasonLog.length} seasons`).toBeLessThan(4.6);
  // a chunky safety margin under the ~5 MB browser quota
  expect(bytes).toBeLessThan(5 * 1024 * 1024 * 0.92);

  // the save actually deserializes and resumes cleanly
  await page.reload();
  await page.waitForSelector("#resumeCareerBtn", { timeout: 10_000 });
  await page.click("#resumeCareerBtn");
  await page.waitForSelector("#careerContent .season-card", { timeout: 10_000 });
  const after = await readActiveCareer(page);
  expect(after.career.seasonLog.length).toBe(saved.career.seasonLog.length);
  expect(after.career.year).toBe(saved.career.year);

  // one more season still works post-reload
  const more = await advanceSeasons(page, 1);
  if (more > 0) {
    const s2 = await readActiveCareer(page);
    expect(s2.career.seasonLog.length).toBe(saved.career.seasonLog.length + 1);
    expect(JSON.stringify(s2).length / 1048576).toBeLessThan(4.7);
  }
});
