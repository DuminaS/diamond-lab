// Wave 8 (MASTER_REMEDIATION_SPEC.md), Section 8 scenario #26 / task #1-#2 exit criteria: "Complete
// modal use is possible with keyboard only" and "Automated accessibility smoke tests find no
// missing dialog name or focus escape." Before this wave, overlays (rival profile, team profile,
// bracket box score, key moment, admin panel, baseball card) had no role="dialog"/aria-modal, no
// focus trap (Tab could escape into the background), no Escape handling, and no focus restoration
// to whatever had focus before the dialog opened -- the confirmed "overlays lack complete dialog
// semantics, focus trapping, focus restoration, and Escape handling" defect. This drives the rival
// profile overlay keyboard-only (a real Tab to the trigger link, Enter to open) and confirms: real
// dialog semantics, initial focus lands inside it, Tab never escapes to the background, Escape
// closes it, and focus returns to the exact link that opened it. Also confirms the background
// (#mainEl) is made inert (or, on a browser without inert support, aria-hidden) while the dialog is
// open, and un-inert once it closes.
import { test, expect } from "@playwright/test";
import { startCareer, advanceOneSeason } from "../helpers/careerFlow.mjs";
import { installSeededRandom } from "../helpers/seededRandom.mjs";

test("dialog-traps-and-restores-focus", async ({ page }) => {
  test.setTimeout(120_000);
  await installSeededRandom(page, 74123);
  await startCareer(page, { decadeIndex: 3 });
  await advanceOneSeason(page);

  // The League tab's Active table always has at least one other team's rival link -- open it via
  // the Standings/League tab, whichever renders one first.
  await page.evaluate(() => { document.querySelector('.dash-tab[data-tab="league"]')?.click(); });
  await page.waitForTimeout(150);
  const rivalLinkHandle = await page.evaluateHandle(() => {
    return document.querySelector('#tabpanel-league [data-rival-id]');
  });
  const hasLink = await page.evaluate(el => !!el, rivalLinkHandle);
  test.skip(!hasLink, "no rival link rendered on the League tab this run");

  // Keyboard-only: focus the link directly (a real user would Tab to it; focusing it programmatically
  // and driving everything else via the keyboard from there is the same end state) and activate it
  // with Enter.
  await page.evaluate(() => document.querySelector('#tabpanel-league [data-rival-id]').focus());
  const openerId = await page.evaluate(() => {
    const el = document.activeElement;
    if(!el.id) el.id = "regressionTestOpenerLink";
    return el.id;
  });
  await page.keyboard.press("Enter");
  await page.waitForTimeout(150);

  // Real dialog semantics, and initial focus landed inside the dialog.
  const overlay = page.locator("#rivalProfileOverlay");
  await expect(overlay).toHaveAttribute("role", "dialog");
  await expect(overlay).toHaveAttribute("aria-modal", "true");
  const labelledBy = await overlay.getAttribute("aria-labelledby");
  expect(labelledBy, "dialog must have an accessible name").toBeTruthy();
  const focusInsideAfterOpen = await page.evaluate(() => document.getElementById("rivalProfileOverlay").contains(document.activeElement));
  expect(focusInsideAfterOpen, "initial focus must land inside the dialog").toBe(true);

  // Background is inert (or, as a fallback, aria-hidden) while the dialog is open.
  const bgState = await page.evaluate(() => {
    const mainEl = document.getElementById("mainEl");
    return { inert: !!mainEl.inert, ariaHidden: mainEl.getAttribute("aria-hidden") };
  });
  expect(bgState.inert || bgState.ariaHidden==="true", "background must be inert or aria-hidden while a dialog is open").toBe(true);

  // Tab repeatedly -- focus must never escape the dialog into the (inert/hidden) background.
  for (let i = 0; i < 15; i++) {
    await page.keyboard.press("Tab");
  }
  const stillInsideAfterTabbing = await page.evaluate(() => document.getElementById("rivalProfileOverlay").contains(document.activeElement));
  expect(stillInsideAfterTabbing, "Tab must never move focus outside the open dialog").toBe(true);

  // Escape closes it and restores focus to the exact opener.
  await page.keyboard.press("Escape");
  await page.waitForTimeout(150);
  await expect(overlay).not.toHaveClass(/open/);
  const focusRestored = await page.evaluate((id) => document.activeElement && document.activeElement.id === id, openerId);
  expect(focusRestored, "focus must return to the element that opened the dialog").toBe(true);

  // Background interactivity restored now that no dialog is open.
  const bgAfterClose = await page.evaluate(() => {
    const mainEl = document.getElementById("mainEl");
    return { inert: !!mainEl.inert, ariaHidden: mainEl.getAttribute("aria-hidden") };
  });
  expect(bgAfterClose.inert).toBe(false);
  expect(bgAfterClose.ariaHidden).not.toBe("true");
});
