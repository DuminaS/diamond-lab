import { test, expect } from "@playwright/test";
import { startCareer, advanceOneSeason, readActiveCareer } from "../helpers/careerFlow.mjs";
import { installSeededRandom } from "../helpers/seededRandom.mjs";

// Phase 3 smoke: a career can be built and run for several seasons without a page error, and the
// season card shows a real batting line (not football stats).
test("baseball career runs several seasons without errors", async ({ page }) => {
  test.setTimeout(180_000);
  const errors = [];
  page.on("pageerror", e => errors.push(String(e)));
  page.on("console", m => { if (m.type() === "error") errors.push(m.text()); });

  await installSeededRandom(page, 7);
  await startCareer(page, { decadeIndex: 4 });
  await expect(page.locator("#careerContent .season-card")).toBeVisible();

  // Collect the first few seasons' persisted stat lines before the career can end (retirement
  // clears the active save) -- a short washout career is a legitimate outcome, so read as we go.
  let seasons = [];
  for (let i = 0; i < 6; i++) {
    const saved = await readActiveCareer(page);
    if (saved?.career?.seasonLog?.length) seasons = saved.career.seasonLog;
    const ok = await advanceOneSeason(page);
    if (!ok) break;
  }
  const savedFinal = await readActiveCareer(page);
  if (savedFinal?.career?.seasonLog?.length) seasons = savedFinal.career.seasonLog;

  expect(seasons.length).toBeGreaterThanOrEqual(3);
  // Pick the first season the player actually played a full slate in (a rookie can open his career
  // as a backup / lose most of it to injury -- a real outcome, just not what this line checks).
  const s = seasons.find(x => (x.pa || 0) > 300);
  expect(s, `expected at least one full everyday season in ${JSON.stringify(seasons.map(x => x.pa))}`).toBeTruthy();
  // real batting fields present and plausible
  expect(s.pa).toBeGreaterThan(200);
  expect(s.hr).toBeGreaterThanOrEqual(0);
  expect(s.avg).toBeGreaterThan(0.15);
  expect(s.avg).toBeLessThan(0.45);
  expect(s.obp).toBeGreaterThan(s.avg - 0.01);
  expect(s.opsPlus).toBeGreaterThan(20);

  expect(errors, errors.join("\n")).toEqual([]);
});
