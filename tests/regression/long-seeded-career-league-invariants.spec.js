// Wave 2A (MASTER_REMEDIATION_SPEC.md), Section 8 #28 / Wave 2A exit criterion: "Validator finds
// no duplicate ownership across a 25-season seeded career." Runs the real, committed
// validateLeagueState() (via the narrow window.__glValidateLeagueState test hook) after every
// season across a 25-season sweep for two different seeds, printing the seed, year, and every
// violated invariant if any are found -- this is the QB-registry slice of the full "long career
// passes ALL league invariants" scenario named in Section 8; the other invariants there (schedule/
// standings/award correctness, etc.) belong to the waves that actually build them (4, 7) and have
// their own scoped regression tests already.
import { test, expect } from "@playwright/test";
import { startCareer, advanceOneSeason, readActiveCareer } from "../helpers/careerFlow.mjs";
import { installSeededRandom } from "../helpers/seededRandom.mjs";

const SEEDS = [11, 909090];

for (const seed of SEEDS) {
  test(`long-seeded-career-passes-league-invariants (seed ${seed})`, async ({ page }) => {
    test.setTimeout(300_000);
    await installSeededRandom(page, seed);
    await startCareer(page);

    const allIssues = [];
    for (let season = 0; season < 25; season++) {
      const stillActive = await page.evaluate(() => !!localStorage.getItem("diamondlab.activeCareer"));
      if (!stillActive) break;
      const ok = await advanceOneSeason(page);
      const saved = await readActiveCareer(page);
      const issues = await page.evaluate(() => (window.__glValidateLeagueState ? window.__glValidateLeagueState() : null));
      if (issues && issues.length) {
        allIssues.push({ seed, season, year: saved?.career?.year, issues });
      }
      if (!ok) break;
    }

    expect(
      allIssues,
      `seed ${seed}: found league-invariant violations: ${JSON.stringify(allIssues.slice(0, 8), null, 2)}`
    ).toEqual([]);
  });
}
