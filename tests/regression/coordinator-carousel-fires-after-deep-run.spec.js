// Balance Wave 4 ("Coordinator carousel" -- "Deep playoff runs should cause assistants to be hired
// elsewhere... a fair, visible 'success tax' and creates dynasty turnover without forced losses"):
// applyCoordinatorCarouselIfDue looks at the PREVIOUS season's fully-resolved playoff record (the
// current season's own run isn't decided yet at the point this check runs -- see that function's
// own comment) and, only for a Conference Championship or Super Bowl finish, rolls a real chance of
// a coaching-grade hit. Forced deterministically via a fabricated (but structurally valid)
// previous-season playoffs record injected directly into the save, plus Math.random pinned to a
// fixed 0.24 (below both carousel thresholds, 0.25/0.38, but above the tiny odds most of this
// project's OTHER seasonal rolls use -- a blanket 0 would make every rare-event/infraction/locker-
// room roll fire deterministically too, which risks steering advanceOneSeason's generic interstitial
// walker into an unrelated screen instead of the season transition this test actually wants) so the
// carousel roll always succeeds -- this is about the MECHANISM firing and applying its effect
// correctly, not about reaching a real Super Bowl run through actual gameplay.
import { test, expect } from "@playwright/test";
import { startCareer, advanceOneSeason, readActiveCareer, writeActiveCareer } from "../helpers/careerFlow.mjs";
import { installSeededRandom } from "../helpers/seededRandom.mjs";

async function forceLastSeasonPlayoffResult(page, round, won) {
  const saved = await readActiveCareer(page);
  const lastSeason = saved.career.seasonLog[saved.career.seasonLog.length - 1];
  lastSeason.playoffs = {
    made: true,
    done: true,
    rounds: [{ round, won, opponent: "Test Rival", myScore: won ? 27 : 14, oppScore: won ? 14 : 27 }],
  };
  saved.career._coordinatorCarouselCheckedYear = null; // force a fresh check next season
  await writeActiveCareer(page, saved);
  return saved;
}

test("a Super Bowl loss can trigger the coordinator carousel", async ({ page }) => {
  test.setTimeout(120_000);
  await installSeededRandom(page, 13579);
  await startCareer(page, { decadeIndex: 1 });

  const saved = await forceLastSeasonPlayoffResult(page, "Super Bowl", false);
  const coachingBefore = saved.career.coaching;

  await page.reload();
  const resumeBtn = page.locator("#resumeCareerBtn");
  if (await resumeBtn.count()) await resumeBtn.click();
  await page.waitForTimeout(200);
  await page.evaluate(() => { Math.random = () => 0.24; }); // below both carousel thresholds (0.25/0.38) but above most other tiny event odds
  const ok = await advanceOneSeason(page);
  expect(ok).toBe(true);

  const after = await readActiveCareer(page);
  expect(after.career.coaching, "a deep-run coordinator carousel hit must actually lower coaching").toBeLessThan(coachingBefore);
  const carouselTxn = after.career.transactions.find(t => t.includes("Coordinator carousel"));
  expect(carouselTxn, `transactions: ${JSON.stringify(after.career.transactions.slice(-3))}`).toBeTruthy();
});

test("a Wild Card exit never triggers the coordinator carousel", async ({ page }) => {
  test.setTimeout(120_000);
  await installSeededRandom(page, 13579);
  await startCareer(page, { decadeIndex: 1 });

  await forceLastSeasonPlayoffResult(page, "Wild Card", false);

  await page.reload();
  const resumeBtn = page.locator("#resumeCareerBtn");
  if (await resumeBtn.count()) await resumeBtn.click();
  await page.waitForTimeout(200);
  // Math.random pinned below the carousel's own thresholds -- if the mechanism incorrectly treated
  // a shallow exit as eligible, this would guarantee it fires; it must not even roll. (Coaching
  // itself isn't asserted unchanged here -- ordinary seasonal drift, unrelated to the carousel,
  // legitimately moves all five team grades a little every year regardless.)
  await page.evaluate(() => { Math.random = () => 0.24; });
  const ok = await advanceOneSeason(page);
  expect(ok).toBe(true);

  const after = await readActiveCareer(page);
  const carouselTxn = after.career.transactions.find(t => t.includes("Coordinator carousel"));
  expect(carouselTxn, `transactions: ${JSON.stringify(after.career.transactions.slice(-3))}`).toBeFalsy();
});

test("the carousel check only runs once per year even if re-entered", async ({ page }) => {
  test.setTimeout(120_000);
  await installSeededRandom(page, 13579);
  await startCareer(page, { decadeIndex: 1 });

  await forceLastSeasonPlayoffResult(page, "Super Bowl", true);
  await page.reload();
  const resumeBtn = page.locator("#resumeCareerBtn");
  if (await resumeBtn.count()) await resumeBtn.click();
  await page.waitForTimeout(200);
  await page.evaluate(() => { Math.random = () => 0.24; });
  await advanceOneSeason(page);

  const afterFirst = await readActiveCareer(page);
  const coachingAfterFirst = afterFirst.career.coaching;
  const carouselCountAfterFirst = afterFirst.career.transactions.filter(t => t.includes("Coordinator carousel")).length;
  expect(carouselCountAfterFirst).toBeGreaterThan(0);

  // Reload and resume again without changing anything else -- the guard
  // (_coordinatorCarouselCheckedYear===career.year) must prevent a second roll/hit for the same year.
  await page.reload();
  const resumeBtn2 = page.locator("#resumeCareerBtn");
  if (await resumeBtn2.count()) await resumeBtn2.click();
  await page.waitForTimeout(200);

  const afterReload = await readActiveCareer(page);
  expect(afterReload.career.coaching).toBe(coachingAfterFirst);
  const carouselCountAfterReload = afterReload.career.transactions.filter(t => t.includes("Coordinator carousel")).length;
  expect(carouselCountAfterReload).toBe(carouselCountAfterFirst);
});
