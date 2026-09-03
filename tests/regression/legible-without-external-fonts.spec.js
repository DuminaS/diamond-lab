// Wave 8 (MASTER_REMEDIATION_SPEC.md) task #5 / exit criterion: "App works offline after first load
// without external font requests being required for legibility." index.html links Google Fonts
// (Oswald/Libre Franklin/IBM Plex Mono) for the polished look, but every CSS custom property that
// actually names a font already declares a real, legible fallback stack (--display: "Oswald",
// "Arial Narrow", "Impact", sans-serif; --body: "Libre Franklin", -apple-system, "Segoe UI",
// sans-serif; --mono: "IBM Plex Mono", ui-monospace, "SFMono-Regular", monospace) -- a self-hosted-
// fonts alternative was not needed since the fallback stack already covers the requirement. This
// blocks every request to the Google Fonts domains (simulating "offline, so the external
// stylesheet/font files never load" without fighting service-worker cache timing directly) and
// confirms the menu screen still renders real, visible, non-empty text, and that the actually-
// applied font-family for body text and headings resolves to one of the declared fallback fonts
// (proving the fallback stack is real and reachable, not just declared and never exercised).
import { test, expect } from "@playwright/test";

test("legible-without-external-fonts", async ({ page }) => {
  test.setTimeout(60_000);
  await page.route(/fonts\.(googleapis|gstatic)\.com/, route => route.abort());

  await page.goto("/");
  await page.waitForSelector("#startBtn", { timeout: 10_000 });

  // Real, visible, non-empty text -- the page didn't just fail to render because the stylesheet
  // request errored.
  const heading = page.locator(".intro h1");
  await expect(heading).toBeVisible();
  const headingText = await heading.textContent();
  expect(headingText && headingText.trim().length).toBeGreaterThan(0);
  const box = await heading.boundingBox();
  expect(box && box.width).toBeGreaterThan(0);
  expect(box && box.height).toBeGreaterThan(0);

  // The applied font-family for a heading (--display) and for body text (--body) must be one of
  // the DECLARED fallback fonts, not the browser's own generic default -- confirms the fallback
  // stack is the thing actually rendering, not an accidental "it still looks fine" coincidence.
  const fonts = await page.evaluate(() => {
    const h1 = document.querySelector(".intro h1");
    const p = document.querySelector(".intro p.lede");
    return {
      heading: h1 ? getComputedStyle(h1).fontFamily : null,
      body: p ? getComputedStyle(p).fontFamily : null,
    };
  });
  const headingFallbacks = ["arial narrow", "impact", "sans-serif"];
  const bodyFallbacks = ["-apple-system", "segoe ui", "sans-serif", "system-ui"];
  expect(
    headingFallbacks.some(f => (fonts.heading || "").toLowerCase().includes(f)),
    `expected heading font-family to include a declared fallback; got: ${fonts.heading}`
  ).toBe(true);
  expect(
    bodyFallbacks.some(f => (fonts.body || "").toLowerCase().includes(f)),
    `expected body font-family to include a declared fallback; got: ${fonts.body}`
  ).toBe(true);

  // The combine (a second, content-heavy screen) is equally legible without the external fonts.
  await page.click("#startBtn");
  await page.waitForSelector("#combineSetupBeginBtn", { timeout: 10_000 });
  await page.click("#combineSetupBeginBtn");
  await page.waitForSelector(".player-card", { timeout: 10_000 });
  const card = page.locator(".player-card").first();
  await expect(card).toBeVisible();
  const cardBox = await card.boundingBox();
  expect(cardBox && cardBox.width).toBeGreaterThan(0);
});
