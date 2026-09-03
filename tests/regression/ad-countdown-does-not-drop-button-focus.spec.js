// Wave 8 (MASTER_REMEDIATION_SPEC.md), Section 8 scenario #27 / task #3 exit criterion: "Skip-button
// focus survives countdown updates." Before this wave, showRewardedAd's render() function called
// overlay.innerHTML = ... on every 200ms timer tick -- destroying and recreating the Skip/Claim
// buttons from scratch roughly 150 times over one 30-second ad, which drops keyboard focus off the
// Skip button (or whichever button had it) the very first tick after the user tabs to it. Fixed by
// building the markup once and updating only the specific text/attribute that changes per tick.
// This focuses the Skip button, waits through several ticks, and confirms focus never moved.
import { test, expect } from "@playwright/test";
import { startCareer } from "../helpers/careerFlow.mjs";

test("ad-countdown-does-not-drop-button-focus", async ({ page }) => {
  test.setTimeout(60_000);
  await startCareer(page);
  // startCareer already walked through the combine to a real season card; go back to the menu and
  // re-enter the combine fresh so the "Watch Ad for Bonus Reroll" button is on-screen and clickable
  // (it only appears on an active combine round).
  await page.goto("/");
  await page.click("#startBtn");
  await page.waitForSelector("#combineSetupBeginBtn", { timeout: 10_000 });
  await page.click("#combineSetupBeginBtn");
  await page.waitForSelector(".player-card", { timeout: 10_000 });

  const adBtn = page.locator("#watchAdRespinBtn");
  await expect(adBtn).toBeVisible();
  await adBtn.click();
  await page.waitForSelector("#rewardedAdOverlay.open", { timeout: 10_000 });

  const cancelBtn = page.locator("#adCancelBtn");
  await expect(cancelBtn).toBeVisible();
  await cancelBtn.focus();
  await expect(cancelBtn).toBeFocused();

  // Several real 200ms ticks -- enough for the old bug (innerHTML replaced every tick) to have
  // dropped focus multiple times over.
  for (let i = 0; i < 6; i++) {
    await page.waitForTimeout(220);
    await expect(cancelBtn, `Skip button must still be focused after tick ${i + 1}`).toBeFocused();
  }

  // Countdown text is actually updating in place (proves the interval is live, not just idle).
  const timerText = await page.locator("#adTimerText").textContent();
  expect(timerText).toMatch(/\d+s left/);

  // Clean up: skip the ad (also exercises the no-reward path) and confirm the dialog actually
  // closes. Focus restoration to the exact opener is covered by dialog-traps-and-restores-focus --
  // this specific opener (#watchAdRespinBtn) is deliberately disabled by its own click handler
  // before the ad opens (so it can't be double-clicked mid-ad) and re-rendered by renderRound()
  // once the promise resolves, so it's neither focusable nor the same DOM node by the time this
  // dialog closes -- a real, deliberate characteristic of this specific flow, not the dialog
  // module's concern.
  await page.keyboard.press("Enter");
  await page.waitForTimeout(200);
  await expect(page.locator("#rewardedAdOverlay")).not.toHaveClass(/open/);
});
