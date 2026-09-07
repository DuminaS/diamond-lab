// Phase 14: the Analytics dashboard tab -- per-season advanced rate metrics (wOBA, wRC+, ISO,
// BABIP, BB%, K%, BsR) plus an estimated batting WAR, all derived from the real per-season batting
// line the engine already stores. This verifies the tab renders, the table has a row per played
// season, and every number lands in a sane range.
import { test, expect } from "@playwright/test";
import { startCareer, advanceSeasons } from "../helpers/careerFlow.mjs";
import { installSeededRandom } from "../helpers/seededRandom.mjs";

test("the Analytics tab renders sane advanced metrics per season", async ({ page }) => {
  test.setTimeout(150_000);
  await installSeededRandom(page, 909);
  await startCareer(page, { decadeIndex: 5 });
  await advanceSeasons(page, 4);

  await page.evaluate(() => document.querySelector('.dash-tab[data-tab="analytics"]')?.click());
  await page.waitForTimeout(200);

  const data = await page.evaluate(() => {
    const panel = document.getElementById("tabpanel-analytics");
    if (!panel) return null;
    const cardLabels = [...panel.querySelectorAll(".an-card-label")].map(n => n.textContent.trim());
    const table = panel.querySelector("table.an-table");
    const headers = table ? [...table.querySelectorAll("thead th")].map(t => t.textContent.trim()) : [];
    const rows = table ? [...table.querySelectorAll("tbody tr")].map(tr => [...tr.querySelectorAll("td")].map(td => td.textContent.trim())) : [];
    return { cardLabels, headers, rows };
  });

  expect(data, "analytics panel should exist").toBeTruthy();
  expect(data.cardLabels.join(" ")).toMatch(/bWAR/);
  expect(data.cardLabels.join(" ")).toMatch(/wOBA/);
  expect(data.cardLabels.join(" ")).toMatch(/wRC\+/);
  expect(data.headers).toEqual(["Year", "Age", "Team", "Pos", "PA", "wOBA", "wRC+", "ISO", "BABIP", "BB%", "K%", "BsR", "bWAR"]);
  expect(data.rows.length, "a row per played season").toBeGreaterThanOrEqual(3);

  const idx = { pa: 4, woba: 5, wrc: 6, iso: 7, babip: 8, bb: 9, k: 10, bsr: 11, war: 12 };
  data.rows.forEach(r => {
    const pa = Number(r[idx.pa]);
    const woba = parseFloat(r[idx.woba]);
    const wrc = Number(r[idx.wrc]);
    const babip = parseFloat(r[idx.babip]);
    const bbp = parseFloat(r[idx.bb]);
    const kp = parseFloat(r[idx.k]);
    const war = parseFloat(r[idx.war]);
    expect(pa, `PA sane (${r.join(" ")})`).toBeGreaterThan(50);
    expect(pa).toBeLessThan(780);
    expect(woba, `wOBA in range (${r.join(" ")})`).toBeGreaterThan(0.18);
    expect(woba).toBeLessThan(0.55);
    expect(wrc, `wRC+ in range (${r.join(" ")})`).toBeGreaterThan(-20);
    expect(wrc).toBeLessThan(320);
    expect(babip).toBeGreaterThan(0.15);
    expect(babip).toBeLessThan(0.5);
    expect(bbp).toBeGreaterThanOrEqual(0);
    expect(bbp).toBeLessThan(30);
    expect(kp).toBeGreaterThanOrEqual(0);
    expect(kp).toBeLessThan(45);
    expect(war, `bWAR sane (${r.join(" ")})`).toBeGreaterThan(-4);
    expect(war).toBeLessThan(16);
  });
});
