# Phase 16 — Pitchers: full staffs + the Pitcher career path

## The ask
Do for pitchers what Phase 15 did for hitters — every arm on every staff a real tracked,
simulated character (realistic rotations, how they're used, game impact, stats) — AND add a
**Pitcher career path**: chosen right after the blind/classic mode choice, before the draft, via
two big buttons with a pitcher / batter silhouette graphic. A pitcher build cares about different
tools, and the result calculations differ (his own starts vs. the opposing lineup, not 162 games
of plate appearances).

## Decisions locked (user, 2026-09-07)
1. **Full parallel pitcher pool + 12 pitching tools.** Author ~120 historical pitchers into a new
   `src/data/pitchers.js`; a `PITCH_ATTRIBUTES` array of 12 pitching tools; the Showcase branches
   entirely on path.
2. **Staff depth = rotation + closer + 2 setup (~8/team, ~240 entities league-wide).** Long relief
   / mop-up stays an abstract team Bullpen grade.
3. **One path per career.** No two-way (Ohtani) for now — noted as a future phase.
4. **Multiplayer: both players locked to the same path** (match creator picks; joiner inherits).

## The 12 pitching tools (`PITCH_ATTRIBUTES`), three groups of four
- **Stuff:** `VELO` Velocity · `FBL` Fastball Life · `BRK` Breaking Ball · `CHG` Changeup
- **Command:** `CMD` Command · `TUN` Tunneling/Deception · `SEQ` Sequencing · `PIK` Pickoff & Hold
- **Makeup:** `STM` Stamina · `PSE` Poise · `CMP` Composure (clutch) · `DUR` Durability

Pitcher data entries carry `pr:{ ...12 keys }` (mirrors the hitter `r:{}`). Era normalization
(`ERA_ATTR_AVG` equivalent) computed from the pitcher pool.

## Architecture (mirrors Phase 15 lineup infra)
- **Fork UI:** new screen after `combineSetup` "Begin" → `screen-path-select` (two big buttons,
  inline-SVG silhouettes). Sets `cs.path`; persisted onto `build.path` / `career.path`.
- **Entities:** `career.qbsById` stays the registry. A pitcher entity gains `pitcher:true`,
  `role:"SP"|"SU"|"CL"`, `rotationSlot`, a `talent` scalar (rivals) or the 12-tool build (player).
- **Rotations:** `career.teamRotations[teamId]` = ~8 registry ids (SP1–SP5, CL, SU1, SU2); the
  player's slot is the string `"user"` on the pitcher path.
- **Functions to add (all RNG-isolated via `withIsolatedRandom`):** `spawnRotationArm`,
  `buildTeamRotation`, `buildLeagueRotations`, `ensureLeagueRotations`, `simulateRotationSeasons`,
  `reconcileTeamRotations`, `rollRotationFreeAgency`, `recomputeRotationGrades`.
- **Pitcher stat model:** `simulatePitcherSeasonStats` → GS/GP/IP/W/L/ERA/WHIP/K/BB/HR/K9/BB9/HR9/
  ERA+/FIP/SV/HLD/CG/SHO/QS. New era tables `PITCH_LEAGUE` (league ERA, K/9, BB/9, IP/GS per
  decade) + `PITCH_STAT_CAL` (per-era clamps vs. real record seasons — Gibson 1.12 '68, Pedro
  2000 291 ERA+, Maddux, Kershaw, Verlander/Ryan K totals). `pitcherRating()` → ERA+/FIP index
  (the pitcher-path analogue of `passerRating`).
- **Game sim:** `simulateGameScore` gains the opposing SP-of-the-day (a rotation-turn counter in
  the schedule) as a run-suppression input. Player-as-pitcher: his start replaces the offense
  side of the calc for games he starts; his season is ~32 GS (SP) or ~65 G (RP/CL), not 162.
- **Team grades:** the `defense` grade ("Defense & Bullpen") gets a roster-derived component from
  the real rotation + bullpen, the way `weapons`/Lineup did in 15c.
- **Storage:** ~240 pitchers + ~250 hitters ≈ 490 active entities. Same retention (rolling window,
  supporting-cast budget, retiree prune). **Measure at 16c; tighten window / raise budget / prune
  harder as needed.** Target < 4.5 MB at 20 seasons. `SAVE_SCHEMA_VERSION` → 5.

## Awards (16d)
Cy Young (1 per league, pitchers only) · Reliever of the Year (~1976+) · pitching Triple Crown
(W/ERA/K) · ERA/K/W/SV/WHIP titles · All-Star staff reps · pitcher Gold Glove (P as a fielding
position) · pitcher Cooperstown formula (career ERA+, IP, K, Cy Youngs, wins, rings) · no-hitter /
perfect game Key Moment + achievement · analytics tab pitcher view (FIP/xFIP/K-BB%/WAR-P/game
score).

## Multiplayer (16e)
Creator's path encoded into the match code; joiner inherits. Same seeded pitcher/hitter Showcase
pool. Compare screen renders pitcher stat lines when `path==="pitcher"`. `multiplayerScore.js`
gets a pitcher greatness branch.

## Rollout (each a commit; `npm run test:balance` + build + `npx playwright test tests/regression`
green at each boundary)

