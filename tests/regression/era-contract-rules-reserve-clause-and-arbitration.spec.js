// Phase 13c: era-accurate contract control. Player free agency did not exist before 1976 -- a
// pre-1976 player whose deal is up is renewed by his club under the reserve clause, no market,
// no negotiation. (Post-1976 the 6-year rookie deal already models the service-time window, and
// a player on a later short deal who hasn't banked 6 years goes to arbitration, not the market.)
import { test, expect } from "@playwright/test";
import { startCareer, readActiveCareer, writeActiveCareer } from "../helpers/careerFlow.mjs";
import { installSeededRandom } from "../helpers/seededRandom.mjs";

test("a pre-1976 contract expiry is a reserve-clause renewal, not free agency", async ({ page }) => {
  test.setTimeout(180_000);
  await installSeededRandom(page, 5150);
  // decadeIndex 1 -> the 1960s (helper card 0 is "Random"), so career.year is deep in the reserve era.
  await startCareer(page, { decadeIndex: 1 });

  const saved = await readActiveCareer(page);
  expect(saved.career.year).toBeLessThan(1976);
  const teamBefore = saved.career.teamId;
  saved.career.contract.years = 0; // force the deal to be "up"
  await writeActiveCareer(page, saved);
  await page.reload();
  const resumeBtn = page.locator("#resumeCareerBtn");
  if (await resumeBtn.count()) await resumeBtn.click();
  await page.waitForTimeout(300);

  // walk interstitials until we land on the renewal screen (has #renewAck) or an offer market
  let sawRenewal = false, sawOffers = false;
  for (let i = 0; i < 90 && !sawRenewal && !sawOffers; i++) {
    const state = await page.evaluate(() => ({
      offers: document.querySelectorAll(".fa-offer").length,
      renewBtn: !!document.getElementById("renewAck"),
    }));
    if (state.offers > 0) { sawOffers = true; break; }
    if (state.renewBtn) { sawRenewal = true; break; }
    await page.evaluate(() => {
      const content = document.getElementById("careerContent");
      const simEnd = document.querySelector("#playoffRoundsHolder [id^='pqSimEnd-']:not([disabled])");
      if (simEnd) { simEnd.click(); return; }
      const contBtn = document.getElementById("continueBtn") || document.getElementById("playOnBtn");
      if (contBtn && !contBtn.disabled) { contBtn.click(); return; }
      const simRoundBtn = document.getElementById("playoffTreeSimulateBtn");
      if (simRoundBtn && !simRoundBtn.disabled) { simRoundBtn.click(); return; }
      const btn = content && content.querySelector(".choice-btn, [id^='pqAck-'], button[id$='Ack']");
      if (btn) { btn.click(); return; }
    });
    await page.waitForTimeout(130);
  }

  expect(sawOffers, "a pre-1976 player must NOT see an open free-agent market").toBe(false);
  expect(sawRenewal, "a pre-1976 player's expired deal should produce a reserve-clause renewal").toBe(true);

  await page.evaluate(() => document.getElementById("renewAck")?.click());
  await page.waitForTimeout(300);

  const after = await readActiveCareer(page);
  if (after) {
    // same club, a fresh 1-year deal, tagged as reserve-clause control
    expect(after.career.teamId, "reserve-clause renewal keeps the player on the same club").toBe(teamBefore);
    const txn = after.career.transactions.find(t => /Renewed by the .*reserve clause/i.test(t));
    expect(txn, `transactions: ${JSON.stringify(after.career.transactions.slice(-4))}`).toBeTruthy();
  }
});
