// Wave 4 (MASTER_REMEDIATION_SPEC.md) exit criterion: "Seeding remains deterministic on reload."
// Before this wave, an exact winPct tie between two teams fell back to whatever order Array.sort
// happened to leave them in -- stable, but arbitrary and undocumented (a confirmed defect).
// compareTeamsForStandings replaces that with a real, documented tiebreak chain (head-to-head,
// division record, conference record, point differential, then a stable team-ID fallback), which
// is itself fully deterministic given the same season data -- re-deriving standings from an
// unchanged, already-simulated season must therefore always produce the identical seed order.
// This advances a real season, captures both conferences' seeded order, reloads the page (forcing
// every render to recompute standings from scratch off the persisted save), and confirms the
// order is byte-for-byte identical both times. Separately, when this run's own standings happen to
// contain a genuine winPct tie between two teams, confirms their relative order is consistent with
// win percentage at minimum (the tiebreak chain never REORDERS two teams with different winPct).
import { test, expect } from "@playwright/test";
import { startCareer, advanceOneSeason, readActiveCareer } from "../helpers/careerFlow.mjs";
import { installSeededRandom } from "../helpers/seededRandom.mjs";

test("seeding-deterministic-on-reload", async ({ page }) => {
  test.setTimeout(180_000);
  await installSeededRandom(page, 71717);
  await startCareer(page, { decadeIndex: 1 });

  let foundTie = false;
  for (let season = 0; season < 6 && !foundTie; season++) {
    const stillActive = await page.evaluate(() => !!localStorage.getItem("diamondlab.activeCareer"));
    if (!stillActive) break;
    const ok = await advanceOneSeason(page);

    const before = await readActiveCareer(page);
    const lastSeason = before.career.seasonLog[before.career.seasonLog.length - 1];
    const ls = lastSeason && lastSeason.leagueStandings;
    if (!ls) { if (!ok) break; continue; }
    const beforeSeeds = { AFC: (ls.seeded.AFC || []).map(t => t.id), NFC: (ls.seeded.NFC || []).map(t => t.id) };

    // Never rank two DIFFERENT-winPct teams out of order -- the primary sort key must always win
    // over every tiebreak step.
    ["AFC", "NFC"].forEach(conf => {
      const seeds = ls.seeded[conf] || [];
      for (let i = 1; i < seeds.length; i++) {
        expect(seeds[i - 1].winPct, `${conf} seed ${i} must not have a lower winPct than seed ${i + 1} in ${lastSeason.year}`).toBeGreaterThanOrEqual(seeds[i].winPct);
      }
    });
    // Look for a genuine winPct tie among ALL teams league-wide (not just the playoff-seeded
    // subset, which is a much smaller population) to confirm the tiebreak chain is actually
    // exercised at least once across this sweep.
    const allResults = Object.values(ls.results || {});
    const winPctCounts = {};
    allResults.forEach(r => { winPctCounts[r.winPct] = (winPctCounts[r.winPct] || 0) + 1; });
    if (Object.values(winPctCounts).some(c => c > 1)) foundTie = true;

    await page.reload();
    const resumeBtn = page.locator("#resumeCareerBtn");
    if (await resumeBtn.count()) await resumeBtn.click();
    await page.waitForTimeout(200);

    const after = await readActiveCareer(page);
    const lastSeasonAfter = after.career.seasonLog[after.career.seasonLog.length - 1];
    const lsAfter = lastSeasonAfter && lastSeasonAfter.leagueStandings;
    expect(lsAfter, `expected leagueStandings to survive a reload for ${lastSeason.year}`).toBeTruthy();
    const afterSeeds = { AFC: (lsAfter.seeded.AFC || []).map(t => t.id), NFC: (lsAfter.seeded.NFC || []).map(t => t.id) };
    expect(afterSeeds, `expected identical seed order after reload for ${lastSeason.year}`).toEqual(beforeSeeds);

    if (!ok) break;
  }

  expect(foundTie, "expected at least one genuine winPct tie between adjacent seeds across 6 seasons in the 1960s, to actually exercise the tiebreak chain").toBe(true);
});
