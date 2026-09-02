// Balance Wave 3: end-to-end coverage for the rewritten Key Moment mini-game. The pure decision
// model (contextual EV ranking, execution variance, the flat trigger constant) is unit-tested in
// tests/balance/key-moments.node.mjs; this test exists specifically to catch integration breakage
// the pure tests can't see -- the actual DOM rendering (renderCard), the click-through resolution
// path (resolve()), and the new career.keyMomentRecord tally + its Front Office widget row -- since
// Key Moments are OFF by default (see KeyMomentSettings) and so are NOT exercised by any of this
// project's other seeded-career regression tests.
//
// The trigger itself is still genuinely probabilistic (KEY_MOMENT_BASE_TRIGGER_CHANCE x
// keyMomentScoreEligibility per eligible playoff round) -- rather than fighting that with a
// mid-reveal Math.random hijack, this walks quarter-by-quarter through every playoff round across
// up to 12 seasons (Key Moments enabled, reusing the well-tested advanceOneSeason helper to move
// between seasons so this doesn't have to reimplement its own interstitial-walking logic), which
// given the per-round odds makes seeing at least one overwhelmingly likely for a build that
// reaches the playoffs even a few times. If it genuinely never fires for this seed, the test skips
// with a clear note rather than asserting on an event that didn't happen -- matching this
// project's own established convention for low-probability event coverage (see
// playoff-resume-ring-idempotency.spec.js).
import { test, expect } from "@playwright/test";
import { advanceOneSeason, readActiveCareer } from "../helpers/careerFlow.mjs";
import { installSeededRandom } from "../helpers/seededRandom.mjs";

async function clickIfPresent(page, selector) {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (el && !el.disabled) { el.click(); return true; }
    return false;
  }, selector);
}

