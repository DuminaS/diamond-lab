// Confirmed live against HEAD (67b425c): #identityNameInput (index.html) is a real free-text field
// (maxlength 40, no pattern restriction), and career.name is interpolated unescaped into HTML at
// multiple render sites (draft night eyebrow, season summary bar, Hall of Fame header, career
// retrospective narrative). This is a real stored-injection vector: an attribute/tag payload typed
// into the name field executes wherever career.name is later rendered.
import { test, expect } from "@playwright/test";
import { startCareer } from "../helpers/careerFlow.mjs";

// #identityNameInput has maxlength="40" -- the payload MUST fit within that or it gets silently
// truncated into something inert before it ever reaches career.name (a real false-negative this
// test's first draft hit: a longer, quoted payload got cut mid-attribute and never executed,
// which looked like a pass but proved nothing). Unquoted HTML attribute values are legal as long
// as they contain no whitespace/quotes, which keeps this one short enough to fit.
const PAYLOAD = `<img src=x onerror=top.__xssFired=1>`;

test("name-html-is-rendered-not-executed", async ({ page }) => {
  // A page-level marker the payload sets IF it executes -- proves execution, not just presence.
  await page.addInitScript(() => { window.__xssFired = 0; });

  await startCareer(page, { name: PAYLOAD });

  // The draft-night/season-card render path has already run the name through at least once by
  // this point (draft night eyebrow, then the season card's own summary bar) -- if the payload
  // executed anywhere along the way, the marker would already be incremented.
  const firedAfterDraft = await page.evaluate(() => window.__xssFired);
  expect(firedAfterDraft, "payload must not execute when rendered at draft night / season card").toBe(0);

  // Visit every other screen career.name is known to render on, to catch a site that only shows
  // it later (Hall of Fame header, retrospective) -- walk to the end of the career quickly via a
  // forced retirement rather than playing it out.
  await page.evaluate(() => {
    const raw = localStorage.getItem("gridironlab.activeCareer");
    if (raw) {
      const saved = JSON.parse(raw);
      saved.career.age = 40; // next advanceCareer() call hits the age-cap exit path
      localStorage.setItem("gridironlab.activeCareer", JSON.stringify(saved));
    }
  });
  await page.reload();
  const resumeBtn = page.locator("#resumeCareerBtn");
  if (await resumeBtn.count()) await resumeBtn.click();
  // Walk through whatever renders (retirement / HOF / retrospective all show career.name).
  for (let i = 0; i < 30; i++) {
    const firedNow = await page.evaluate(() => window.__xssFired);
    if (firedNow > 0) break;
    const clicked = await page.evaluate(() => {
      const btn = document.querySelector("#careerContent button:not([disabled]), .choice-btn, button[id$='Ack']");
      if (btn) { btn.click(); return true; }
      return false;
    });
    if (!clicked) break;
    await page.waitForTimeout(100);
  }

  const fired = await page.evaluate(() => window.__xssFired);
  expect(fired, "payload must never execute across the full retirement/HOF/retrospective flow").toBe(0);

  // The payload's literal text should still be discoverable somewhere in the page as inert text
  // (proving it was escaped/rendered as data, not silently dropped) -- pick a substring that
  // survives HTML-escaping unambiguously.
  const bodyText = await page.evaluate(() => document.body.textContent);
  expect(bodyText.includes("img src=x") || bodyText.includes(PAYLOAD)).toBeTruthy();
});
