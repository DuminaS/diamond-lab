// Balance Wave 6 ("Structured event ledger and declarative expansion... toward 250"):
// career.eventLedger is a NEW, additive, structured timeline (see recordLedgerEvent in main.js)
// feeding a small set of pure rule-builder primitives (src/sim/achievementRules.js, unit-tested in
// tests/balance/achievement-rules.node.mjs) that a growing share of ACHIEVEMENTS entries are now
// built from. Those two test layers cover the rule SHAPES and the recorder's OWN field shape in
// isolation; this file is the one place that exercises the whole chain for real -- a real signing
// actually appends a real ledger entry with the right fields (test 1), and a fabricated-but-
// structurally-valid ledger actually reaches through checkAchievements() (called from inside
// generateSeason(), see main.js line ~6236) to unlock a real, sequenceRule-built achievement
// (test 2) -- rather than trusting either layer's own unit tests to prove the wiring between them.
import { test, expect } from "@playwright/test";
import { startCareer, advanceOneSeason, readActiveCareer, writeActiveCareer } from "../helpers/careerFlow.mjs";
import { installSeededRandom } from "../helpers/seededRandom.mjs";

test("signing a free-agent offer appends a real, correctly-shaped contract_signed ledger entry", async ({ page }) => {
  test.setTimeout(180_000);
  await installSeededRandom(page, 90210);
  await startCareer(page, { decadeIndex: 2 });

  for (let i = 0; i < 2; i++) {
    const stillActive = await page.evaluate(() => !!localStorage.getItem("diamondlab.activeCareer"));
    if (!stillActive) break;
    await advanceOneSeason(page);
  }

  const beforeSign = await readActiveCareer(page);
  expect(beforeSign, "career should still be active after 2 seasons").toBeTruthy();
  const oldTeamId = beforeSign.career.teamId;
  const ledgerCountBefore = (beforeSign.career.eventLedger || []).length;

  // Same deterministic force-free-agency pattern as fa-offers-match-persistent-team-profile.spec.js.
  beforeSign.career.contract.years = 0;
  beforeSign.career._injuryResolved = false;
  await writeActiveCareer(page, beforeSign);
  await page.reload();
  const resumeBtn = page.locator("#resumeCareerBtn");
  if (await resumeBtn.count()) await resumeBtn.click();
  await page.waitForTimeout(300);

  let sawOffers = false;
  for (let i = 0; i < 80 && !sawOffers; i++) {
    sawOffers = await page.evaluate(() => document.querySelectorAll(".fa-offer").length > 0);
    if (sawOffers) break;
    const clicked = await page.evaluate(() => {
      const content = document.getElementById("careerContent");
      const simEnd = document.querySelector("#playoffRoundsHolder [id^='pqSimEnd-']:not([disabled])");
      if (simEnd) { simEnd.click(); return true; }
      const contBtn = document.getElementById("continueBtn") || document.getElementById("playOnBtn");
      if (contBtn && !contBtn.disabled) { contBtn.click(); return true; }
      const simRoundBtn = document.getElementById("playoffTreeSimulateBtn");
      if (simRoundBtn && !simRoundBtn.disabled) { simRoundBtn.click(); return true; }
      const btn = content && content.querySelector(".choice-btn, [id^='pqAck-'], button[id$='Ack']");
      if (btn) { btn.click(); return true; }
      const km = document.getElementById("keyMomentOverlay");
      if (km && km.classList.contains("open")) {
        const kb = km.querySelector(".choice-btn, button:not([disabled])");
        if (kb) { kb.click(); return true; }
      }
      return false;
    });
    await page.waitForTimeout(clicked ? 100 : 150);
  }
  expect(sawOffers, "expected the free-agent market to render within the offseason chain").toBe(true);

  const offerInfo = await page.evaluate((oldTid) => {
    const cards = Array.from(document.querySelectorAll(".fa-offer"));
    for (let i = 0; i < cards.length; i++) {
      const teamBtn = cards[i].querySelector("[data-team-id]");
      if (teamBtn && teamBtn.dataset.teamId !== oldTid) return { index: i, teamId: teamBtn.dataset.teamId };
    }
    return null;
  }, oldTeamId);
  expect(offerInfo, "expected at least one away-team FA offer with a clickable team link").toBeTruthy();

  // Accept with the record-setting structure specifically, so the ledger entry's choiceId is
  // checkable against something other than the "market" default every other FA test already uses.
  await page.evaluate((i) => {
    document.querySelector(`.fa-accept[data-i="${i}"][data-structure="recordSetting"]`).click();
  }, offerInfo.index);
  await page.waitForTimeout(200);

  const afterSign = await readActiveCareer(page);
  expect(afterSign.career.teamId).toBe(offerInfo.teamId);
  const ledger = afterSign.career.eventLedger || [];
  expect(ledger.length, "signing must append at least one new ledger entry").toBeGreaterThan(ledgerCountBefore);
  const signEntry = ledger.find(e => e.eventId === "contract_signed" && e.choiceId === "recordSetting");
  expect(signEntry, `expected a contract_signed/recordSetting entry, got: ${JSON.stringify(ledger.slice(-3))}`).toBeTruthy();
  expect(signEntry.teamId).toBe(offerInfo.teamId);
  expect(signEntry.outcomeId).toBe("signed");
  expect(typeof signEntry.sequenceIndex).toBe("number");
  expect(typeof signEntry.year).toBe("number");
});

