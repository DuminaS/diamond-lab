// Section 3, invariant #14: "Saved postseason state resumes idempotently: reopening cannot reroll
// a completed game, duplicate a ring, or change a known opponent." Round 32/33 (this session)
// already hardened a lot of this (the lockstep bracket, the Continue-button gating on
// season.leagueStandings.playoffBracket), but saveActiveCareer() still only checkpoints once per
// season, not once per playoff round/decision the way MASTER_REMEDIATION_SPEC.md's Wave 1 will
// require -- so today's test can only prove the coarser, still-real property: reloading and
// resuming the SAME saved career, repeatedly, across many seasons, never increases
// career.totals.rings by more than the number of championships actually won, and a reload right
// after a championship season never awards a second ring for the same title.
import { test, expect } from "@playwright/test";
import { startCareer, advanceOneSeason, readActiveCareer } from "../helpers/careerFlow.mjs";
import { installSeededRandom } from "../helpers/seededRandom.mjs";

test("championship-finalization-saves-one-ring", async ({ page }) => {
  test.setTimeout(240_000);
  await installSeededRandom(page, 55);
  await startCareer(page);

  let previousRings = 0;
  let sawTitle = false;
  for (let season = 0; season < 15; season++) {
    const stillActive = await page.evaluate(() => !!localStorage.getItem("diamondlab.activeCareer"));
    if (!stillActive) break;

    const ok = await advanceOneSeason(page);

    // Reload + resume after EVERY season -- exercises the save/resume path repeatedly, not just
    // once, so a duplication bug tied to resume timing gets more chances to surface.
    await page.reload();
    const resumeBtn = page.locator("#resumeCareerBtn");
    if (await resumeBtn.count()) {
      await resumeBtn.click();
      await page.waitForTimeout(150);
    }

    const saved = await readActiveCareer(page);
    if (!saved) break;
    const rings = saved.career.totals.rings || 0;

    expect(
      rings,
      `career.totals.rings must never DECREASE on reload (season ${season}: ${previousRings} -> ${rings})`
    ).toBeGreaterThanOrEqual(previousRings);
    expect(
      rings - previousRings,
      `career.totals.rings must never jump by more than 1 in a single season (season ${season}: ${previousRings} -> ${rings})`
    ).toBeLessThanOrEqual(1);

    if (rings > previousRings) {
      sawTitle = true;
      // Reload a SECOND time immediately -- if finalization is not idempotent, resuming again
      // right after the title would be the most likely place a duplicate ring appears.
      await page.reload();
      const resumeBtn2 = page.locator("#resumeCareerBtn");
      if (await resumeBtn2.count()) {
        await resumeBtn2.click();
        await page.waitForTimeout(150);
      }
      const savedAgain = await readActiveCareer(page);
      if (savedAgain) {
        expect(
          savedAgain.career.totals.rings,
          "reloading again immediately after a championship must not award a second ring for the same title"
        ).toBe(rings);
      }
    }

    previousRings = rings;
    if (!ok) break;
  }

  test.info().annotations.push({ type: "note", description: sawTitle ? "a championship was won during this run" : "no championship was won in 15 seasons with this seed -- ring-increase assertions were exercised zero times, only the non-negative/non-jump invariants ran every season" });
});
