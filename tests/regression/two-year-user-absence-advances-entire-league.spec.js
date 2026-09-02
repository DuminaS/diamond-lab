// Wave 3 (MASTER_REMEDIATION_SPEC.md), Section 8 scenario #11 / exit criterion: "In a two-year user
// suspension, every other active QB ages two years and the league produces two champions, two
// award sets, and two team-history rows." Forces a real two-season suspension, walks through both
// frozen years via simulateLeagueYearWithoutUser (see renderSuspensionYear), and confirms: a real
// rival aged by exactly 2 and gained two new season rows (one per frozen year); the player's own
// team gained two new teamSeasonHistory rows (one per frozen year, each with a real record); and
// the league crowned a real champion both years (season.leagueStandings.playoffBracket exists with
// a real superBowlWinnerId for both of the player's own two absence-year season objects).
import { test, expect } from "@playwright/test";
import { startCareer, ensureBracketFinalized, readActiveCareer, writeActiveCareer } from "../helpers/careerFlow.mjs";
import { installSeededRandom } from "../helpers/seededRandom.mjs";

test("two-year-user-absence-advances-entire-league", async ({ page }) => {
  test.setTimeout(150_000);
  await installSeededRandom(page, 55221);
  await startCareer(page);

  const before = await readActiveCareer(page);
  const teamId = before.career.teamId;
  const rival = (before.career.leagueRivals || []).find(r => r.teamId !== teamId && !r.retired);
  test.skip(!rival, "no usable rival exists anywhere in the league this run");
  // Plenty of runway so aging two years never crosses retireAge and masks the assertion with a
  // natural-retirement branch instead of the thing actually under test.
  rival.age = 26; rival.retireAge = 45;
  const rivalId = rival.id;
  const ageBefore = rival.age;
  const historyBefore = ((before.career.teamSeasonHistory || {})[teamId] || []).length;

  before.career.suspensionSeasonsRemaining = 2;
  await writeActiveCareer(page, before);
  await page.reload();
  const resumeBtn = page.locator("#resumeCareerBtn");
  if (await resumeBtn.count()) await resumeBtn.click();
  await page.waitForTimeout(200);

  const frozenYears = [];
  // Walk through both frozen years: each one renders the "League Suspension" interstitial with
  // "Wait it out" (#suspContinue) once simulateLeagueYearWithoutUser has already run for it.
  for (let i = 0; i < 2; i++) {
    let eyebrowYear = null;
    for (let tries = 0; tries < 20 && eyebrowYear == null; tries++) {
      const eyebrow = await page.evaluate(() => document.querySelector(".ev-eyebrow")?.textContent || "");
      const match = eyebrow.match(/(\d{4})\s*·\s*League Suspension/);
      if (match) { eyebrowYear = Number(match[1]); break; }
      await ensureBracketFinalized(page);
      await page.evaluate(() => {
        const btn = document.getElementById("continueBtn") || document.getElementById("playOnBtn") || document.getElementById("suspContinue");
        if (btn && !btn.disabled) { btn.click(); return true; }
        const alt = document.querySelector("#careerContent .choice-btn, #careerContent button[id$='Ack'], #careerContent .fa-accept");
        if (alt) { alt.click(); return true; }
        return false;
      });
      await page.waitForTimeout(150);
    }
    expect(eyebrowYear, `expected the League Suspension screen to render for frozen year #${i + 1}`).not.toBeNull();
    frozenYears.push(eyebrowYear);
    // Click "Wait it out" EXACTLY once to move past THIS frozen year -- but only when another
    // frozen year is still expected. The suspension actually ENDS the moment this click happens on
    // the LAST frozen year's own screen ("Test the market" once remaining hits 0), landing on a
    // real, normal, THIRD season afterward -- which would tack an extra real age increment onto the
    // rival and defeat the "aged exactly two years" assertion below if clicked here.
    if (i < 1) {
      await page.evaluate(() => document.getElementById("suspContinue")?.click());
      await page.waitForTimeout(150);
    }
  }

  expect(frozenYears.length).toBe(2);
  expect(frozenYears[1], "the two frozen years must be consecutive").toBe(frozenYears[0] + 1);

  const after = await readActiveCareer(page);
  const rivalAfter = after.career.qbsById[rivalId];
  expect(rivalAfter, "the rival must still exist after two frozen years").toBeTruthy();
  expect(rivalAfter.age, "the rival must have aged exactly two years across two frozen seasons").toBe(ageBefore + 2);

  const rivalSeasonsForFrozenYears = (rivalAfter.seasons || []).filter(s => frozenYears.includes(s.year));
  expect(
    rivalSeasonsForFrozenYears.length,
    `expected the rival to have a real season row for both frozen years (${frozenYears.join(", ")}); found: ${JSON.stringify(rivalAfter.seasons.map(s => s.year))}`
  ).toBe(2);

  const historyAfter = ((after.career.teamSeasonHistory || {})[teamId] || []);
  const newHistoryRows = historyAfter.filter(h => frozenYears.includes(h.year));
  expect(
    newHistoryRows.length,
    `expected two new team-history rows for the player's own team, one per frozen year (${frozenYears.join(", ")})`
  ).toBe(2);
  expect(historyAfter.length).toBeGreaterThanOrEqual(historyBefore + 2);

  // A real champion both years: every season crowned SOME champion, real teams, never null/self-
  // contradictory placeholders.
  const mySeasons = after.career.seasonLog.filter(s => frozenYears.includes(s.year));
  expect(mySeasons.length, "the player's own seasonLog must carry a phantom row for each frozen year").toBe(2);
  mySeasons.forEach(s => {
    expect(s.games, `frozen year ${s.year} must show zero personal games played`).toBe(0);
    const bracket = s.leagueStandings && s.leagueStandings.playoffBracket;
    expect(bracket, `frozen year ${s.year} must have a fully resolved league playoff bracket`).toBeTruthy();
    expect(bracket.superBowlWinnerId, `frozen year ${s.year} must crown a real champion`).toBeTruthy();
  });
});
