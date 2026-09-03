# Gridiron Lab — project memory for Claude Code

This file is auto-loaded by Claude Code every time it starts in this folder. It's the fast-start
context; `PROGRESS.md` in this same folder is the full round-by-round development log — read that
when you need the detailed "why" behind a specific mechanic, formula, or bug fix.

## Current local status — 2026-09-03

**Multiplayer: Parallel Universe Mode, Private Match is built and shipped** -- the first real
combination out of `MULTIPLAYER_MODE_SPEC.md` (a full design map written across three planning
passes before any code). Two players share a match code, each drafts blind from the exact same
seeded Combine rolls, and each plays a fully independent solo-style career; a Compare screen scores
both on a weighted composite (rings/accolades/peak-rate-quality/totals/achievements/earnings) once
both export a result code. No backend, no accounts -- everything is a copy-pasted code, matching
this project's own "stay browser-local" decision. New pure modules: `src/sim/prng.js` (a real,
production seeded-RNG mechanism -- promotes the test-only mulberry32 generator into a global
`Math.random` override, so zero of the hundreds of existing `Math.random()` call sites anywhere
else in the codebase had to change), `src/sim/matchCode.js` (match + result code encode/decode),
`src/sim/multiplayerScore.js` (the scoring composite). New menu flow (Multiplayer hub -> Create/
Join/Compare), a namespaced save-key scheme (`activeCareerKey`, was a single constant, now a
session variable) so multiplayer saves can't collide with the solo save or each other, and an
"Active Multiplayer Matches" strip that scans `localStorage` directly rather than trusting an
in-memory pointer to survive a reload. Same League Mode and the public/matchmaking track remain
planning-only -- read `MULTIPLAYER_MODE_SPEC.md` before touching anything multiplayer-related, and
see PROGRESS.md's dated entry for the two real bugs found and fixed during the build (a forgotten
import that broke the Compare button; an unclamped score component that could go negative or over
100 on malformed input).

Immediate follow-up shipped the same day: **multiplayer is now always played Blind, with no
respins and no Fast-Forward** (a direct request to close the "just judge Classic ratings instead of
actually going blind" and "burn a respin to see a better option" loopholes a fair blind-draft
comparison can't tolerate). Also reorganized the menu -- the four primary buttons (Start the
Combine/Trophy Room/Achievements/Multiplayer) now sit at the very top, above the hero copy, and the
Mode/Key Moments choices moved off the menu entirely onto a new pre-Combine `#screen-combine-setup`
step (solo) / the Create-Join screens' own Key-Moments-only option (multiplayer, since Mode isn't a
real choice there anymore). `resetToSoloSession()` resets `cs.mode` back to Classic and
`syncModeToggleDisplay()` re-syncs the toggle's visible state on every visit, specifically so a
forced-blind multiplayer session can never leave a stale mode showing on a later solo attempt.
"No respins" originally covered only the in-Combine respin buttons; a same-day follow-up caught
that the Results screen's own `#playAgainBtn` (literally labeled **"Run it back"**, redoes the
entire Combine from scratch) was the bigger loophole and needed hiding too -- fixed the same way
(`finishCombine()` hides it whenever `currentMultiplayerContext` is set). See PROGRESS.md for both
entries.

A visual overflow audit (development-plan picker + the exportable baseball card + a broader sweep)
shipped 2026-09-03: fixed a real achievement-name-wrapping bug on the baseball card's SVG back face
(`cardWrapLines` in `src/main.js`, now supports 3 lines instead of silently bleeding into the next
grid cell), added length caps to several previously-uncapped card text fields, replaced the card's
open-ended team-name text with a fixed-width row of small colored team badges (reusing the
draft-night reveal's own `teamColors()`/`teamInitials()` treatment -- new `entry.teamIds` field on
Trophy Room entries, additive/backward-compatible), gave the fixed-position `#buildStamp` corner
badge a background chip so it can't visually blend into scrolled-under content, and added a
universal "swipe to see more" hint under every horizontally-scrollable `.table-wrap` table. See the
newest PROGRESS.md entry for the full list of what was checked and confirmed clean vs. actually
fixed -- notably the development-plan picker itself and the achievements grid both turned out fine
already; don't re-litigate those without a new concrete report.

