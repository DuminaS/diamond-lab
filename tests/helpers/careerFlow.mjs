// Wave 0: shared, committed Playwright helpers for driving a career from the menu through the
// combine, draft night, and any number of seasons -- consolidating the ad-hoc patterns this
// project used all session in disposable scratchpad scripts (never committed, never reusable) into
// one real, maintained place. Every regression test under tests/regression should build on these
// rather than re-deriving its own click sequence.

const SAVE_KEY = "diamondlab.activeCareer";

// Walks combine -> Go Pro -> decade pick -> draft night -> Start Career, optionally typing a
// custom scouting name (used by the XSS regression test) into the identity field first. Leaves
// the page on the very first season card.
export async function startCareer(page, { name = null, decadeIndex = 0 } = {}) {
  await page.goto("/");
  await page.click("#startBtn");
  // Mode + Key Moments now live on a dedicated Combine Setup screen shown right before the Combine
  // itself starts (not a persistent menu-level toggle) -- callers that need Blind mode or Key
  // Moments enabled should check/click those on #screen-combine-setup themselves, between this
  // click and startCareer's own "Begin the Combine" click below.
  await page.waitForSelector("#combineSetupBeginBtn", { timeout: 10_000 });
  await page.click("#combineSetupBeginBtn");
  for (let i = 0; i < 12; i++) {
    await page.waitForSelector(".player-card", { timeout: 10_000 });
    await page.click(".player-card >> nth=0");
  }
  await page.waitForSelector("#goProBtn", { timeout: 10_000 });
  await page.click("#goProBtn");
  // #identityNameInput lives on #screen-career-setup, the same "pick the era" screen as the
  // decade cards -- shown only from here on, never before the combine.
  await page.waitForSelector(".decade-card", { timeout: 10_000 });
  if (name != null) {
    const nameInput = page.locator("#identityNameInput");
    if (await nameInput.count()) {
      await nameInput.fill(name);
    }
  }
  await page.click(`.decade-card >> nth=${decadeIndex}`);
  await page.waitForSelector("#enterDraftNightBtn:not([disabled])", { timeout: 10_000 });
  await page.click("#enterDraftNightBtn");
  await page.waitForSelector("#startCareerBtn", { state: "visible", timeout: 10_000 });
  await page.click("#startCareerBtn");
  await clickThroughToSeasonCard(page);
}

// Clicks whatever's available in #careerContent until a season card appears (or gives up). Used
// right after Start Career, and as a generic "unstick from an interstitial" fallback.
export async function clickThroughToSeasonCard(page, maxTries = 60) {
  for (let i = 0; i < maxTries; i++) {
    const shown = await page.evaluate(() => !!document.querySelector("#careerContent .season-card"));
    if (shown) return true;
    const clicked = await page.evaluate(() => {
      const content = document.getElementById("careerContent");
      const btn = content && content.querySelector(
        "#injPlay, #playOnBtn, #continueBtn, button[id$='Ack'], button[id$='Continue'], .choice-btn, .fa-accept, [id^='pqSimEnd-'], #playoffTreeSimulateBtn:not([disabled])"
      );
      if (btn) { btn.click(); return true; }
      // Key Moment mini-game, if the beta toggle happens to be on -- take the first option so a
      // test never gets stuck on a skill check it isn't trying to exercise.
      const km = document.getElementById("keyMomentOverlay");
      if (km && km.classList.contains("open")) {
        const kb = km.querySelector(".choice-btn, button:not([disabled])");
        if (kb) { kb.click(); return true; }
      }
      return false;
    });
    if (!clicked) await page.waitForTimeout(120);
    else await page.waitForTimeout(60);
  }
  return await page.evaluate(() => !!document.querySelector("#careerContent .season-card"));
}

// Round 32/33: Continue/Play On stays disabled until season.leagueStandings.playoffBracket exists
// -- click "Simulate Next Round" until it's clear, or until nothing more can be done.
// Bug found while building Wave 3's suspension test coverage: whenever the player's OWN real
// playoff run is still pending (they made the playoffs and have an active round with its own
// "Sim to End of Game" button, #pqSimEnd-N -- see playoffRoundsHolder in the season card), this
// helper used to just sit there re-checking #playoffTreeSimulateBtn forever, since THAT button
// deliberately doesn't exist yet until the player's own path is done (the other conference's flat
// side is paced in lockstep with it -- see finalizeRound's own comments). A seed where the player's
// build happens to make the playoffs (not rare) hung this helper indefinitely. Fixed by also
// advancing the player's own pending round the same way advanceOneSeason's walkToDecisionPoint
// already does, so this helper can reach the point where playoffTreeSimulateBtn (or Continue
// itself) becomes available regardless of whether the player made the playoffs this season.
export async function ensureBracketFinalized(page, maxTries = 30) {
  for (let i = 0; i < maxTries; i++) {
    const state = await page.evaluate(() => {
      const btn = document.getElementById("continueBtn") || document.getElementById("playOnBtn") || document.getElementById("retireBtn");
      const simEnd = document.querySelector("#playoffRoundsHolder [id^='pqSimEnd-']:not([disabled])");
      return { ready: !!btn && !btn.disabled, hasSimBtn: !!document.getElementById("playoffTreeSimulateBtn"), hasSimEnd: !!simEnd };
    });
    if (state.ready) return true;
    if (state.hasSimEnd) {
      await page.evaluate(() => document.querySelector("#playoffRoundsHolder [id^='pqSimEnd-']:not([disabled])")?.click());
      await page.waitForTimeout(100);
    } else if (state.hasSimBtn) {
      await page.evaluate(() => document.getElementById("playoffTreeSimulateBtn")?.click());
      await page.waitForTimeout(100);
    } else {
      await page.waitForTimeout(100);
    }
  }
  return false;
}

