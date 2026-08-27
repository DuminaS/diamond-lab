# Gridiron Lab — Development Log

Single-file HTML/CSS/JS QB-career simulator. Dev copy: `/tmp/gridiron/index.html` in the Cowork session workspace (not persisted between sessions — this doc is the durable record). Published artifact: https://claude.ai/code/artifact/c9dc631e-5094-47ef-95c8-908641aadc67 ("Gridiron Lab", 🏈).

## Testing methodology (established pattern, reuse every round)
- jsdom in `/tmp/gtest`, debug hooks (`window.__debug`) injected only into throwaway copies (`index.debugN.html`), never the real file. Latest debug build: `index.debug24.html` (Round 4, item 3).
- `grep -c "__debug" index.html` must return 0 on the real file before every publish.
- `node --check` on the extracted `<script>` block before every publish.
- Playwright with `/opt/pw-browsers/chromium-1194/chrome-linux/chrome` for visual screenshot verification.
- Full regression suite re-run against a fresh debug build before every publish: test4–9 (v12), test8_decadefit, test9_attrtab, test_ot_fix, test_sb_shield, test_teamquality, test_gradefor, test_retrospective, test_legendary_retro, test_awards, test_season_progress, test_lastbuild — plus each round's own new targeted tests (Round 2: `test_round_batch.js`; Round 3: `test_round3.js`; Round 4: `test_round4_devarc.js`).
- When re-running the pre-existing suite against a new debug build, diff its output against the SAME test run on the previous debug build (not just eyeball it) — RNG-stream drift from any code change that alters how many `Math.random()` calls happen upstream (e.g. Round 3's scheduling-rotation shuffle) will shift every downstream random draw for the rest of that process, producing harmless numeric noise in illustrative output. Confirm no actual PASS/FAIL or true/false assertion flipped, not just that the raw numbers changed. A fixture that hardcodes an old award string (see Round 3 note on `test_awards`) or an old function name/API (see Round 4 note on `test_teamquality`/`test_round_batch`) can also go stale after an intentional rename/redesign — re-verify by patching the fixture to the new API/expectation, not by treating the diff as ground truth.
- When publishing, `action:"publish"` may refuse with "hadn't viewed the live version" or "identical content already refused" — this is a safety check because context compaction can lose track of what was last read. Fix: `action:"read"` the artifact URL fresh (re-reading an old tool result doesn't count), confirm the diff against your local file is a pure superset (no foreign edits to merge), then republish.
- Diagnostic-driven calibration (Round 2 origin, reused every round since): before committing a new numeric dial, build throwaway diagnostic scripts in `/tmp/gtest` (not part of the permanent suite) that sweep flat/synthetic builds or matchups across a range and print resulting stats/win-rates/event-frequencies, to empirically tune the value instead of guessing.
- A debug build's `window.__debug` internals list can go stale when a helper is renamed/removed — verify with `node --check` on the extracted script AND actually call `getInternals()` in a quick smoke test before trusting a big regression run against a freshly-built debug copy (Round 4 caught two: a nonexistent `getCs`/`setCs` shorthand-property reference that should have been the inline accessor `getCs: ()=>cs, setCs: (v)=>{ cs = v; }` closing over the real `cs` combine-state variable, and the removed `playoffTeamEdge`/`regularSeasonTeamEdge` names — both would silently break every downstream test in the same process if not caught first).

## Status as of 2026-08-27 — five rounds shipped

### Round 5 — opponent-QB system, team parity/decline, LeagueNewsFeed, and 3 bug fixes
Triggered by a large combined feedback dump: the user's own notes (difficulty still too easy —
16-0 seasons with 70-overall teams, multiple Super Bowls in a row; no league parity — team grades
"bounce" year to year with no legible reason; a request to see the opposing QB's own overall, not
just their team grade) plus four playtester reports (a coach fired the same offseason he won the
Super Bowl; 4 rings in 11 seasons still only graded Hall of Famer, not First-Ballot; free-agency/
release offers coming from 20-40-overall teams despite being an 85+/Super-Bowl-caliber player; a
sense that win probability was "just team grade," no real grind even at 95+ overall). Investigated
each claim against the actual code (via a research subagent) before touching anything — see the
per-item root causes below, all confirmed as real, verifiable gaps, not just vibes.

1. **Coach-fired-after-a-championship bug — fixed.** `lifeEventCheck()`'s `ORG_EVENTS` roll had zero
   check for whether the team just won it all; the existing `_cutShieldSeasons` protection only
   ever covered the *waiver* cut-risk formula, never this org-event roll. New `orgEventsFor()`
   excludes just the `coachfired` entry (not org news generally — a new GM, ownership sale etc. can
   still happen for unrelated reasons) whenever `career.seasonLog`'s last entry has
   `playoffs.wonRing`. Both `ORG_EVENTS` roll sites (`lifeEventCheck`, `secondaryLifeEventCheck`) now
   call it instead of rolling the raw array.

2. **First-Ballot Hall of Famer ring gate — fixed.** Not a scoring bug (4 rings alone already clears
   the 150-point bar via `accoladeScore = rings*40 + ...`) — the actual blocker is a hard,
   independent `minProBowls:3` gate in `hofVerdict()`'s `TIERS` array. Since Pro Bowl slots are
   winner-take-all league-wide (`resolveSeasonAllProAndProBowl`), a ring-winning QB can genuinely
   get out-voted for Pro Bowl nods in the very seasons he wins a title, producing exactly the
   reported case. Added a second, independent qualifying route: `minRingsRoute:3` on the
   First-Ballot tier only — `t.rings>=3` now also clears the accolade gate, alongside the existing
   `proBowls>=3` path. Every other tier's Pro-Bowl gating is unchanged.

3. **Free agency / waiver offers ignoring the player's own quality — fixed, and this is the one
   underlying the "why do 85-overall players only get 20-40-grade offers" complaint.**
   `teamNeedRank(teamId)` used to be `need = 100 - teamStrength` — purely inverse to a team's OWN
   roster strength, so an elite player (rank 4) could only ever match with `needRank 3-4` teams,
   which by that formula's construction were always the *weakest* teams; a genuine contender's high
   `teamStrength` always registered as "low need" regardless of who was actually playing QB there.
   Now keyed off `rivalForTeam(teamId)`'s QB talent instead (see item 4) — a stacked team stuck with
   a mediocre incumbent now shows real need and can make a legitimate elite-tier offer, the same way
   a real contender goes shopping for a QB upgrade. `renderWaivedEvent`'s post-cut replacement offer
   was hard-coded to a flat 15-60 team-grade range regardless of who got cut; now scales both ends
   with the player's own `effOverall` (up to a 92-grade ceiling for a genuinely elite released
   player — still a "prove-it" deal, never top dollar, but no longer capped at replacement-level
   teams for a proven star).

4. **Opposing QB system — new, and this turned out to already be 90% built.** `career.leagueRivals`
   already generated one persistent starting QB per opposing team at career start (name, `talent`,
   age/retirement curve, full simulated season-by-season stats for league awards) — it just never
   fed into the actual game-sim/win-calc, only into league-wide MVP/Pro-Bowl/All-Pro comparisons.
   New `rivalForTeam(teamId)` (lookup), `rivalEffTalent(rival)` (age-adjusts `talent` via the same
   `primeMultiplier` rivals' own stats already use — an aging rival starter shouldn't blend in at
   his career-peak number), and `opponentOffenseGrade(teamId, qbInfluence)` (mirrors
   `blendOffenseWithTeam`, opponent side) — wired into all 4 win-calc sites that used to read a flat
   `career.leagueStrength[opp.id]`: `simulateRegularSeasonGames`, `resolveConferenceBracket`'s
   `playMatch`, `stepConferenceBracket`'s `simulateMatch`, `buildSuperBowlRound`. The OT tiebreak
   (`round._defOverall`) now reads the new `_defOffense` (blended) field instead of raw team
   strength, so overtime stays consistent with what the actual game was simulated against.
   Opponent's name+overall now surfaces in the Schedule tab (per game) and both playoff-round-box
   templates (`sb-oppgrade`/`pr-oppgrade`), right next to the existing "Their team overall" line —
   `_defOverall` (raw team grade, unchanged label) and the new `_oppQbName`/`_oppQbOverall` are kept
   as separate fields so "team grade" and "their QB's grade" read as two distinct numbers, per the
   user's ask.

