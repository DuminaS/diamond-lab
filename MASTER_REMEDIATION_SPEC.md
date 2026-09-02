# Gridiron Lab Master Remediation Specification

Status: implementation contract  
Baseline repository commit: `5bf0388`  
Prepared from: source audit, runtime audit, documentation audit, and intent audit  
Primary implementation file at baseline: `src/main.js`

## 1. How Claude must use this document

This is not an idea list. It is the authoritative remediation specification for the audited build. Read this entire document before editing code.

The implementation rules are:

1. Work in the numbered waves below. Do not start a later wave while an earlier wave has unresolved correctness failures.
2. Make one focused commit per wave or sub-wave. Do not combine unrelated cleanup with simulation changes.
3. Do not push unless the user explicitly authorizes the push.
4. Before changing a behavior, add a committed regression test that demonstrates the old failure whenever the failure can be reproduced deterministically.
5. Tests belong in the repository. Do not use disposable scripts under a Claude scratchpad as the only verification.
6. `npm test` must run the committed automated suite and return success. A build alone is not a test.
7. Use seeded randomness in tests. In Playwright, install a seeded `Math.random` implementation with `page.addInitScript()` before the application loads. Do not add a player-visible test mode.
8. Existing saves are supported data. Any schema change requires an explicit version, a migration, defensive validation, and a migration test.
9. Do not reinterpret a requirement to preserve an old invariant. Several audited failures came from doing exactly that.
10. A UI element is not proof that its underlying simulation is correct. Test state transitions and saved data, not only text presence.
11. When a numerical threshold is introduced, create a deterministic sweep and record its measured distribution before choosing the final value.
12. Update `PROGRESS.md` only after the code, migration, and committed tests pass. Record what was actually verified, not what was intended.
13. Preserve unrelated user changes in a dirty worktree.
14. If the exact line numbers in this document move, locate the named function. Function names and invariants are authoritative; line numbers are baseline navigation aids.

## 2. Product intent that must not be diluted

Gridiron Lab is a player career simulator inside a persistent, historically evolving football league. The league is not decorative background. Every quarterback who appears is intended to be a persistent person who can develop, regress, play, sit, become unavailable, change teams, win a job, lose a job, receive awards, accumulate history, and eventually retire.

The explicit user requirements behind this remediation are:

- Teams play their best available quarterback as QB1. Contracts may affect transactions and roster construction, but cannot indefinitely force a clearly inferior healthy QB to start.
- QB2 and QB3 are persistent players. They may boom, bust, become injured, be suspended, play relief games, be promoted, be traded, be waived, sign elsewhere, and retire.
- Every quarterback who plays at least one real game remains visible in league history and the All-Time table.
- A quarterback is simulated no more than once for a given year. A team has exactly one QB1 at a time.
- Free agency considers actual roster opportunity, competitive window, age, recent performance, health, and real accomplishments.
- Playoff information cannot be lost or contradicted. The visible bracket, actual opponent, awards, rings, history, and saved state must derive from the same postseason state.
- Every team page exposes persistent team quality: overall, five component grades, league ranks, scheme, depth chart, free-agency role, and season history.
- Regular-season ties and overtime follow a year-based rule table. Postseason games never end tied.
- Historical league evolution continues even when the user is suspended, injured for a full season, or otherwise does not play.
- Calculators, debug tools, UI summaries, and the real game use the same production formulas or shared pure functions.

## 3. Non-negotiable data invariants

Add a development-only `validateLeagueState(career, year)` validator and use equivalent assertions in tests. It must report actionable IDs, team IDs, and years.

At every stable checkpoint:

1. Every active franchise for `year` has one QB1 and no more than one QB2 and QB3.
2. A QB ID occupies at most one of: an active roster slot, the free-agent pool, or retired status.
3. A QB marked `free_agent`, `retired`, `suspended`, or season-ending `injured` cannot simultaneously be an eligible QB1.
4. The user player occupies exactly one roster slot while signed and active.
5. No two active QB1 records point to the same team.
6. A `(qbId, year)` pair has no more than one season record.
7. A QB's career totals equal the sum of their stored season records. Awards and rings must not be incremented twice on resume.
8. Team W-L-T totals equal the results of that team's stored regular-season game log.
9. Both sides of a game agree on opponent, week, score, and result.
10. A season's passing/rushing totals equal the sum of that QB's game logs, subject only to explicitly documented rounding reconciliation.
11. Awards are resolved only after games, starts, W-L-T, and statistical totals are final.
12. Every QB with `totals.games > 0` is discoverable by ID and appears in the historical player population.
13. Every franchise starts existing on or before the simulated year; no future franchise can play games or win awards.
14. Saved postseason state resumes idempotently: reopening cannot reroll a completed game, duplicate a ring, or change a known opponent.
15. All persistent collections use IDs as ownership references. Do not depend on the same mutable object being duplicated across multiple serialized arrays.

