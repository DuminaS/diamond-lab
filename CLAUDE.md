# Diamond Lab — project memory for Claude Code

This file is auto-loaded by Claude Code every time it starts in this folder. It's the fast-start
context. Three companion docs go deeper:

- **`CONVERSION.md`** — the football→baseball conversion tracker: ground rules, the attribute map,
  and the phase-by-phase checklist of what was reskinned and what was deliberately left opaque.
  Read this before touching any game mechanic — it names the load-bearing identifiers that look
  like football but are now baseball.
- **`PROGRESS.md`** — the full round-by-round development log inherited from Gridiron Lab. Every
  numeric dial, every bug and how it was caught, and a "Key architecture notes" section at the
  bottom naming the load-bearing functions/invariants. The reasoning is still valid; only the
  sport-facing names changed. The top of the file carries the "Conversion to Baseball" summary.
- **`README.md`** — short public-facing description + build commands.

## What this is

**Diamond Lab** is a baseball career simulator: build a hitter by picking his twelve tools in the
Showcase, then play a full MLB career — the draft, 162-game seasons, the postseason, awards,
arbitration and free agency, injuries, rivalries, a Cooperstown verdict, an exportable baseball
card. There is a two-player **Parallel Universe** mode (same seeded Showcase, independent careers,
one Compare screen).