test("a fabricated championship_lost -> championship_won ledger sequence unlocks Redemption Arc through the real checkAchievements() path", async ({ page }) => {
  test.setTimeout(120_000);
  await installSeededRandom(page, 4242);
  await startCareer(page, { decadeIndex: 1 });

  const saved = await readActiveCareer(page);
  expect(saved.career.achievements?.unlocked?.redemptionarc).toBeFalsy();

  // Structurally-valid but fabricated -- same "direct save mutation to reach a scenario without
  // waiting out real seeded seasons" convention used throughout this project's other regression
  // tests (see coordinator-carousel-fires-after-deep-run.spec.js). sequenceRule only cares about
  // eventId + relative sequenceIndex order, so this minimal shape is enough to prove the wiring.
  const baseSeq = saved.career._eventSequenceCounter || 0;
  saved.career.eventLedger = (saved.career.eventLedger || []).concat([
    { eventId: "championship_lost", year: saved.career.year - 2, seasonIndex: 0, sequenceIndex: baseSeq + 1, teamId: saved.career.teamId, opponentId: null, choiceId: null, outcomeId: null, severity: null, metadata: null },
    { eventId: "championship_won", year: saved.career.year - 1, seasonIndex: 1, sequenceIndex: baseSeq + 2, teamId: saved.career.teamId, opponentId: null, choiceId: null, outcomeId: "super_bowl", severity: null, metadata: null },
  ]);
  saved.career._eventSequenceCounter = baseSeq + 2;
  await writeActiveCareer(page, saved);
  await page.reload();
  const resumeBtn = page.locator("#resumeCareerBtn");
  if (await resumeBtn.count()) await resumeBtn.click();
  await page.waitForTimeout(200);

  // checkAchievements() runs unconditionally partway through generateSeason() (main.js ~line 6236)
  // for every season transition, well before anything ledger-specific this wave added -- one
  // ordinary advance is enough to re-scan the whole (idempotent) ACHIEVEMENTS list against the
  // fabricated ledger above.
  const ok = await advanceOneSeason(page);
  expect(ok).toBe(true);

  const after = await readActiveCareer(page);
  expect(after.career.achievements?.unlocked?.redemptionarc, "Redemption Arc should unlock from the fabricated championship_lost -> championship_won ledger sequence").toBe(true);
});
