// Wave 6 (MASTER_REMEDIATION_SPEC.md) named exit-criteria scenario: "stacked team with weak QB1."
// The confirmed baseline defect (Section 4): teamCompetitiveWindow/need used to be a pure aggregate-
// grade proxy, so an elite free agent could only ever match with rebuilding teams -- a stacked,
// win-now-grade team with a genuinely weak starter never called, no matter how obviously it should
// want an upgrade. Constructs that exact scenario directly (a specific away team boosted to a high
// persistent grade + a real winning/title history, with its actual rostered starter's talent
// deliberately lowered) and confirms that team both (a) appears as a real free-agent offer and
// (b) projects "starter" role -- the player is a clear upgrade over that weak incumbent.
import { test, expect } from "@playwright/test";
import { startCareer, advanceOneSeason, readActiveCareer, writeActiveCareer } from "../helpers/careerFlow.mjs";
import { installSeededRandom } from "../helpers/seededRandom.mjs";

test("fa-stacked-team-weak-qb1-gets-real-offer", async ({ page }) => {
  test.setTimeout(180_000);
  await installSeededRandom(page, 31415);
  await startCareer(page, { decadeIndex: 2 });

  for (let i = 0; i < 2; i++) {
    const stillActive = await page.evaluate(() => !!localStorage.getItem("diamondlab.activeCareer"));
    if (!stillActive) break;
    await advanceOneSeason(page);
  }

  const saved = await readActiveCareer(page);
  const myTeamId = saved.career.teamId;
  const target = (saved.career.leagueRivals || []).find(r => r.teamId !== myTeamId && !r.retired);
  expect(target, "expected at least one active rival to boost into the stacked-team scenario").toBeTruthy();
  const targetTeamId = target.teamId;

  // Make the TEAM itself unmistakably stacked: a high persistent grade plus a real recent winning/
  // title record, so teamCompetitiveWindow reads "win-now"/"contender" regardless of the QB.
  saved.career.leagueStrength[targetTeamId] = 90;
  if (!saved.career.leagueTeamGrades) saved.career.leagueTeamGrades = {};
  saved.career.leagueTeamGrades[targetTeamId] = { oline: 88, weapons: 86, defense: 90, coaching: 85, gmGrade: 80 };
  if (!saved.career.teamSeasonHistory) saved.career.teamSeasonHistory = {};
  const priorYear = saved.career.year - 1;
  saved.career.teamSeasonHistory[targetTeamId] = [
    { year: priorYear - 2, wins: 12, losses: 4, ties: 0, qbName: target.name, qbRings: 0, madePlayoffs: true, wonDivision: true, wonConference: false, wonChampionship: false, scheme: null },
    { year: priorYear - 1, wins: 13, losses: 3, ties: 0, qbName: target.name, qbRings: 0, madePlayoffs: true, wonDivision: true, wonConference: true, wonChampionship: false, scheme: null },
    { year: priorYear, wins: 11, losses: 5, ties: 0, qbName: target.name, qbRings: 0, madePlayoffs: true, wonDivision: true, wonConference: false, wonChampionship: false, scheme: null },
  ];
  // ...but its actual rostered starter is genuinely weak -- the exact "stacked team, weak QB1" gap.
  target.talent = 35;
  target.age = 29;
  if (saved.career.qbsById && saved.career.qbsById[target.id]) {
    saved.career.qbsById[target.id].talent = 35;
    saved.career.qbsById[target.id].age = 29;
  }
  // buildFreeAgentOffers shuffles candidates and stops once it finds 4 qualifying offers -- to make
  // this scenario deterministic regardless of shuffle order, every OTHER active team's incumbent is
  // boosted to elite talent (a near-zero fit score, filtered out by scoreFreeAgentFit), so the
  // target (the only genuinely needy team) is essentially guaranteed to be the one real offer.
  (saved.career.leagueRivals || []).forEach(r => {
    if (r.teamId === myTeamId || r.teamId === targetTeamId || r.retired) return;
    r.talent = 96; r.age = 27;
    if (saved.career.qbsById && saved.career.qbsById[r.id]) { saved.career.qbsById[r.id].talent = 96; saved.career.qbsById[r.id].age = 27; }
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
      return false;
    });
    await page.waitForTimeout(clicked ? 100 : 150);
  }
  expect(sawOffers, "expected the free-agent market to render").toBe(true);

  const stackedOffer = await page.evaluate((tid) => {
    const card = Array.from(document.querySelectorAll(".fa-offer")).find(c => {
      const btn = c.querySelector("[data-team-id]");
      return btn && btn.dataset.teamId === tid;
    });
    if (!card) return null;
    const roleEl = card.querySelector(".fa-role");
    return { roleLabel: roleEl ? roleEl.textContent : null };
  }, targetTeamId);

  expect(stackedOffer, `expected the stacked team (${targetTeamId}) with its weak QB1 to make a real offer`).toBeTruthy();
  // A clear talent upgrade over a genuinely weak incumbent projects as the everyday player, not a
  // spring-training competition ("Sign as the everyday guy" / "Re-sign as the everyday guy").
  expect(stackedOffer.roleLabel, "a clear talent upgrade over a genuinely weak incumbent should project as the everyday guy").toContain("everyday guy");
  expect(stackedOffer.roleLabel).not.toContain("Compete for the job");
});