## 4. Audited baseline defects

These are confirmed defects or intent mismatches in the baseline. They are not optional enhancements.

### Critical correctness and persistence

- `resolveBackupSeasonSnaps()` calls `simulatePlayerSeasonStats()` for the incumbent, then `simulateRivalSeasons()` simulates the same incumbent again later in the same `generateSeason()` call. This can create two season rows, two age increments, and doubled totals.
- `resolveBackupCompetition()` only sets `career.isBackup = false`; it does not remove, demote, or reassign the incumbent. The player and AI incumbent can both remain active starters for the same team.
- `saveActiveCareer()` is called in `playSeasonAndRender()` before the postseason is played. `finalizePlayoffOutcome()` changes rings, awards, reputation, transactions, and UI but does not save.
- Multi-season suspension and injury-leave screens call `nextSeason()` without simulating the rest of the league. League QBs, contracts, standings, awards, expansion, and history freeze while the calendar advances.
- Save data has no schema version, centralized validation, migration chain, or atomic recovery strategy.

### Living-league and historical identity

- The All-Time builder explicitly excludes `career.leagueDepthCharts`, even when a depth QB played real games.
- A retired/replaced depth player can be overwritten and become unreachable. An unsigned depth player who retires can be removed from the free-agent pool and disappear from history.
- AI injuries are represented only as anonymous random missed games. There is no persistent injury type, availability status, recovery duration, or suspension state for AI QBs.
- AI merit promotion examines QB2 only. A superior QB3 cannot directly win QB1.
- An entrenched starter can remain QB1 despite a clearly better healthy rostered QB; the current merit override is a 16-point gap followed by a 28% chance.

### Season, standings, awards, and game-engine coherence

- `simulatePlayerSeasonStats()` calculates award scores from placeholder W-L, then callers overwrite W-L from actual games without recomputing award scores.
- The normal Pro Bowl selection takes the top `perConf` rows without filtering `proBowlEligible`; eligibility is only checked for the optional bonus slot.
- Contract `roleShare` scales passing volume but does not consistently represent games played or starts.
- Regular-season game engines force a winner. There is no `ties` field throughout results, standings, history, trends, or totals.
- `simulateGameScore()` has asymmetric inputs and can conflate an opponent's offense with the grade used as its defensive resistance.
- Per-game QB passing touchdowns are generated independently from the scoreboard's offensive touchdowns.
- Standings sort only by `winPct`; exact ties inherit stable/static team order rather than football tiebreak logic or a documented fallback.
- The schedule builder admits rare game-count shortfalls. A complete schedule must be proven, not described as a graceful shortfall.
- Expansion creation uses an exact-year trigger and occurs after important season work; skipped calendar years can permanently miss initialization.
- Team-history `qbRings` is snapshotted before the postseason result for that year, so the displayed ring total can lag.

### Team information and free agency

- Generic team pages show aggregate grade, scheme, depth, FA role, and history, but not the requested five grades or their league ranks.
- Five supporting grades exist only for the user's current team. Away-team FA offer grades are rolled on the offer rather than read from persistent team state.
- `teamCompetitiveWindow()` is a current aggregate-grade proxy, not a record/playoff trajectory.
- FA's `isOldAccomplished` means age 34 plus current tier. It does not inspect actual rings, MVPs, All-Pros, Pro Bowls, career production, or recent form.

### Security, accessibility, performance, and maintainability

- User-controlled name text reaches raw `innerHTML` at multiple render sites. A runtime payload was confirmed to execute.
- Overlays lack complete dialog semantics, focus trapping, focus restoration, and Escape handling.
- The mock rewarded-ad renderer replaces DOM repeatedly; keyboard focus on Skip is lost.
- Admin tools are exposed in the production UI and duplicate obsolete award/win calculations.
- Google-hosted fonts are not guaranteed offline despite PWA behavior.
- `src/main.js` is roughly 9,000+ lines in one IIFE, with hundreds of functions, many direct `Math.random()` calls, and extensive `innerHTML` rendering.
- `npm test` deliberately exits with failure; Playwright and calibration scripts used during development were temporary and deleted.
- Documentation contains stale status and formula descriptions.

## 5. Target persistent schema

Do not perpetuate three different meanings for starter, bench player, and historical rival. Move toward one canonical QB registry and ID-based roster ownership.

Use a versioned save envelope:

```js
{
  schemaVersion: 2,
  savedAt: 0,
  checkpoint: {
    phase: "regular_season" | "playoffs" | "offseason" | "decision",
    year: 0,
    eventId: null,
    playoffRoundIndex: null
  },
  career: { /* game state */ },
  build: { /* current user attributes */ }
}
```

Canonical league QB data:

