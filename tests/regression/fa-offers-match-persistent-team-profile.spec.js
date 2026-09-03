// Wave 5 (MASTER_REMEDIATION_SPEC.md), Section 8 exit-criteria scenarios #21/#22/#23, exercised
// together since they all hinge on the same fix: buildFreeAgentOffers used to roll a FRESH,
// independent set of oline/weapons/defense/coaching/gmGrade for every away-team offer
// (rollSupportingCastGrade) instead of reading that team's real, persistent profile
// (career.leagueTeamGrades, the exact same data the generic Team page/openTeamProfile shows) --
// meaning the SAME team could show two different sets of grades depending on whether you opened
// its Team page or its FA offer card, and accepting an offer could hand you grades nobody had
// actually seen from that team's own page. This confirms, for a real away-team offer:
//   #21 the generic Team page opened straight from the offer card (the exact same [data-team-id]
//       click a real player would make) shows the SAME five grades as the persistent profile.
//   #22 accepting that offer gives the player EXACTLY those previewed grades on career.* --
//       byte-for-byte, no re-roll at signing time.
//   #23 the offer's own projected role (data-fa-role, carried straight into the Team page's
//       "if you sign here" line) is unchanged by opening the Team page in between -- both surfaces
//       read the identical string, never two independently-derived role estimates.
// Also confirms the OLD team's profile is preserved (not re-rolled) once the player leaves it --
// the other half of the same architectural fix (handOffTeamProfile).
import { test, expect } from "@playwright/test";
import { startCareer, advanceOneSeason, readActiveCareer, writeActiveCareer } from "../helpers/careerFlow.mjs";
import { installSeededRandom } from "../helpers/seededRandom.mjs";

