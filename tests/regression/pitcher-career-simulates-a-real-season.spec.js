// Phase 16b: a pitcher career runs through generatePitcherSeason() -- the player's own line is a
// mound model (IP/ERA/WHIP/K/BB/W/L/SV from src/sim/pitching.js + a per-start schedule walk),
// while the entire shared league simulation (rivals, full lineups, free agency, awards, team
// drift, standings, playoffs) runs exactly as it does for a hitter. The fork UI doesn't exist yet
// (16d), so this test converts a fresh career to the Pitcher path in storage, reloads, and plays.
import { test, expect } from "@playwright/test";
import { startCareer, advanceSeasons, readActiveCareer, writeActiveCareer, ACTIVE_CAREER_KEY } from "../helpers/careerFlow.mjs";
import { installSeededRandom } from "../helpers/seededRandom.mjs";

const ACE_BUILD = { VELO: 92, FBL: 88, BRK: 90, CHG: 82, CMD: 88, TUN: 82, SEQ: 88, PIK: 70, STM: 88, PSE: 86, CMP: 86, DUR: 84, path: "pitcher", pitcherRole: "SP" };

test("a starting-pitcher career simulates era-realistic seasons and keeps the whole league intact", async ({ page }) => {
  test.setTimeout(240_000);
  await installSeededRandom(page, 71723);
  await startCareer(page, { decadeIndex: 5 }); // 2000s

  // convert the career to the Pitcher path from season 2 on (the strip needs >=1 logged season to
  // offer a Resume button, so the batter opener is left in place and filtered out of the asserts)
  const saved = await readActiveCareer(page);
  const c = saved.career;
  c.path = "pitcher";
  c.pitcherRole = "SP";
  c.position = "P";
  c.totals.pitching = { gs: 0, gp: 0, ip: 0, w: 0, l: 0, sv: 0, hld: 0, k: 0, bb: 0, h: 0, hr: 0, er: 0, qs: 0, cg: 0, sho: 0, cyYoungs: 0 };
  saved.build = { ...ACE_BUILD };
  c.originalBuild = { ...ACE_BUILD };
  await writeActiveCareer(page, saved);

  await page.reload();
  await page.waitForSelector("#resumeCareerBtn", { timeout: 10_000 });
  await page.click("#resumeCareerBtn");
  await page.waitForSelector("#careerContent .season-card", { timeout: 10_000 });

  const advanced = await advanceSeasons(page, 9);
  expect(advanced, "the pitcher career should play multiple seasons").toBeGreaterThanOrEqual(6);

  const final = await readActiveCareer(page);
  const fc = final.career;
  const seasons = fc.seasonLog.filter(s => s.isPitching);
  expect(seasons.length, "pitcher seasons recorded").toBeGreaterThanOrEqual(6);

  for (const s of seasons) {
    expect(s.position).toBe("P");
    expect(s.era, `year ${s.year} ERA in a sane band`).toBeGreaterThan(1.2);
    expect(s.era).toBeLessThan(7.5);
    expect(s.whip).toBeGreaterThan(0.7);
    expect(s.whip).toBeLessThan(1.9);
    expect(s.w + s.l, `year ${s.year} decisions <= starts`).toBeLessThanOrEqual(s.gs + 1);
    expect(s.ip).toBeGreaterThan(40);
    expect(s.ip).toBeLessThan(270);
    expect(s.k).toBeGreaterThan(s.bbAllowed); // this build misses bats
    // standings still whole
    expect(s.teamWins + s.teamLosses + (s.teamTies || 0)).toBeGreaterThan(150);

    // --- accounting invariants (review) ---
    const pg = (s.gameLog || []).filter(g => g.pitched);
    expect(pg.length, `year ${s.year} has pitched games`).toBeGreaterThan(0);
    let outs = 0, er = 0, k = 0, bb = 0, h = 0, hr = 0;
    for (const g of pg) {
      // outs are integral, and bounded by the innings actually played
      expect(Number.isInteger(g.ipOuts), `year ${s.year} game outs integral`).toBe(true);
      const inningsPlayed = Math.max(9, (g.innings?.my || []).length);
      expect(g.ipOuts).toBeGreaterThanOrEqual(0);
      expect(g.ipOuts, `year ${s.year}: ${g.ipOuts} outs > ${inningsPlayed} innings played`).toBeLessThanOrEqual(inningsPlayed * 3);
      // a pitcher can never be charged more earned runs than his opponent actually scored
      expect(g.er, `year ${s.year}: ${g.er} ER > ${g.oppScore} opp runs`).toBeLessThanOrEqual(g.oppScore);
      expect(g.hrAllowed).toBeLessThanOrEqual(g.er + 1);
      // display string is a valid baseball IP (.0 / .1 / .2)
      expect(/^\d+\.[012]$/.test(String(g.ip)), `year ${s.year} ip "${g.ip}"`).toBe(true);
      outs += g.ipOuts; er += g.er; k += g.k; bb += g.bbAllowed; h += g.hAllowed || 0; hr += g.hrAllowed;
    }
    // the season line IS the sum of the games
    expect(Math.abs(s.ipOuts - outs), `year ${s.year} season outs vs game log`).toBeLessThanOrEqual(1);
    expect(s.er, `year ${s.year} season ER vs game log`).toBe(er);
    expect(s.k, `year ${s.year} season K vs game log`).toBe(k);
    expect(s.bbAllowed, `year ${s.year} season BB vs game log`).toBe(bb);
    // season ERA reconciles with earned runs and innings
    const derivedEra = 9 * s.er / (s.ipOuts / 3);
    expect(Math.abs(derivedEra - s.era), `year ${s.year} ERA ${s.era} vs derived ${derivedEra.toFixed(2)}`).toBeLessThan(0.06);
  }
  // if he made a postseason, the games he started are pitching boxes (not batting), and no ER
  // exceeds the opponent's runs (review finding 7)
  let sawPlayoffStart = false;
  for (const s of seasons) {
    for (const rd of (s.playoffs?.rounds || [])) {
      for (const g of (rd.games || [])) {
        if (g.box && g.box.pitched) {
          sawPlayoffStart = true;
          expect(Number.isInteger(g.box.ipOuts)).toBe(true);
          expect(g.box.er).toBeLessThanOrEqual(g.oppScore);
        }
        if (g.box && g.box.dnp) expect(g.box.pitched).toBeFalsy();
      }
    }
  }
  // (sawPlayoffStart may be false if this seed's team never made October -- that's fine)

  // career IP-outs = sum of season IP-outs
  const seasonOuts = seasons.reduce((a, s) => a + s.ipOuts, 0);
  expect(Math.abs(fc.totals.pitching.ipOuts - seasonOuts)).toBeLessThanOrEqual(seasons.length);
  // every credited no-hitter / perfect game shows up as a season gem
  const noHitCredited = (fc.totals.pitching.noHitters || 0);
  const noHitGems = seasons.reduce((a, s) => a + (s.gems || []).filter(g => /No-Hitter|Perfect Game/.test(g)).length, 0);
  expect(noHitCredited, "no-hitter total matches gem count").toBe(noHitGems);

  // review finding 12: every gem is anchored to a real game in the log with a matching line,
  // and there's a Career Highlights record for each
  const highlights = fc.pitcherHighlights || [];
  expect(highlights.length, "highlights recorded == gem count").toBe(
    seasons.reduce((a, s) => a + (s.gems || []).length, 0)
  );
  for (const s of seasons) {
    for (const gemType of (s.gems || [])) {
      const gemGame = (s.gameLog || []).find(g => g.gem === gemType);
      expect(gemGame, `year ${s.year} ${gemType} has a game in the log`).toBeTruthy();
      if (gemType === "Perfect Game") {
        expect(gemGame.h).toBe(0);
        expect(gemGame.bbAllowed).toBe(0);
        expect(gemGame.ipOuts).toBe(27);
      }
      if (gemType === "No-Hitter") expect(gemGame.h).toBe(0);
      if (/No-Hitter|Perfect Game/.test(gemType)) expect(gemGame.er).toBe(0);
    }
  }
  // the analytics tab surfaces a Career Highlights section when there are any
  if (highlights.length) {
    await page.evaluate(() => document.querySelector('.dash-tab[data-tab="analytics"]')?.click());
    await page.waitForTimeout(150);
    const analytics = await page.textContent("#tabpanel-analytics");
    expect(analytics).toMatch(/Career Highlights/);
    expect(analytics).toMatch(new RegExp(highlights[0].type.replace(/[-]/g, "[-]")));
  }

  // a strong build in its prime should post at least one clearly above-average season
  const bestEraPlus = Math.max(...seasons.map(s => s.eraPlus));
  expect(bestEraPlus, "a peak season clears an above-average ERA+").toBeGreaterThan(112);
  const peakIp = Math.max(...seasons.map(s => s.ip));
  expect(peakIp, "a healthy SP season is a real workload").toBeGreaterThan(150);

  // career totals accumulate on the pitching bucket
  expect(fc.totals.pitching.ip).toBeGreaterThan(seasons.reduce((a, s) => a + s.ip, 0) - 2);
  expect(fc.totals.pitching.k).toBeGreaterThan(400);

  // pitching awards resolve every year -- exactly one Cy Young per league, plus rate titles
  const years = [...new Set(seasons.map(s => s.year))];
  for (const y of years) {
    const rowsThisYear = [];
    Object.values(fc.qbsById || {}).forEach(e => (e.seasons || []).forEach(s => { if (s.year === y && s.isPitching) rowsThisYear.push(s); }));
    fc.seasonLog.forEach(s => { if (s.year === y && s.isPitching) rowsThisYear.push(s); });
    const cyWinners = rowsThisYear.filter(s => (s.awards || []).includes("Cy Young"));
    expect(cyWinners.length, `Cy Young winners in ${y}`).toBeGreaterThanOrEqual(1);
    expect(cyWinners.length, `Cy Young winners in ${y} (<= 1 per league)`).toBeLessThanOrEqual(2);
    const eraTitles = rowsThisYear.filter(s => (s.awards || []).includes("ERA Title"));
    expect(eraTitles.length, `ERA titles in ${y}`).toBeGreaterThanOrEqual(1);
    expect(eraTitles.length).toBeLessThanOrEqual(2);
    const kTitles = rowsThisYear.filter(s => (s.awards || []).includes("Strikeout Title"));
    expect(kTitles.length, `strikeout titles in ${y}`).toBeGreaterThanOrEqual(1);
  }
  // this ace build should collect some hardware over 9 seasons
  const myHardware = seasons.flatMap(s => s.awards || []);
  expect(myHardware.some(a => /Cy Young|ERA Title|Strikeout Title|All-Star|Wins Title/.test(a)), `won something: ${myHardware}`).toBe(true);

  // the shared league model is untouched by the pitcher path
  expect(Object.keys(fc.qbsById || {}).length, "league registry still populated").toBeGreaterThan(120);
  const lineupTeams = Object.keys(fc.teamLineups || {});
  expect(lineupTeams.length, "every team still fields a lineup").toBeGreaterThan(20);
  lineupTeams.forEach(tid => {
    const arr = fc.teamLineups[tid] || [];
    expect(arr.length).toBeGreaterThanOrEqual(8);
    expect(arr.length).toBeLessThanOrEqual(9);
  });

  // save stays bounded
  const mb = JSON.stringify(final).length / 1048576;
  expect(mb, `save ${mb.toFixed(2)} MB`).toBeLessThan(4.7);
});