```js
career.qbsById = {
  [qbId]: {
    id,
    isUser,
    name,
    draftYear,
    age,
    retireAge,
    talent,
    devSpeed,
    durability,
    volumeLean,
    status: "active" | "free_agent" | "injured" | "suspended" | "retired",
    currentTeamId: null,
    rosterRole: null | "QB1" | "QB2" | "QB3",
    contract: { apy, years, tier },
    availability: {
      reason: null | "injury" | "suspension",
      label: null,
      gamesRemaining: 0,
      seasonsRemaining: 0
    },
    seasons: [],
    totals: {
      games: 0, starts: 0, comp: 0, att: 0, yards: 0,
      td: 0, int: 0, wins: 0, losses: 0, ties: 0,
      proBowls: 0, allPros: 0, mvps: 0, rings: 0
    },
    transactions: []
  }
};

career.teamQbDepth = {
  [teamId]: { QB1: qbId, QB2: qbIdOrNull, QB3: qbIdOrNull }
};

career.freeAgentQbIds = [];
career.retiredQbIds = [];
```

Persistent team data:

```js
career.teamProfiles = {
  [teamId]: {
    teamId,
    oline,
    weapons,
    defense,
    coaching,
    frontOffice,
    overall,
    schemeId,
    lastUpdatedYear
  }
};
```

Season result shape:

```js
{
  id,
  wins,
  losses,
  ties,
  gamesPlayed,
  winPct,       // (wins + 0.5 * ties) / gamesPlayed
  pointsFor,
  pointsAgainst,
  divisionWins,
  divisionLosses,
  divisionTies,
  conferenceWins,
  conferenceLosses,
  conferenceTies
}
```

QB season rows must add `starts` and `ties`. Team-history rows must store stable IDs and values rather than only display names:

```js
{
  year,
  qbId,
  wins,
  losses,
  ties,
  wonDivision,
  wonConference,
  wonChampionship,
  schemeId,
  teamProfileSnapshot
}
```

## 6. Save migration requirements

Implement `migrateSaveEnvelope(raw)` and a sequence of pure migrations. Never mutate unvalidated input in place.

Migration from the baseline unversioned save must:

1. Treat an envelope with no `schemaVersion` as version 1.
2. Copy every `career.leagueRivals` entry into `qbsById`, preserving ID, identity, seasons, totals, contract, awards, ring count, retirement information, and development fields.
3. Copy every QB2/QB3 from `career.leagueDepthCharts`. Do not discard a duplicate ID; detect and resolve duplicate references deterministically.
4. Copy every `career.freeAgentPool` player and preserve the same ID/history.
5. Add the user as a canonical QB entry without losing the richer 12-attribute `build`; the canonical user QB may reference those attributes rather than duplicating them.
6. Construct `teamQbDepth` with this precedence: signed user slot, active non-retired starter, existing QB2, existing QB3. Report and repair duplicate active starters.
7. Mark pool entries `free_agent`, unreachable viable players `free_agent`, explicitly retired players `retired`, and rostered players `active` unless unavailable.
8. Add `starts` and `ties` defaults to season/totals rows.
9. Initialize `teamProfiles` from existing current-team grades and deterministic derivation from `leagueStrength` for other teams. Migration must not use fresh `Math.random()`; the same save must migrate identically every time.
10. Preserve old fields for one compatibility release only if required by incremental adapters. Mark them deprecated and ensure there is one writer. Do not maintain two independent mutable sources of truth.
11. Validate after migration. If repair is necessary, record a non-player-facing migration report for diagnostics.
12. Save the migrated version only after validation succeeds. Keep the original serialized value under a one-time backup key until the migrated save is successfully loaded once.

Required tests: pristine v1 save, corrupted optional fields, duplicate team starter, depth player also in pool, pre-feature save with no depth charts, expansion-era save, and completed-playoff save.

## 7. Execution waves

### Wave 0 — Durable test and diagnostic foundation

Files expected: `package.json`, Playwright config, `tests/`, and only minimal test seams in production code if unavoidable.

Tasks:

1. Replace the failing placeholder `npm test` with the committed suite.
2. Add `test:smoke`, `test:regression`, and `test:sim` scripts if separation improves runtime.
3. Add shared Playwright helpers for starting a career, reaching a season, finalizing a bracket, seeding randomness, reading/writing saves, and collecting page errors.
4. Commit regression cases for: XSS name payload, playoff resume/ring duplication, backup incumbent double simulation, two active starters on the user's team, a played bench QB missing from All-Time, full-year absence freezing the league, Pro Bowl ineligible selection, and schedule completeness.
5. Add a test-only call path for `validateLeagueState`; it must not expose admin controls to ordinary production users.
6. Record the baseline failures. Do not make assertions weaker merely to make the baseline green.