The remediation waves and Android verification are complete. Balance implementation Waves 1-7 are
implemented locally (all six items on the original "Next balance waves" list, plus a Wave 7 closing
out Wave 6's own gaps): Wave 1 (honest Combine-vs-Football-OVR ratings, draft order tied to team
quality, retuned development, dynasty-feedback removal), Wave 2 (performance-over-expectation
development, a player-chosen offseason program, team chemistry, AI/rival parity on that same
mechanic), Wave 3 (the Key Moment mini-game's permanent 1:1 tendency-to-play-call answer key is
gone -- replaced by a contextual EV model in `src/sim/keyMoments.js`; Clutch now gates execution, not
whether the mini-game triggers at all), Wave 4 (three real contract structures at signing time, each
with a genuine, opposite-direction `career.capPressure` effect on O-Line/Weapons specifically; a
coordinator-carousel "success tax" that can cost Coaching points after a Conference Championship or
Super Bowl finish), Wave 5 (Pro Bowl/All-Pro/MVP no longer score off raw win% --
`winsAboveExpectation`, in `src/sim/awards.js`, replaces it everywhere, and MVP is now the balance
brief's own explicit 45/20/20/10/5-weighted -- efficiency/volume/wins-above-expectation/
availability/narrative -- composite), Wave 6 (a new `career.eventLedger` structured event timeline,
written alongside the older `lifeEventLog`, feeding a new pure declarative rule engine,
`src/sim/achievementRules.js`; 26 new achievements shipped this way, 39 -> 65 total), and Wave 7
(fixed a real gap Wave 6 left -- the ledger's `championship_won`/`championship_lost`/`key_moment`
events now carry the opponent's real team id, already-existing data (`season.playoffs.rounds[i].
oppId`) that just hadn't been threaded through -- added `everySeasonRule`/`sameFieldAs`/
`groupCountRule` to the rule engine, migrated 17 more pre-Wave-6 achievements to it, and shipped 20
more new ones incl. opponent/revenge chains; 65 -> 85 total achievements, explicitly still well
short of the brief's literal 250, documented honestly in PROGRESS.md). Read the newest sections at
the top of `PROGRESS.md` before changing career difficulty, development math, the Key Moment
decision model, contract signing, team-grade drift, award scoring, or the achievement system.
Rating/development/Key-Moment/award math has begun moving out of the IIFE into pure production modules
under `src/sim/`. Run `npm run balance:audit` for the seeded distribution report and `npm test` for
the balance guards, production build, and full browser suite. Do not restore the old
QB-to-all-five-team-grades feedback, the self-amplifying breakout/devSpeed loop, or a fixed
tendency-to-play-call answer key.

The 1960s-era schedule/standings mismatch found during Wave 2's review (a rare personal-losses
miscount in `simulateRegularSeasonGames` for backup-heavy seasons with an incumbent-covered tie) has
been root-caused and fixed -- see the "Wave review pass" PROGRESS.md entry. No other open findings
from Waves 1-3 as of that review.

## What this is

A QB-career simulator ("Gridiron Lab") — build a quarterback, take him through the Combine, then
simulate a full career: draft night, seasons, playoffs, awards, trades, injuries, retirement, a Hall
of Fame verdict. Game logic, UI rendering, and styles all still live in one big IIFE — that hasn't
changed — but as of the Vite/Capacitor migration (see below) that IIFE is `src/main.js`, styles are
`src/style.css`, and the root `index.html` is a slim Vite entry shell (markup only, no game logic).
The original monolithic `index.html` (everything in one file) is preserved in git history if you
ever need to diff against it.

It started life as, and is still also published as, a Claude Artifact (a hosted single-file HTML
page on claude.ai). That published copy and this local copy are now two genuinely different things
— the Artifact is still one flat file, while this local copy is a real Vite + Capacitor project.
Nothing here automatically syncs to it; treat this local project as the new source of truth going
forward, and expect to manually re-flatten (`src/style.css` + `src/main.js` + root `index.html`
markup back into one file) if you ever want to republish an Artifact snapshot.

### Build / run

- `npm install`, then `npm run dev` for a live-reload dev server, `npm run build` for a production
  build to `dist/`, `npm run preview` to serve that build locally.
- `npm run android` builds, runs `cap sync android`, and opens the native Android project (`android/`)
  in Android Studio. **Requires Android Studio (bundles a JDK) and the Android SDK to actually build
  or run the app** — as of the migration, neither was installed on the dev machine; installing
  Android Studio is a prerequisite before any native build/run/emulator step can be verified.
- App id `com.gridironlab.app`, app name "Gridiron Lab" — set via `capacitor.config.json` and in
  `android/app/build.gradle` / `android/app/src/main/res/values/strings.xml` if it ever needs to change.
- iOS is intentionally not set up yet (deliberate call: this dev machine is Windows, and Xcode/iOS
  builds require macOS — Android ships first, iOS revisited later via a Mac or a cloud Mac CI service).

## Before you touch anything: read PROGRESS.md

`PROGRESS.md` has the full history — every shipped round, the reasoning behind every numeric dial
(win-probability formulas, stat-production calibration, development mechanics), bugs that were
caught and how, and a "Key architecture notes" section at the bottom that names the load-bearing
functions and the invariants future changes need to respect (e.g. certain internal string literals
like `"Wild Card"`/`"Conference Championship"` must never change because multiple lookups key off
the exact text). Skim that section first for any change that touches game logic — it will save you
from re-deriving decisions that were already made deliberately, and from silently breaking something
these notes call out as load-bearing.

## Working style established so far (carry this forward)

- **Diagnostic-driven calibration.** Before committing a new numeric dial (a win-probability weight,
  a stat-production multiplier, an event-frequency chance), write a small throwaway Node script that
  loads the game logic headlessly and sweeps synthetic builds/matchups across a range, printing the
  resulting numbers. Tune from real output, not guesses.
- **Test before publish/commit.** The prior (Cowork) environment used jsdom to load the file
  headlessly, injected a `window.__debug` accessor object into throwaway copies only (never the real
  file) to reach internal functions/state for testing, and ran a ~16-family regression suite plus
  new targeted tests for whatever just changed. That norm carries forward unchanged even though the
  file moved: debug hooks belong in disposable copies of `src/main.js`, never in the real one.
  `jsdom` is already a devDependency for exactly this.
- **Diagnose before changing a numeric dial.** When something feels off (too easy, too hard, a stat
  looks wrong), reproduce it with a synthetic build first if possible, and say plainly if an exact
  user-reported number couldn't be reproduced rather than silently guessing — see the PROGRESS.md
  Round 4 stat-tightening note for an example of how that was handled.
- **Brainstorm before big redesigns.** When a change is more "let's rethink this system" than "fix
  this bug," the pattern has been to sketch a few concrete options and let the user pick before
  building — see the Round 4 development-overhaul entry in PROGRESS.md for how that played out.

## Where this stood as of the last Cowork session

Four rounds shipped (see PROGRESS.md for the full list): core sim engine and career flow, a stat/
difficulty pass, a scheduling/awards/naming pass, and a difficulty + team-quality + development
overhaul. No open bugs or half-finished work as of this export — the last thing shipped was the
Round 4 development boom/bust system, tested and published.

## Turning this into "an app" — decided, in progress

Direction (decided, not open for re-litigation without a reason): native app store distribution via
Capacitor wrapping the web build, **Android first** (this dev machine is Windows — iOS needs a Mac
or cloud CI, revisit later), monetization via a **rewarded-ad "watch an ad for a bonus reroll"**
mechanic, **mock ad SDK for now** (swap in a real one like AdMob once the platform is proven),
**staying browser-local** (localStorage) rather than standing up a backend until there's an actual
need for cross-device saves, leaderboards, or server-side ad-reward verification.

Also decided: **ship a website too** (same Vite build — no separate codebase), which doubles as the
free path to iOS playtesting. PWA (manifest + service worker) means any host serving `dist/` is
both "the website" and an installable, auto-updating home-screen app on iOS/Android without needing
the App Store or TestFlight. TestFlight/Play-internal-testing are still the plan for the eventual
real native builds, not for playtesting today.

Progress so far:
1. ✅ Vite scaffold — `index.html` split into `src/style.css` + `src/main.js` (still one IIFE, not
   yet modularized) + a slim root `index.html` shell. Verified via a jsdom smoke test that the split
   changed nothing at runtime (all data tables load, key DOM elements present, no exceptions).
2. ✅ Capacitor + Android project scaffolded (`android/`, `capacitor.config.json`, app id
   `com.gridironlab.app`). **Not yet build/run-verified** — Android Studio is now installed on the
   dev machine but a real emulator/device run hasn't been done yet.
3. ✅ PWA support (`vite-plugin-pwa`, `vite.config.js`, icons in `public/` generated from
   `icons-src/icon.svg`, a placeholder gold-on-charcoal "GL" monogram — swap for real branding
   whenever art exists). `npm run build` output is a deployable, installable website; not yet
   deployed to a live host (pick one: Cloudflare Pages / Netlify / GitHub Pages, all free).
4. ⬜ Not yet started: splitting `src/main.js` into real modules (data/constants, pure sim logic,
   persistence, UI-render, app bootstrap) — do this incrementally, chunk by chunk, verified against
   the jsdom regression norm after each chunk, not as one big-bang rewrite. `PROGRESS.md`'s "Key
   architecture notes" section still names the load-bearing functions/invariants to preserve.
5. ✅ Real save/resume for an in-progress career shipped: `saveActiveCareer()`/`loadActiveCareer()`/
   `clearActiveCareer()` persist `{career, build}` (both needed — `build` is the separate top-level
   variable `developAttributes` mutates each season; `career.originalBuild` is only the frozen
   draft-day snapshot) to `gridironlab.activeCareer`. Checkpointed once per season, in
   `playSeasonAndRender()` right after `renderSeasonCard(season)` — deliberately NOT continuous,
   since that's the one point in the whole advance chain with no mid-event choice pending and no
   animation half-played; anything lost between checkpoints just means replaying that season's
   interstitial event once, not real progress. Cleared in `finishCareer()` (first line) whenever a
   career actually ends. New `#activeCareerStrip` on the menu (gold-bordered, above best/last-build
   strips) shows a "Resume career →" button when a save exists; `resumeActiveCareer()` restores
   `career`/`build`, calls `showScreen("career")`, and re-renders the last logged season via the
   existing `renderSeasonCard(lastSeason)` — no new render path, so a resumed season's actions
   correctly stay disabled pending a playoff reveal exactly like a freshly-generated one would (see
   `renderSeasonCard`'s `pending-reveal`/`animatePlayoffQuarters` handling).
6. ✅ Mock rewarded-ad flow shipped: `src/ads/rewardedAd.js` exports `showRewardedAd({rewardLabel})`,
   a promise resolving `true`/`false` after a 30s countdown modal (`#rewardedAdOverlay`, `.ad-card` —
   skip = false/no reward, claim only enabls once the timer hits 0 = true). Wired to a new
   `cs.bonusRespinLeft` / `cs.adWatchesUsed` pair (capped at `MAX_AD_RESPINS_PER_COMBINE = 3`) that's
   a SHARED pool spendable on either existing respin button once its own free use is gone — no new
   game mechanic, just a top-up on the existing `cs.respinEraLeft`/`respinPlayersLeft` scarcity. New
   "Watch Ad for Bonus Reroll" button next to the two respin buttons. Swapping in a real ad SDK later
   means only rewriting `rewardedAd.js`'s internals — every call site just awaits the same promise.

### Testing-methodology addendum: jsdom can't be trusted for interactive flows here

Discovered while verifying the ad-reroll feature: `main.js`'s existing jsdom-load smoke-test pattern
(inject the built bundle into a jsdom document via a manually created `<script>`, per PROGRESS.md's
established norm) is fine for a load-only smoke check, but produced **flaky, false-positive bugs**
once the test started `.click()`-ing through a multi-step interactive flow with `resources: "usable"`
set (needed so jsdom doesn't warn on the favicon/manifest links) — `cs.order` intermittently read
back as an empty array inside an event-listener callback that never touches `cs.order`, purely a
jsdom artifact (near-certainly the async 404 resource-fetch attempts for the missing CSS/service-
worker files interleaving unpredictably with synchronous script execution). Confirmed real behavior
is correct by re-running the identical interaction sequence with **Playwright + real headless
Chromium** against `vite preview` instead — 13/13 checks passed, matching the original Cowork
environment's own norm of using Playwright for anything beyond a load check (see PROGRESS.md). Rule
going forward: jsdom injection is fine for "did it load without throwing," but any test that clicks
through a multi-step flow (combine rounds, overlays, timers) should use Playwright against a real
dev/preview server, not jsdom — don't re-chase a jsdom-only reproduction next time this happens.
