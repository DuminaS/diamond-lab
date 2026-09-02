// Confirmed live against HEAD (67b425c): resolveSeasonAllProAndProBowl()'s standard Pro Bowl slots
// are filled with `ranked.slice(0, slots.perConf)` -- sorted by proBowlScore alone, with NO
// proBowlEligible filter. Only the single optional bonus slot checks `bonus.proBowlEligible`. A QB
// who fails the eligibility bar (attempts>200 && gamesPlayedShare>=0.65 -- see
// evaluateSeasonAwards) but still scores highly (a short, hot streak) can therefore win a standard
// Pro Bowl slot outright.
//
// This is inherently a population-level check rather than a single forced scenario: constructing
// one specific ineligible-but-high-scoring rival deterministically would require reaching into
// simulatePlayerSeasonStats's internals, which the project's own testing convention reserves for a
// disposable copy of src/main.js, not a permanent regression test. Instead, this sweeps every
// rival's stored season record across several real seasons of a seeded career and asserts the
// invariant never holds: a season awarded "Pro Bowl" while proBowlEligible is stored false. Over
// a full league's worth of rival-seasons this reliably reproduces the bug (it requires no
// coincidence beyond "an ineligible rival ranks in the top perConf," which the current code makes
// structurally possible every single season).
import { test, expect } from "@playwright/test";
import { startCareer, advanceSeasons, readActiveCareer } from "../helpers/careerFlow.mjs";
import { installSeededRandom } from "../helpers/seededRandom.mjs";

test("pro-bowl-standard-slots-respect-eligibility", async ({ page }) => {
  test.setTimeout(180_000);
  await installSeededRandom(page, 90210);
  await startCareer(page);
  await advanceSeasons(page, 6);

  const saved = await readActiveCareer(page);
  const violations = [];
  (saved.career.leagueRivals || []).forEach(r => {
    (r.seasons || []).forEach(s => {
      if (s.proBowlEligible === false && Array.isArray(s.awards) && s.awards.includes("Pro Bowl")) {
        violations.push({ name: r.name, year: s.year, awards: s.awards, proBowlEligible: s.proBowlEligible });
      }
    });
  });

  expect(
    violations,
    `found ${violations.length} season(s) awarded a Pro Bowl slot despite proBowlEligible===false: ${JSON.stringify(violations.slice(0, 5))}`
  ).toEqual([]);
});