Exit criteria:

- `npm test` invokes real tests.
- Tests are deterministic across at least three consecutive runs.
- Every critical defect above has a failing regression or a written explanation of why it cannot be isolated until a named later wave.

### Wave 1 — Security and save integrity

Primary functions: `saveActiveCareer`, `loadActiveCareer`, `resumeActiveCareer`, `playSeasonAndRender`, `confirmPlayoffRound`, `simulateNextPlayoffTreeRound`, `tryFinalizeLeaguePlayoffBracket`, `finalizePlayoffOutcome`, retirement save/clear flow, and all render sites containing the user name.

Tasks:

1. Introduce the versioned envelope and migration chain.
2. Add explicit checkpoint phases and idempotency markers for postseason awards/rings.
3. Save after each completed playoff round, after full bracket finalization, immediately after `finalizePlayoffOutcome`, and after material decisions such as signing, trade, waiver claim, suspension, or retirement confirmation.
4. Resume from the saved checkpoint. A completed round must render as completed, not reroll.
5. Guard ring/award application with a stable `season.postseasonFinalized` flag.
6. Replace raw interpolation of user-controlled strings with `textContent`, DOM construction, or `svgEscape` consistently. Audit draft night, season cards, header ticker, retirement/HOF, transactions, achievements, and modal renderers.
7. Add a small `escapeHtml`/safe element helper only if it reduces inconsistency; do not create two differently named escape functions with divergent behavior.

Exit criteria:

- The XSS payload renders literally and never executes.
- Reload after any playoff round preserves exact opponents/scores.
- Reload after winning a championship preserves one ring and one award, never zero and never two.
- Old saves migrate and remain playable.

### Wave 2A — Canonical QB identity and roster migration

Primary functions: `generateBenchPlayer`, `generateDepthChart`, `rollDraftIncumbent`, `spawnFreshRival`, `generateLeagueRivals`, `spawnNewFranchiseRivals`, `enterFreeAgentPool`, `reassignRivalsForTeamChange`, `tradeBenchPlayer`, `resolveFreeAgentPool`, `findRivalById`, `findDepthChartPlayerById`, `rivalForTeam`, profile builders, and All-Time population builders.

Tasks:

1. Introduce `qbsById`, `teamQbDepth`, `freeAgentQbIds`, and `retiredQbIds` through selectors and transaction helpers.
2. Add these sole ownership-mutating helpers:
   - `registerQuarterback(qb)`
   - `assignQuarterbackToRoster(qbId, teamId, role)`
   - `moveQuarterbackToFreeAgency(qbId, reason)`
   - `retireQuarterback(qbId, reason)`
   - `swapDepthRoles(teamId, roleA, roleB)`
   - `getTeamQuarterbacks(teamId)`
   - `getQuarterbackById(qbId)`
3. A helper must remove the QB from their prior location before assigning the new location. Callers must not directly patch three collections.
4. Replace `retired` as a proxy for “not currently a starter.” Free agency is not retirement.
5. Never overwrite a QB object when filling a depth slot. Move the departing QB to free agency or retirement first.
6. Change profile/history lookup to the canonical registry so retired and former bench players remain clickable.
7. Build All-Time from the registry filtered only by `totals.games > 0`. Do not filter by past role.

Exit criteria:

- Every played bench QB remains searchable and appears in All-Time after trade, waiver, promotion, and retirement.
- Validator finds no duplicate ownership across a 25-season seeded career.
- No existing player history is lost during save migration.

### Wave 2B — One seasonal simulation per QB and correct starter selection

Primary functions: `generateSeason`, `resolveBackupSeasonSnaps`, `resolveBackupCompetition`, `simulatePlayerSeasonStats`, `simulateRivalSeasons`, `simulateDepthChartSeasons`, `evaluateSuccession`, schedule attribution functions, and award resolution.

Required design:

1. Eliminate the direct incumbent season simulation from `resolveBackupSeasonSnaps`. That function may plan usage; it must not append a season or mutate age/totals.
2. Build one `seasonQbUsage` plan before QB statistics are finalized. Each entry identifies QB ID, team, starts/games, and exact weeks.
3. Run one simulation/aggregation pass per QB ID from that plan.
4. Add an idempotency assertion before appending a season row: an existing `(qbId, year)` is an error during development and a safe no-op with diagnostic reporting on resumed production state.
5. Reconcile real W-L-T first, then compute award scores. Never preserve award scores based on placeholder records.
6. Age and develop each QB exactly once at a documented end-of-season point, whether they played or sat.

Starter selection must consider QB1, QB2, and QB3:

