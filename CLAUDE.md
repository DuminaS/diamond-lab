# Gridiron Lab — project memory for Claude Code

This file is auto-loaded by Claude Code every time it starts in this folder. It's the fast-start
context; `PROGRESS.md` in this same folder is the full round-by-round development log — read that
when you need the detailed "why" behind a specific mechanic, formula, or bug fix.

## What this is

A single-file HTML/CSS/JS QB-career simulator ("Gridiron Lab") — build a quarterback, take him
through the Combine, then simulate a full career: draft night, seasons, playoffs, awards, trades,
injuries, retirement, a Hall of Fame verdict. Everything — markup, styles, game logic — lives in
`index.html`, wrapped in one big IIFE. There is currently no build step, no framework, no backend:
open `index.html` in a browser and it runs.

It started life as, and is still also published as, a Claude Artifact (a hosted single-file HTML
page on claude.ai). That published copy and this local copy are two independent snapshots of the
same file — nothing here automatically syncs to it. If you're continuing development locally, treat
`index.html` in this folder as the new source of truth going forward.

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
  new targeted tests for whatever just changed. If you set up an equivalent local test harness,
  preserve that norm: debug hooks belong in disposable copies, not in `index.html`.
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

## Turning this into "an app"

Nothing here has been decided yet on that front — this file exists so a fresh Claude Code session
has the full history to work from once you're ready to figure out what "app" means for this project
(a proper built web app, something installable, a backend for real accounts/leaderboards, etc.).
When you're ready to plan that, it's worth explicitly discussing scope before Claude Code starts
moving code around: whether to keep this as a single file a while longer, when to introduce a build
step and split it into modules, and whether/when a backend is actually needed versus staying
browser-local.