5. **Team-strength permanence + decline + LeagueNewsFeed — new.** The old per-season update was a
   flat, unbounded-direction random walk (`randInt(-8,8)` for every other team, `randInt(-4,4)` +
   a skill nudge for the player's own team) with no reversion and no narrative link — this is why
   team grades "bounced" with no explainable reason. Replaced with, per season, in order:
   - **Legible, rival-linked nudges first**: a rival's own award-winning season lifts their team
     (`+1.5` per award), a rough statistical season (rating well under that decade's average) drags
     it down (`-2`); a rival's retirement/succession (in `simulateRivalSeasons`) nudges the team
     immediately, sized to how much the new rookie's talent actually differs from the departing
     vet's age-adjusted talent — a real, explainable "we just lost our franchise guy to a rookie"
     transition instead of unexplained noise.
   - **`rollLeagueNews(year)` / new `LEAGUE_NEWS_EVENTS`** (10 entries — draft busts, coaching
     changes, blockbuster trades, cap casualties, etc., percentile-weighted so the two big-swing
     entries are both rarer and wider than the common ±1-3 ones) fires independently for each OTHER
     team at a flat 10%/season chance, logged to new `career.leagueNewsLog` and rendered via new
     `buildLeagueNewsFeedHTML()` (reuses the existing `.feed-wrap`/`.feed-line` transaction-log
     styling) in a new "Around the League" section at the bottom of the League tab. This is the
     `LeagueNewsFeed` component the user specifically asked for — **built in vanilla JS/DOM, not as
     a `.jsx` React component**, since the codebase has no React anywhere and introducing it for one
     component would fragment the architecture rather than extend it; the feature (randomized,
     percentile-based, named events mutating specific AI team grades with a visible reason) is
     delivered as asked, just in the project's existing UI paradigm.
   - **`CONTENDER_DECLINE_THRESHOLD = 76` / `CONTENDER_DECLINE_RATE`**: every team above 76 takes a
     pull back toward it, scaled by how far above. Diagnostically tuned (pure-math trajectory sweep,
     no game code needed) — **0.05 was tried first and was far too weak**: against even a modest
     positive skill nudge, ANY team above dead-average rocketed to the 97 hard cap within 2-3
     seasons and froze there permanently, which is exactly the "superteam that never has to work for
     it" complaint this exists to fix. At **0.22**: a zero-skill-nudge average team genuinely bleeds
     out over a decade (90→~79 over 10 seasons), a "merely good" QB's team settles into real
     season-to-season texture in the low-to-mid 80s instead of pinning at the cap, a truly elite
     QB's team plateaus around 90-93 over roughly 7-8 seasons (great, but earned, and still has real
     give from season to season — not an instant, permanent 97), and a bad team with an elite QB
     takes a believable ~decade to build into a real contender. Both random-walk noise terms were
     also cut from ±8/±4 down to ±2, since most of a team's movement should now come from an
     explainable cause above, not dice. The player's own team faces identical decline pressure; the
     one counteracting force is the same skill-linked nudge it always had (this is the "stays great
     because its QB is legitimately elite" case the user asked for).

   **Diagnostic verification** (pure win-probability sweeps, `simulateGameScore` called directly via
   a debug-hook — no full career needed): confirms the literal reported case ("70-overall QB, 70-
   grade team, going 16-0") is now genuinely rare — 4,000 simulated 16-game seasons against
   realistic random opponents (team strength ~20-96, rival talent = team±15) average 10.35/16 wins
   with a **0.13% chance of a perfect season** (5-in-4,000 trials), down from whatever produced the
   reported complaint (which necessarily predates every fix in this round). A genuinely elite build
   (effOverall 92, team 90) still goes undefeated in ~10% of simulated seasons — a real, earned
   rarity for an all-time-great team, not a routine outcome, and averages only 13.8-13.9 wins/16
   (86%), not a stat-padded 16-0 by default. Note the opponent-QB blend alone barely moved the
   *average*-case numbers versus the old flat-team-strength system (adding symmetric noise around
   team strength doesn't shift a win-rate average against a wide random distribution of opponents,
   only adds game-to-game texture) — **the decline-rate retune is what actually did the heavy
   lifting** on the core difficulty complaint; the opponent-QB system's real value is the added
   texture/visibility (a genuinely tough or genuinely soft individual matchup) and being the
   necessary foundation for items 3-5 above, not a difficulty lever by itself.

6. **Rival QB profile page — shipped.** Clicking any opposing QB's name (Schedule tab, both playoff
   round box templates, League tab standings) opens a profile card: career stats (yards, TD, INT,
   rating, record, games), MVP/All-Pro/Pro Bowl badges, and `rivalCareerFunFacts(rival)` — all
   derived from data the rival already carries (best season, draft-classmate status, whether he
   succeeded a retired predecessor, whether he's still without a Pro Bowl this deep into his career)
   rather than a hand-authored joke pool to maintain. One genuine easter egg: since rivals are named
   via the same `randomFullName()` the player's own prospects use, a rival can land on one of the
   existing Key & Peele `EASTER_EGG_NAMES` gags, called out as its own fun fact when it happens.
   New `findRivalById(id)` (unlike `rivalForTeam`, also finds *retired* rivals, so a profile opened
   from an old season's log still resolves) and `opponentQbId`/`_oppQbId` fields threaded alongside
   the existing name/overall fields at all 4 places an opponent QB is generated. One delegated click
   listener on `#careerContent`, attached ONCE at init (not inside `renderSeasonCard`, since that
   function's container element is never recreated between seasons — attaching there every render
   would silently stack up a duplicate listener per season) — covers every `[data-rival-id]` link
   regardless of which tab panel it's in, since `switchDashTab` only toggles visibility.

7. **Supporting cast grades (O-Line/Weapons) — shipped.** New `career.oline`/`career.weapons`
   (20-99, own independent noise against team strength via `rollSupportingCastGrade` — a good team
   can absolutely have a bad line, that's the point), displayed as A-F letter grades
   (`castLetterGrade`) in the season card's front-office widget and on every free-agency offer card
   — the "chase the bag vs. play behind a bad line" tradeoff is now something you can actually see
   before signing, not just a vibe. Mechanically wired in: sack rate now reads `career.oline`
   instead of generic team strength (a good team could always have had a bad line; now it can
   actually show up as one), a small `weapons`-linked nudge on completion%/YPA, and an O-line-linked
   injury-risk multiplier (a bad line means more hits taken, not just more sacks) — both mirrored in
   the Admin Calc tab's preview formula, same sync convention as `STAT_SENSITIVITY`/`STAT_BLEND`.
   FA offers roll a preview `oline`/`weapons` once per offer and carry it on the offer object itself
   (`signFreeAgentOffer` uses the STORED value, never re-rolls) — what you see in the offer is
   exactly what you get if you sign it. The existing `oline`/`starleaves` `ORG_EVENTS` entries (which
   already existed, previously just bumped generic team strength) now carry a `target` field routing
   their delta to the correct specific stat instead. All 5 sites where the player joins a new team
   (waiver signing, expansion draft, trade, granted trade request, free-agent signing) roll fresh
   values for the new roster; light ±2/season noise keeps both stats from going static between events.

8. **Wear and tear economy — shipped.** Replaces "instead of binary injury events" (the user's own
   framing) with a persistent, career-long `career.wearAndTear` meter (0-100) that the play-through-
   it-vs-sit-it-out choice actually feeds, instead of the old system where that choice only affected
   this-season missed games/performance and a since-untouched, tiny, choice-independent
   `permanentHit` roll (still present, unchanged — a rare ~1-4pt freak structural injury, distinct
   from and much less common than this new accumulation-driven system) was the only source of
   permanent decay. In `resolveInjuryChoice`: gutting it out adds `randInt(10,18) + sev*16` (+more if
   it worsens) to the meter; shutting it down adds almost nothing (`randInt(0,2) + sev*3`) — rest
   genuinely protects the body. In `generateSeason()`: a small age/DUR-scaled baseline wear applies
   every season (accelerating past age 26, faster for low-DUR builds), and an injury-free season
   recovers some back, tapering off past age 28 (an older body doesn't bounce back the way a
   23-year-old's does). Above a **45-point threshold**, each season rolls a breakdown chance
   (`clamp((wear-45)*0.012, 0, 0.4)`) that permanently docks 1-2 *physical* attributes (ARM/REL/MOB/
   IMP — DUR itself is never touched, preserving the existing "DUR is the one attribute deliberately
   left un-adjusted" invariant) by 2-5 points each, and relieves 22 points of wear (a breakdown is
   itself a forced recovery, not an ongoing drain). **Diagnostically tuned** (pure-math trajectory
   sweep across 5,000 simulated careers per policy, no game code needed, before writing any of this
   into `src/main.js`): "always sit out" stays at ~0% breakdown risk for a full 14-season career
   regardless of durability; "always gut it out" produces at least one permanent breakdown in
   **65-81% of careers** (worse for a fragile/low-DUR build), with a **23-35% chance of one
   specifically by age 30** — a genuine, tangible cost tied directly to the choice, not a rare
   footnote. Visible, not hidden, matching this project's "legible causes" convention from item 5
   above: a new "Wear & Tear" meter row in the front-office widget (reusing the existing
   `fanMeterRow` component) with a plain-language tag (Fresh/Some Mileage/Battle-Tested/Breaking
   Down/Running on Fumes) and explanation; the injury-choice card itself shows the current wear
   level and an explicit warning once it's past the risk threshold, so the decision can be made
   with full information, not blind; a breakdown season gets its own narrative line on the Season
   tab (`season.wearBreakdown`) alongside a transactions-log entry naming exactly which attributes
   declined. Verified live (not just diagnostics): a Playwright run that always chooses "gut it out"
   confirmed no crashes and correct display across many seasons; a second run that force-set
   `career.wearAndTear` to 95 via the save data and resumed confirmed the breakdown narrative fires,
   the correct physical attributes take a real hit at the moment it happens, and wear drops
   afterward exactly as designed.

9. **Lifepath events — shipped.** Two new systems, both pure narrative/reputation-adjacent flavor
   (never attribute effects, so a career's PLAY never depends on its love life or hobbies, only its
   story does):
   - **A stateful relationship arc** (`career.relationship`) — single → dating → married, with
     breakup/divorce branches at each stage, so a partner's NAME and TYPE persist across seasons
     (`renderRelationshipEvent`/`relationshipCheck`) instead of independent unconnected dice rolls.
     8 invented celebrity archetypes (`CELEBRITY_ARCHETYPES` — pop star, movie star, supermodel,
     reality-TV star, R&B singer, late-night host, tech founder, country singer; ~35 invented names
     total) feed 5 flavor-template pools (start/breakup/marriage/divorce/married-life-aside, ~24
     variants total) so the same transition rarely reads identically twice. Real names were
     deliberately never used — same safe convention `RARE_EVENTS` already established for
     "recognizable but fictional" NFL-moment easter eggs. Effects land on `reputation` and
     `leaguePopularity` (never attributes), with a nice bit of realism: a messy/public breakup or
     divorce hurts reputation but actually *raises* popularity (the tabloid-attention effect).
   - **`LIFEPATH_EVENTS`** — 26 one-off flavor entries independent of the relationship arc: business
     ventures (restaurant, clothing line, a dead crypto token), hobbies (chess, golf, six rescue
     dogs), family (buying his parents a house, sibling drama going public), crossover friendships/
     rivalries, and a run of fictionalized nods to real "you can't make this up" pro-sports anecdotes
     (mic'd-up segments, a viral touchdown celebration, a disastrous ceremonial first pitch, getting
     locked out of the facility, mistaken for a different athlete) — same no-real-names convention.
   - Both check independently each season, at the TOP of `lifeEventCheck()` (ahead of the existing
     rare/infraction/locker-room/positive/org chain, so they never compete with those for the same
     season's "slot") — `relationshipCheck()` at 14%, `lifepathCheck()` at 11% — and `lifepathCheck`
     (not `relationshipCheck`, deliberately, to avoid soap-opera-fast relationship pacing) is also
     checked in `secondaryLifeEventCheck()` for occasional same-season stacking. Current relationship
     status (if any) now shows in the front-office widget.
   - **Investigation note, not a bug**: extensive Playwright testing during this item repeatedly hit
     a test-harness ceiling, not a feature bug — a bare-bones click-through script that only knows
     about `.choice-btn`/`playOnBtn`/`continueBtn` will eventually stall on a free-agency offer
     screen (`.fa-accept`) or a live playoff reveal (`.pq-btn`, e.g. `#pqSimEnd-N`), both pre-existing
     UI patterns that use different button classes. Direct source-level tracing (temporary
     `console.log`s in `lifeEventCheck`/`advanceCareer`/`saveActiveCareer`, removed before commit)
     confirmed clean, correct season-over-season progression with relationship/lifepath events
     firing, applying correct effects, and resolving normally across multiple separate runs — e.g.
     one run's save data showed a real, correctly-shaped `career.relationship: {status:"dating",
     partnerName:"Indigo March", partnerType:"supermodel", startYear:1973}` after the event fired.
     If a future round wants a fully automated multi-season Playwright harness, it needs a click-
     through selector that also covers `.fa-accept`/`.fa-negotiate` and `[id^='pqSimEnd-']` (fastest
     way to resolve a playoff round in one click) — worth building once, not per-round.

10. **Trophy Room: a local, cross-career leaderboard (wishlist item "Hall of Records" — shipped).**
    Every completed career (retirement, release, or the age cap) now writes a permanent summary
    entry to a new `gridironlab.trophyroom` localStorage key, independent of the existing single-slot
    `gridironlab.activeCareer`/best-career save. `saveTrophyRoomEntry()` is called once, from
    `finishCareer()`, right after `career.totals` is finalized — it records name/college/hometown/
    decade/draft year/exit reason/verdict tier alongside the full stat line (games, yards, TD, INT,
    sacks, rush yards/TD, Pro Bowls, All-Pros, MVPs, rings, earnings, and a computed passer rating),
    capped at the most recent `TROPHY_ROOM_CAP=60` entries (oldest dropped first) so localStorage
    can't grow unbounded over a long play history. Same `store`/`_sessionTrophyRoom` fallback pattern
    as `loadBest`/`saveBest` — falls back to an in-memory array when storage is blocked, so the
    feature still works within a single session even with cookies/storage disabled.

    New `screen-trophyroom` screen (reachable via a "Trophy Room" button added next to "Start the
    combine" on the main menu) renders a sortable table via `buildTrophyRoomTableHTML(sortKey)` —
    seven sort modes (Most Recent, Rings, Pass Yards, Touchdowns, Rating, Earnings, Seasons) via
    `TROPHY_ROOM_SORTERS`, toggled by `.tr-sort-btn` buttons wired once in Init. Record cells (this
    browser's all-time best in that column) are highlighted gold via a `.tr-record` CSS class —
    deliberately computed as `maxOf(key)` across the **entire** stored list every render, not just
    the currently-sorted/visible rows, so the gold highlight always marks the true all-time record
    regardless of which sort the player has selected. Empty state (no careers completed yet) shows a
    plain-language nudge instead of a blank table.

    Verified via three Playwright passes against a real dev build: (1) empty-state message renders
    correctly with no data, and the back button returns to the main menu; (2) seeded three fake
    entries directly into the localStorage key, confirmed default sort is most-recent-first, confirmed
    re-sorting by rings reorders correctly (highest first, zero last), and confirmed the entry holding
    every one of the 6 numeric records gets exactly 6 `.tr-record`-classed cells; (3) end-to-end real
    write-path test — started a real career, forced its saved `career.age` to 60 (well past
    `durabilityAgeCap()`) plus a known rings/yards pair via direct localStorage manipulation, resumed
    and advanced to trigger the genuine age-cap branch in `advanceCareer()` → `finishCareer()`,
    confirmed exactly one trophy-room entry was written with the correct rings/yards and all expected
    fields present, and confirmed the Trophy Room screen displays that real entry by name. Zero page
    errors across all three passes.

11. **Playstyle Badges: 24 collectible badges across two categories, with a 3-slot equip UI (shipped).**
    Two kinds, both keyed by a stable string in the new `PERF_BADGES`/`LEGEND_BADGES` arrays:
    - **Performance badges** (14: Gunslinger, Field General, Iron Man, Comeback Kid, Human Highlight
      Reel, Dual Threat, Efficiency King, Untouchable, Workhorse, Franchise Cornerstone, Ball
      Security, System Fit, Playoff Performer, Ageless Wonder) are tiered Bronze/Silver/Gold/
      Platinum and RECOMPUTED every season — they rise and fall like Overall does, never a
      permanent unlock. `recomputeBadges(eff)` is the only writer of `career.badges.perfTier`,
      called once per season from `generateSeason()` right after totals are locked in and BEFORE
      `developAttributes()` mutates `build` for next season, so a badge's tier reflects the
      attributes that actually produced THAT season's play. Each badge's `score(eff, recent)`
      blends this-season's effective attributes with a trailing 3-season window of real stat
      output (yards/att, INT rate, sack rate, rushing production, passer rating, etc. depending on
      the badge) — never attributes alone, so a badge can't be "won" purely by a good dice roll at
      the Combine.
    - **Legend badges** (10: Hollywood Ending, Against All Odds, Phoenix Rising, Iron Will, The
      Unanimous, Old Man Winter, Loyal to the Death, Late Bloomer, Storybook Career, Scar Tissue —
      the "unicorn of the league" tier, UI label "Legend") are one-time PERMANENT unlocks tied to
      rare, specific career moments, several of them deliberately keyed off systems that don't move
      Overall at all: Hollywood Ending needs a same-season ring AND marriage (reads
      `career.relationship.startYear===career.year` off the Round 5 relationship-arc state machine);
      Storybook Career needs 3+ `legendary`-flagged `career.lifeEventLog` entries (the same flag
      RARE_EVENTS already sets); Phoenix Rising scans `season.devArcEvent` history for a bust
      followed later by a breakout. `checkLegendBadges()` is the only writer of
      `career.badges.legendUnlocked`, and only ever flips false→true — called from
      `finalizePlayoffOutcome()` (so the just-finished season's ring/awards are already final) AND
      from `finishCareer()` (so a career-ending-only condition like Loyal to the Death, which needs
      `career.exitReason==="retired"`, can still fire on the last possible tick).

    **Equip system**: `career.badges.equipped` holds up to `BADGE_EQUIP_CAP=3` badge keys — purely
    cosmetic, a showcase of playstyle, deliberately changes no stat or odds. A new "Badges" dash-tab
    (`buildBadgesTabHTML()`) shows the 3 slots plus the full 24-badge roster, locked cards showing a
    vague hint (`def.hint`) instead of the exact numeric threshold. Clicking a slot
    (`data-slot-index`, delegated through the same one-time `#careerContent` click listener that
    already handles `data-rival-id`) opens `#badgeEquipOverlay` — a scrollable list of all 24 badges
    on one side (locked ones greyed out and unclickable, a badge already equipped in another slot
    marked and unclickable too) and the slot preview on the other; selecting an unlocked badge fills
    the preview with a `pb-fill-anim` pop-in animation. Badge tier is shown via frame SHAPE, not just
    color, so it reads at a glance even before checking the label: circle (Bronze) → hexagon
    (Silver) → octagon (Gold, with a soft glow) → 8-point starburst (Platinum, stronger glow) →
    diamond (Legend, animated shimmer). All 24 icons are hand-authored inline SVG glyphs
    (`BADGE_ICONS`/`badgeIconSVG`) in the same stroke-based style as the rest of the game's charts —
    no image assets.

    **Calibration**: tier cutoffs are `score>=85/68/48/28` → Platinum/Gold/Silver/Bronze. A first
    pass left every attribute-pure badge (Gunslinger, Field General, Comeback Kid, Ball Security,
    System Fit, Untouchable, Dual Threat's attribute half) using a raw `weighted(eff,{...})` value
    directly as the 0-100 score — since attributes sit in a ~45-92 practical range, this let ANY
    flat-70 build hit Gold on 2 badges just for existing, no specialization required. Fixed (pure-
    math sweep, no game code needed — see `badge_calib.mjs`-style diagnostic) by rescaling every
    attribute-pure component through `scoreCurve(weighted(eff,{...}), 45, 92)` before blending: a
    weak flat-50 build now sits mostly Locked/Bronze, a flat-70 generalist sits Silver, a genuine
    specialist (e.g. elite ARM/DAC/IMP, everything else mediocre) maxes Platinum in Gunslinger while
    staying Locked in Field General — confirmed via a synthetic sweep across 5 representative
    profiles per badge before committing.

    Verified via Playwright against a real dev build, one real season played through: Badges tab
    renders exactly 3 slots and all 24 cards (14 perf + 10 legend) with a realistic locked/unlocked
    mix after a single season; the equip picker lists all 24, refuses to equip a locked badge,
    equips an unlocked one with the fill animation and updates both the slot label and the front-
    office widget's new equipped-badge strip; removing an equipped badge correctly empties the slot
    again. Zero page errors.

12. **Exportable Baseball Card: a flippable trading-card visual per completed career (shipped).**
    Built entirely as inline SVG (`buildCardFaceSVG(entry, side)`, two "0 0 400 560" faces) rather
    than HTML/CSS specifically so the exact same markup serves both the on-screen flip view AND the
    PNG export — no html2canvas or any other library, same "no chart library, just plain SVG
    strings" convention as the radar chart/sparkline/bracket renderers. Deliberately does NOT show a
    season-by-season list (explicit ask: "not every season... small clean boxes so it doesn't feel
    crowded"). Front face: name, college/draft class, team history (deduped consecutive team
    names), a big "Peak Overall" circle (`Math.max` over `seasonLog[].overall`, NOT the career-
    ending overall), a trophy line (MVP/All-Pro/Pro Bowl counts, omitted if zero), verdict tier, and
    a clean 3x2 stat-box grid (Seasons/Rings/Pass Yards/Pass TD/INT/Rating). Back face: up to 3
    equipped Playstyle Badges (frame shape + icon, reusing `BADGE_ICONS` from the badges system),
    draft pedigree (`career.transactions[0]`, already human-readable), a one-line "how it ended"
    (`cardExitLine(exitReason)`), and — the deliberately fun/non-obvious addition — an "Off the
    Field" line surfacing `career.relationship` at the moment the career ended (e.g. "Married to
    Wren Delacroix, the pop star."), tying the Round 5 lifepath/relationship system into the card
    rather than treating it as pure flavor text nobody sees again. Card RARITY (border color +
    corner label: COMMON/UNCOMMON/RARE/LEGENDARY/HOLO) is keyed off HOF verdict tier via
    `CARD_RARITY`, so a First-Ballot Hall of Famer's card visibly reads as a "hit" the moment it's
    opened, before reading a single stat.

    New fields on the Trophy Room entry object (`saveTrophyRoomEntry` in `finishCareer()`):
    `peakOverall`, `teams`, `equippedBadges` (array of `{key, tier}` — perf badges freeze their
    final-reached tier, legend badges store `tier:null` since they're not tiered), `draftLine`,
    `relationshipLine`. All are read defensively (`entry.field || fallback`) everywhere the card
    renders, since every Trophy Room entry saved before this round lacks them entirely — verified
    this doesn't crash or print "undefined" for an old-shaped entry. Reachable from two places: a
    new "View Trading Card" button on the HOF/retirement screen (uses `lastFinishedCareerEntry`, a
    snapshot of the trophy-room entry `finishCareer()` just built and saved, kept in a module-level
    variable purely so this button doesn't need to re-derive it from `career` after the screen's
    already showing) and a new "Card" button per Trophy Room row (looks the entry back up by `id`
    from `loadTrophyRoom()`) — both open the same `openBaseballCard(entry)`, one shared code path.

    **Flip**: `.card-flip` with `perspective` on the container and `backface-visibility:hidden` on
    each face — clicking the card OR a "Flip card" button toggles `.flipped`, a pure CSS 3D
    transform, no JS animation loop.
    **Export**: `exportBaseballCard(entry)` builds one combined SVG (front stacked above back),
    base64-encodes it into a `data:image/svg+xml` URI, loads that into an off-screen `Image`, draws
    it onto a 2x-scaled `<canvas>`, then triggers a real file download via a temporary `<a download>`
    pointed at the canvas's `toDataURL("image/png")` — wrapped in try/catch with a plain-language
    fallback message, since this SVG-in-canvas technique is solid in Chromium (the primary target,
    per the Android-first decision) but not guaranteed on every engine. Known, accepted trade-off:
    because the exported SVG is re-parsed in an isolated (non-page) context, it can't resolve the
    app's CSS custom properties or guarantee the Google Fonts are loaded there — every card color is
    therefore a literal hex (`CARD_HEX`), never `var(--gold)` etc., and the font-family lists a
    generic fallback first so the export degrades gracefully instead of silently failing.

    Verified via Playwright: a seeded Trophy Room entry (with badges, a relationship line, multiple
    teams) opens correctly, front shows name/peak-overall/HOLO rarity/rings, flipping reveals both
    equipped badges by name, the draft line, the exit line, and the relationship fun fact; an
    old-shaped entry missing every new field still opens cleanly with sensible fallbacks and no
    "undefined" anywhere; export completes and reports "Saved." (no canvas/security error); and a
    REAL career forced through the age cap correctly wires `lastFinishedCareerEntry` so "View
    Trading Card" on the HOF screen shows that just-finished career's real data. Zero page errors
    across all passes.

13. **Playstyle Badges reworked into a pure Achievements system — equip removed, roster expanded to
    30, funnier/more unique conditions (explicit user redirect after playtesting the equip version).**
    The user's own framing: treat these like achievements, not a loadout — drop the 3-slot equip
    mechanic entirely, drop the tiered Bronze→Platinum performance-badge concept entirely, and add
    more distinctive, personality-driven unlock conditions (their examples: "No One Circles the
    Wagons" for 4 championships in a row, "Quiet Like the Buffalo Bills" for 4 championship-game
    losses in a row — a nod to the real 1990-93 Bills, fine to reference by name since the game
    already uses real team names everywhere, unlike the real-*person* restriction `RARE_EVENTS`
    fictionalizes around).

    `PERF_BADGES`/`LEGEND_BADGES`/`recomputeBadges`/`checkLegendBadges`/`career.badges` (equip
    slots, live tier recompute) are GONE, replaced by one flat system: `ACHIEVEMENTS` (30 entries,
    each a one-time permanent `check(career)` boolean, no tiers) / `checkAchievements()` (the only
    writer of `career.achievements.unlocked`, idempotent — safe to call from `generateSeason()`,
    `finalizePlayoffOutcome()`, AND `finishCareer()`, since it only ever flips an entry false→true).
    7 of the old attribute-tiered performance badges were converted into one-time single-season
    statistical achievements instead (e.g. Gunslinger is now "post a season with 4200+ yards, 32+
    TD, AND 18+ INT" — a specific bombs-away season, not a live-recomputed attribute score); the 10
    old Legend badges carried over unchanged, since they were already one-time/permanent and fit the
    new model exactly. 13 brand-new achievements were added, several needing genuinely new logic:
    - `maxConsecutive(list, pred)` — longest consecutive run in `seasonLog` satisfying a predicate.
      Powers "No One Circles the Wagons" (`maxConsecutive(seasonLog, wonTitle)>=4`), "Quiet Like the
      Buffalo Bills" (`maxConsecutive(seasonLog, reachedTitleGameAndLost)>=4`), "Wire to Wire"
      (back-to-back MVP), "Juggernaut" (3 straight seasons at 90+ team grade).
    - `reachedTitleGameAndLost(s)` — the internal round label for the final game is ALWAYS literally
      `"Super Bowl"` regardless of era (confirmed via `buildSuperBowlRound`, only ever called after a
      team wins its own Conference Championship), so `last.round==="Super Bowl" && !last.won` looks
      right at a glance -- but a pre-1966 season can win its ring via the Conference Championship and
      then lose the fictional exhibition Super Bowl simulated afterward (see `finalizePlayoffOutcome`),
      so the `&& !wonTitle(s)` guard is required or a real ring-winning season misreads as a title-
      game loss. Verified with a standalone pure-logic script (`achievement_streak_check.mjs` style)
      against constructed season logs before wiring it into the real check functions — including
      that exact pre-1966 edge case, a broken streak that shouldn't count, and a ring breaking up
      what would otherwise be a 4-loss streak.
    - Other new achievements: Snake Bitten (3+ title-game losses, 0 rings, non-consecutive), Ring
      Chaser (rings with 2+ different teams), Dynasty (4+ rings with one team, not necessarily
      consecutive — distinct from the Wagons streak achievement), Perfect Season (0-loss team
      record), The Turnaround (join a sub-45-grade team, win it within 3 seasons), Face of the
      League (3+ career MVPs), One-Man Team (3+ Pro Bowl/All-Pro nods on a sub-45 team), Big Game
      Hunter (won the Super Bowl as the lower-graded team, using the existing `_defOverall` field
      already on the SB round object), Ironclad (10+ seasons, never missed a game to injury).

    UI: the "Badges" dash-tab (kept its internal id/data-tab value to limit churn, display label
    changed to "Achievements") now shows only the full 30-card roster — earned cards gold with their
    blurb, locked cards greyed with a vague hint, NO equip row, NO click interaction of any kind. The
    front-office widget's equipped-badge icon strip is gone, replaced by a single "Achievements N/30"
    line. The equip-picker overlay (`#badgeEquipOverlay`, `buildBadgeEquipHTML`, etc.) is deleted
    outright, along with its CSS, except `.be-close` — kept because the Baseball Card's close button
    already shared that class.

    **Baseball Card impact**: the back face's "Equipped Badges" (max 3, cosmetic loadout) became
    "Achievements Earned" (every achievement actually unlocked that career, up to 12 shown in a 4x3
    grid with a "+N more" overflow note, since some careers will earn more than fit). Trophy Room
    entries now save `achievements: [key, key, ...]` (all unlocked keys) instead of `equippedBadges:
    [{key,tier}]` (3 equipped keys) — read defensively (`entry.achievements || (entry.equippedBadges
    ||[]).map(b=>b.key) || []`) so a card saved under the OLD equip system still renders correctly
    instead of showing nothing. Achievement name labels on the card needed a 2-line wrap
    (`cardWrapTwoLines`, breaks at the nearest space at-or-before a char budget) since several names
    ("No One Circles the Wagons", "Quiet Like the Buffalo Bills") are too long for a single line at
    grid-cell width — first-pass single-line truncation cut them down to unreadable fragments like
    "No One Cir…", caught by a Playwright assertion before shipping.

    Verified via Playwright: the Achievements tab renders all 30 cards with the "Achievements" label
    and zero equip UI anywhere in the DOM; the front-office widget shows the new N/30 line and not
    the old wording; a NEW-shaped seeded Trophy Room entry's card back correctly shows "ACHIEVEMENTS
    EARNED (4)" with full (wrapped, not truncated) achievement names; an OLD-shaped entry (the
    previous round's `equippedBadges` format) still renders via the fallback mapping with no
    "undefined" anywhere; a real season played through fires `checkAchievements()` with zero page
    errors. Streak/title-game boolean logic itself was separately verified with a standalone
    pure-math script against constructed season logs, including the pre-1966 edge case, before ever
    touching the real game code.

14. **8 dark-humor achievements, hooked directly to specific rare/infraction scandal events
    (explicit user ask, with "He Got That Dawg in Him" as the model for the tone — a joke title
    layered on top of the game's own straight-faced event narration).** RARE_EVENTS already carried
    a stable `achievementId` field per event (added back in the original lifepath-events round,
    specifically "so a future achievements system can hook directly off career.lifeEventLog entries
    without a schema change later" — that promise had never actually been wired up until now).
    Turned out `resolveInfraction()`'s `career.lifeEventLog.push(...)` wasn't actually stamping that
    id onto the log entry at all yet — fixed by adding `achievementId: ev.achievementId||null` to
    that one push call, which is the single resolver both `INFRACTION_EVENTS` and `RARE_EVENTS`
    share. Also added `achievementId:"got_that_dawg"` to the previously-untagged `animalring`
    ("Federal Investigation") infraction — the fictionalized, no-real-names dogfighting-scandal
    event — matching the same convention. New shared helper `hadLifeEvent(achievementId)` just scans
    `career.lifeEventLog` for a matching id; every new achievement's `check()` is a one-line call to
    it, so a future scandal event just needs an `achievementId` to get an achievement hook for free.

    The 8: **He Got That Dawg in Him** (`got_that_dawg` / animalring), **Shot Himself in the Foot
    (Literally)** (`own_worst_enemy` / accidentally shoots himself at a nightclub), **Bounty Hunter**
    (`bounty_hunter` / pay-for-injury bounty scandal), **Master of Disguise** (`master_of_disguise` /
    caught skipping a team flight in a bad wig), **Walkabout** (`walked_away` / quietly vanishes
    mid-career to "find himself"), **Wrong Place, Wrong Time** (`wrong_place_wrong_time` / named in a
    nightclub shooting he wasn't part of), **The House Always Wins** (`house_always_wins` / gambling
    debts end the career), **Do Not Disturb** (`unraveling_on_camera` / furniture-throwing hotel
    meltdown goes viral). Each achievement's own name is a separate joke layered on top of the
    event's straight, in-character news-story title — the event itself still reads as a real
    consequence (suspension, released, banned), the achievement popup is where the dark humor lives.
    New `paw` icon added to `BADGE_ICONS` for the dogfighting one; the rest reuse existing icons.
    Roster is now 38 total (30 + these 8).

    Verified via Playwright using the Admin panel's real "force fire" controls (not a synthetic
    stub) against a live career: confirmed both new cards render locked pre-trigger; force-fired
    `disguiseflight` (a fast-resolving single-suspension event, chosen over `animalring` specifically
    because `animalring`'s real severity is a 3-season suspension saga with several unrelated
    interstitial events in between — not a practical target for a deterministic automated test,
    though it shares the exact same `resolveInfraction` code path and `lifeEventLog.push` line, so
    the mechanism is validated by direct code parity, not just by inference); clicked through to
    resolve it and advance one season so `checkAchievements()` (called from `generateSeason()`)
    actually ran; confirmed Master of Disguise flipped to unlocked while He Got That Dawg in Him
    stayed locked (proof a different event firing doesn't cross-unlock an unrelated achievement);
    confirmed the roster count reached 38. Zero page errors.

Verified end-to-end via Playwright (not just diagnostics) across a real 8-season playthrough: zero
page errors, opponent QB correctly shown every season in the Schedule tab, League News feed
populated (23 entries by season 8), team-strength spread stayed realistic (range of 75 points across
the league, bounds respected). Screenshotted the Schedule and League tabs to confirm the rendering
matches the data (a 62-grade team fielding a 49-overall rival QB; a 34-grade team's 41-overall QB;
etc. — genuine, visible mismatches between team grade and QB grade, not just a relabeled team number).

### Round 4 — difficulty/realism overhaul, all 3 items shipped
Triggered by user feedback on the Round 3 build: a 63-overall QB was posting 4,721 yards / 39 TD / 104.7 rating, and a 42-overall team was shown beating a 73-overall team in the conference championship, then facing (and being competitive with) a 96-overall team in the Super Bowl. Three asks: (a) tighten stat production further, (b) make team grade matter much more so lopsided upsets are "very very rare," (c) redesign player development to have boom/bust potential instead of smooth linear progression — explicitly flagged by the user as something to brainstorm together, not implement unilaterally. For item (c), presented 4 concrete mechanic options to the user via AskUserQuestion; the user selected all 4 (rare breakout events, real bust/plateau paths, volatility tied to dev-speed tag, dev speed shifting mid-career) — synthesized into one unified system rather than four bolted-on mechanics (see item 3 below).

1. **Team quality now BLENDS with the QB's own grade, instead of just nudging it (item b — shipped).** Root cause: the old `playoffTeamEdge(season)` / `regularSeasonTeamEdge(age, decade)` added team quality as a small ADDITIVE edge on top of the QB's own `effOverall` (`(teamStrength-70)*0.32` for playoffs, max magnitude ~±9-10) — so an elite QB's personal grade almost entirely determined game outcomes regardless of team quality. Diagnostically confirmed the bug: an elite QB (effOverall≈92) on a teamStrength=42 team had a 37-63% win rate against 80-90-grade opponents under the old formula.

   Replaced with a BLEND: `blendOffenseWithTeam(effOverall, teamStrength, qbInfluence) = teamStrength + (effOverall-teamStrength)*qbInfluence`, pulling the offensive grade hard toward team quality in either direction. New `regularSeasonOffenseGrade(effOverall, age, decade)` and `playoffOffenseGrade(effOverall, season)` wrap this (plus the existing Clutch bonus) and are called at all 4 sites that used to call the old edge functions: `simulateRegularSeasonGames`, `resolveConferenceBracket`'s `playMatch`, `stepConferenceBracket`'s `simulateMatch`, and `buildSuperBowlRound` — plus the Admin Calc tab's `computeMetricBreakdown()` preview (card text rewritten to explain the blend). `qbInfluence` diagnostically tuned to **0.35 for playoffs** (`QB_INFLUENCE_PLAYOFF`), **0.45 for regular season** (`QB_INFLUENCE_REGULAR`).

   Verified against the final committed code (not just throwaway diagnostics): an elite QB (effOverall=92) on a 42-team now wins ~31% vs a 70-grade opponent, ~15% vs 80, ~7% vs 90, ~3% vs 96 — and specifically against the user's reported scenario, a 42-team elite QB wins ~24% vs a 73-grade opponent, ~4% vs a 91-grade opponent, ~3% vs a 96-grade opponent. QB skill still matters on comparably-matched teams (on a 70-team vs a 70-grade opponent: a 50-skill QB wins ~38%, a 92-skill QB wins ~69%). This also directly addresses the "winning multiple Super Bowls in a row has been too easy" complaint: team strength now swings outcomes far more, so a dynasty has to keep re-earning a strong roster, not just field one elite QB indefinitely.

2. **Stat production tightened further (item a — shipped).** `STAT_SENSITIVITY` lowered from `0.5` (Round 2's value) to `0.32`, in both `generateSeason()` and the Admin Calc tab's `computeMetricBreakdown()` (kept in sync, same pattern as Round 2). New calibration (avg / ceiling rating across 40 trials per flat-build tier, verified against the final committed code): flat≈60 overall → avg rating 82.0 / ceiling 89.2, avg yards 3,638 / ceiling yards 4,490, ceiling TD 29; flat≈76 overall → avg rating 91.2 / ceiling 97.7; flat≈86 overall → avg rating 96.4 / ceiling 103.1; flat≈94 overall → avg rating 100.1 / ceiling 106.2. A genuinely elite (95-overall) build on a stacked (90-grade) team still reaches real record-chasing territory (4,600+ yards / 38+ TD / 105+ rating) in roughly 1-in-10 seasons — rare and notable, not routine.

   Could **not** exactly reproduce the user's specific reported outlier (63 overall → 4,721 yards / 39 TD / 104.7 rating) via flat builds, narrow ARM/DAC-specialist builds, or scheme-matched builds — best reproduction attempts topped out around 87-91 rating ceiling for overall~60-63 under the *old* (pre-Round-4) formula, and confirmed the displayed "Overall" field is computed identically to the diagnostic method, ruling out a display/computation mismatch. Applied a decisive, substantially tightened dial per the user's clear directive rather than continuing to chase the exact number without their specific build/decade/scheme details. If the new numbers still feel too high, more detail (decade, scheme, career stage, exact build) would let this be tuned further with real data instead of synthetic sweeps.

3. **Player development boom/bust overhaul (item c — shipped).** Replaces the old tiny, independent ±2/-1 single-attribute breakout/regression roll with one unified "career-arc swing" system that implements all 4 mechanics the user picked as facets of the SAME dial, not four separate bolt-ons:
   - **New `devVolatility(speed)`** — the chance of a swing event THIS season, a function of how far the player's *current* `devSpeed` sits from the 1.0 center (`clamp(0.035 + Math.abs(speed-1.0)*0.18, 0.035, 0.22)`): ~3.5%/season for a dead-center "Standard Development" player, rising to ~10-18%/season at the archetype extremes. This is what ties volatility to the dev-speed tag (mechanic 3) — and since it's keyed to the *current* devSpeed rather than the original roll, a player who has already swung once becomes more volatile going forward, not less.
   - When a swing fires (checked once per season in `developAttributes`, after the normal smooth per-attribute drift), direction is a weighted coinflip — `breakoutProb = clamp(0.5 + (devSpeed-1.0)*0.5, 0.15, 0.85)` — biased toward breakouts for already-ascending players and toward busts for already-declining ones, but never a sure thing either way (the unpredictability is the point of "boom or bust").
   - **Breakout** (mechanic 1): 3-5 random eligible attributes jump together by +4 to +9 each, past the normal season-to-season ceiling (`original+30` instead of the usual `original + round(14*devSpeed)`). Also bumps `career.devSpeed` up by `+0.15 to +0.25` (floor/ceiling clamped to 0.25–1.8) — a real trajectory shift, not just a one-season stat pop. Hard-capped at **2 lifetime breakouts per career** (`career._breakoutCount`), matching the "once or twice a career" framing.
   - **Bust-spiral** (mechanic 2): 2-4 random eligible attributes drop together by -3 to -7 each, past the normal floor (`original-30`). Also drags `career.devSpeed` down by `-0.15 to -0.25`. Not lifetime-capped (that's the harder, riskier flip side) but self-limiting: once devSpeed bottoms out near its 0.25 floor, `maxGain = round(14*devSpeed)` in the ordinary per-attribute drift loop collapses toward zero, so a sufficiently busted player's normal growth genuinely plateaus — this is what produces real bust/plateau careers (mechanic 2) as a natural consequence of the shifting-devSpeed mechanic (mechanic 4), with no separate "is this a bust" flag needed.
   - **`devSpeedTag(speed)` extended** to name the post-swing range outside the original 0.6-1.4 roll: `<0.45` → "Stalled Out" (new), `<0.75` → "Slow Burn", `<0.9` → "Steady Riser", `<1.1` → "Standard Development", `<1.25` → "Quick Study", `<1.45` → "Ascending Fast", `≥1.45` → "Breakout Star" (new). The tag is re-derived from the *current* devSpeed everywhere it's shown, so it visibly moves after a swing.
   - **UI**: `season.devArcEvent = { type: "breakout"|"bust", keys: [...] }` (set in `developAttributes`, alongside the existing `season.attrChanges`) drives a new headline banner (🔥 "Breakout Season" / 📉 "Development Stalled") at the top of `buildSeasonProgressHTML`'s Attributes-tab strip, above the existing per-attribute delta list (which still tags each affected attribute `breakout:true`/`regression:true` as before, now just 2-5 of them at once instead of one). Transaction-log entries and the two devSpeed explanatory blurbs (Attributes tab, Admin Calc tab) were updated to say the trait can shift over a career instead of being fixed at the Combine.
   - Diagnostically calibrated full-career swing frequency (14-season careers, 60 trials/archetype): a "Standard Development" starting roll averages ~0.2-0.3 breakouts and ~0.2-0.3 busts per career with only ~30-45% of careers seeing any swing at all; the extreme starting archetypes ("Slow Burn" 0.68, "Ascending Fast" 1.32) see a swing in ~75% of careers, with "Slow Burn" ending "Stalled Out" in ~25-30% of careers (real bust risk for a low initial roll) and "Ascending Fast" ending "Breakout Star" in ~40-45% (real superstar upside for a high initial roll) — meaningfully different career textures by starting archetype, not just a faster/slower version of the same smooth curve.

Testing note: the Round 4 code change removed `playoffTeamEdge`/`regularSeasonTeamEdge` entirely (replaced by `blendOffenseWithTeam`/`regularSeasonOffenseGrade`/`playoffOffenseGrade`), which broke two pre-existing regression fixtures that called the old functions directly by name: `test_teamquality_d22.js` and `test_round_batch_d22.js`'s item 4. Both were superseded (not just patched) for the `_d23`/`_d24` regression runs: `test_teamquality_d23.js` was rewritten to assert against the new blend API (including a new explicit "upset rarity" check — a 42-team elite QB vs a 90-grade opponent wins <20% of the time), and `test_round_batch_d23.js`'s item 4 was updated to call `regularSeasonOffenseGrade` instead. Also widened `test_round_batch`'s item 2 (elite-build-reaches-ceiling check) from 6 to 40 trials, since the deliberately tightened `STAT_SENSITIVITY` makes a ceiling season genuinely rarer now (empirically ~1-in-10, not ~5-in-6) — the original 6-trial sample was tuned for the old, higher-ceiling calibration and started producing false negatives, not a real regression. New `test_round4_devarc.js` targets the boom/bust system specifically: extended `devSpeedTag` range, `devVolatility` shape, breakout/bust multi-attribute application + devSpeed shift + lifetime breakout cap, the `devArcEvent` banner rendering, and that ordinary no-swing seasons still use the unchanged smooth drift. All regression families (test4–9, decadefit, attrtab, ot_fix, sb_shield, gradefor, retrospective, legendary_retro, awards, season_progress, lastbuild, teamquality, round_batch) ran clean against both `index.debug23.html` and `index.debug24.html` with zero real regressions (only expected "threw: false" = no-exception-thrown PASS lines).

### Round 3 — 5-item batch, all shipped
1. **Era-plausible regular season scheduling.** `pickRegularSeasonOpponents(n)` still plays every division rival home-and-home (unchanged from Round 2), but the "everything else" fill is no longer a fully-random `shuffle(fillPool)` redraw every season. New `rotationPick(divs, cycleYear)` — pure function of the year (not `Math.random()`) — picks one same-conference division and one cross-conference division to be this year's "extra" schedule emphasis, offset from each other so the two wheels don't turn in lockstep. `pickRegularSeasonOpponents` now shuffles and preferentially fills from those two divisions' teams before falling back to the full remainder, so the same division-vs-division pairing recurs in a stable multi-year cycle — closer to how real scheduling formulas rotate opponents than a uniform random draw every year, without trying to reproduce any one era's exact formula down to the game.
2. **Fixed-slot Pro Bowl / All-Pro**, replacing the old independent-probability rolls (Round 2 already fixed MVP the same way; this extends the same pattern). `evaluateSeasonAwards` no longer rolls `proBowl`/`allPro` — it returns `proBowlScore`/`proBowlEligible` and `allProScore`/`allProEligible` for later comparison. New `resolveSeasonAllProAndProBowl(season, year)` (mirrors `resolveSeasonMVP`, called right alongside it in `generateSeason`): exactly 1 First-Team All-Pro + 1 Second-Team All-Pro are named league-wide (highest/second-highest `allProScore` among the player + every `career.leagueRivals`); Pro Bowl is the top-N scorers **per conference** by `proBowlScore`, where N is era-dependent (`proBowlSlotsForYear`): 2/conf through the 1980s (with a 3rd bonus slot per conference if a clearly-qualifying extra candidate exists, capping at 6 total), 3/conf from the 1990s on (fixed at 6 total). A First/Second-Team All-Pro who isn't already seated on the Pro Bowl roster gets added to it (matches the real-world convention that All-Pros are essentially always also Pro Bowlers). Award strings changed from the old generic `"All-Pro"` to `"First-Team All-Pro"`/`"Second-Team All-Pro"` — every consumer of the awards array (`buildAwardCeremonyHTML`, `buildLeagueTabHTML`'s `allProCount`, badge-gold-styling checks) was updated to match; the Admin Calc tab's "Pro Bowl Odds"/"All-Pro Odds" cards were relabeled "Pro Bowl Score"/"All-Pro Score" since there's no longer a real probability to show.
3. **Tab label text size increased.** `.dash-tab` font-size raised from `0.74rem` to `1rem` (the Round 2 arrow-pager's active-tab label, e.g. "AWARDS", was reported small/hard to read).
4. **New "sim-historical-best" badge**, distinct from Round 2's `MODERN_NFL_RECORDS` badge (which compares against real-world NFL records). New `collectAllSimSeasons()` (player's own `career.seasonLog` + every `career.leagueRivals` season ever logged, including retired rivals' history) + `checkSimHistoricalBest(season)`, checked against 4 metrics (pass yards, pass TD, passer rating, QB rush yards) for whether this season is the best **within this playthrough's own simulated league** — either "all-time so far" (beats everyone, every year, up to now) or "within this decade so far" (beats everyone within the same decade specifically); all-time takes priority since clearing it always also clears the decade bar. Rendered as a blue "◆ League Best" / "◆ Decade Best" pill (`.sim-best-badge`, distinct color from the gold `.record-badge`) next to the relevant stat-widget, same slots Round 2's NFL-record badge uses. **Bug caught during testing:** rival season objects (built in `simulateRivalSeasons`) never stamp a `.decade` field the way the player's own season object does — the first implementation filtered "within decade" by `s.decade`, which silently excluded every rival season from the comparison pool (decade-best degenerated into "best of the player's own seasons alone"). Fixed by deriving decade from `decadeForYear(s.year)` when `.decade` is absent.
5. **QOL playoff/conference naming**, entirely a display-layer addition — no internal round-label or conference-code string literal was touched (`"Wild Card"`/`"Divisional"`/`"Conference Championship"`/`"Super Bowl"` and `"AFC"`/`"NFC"` still drive every logic dispatch, bracket lookup, and `ROUND_DIFFICULTY_WEIGHTS` key exactly as before). New helpers: `confLabel(conf, year)` (returns `"AFL"`/`"NFL"` for year<1970, else the conf code unchanged), `toRoman(num)`, `superBowlDisplayName(year)` (`"Super Bowl " + toRoman(year-1965)` for year≥1966 — Super Bowl I was the 1966 season — else the non-canonical `"NFL-AFL Championship Game"`), `roundDisplayLabel(internalRound, year)` (wraps Super Bowl naming, and for `"Conference Championship"` pre-1970 renders `"AFL Championship"`/`"NFL Championship"` depending on the player's own conference that year). Wired into every render site that used to show the raw internal string: playoff round boxes (`playoffRoundBoxHtml`), the bracket SVG (`renderPlayoffBracketSVG`), the live round-finalize title swap, the Key Moment overlay eyebrow, the transaction-log line, and the Standings tab's conference headers/division names. **Pre-1966 ring exception** (the one behavior change, not just display): `finalizePlayoffOutcome` now branches on `season.year < 1966` — for those seasons, winning the **Conference Championship round** (the real, undisputed AFL or NFL title) grants the ring/award, regardless of how the fictional cross-league finale plays out afterward; the finale itself grants nothing pre-1966. From 1966 on, behavior is unchanged (only an actual Super Bowl win counts). New `playoffs.wonRing` (era-aware) and `playoffs.ringLabel` (`"Super Bowl Champion"` or `"AFL/NFL Champion"`) replace direct `wonSuperBowl` checks everywhere a ring/championship is displayed or counted (badge-gold styling now matches `/Champion$/` instead of the old exact-string check; trophy case; career table's "— Champs" column; the career-recap narrative's "the ring" paragraph) — `wonSuperBowl` itself is left alone since `confirmPlayoffRound` still needs it to mean specifically "won the simulated finale."

Testing note: the pre-existing `test_awards_d21.js` regression fixture hardcodes the old literal `"All-Pro"` award string in its synthetic rival/season data; after item 2's rename this makes its "All-Pro section lists 2" / "All-Pro count shown as 2" checks read `false` against the new build. Confirmed this is stale fixture data, not a regression, by patching the fixture to `"First-Team All-Pro"` and re-running — same assertions passed again. All other regression families (test4–9, decadefit, attrtab, ot_fix, sb_shield, teamquality, gradefor, retrospective, legendary_retro, season_progress, lastbuild, plus Round 2's `test_round_batch.js`) diffed clean against their Round 2 baseline output (only RNG-magnitude noise, no assertion flips).

### Round 2 — 8-item batch, all shipped
1. **Stat difficulty recalibrated.** Root cause: per-stat formulas (`effAcc`/`effYpa`/`effTd`/`effInt`) used narrow, concentrated attribute-weight subsets while `effOverall` used the broad, evenly-spread `OVERALL_WEIGHTS` — so a build could max a narrow subset and swing its stat delta close to the ceiling while its overall stayed "decent," producing 70-overall players with 4,000+ yard/40+ TD seasons. Fixed with two stacked dials in `generateSeason()` (and mirrored in `computeMetricBreakdown()` for the Admin Calc tab preview):
   - `STAT_BLEND = 0.18` — blends each narrow per-stat delta with the broad overall delta (mostly overall, a little narrow flavor). Balanced builds are unaffected (their narrow/broad deltas already agree); narrow specialists get tempered toward what their *actual* overall would produce.
   - `STAT_SENSITIVITY` — a second, independent compression on top: even after blending, a perfectly balanced but merely-decent build was still posting MVP-caliber (100+) ratings well before "good." This uniformly compresses the blended delta before it hits the `STAT_CAL` up/down coefficients. (Originally `0.5`; tightened to `0.32` in Round 4 — see above.)
   - Empirically calibrated via `/tmp/gtest/diag3.js`-style sweeps (flat 60/65/70/75/80/85/90/95 builds).
2. **Win probability now opponent-grade-aware for the regular season, and the regular season is visible.** New `pickRegularSeasonOpponents(n)` (division rivals home-and-home + rest of league, mirrors `buildScheduleResults`' existing shape — see Round 3 item 1 for the era-plausible rotation upgrade), and `simulateRegularSeasonGames(...)` (runs each game through the same `simulateGameScore` engine the playoffs already use, against that week's real opponent team grade, with mean-preserving per-game noise on the stat line; as of Round 4 the offensive grade fed in comes from `regularSeasonOffenseGrade`, not a flat edge). This replaces the old abstracted flat win%-roll that never referenced opponent identity. New **Schedule tab** (`buildScheduleTabHTML`) shows the week-by-week log: opponent, opponent grade, W/L score, and full per-game stat line (comp/att, yards, TD, INT, sacks, rush).
3. **MVP is winner-take-all, not independent per-player rolls.** `evaluateSeasonAwards` no longer rolls/awards "MVP" itself — it just returns `mvpScore`/`mvpEligible` (attempts>150, gamesPlayedShare>=0.5). New `resolveSeasonMVP(season, year)`, called once per season right after `simulateRivalSeasons`, compares every QB's `mvpScore` league-wide (player + every rival) and crowns whoever's highest — an exact tie produces genuine co-MVPs. `buildAwardCeremonyHTML` updated to show co-MVP heroes when there's more than one winner. (Round 2 left Pro Bowl/All-Pro as independent per-QB rolls — Round 3 item 2 above extended the same winner-take-all treatment to those.)
4. **Sacks stat added.** New `sackRate` formula (pocket presence + team o-line quality), tracked per-game in `simulateRegularSeasonGames`, summed to `season.sacks`, accumulated in `career.totals.sacks`. Surfaces in: the Season tab mini-stat-row, the Schedule tab, the career totals grid, and a "Sacks Taken" card in the Admin Calc tab. `generateGameBoxScore` (playoff box scores) also samples a `sacks` field now for consistency.
5. **Left/right arrow tab switcher** replaces the horizontally-scrolling `dash-tabs` row. Implementation: the individual `.dash-tab` buttons stay in the DOM (needed so `switchDashTab`, the scheme deep-link, and existing tests addressing a tab by `data-tab` keep working) but CSS now shows only the `.active` one, centered, flanked by `‹`/`›` arrow buttons (`#dashTabPrev`/`#dashTabNext`) that step through the same tab order.
6. **Modern-NFL-record badge.** New `MODERN_NFL_RECORDS` table (season pass yards/TD/rating/QB rush yards, career pass yards/TD — approximate, illustrative real figures, not a certified stat encyclopedia) + `checkSeasonRecords`/`checkCareerRecords`/`recordBadgeHtml`. A gold "★ NFL Record" pill badge appears next to any stat-widget or totals-grid tile that clears the real record, with a hover tooltip naming the record and the real holder. (Round 3 item 4 above added a second, differently-colored badge for the sim's own in-league bests.)
7. **Key & Peele "East/West College Bowl" easter egg.** `EASTER_EGG_NAMES` — curated list of ~68 names from all three sketches (real-player names the sketches hid among the fakes, like D'Brickashaw Ferguson and Fozzy Whittaker, and pure sound-effect/symbol non-names were deliberately excluded). `randomFullName()` now has a 4% chance of returning one instead of the normal generated First+Last.
8. **Architectural coherence fix** (the user's explicit ask): the regular season is no longer two disconnected systems (an abstract flat win%-roll for the player vs. `buildScheduleResults`' real opponent-identity sim for everyone else). Both now flow from the same real per-game engine.

Empirical calibration tooling (kept in `/tmp/gtest`, not persisted — recreate if a future round needs to re-tune `STAT_BLEND`/`STAT_SENSITIVITY`): `diag1.js`/`diag2.js` (single-build deep dive), `diag3.js` (flat-build sweep across overalls), `diag4.js` (record-breaking frequency check).

### Round 1 — 9-item punch list, all shipped
1. **Key Moments always frame as 4th quarter** — rewrote all 18 KEY_MOMENT_SITUATIONS entries for consistent Q4 framing.
2. **OT-after-decisive-win bug fixed** — `applyKeyMomentSwing` now re-derives whether OT is needed fresh from the post-swing Q4 total, instead of inheriting a stale pre-swing OT segment.
3. **"Won Super Bowl, got cut" bug fixed** — `finalizePlayoffOutcome` now grants `career._cutShieldSeasons = Math.max(..., 2)` on a Super Bowl (or, as of Round 3, era-appropriate ring) win, reusing the existing captain-shield mechanic.
4. **Team quality's playoff impact increased** — `playoffTeamEdge()` helper: team-strength weight raised from 0.15 to 0.32, plus a new Clutch-attribute playoff bonus. Opponent's team overall (and the player's own) now displayed on every playoff round box in the UI. (Superseded in Round 4 — see above; the additive-edge approach itself turned out to still under-weight team quality, replaced with a blend.)
5. **Build-quality descriptors recalibrated** — `gradeFor()` rewritten from 7 tiers to 12, properly centered on the game's stated 65 league-average baseline.
6. **Career retrospectives expanded** — fixed "banned"/"injury" forced exits incorrectly narrating as voluntary; added a "compiler's case" hedge note for thin Hall-of-Famer inductions; added a legendary/major life-event callout paragraph; added strong-finish vs. decline variants for genuine voluntary retirements.
7. **Local build profile ("player accounts") — shipped as browser-local, not true cross-device accounts.** Platform constraint: the Artifact platform has no viewer-identity/server-side-per-account storage capability. Shipped a localStorage-based last-build profile instead (`gridironlab.lastbuild` key, `loadLastBuildProfile`/`saveLastBuildProfile`/`renderLastBuildStrip`/`loadLastBuildIntoCombine`).
8. **End-of-season Award Ceremony added** — "Awards" tab on the season card (superseded by Round 2's winner-take-all MVP fix, then Round 3's fixed-slot Pro Bowl/All-Pro).
9. **End-of-season attribute progression showcase added** — "This Season's Development" strip at the top of the Attributes tab, sourced from `developAttributes()`'s `changed` list (`season.attrChanges`).

## Key architecture notes (for future rounds)
- `devVolatility(speed)` / career-arc swing block in `developAttributes()` (Round 4) — the boom/bust development system. `devVolatility` gives the per-season swing chance from the player's *current* `career.devSpeed`; when a swing fires, direction is a weighted coinflip (`breakoutProb`), a breakout boosts 3-5 attributes and raises `devSpeed` (max 2 lifetime, `career._breakoutCount`), a bust drops 2-4 attributes and lowers `devSpeed` (uncapped, self-limiting via the existing `maxGain = round(14*devSpeed)` formula in the normal drift loop above it). Sets `season.devArcEvent = {type, keys}`, consumed by `buildSeasonProgressHTML`'s new banner. `devSpeedTag(speed)` now covers `<0.45` ("Stalled Out") through `≥1.45` ("Breakout Star"), beyond the original 0.6-1.4 roll range, since devSpeed can now drift outside it. Any future change to base development math should preserve this: normal per-attribute drift (`curveVal*devSpeed*experienceFactor*orgMult*variance`) is untouched, the swing system is a layer on top that occasionally moves the `devSpeed` dial itself.
- `regularSeasonOffenseGrade(effOverall, age, decade)` / `playoffOffenseGrade(effOverall, season)` (Round 4) — the current team-quality + Clutch win-edge helpers, playoff and regular-season respectively. **Replace** the old `playoffTeamEdge(season)` / `regularSeasonTeamEdge(age, decade)`, which no longer exist — those returned a small additive nudge to add to `effOverall`; the new functions return the full blended offensive grade directly (don't add `effOverall` to their result, it's already folded in). Built on `blendOffenseWithTeam(effOverall, teamStrength, qbInfluence) = teamStrength + (effOverall-teamStrength)*qbInfluence`, with `QB_INFLUENCE_PLAYOFF = 0.35` / `QB_INFLUENCE_REGULAR = 0.45`.
- `simulateGameScore(offOverall, defOverall)` — shared quarter-by-quarter game engine, used by both playoffs and the regular season (`simulateRegularSeasonGames`). Takes the already-blended offensive grade (see above), not a raw `effOverall`.
- `rivalForTeam(teamId)` / `rivalEffTalent(rival)` / `opponentOffenseGrade(teamId, qbInfluence)` (Round 5) — the opponent-side counterpart to `regularSeasonOffenseGrade`/`playoffOffenseGrade`. `career.leagueRivals` already has one persistent starting QB per opposing team (generated at career start, aged/succeeded every season in `simulateRivalSeasons`); these three functions are what actually feed that into the win-calc, at all 4 sites `regularSeasonOffenseGrade`/`playoffOffenseGrade` are called at. Any future call site that resolves a game against a specific opponent team should call `opponentOffenseGrade(teamId, qbInfluence)` — never read `career.leagueStrength[teamId]` directly for a win-calc input, only for *display* of the team's own grade (kept as a separate `_defOverall`/`opponentGrade` field alongside the new `_oppQbName`/`_oppQbOverall`/`opponentQbName`/`opponentQbOverall` — team grade and QB grade are deliberately two different displayed numbers, don't collapse them back into one).
- `CONTENDER_DECLINE_THRESHOLD = 76` / `CONTENDER_DECLINE_RATE = 0.22` / `contenderDeclinePull(strength)` (Round 5) — every team above the threshold pulls back toward it every season, scaled by how far above; this is what stops a team from just sitting at the 97 cap forever once a positive nudge (a good rival QB season, the player's own skill nudge) pushes it there. `0.22` was reached by a pure-math trajectory sweep (no game code needed) after `0.05` proved far too weak — see the Round 5 log entry for the actual before/after trajectories. Do not lower this without re-running that sweep; it's tuned specifically so even a genuinely elite build takes ~7-8 seasons to plateau, not 2-3.
- `LEAGUE_NEWS_EVENTS` / `rollLeagueNews(year)` / `buildLeagueNewsFeedHTML()` / `career.leagueNewsLog` (Round 5) — league-wide narrative events for OTHER teams' grade changes (the `LeagueNewsFeed` ask), parallel to `ORG_EVENTS` which remains exclusively for the player's own team. Rendered in the League tab under "Around the League." Reuses the existing `.feed-wrap`/`.feed-line` CSS from the transaction log rather than new classes.
- `orgEventsFor()` (Round 5) — wraps `ORG_EVENTS`, filtering out `coachfired` whenever the just-completed season won a ring. Always call this instead of rolling `ORG_EVENTS` directly; there are two call sites (`lifeEventCheck`, `secondaryLifeEventCheck`), both already updated.
- `hofVerdict()`'s `TIERS[0].minRingsRoute` (Round 5) — First-Ballot Hall of Famer now has two independent accolade gates: the original `minProBowls:3`, or `minRingsRoute:3` (3+ rings alone also qualifies). Any future tier added to `TIERS` should decide deliberately whether it wants a `minRingsRoute` of its own rather than assuming only the Pro Bowl count gates it.
- `findRivalById(id)` / `openRivalProfile(rivalId)` / `buildRivalProfileHTML(rival)` / `rivalCareerFunFacts(rival)` (Round 5) — the rival QB profile page. `findRivalById` (unlike `rivalForTeam`) also matches retired rivals, since a profile opened from an old season's log should resolve to who actually played that game. Every place an opponent QB is generated/displayed carries a matching `...QbId`/`_oppQbId` field alongside name/overall specifically so this can look them up later. The single delegated `[data-rival-id]` click listener lives in the one-time Init block, NOT inside `renderSeasonCard` — `#careerContent` itself is never recreated between seasons (only its innerHTML), so attaching a fresh listener there every render would silently stack duplicates. Any future clickable element added inside a season card that needs the same "works in any tab, any season" behavior should follow this pattern, not add its own per-render listener.
- `career.oline` / `career.weapons` / `rollSupportingCastGrade(teamStrength)` / `castLetterGrade(value)` (Round 5) — the Supporting Cast system, 20-99 with their own independent noise against team strength (a good team can have a bad line). Reset at all 5 sites the player joins a new team (waiver sign, expansion draft, trade, granted trade request, FA sign); FA offers roll a preview once and store it ON the offer object (`o.oline`/`o.weapons`) so `signFreeAgentOffer` uses the exact value shown, never a fresh re-roll. `ORG_EVENTS` entries can carry a `target:"oline"`/`target:"weapons"` field (only `oline`/`starleaves` currently do) to route their `strengthDelta` at a specific supporting-cast stat instead of generic `career.teamStrength` — `renderOrgEvent` checks this before falling back to the team-wide default. Feeds `sackRate` (oline) and a small completion%/YPA nudge (weapons) in `generateSeason()`, mirrored in the Admin Calc preview per the `STAT_SENSITIVITY` sync convention below.
- `career.wearAndTear` / `career._hadInjuryThisSeason` (Round 5) — the wear-and-tear economy. Set almost entirely in two places: the wear-add itself in `resolveInjuryChoice` (bigger for `played=true`, i.e. "gut it out," than for sitting out), and the per-season baseline/recovery/breakdown-threshold check in `generateSeason()`, which reads `_hadInjuryThisSeason` (captured into a local BEFORE it's reset alongside `_injuryMissedGames`/`_injuryPenalty`, same pattern as those) to decide whether to apply recovery. `WEAR_BREAKDOWN_THRESHOLD=45` and its coefficients were reached via a pure-math trajectory sweep BEFORE writing any game code (see the Round 5 log entry) — retune with that same method, not by guessing, if this ever needs adjusting. Breakdown decay is scoped to `["ARM","REL","MOB","IMP"]` only — never `DUR`, matching the pre-existing "DUR is fixed for the career" invariant the rare `permanentHit` roll in the same function already respected. This is deliberately a SEPARATE mechanism from `permanentHit` (still present, unchanged) — `permanentHit` is a rare freak-injury flavor, wear-driven breakdown is the real, choice-driven accumulation system.
- `career.relationship` / `relationshipCheck()` / `renderRelationshipEvent(kind)` / `CELEBRITY_ARCHETYPES` (Round 5) — the relationship-arc state machine. `relationshipCheck()` is the ONLY place that reads/writes `career.relationship`'s status transitions; any future feature touching a player's personal life should go through it (or extend its `kind` branches) rather than mutating `career.relationship` directly elsewhere, so the arc's single/dating/married states stay consistent. Checked at the very top of `lifeEventCheck()`, ahead of the pre-existing rare/infraction/locker-room/positive/org chain. `LIFEPATH_EVENTS`/`lifepathCheck()` is the separate, stateless general-flavor pool — checked both there and in `secondaryLifeEventCheck()` (relationshipCheck deliberately is NOT, to keep relationship pacing from feeling soap-opera-fast). Both are pure reputation/popularity flavor — no attribute effects, unlike POSITIVE_EVENTS/ORG_EVENTS' `boosts`/`strengthDelta`.
- `STAT_SENSITIVITY = 0.32` (Round 4, was `0.5` from Round 2) / `STAT_BLEND = 0.18` (Round 2, unchanged) — the two stacked stat-production compression dials in `generateSeason()`, mirrored in `computeMetricBreakdown()` for the Admin Calc preview. Keep these two functions' values in sync if either is tuned again.
- `computeSeasonAwardRows(season)` — shared by `buildLeagueTabHTML` and `buildAwardCeremonyHTML`, one source of truth for "every QB's season this year."
- `resolveSeasonMVP(season, year)` / `resolveSeasonAllProAndProBowl(season, year)` — the league-wide award decision points, both called once per season from `generateSeason` right after `simulateRivalSeasons`. Same pattern: score+eligibility computed per-QB in `evaluateSeasonAwards`, compared league-wide once everyone's season is locked in.
- `confLabel(conf, year)` / `toRoman(num)` / `superBowlDisplayName(year)` / `roundDisplayLabel(internalRound, year)` — pure display-layer wrappers (Round 3). Internal literals (`"AFC"`/`"NFC"`, `"Wild Card"`/`"Divisional"`/`"Conference Championship"`/`"Super Bowl"`) are NEVER changed — only wrapped at render sites. Any future round touching playoff/conference naming must keep following this pattern rather than editing the internal strings directly, since `ROUND_DIFFICULTY_WEIGHTS`, `confirmPlayoffRound`'s dispatch, and multiple `isSB =` checks key off the exact literal values.
- `playoffs.wonRing` / `playoffs.ringLabel` (Round 3) — the era-aware "did this season earn a championship" flag/label, set once in `finalizePlayoffOutcome`. Prefer this over checking `wonSuperBowl` directly anywhere a ring/championship needs to be displayed or counted; `wonSuperBowl` itself still means specifically "won the simulated finale" and stays load-bearing for `confirmPlayoffRound`'s dispatch.
- `collectAllSimSeasons()` / `checkSimHistoricalBest(season)` (Round 3) — the in-playthrough "best this sim league has ever produced" comparison pool and check, distinct from the real-world `MODERN_NFL_RECORDS` check. Remember rival season objects don't carry a `.decade` field — always derive decade from `decadeForYear(year)` when working with the combined player+rival season pool, not `.decade` directly.
- `rotationPick(divs, cycleYear)` / `pickRegularSeasonOpponents(n)` (Round 3) — the era-plausible, year-keyed (not random) schedule-rotation helpers.
- `season.attrChanges` (field set by `developAttributes`) — this season's per-attribute deltas, consumed by `buildSeasonProgressHTML`. `season.devArcEvent` (Round 4) is the sibling field for a career-arc swing, consumed by the same function's new headline banner.
- `season.gameLog` — this season's real per-game log (opponent, opponent grade, result, full stat line), consumed by `buildScheduleTabHTML`.
- `career._bannedEventTitle` / `career._careerEndingInjuryName` — stashed at the moment a forced exit happens so retrospectives can name the actual cause.
- `career.lifeEventLog` entries carry a `legendary` flag (from `RARE_EVENTS`) for retrospective narrative selection.
- `loadLastBuildProfile()` / `saveLastBuildProfile(picks)` / `renderLastBuildStrip()` / `loadLastBuildIntoCombine()` — the local-profile system, storage key `gridironlab.lastbuild`.
- `TROPHY_ROOM_KEY` / `loadTrophyRoom()` / `saveTrophyRoomEntry(entry)` / `buildTrophyRoomTableHTML(sortKey)` / `TROPHY_ROOM_SORTERS` (Round 5) — the cross-career leaderboard, storage key `gridironlab.trophyroom`, separate from the single-slot `gridironlab.activeCareer`/best-career save. `saveTrophyRoomEntry` is called exactly once, from `finishCareer()`, and is the ONLY writer — any future career-ending path should go through `finishCareer()` rather than writing a trophy-room entry directly, so the cap/truncation logic (`TROPHY_ROOM_CAP=60`, oldest dropped first) stays centralized. Record highlighting (`.tr-record`) is deliberately computed via `maxOf(key)` over the FULL stored list every render, independent of `sortKey` — never derive "is this a record" from position in the current sort, since the current sort is rarely by the column being highlighted.
- `ACHIEVEMENTS` / `checkAchievements()` / `career.achievements` (Round 5, replaced the original tiered/equipped Playstyle Badges system — see the log entry for why) — 30 one-time, permanent achievements, each just `{key, name, icon, blurb, hint, check(){...}}`, no tiers, no equip slots. `checkAchievements()` is the ONLY writer of `career.achievements.unlocked`, and is idempotent (only ever flips an entry false→true) — safe to call from anywhere; currently called from `generateSeason()`, `finalizePlayoffOutcome()`, and `finishCareer()` so season-level, playoff-final, and career-ending-only conditions are all caught at the right moment. Any new achievement should be a pure `check()` function reading only `career`/`build`, no side effects. `achievementStatusFor(key)`/`achievementFrameHTML(def,unlocked)`/`badgeIconSVG(icon)` are shared by the Achievements tab and the Baseball Card back face — extend these, don't duplicate rendering logic at a new call site. `maxConsecutive(list,pred)` and `reachedTitleGameAndLost(s)` are the two reusable helpers behind every streak/title-game achievement — `reachedTitleGameAndLost` specifically needs its `!wonTitle(s)` guard to avoid misreading a pre-1966 season (ring already won via Conference Championship, then "loses" the meaningless fictional Super Bowl simulated afterward) as a title-game loss. `hadLifeEvent(achievementId)` (Round 5) is the third: a one-line `career.lifeEventLog.some(e=>e.achievementId===id)` scan powering every dark-humor achievement tied to a specific RARE_EVENTS/INFRACTION_EVENTS scandal — `resolveInfraction()` is the ONLY place that stamps `achievementId` onto a lifeEventLog entry (from `ev.achievementId`), so any future scandal event just needs that one field set to get a hookable achievement for free, no engine changes.
- `buildCardFaceSVG(entry, side)` / `openBaseballCard(entry)` / `exportBaseballCard(entry)` / `CARD_HEX` / `CARD_RARITY` (Round 5) — the Exportable Baseball Card. Takes a Trophy-Room-entry-SHAPED object, not `career` directly, so it works identically whether the source is `lastFinishedCareerEntry` (the career that just ended) or a historical row loaded back out of `loadTrophyRoom()` by id — never pass `career` in directly, build/extend the entry object instead. Every color inside a card face MUST be a literal hex from `CARD_HEX`, never a CSS `var(--...)` — the export path re-parses the SVG string in an isolated context that has no access to the page's custom properties, so a `var()` there would silently render as nothing. Any new field added to a card face should be read as `entry.field || fallback`, since real Trophy Room rows saved before this shipped (or any future round that forgets to set a new field) will be missing it — the "old entry" Playwright pass exists specifically to catch a future field added without a fallback.
