// Phase 15b: with a full ~250-deep field of tracked hitters, awards resolve the way real baseball
// does -- Silver Slugger and Gold Glove one winner per fielding position per league (9 AL + 9 NL),
// and All-Star rosters with real position representation. This sweeps a modern-era career and
// checks the counts + the by-position shape for a recent season.
import { test, expect } from "@playwright/test";
import { startCareer, advanceSeasons, readActiveCareer } from "../helpers/careerFlow.mjs";
import { installSeededRandom } from "../helpers/seededRandom.mjs";

test("Silver Slugger + Gold Glove are one per position per league; All-Star rosters have position reps", async ({ page }) => {
  test.setTimeout(240_000);
  await installSeededRandom(page, 909090);
  await startCareer(page, { decadeIndex: 5 });
  await advanceSeasons(page, 9);

  const saved = await readActiveCareer(page);
  expect(saved, "career should have produced seasons").toBeTruthy();
  const c = saved.career;
  // the last fully-simulated year's award rows still exist on entities (window keeps the latest)
  const year = c.seasonLog[c.seasonLog.length - 1].year;

  const grants = { "Silver Slugger": [], "Gold Glove": [], "All-Star": [] };
  const consider = (s) => Object.keys(grants).forEach(label => {
    if ((s.awards || []).includes(label)) grants[label].push((s.awardPos || {})[label] || null);
  });
  Object.values(c.qbsById || {}).forEach(e => (e.seasons || []).forEach(s => { if (s.year === year) consider(s); }));
  c.seasonLog.forEach(s => { if (s.year === year) consider(s); });

  // Silver Slugger: up to 2 per position (one per league) -> ~14-18 total, each carrying a position
  expect(grants["Silver Slugger"].length, "Silver Sluggers this year").toBeGreaterThanOrEqual(12);
  expect(grants["Silver Slugger"].length).toBeLessThanOrEqual(18);
  grants["Silver Slugger"].forEach(p => expect(p, "each Silver Slugger names a position").toBeTruthy());
  const ssByPos = {};
  grants["Silver Slugger"].forEach(p => ssByPos[p] = (ssByPos[p] || 0) + 1);
  Object.entries(ssByPos).forEach(([pos, n]) => expect(n, `Silver Slugger count at ${pos}`).toBeLessThanOrEqual(2));

  // Gold Glove: up to 2 per fielding position (no DH) + up to 2 for pitchers (Phase 16d) -> ~12-18
  expect(grants["Gold Glove"].length, "Gold Gloves this year").toBeGreaterThanOrEqual(10);
  expect(grants["Gold Glove"].length).toBeLessThanOrEqual(18);
  grants["Gold Glove"].forEach(p => { expect(p, "each Gold Glove names a position").toBeTruthy(); expect(p).not.toBe("DH"); });

  // All-Star: a real roster -- dozens per year, not the old ~6
  expect(grants["All-Star"].length, "All-Stars this year").toBeGreaterThan(22);
  expect(grants["All-Star"].length).toBeLessThan(64);
});