It is a **full conversion of Gridiron Lab**, a QB-career simulator. Diamond Lab shares that
project's engine skeleton — the season/playoff/awards/development/HOF/multiplayer machinery —
reskinned and re-tuned end to end for baseball. Gridiron Lab lives in its own repo
(`../gridiron-export`) and is developed independently; **nothing here syncs to it**, and that
folder + its GitHub repo are off limits (this repo's `origin` remote was removed so a stray push
can't reach it). Conversion work lives on branch `baseball-conversion`; a new GitHub repo
(`diamond-lab`) gets wired up once it exists.

Game logic, UI rendering, and styles all live in one big IIFE — `src/main.js` — with pure
simulation math factored into modules under `src/sim/` and static data under `src/data/`. The root
`index.html` is a slim Vite entry shell (markup only, no game logic).

## Load-bearing invariants (read before editing game logic)

The conversion kept a large set of internal identifiers **unchanged on purpose** — renaming them
buys nothing and risks desyncing dozens of lookup sites. Treat these as baseball despite the name:

- **`conf: "AFC" / "NFC"`** = American League / National League. `confLabel`/`confShort`/
  `conferenceOf` wrap them for display; the literals themselves never change.
- **Internal playoff round literals** `"Wild Card"` / `"Divisional"` / `"Conference Championship"`
  / `"Super Bowl"` = Wild Card Series / Division Series / LCS / World Series. `roundDisplayLabel`
  is the only place they become baseball words. `confirmPlayoffRound`'s dispatch, `isSB` checks,
  and `ROUND_DIFFICULTY_WEIGHTS` all key off the exact literals.
- **QB/roster identifiers**: `assignQuarterbackToRoster`, the `QB1/QB2/QB3` role keys, `USER_QB_ID`,
  `career.qbsById`, `career.leagueRivals`, `career.leagueDepthCharts`, `career.isBackup`. QB1 =
  the everyday player at the position; QB2/QB3 = bench. Visible labels say "Everyday / Bench".
- **`career.eventLedger`** literals for `championship_won` / `championship_lost` / `key_moment` /
  `coordinator_carousel` etc. — the achievement rule engine (`src/sim/achievementRules.js`) keys
  off them.
- **The five team-grade keys** `oline / weapons / defense / coaching / gmGrade` — kept as-is;
  each still has exactly one mechanical hook (see PROGRESS.md's Round 9 note). Displayed as
  five baseball-flavored grade cards via `buildGradeCardsHtml`.
- **Dev-plan ids** `balanced / mechanics / film / athletic / chemistry / recovery`.
- **"Legacy slot aliases"**: the engine variables `comp / att / yards / td / int / sacks /
  rushAtt / rushYards / rushTd` are reinterpreted as baseball —
  `comp`=hits, `att`=PA, `yards`=total bases, `td`=HR, `int`=K, `sacks`=GIDP,
  `rushAtt`=SB attempts, `rushYards`=SB, `rushTd`=0. Season objects **also** carry the real
  baseball fields (`pa/ab/hits/doubles/triples/hr/bb/hbp/sf/k/sb/cs/rbi/runs/avg/obp/slg/ops/
  opsPlus`). `passerRating(h, pa, tb, hr, k, bb)` returns an OPS+ index (100 = league average,
  era-relative).

The **12 tool keys are unchanged** (ARM/REL/MOB/IMP = physical, DAC/SHA/TCH/PKT = hitting,
ANT/DEC/CLU/DUR = mental); only labels and the group name (`accuracy` → `hitting`) changed. See
the attribute map in `CONVERSION.md`.

## Storage namespace

Everything is `diamondlab.*`: `diamondlab.activeCareer` (the single-slot in-progress save, or
`diamondlab.activeCareer.mp.<matchId>.<slot>` in multiplayer), `diamondlab.trophyroom`,
`diamondlab.lastbuild`, `diamondlab.achievementsGlobal`, `diamondlab.mpResult.*`,
`diamondlab.keymoments`. Result-code prefix is `DLR1-`. **No football save-migration** — a
`gridironlab.*` save is not read.

## Build / run

- `npm install`, then `npm run dev` (live-reload), `npm run build` (production → `dist/`),
  `npm run preview` (serve the build).
- `npm test` = `test:balance` (node balance guards) → `build` → full Playwright regression suite.
  `npm run balance:audit` prints the seeded distribution report.
- `npm run android` builds, runs `cap sync android`, opens the native project (`android/`) in
  Android Studio. **Requires Android Studio + the Android SDK.** App id `com.diamondlab.app`,
  app name "Diamond Lab" (set in `capacitor.config.json`, `android/app/build.gradle`,
  `android/app/src/main/res/values/strings.xml`).
- iOS is intentionally not set up (this dev machine is Windows; iOS needs macOS/Xcode).
- PWA: `npm run build` output is a deployable, installable website. Icons in `public/` are
  generated from `icons-src/icon.svg` (a baseball on the charcoal ground). **The PNGs are still
  the old Gridiron monogram** — no SVG→PNG converter is installed on this machine; regenerating
  them is an open TODO tracked in `CONVERSION.md`.
- `.github/workflows/deploy-pages.yml` deploys `dist/` to GitHub Pages on push to its trigger
  branch — update that branch name when the `diamond-lab` repo exists.

## Testing methodology (carried forward unchanged)

- **Diagnostic-driven calibration.** Before committing a numeric dial (a win-probability weight,
  a stat multiplier, an event chance), write a throwaway Node script that loads the logic headless
  and sweeps synthetic builds/matchups, printing real output. Tune from that, not guesses. The
  balance node tests (`tests/balance/*.node.mjs`) and `scripts/balance-audit.mjs` are the
  permanent guardrails — they import the exact `src/sim/` functions the game uses.
- **Playwright, not jsdom, for anything interactive.** jsdom is fine for a load-only smoke check
  but produced flaky false positives once a test clicked through a multi-step flow. Real headless
  Chromium against `vite preview` is the norm. `tests/helpers/careerFlow.mjs` drives a career from
  the menu through any number of seasons; `tests/helpers/seededRandom.mjs` installs a deterministic
  `Math.random` before the page loads.
- **Debug hooks live in disposable copies of `src/main.js`, never the real one.**
- **Brainstorm before big redesigns** — sketch a few concrete options and let the user pick.

## Current status — Phase 16 (pitchers) + review-fixes

The 12-phase football→baseball conversion is done. Since then, on `main`:
- **Phases 13–15** (see `CONVERSION.md`): best-of-N playoff series; a broad baseball-faithfulness
  pass; the steroid era + dark-humor events + an analytics tab; and **full 9-man rosters** — every
  batting-order slot on every team is a real tracked, simulated character with by-position awards.
- **Phase 16**: **pitchers**. Every staff is a roster of tracked arms (SP1–5, a closer from 1975,
  two setup men), and there's a **Pitcher career path** — chosen on the Showcase setup screen via a
  Hitter / Pitcher fork. Pitcher Showcase (12 pitching tools, its own historical pool), a mound
  season model (`generatePitcherSeason`), Cy Young + the pitching awards, a pitcher Cooperstown
  formula, analytics/rival-profile/card pitcher views. Deferred: multiplayer on the Pitcher path
  (match code at capacity); two-way (Ohtani) careers.
- **review-fixes** branch (all 13 findings done; see `CONVERSION.md`'s three review passes):
  stat/scoring consistency — the bottom-of-the-9th walk-off bug (wrong-winner), pitcher lines
  derived FROM the game (ER ≤ opponent runs, integer outs bounded by innings played), hitter
  season line = the exact sum of the game logs, opponent-aware missed games; the **pitcher
  postseason** is now a pitcher's (his real start lines, series fatigue, October arm wear);
  visible + recoverable save failures; pitcher build identities + pitcher-worded dev plans;
  rare feats are real inspectable games; analytics consistency; multiplayer scoring presets.
  Third pass (screenshot bug report): the player-pitcher is **never a lineup entity** (was being
  slotted into his own batting order → NaN overall + "(you)" batting boxes); pitcher playoff run
  support no longer goes NaN (every game was 1-0); the Attributes / Career Trends / Approach / Team
  tabs are the pitcher's, not a hitter's; a couple of era-theme contrast fixes.

Test suite: **80 regression + 72 balance green**. `npm test` runs balance → build → regression.
The deploy workflow (`.github/workflows/deploy-pages.yml`) now gates on the full suite.

Known deferred (tracked in `CONVERSION.md` / `PHASE16_PLAN.md`): deep opaque-identifier renames,
the admin Stat Calculator tab's football-ish labels, PNG icon regeneration, a full seeded tuning
sweep of the first-pass stat coefficients.

Do not restore: the old QB-to-all-five-team-grades feedback loop, the self-amplifying
breakout/devSpeed loop, or a fixed tendency-to-play-call answer key in the Key Moment mini-game.