- Ineligible/unavailable QBs cannot start.
- Compute current effective QB value from current talent/attributes, age, health penalty, scheme fit if mechanically real, and recent form if used.
- Keep incumbent only when within a small hysteresis margin of the best challenger. Recommended initial margin: 2 points; calibrate before finalizing.
- If a challenger is at least 3 effective points better, reorder the depth chart deterministically before the season. Do not require an additional random promotion roll.
- Contracts influence whether the team trades/cuts/carries an expensive player, not who is the best healthy starter on Sunday.
- The user follows the same roster truth. When the user wins QB1, the incumbent moves to QB2, another valid slot, free agency, or a trade destination. The incumbent cannot remain a parallel AI starter.
- A mid-season availability change may allocate specific weeks to the next eligible depth QB without changing permanent QB1 unless the season/offseason evaluation decides it.

Exit criteria:

- No QB has two season rows for one year.
- The user's team never has two award-eligible starters.
- A healthy QB3 who is clearly the best QB becomes QB1.
- Exact-week schedule cards identify the QB who actually played.
- Awards use final real records and eligibility.

### Wave 3 — Living league during user absence; AI availability

Primary functions: `advanceCareer`, `renderSuspensionYear`, `renderInjuryLeaveYear`, `nextSeason`, `simulatePlayerSeasonStats`, league news, contract ticking, expansion, schedules, standings, awards, postseason, and team history.

Tasks:

1. Add `simulateLeagueYearWithoutUser({ reason })`. It must run expansion initialization, team schedules, AI QB usage/stats, standings, awards, postseason champion/ring attribution, contracts, development, mobility, team drift, history, and year-end validation.
2. Store a user season row with zero or partial games and a clear status reason where appropriate. Earnings and contract years must follow the actual contract rules chosen for injury/suspension.
3. `renderSuspensionYear` and `renderInjuryLeaveYear` must call the league-year simulation exactly once before advancing.
4. Replace exact expansion checks such as `team.start === year` with an idempotent catch-up condition: if `team.start <= year` and the active franchise lacks initialized state, initialize it once.
5. Add persistent AI availability rolls with explicit reason/type, games or seasons missed, recovery, and transaction/news history.
6. Suspensions must be distinct from injuries. Do not label all random absences “injury/benching/QB change.”
7. QB2 receives exact relief weeks; QB3 receives them if QB2 is also unavailable.

Exit criteria:

- In a two-year user suspension, every other active QB ages two years and the league produces two champions, two award sets, and two team-history rows.
- Expansion franchises initialize even if the calendar advances across their start year through an absence event.
- AI injury/suspension status is visible on the player profile and transaction/history surfaces.

### Wave 4 — Regular-season ties and standings correctness

Primary functions: `simulateGameScore`, `simpleGameWinner` replacement, `approxGameScore`, `buildScheduleResults`, `simulateLeagueStandings`, standings sorting/seeding, schedule/modal renderers, team history, trends, totals, HOF calculations if records affect them, and export/share text.

Tasks:

1. Add a single `overtimeRulesForYear(year, postseason)` rule table. Verify historical boundaries against an authoritative source before coding. At minimum distinguish no regular-season overtime, sudden-death eras, modified-sudden-death eras, period-length changes, and postseason no-tie behavior.
2. Separate regulation scoring from tie resolution: `simulateRegulationScore(...)` then `resolveOvertime(...)`.
3. A regular-season game may return `{ result: "W" | "L" | "T", tied: boolean }`. Postseason resolution must continue until a winner.
4. Replace every `losses = games - wins` assumption.
5. Add `ties` to team/QB totals, season rows, schedules, standings, history, trends, team pages, summaries, and save migration.
6. Compute standings percentage as `(wins + 0.5 * ties) / gamesPlayed`.
7. Implement deterministic standings tiebreak ordering. Minimum fallback chain: win percentage, head-to-head when available, division record for division ranking, conference record for conference seeding, point differential, then a stable team ID fallback. Clearly document any simplification from historical NFL procedures.
8. Calibrate league tie rates by era with seeded multi-season sweeps. Do not choose overtime unresolved probabilities by intuition.

Exit criteria:

- Pre-overtime-era regular seasons can end tied.
- Modern regular seasons produce plausible but uncommon ties.
- Postseason games never end tied.
- Both game participants, standings, history, and QB records agree on every tie.
- Seeding remains deterministic on reload.

### Wave 5 — Persistent five-grade team model and complete Team page

Primary functions: career initialization, expansion initialization, team drift/news, `buildTeamTabHTML`, `buildTeamPageHTML`, FA offer construction/signing, `regularSeasonOffenseGrade`, `opponentOffenseGrade`, `simulateGameScore`, and team-history snapshots.

Tasks:

1. Initialize `teamProfiles` for every active franchise. Expansion teams receive a profile when they join.
2. Stop rerolling away-team supporting grades per FA offer. Offers must reference the destination's persistent profile.
3. Make the aggregate `overall` a documented derived value from component grades or explicitly rename it if it represents something else. Do not show a “breakdown of overall” whose components do not calculate that overall.
4. Recommended initial non-QB team-overall weights for calibration, not automatic final values: O-line 20%, weapons 20%, defense 30%, coaching 20%, front office 10%. Keep QB value separate so `opponentOffenseGrade` does not double-count the QB.
5. Team drift must update components for legible reasons: roster/offseason variance, coaching changes, front-office events, development, and controlled mean reversion. Persist changes.
6. The generic Team page must show:
   - Overall number, letter grade, and league rank
   - All five component numbers, letter grades, league ranks, and mechanical explanations
   - Current scheme and its actual effects
   - Clickable QB1/QB2/QB3 with overall, age, availability, contract, and role
   - FA-only “If you sign here” projected role based on the actual depth-selection function
   - Past seasons with W-L-T, QB ID/name, division title, conference title, championship, scheme, and a compact team-profile snapshot
7. The user's Team tab and generic Team page must use the same data source and grade-card renderer.
8. Patch the current season-history row after postseason finalization so championship and ring values include that season.

Exit criteria:

- Opening any team from standings or FA shows the same persistent grades before and after navigation/reload.
- Accepting an FA offer gives the user exactly the grades that were previewed.
- Unit ranks equal a direct sort of active-team profiles.
- Team overall calculations are reproducible from displayed components.

### Wave 6 — Free-agency decision model

Primary functions: `teamNeedRank`, `teamCompetitiveWindow`, `buildFreeAgentOffers`, `renderFAOffers`, signing/reassignment helpers, and team-page FA projection.

Add pure profiles:

```js
buildPlayerMarketProfile(qbId, year)
buildTeamQuarterbackNeed(teamId, year)
scoreFreeAgentFit(playerProfile, teamProfile, needProfile)
```

Player market profile must include:

- Age and effective current value
- Last two seasons with playing-time weighting
- Career starts and availability
- MVP, All-Pro, Pro Bowl, rings, playoff success, and reputation
- Injury/suspension risk or current unavailability
- Expected market tier and contract range

Team need/window must include:

- Current QB1/QB2/QB3 effective values, ages, availability, and contracts
- Last three team seasons using weighted recency
- Recent playoffs, division titles, conference titles, and championships
- Persistent five-grade profile and scheme
- Window classification: rebuild, retool, contender, win-now

Role rules:

- Project role by inserting the player into a copy of the team's depth chart and running the same starter-selection function used by the season simulation.
- Never calculate FA role with a separate estimate.
- Rebuilders without a credible QB may offer a young/mediocre player QB1 or open competition.
- Win-now teams should pursue accomplished veterans only when the player is a real upgrade or necessary availability insurance.
- “Accomplished” must inspect actual achievements, not age plus current tier.
- Money, duration, guarantees if modeled, role, scheme fit, and competitive window should be explainable on the offer card.

Exit criteria:

- Seeded scenarios cover young mediocre QB/rebuilder, elite old veteran/contender, declining famous veteran, suspension comeback, and stacked team with weak QB1.
- Offer role matches the Team-page projection and actual post-signing depth chart.
- Destination grades never change merely because the user opens or accepts the offer.

### Wave 7 — Unified game, stat, and award calculations

Primary functions: `simulateGameScore`, `simulateRegularSeasonGames`, playoff game construction, `generateGameBoxScore`, `applyStatLineToGames`, `reconcileWinLossFromGames`, `evaluateSeasonAwards`, `resolveSeasonMVP`, `resolveSeasonAllProAndProBowl`, and Admin Calc.

Tasks:

1. Change the game API to explicit sides, for example:

```js
simulateGame({
  year,
  postseason,
  home: { offense, defense, qbId },
  away: { offense, defense, qbId }
})
```

2. Each team's offense scores against the opposing defense. Do not feed the same undifferentiated grade into offense and defense roles.
3. Generate the scoreboard and QB stat line from a shared game result. Passing plus rushing TDs cannot exceed the team's offensive TD count unless the model explicitly records non-QB offensive TDs. Document the allocation.
4. Aggregate season totals from game logs. Avoid generating independent season totals and later distributing them arbitrarily back across games.
5. Compute award metrics only after final W-L-T and stats.
6. Filter the standard Pro Bowl pool by `proBowlEligible` before taking slots. Define an explicit fallback only if a conference lacks enough eligible QBs.
7. Decide whether relief/bench QBs are award eligible by the same playing-time thresholds. Their roster label alone must not exclude a qualifying played season.
8. Admin Calc must call production pure functions. Remove obsolete probabilistic awards and duplicated win math.
9. Hide Admin Calc behind a development flag or remove it from production navigation.

Calibration requirements:

- Score distributions by era
- Upset rates by team/QB differential
- Tie rates by era
- Passing volume, TD, INT, rating, and 5,000-yard frequency
- Award counts and eligibility
- Team win distributions and dynasty frequency

Exit criteria:

- Box-score totals, season totals, scoreboard TDs, W-L-T, and award inputs reconcile.
- Exactly the intended number of MVP/All-Pro/Pro Bowl selections occurs.
- Admin results match production for identical inputs.

### Wave 8 — UI accessibility and runtime performance

Primary surfaces: rival profile, team profile, game modal, achievements/trophy overlays, rewarded-ad overlay, navigation, and external fonts.

Tasks:

1. Give overlays `role="dialog"`, `aria-modal="true"`, accessible labels, initial focus, Tab/Shift+Tab trapping, Escape close, and focus restoration to the opener.
2. Prevent background interaction while a modal is active. Prefer `inert` where supported with a safe fallback.
3. Update ad countdown/progress text in place. Do not replace the focused button subtree on every timer tick.
4. Respect reduced motion for bracket, draft, modal, and ad animations.
5. Self-host required fonts or provide a deliberately tested offline system-font stack.
6. Preserve mobile layout at 320, 360, 390, and tablet widths without horizontal page overflow. Wide tables may scroll within their own container.

Exit criteria:

- Complete modal use is possible with keyboard only.
- Automated accessibility smoke tests find no missing dialog name or focus escape.
- Skip-button focus survives countdown updates.
- App works offline after first load without external font requests being required for legibility.

### Wave 9 — Incremental modularization and platform verification

Do this after behavioral tests protect the simulation. Do not perform a big-bang rewrite.

Suggested extraction order:

1. `src/data/` — teams, eras, schemes, awards, events
2. `src/utils/` — clamp/random/format/escape helpers
3. `src/persistence/` — envelope, migrations, validators
4. `src/sim/` — overtime, game engine, schedule, standings, awards
5. `src/league/` — QB registry, rosters, transactions, development, free agency
6. `src/career/` — user career state machine and events
7. `src/ui/` — renderers, modal controller, tab controller
8. `src/main.js` — bootstrap/composition only

Rules:

- Extract one coherent module per commit.
- Keep behavior unchanged during extraction commits.
- Add imports/exports around pure functions first.
- No circular dependencies; pass state explicitly or use a narrowly defined store interface.
- DOM renderers may consume view models, but simulation modules must not query or mutate the DOM.
- Run the complete regression suite after each extraction.

Platform completion:

- Build and run the Capacitor Android project on an emulator or physical device.
- Test resume after background/process death, offline startup, safe areas, back button, audio lifecycle, and rewarded-ad mock flow.
- iOS and a real ad SDK remain deliberately deferred until explicitly authorized and platform prerequisites exist.

## 8. Required committed regression scenarios

At minimum, keep these named scenarios in the permanent test suite:

1. `save-migrates-unversioned-career`
2. `name-html-is-rendered-not-executed`
3. `playoff-round-resume-is-idempotent`
4. `championship-finalization-saves-one-ring`
5. `backup-incumbent-simulates-once-per-year`
6. `winning-user-job-demotes-or-moves-incumbent`
7. `one-active-qb1-per-team`
8. `best-of-qb1-qb2-qb3-starts`
9. `played-bench-qb-survives-retirement-and-appears-all-time`
10. `free-agent-qb-has-no-active-roster-slot`
11. `two-year-user-absence-advances-entire-league`
12. `expansion-catchup-initializes-missed-start-year`
13. `ai-injury-allocates-exact-relief-weeks`
14. `award-score-uses-reconciled-record`
15. `pro-bowl-standard-slots-respect-eligibility`
16. `all-games-have-two-matching-team-records`
17. `every-active-team-completes-era-game-count`
18. `regular-season-era-can-produce-tie`
19. `postseason-never-produces-tie`
20. `standings-and-history-preserve-w-l-t`
21. `team-page-five-grades-match-persistent-state`
22. `fa-preview-grades-equal-signed-team-grades`
23. `fa-projected-role-equals-actual-depth-role`
24. `scoreboard-and-qb-touchdowns-reconcile`
25. `admin-calculator-calls-production-math`
26. `dialog-traps-and-restores-focus`
27. `ad-countdown-does-not-drop-button-focus`
28. `long-seeded-career-passes-league-invariants`

The long-career scenario should simulate multiple seeds across at least 25 seasons and fail with the random seed, year, QB ID, team ID, and violated invariant printed.

## 9. Definition of done for the complete remediation

This program is not complete because a build passes or a section renders. It is complete only when:

- All critical and high findings in Section 4 are fixed or explicitly rejected by the user.
- All invariants in Section 3 pass across deterministic long-career sweeps.
- Every played QB remains in permanent history.
- Each team has exactly one QB1, and the best available QB selection rule examines all rostered QBs.
- User absence does not freeze the league.
- Postseason progress and rewards survive reload without reroll or duplication.
- W-L-T is coherent across schedules, standings, player records, histories, playoffs, and saves.
- Every team's five grades are persistent, mechanically used, ranked, and visible.
- FA reasoning uses real player résumé/recent form and real persistent team state.
- Game scores, box scores, season totals, and awards share authoritative calculations.
- User-provided text cannot execute HTML or script.
- Core modal workflows are keyboard accessible.
- `npm test` and `npm run build` both succeed from a clean checkout.
- No required regression exists only in a temporary directory.
- `PROGRESS.md`, `CLAUDE.md`, and the current code agree about shipped behavior.

## 10. Required handoff format after each wave

Claude must report:

1. Commit hash and files changed.
2. Exact requirements completed from this document.
3. Data schema or migration changes.
4. Tests added, including their committed paths.
5. Commands run and results.
6. Calibration results and chosen thresholds, when applicable.
7. Known limitations or deferred requirements; do not hide these inside prose.
8. Whether the work has been pushed. Default is not pushed.
9. The next eligible wave, without starting it unless the user asks.

## 11. Explicitly prohibited shortcuts

- Do not mark “every player who played” complete while excluding played bench QBs.
- Do not mark “best QB starts” complete with a chance-based QB2-only override.
- Do not simulate an incumbent in both a backup helper and the league loop.
- Do not represent free agency by setting `retired = true` without a distinct status.
- Do not overwrite a depth player and discard their history.
- Do not recompute or reroll persistent team grades when opening an FA screen.
- Do not calculate awards before final records exist.
- Do not gate Continue in the UI without saving the state the gate protects.
- Do not add a T label while keeping binary win/loss assumptions underneath.
- Do not make UI-presence assertions the only test for simulation behavior.
- Do not fix flaky tests by increasing retries until random success; seed the scenario or fix the harness.
- Do not claim a temporary scratchpad test is part of the regression suite.
- Do not combine modularization with behavior changes in the same commit.
- Do not push automatically.

## 12. Product decisions that genuinely require user confirmation

These are the only major questions that should stop implementation; engineering details above should not be repeatedly re-litigated:

1. Should contract guarantees/cap penalties become a visible system, or should contracts affect transaction likelihood without a full cap model?
2. Should an AI suspension use fictional narrative incidents like the user's event system, or neutral labels such as “league conduct suspension”?
3. Should historical overtime rules be modeled approximately through calibrated probabilities or through a possession-level overtime simulation?
4. Should team history store every five-grade snapshot indefinitely, accepting larger localStorage saves, or retain a compact annual summary?
5. After persistent team grades ship, should the visible aggregate overall represent non-QB team quality only, or total team quality including QB? The simulation must avoid counting QB twice either way.

Everything else in this specification is sufficiently defined to begin implementation without further scope reduction.

## 13. Initial prompt to paste into Claude

Paste the block below into a new Claude coding session from the repository root:

```text
Read MASTER_REMEDIATION_SPEC.md completely before taking any action. Then read CLAUDE.md,
package.json, the current git status/log, and the specific src/main.js functions named in Wave 0.

Treat MASTER_REMEDIATION_SPEC.md as the authoritative implementation contract. Do not narrow,
reinterpret, or silently defer its requirements. Historical notes in PROGRESS.md are context, not
authority when they conflict with the master specification or current code.

Start with Wave 0 only: Durable test and diagnostic foundation. Do not implement Wave 1 or any
simulation fix yet. First report:

1. The current HEAD and whether the worktree is clean.
2. The exact committed files you plan to add/change for Wave 0.
3. Which critical defects will initially be represented by failing regression tests.
4. How Playwright randomness will be seeded without adding a player-visible test mode.
5. How `npm test` will be changed to run real committed tests.
6. Any Wave 0 requirement you believe is blocked, with concrete evidence. Difficulty or scope is
   not a blocker.

After that report, implement Wave 0. Keep every test in the repository under tests/. Do not rely on
Claude scratchpad files. Do not weaken a failing assertion to accommodate the current bug. Run the
suite at least three consecutive times to prove determinism, run npm run build, run git diff --check,
and report results using the handoff format in Section 10.

Make a local focused commit only after Wave 0's exit criteria pass. Do not push without my explicit
authorization. Stop after the Wave 0 handoff and wait for approval before beginning Wave 1.
```

For every later wave, the follow-up instruction should be only:

```text
Proceed with the next eligible wave in MASTER_REMEDIATION_SPEC.md. Re-read that entire wave, its
referenced invariants, migration requirements, permanent regression scenarios, definition of done,
and prohibited shortcuts before editing. Complete only that wave, commit locally, do not push, and
return the Section 10 handoff.
```