test("fa-offers-match-persistent-team-profile", async ({ page }) => {
  test.setTimeout(180_000);
  await installSeededRandom(page, 90210);
  await startCareer(page, { decadeIndex: 2 });

  // A couple of real seasons first, so career.leagueTeamGrades holds real, already-established
  // values (via ensureLeagueTeamGrades/resolvePlayoffs) rather than career-start defaults only.
  for (let i = 0; i < 2; i++) {
    const stillActive = await page.evaluate(() => !!localStorage.getItem("gridironlab.activeCareer"));
    if (!stillActive) break;
    await advanceOneSeason(page);
  }

  const beforeSign = await readActiveCareer(page);
  expect(beforeSign, "career should still be active after 2 seasons").toBeTruthy();
  const oldTeamId = beforeSign.career.teamId;
  const oldGradesBeforeLeaving = {
    oline: beforeSign.career.oline, weapons: beforeSign.career.weapons, defense: beforeSign.career.defense,
    coaching: beforeSign.career.coaching, gmGrade: beforeSign.career.gmGrade,
  };

  // Force free agency at the very next advance -- a direct, deterministic save mutation (the same
  // "reach a specific scenario without waiting out however many real seasons a contract happens to
  // run" pattern already used by this project's other save-mutation regression tests) rather than
  // relying on a contract happening to expire within a bounded number of seeded seasons.
  beforeSign.career.contract.years = 0;
  // The previous season may have consumed an injury event and left this one-shot guard true.
  // Clear it so the Math.random override below reliably pauses on the intended injury branch.
  beforeSign.career._injuryResolved = false;
  await writeActiveCareer(page, beforeSign);
  await page.reload();
  const resumeBtn = page.locator("#resumeCareerBtn");
  if (await resumeBtn.count()) await resumeBtn.click();
  await page.waitForTimeout(300);

  // Walk clicks until the free-agent market actually renders -- resuming only re-shows the last
  // season card's own Continue/Play On button (the offseason priority chain that actually leads to
  // free agency only runs once that's clicked), so this has to click through the season-end button
  // too, then every interstitial after it (life event, injury check, waiver/trade checks that don't
  // themselves fire), stopping the INSTANT .fa-offer appears -- deliberately never using the
  // .fa-accept-inclusive generic clicker advanceOneSeason uses, which would auto-click straight
  // through the very offer this test needs to inspect first.
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

  // Pick the first AWAY-team offer -- every card (home/re-sign included) gets a [data-team-id]
  // link, but only an AWAY offer exercises the fix under test (the home/re-sign card just shows
  // career.oline etc. right back at the player, since ensureLeagueTeamGrades deliberately never
  // creates a leagueTeamGrades entry for the player's OWN current team). Identified by team id
  // (never the old team) rather than the role label text -- Wave 6 made the home offer's own role
  // a real projection too (no longer hardcoded "starter"), so a backup-competition home re-sign can
  // legitimately show the same "Camp competition" label an away offer would.
  const offerInfo = await page.evaluate((oldTid) => {
    const cards = Array.from(document.querySelectorAll(".fa-offer"));
    for (let i = 0; i < cards.length; i++) {
      const teamBtn = cards[i].querySelector("[data-team-id]");
      if (teamBtn && teamBtn.dataset.teamId !== oldTid) return { index: i, teamId: teamBtn.dataset.teamId, faRole: teamBtn.dataset.faRole };
    }
    return null;
  }, oldTeamId);
  expect(offerInfo, "expected at least one away-team FA offer with a clickable team link").toBeTruthy();

  // #21: open that team's generic page straight from the offer card, capture its five grade
  // numbers and its "if you sign here" role line.
  await page.evaluate((teamId) => {
    document.querySelector(`.fa-offer [data-team-id="${teamId}"]`).click();
  }, offerInfo.teamId);
  await page.waitForTimeout(150);
  const teamPageGrades = await page.evaluate(() => {
    const nums = Array.from(document.querySelectorAll("#teamProfileOverlay .tg-num")).map(el => parseInt(el.textContent.replace(/[()]/g, ""), 10));
    // Scheme blurb also uses .calc-refnote -- find the specific one carrying the FA role line.
    const refnote = Array.from(document.querySelectorAll("#teamProfileOverlay .calc-refnote")).find(el => el.textContent.includes("If you sign here"));
    return { nums, ifYouSignHereText: refnote ? refnote.textContent : null };
  });
  expect(teamPageGrades.nums.length, "expected five grade cards on the team page").toBe(5);
  expect(teamPageGrades.ifYouSignHereText || "").toContain(offerInfo.faRole);
  // buildGradeCardsHtml always renders in this fixed order: oline, weapons, defense, coaching, gmGrade.
  const [tgOline, tgWeapons, tgDefense, tgCoaching, tgGm] = teamPageGrades.nums;

  // Close the overlay and accept that exact offer. Force the injury-check branch that immediately
  // follows signing (checkInjuryThenPlay) to fire -- signFreeAgentOffer's own saveActiveCareer
  // checkpoint (eventId:"fa_signed") happens BEFORE that check, but if it doesn't fire, the SAME
  // synchronous click handler falls straight through to playSeasonAndRender()/generateSeason(),
  // which can legitimately drift career.oline etc via the season-end drift block (Wave 5) before
  // Playwright ever regains control to read anything -- there is no way to observe the intermediate
  // "just signed" state from outside once that's already happened in the same JS turn. Forcing the
  // injury branch (a real, harmless interstitial that requires its own separate click) guarantees a
  // stable pause point immediately after signing, before any season is generated.
  await page.evaluate(() => document.querySelector("#teamProfileOverlay .rival-close")?.click());
  await page.waitForTimeout(100);
  await page.evaluate(() => { Math.random = () => 0; });
  // Balance Wave 4: each offer card now renders 3 contract-structure accept buttons (market/
  // team-friendly/record-setting), all sharing the same data-i card index -- select the
  // market-value one specifically (data-structure) so this keeps testing the plain, at-face-value
  // accept path the raw offer numbers below are computed against.
  await page.evaluate((i) => {
    document.querySelector(`.fa-accept[data-i="${i}"][data-structure="market"]`).click();
  }, offerInfo.index);
  await page.waitForTimeout(200);

  // #22: the signed team's grades on career.* now exactly equal what the Team page previewed.
  const afterSign = await readActiveCareer(page);
  expect(afterSign.career.teamId).toBe(offerInfo.teamId);
  expect(afterSign.career.oline).toBe(tgOline);
  expect(afterSign.career.weapons).toBe(tgWeapons);
  expect(afterSign.career.defense).toBe(tgDefense);
  expect(afterSign.career.coaching).toBe(tgCoaching);
  expect(afterSign.career.gmGrade).toBe(tgGm);
  // teamStrength must be the real, reproducible derivation of those same five components (task #3),
  // never an independently-set number.
  const w = { oline: 0.20, weapons: 0.20, defense: 0.30, coaching: 0.20, gmGrade: 0.10 };
  const expectedOverall = Math.round(
    tgOline * w.oline + tgWeapons * w.weapons + tgDefense * w.defense + tgCoaching * w.coaching + tgGm * w.gmGrade
  );
  expect(afterSign.career.teamStrength).toBe(expectedOverall);
  // The team page's own persistent profile (leagueTeamGrades), read fresh from THIS post-sign save,
  // must also agree -- confirming task #21 (Standings/FA and the Team page share one source).
  const persistedProfile = afterSign.career.leagueTeamGrades[offerInfo.teamId];
  expect(persistedProfile, `team ${offerInfo.teamId} must have a persistent five-grade profile after signing`).toBeTruthy();
  expect(persistedProfile).toEqual({ oline: tgOline, weapons: tgWeapons, defense: tgDefense, coaching: tgCoaching, gmGrade: tgGm });

  // Continuity half of the same fix: the OLD team's profile is now the player's real departing
  // grades, never a fresh re-roll the moment they left.
  const oldTeamProfile = afterSign.career.leagueTeamGrades[oldTeamId];
  expect(oldTeamProfile, `the old team (${oldTeamId}) should have a persistent profile after the player left it`).toBeTruthy();
  expect(oldTeamProfile).toEqual(oldGradesBeforeLeaving);
});
