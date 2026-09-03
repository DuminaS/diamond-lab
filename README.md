# Diamond Lab

A baseball career simulator. Build a hitter by picking his tools in the Showcase, then take him
through a full MLB career: the draft, 162-game seasons, the postseason, awards, arbitration and
free agency, injuries, rivalries, a Cooperstown verdict, and an exportable baseball card. There is
also a two-player Parallel Universe mode (same seeded Showcase, independent careers, one Compare
screen).

Diamond Lab is a full conversion of **Gridiron Lab** (a QB-career simulator). It shares that
project's engine skeleton — the season/playoff/awards/development/HOF machinery — reskinned and
re-tuned end to end for baseball. Gridiron Lab lives in its own repo and is developed
independently; nothing here syncs to it.

Game logic, UI rendering, and styles all still live in one big IIFE — `src/main.js` — with pure
simulation math factored into modules under `src/sim/` and static data under `src/data/`. The root
`index.html` is a slim Vite entry shell (markup only).

## Build / run

- `npm install`, then `npm run dev` for a live-reload dev server, `npm run build` for a production
  build to `dist/`, `npm run preview` to serve that build locally.
- `npm test` runs the balance guards, a production build, and the full Playwright browser suite.
  `npm run balance:audit` prints the seeded distribution report.
- `npm run android` builds, runs `cap sync android`, and opens the native Android project
  (`android/`). Requires Android Studio + the Android SDK. App id `com.diamondlab.app`.
- iOS is intentionally not set up (this dev machine is Windows).

## Where the history is

`PROGRESS.md` is the full round-by-round development log — every shipped round, the reasoning
behind every numeric dial, bugs caught and how. The football-era history is preserved below the
baseball conversion entry. `CLAUDE.md` is the fast-start orientation loaded by Claude Code.