**Engine-first ordering** — the user-facing Pitcher fork is the LAST thing wired on, so there is
never a shipped half-state where you can pick a path that doesn't fully simulate.

- **16a — pure pitcher stat engine.** ✅ `src/data/pitchers.js` (~140 arms), `PITCH_ATTRIBUTES`
  (12 tools) + era-normalization, `src/sim/pitching.js` (`PITCH_LEAGUE`, `PITCH_STAT_CAL`,
  `pitcherExpectedRates`, `simulatePitcherLine`, `fip`, `cyYoungScore`, `pitcherPrimeMultiplier`),
  `PITCHER_OVERALL_WEIGHTS` + `pitcherOverall` in ratings.js, `evaluateProspect(picks, path)`.
  12 new balance tests. All pure additions — imported into main.js but nothing calls them yet,
  so zero behavior change / zero RNG drift.
- **16b — the player's pitcher career.** ✅ `career.path` / `career.pitcherRole` (+ migration),
  `career.totals.pitching`. `generateSeason()` delegates to `generatePitcherSeason()` for the
  pitcher path — reuses every shared piece (schedule, `resolvePlayoffs`, the whole league sim,
  events, wear) and swaps only the player's line: `simulatePitcherLine` + `simulatePitcherSchedule
  Games` (per-week schedule walk; the player's starts get a real `simulateGameScore` with his run-
  prevention boost; W/L/SV/QS/CG from actual outcomes), pitcher age curves + wear curve + light
  `developPitcherAttributes`. Season card / career-summary totals / season-by-season table render
  a pitcher line. Hitter path untouched (one delegation line) → zero drift. Spec forces the path
  in storage and plays 9 seasons. **Deferred to 16d:** baseball card, analytics tab, career-hub
  stat widgets, Cy Young & the pitcher awards, HOF pitcher formula, leaderboards.
- **16c — league staffs as tracked entities.** `career.teamRotations` (SP1–5, CL, SU1, SU2) +
  spawn/build/ensure/simulate/reconcile mirroring the Phase 15 lineup infra, RNG-isolated.
  Opposing SP-of-the-day into `simulateGameScore` for everyone. `defense` grade re-derived from
  the real staff. Storage measured + retention tuned. `SAVE_SCHEMA_VERSION` → 5.
- **16d — the fork + awards & Cooperstown.** The path-select screen (two big silhouette buttons)
  after the combine-setup Begin; pitcher Showcase (pool + tools + blind/classic + respins);
  Results + share; draft night; `cs.path`/`build.path`/`career.path` wired end to end. Cy Young,
  Reliever of the Year, pitching Triple Crown, ERA/K/W/SV titles, All-Star staff reps, pitcher
  Gold Glove, pitcher Cooperstown formula, no-hitter Key Moment, analytics pitcher view. **This is
  where it goes live for users.**
- **16e — FA at staff scale + multiplayer + polish.** `rollRotationFreeAgency`; multiplayer path
  lock + compare + match code; achievements pass; `validateLeagueState` rotation invariants;
  CONVERSION.md; re-seed drift; merge `phase-16` → `main` → push.

## Risks
- **Storage** — 490+ active entities. Measured at 16c; retention design is the mitigation.
- **RNG drift** — large. Expect to re-seed a batch of seeded specs (as 13b/14/15 did). The
  isolation pattern keeps the league-sim churn off the main stream.
- **Two-sided game sim** — the player-as-pitcher start model is genuinely new engine code, not a
  reskin. Diagnostic-driven calibration before committing the dials.
- Scope: second-largest change after the conversion itself. Phased, tested per boundary, on
  branch `phase-16`.
