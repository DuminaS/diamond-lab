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

// Review finding 4: storage blocked BEFORE the game loads still fails visibly (saveActiveCareer
// used to return silently when safeStorage() had returned null).
test("storage blocked at startup is a visible save failure", async ({ page }) => {
  test.setTimeout(180_000);
  await installSeededRandom(page, 40405);
  await page.addInitScript(() => {
    Storage.prototype.setItem = function () { const e = new Error("blocked"); e.name = "SecurityError"; throw e; };
  });
  await startCareer(page, { decadeIndex: 5 });
  await advanceOneSeason(page);
  await expect(page.locator("#saveWarning")).toBeVisible();
});

// Review finding 3: after a save has succeeded, then storage fails, the emergency backup export
// must contain the CURRENT progress -- the old code preferred the last *persisted* envelope, so
// it handed back the previous year and silently dropped the unsaved season.
test("the emergency backup export contains current progress, not the last saved checkpoint", async ({ page }) => {
  test.setTimeout(180_000);
  await installSeededRandom(page, 40406);
  await page.addInitScript(() => {
    const realCreate = URL.createObjectURL ? URL.createObjectURL.bind(URL) : null;
    window.__backupBlobText = null;
    URL.createObjectURL = function (blob) {
      try { blob.text().then(t => { window.__backupBlobText = t; }); } catch (e) {}
      return realCreate ? realCreate(blob) : "blob:stub";
    };
  });
  await startCareer(page, { decadeIndex: 5 });
  await advanceOneSeason(page); // a real save succeeds here -> _lastGoodEnvelopeJSON is set

  const savedYear = await page.evaluate(() => {
    const env = JSON.parse(localStorage.getItem("diamondlab.activeCareer"));
    return env.career.year;
  });

  // now break writes and advance again -- this season only lives in memory
  await page.evaluate(() => {
    const real = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k, v) {
      if (String(k).startsWith("diamondlab.activeCareer")) { const e = new Error("Quota"); e.name = "QuotaExceededError"; throw e; }
      return real.call(this, k, v);
    };
  });
  await advanceOneSeason(page);
  await expect(page.locator("#saveWarning")).toBeVisible();

  await page.click("#saveWarningExport");
  await page.waitForFunction(() => window.__backupBlobText != null, { timeout: 5000 });
  const env = JSON.parse(await page.evaluate(() => window.__backupBlobText));
  expect(env.career, "backup has a career").toBeTruthy();
  expect(Array.isArray(env.career.seasonLog)).toBe(true);
  expect(env.career.year, `backup year ${env.career.year} should be past the last saved year ${savedYear}`).toBeGreaterThan(savedYear);
});
