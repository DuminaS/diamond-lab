// Wave 7 (MASTER_REMEDIATION_SPEC.md), Section 8 scenario #25 / tasks #8-#9. Confirmed defects:
// (1) "Admin tools are exposed in the production UI and duplicate obsolete award/win calculations"
// -- computeMetricBreakdown() hand-duplicated proBowlScore/allProScore/mvpScore into an OBSOLETE
// probabilistic "odds" model (a % chance) that no longer matches how awards actually resolve at all
// (a real, comparative, fixed-slot/winner-take-all selection -- resolveSeasonAllProAndProBowl/
// resolveSeasonMVP), and its eligibility gate additionally required ratingEdge>=1/>=9 on top of
// playing time -- a stricter rule production explicitly removed (see evaluateSeasonAwards's own
// comment on why). Fixed by calling the real, production evaluateSeasonAwards function directly.
// (2) Admin tools were exposed in the production UI at all -- fixed by gating the toggle button
// behind import.meta.env.DEV (removed from the DOM entirely in a production build).
//
// This test needs the dev-only admin UI, so it targets the second webServer (DEV_PORT, `vite dev`)
// this wave added to playwright.config.js specifically for this file -- every other regression test
// in this suite still exercises the real production preview build, unchanged.
import { test, expect } from "@playwright/test";

const DEV_PORT = 5343;

test("admin-calculator-calls-production-math", async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto(`http://localhost:${DEV_PORT}/`);

  // Confirmed absent from the production build (task #9) -- verified by the OTHER tests in this
  // suite, which all run against `vite preview` and never see this button at all. Here, on the dev
  // server, it must exist so this one test can reach the panel.
  await expect(page.locator("#adminToggleBtn")).toBeAttached();

  // Start a quick career -- combine picks, decade, draft night -- using the same click-through
  // pattern careerFlow.mjs's startCareer uses, inlined here since that helper always targets the
  // default (preview) baseURL's port implicitly via relative navigation assumptions.
  await page.click("#startBtn");
  await page.waitForSelector("#combineSetupBeginBtn", { timeout: 10_000 });
  await page.click("#combineSetupBeginBtn");
  for (let i = 0; i < 12; i++) {
    await page.waitForSelector(".player-card", { timeout: 10_000 });
    await page.click(".player-card >> nth=0");
  }
  await page.waitForSelector("#goProBtn", { timeout: 10_000 });
  await page.click("#goProBtn");
  await page.waitForSelector(".decade-card", { timeout: 10_000 });
  await page.click(".decade-card >> nth=0");
  await page.waitForSelector("#enterDraftNightBtn:not([disabled])", { timeout: 10_000 });
  await page.click("#enterDraftNightBtn");
  await page.waitForSelector("#startCareerBtn", { state: "visible", timeout: 10_000 });
  await page.click("#startCareerBtn");
  await page.waitForSelector("#careerContent .season-card, #careerContent .choice-btn", { timeout: 15_000 });

  await page.click("#adminToggleBtn");
  await page.waitForSelector(".admin-panel", { timeout: 10_000 });
  await page.click('.admin-tab[data-tab="calc"]');
  await page.waitForSelector("#cbeMin10", { timeout: 10_000 });

  // Force an extreme, deeply-below-average build -- ratingEdge will be well below the old
  // (removed) ratingEdge>=1 requirement, while attempts/game stays well above 200 for a full
  // season (attempts scale with role/mobility, not overall skill) -- exactly the scenario the old,
  // obsolete gate would have wrongly failed.
  await page.click("#cbeMin10");
  await page.waitForTimeout(150);

  const data = await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll(".calc-metric"));
    const find = name => cards.find(c => c.querySelector(".calc-metric-name")?.textContent === name);
    const pbCard = find("All-Star Score");
    const gates = pbCard ? Array.from(pbCard.querySelectorAll(".calc-gate")).map(g => ({ pass: g.classList.contains("pass"), text: g.textContent })) : [];
    const attemptsGate = gates.find(g => g.text.includes("PA >"));
    const ratingGateStillPresent = gates.some(g => g.text.toLowerCase().includes("ratingedge") && g.text.includes("must grade out"));
    return {
      proBowlResult: pbCard?.querySelector(".calc-metric-result")?.textContent || null,
      gates,
      attemptsGatePass: attemptsGate ? attemptsGate.pass : null,
      ratingGateStillPresent,
    };
  });

  expect(data.proBowlResult, "expected the All-Star Score card to render").toBeTruthy();
  // The confirmed-removed gate text ("ratingEdge >= 1 -- must grade out above league average
  // himself") must no longer appear at all -- production's real proBowlEligible has no rating
  // component, only playing time.
  expect(data.ratingGateStillPresent, "the old, removed ratingEdge>=1 gate text must not reappear").toBe(false);
  // With a min-10 build, attempts/game still clears 200 for a full season (attempts don't depend
  // on overall skill), so the real production gate (proBowlEligible = attempts>200 &&
  // gamesPlayedShare>=0.65) should read PASS here -- the old gate (which additionally required
  // ratingEdge>=1) would have failed this exact scenario.
  expect(data.attemptsGatePass, `expected the attempts gate to pass for a full-season min-10 build; gates were: ${JSON.stringify(data.gates)}`).toBe(true);
});
