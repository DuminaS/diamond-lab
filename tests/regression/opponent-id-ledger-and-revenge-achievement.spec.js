// Balance Wave 7 (review-pass fix + new content): Wave 6 shipped career.eventLedger but never
// threaded season.playoffs.rounds[i].oppId (a real, stable team id that already existed on every
// one of the player's own playoff rounds -- see stepConferenceBracket) into the
// championship_won/championship_lost/key_moment ledger events, which meant Wave 6's OWN "not done"
// note (claiming opponent ids weren't tracked at all) was actually wrong -- the real gap was just
// this wiring. This test covers the fix directly: a fabricated championship_lost -> championship_won
// pair against the SAME opponentId unlocks "Revenge Tour" (sequenceRule + sameFieldAs, new this
// wave), while the identical shape against two DIFFERENT opponents must not.
import { test, expect } from "@playwright/test";
import { startCareer, advanceOneSeason, readActiveCareer, writeActiveCareer } from "../helpers/careerFlow.mjs";
import { installSeededRandom } from "../helpers/seededRandom.mjs";

test("a real Super Bowl loss then win against the SAME opponent unlocks Revenge Tour; different opponents do not", async ({ page }) => {
  test.setTimeout(120_000);
  await installSeededRandom(page, 5150);
  await startCareer(page, { decadeIndex: 1 });

  const saved = await readActiveCareer(page);
  expect(saved.career.achievements?.unlocked?.revenge).toBeFalsy();
  const myTeam = saved.career.teamId;
  const rivalTeam = myTeam === "BUF" ? "MIA" : "BUF"; // any other real, valid team id works here

  // Same "direct save mutation to reach a scenario deterministically" convention as
  // coordinator-carousel-fires-after-deep-run.spec.js and event-ledger-and-declarative-
  // achievements.spec.js -- fabricate the exact two ledger entries the real finalizePlayoffOutcome
  // code path would have produced (including the opponentId this wave's fix now threads through).
  const baseSeq = saved.career._eventSequenceCounter || 0;
  saved.career.eventLedger = (saved.career.eventLedger || []).concat([
    { eventId: "championship_lost", year: saved.career.year - 2, seasonIndex: 0, sequenceIndex: baseSeq + 1, teamId: myTeam, opponentId: rivalTeam, choiceId: null, outcomeId: null, severity: null, metadata: { year: saved.career.year - 2 } },
    { eventId: "championship_won", year: saved.career.year - 1, seasonIndex: 1, sequenceIndex: baseSeq + 2, teamId: myTeam, opponentId: rivalTeam, choiceId: null, outcomeId: "super_bowl", severity: null, metadata: { year: saved.career.year - 1, ringLabel: "Super Bowl Champion" } },
  ]);
  saved.career._eventSequenceCounter = baseSeq + 2;
  await writeActiveCareer(page, saved);
  await page.reload();
  const resumeBtn = page.locator("#resumeCareerBtn");
  if (await resumeBtn.count()) await resumeBtn.click();
  await page.waitForTimeout(200);

  const ok = await advanceOneSeason(page);
  expect(ok).toBe(true);
  const after = await readActiveCareer(page);
  expect(after.career.achievements?.unlocked?.revenge, "same-opponent championship_lost -> championship_won must unlock Revenge Tour").toBe(true);
});

test("a championship loss to team X then a win against a DIFFERENT team Y does NOT unlock Revenge Tour", async ({ page }) => {
  test.setTimeout(120_000);
  await installSeededRandom(page, 6161);
  await startCareer(page, { decadeIndex: 1 });

  const saved = await readActiveCareer(page);
  const myTeam = saved.career.teamId;

  const baseSeq = saved.career._eventSequenceCounter || 0;
  saved.career.eventLedger = (saved.career.eventLedger || []).concat([
    { eventId: "championship_lost", year: saved.career.year - 2, seasonIndex: 0, sequenceIndex: baseSeq + 1, teamId: myTeam, opponentId: "BUF", choiceId: null, outcomeId: null, severity: null, metadata: null },
    { eventId: "championship_won", year: saved.career.year - 1, seasonIndex: 1, sequenceIndex: baseSeq + 2, teamId: myTeam, opponentId: "MIA", choiceId: null, outcomeId: "super_bowl", severity: null, metadata: null },
  ]);
  saved.career._eventSequenceCounter = baseSeq + 2;
  await writeActiveCareer(page, saved);
  await page.reload();
  const resumeBtn = page.locator("#resumeCareerBtn");
  if (await resumeBtn.count()) await resumeBtn.click();
  await page.waitForTimeout(200);

  const ok = await advanceOneSeason(page);
  expect(ok).toBe(true);
  const after = await readActiveCareer(page);
  expect(after.career.achievements?.unlocked?.revenge, "a win against a DIFFERENT team than the one that beat you must NOT count as revenge").toBeFalsy();
});