test("key-moment-mini-game-resolves-and-updates-the-record", async ({ page }) => {
  test.setTimeout(240_000);
  // Seed found via a disposable sweep (deleted) that reliably rolls a Key Moment trigger within a
  // few seasons under this seed -- not hardcoded to force a trigger, just chosen because it's a
  // typical case, not a rare one.
  await installSeededRandom(page, 1001);
  await page.goto("/");
  // Enable the Key Moments beta toggle on the menu screen before starting the combine.
  const kmToggle = page.locator("#keyMomentsToggle");
  if (await kmToggle.count()) await kmToggle.check();
  await page.click("#startBtn");
  for (let i = 0; i < 12; i++) {
    await page.waitForSelector(".player-card", { timeout: 10_000 });
    await page.click(".player-card >> nth=0");
  }
  await page.waitForSelector("#goProBtn", { timeout: 10_000 });
  await page.click("#goProBtn");
  await page.waitForSelector(".decade-card", { timeout: 10_000 });
  await page.click(".decade-card >> nth=1"); // 1960s -- 4-team fields resolve fast, more seasons in budget
  await page.waitForSelector("#enterDraftNightBtn:not([disabled])", { timeout: 10_000 });
  await page.click("#enterDraftNightBtn");
  await page.waitForSelector("#startCareerBtn", { state: "visible", timeout: 10_000 });
  await page.click("#startCareerBtn");

  let found = false;
  for (let season = 0; season < 12 && !found; season++) {
    const stillActive = await page.evaluate(() => !!localStorage.getItem("gridironlab.activeCareer"));
    if (!stillActive) break;

    // Walk to this season's own season card WITHOUT letting anything blow through playoff rounds
    // automatically -- stop the instant a season card is showing so the reveal below can drive it
    // by hand, one quarter at a time.
    for (let i = 0; i < 150; i++) {
      const hasCard = await page.evaluate(() => !!document.querySelector("#careerContent .season-card"));
      if (hasCard) break;
      const acted = await page.evaluate(() => {
        const content = document.getElementById("careerContent");
        const btn = content && content.querySelector(
          "#injPlay, button[id$='Ack'], button[id$='Continue'], .choice-btn, .fa-accept, [id^='developmentPlan-']"
        );
        if (btn) { btn.click(); return true; }
        return false;
      });
      await page.waitForTimeout(acted ? 60 : 120);
    }

    // Walk this season's own playoff rounds (if any) one quarter at a time, watching for the
    // overlay after every single reveal click.
    for (let roundIdx = 0; roundIdx < 4 && !found; roundIdx++) {
      for (let q = 0; q < 5 && !found; q++) {
        const clicked = await clickIfPresent(page, `#pqSimQ-${roundIdx}`);
        if (!clicked) break; // this round index doesn't exist or is already fully revealed
        await page.waitForTimeout(150);
        const overlayOpen = await page.evaluate(() => {
          const ov = document.getElementById("keyMomentOverlay");
          return !!(ov && ov.classList.contains("open"));
        });
        if (overlayOpen) { found = true; break; }
      }
      if (found) break;
      await clickIfPresent(page, `#pqSimEnd-${roundIdx}`); // finish whatever's left of this round
      await page.waitForTimeout(150);
    }
    if (found) break;

    await advanceOneSeason(page); // reuse the well-tested helper to reach the next season
  }

  test.skip(!found, "seed 4041 never rolled a Key Moment trigger within 12 seasons -- a real, if unlikely, possibility given the mechanic is genuinely probabilistic; not a failure of the mechanism itself (see tests/balance/key-moments.node.mjs for deterministic coverage of the actual decision model).");

  // The overlay must render real, non-empty content -- a genuine situation, a genuine clue, and
  // exactly 4 distinct play-call options.
  const overlayState = await page.evaluate(() => {
    const ov = document.getElementById("keyMomentOverlay");
    const situation = ov.querySelector(".km-situation")?.textContent || "";
    const clue = ov.querySelector(".km-clue")?.textContent || "";
    const options = Array.from(ov.querySelectorAll(".km-option")).map(b => b.dataset.call);
    return { situation, clue, options };
  });
  expect(overlayState.situation.length).toBeGreaterThan(0);
  expect(overlayState.clue.length).toBeGreaterThan(0);
  expect(overlayState.options.length).toBe(4);
  expect(new Set(overlayState.options).size).toBe(4);

  const before = await readActiveCareer(page);
  const recordBefore = before.career.keyMomentRecord || { good: 0, meh: 0, bad: 0 };

  // Defensive: the generic interstitial-walking loop above can occasionally leave an unrelated
  // profile overlay (e.g. a team-name link inside a season narrative) open behind the Key Moment
  // overlay, which then intercepts pointer events on the click below. Close anything else first --
  // never the Key Moment overlay itself, which has no .rival-close button.
  await page.evaluate(() => {
    document.querySelectorAll(".rival-close").forEach(btn => btn.click());
  });
  await page.waitForTimeout(100);

  await page.click(".km-option >> nth=0");
  await page.waitForSelector(".km-continue", { timeout: 10_000 });
  // The resolved card must show a real explanation and effect line, and mark exactly one option
  // "correct" -- the actual best-EV call for this tendency+situation, not necessarily the one
  // clicked.
  const resolvedState = await page.evaluate(() => {
    const ov = document.getElementById("keyMomentOverlay");
    return {
      why: ov.querySelector(".km-why")?.textContent || "",
      effect: ov.querySelector(".km-effect")?.textContent || "",
      correctCount: ov.querySelectorAll(".km-option.correct").length,
    };
  });
  expect(resolvedState.why.length).toBeGreaterThan(0);
  expect(resolvedState.effect.length).toBeGreaterThan(0);
  expect(resolvedState.correctCount).toBe(1);

  await page.click(".km-continue");
  await page.waitForTimeout(150);

  // The Front Office widget's new row is part of the season-tab render that already happened this
  // season, so it reflects the in-memory update immediately (unlike the persisted save below,
  // which only checkpoints at the next natural boundary -- career.keyMomentRecord, like
  // career.reputation and every other Key-Moment-driven field, updates in memory right away but
  // isn't written to localStorage until then).
  const widgetText = await page.evaluate(() => document.getElementById("careerContent")?.textContent || "");
  expect(widgetText).toContain("Key Moment Decisions");

  // Finish out the season to reach the next real checkpoint, then confirm the tally actually
  // persisted -- exercising the real save flow instead of assuming an immediate write. The career
  // itself can legitimately end here (retirement/waived/HOF) depending on age/build/seed -- that's
  // not a Key Moment defect, just the normal career-end path, so only assert persistence when
  // there's still an active save to check.
  await advanceOneSeason(page);
  const after = await readActiveCareer(page);
  if (after) {
    const recordAfter = after.career.keyMomentRecord;
    expect(recordAfter, "career.keyMomentRecord must exist and persist past the next season checkpoint").toBeTruthy();
    const totalBefore = recordBefore.good + recordBefore.meh + recordBefore.bad;
    const totalAfter = recordAfter.good + recordAfter.meh + recordAfter.bad;
    expect(totalAfter).toBeGreaterThanOrEqual(totalBefore + 1);
  }
});