// Drives ONE full season forward: walks every interstitial/playoff reveal to completion, ensures
// the league-wide bracket is finalized (Round 32/33 gating), clicks Continue/Play On, THEN keeps
// walking through whatever comes after that click (a life event, injury/suspension check, waiver,
// trade, contract, free agency -- advanceCareer()'s whole priority chain runs between one season
// card and the next) until a genuinely NEW season card is showing. A real bug this exact function
// had until caught by a disposable diagnostic script: stopping right after the Continue click,
// before walking the post-click interstitial(s), silently left generateSeason() never called for
// the new year at all -- which one regression test's own false PASS was traced back to (see
// backup-incumbent-double-simulation.spec.js's header comment). Returns false if the career ended
// (retirement/forced exit/HOF) or got stuck before a new season card appeared.
export async function advanceOneSeason(page) {
  const yearBefore = await page.evaluate((key) => {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw).career.year : null;
  }, SAVE_KEY);

  async function walkToDecisionPoint(maxTries) {
    for (let i = 0; i < maxTries; i++) {
      const reachedNext = await page.evaluate(() => !!document.querySelector("#continueBtn, #playOnBtn, #retireBtn"));
      const blocked = await page.evaluate(() => {
        const a = document.getElementById("seasonActions");
        return a && a.classList.contains("pending-reveal");
      });
      if (reachedNext && !blocked) return true;
      const clicked = await page.evaluate(() => {
        const content = document.getElementById("careerContent");
        const simEnd = document.querySelector("#playoffRoundsHolder [id^='pqSimEnd-']:not([disabled])");
        if (simEnd) { simEnd.click(); return true; }
        const btn = content && content.querySelector(".choice-btn, [id^='pqAck-'], button[id$='Ack'], .fa-accept");
        if (btn) { btn.click(); return true; }
        const simRoundBtn = document.getElementById("playoffTreeSimulateBtn");
        if (simRoundBtn && !simRoundBtn.disabled) { simRoundBtn.click(); return true; }
        const km = document.getElementById("keyMomentOverlay");
        if (km && km.classList.contains("open")) {
          const kb = km.querySelector(".choice-btn, button:not([disabled])");
          if (kb) { kb.click(); return true; }
        }
        return false;
      });
      await page.waitForTimeout(clicked ? 60 : 120);
    }
    return false;
  }

  // Phase 1: reach the CURRENT season card's own decision point (may already be there).
  if (!(await walkToDecisionPoint(200))) return false;
  await ensureBracketFinalized(page);
  const clickedContinue = await page.evaluate(() => {
    const btn = document.getElementById("continueBtn") || document.getElementById("playOnBtn");
    if (btn && !btn.disabled) { btn.click(); return true; }
    return false;
  });
  if (!clickedContinue) return false;
  await page.waitForTimeout(100);

  // Phase 2: advanceCareer()'s own priority chain (life event / suspension / waiver / trade /
  // contract / injury / free agency) can insert any number of interstitials between the click
  // above and the NEXT real season card -- keep walking through all of them.
  for (let i = 0; i < 60; i++) {
    const hasNewSeasonCard = await page.evaluate(({ key, yBefore }) => {
      if (!document.querySelector(".season-card")) return false;
      const raw = localStorage.getItem(key);
      if (!raw) return false;
      const year = JSON.parse(raw).career.year;
      return yBefore == null || year !== yBefore;
    }, { key: SAVE_KEY, yBefore: yearBefore });
    if (hasNewSeasonCard) break;
    const stillActive = await page.evaluate((key) => !!localStorage.getItem(key), SAVE_KEY);
    if (!stillActive) return false; // career ended (retirement/HOF/forced exit)
    const clicked = await page.evaluate(() => {
      const content = document.getElementById("careerContent");
      const btn = content && content.querySelector(".choice-btn, [id^='pqAck-'], button[id$='Ack'], .fa-accept, button:not([disabled])");
      if (btn) { btn.click(); return true; }
      const km = document.getElementById("keyMomentOverlay");
      if (km && km.classList.contains("open")) {
        const kb = km.querySelector(".choice-btn, button:not([disabled])");
        if (kb) { kb.click(); return true; }
      }
      return false;
    });
    await page.waitForTimeout(clicked ? 80 : 150);
  }

  const advanced = await page.evaluate(({ key, yBefore }) => {
    if (!document.querySelector(".season-card")) return false;
    const raw = localStorage.getItem(key);
    if (!raw) return false;
    const year = JSON.parse(raw).career.year;
    return yBefore == null || year !== yBefore;
  }, { key: SAVE_KEY, yBefore: yearBefore });
  if (advanced) await page.waitForTimeout(150);
  return advanced;
}

// Advances up to n seasons, stopping early if the career ends. Returns how many actually advanced.
export async function advanceSeasons(page, n) {
  let count = 0;
  for (let i = 0; i < n; i++) {
    const stillActive = await page.evaluate((key) => !!localStorage.getItem(key), SAVE_KEY);
    if (!stillActive) break;
    const ok = await advanceOneSeason(page);
    if (!ok) break;
    count++;
  }
  return count;
}

export async function readActiveCareer(page) {
  return page.evaluate((key) => {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  }, SAVE_KEY);
}

export async function writeActiveCareer(page, saved) {
  await page.evaluate(({ key, value }) => {
    localStorage.setItem(key, JSON.stringify(value));
  }, { key: SAVE_KEY, value: saved });
}

export const ACTIVE_CAREER_KEY = SAVE_KEY;
