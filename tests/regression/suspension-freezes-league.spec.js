// Confirmed live against HEAD (67b425c): advanceCareer()'s priority chain returns immediately into
// renderSuspensionYear() (and, by the same pattern, renderInjuryLeaveYear()) whenever
// career.suspensionSeasonsRemaining > 0 -- it never reaches the branch that calls generateSeason(),
// which is the ONLY place simulateRivalSeasons/standings/awards/expansion/contracts run. Waiting
// out a suspension therefore advances career.year with nothing else in the league moving: no rival
// ages, no new season is recorded for anyone, no team's grade drifts, no expansion franchise that
// starts that year gets initialized. This tests the product intent statement: "Historical league
// evolution continues even when the user is suspended, injured for a full season, or otherwise
// does not play."
import { test, expect } from "@playwright/test";
import { startCareer, readActiveCareer, writeActiveCareer, ensureBracketFinalized } from "../helpers/careerFlow.mjs";

test("full-year-suspension-still-advances-the-league", async ({ page }) => {
  test.setTimeout(180_000); // up to 25 simulated seasons -- can exceed the 90s default under full parallel load
  await startCareer(page);

  const before = await readActiveCareer(page);
  const rivalsBefore = (before.career.leagueRivals || []).map(r => ({ id: r.id, seasons: r.seasons.length }));
  test.skip(rivalsBefore.length === 0, "no rivals were seeded this run");

  before.career.suspensionSeasonsRemaining = 1;
  await writeActiveCareer(page, before);
  await page.reload();
  const resumeBtn = page.locator("#resumeCareerBtn");
  if (await resumeBtn.count()) await resumeBtn.click();
  await page.waitForTimeout(200);

  // The already-rendered season card advances FIRST (career.year increments inside nextSeason()
  // before advanceCareer()'s suspension check ever runs) -- the suspension screen only appears on
  // the NEXT transition, showing the actual frozen year in its own eyebrow ("${year} · League
  // Suspension"). Read that year directly from the rendered screen rather than assuming it's
  // whatever career.year was before this test started -- an earlier draft of this test asserted
  // against the wrong year entirely (the season that had already, normally, been simulated) and
  // passed for the wrong reason. Round 32/33's Continue-button gating ALSO means #continueBtn on
  // this resumed card can start out disabled until the resumed season's own bracket is finalized --
  // a second false-negative an earlier draft hit (a plain "any enabled button" fallback grabbed an
  // unrelated dash-tab arrow instead and the test never actually progressed).
  // A single outer iteration can need MANY "Simulate Next Round" sub-clicks to finalize one
  // season's bracket before Continue is even clickable -- an earlier draft called
  // ensureBracketFinalized with a small sub-try budget and treated "still disabled after those few
  // tries" as terminal (breaking the whole loop instead of just trying again next iteration), which
  // gave up long before the bracket actually finished. ensureBracketFinalized's own default budget
  // (30) is generous enough on its own; don't bail out just because ONE call didn't finish.
  let suspendedYear = null;
  for (let i = 0; i < 15 && suspendedYear == null; i++) {
    const eyebrow = await page.evaluate(() => document.querySelector(".ev-eyebrow")?.textContent || "");
    const match = eyebrow.match(/(\d{4})\s*·\s*League Suspension/);
    if (match) { suspendedYear = Number(match[1]); break; }
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
  expect(suspendedYear, "expected the suspension screen to actually render with a year in its eyebrow").not.toBeNull();

  // Now click "Wait it out" to pass through the frozen year and land on next season's card.
  for (let i = 0; i < 10; i++) {
    const stillSuspended = await page.evaluate(() => !!document.getElementById("suspContinue"));
    if (!stillSuspended) break;
    await page.evaluate(() => document.getElementById("suspContinue")?.click());
    await page.waitForTimeout(150);
  }

  const after = await readActiveCareer(page);
  const rivalsWithNewSeason = (after.career.leagueRivals || []).filter(r =>
    (r.seasons || []).some(s => s.year === suspendedYear)
  );

  expect(
    rivalsWithNewSeason.length,
    `expected at least some rivals to have simulated a real ${suspendedYear} season while the player served a suspension; none did -- the league is frozen`
  ).toBeGreaterThan(0);
});
