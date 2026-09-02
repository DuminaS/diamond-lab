// Wave 6 (MASTER_REMEDIATION_SPEC.md) exit criterion: "Offer role matches the Team-page projection
// and actual post-signing depth chart." Before this wave, an FA offer's role ("Sign as the starter"
// vs. "Camp competition, no guarantees") was pure flavor text -- signFreeAgentOffer never set
// career.isBackup for an away sign, so accepting a "competition" offer produced EXACTLY the same
// mechanical outcome as "starter" (the destination team's real incumbent was always displaced/
// evicted to free agency regardless of what the offer said). Now role is projected by
// projectDepthRoleForCandidate (the same SUCCESSION_PROMOTION_GAP comparison a real in-season
// promotion uses) and signFreeAgentOffer wires career.isBackup accordingly. This walks a real
// seeded career to a real free-agency event, accepts whichever offer actually renders (starter or
// competition -- both are exercised across a few different seeds/points in the career to increase
// the odds of seeing each at least once), and confirms in each case that what happens on the roster
// afterward exactly matches what the offer said would happen.
import { test, expect } from "@playwright/test";
import { startCareer, advanceOneSeason, readActiveCareer, writeActiveCareer } from "../helpers/careerFlow.mjs";
import { installSeededRandom } from "../helpers/seededRandom.mjs";

async function forceFreeAgencyAndCapture(page, seed, decadeIndex, seasonsFirst, incumbentTalent) {
  await installSeededRandom(page, seed);
  await startCareer(page, { decadeIndex });
  for (let i = 0; i < seasonsFirst; i++) {
    const stillActive = await page.evaluate(() => !!localStorage.getItem("gridironlab.activeCareer"));
    if (!stillActive) return null;
    await advanceOneSeason(page);
  }
  const saved = await readActiveCareer(page);
  if (!saved) return null;
  // Make the role branch deterministic instead of hoping a particular RNG stream happens to
  // generate the needed incumbent population. A 20-talent league clearly offers starter jobs;
  // a 65-talent league still clears the FA fit threshold but blocks this prospect from QB1.
  Object.entries(saved.career.teamQbDepth || {}).forEach(([teamId, depth]) => {
    if (teamId === saved.career.teamId || !depth?.QB1) return;
    const incumbent = saved.career.qbsById && saved.career.qbsById[depth.QB1];
    if (!incumbent) return;
    incumbent.talent = incumbentTalent;
    incumbent._originalTalent = incumbentTalent;
    incumbent.age = 27;
  });
  saved.career.contract.years = 0;
  await writeActiveCareer(page, saved);
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
  if (!sawOffers) return null;

  const offers = await page.evaluate(() => {
    return Array.from(document.querySelectorAll(".fa-offer")).map((card, i) => {
      const teamBtn = card.querySelector("[data-team-id]");
      const roleEl = card.querySelector(".fa-role");
      return { index: i, teamId: teamBtn ? teamBtn.dataset.teamId : null, roleLabel: roleEl ? roleEl.textContent : null };
    });
  });
  return { offers };
}

test("fa-role-matches-post-signing-depth-chart", async ({ page }) => {
  test.setTimeout(240_000);
  // Explicit incumbent fixtures exercise both branches. Random development changes must not be
  // able to silently remove one branch from this regression test's coverage.
  const attempts = [
    { seed: 13579, decadeIndex: 1, seasonsFirst: 0, incumbentTalent: 20, expectedRole: "starter" },
    { seed: 24681, decadeIndex: 2, seasonsFirst: 0, incumbentTalent: 65, expectedRole: "competition" },
  ];

  let sawStarter = false, sawCompetition = false;
  for (const attempt of attempts) {
    const result = await forceFreeAgencyAndCapture(page, attempt.seed, attempt.decadeIndex, attempt.seasonsFirst, attempt.incumbentTalent);
    if (!result) continue;
    const awayOffers = result.offers.filter(o => o.teamId);
    const matchingOffers = awayOffers.filter(o => attempt.expectedRole === "competition"
      ? o.roleLabel?.includes("Camp competition")
      : !o.roleLabel?.includes("Camp competition"));
    expect(matchingOffers.length, `expected a deterministic ${attempt.expectedRole} offer`).toBeGreaterThan(0);
    for (const o of matchingOffers) {
      const isCompetition = o.roleLabel && o.roleLabel.includes("Camp competition");
      if (isCompetition) sawCompetition = true; else sawStarter = true;

      const before = await readActiveCareer(page);
      const incumbentIdBefore = before.career.teamQbDepth && before.career.teamQbDepth[o.teamId] && before.career.teamQbDepth[o.teamId].QB1;

      await page.evaluate((i) => document.querySelectorAll(".fa-accept")[i].click(), o.index);
      await page.waitForTimeout(200);

      const after = await readActiveCareer(page);
      expect(after.career.teamId, `should have signed with ${o.teamId}`).toBe(o.teamId);

      if (isCompetition) {
        // signFreeAgentOffer sets career.isBackup=true synchronously, but then calls
        // checkInjuryThenPlay() -- which, on a page this fast (no interactive injury screen this
        // run), plays the WHOLE first season out before this read happens. resolveBackupCompetition
        // runs at the end of that same season and has an unconditional 5% floor to win the job
        // outright in year one regardless of how big the talent gap is (clamp(...,0.05,0.85)) -- a
        // real, pre-existing, always-possible outcome, not a bug, that a sufficiently-shifted RNG
        // stream can and (rarely) will land on. Both outcomes are legitimate: still competing
        // (isBackup still true, incumbent still at QB1), or a verified immediate win of that same
        // 5%-floor roll (isBackup now false, with the exact transaction line that roll produces --
        // this exact string check is what rules out a genuine isBackup-wiring regression silently
        // passing here instead of a real, explained competition win).
        const wonJobImmediately = after.career.isBackup === false
          && (after.career.transactions || []).some(t => t.includes("Wins the starting job."));
        if (wonJobImmediately) {
          test.info().annotations.push({ type: "note", description: `${o.teamId}: the rare (~5% floor) same-season competition win fired -- verified via the transaction log, not a bug` });
        } else {
          expect(after.career.isBackup, `a "competition" offer must actually set isBackup (unless the ~5%-floor immediate win legitimately fired -- see above)`).toBe(true);
          const incumbentIdAfter = after.career.teamQbDepth && after.career.teamQbDepth[o.teamId] && after.career.teamQbDepth[o.teamId].QB1;
          expect(incumbentIdAfter, `the real incumbent must still occupy QB1 after a competition sign`).toBe(incumbentIdBefore);
        }
      } else {
        // The offer said "starter" -- the player must NOT be marked as competing, and the team's
        // registry QB1 slot must no longer point at the old incumbent (the user's own team is never
        // tracked in teamQbDepth -- see getTeamQuarterbacks -- so the slot should be cleared/reassigned).
        expect(after.career.isBackup, `a "starter" offer must not leave the player marked as competing`).toBe(false);
        const qb1After = after.career.teamQbDepth && after.career.teamQbDepth[o.teamId] && after.career.teamQbDepth[o.teamId].QB1;
        if (incumbentIdBefore) {
          expect(qb1After, `a real incumbent must be displaced from QB1 once the player signs as the starter`).not.toBe(incumbentIdBefore);
        }
      }
      break; // one accepted offer is enough to test this attempt's scenario
    }
    if (sawStarter && sawCompetition) break;
  }

  expect(sawStarter, "expected at least one 'starter' role offer across the sweep").toBe(true);
  expect(sawCompetition, "expected at least one 'competition' role offer across the sweep").toBe(true);
});
