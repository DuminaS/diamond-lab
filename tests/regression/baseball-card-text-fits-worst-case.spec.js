// Visual-overflow audit (2026-09-03): a worst-case Trophy Room entry (a very long name, a long
// college, 5 teams, a maxed-out trophy count, and several of the longer Balance-Wave-6/7
// achievement names) exposed two real bugs in the SVG baseball-card renderer:
//   1. cardWrapTwoLines (now cardWrapLines) only ever produced 2 lines for an achievement-grid
//      label. For a name needing a genuine 3rd line ("Under the Lights, Then Without Them"), it
//      split once, found the remainder STILL too long for one line, and rendered that overlong
//      remainder as a single un-wrapped <text> anyway -- SVG text never auto-wraps or clips to a
//      box, so it visibly bled into the next grid cell.
//   2. Several front-face fields (the trophy-count line, the college/class-year line, the back
//      face's name+decade footer) had no length cap at all.
// This test locks in the fix: every SVG <text> element's bounding box must stay within the card's
// own 0-400 viewBox, for the most decorated, longest-content entry this app can realistically
// produce -- not just a typical one, which would never have caught either bug.
import { test, expect } from "@playwright/test";

test("baseball card SVG text never exceeds the card's own viewBox for a maximally long/decorated entry", async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto("/");
  const fakeEntry = {
    id: "worst-case-1",
    name: "Maximilian Wentworth-Featherstonehaugh III",
    college: "University of Southern California",
    draftYear: 1974,
    teams: ["San Francisco 49ers","Tampa Bay Buccaneers","New England Patriots","Kansas City Chiefs","Seattle Seahawks","Detroit Lions"],
    teamIds: ["SF","TB","NE","KC","SEA","DET"],
    mvps: 9, allPros: 12, proBowls: 15,
    seasons: 22, rings: 6, yards: 78432, td: 612, int: 210, rating: 108.4,
    peakOverall: 99,
    verdict: "First-Ballot Hall of Famer",
    exitReason: "retired",
    draftLine: "1974: 1st overall by the San Francisco 49ers.",
    relationshipLine: "Married a Hollywood actress in a televised ceremony that broke the internet for a week.",
    decade: "1970s",
    completedAt: Date.now(), earnings: 250000000,
    // Deliberately includes the two longest achievement names in the registry as of Wave 7.
    achievements: [
      "underthelights", "windycitychill", "hauntedbythesamedemon", "coordinatorsnightmare",
      "backtobackheartbreak", "scandalthensuccess", "deniednotdefeated", "clutchunderpressure",
      "bayarearesurgence", "jetsredemption", "buffaloclosure", "americasteam",
    ],
  };
  await page.evaluate((entry) => {
    localStorage.setItem("gridironlab.trophyroom", JSON.stringify([entry]));
  }, fakeEntry);
  await page.reload();
  await page.click("#trophyRoomBtn");
  await page.waitForSelector('[data-card-id="worst-case-1"]', { timeout: 10_000 });
  await page.click('[data-card-id="worst-case-1"]');
  await page.waitForSelector("#cardFlip", { timeout: 10_000 });
  await page.waitForTimeout(150);

  const svgTextBounds = () => Array.from(document.querySelectorAll("#baseballCardOverlay svg text")).map(t => {
    const bb = t.getBBox();
    return { text: t.textContent, left: bb.x, right: bb.x + bb.width };
  });

  const frontBounds = await page.evaluate(svgTextBounds);
  expect(frontBounds.length).toBeGreaterThan(5); // sanity: the front face actually rendered text
  for (const b of frontBounds) {
    expect(b.left, `"${b.text}" left edge`).toBeGreaterThanOrEqual(-1);
    expect(b.right, `"${b.text}" right edge`).toBeLessThanOrEqual(401);
  }

  // Team badges (the draft-night-style gradient+initials badge, reused here per this entry's
  // teamIds) must render as a bounded row -- capped at 5 badges plus one "+N" overflow badge for a
  // 6-team career, never one badge per team unbounded.
  const badgeCircleCount = await page.evaluate(() => document.querySelectorAll('#baseballCardOverlay .card-front svg circle[stroke-width="1.5"]').length);
  expect(badgeCircleCount).toBeLessThanOrEqual(6); // 5 real teams + 1 "+N" overflow badge

  await page.click("#cardFlipBtn");
  await page.waitForTimeout(300);
  const backBounds = await page.evaluate(svgTextBounds);
  expect(backBounds.length).toBeGreaterThan(5);
  for (const b of backBounds) {
    expect(b.left, `"${b.text}" left edge`).toBeGreaterThanOrEqual(-1);
    expect(b.right, `"${b.text}" right edge`).toBeLessThanOrEqual(401);
  }

  // The actual bug this test exists to catch was narrower than "falls off the 400-wide card": an
  // achievement-grid label rendered as one overlong, un-wrapped <text> line stays comfortably
  // inside 0-400 while still bleeding sideways into the ADJACENT 88px-wide grid cell (4 columns,
  // cellW=88, see buildCardFaceSVG). A whole-card bounds check alone would never catch that -- so
  // this also measures each individual <text> line's own rendered WIDTH and requires it fit within
  // one cell (a little headroom over the exact 88 for anti-aliasing/measurement slop), which is
  // exactly what "wraps across multiple lines instead of one overlong line" guarantees.
  const gridLineWidths = await page.evaluate(() => {
    // Achievement-grid rows live at y = 118 + row*76 + 30/41/52 (line 1/2/3) -- comfortably inside
    // 140-330; the header/info-line text above and below that range is excluded by this window.
    return Array.from(document.querySelectorAll("#baseballCardOverlay .card-back svg text"))
      .filter(t => { const y = parseFloat(t.getAttribute("y")); return y >= 140 && y <= 330; })
      .map(t => { const bb = t.getBBox(); return { text: t.textContent, width: bb.width }; });
  });
  expect(gridLineWidths.length).toBeGreaterThan(5);
  for (const line of gridLineWidths) {
    expect(line.width, `achievement-grid line "${line.text}" (width ${line.width}) must fit within one 88-wide grid cell`).toBeLessThanOrEqual(88);
  }

  // The specific line that used to bleed into its neighbor: confirm it now wraps onto its own
  // multiple lines (rendered as several separate <text> elements) rather than one overlong string.
  const underTheLightsLines = backBounds.filter(b => /Under the|Lights|Without Them/.test(b.text));
  expect(underTheLightsLines.length, "the long achievement name should wrap across multiple <text> lines").toBeGreaterThanOrEqual(2);
});
