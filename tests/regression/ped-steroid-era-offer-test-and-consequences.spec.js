// Phase 14: the steroid-era system. A hitter can be offered PEDs (a real choice, not a random
// infraction), a background test runs every offseason regardless, and from 2007 on a positive
// costs real games and escalates. Getting caught forces him off the program and hands hofVerdict()
// a strike that Cooperstown holds against the resume.
import { test, expect } from "@playwright/test";
import { startCareer, advanceOneSeason, readActiveCareer, writeActiveCareer } from "../helpers/careerFlow.mjs";
import { installSeededRandom } from "../helpers/seededRandom.mjs";

async function resumeAfterWrite(page) {
  await page.reload();
  const resumeBtn = page.locator("#resumeCareerBtn");
  if (await resumeBtn.count()) await resumeBtn.click();
  await page.waitForTimeout(300);
}

test("the PED offer renders a real choice and accepting starts the program", async ({ page }) => {
  test.setTimeout(180_000);
  await installSeededRandom(page, 3);
  await startCareer(page, { decadeIndex: 4 }); // 1990s -- the offer chance is elevated all decade
  await advanceOneSeason(page);
  await advanceOneSeason(page);

  // Force near-certain-offer preconditions: struggling, aging, on a scrap deal -- pedOfferChanceForYear
  // clamps this blend to its 0.45/season ceiling.
  const saved = await readActiveCareer(page);
  expect(saved, "seed-3 1990s career should survive two seasons").toBeTruthy();
  saved.career.age = Math.max(saved.career.age, 34);
  saved.career.contract = { apy: saved.career.contract.apy, years: 1, tier: "minimum" };
  if (saved.career.seasonLog.length) saved.career.seasonLog[saved.career.seasonLog.length - 1].opsPlus = 80;
  await writeActiveCareer(page, saved);
  await resumeAfterWrite(page);

  // One flat walk: click through everything (season card -> offseason -> next season card -> ...),
  // grabbing #pedYes the instant it appears. NOT using advanceOneSeason -- that auto-declines.
  let accepted = false;
  for (let step = 0; step < 260 && !accepted; step++) {
    if (!(await page.evaluate(() => !!localStorage.getItem("diamondlab.activeCareer")))) break;
    const clicked = await page.evaluate(() => {
      if (document.getElementById("pedYes")) return "ped";
      const c = document.getElementById("careerContent");
      if (!c) return null;
      const b = c.querySelector(
        "#continueBtn, #playOnBtn, [data-development-plan], button[id$='Ack'], .choice-btn:not(#pedNo), .fa-accept, [id^='pqSimSeries-']:not([disabled]), [id^='pqSimEnd-']:not([disabled]), #playoffTreeSimulateBtn:not([disabled])"
      );
      if (b && !b.disabled) { b.click(); return "click"; }
      return null;
    });
    if (clicked === "ped") {
      await page.evaluate(() => document.getElementById("pedYes").click());
      await page.waitForTimeout(150);
      accepted = true;
      break;
    }
    await page.waitForTimeout(clicked ? 90 : 150);
  }

  expect(accepted, "the PED offer should render a #pedYes choice in the wild-west 90s").toBe(true);
  {
    const s = await readActiveCareer(page);
    expect(s.career._pedUsing, "accepting flips the using flag immediately").toBe(true);
  }

  // finish the rest of this offseason + play the season (applyOrRefreshPedBoost tallies it)
  for (let step = 0; step < 60; step++) {
    if (await page.evaluate(() => !!document.querySelector("#careerContent .season-card"))) break;
    await page.evaluate(() => {
      const c = document.getElementById("careerContent");
      const b = c && c.querySelector("#continueBtn, #playOnBtn, [data-development-plan], button[id$='Ack'], .choice-btn:not(#pedNo), .fa-accept, [id^='pqSimSeries-']:not([disabled]), [id^='pqSimEnd-']:not([disabled])");
      if (b && !b.disabled) b.click();
    });
    await page.waitForTimeout(120);
  }
  const s2 = await readActiveCareer(page);
  if (s2) {
    expect(s2.career._pedSeasonsUsed, "a season on the program is counted").toBeGreaterThanOrEqual(1);
    expect(s2.career.seasonLog.some(x => x._pedSeason), "a season played while using is flagged").toBeTruthy();
  }
});

test("a positive test in the strict era: suspended, forced off the program, HOF strike recorded", async ({ page }) => {
  test.setTimeout(150_000);
  await installSeededRandom(page, 4242);
  await startCareer(page, { decadeIndex: 5 }); // 2000s -- squarely in the testing era
  await advanceOneSeason(page);
  await advanceOneSeason(page);

  const saved = await readActiveCareer(page);
  expect(saved).toBeTruthy();
  saved.career._pedUsing = true;
  saved.career._pedSeasonsUsed = 2;
  saved.career._pedStartYear = saved.career.year;
  await writeActiveCareer(page, saved);
  await resumeAfterWrite(page);

  let caughtYear = null;
  for (let i = 0; i < 12; i++) {
    if (!(await page.evaluate(() => !!localStorage.getItem("diamondlab.activeCareer")))) break;
    if (!(await advanceOneSeason(page))) break;
    const s = await readActiveCareer(page);
    if (!s) break;
    if ((s.career._pedCaught || 0) >= 1) { caughtYear = s.career.year; break; }
  }

  expect(caughtYear, "a career using PEDs through the strict testing era gets caught").toBeTruthy();
  const fin = await readActiveCareer(page);
  if (fin) {
    expect(fin.career._pedCaught).toBeGreaterThanOrEqual(1);
    expect(fin.career._pedUsing, "getting caught forces him off the program").toBeFalsy();
    expect(
      (fin.career.transactions || []).some(t => /Suspended .* for a positive PED test/i.test(t)),
      "the suspension is on the transaction log"
    ).toBe(true);
    expect(
      (fin.career.lifeEventLog || []).some(e => /PED suspension/i.test(e.title || "")),
      "the suspension is on the life-event log for the HOF narrative"
    ).toBe(true);
  }
});
