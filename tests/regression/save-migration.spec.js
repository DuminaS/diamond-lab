// Wave 1 (MASTER_REMEDIATION_SPEC.md, Section 7): exit criterion "old saves migrate and remain
// playable." Before Wave 1, gridironlab.activeCareer was a bare `{career, build}` shape (no
// schemaVersion, no checkpoint envelope). Wave 1 wraps that in `{schemaVersion, savedAt,
// checkpoint, career, build}` via migrateSaveEnvelope() -- this test writes a synthetic PRE-WAVE-1
// save (built by stripping the envelope fields back off a real, freshly-started career, exactly
// what a save made by the old code would have looked like) and confirms: (a) loadActiveCareer/
// resumeActiveCareer still accept it with no schemaVersion field at all, (b) the resumed career is
// genuinely playable (advances a real season afterward, i.e. migration didn't just silently
// swallow the save into a broken half-state), and (c) the very next save this session makes is
// upgraded to the current schemaVersion with a real checkpoint object, not left un-versioned.
import { test, expect } from "@playwright/test";
import { startCareer, advanceOneSeason, readActiveCareer, writeActiveCareer, ACTIVE_CAREER_KEY } from "../helpers/careerFlow.mjs";
import { installSeededRandom } from "../helpers/seededRandom.mjs";

test("pre-wave1-bare-save-migrates-and-stays-playable", async ({ page }) => {
  await installSeededRandom(page, 7331);
  await startCareer(page);

  const current = await readActiveCareer(page);
  expect(current, "startCareer() must have produced a save to migrate from").toBeTruthy();

  // Reconstruct exactly what saveActiveCareer() used to persist before Wave 1: no schemaVersion,
  // no checkpoint, just the bare pair (plus whatever savedAt-shaped field the old code wrote, if
  // any -- the important thing under test is the ABSENCE of schemaVersion/checkpoint).
  const legacyShape = { career: current.career, build: current.build };
  await writeActiveCareer(page, legacyShape);

  await page.reload();
  const resumeBtn = page.locator("#resumeCareerBtn");
  await expect(resumeBtn, "the legacy (un-versioned) save must still surface a Resume Career option on the menu").toHaveCount(1);
  await resumeBtn.click();
  await page.waitForTimeout(200);

  // Migration must have happened transparently -- the resumed career's identity/year should match
  // the legacy save exactly, not a reset or a discarded-and-regenerated career.
  const migrated = await readActiveCareer(page);
  expect(migrated, "resuming a legacy save must still produce a readable active-career entry").toBeTruthy();
  expect(migrated.career.name).toBe(legacyShape.career.name);
  expect(migrated.career.year).toBe(legacyShape.career.year);

  // The career must be genuinely playable post-migration, not just readable: advancing a season
  // should work exactly as it would for a career that was never migrated.
  const advanced = await advanceOneSeason(page);
  expect(advanced, "a migrated legacy save must still be able to advance a season").toBe(true);

  // The NEXT save this session makes (triggered by advanceOneSeason's own checkpointing) must be
  // upgraded to the current envelope shape -- schemaVersion present and a real checkpoint object,
  // never left bare the way the legacy save was.
  const afterAdvance = await readActiveCareer(page);
  expect(afterAdvance).toBeTruthy();
  expect(afterAdvance.schemaVersion, "a save written after migration must carry the current schemaVersion").toBeGreaterThanOrEqual(1);
  expect(afterAdvance.checkpoint, "a save written after migration must carry a checkpoint object").toBeTruthy();
  expect(typeof afterAdvance.checkpoint.phase).toBe("string");
});
