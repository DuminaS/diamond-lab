// Bug report (user screenshot): the Playoff Tree's Divisional round showed THREE one-sided cards
// (#1, #2, #3, each paired with a blank "-" side) instead of two real matchups, with the user
// correctly noting "#2 and #3 seed [should be] facing each other."
//
// Root cause: previewByeAheadMatchups (src/main.js) previews the Divisional round's pairings before
// Wild Card has been simulated, for any conference with byes>0. Every other supported PLAYOFF_ERAS
// format (src/data/teams.js) has byes<=wcGames, so each bye team waits on its own not-yet-known
// Wild Card winner -- one "vs TBD" card per bye, which happens to equal both the bye count AND the
// real number of Divisional matchups. The 1978-1989 format (wildcards:2, wcGames:1 -> byes:3 -- the
// two wild-card teams play each other, and of the three division winners who bye straight to
// Divisional, only the #1 seed's opponent depends on that game; the #2 and #3 seeds already know
// they play EACH OTHER) breaks that coincidence: byes(3) > the real matchup count(2). The old code
// looped `byes` times unconditionally, always emitting one card per bye team regardless of how many
// Divisional matchups actually exist, instead of pairing indices the same way the post-Wild-Card
// "field" branch of previewNextRoundMatchups already correctly does (top-half index i vs bottom-half
// index fieldLen-1-i).
//
// A career started in the "1980s" decade always drafts (and so always plays its first season) with
// draftYear randInt(1980,1989) -- entirely inside the buggy 1978-1989 window regardless of seed, so
// this test needs no seed-tuning to land there. The Playoff Tree section renders inside the (always
// default-active) Season tab as soon as a season card exists, before Wild Card has been touched for
// either conference -- exactly the state previewByeAheadMatchups covers.
import { test, expect } from "@playwright/test";
import { startCareer } from "../helpers/careerFlow.mjs";
import { installSeededRandom } from "../helpers/seededRandom.mjs";

test("playoff-tree-divisional-round-pairs-byes-correctly-in-1978-1989-format", async ({ page }) => {
  test.setTimeout(60_000);
  await installSeededRandom(page, 4242);
  // decade-card index 0 is the "Random Decade" card (see renderDecadeGrid), so DECADES[2]="1980s"
  // sits at grid index 3 -- draftYear always randInt(1980,1989), regardless of seed.
  await startCareer(page, { decadeIndex: 3 });

  const year = await page.evaluate(() => {
    const raw = localStorage.getItem("gridironlab.activeCareer");
    return raw ? JSON.parse(raw).career.year : null;
  });
  expect(year, "a career started in the 1980s decade card must draft within 1980-1989").not.toBeNull();
  expect(year).toBeGreaterThanOrEqual(1980);
  expect(year).toBeLessThanOrEqual(1989);

  await page.waitForSelector(".bracket-col", { timeout: 10_000 });

  const divisionalColumns = await page.evaluate(() => {
    const cols = Array.from(document.querySelectorAll(".bracket-col"));
    return cols
      .filter(col => (col.querySelector(".bracket-col-label")?.textContent || "").trim() === "DIVISIONAL")
      .map(col => {
        const cards = Array.from(col.querySelectorAll(".pcard"));
        return cards.map(card =>
          Array.from(card.querySelectorAll(".pcard-name")).map(n => n.textContent.trim())
        );
      });
  });

  // Both conferences share the same season-wide playoff format, so both Divisional columns (AFC's
  // and NFC's) should show the bug/fix identically -- assert on every one found, not just one.
  expect(divisionalColumns.length).toBeGreaterThan(0);
  for (const cards of divisionalColumns) {
    // The real bug: this used to be 3 (one per bye team) instead of 2 (the real matchup count for a
    // 5-team conference: 3 byes + 1 Wild Card winner = 4 teams entering Divisional = 2 games).
    expect(cards.length, `Divisional round must show exactly 2 matchups, got ${cards.length}: ${JSON.stringify(cards)}`).toBe(2);

    // The qualitative fix: seeds #2 and #3 already know they play each other (both real team names,
    // no "TBD" side) -- only the #1 seed's card should still show a "TBD" opponent (awaiting the
    // Wild Card game's winner). Assert at least one card has two real, non-"TBD", non-empty names.
    const fullyKnownCards = cards.filter(names => names.length === 2 && names.every(n => n && n !== "TBD"));
    expect(
      fullyKnownCards.length,
      `expected the #2-vs-#3 matchup to already show two real team names, got: ${JSON.stringify(cards)}`
    ).toBeGreaterThanOrEqual(1);
  }
});
