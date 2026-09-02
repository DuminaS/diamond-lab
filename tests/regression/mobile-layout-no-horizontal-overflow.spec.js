// Wave 8 (MASTER_REMEDIATION_SPEC.md) task #6 / exit criterion: "Preserve mobile layout at 320,
// 360, 390, and tablet widths without horizontal page overflow. Wide tables may scroll within their
// own container." Sweeps the menu screen, the combine, and several of the career dashboard's own
// tabs (Season, Schedule, Standings, League, Team, Scheme -- several of which render wide tables)
// at all four required widths and confirms document.documentElement.scrollWidth never exceeds the
// viewport width, i.e. the page itself never needs horizontal scrolling -- a wide table is allowed
// to scroll within its own .table-wrap container (overflow-x: auto), which does not count as page
// overflow.
import { test, expect } from "@playwright/test";
import { startCareer, advanceOneSeason } from "../helpers/careerFlow.mjs";
import { installSeededRandom } from "../helpers/seededRandom.mjs";

const WIDTHS = [320, 360, 390, 768];

async function assertNoHorizontalOverflow(page, label) {
  const overflow = await page.evaluate(() => {
    const doc = document.documentElement;
    return { scrollWidth: doc.scrollWidth, clientWidth: doc.clientWidth };
  });
  expect(
    overflow.scrollWidth,
    `${label}: page scrollWidth (${overflow.scrollWidth}) must not exceed viewport clientWidth (${overflow.clientWidth})`
  ).toBeLessThanOrEqual(overflow.clientWidth);
}

test("mobile-layout-no-horizontal-overflow", async ({ page }) => {
  test.setTimeout(180_000);
  await installSeededRandom(page, 55221);

  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 800 });

    // Menu screen.
    await page.goto("/");
    await assertNoHorizontalOverflow(page, `menu @ ${width}px`);

    // Combine (player-card grid -- a real candidate for overflow on a narrow screen).
    await page.click("#startBtn");
    await page.waitForSelector(".player-card", { timeout: 10_000 });
    await assertNoHorizontalOverflow(page, `combine @ ${width}px`);
  }
});

test("mobile-layout-career-tabs-no-horizontal-overflow", async ({ page }) => {
  test.setTimeout(180_000);
  await installSeededRandom(page, 55221);
  await startCareer(page, { decadeIndex: 3 });
  await advanceOneSeason(page); // real standings/schedule/history data to render into the wide tables

  const tabs = ["season", "schedule", "standings", "league", "team", "scheme"];
  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 800 });
    for (const tab of tabs) {
      await page.evaluate((t) => { document.querySelector(`.dash-tab[data-tab="${t}"]`)?.click(); }, tab);
      await page.waitForTimeout(100);
      await assertNoHorizontalOverflow(page, `${tab} tab @ ${width}px`);
    }
  }
});
