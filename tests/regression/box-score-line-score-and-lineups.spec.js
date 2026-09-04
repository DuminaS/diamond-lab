// Phase 13a: the game box-score modal (shared by the Schedule tab and the Playoff Tree) now shows
// a real per-inning line score and a full 9-man batting box for BOTH teams, with R/RBI columns
// that reconcile to the final score. This verifies a Schedule-tab game.
import { test, expect } from "@playwright/test";
import { startCareer, advanceSeasons } from "../helpers/careerFlow.mjs";
import { installSeededRandom } from "../helpers/seededRandom.mjs";

test("box-score modal: per-inning line score + both-team batting boxes that add up", async ({ page }) => {
  test.setTimeout(180_000);
  await installSeededRandom(page, 33221);
  await startCareer(page, { decadeIndex: 4 });
  await advanceSeasons(page, 3);

  await page.evaluate(() => document.querySelector('.dash-tab[data-tab="schedule"]')?.click());
  await page.waitForTimeout(200);
  await page.evaluate(() => document.querySelector("#careerContent .week-matchup-card")?.click());
  await page.waitForSelector("#bracketBoxScoreOverlay table", { timeout: 5000 });

  const data = await page.evaluate(() => {
    const o = document.getElementById("bracketBoxScoreOverlay");
    const tables = [...o.querySelectorAll("table")];
    const ls = tables[0];
    const header = [...ls.querySelectorAll("thead th")].map(t => t.textContent.trim());
    const rows = [...ls.querySelectorAll("tbody tr")].map(tr => [...tr.querySelectorAll("td")].map(td => td.textContent.trim()));
    const boxes = tables.slice(1).map(t => {
      const foot = [...t.querySelectorAll("tfoot td")].map(td => td.textContent.trim());
      const body = [...t.querySelectorAll("tbody tr")].length;
      return { bodyRows: body, totals: foot }; // [ "", "Totals", AB, R, H, BB, RBI, HR ]
    });
    return { header, rows, boxes };
  });

  // Line score: at least 9 innings + an R column
  const innCols = data.header.filter(h => /^\d+$/.test(h));
  expect(innCols.length).toBeGreaterThanOrEqual(9);
  expect(data.header[data.header.length - 1]).toBe("R");

  // Each team's per-inning runs sum to its R total
  data.rows.forEach(r => {
    const nums = r.slice(1).map(Number);
    const total = nums[nums.length - 1];
    const inningSum = nums.slice(0, -1).reduce((a, b) => a + b, 0);
    expect(inningSum, `line-score innings must sum to R (${r.join(" ")})`).toBe(total);
  });

  // Two batting boxes, 9 batters each
  expect(data.boxes.length).toBe(2);
  data.boxes.forEach((b, i) => {
    expect(b.bodyRows).toBe(9);
    const teamR = Number(data.rows[i].slice(1).pop());
    const boxR = Number(b.totals[3]);
    const boxRBI = Number(b.totals[6]);
    expect(boxR, "batting-box R column must equal the team's runs").toBe(teamR);
    expect(boxRBI, "batting-box RBI must not exceed the team's runs").toBeLessThanOrEqual(teamR);
  });
});
