// Wave 3 (MASTER_REMEDIATION_SPEC.md), Section 8 scenario #12 / required design #4: "Expansion
// franchises initialize even if the calendar advances across their start year through an absence
// event." spawnNewFranchiseRivals used to gate on an EXACT `t.start===year` match -- if the
// calendar ever advanced across a franchise's founding year without calling this for that exact
// year (a multi-season suspension/injury-leave used to do exactly that before this same wave's
// simulateLeagueYearWithoutUser started calling generateSeason once per year even during an
// absence), that team would never get a starter, permanently. This test reproduces the SPECIFIC
// "already-founded team with no starter" shape the old bug could leave behind (by directly clearing
// an active team's roster, simulating a missed founding year from an earlier, unrelated cause) and
// confirms the idempotent catch-up condition (`t.start<=year && no existing starter`) repairs it
// the very next time the league advances -- including during an absence year specifically, since
// that's the exact scenario the exit criterion names.
import { test, expect } from "@playwright/test";
import { startCareer, readActiveCareer, writeActiveCareer } from "../helpers/careerFlow.mjs";
import { installSeededRandom } from "../helpers/seededRandom.mjs";

test("expansion-catchup-initializes-missed-start-year", async ({ page }) => {
  test.setTimeout(120_000);
  await installSeededRandom(page, 40404);
  await startCareer(page);

  const saved = await readActiveCareer(page);
  const teamId = saved.career.teamId;
  const targetTeamId = Object.keys(saved.career.teamQbDepth || {}).find(id => id !== teamId);
  test.skip(!targetTeamId, "no other active team exists in this run's teamQbDepth");

  // Simulate "this team's founding year was skipped": wipe its roster from every collection the
  // registry tracks, exactly the orphaned shape a calendar-skip would leave (an active, already-
  // founded team with no QB1/QB2/QB3 anywhere).
  const depth = saved.career.teamQbDepth[targetTeamId];
  const orphanedIds = [depth.QB1, depth.QB2, depth.QB3].filter(Boolean);
  saved.career.leagueRivals = saved.career.leagueRivals.filter(r => r.teamId !== targetTeamId);
  delete saved.career.leagueDepthCharts[targetTeamId];
  saved.career.teamQbDepth[targetTeamId] = { QB1: null, QB2: null, QB3: null };
  orphanedIds.forEach(id => { delete saved.career.qbsById[id]; });

  // Force a one-season suspension so the very next league year advances through
  // simulateLeagueYearWithoutUser -- the exact absence path the exit criterion names -- rather than
  // a normal, player-present season.
  saved.career.suspensionSeasonsRemaining = 1;
  await writeActiveCareer(page, saved);
  await page.reload();
  const resumeBtn = page.locator("#resumeCareerBtn");
  if (await resumeBtn.count()) await resumeBtn.click();
  await page.waitForTimeout(200);

  // Walk to the League Suspension screen (simulateLeagueYearWithoutUser has already run for it by
  // the time this eyebrow renders).
  let reached = false;
  for (let i = 0; i < 20 && !reached; i++) {
    const eyebrow = await page.evaluate(() => document.querySelector(".ev-eyebrow")?.textContent || "");
    if (/League Suspension/.test(eyebrow)) { reached = true; break; }
    await page.evaluate(() => {
      const simEnd = document.querySelector("#playoffRoundsHolder [id^='pqSimEnd-']:not([disabled])");
      if (simEnd) { simEnd.click(); return; }
      const simBtn = document.getElementById("playoffTreeSimulateBtn");
      if (simBtn && !simBtn.disabled) { simBtn.click(); return; }
      const btn = document.getElementById("continueBtn") || document.getElementById("playOnBtn");
      if (btn && !btn.disabled) { btn.click(); return; }
    });
    await page.waitForTimeout(150);
  }
  expect(reached, "expected the League Suspension screen to render for the absence year").toBe(true);

  const after = await readActiveCareer(page);
  const depthAfter = after.career.teamQbDepth[targetTeamId];
  expect(depthAfter, "the target team must still have a teamQbDepth entry").toBeTruthy();
  expect(depthAfter.QB1, "the orphaned team must have a real QB1 again after the very next league year").toBeTruthy();
  const starter = after.career.qbsById[depthAfter.QB1];
  expect(starter, "the new starter must be a real, registered QB").toBeTruthy();
  expect(starter.retired).toBe(false);
});
