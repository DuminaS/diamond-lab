// Wave 3 (MASTER_REMEDIATION_SPEC.md), exit criterion: "AI injury/suspension status is visible on
// the player profile and transaction/history surfaces." Before this wave, an AI QB's missed-games
// roll (simulatePlayerSeasonStats) was completely anonymous -- no reason, no type, nowhere it
// showed up. Advances a few real seasons under a seeded RNG until at least one STARTER's (QB1)
// availability roll actually fires (bench-player relief absences aren't pushed to the news log --
// see simulateRivalSeasons -- so this specifically looks for a starter), then confirms: (1) his own
// player-profile overlay, opened via the same All-Time-table [data-rival-id] link the rest of the
// app uses, renders the reason/label; (2) career.leagueNewsLog carries a matching transaction/
// history entry for that exact year and team.
import { test, expect } from "@playwright/test";
import { startCareer, advanceOneSeason, readActiveCareer } from "../helpers/careerFlow.mjs";
import { installSeededRandom } from "../helpers/seededRandom.mjs";

test("ai-injury-status-visible-on-profile-and-history", async ({ page }) => {
  test.setTimeout(180_000);
  await installSeededRandom(page, 13131);
  await startCareer(page);

  let flagged = null;
  for (let season = 0; season < 12 && !flagged; season++) {
    const stillActive = await page.evaluate(() => !!localStorage.getItem("gridironlab.activeCareer"));
    if (!stillActive) break;
    const ok = await advanceOneSeason(page);
    const saved = await readActiveCareer(page);
    const starters = Object.values(saved.career.qbsById || {}).filter(q =>
      !q.isUser && q.availability && !q.retired && q.rosterRole === "QB1"
    );
    if (starters.length) flagged = starters[0];
    if (!ok) break;
  }

  test.skip(!flagged, "no starter's availability roll fired across 12 seasons with this seed");

  expect(["injury", "suspension"]).toContain(flagged.availability.reason);
  expect(typeof flagged.availability.label).toBe("string");
  expect(flagged.availability.label.length).toBeGreaterThan(0);

  // (1) Player profile surface -- open via the All-Time table's own [data-rival-id] link, the same
  // click path a real player would use.
  await page.evaluate(() => { document.querySelector('.dash-tab[data-tab="league"]')?.click(); });
  await page.waitForTimeout(150);
  await page.evaluate(() => { document.querySelector('[data-league-subtab="alltime"]')?.click(); });
  await page.waitForTimeout(150);
  const clicked = await page.evaluate((id) => {
    const link = document.querySelector(`[data-rival-id="${id}"]`);
    if (link) { link.click(); return true; }
    return false;
  }, flagged.id);
  expect(clicked, "expected the All-Time table to have a clickable link for the flagged starter").toBe(true);
  if (clicked) {
    await page.waitForTimeout(150);
    const overlayText = await page.evaluate(() => document.getElementById("rivalProfileOverlay")?.textContent || "");
    expect(overlayText, "the rival profile overlay must render his availability label").toContain(flagged.availability.label);
  }

  // (2) Transaction/history surface: career.leagueNewsLog.
  const saved = await readActiveCareer(page);
  const newsHit = (saved.career.leagueNewsLog || []).find(n =>
    n.teamId === flagged.teamId &&
    n.year === flagged.availability.year &&
    (n.title === "Starter Injured" || n.title === "Starter Suspended")
  );
  expect(
    newsHit,
    `expected a leagueNewsLog entry for ${flagged.name}'s ${flagged.availability.reason} in ${flagged.availability.year}`
  ).toBeTruthy();
});
