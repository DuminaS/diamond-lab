// Review finding 8: a storage failure (quota exceeded, private-mode block) must not be silent.
// The game surfaces a visible warning, keeps the last good envelope in memory for a manual
// backup, and clears the warning once a write succeeds again.
import { test, expect } from "@playwright/test";
import { startCareer, advanceOneSeason } from "../helpers/careerFlow.mjs";
import { installSeededRandom } from "../helpers/seededRandom.mjs";

test("a failed save shows a visible warning and recovers when storage works again", async ({ page }) => {
  test.setTimeout(180_000);
  await installSeededRandom(page, 40404);
  await startCareer(page, { decadeIndex: 5 });

  // warning is hidden while saves succeed
  expect(await page.locator("#saveWarning").isVisible()).toBe(false);

  // make every write to the active-career key throw, like a quota-exceeded browser
  await page.evaluate(() => {
    const real = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k, v) {
      if (String(k).startsWith("diamondlab.activeCareer")) {
        const e = new Error("QuotaExceededError"); e.name = "QuotaExceededError"; throw e;
      }
      return real.call(this, k, v);
    };
    window.__restoreStorage = () => { Storage.prototype.setItem = real; };
  });

  await advanceOneSeason(page);
  await expect(page.locator("#saveWarning")).toBeVisible();
  await expect(page.locator("#saveWarning")).toContainText(/isn't saving/i);

  // the backup button is wired (a click must not throw; the sandbox blocks the actual download)
  await page.click("#saveWarningExport");

  // storage recovers -> the next successful save clears the warning
  await page.evaluate(() => window.__restoreStorage());
  await page.click("#saveWarningRetry");
  await expect(page.locator("#saveWarning")).toBeHidden();
});
