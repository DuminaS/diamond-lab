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

15. **Bug fix: a rival QB could retire with zero career games ever played, yet still show up as
    that season's real opposing starter in the schedule/playoffs (user-reported, with screenshots
    of a "Damon Winslow — 87 overall" schedule row whose own profile card read RETIRED / 0-0 / 0
    games / "retired after the 1987 season," his draft year).** Root cause: `generateLeagueRivals()`
    rolled `age: randInt(23,34)` and `retireAge: randInt(30,40)` completely independently — nothing
    stopped `age` (up to 34) from landing ABOVE `retireAge` (as low as 30) at the moment a rival was
    first created. `simulateRivalSeasons()` checks `r.age > r.retireAge` and immediately retires
    (replacing with a fresh rookie) BEFORE generating that year's season stat line — so a rival
    created already past his own retirement age would retire on the very first tick, with zero
    recorded games, while still having been the team's legitimate active starter (per
    `rivalForTeam()`, which only checks `!r.retired`, not games played) for every one of that
    season's games the player actually played against him. From the player's side this reads exactly
    like "a retired player is still being used in matchups," even though the mechanism is really
    "a rival's very first season doubled as his retirement, with no stats to show for it." Fixed by
    guaranteeing runway at creation: `retireAge: clamp(age + randInt(3,12), 30, 45)` instead of an
    unguarded independent roll — verified with a 200,000-roll pure-math sweep confirming zero
    immediate-retirement cases and a minimum 3-season runway. Same root cause would explain the
    identical symptom in playoff matchups (not just regular season), since `buildSuperBowlRound`/
    `resolveConferenceBracket` resolve the opponent through the exact same `rivalForTeam()`.
16. **Bug fix: the League tab's "Your Draft Class" table wasn't horizontally scrollable on mobile,
    cutting off columns (user-reported, screenshot from an actual phone).** The main passing-
    leaderboard table right above it was correctly wrapped in `<div class="table-wrap">` (which
    supplies `overflow-x:auto`), but the draft-class comparison table (`buildLeagueTabHTML`'s
    `classHtml` block) was missing that wrapper entirely, so on a narrow viewport its `width:100%`
    table just got visually clipped by its container instead of scrolling. Wrapped it in the same
    `.table-wrap` div. Verified via Playwright at a 390px mobile viewport: the table is confirmed
    wider than its wrapper (so a real scroll is actually needed, not a no-op fix), the wrapper now
    computes `overflow-x: auto`, and the page body itself stays within the viewport width (no
    page-level horizontal scroll was introduced as a side effect).

17. **Rivalry growth system: a per-rival score that builds from real division/playoff/draft-class
    history, a new toxic-vs-respectful event pool, and a "spicy" affair-scandal event with its own
    dark-humor achievement (explicit user ask, sequenced ahead of the separately-requested rival
    depth-chart/succession expansion, which is scoped as its own future round).** `career.rivalries
    = { [rivalId]: {score:0-100, meetings, playoffMeetings, lastYear} }`, keyed by the individual
    rival's own id (not the team) — deliberately, since a rivalry is between two PEOPLE: when a
    team's starter retires and is succeeded, that specific personal rivalry naturally stops
    accumulating and a fresh one starts at zero with whoever replaces him, the same way a real
    division rivalry resets when a franchise QB retires. `bumpRivalry(rival, {playoff, divisionRival,
    won, close})` is the only writer, called from `simulateRegularSeasonGames` (using
    `divisionOf(career.teamId, career.year).teams.includes(oppId)` for the division-rival flag) and
    from `confirmPlayoffRound` — NOT from the 3 playoff bracket-resolution functions that first
    compute a game's baseline result, since (per the existing architecture note on
    `confirmRoundAdvancement`) that baseline can still be overridden by a Key Moment swing before the
    round is actually final; `confirmPlayoffRound` is the one place every round type (Wild Card
    through Super Bowl) reports `round.won` after that swing has already applied, and it's a single
    hook point instead of three. Increment formula: `playoff?14:(divisionRival?3:1)`, `+2` if the
    rival is a draft classmate (`isRival`), `+3` for a close game (≤3 points), `+2` for a loss (losing
    to the same guy stings more than beating him) — no decay for anyone; a one-off cross-conference
    opponent only ever gets +1 and the schedule rotation means it rarely repeats, so it never
    meaningfully develops on its own. Diagnostically swept (pure-math, 200 trials × 20 years per
    scenario) before committing: a division rival reaches the event-eligible threshold (40) around
    year 4-5 and a toxic-leaning threshold (65+) around year 5-7, faster for a draft classmate (year
    3.3 / 5.1); a random cross-conference opponent averages a final score of 11 over 20 years and
    never crosses 40. Confirmed against REAL gameplay data (not just the sweep) via Playwright: a
    genuine division rival reached score 43 after exactly 4 real seasons (8 meetings, the correct
    home-and-home count) — matching the diagnostic prediction closely.

    `topActiveRivalry(minScore)` picks the single most-developed rivalry whose rival hasn't since
    retired (a high-score rivalry with a now-retired rival is treated as over — no new candidate).
    New `RIVALRY_EVENTS` pool (10 entries, `tone:"toxic"` or `"respect"`) fires via
    `rivalryEventCheck()` (checked in both `lifeEventCheck()` and `secondaryLifeEventCheck()`, same
    as `lifepathCheck`) — only eligible once a rivalry hits score 40, and which tone is more likely
    scales with how hot it is (`toxicChance = clamp(0.3 + (score-40)*0.01, 0.3, 0.8)`); a toxic event
    escalates the score further (+6), a respectful one cools it slightly (-4), so the story and the
    number stay in sync in both directions. Pure narrative/reputation flavor, same convention as
    `LIFEPATH_EVENTS` — no attribute effects.

    The requested "spicy" event: `rivalryAffairCheck()` needs BOTH an existing relationship AND a
    genuinely toxic (score≥60) active rivalry to even be eligible (checked only in the primary chain,
    right after `relationshipCheck()`, at a low 3% roll) — `renderRivalryAffairEvent()` ends the
    relationship outright (same mechanic as a messy breakup), applies a reputation hit but a bigger
    popularity gain (drama sells, same convention already used for messy breakups), and escalates
    that specific rivalry by +30. Logs `achievementId:"two_time_loser"` via the same `hadLifeEvent()`
    hook the dark-humor scandal achievements use, powering the new **Two-Time Loser** achievement
    ("Lost to the same guy twice — once on the scoreboard, once at home") — roster is now 39.
    `RIVALRY_EVENTS` was also added to the Admin panel's force-fire pools (`kind:"rivalry"`, dispatches
    to `renderRivalryEvent` using `topActiveRivalry(0)` or any active rival as a fallback subject) for
    the same reason the dark-humor achievements got the same treatment — a 3%-or-lower real trigger
    chance isn't a practical target for deterministic testing otherwise. The rival profile overlay
    (`buildRivalProfileHTML`) now shows a `fanMeterRow`-based "Rivalry" meter with a level label
    (Building / Developing Rivalry / Heated Rivalry / Blood Feud) whenever a rivalry record exists.

    Verified via Playwright against real gameplay (not just diagnostics): after 4 real seasons, at
    least one rivalry record exists with a real score and meeting count; the top rival's own profile
    page (opened via its real `data-rival-id` link from the League tab, not a synthetic path) shows
    the new Rivalry meter; force-firing a rivalry event via the Admin panel renders its real title and
    Continue button. `renderRivalryAffairEvent` itself was NOT live-triggered end-to-end — its 3%
    trigger sits behind `relationshipCheck()`'s own unrelated 14% gate in the same tick, and the two
    checks' RNG thresholds can't both be satisfied by a single forced `Math.random()` value (one needs
    "roll high enough to skip," the other "roll low enough to fire"), so a naive full-override mock
    doesn't work without a fragile call-sequence-dependent one. Verified instead by seeding a real
    `achievementId:"two_time_loser"` lifeEventLog entry onto an active career save and confirming
    Two-Time Loser correctly unlocks after a season advance (proving the achievement half works via
    the exact same proven mechanism as the other dark-humor achievements), plus direct code review
    confirming `renderRivalryAffairEvent`'s structure is otherwise identical to the already
    live-tested `renderRelationshipEvent`/`renderRivalryEvent` it's built on. Zero page errors across
    all passes.

Verified end-to-end via Playwright (not just diagnostics) across a real 8-season playthrough: zero
page errors, opponent QB correctly shown every season in the Schedule tab, League News feed
populated (23 entries by season 8), team-strength spread stayed realistic (range of 75 points across
the league, bounds respected). Screenshotted the Schedule and League tabs to confirm the rendering
matches the data (a 62-grade team fielding a 49-overall rival QB; a 34-grade team's 41-overall QB;
etc. — genuine, visible mismatches between team grade and QB grade, not just a relabeled team number).

**Deliberately not started yet**: the user also asked for a rival QB depth-chart/succession
expansion (QB1/2/3 per team, including the player's own team when a backup; underperforming/
expensive starters getting benched or replaced via draft/FA mid-career, not just at forced
retirement) at the same time as the rivalry-growth system above. Explicitly sequenced as its own
future round (user confirmed) since it's a much deeper architectural change — it touches contract
logic, the draft, and free agency, and needs new UI, versus rivalry growth which mostly reused
existing event-pool/achievement scaffolding. Not forgotten — just not yet scoped or started.

### Round 6 — rival QB depth chart, contracts, and succession (opponent side)
User gave the go-ahead to start the deferred depth-chart/succession expansion, then answered three scoping questions toward the ambitious end: real benching should be possible for the player (not just informational), bench players should get FULL season-stat simulation (not a lightweight stand-in), and rival contracts should be real economics (apy/years/tier), not a simple proxy. Given the size, split into two phases: this round is the opponent/league side (depth charts, contracts, AI succession) — the player's own bench mechanic (draft-time incumbent check, a real "clipboard" season, winning the job) is scoped as Round 7, not yet started.

1. **Full contract economics for every rival QB (shipped).** `rollRivalContract(decade, talent)` mirrors the player's own contract math exactly — `veteranAPY(decade, performanceTier(talent))` scaled by a `0.85-1.15` roll, with `years` scaled by tier (elite 4-6, good 3-5, average 2-4, backup/minimum 1-3) — so a rival's deal reads on the same real-money scale as the player's, not an invented parallel number. `rollEntrenchedYears(talent)` is the "stuck on a big contract" proxy the user asked for verbatim: a fresh starter gets 2-8 years of guaranteed job security scaled by talent (elite 5-8, good/average 3-6, replacement-level 2-4) during which a team won't bench or replace him no matter how good a backup looks, UNLESS he's genuinely declined (see item 3). Every rival (both starters and bench players) now carries `contract`/`entrenchedYears` fields.

2. **A real 3-deep depth chart per team, every backup fully simulated (shipped).** `career.leagueDepthCharts[teamId] = {qb2, qb3}` — a brand-new, SEPARATE structure from `career.leagueRivals` (deliberately: research before writing any code turned up ~15 existing read-sites — MVP/Pro-Bowl pooling, the team-grade drift loop, the classmates table, `teamNeedRank`, etc. — that all assume "one `leagueRivals` entry = one team's current starter"; folding bench players into that array would have silently double- or triple-counted them into awards voting and team-grade math). `generateBenchPlayer(teamId, decade, year, teamGrade, isProspect)` creates either a veteran journeyman backup (older, clearly below the starter's grade) or a young rookie-contract prospect (wide variance, sometimes a real future-successor-caliber arm) — QB2 skews 70% veteran/30% prospect, QB3 skews the other way (65% prospect) matching how real depth charts usually shake out. `simulatePlayerSeasonStats(entity, decade, league, year)` is the per-player math extracted out of the old `simulateRivalSeasons` (verbatim, no formula changes) so both starters AND bench players run through the exact same season-stat pipeline every year via the new `simulateDepthChartSeasons()` — bench stats are real (age, decline, injuries, a full season line) but never enter the league-wide awards pool, same isolation the separate-array decision above already guarantees.

3. **AI succession: stay, internal promotion, external signing, or a developmental draft pick (shipped, recalibrated after an initial miscalibration — see below).** `evaluateSuccession(teamId, decade, year)` runs once per team per season (right after that team's starter and bench both have the year's stats in hand): decrements `contract.years`/`entrenchedYears`; if the starter is still entrenched AND hasn't genuinely fallen off (`rivalEffTalent(rival) <= rival.talent-15`), he simply stays — full stop, exactly the user's own "stuck on a big contract, they will stay" framing, with no bypass for merely being old. Once eligible, a 22% roll checks internal promotion (only if QB2 actually grades out within 5 points of the incumbent — a real "they groomed a real replacement" bar, not an automatic bench job), else a 15% roll checks an external veteran signing, else the incumbent **signs a fresh extension** (a brand-new contract/entrenchment roll) and is protected again for years. Independently of all that, a small 4%/team/season roll can also see a team "draft a QB to develop" (replaces QB3 with a fresh prospect, no pressure on the current starter) — covering the user's explicit "maybe they will draft another QB to replace them" even outside an active succession situation. Every actual succession (not the internal "he re-signed and nothing changed" case) pushes a real news entry into the EXISTING `career.leagueNewsLog`/"Around the League" feed (`buildLeagueNewsFeedHTML`) rather than inventing a parallel feed UI.

   **Miscalibration caught before shipping, via the project's own diagnostic-sweep convention.** A first pass (independent age/talent-based "declined" bypass alongside entrenchment, 50%/35% succession-branch odds, and — the real bug — a SURVIVING starter left with `entrenchedYears`/`contract.years` stuck at 0, making him immediately re-eligible again every subsequent season forever) produced 68 succession events across 30 teams in just 11 real seasons in an actual Playwright playthrough — visibly excessive churn, caught by the same test written to verify the feature worked at all. Rather than guess at new numbers, built a 30-team/15-year pure-math sweep (`succession_sweep2.mjs`-style, matching this project's standing diagnostic-before-dial norm) that isolated the real structural bug (no re-entrenchment on survival) and confirmed the fix: at the shipped 22%/15% odds with re-signing-on-survival restored, elite starters average 0.41 successions per 15 years (most never turn over) vs. 0.84 for a replacement-level starter (real, if infrequent, churn) — roughly 20 league-wide events per 15 years instead of 68 in 11. Re-verified against real gameplay afterward, not just the sweep.

4. **UI: contract + depth chart visible on the existing Rival Profile card (shipped).** No new screen — extended `buildRivalProfileHTML` with a contract line (`fmtMoney(apy)`/yr, years left, tier, an "expiring" tag once entrenchment runs out) and a compact "Depth Chart" section listing QB2/QB3 (name, overall, age, contract tier), both hidden for a retired rival (nothing current to show).

Verified via Playwright against real gameplay across 8-12 real seasons (not just diagnostics): depth charts exist for every non-player team immediately after the draft, with real contract objects on both starters and bench players; playing through many seasons produces real succession/depth-chart news entries in the existing League News feed; opening a rival's profile from the League tab shows both the new Contract line and Depth Chart section. Zero page errors across all passes, including the recalibration re-test.

### Round 7 — the player's own bench mechanic (Phase 2 of the depth-chart expansion)
Phase 2 of Round 6's depth-chart work: the player can now actually be drafted behind an entrenched incumbent and has to win the starting job, rather than always starting Day 1 regardless of draft slot or team situation.

1. **Draft night can now block the player behind a real, fully-simulated incumbent (shipped).** Right after `career.leagueRivals = generateLeagueRivals()` in the `enterDraftNightBtn` handler, `rollDraftIncumbent(teamId, decade, year, teamGrade)` rolls a plausible established veteran (age 26-34, talent skewed a bit above team grade — a guy entrenched enough to sit a draft pick is probably legitimately good). He clears the "entrenched" bar (talent≥72, or ≥80 for a true 1st-round pick — only a truly elite incumbent blocks a premium pick — and age≤32) roughly a third of the time given the talent-roll distribution; if he does, he's pushed into `career.leagueRivals` as the team's real QB1, `career.isBackup=true`, and the player starts the "clipboard" side of the depth chart instead. The player's own team also gets a full `leagueDepthCharts` entry (QB2/QB3) regardless of backup status, satisfying "player sees their own depth chart too" — but those bench slots are purely informational/flavor and never autonomously threaten the player's job (see item 3).

2. **A bench season reuses the EXISTING missed-games pipeline instead of a parallel implementation (shipped).** The key design insight: `generateSeason()` already has a fully general `gamesPlayed = clamp(league.games - missedGames, 0, league.games)` formula (built for injury/suspension), and that formula already degrades gracefully all the way to a true 0-game, all-zero-stats season when `missedGames` reaches `league.games` — no separate "clipboard year" code path was needed. `resolveBackupSeasonSnaps(decade, league)` runs at the very top of `generateSeason()` when `career.isBackup`: it simulates the incumbent's own real season via the same `simulatePlayerSeasonStats` helper Round 6 built, then sets `career._backupMissedGames = <games the incumbent played>` — a direct, single-source-of-truth pass-through (no separate "coach benches for poor play" roll layered on top, avoiding double-accounting) — which flows into the missed-games total exactly like an injury or suspension would. A new `missedGamesBackup` field (alongside the existing `missedGamesInjury`/`missedGamesSuspension`) keeps the narrative distinguishable, and `incumbentName`/`incumbentSeasonSnapshot` are carried onto the season object so the card can show what the guy ahead of you actually did. Team record while benched uses the incumbent's REAL simulated wins/losses for those specific games (not the generic backup-win-probability roll injury/suspension already use), since his season is fully known, not just a probability.

3. **Winning the job: a real, escalating competition, never a permanent bench sentence (shipped).** `resolveBackupCompetition(effOverall)` runs once per season the player is still a backup: odds scale with the player's own grade vs. the incumbent's CURRENT age-adjusted talent (`rivalEffTalent`, not his talent at draft time — a declining incumbent gets genuinely easier to unseat over the years), and a forced resolution after 3 bench seasons guarantees no career gets stuck indefinitely. If the incumbent has since retired or is otherwise gone (he ages/retires via the ordinary `simulateRivalSeasons` mechanism, same as any rival — deliberately NOT excluded from that, only from `evaluateSuccession`, which the player's own team is excluded from so there's no invisible AI-driven benching happening behind the scenes) the player wins the job immediately, with real games that season, rather than getting stuck facing a rival who no longer exists.

4. **UI: a Depth Chart row on the front-office widget, and bench-specific season-card narrative (shipped).** `buildDepthChartRowHTML()` shows QB1 (the incumbent's name/overall while backup, or "You"), the informational QB2/QB3, and a "you're competing for the starting job" note while backup. The season card narrates a true clipboard year distinctly from a partial-takeover season (games/incumbent stat line shown either way) and calls out "Wins the starting job" / "Still fighting for the starting job" at the point the competition actually resolves each year.

Verified via Playwright with a real career (not just diagnostics): confirmed the player's own team always gets a depth chart regardless of backup outcome; forced a deterministic elite-incumbent scenario (talent 85, 5-year deal) and confirmed a genuine 0-game clipboard season with the incumbent's real stat line recorded, correct season-card narrative, and the front-office widget's Depth Chart row naming him; forced the 3-season cap and confirmed the player wins the job with real games that season and the correct narrative; separately forced an ALREADY-RETIRED incumbent and confirmed the player wins the job immediately with a normal full season, rather than staying stuck competing against a ghost. Zero page errors across all passes.

### Round 8 — QOL: the season-stat "number ticker" animation
First of three requested QOL items this round (the other two — a "Simulate to Free Agency" fast-forward button, and a dedicated Team tab with new impactful grades — are separate, larger pieces of work tracked further down/next).

**Shipped.** The season card's four headline stats (Pass Yards, Touchdowns, Interceptions, Passer Rating) now tick up from 0 to their final value over 1.5 seconds with an ease-out curve, instead of snapping straight to the final number, but ONLY on a genuine "advance to next season" click (`playSeasonAndRender()` now calls `renderSeasonCard(season, true)`) — resuming an in-progress career via `resumeActiveCareer()` re-renders the same already-seen season with `animate` omitted (falsy), so reopening a save never re-plays the animation on numbers the player has already seen. Respects `prefers-reduced-motion: reduce` (jumps straight to the final value, same convention as the card-flip/fill-pop animations from earlier rounds). Each stat value is wrapped in its own `<span class="sw-num" data-final="..." data-kind="int|decimal1">` so the ticker only touches the number itself, not the record/sim-best badges that can sit right next to it in the same `.sw-value` container.

Verified via Playwright with real motion enabled (the test harness's usual `reducedMotion:"reduce"` context would have made the ticker skip itself, so this one deliberately used a plain context): sampled the yards value early, mid-animation, and after settling — confirmed it's genuinely a different, in-between number partway through (not an instant snap), and lands exactly on the real final value once the animation completes; confirmed the same for TD/INT/rating; confirmed resuming the same career shows the final numbers immediately with no re-animation. Zero page errors.

### Round 9 — QOL: a dedicated Team tab, with 3 new grades that actually do something
Second of three requested QOL items (the third — a "Simulate to Free Agency" fast-forward button — is tracked separately, not yet started this round).

1. **Three brand-new team-quality grades (Defense, Coaching, Front Office/GM), rolled and carried exactly like the existing `oline`/`weapons` (shipped).** `career.defense`/`career.coaching`/`career.gmGrade` (all 20-99, independently noisy against team grade via the same `rollSupportingCastGrade`) now get rolled at every one of the 6 sites `oline`/`weapons` already were: initial draft, waived-and-resigned, expansion draft, trade, granted trade request, and the free-agent-offer preview/sign flow (`buildFreeAgentOffers`/`signFreeAgentOffer`) — found and fixed one copy-paste gap where the plain "Trade" event (as opposed to the "granted trade request" one) had been missed on the first pass, caught by grepping for the total count of new-field assignments rather than trusting the first edit. `gmGrade` is deliberately a SEPARATE field from the pre-existing `career.gmRelationship` — the former is front-office COMPETENCE (a team-quality dial), the latter is how much the GM personally likes the player (a relationship dial) — conflating them would have made a beloved player on an incompetently-run team read as "the GM situation is great," which isn't the same thing.

2. **Each new grade has a real, direct mechanical effect — not flavor text (shipped).**
   - **Defense** blends into `simulateGameScore` — an optional third parameter (`myDefense`, defaults to `undefined` so the rival-vs-rival math elsewhere that has no such concept is untouched) that determines how many points OPPONENTS score, independent of the player's own offensive grade: `oppFacingGrade = offOverall*0.8 + myDefense*0.2`. Diagnostically swept before shipping (see the recalibration note below).
   - **Coaching** feeds `developAttributes()` as a new `coachingMult` multiplier (0.85-1.15, stacking with the existing org-stability/turmoil multiplier) on the per-season attribute growth formula — a strong staff genuinely develops talent faster, every season, not just the one year an `ORG_EVENT` fires.
   - **Front Office (GM competence)** does two things: nudges every free-agent contract offer (`homeGmSkillMult` on the re-sign offer, `awayGmMult` — with its own independent roll per team — on every other team's offer) SEPARATELY from the existing relationship-based `gmMult`; and reduces (or, if bad, worsens) roster-cut risk in `waiverCheck()` via a new `gmSkillRelief` term alongside the pre-existing relationship-based `gmRelief`.

   **Miscalibration caught and fixed before shipping (Defense).** A first pass blended Defense at 65% weight (`offOverall*0.35 + myDefense*0.65`) — a pure-math sweep (mirroring this project's standing diagnostic-before-dial norm) showed this produced a 51-POINT win-rate swing for a mediocre QB between a 20-grade and a 99-grade defense, LARGER than the QB's own full skill-range swing from Round 4's `QB_INFLUENCE` calibration (~31 points) — meaning the new grade would have overshadowed the core "you're playing as the QB" mechanic the whole game is built around. Swept weights from 0.65 down to 0.12 and landed on 0.2: the same swing is ~14 points at that weight — a real, felt effect (a great defense meaningfully helps, a bad one meaningfully hurts) that stays clearly secondary to the player's own play, confirmed across mediocre/elite/bad-offense scenarios before committing.

3. **A new "Team" tab consolidates all of it in one place (shipped).** `buildTeamTabHTML()` — a card per grade (letter grade via the existing `castLetterGrade`, the raw number, and a plain-language note on the grade's REAL mechanical effect, not flavor) plus a Depth Chart table (QB1/QB2/QB3 — reusing the exact same `rivalEffTalent`/contract-tier fields the Rival Profile card and front-office widget already use, so there's one source of truth for "what does this team's depth chart look like," not three separate implementations) and a link-out note to the existing Scheme tab. Left the Season tab's front-office widget (GM relations/fan support/wear-and-tear — personal-standing stats, not team-quality ones) untouched rather than duplicating it here; the split is "Season tab = how are things going for ME, Team tab = what does my team actually look like."

Verified via Playwright against real gameplay: confirmed all 5 grade fields exist as real 20-99 numbers immediately after the draft; opened the new Team tab and confirmed all 5 grade cards render with the exact same numeric values as the underlying `career` fields (not stale or mismatched); confirmed the Depth Chart section shows QB1/QB2/QB3; played 3 more real seasons with the new `simulateGameScore` third parameter wired into every real game (regular season and playoffs) with zero page errors; separately forced a real free-agency scenario, signed a new offer, and confirmed the new grades correctly carried over from the signed offer onto `career` (not left `undefined`).

### Round 10 — QOL: Steam-style achievement toast, and scroll-to-top on advance
Two more small QOL asks, both shipped.

1. **A Steam-style "Achievement Unlocked" toast.** `checkAchievements()` now tracks which achievements it actually flipped from locked to unlocked THIS call (previously it just silently set the flag with no signal to the UI) and hands that list to `queueAchievementToasts(defs)`. Toasts render bottom-right, non-interactive (`pointer-events:none` on the container, matching the real Steam overlay's behavior — it's a notification, not something to click), slide in, sit for ~3.5s (2.2s under `prefers-reduced-motion`), then slide out and remove themselves. Multiple achievements unlocking in the same tick (e.g., a season that happens to complete 2-3 at once) queue and show ONE AT A TIME rather than stacking — `showNextAchievementToast()` is a simple shift-off-the-queue-and-recurse loop, called again from its own dismiss timeout. Reuses `badgeIconSVG(def.icon)` directly for the toast's icon (same gold-frame treatment as the Achievements tab and Baseball Card), so there's no second icon-rendering implementation to keep in sync.
2. **Scroll-to-top on "next season."** `nextSeason()` (the function both "Play another season" and "Continue career" buttons call) now starts with `window.scrollTo(0, 0)` — whatever renders next, whether that's a fresh season card or an interstitial life event, the player now always starts at the top of the page instead of wherever they'd scrolled to reading the previous season's tabs.

Verified via Playwright with real motion enabled: confirmed scrolling down, clicking to advance, and immediately reading `window.scrollY` back at exactly 0; seeded a lifeEventLog entry satisfying an achievement's `check()` without it being marked unlocked yet, advanced the season (polling across a few clicks, since an unrelated interstitial can legitimately land between the click and the actual `generateSeason()`/`checkAchievements()` call), and confirmed the achievement flips to unlocked in career state; separately watched a toast appear live with the correct "Achievement Unlocked" + real achievement name text and its `show` class applied, then confirmed it fully removes itself from the DOM well after its dwell time. Zero page errors.

### Round 11 — bug fix: NaN pass yards/sacks that persisted for multiple seasons after a scandal + re-sign

User report: after surviving a "Bounty Program Scandal" (a `career-multi` severity infraction — suspended, contract voided, released), signing with a new team afterward left PASS YARDS, PASSER RATING, and SACKS TAKEN showing literal `NaN` — and it stayed broken "for about 3 years," while TDs/INTs/games stayed correct the whole time.

**Root cause, in two parts:**
1. **Proximate:** the `comp`/`ypa`/`sackRate` formulas in `generateSeason()` (and its exact duplicate in the Admin Calc preview function) read `career.weapons`/`career.oline` with no fallback at all — unlike the newer Round 9 grade fields (`defense`/`coaching`/`gmGrade`), which all use `?? 60`. `tdRate`/`intRate` never reference weapons/oline, which is exactly why those two stayed correct while comp/yards/sacks didn't.
2. **Why it never recovered on its own, and why `?? 60` guards elsewhere didn't save it:** a handful of team-reassignment sites (`renderWaivedEvent`'s sign handler, the plain trade path, the granted-trade-request path, and `signFreeAgentOffer`'s away-team branch — precisely the paths a post-suspension free-agency signing goes through) did `career.teamStrength = career.leagueStrength[teamId]` with **no fallback at all**. If that lookup ever came back `undefined` for any reason, `career.teamStrength` became `undefined`, then `NaN` once arithmetic touched it. From there, `career.oline`/`career.weapons`/`career.teamStrength` all drift every season via `career.X = clamp(career.X + delta, ...)` — and `NaN + anything` is always `NaN`, so once poisoned, these fields never self-corrected. Critically, `??` (used everywhere else in the codebase as the "safe" pattern) does **not** catch this: `NaN ?? 60` evaluates to `NaN`, not `60`, since `??` only replaces `null`/`undefined`. That's why the bug outlived every other `?? 60` guard already in place and persisted across seasons instead of clearing on the next team-strength read.

**Fix:** added a real `safeNum(v, fallback)` helper (`typeof v==="number" && !isNaN(v)`, unlike `??`) and used it in every place a NaN could either enter or persist:
- `rollSupportingCastGrade` now clamps its input through `safeNum` — one fix here covers every one of its 6+ call sites at once.
- The 4 previously-unguarded `career.teamStrength = career.leagueStrength[teamId]` assignments (waived-sign, trade, granted-trade-request, FA-sign) now use `safeNum(..., 60)` and write the repaired value back into `career.leagueStrength[teamId]`, so a bad lookup can't recur for that team either.
- The annual drift lines (`career.teamStrength`/`career.oline`/`career.weapons` each season, plus the O-line injury-risk term) now read through `safeNum` before adding their delta — this is the actual self-healing fix: even a save that's *already* corrupted repairs itself on its very next season instead of needing another trade to accidentally re-roll a valid number.
- The `comp`/`ypa`/`sackRate` formulas (both the real one and the Admin Calc preview duplicate) read `career.weapons`/`career.oline` through `safeNum` too, as a last line of defense.

Verified with a Playwright test that seeds a save with `career.oline`/`weapons`/`teamStrength` corrupted (localStorage round-trips `NaN` as `null`, which exercises the same "not a real number" path), advances one season, and confirms: all three career fields come back as real numbers, the new season's `yards`/`sacks`/`comp` are real numbers, and the rendered season card contains no literal `"NaN"` text anywhere. All existing regression suites (FA-offer grades, achievement toast/scroll-to-top) still pass unchanged. Zero page errors.

### Round 12 — 3 more bug fixes: Trophy Room crash, phantom future-team QBs, expansion-draft standings

Three more user reports, all fixed and Playwright-verified.

**1. Trophy Room wouldn't open at all.** `buildTrophyRoomTableHTML()`'s `cell()` helper called `fmt(value)` (`v.toLocaleString()`, `v.toFixed(1)`) directly on saved fields with no NaN/null guard. A career saved to the room while its own stats were `NaN` (e.g. the exact Round 11 bug, before that fix existed) round-trips through `localStorage` as `null` (JSON has no NaN), and `null.toLocaleString()`/`null.toFixed()` throw — inside `renderTrophyRoomScreen()`, which runs BEFORE `showScreen("trophyroom")` in the button's click handler, so the screen never appeared at all. One already-corrupted entry from before Round 11 shipped was enough to permanently block the room. Fixed by routing `cell()`'s value and `maxOf()`'s reduction through `safeNum(...,0)` — any already-corrupted entry now just renders as 0 in that column instead of crashing the whole screen.

**2. Rival QBs existed (and won awards) for teams that hadn't joined the league yet.** `generateLeagueRivals()` (draft night) built one rival for every team in `TEAMS` with no `t.start<=year` filter at all — so a 1960s-decade career would immediately get a fully-simulated "starter" for the Seattle Seahawks and Tampa Bay Buccaneers (real-world 1976 expansion teams), 11 years before either existed, and `simulateRivalSeasons` kept generating full stats/awards for them every season regardless. This is exactly what let a not-yet-founded team's QB show up on the league leaderboard and win a Pro Bowl. Fixed by filtering `generateLeagueRivals()` to `t.start<=career.year` (only teams that already exist get a rival at draft night) and adding `spawnNewFranchiseRivals(year)`, called once per season right before `simulateRivalSeasons`, which lazily spawns a rival (+ depth chart) for any team whose `t.start` exactly equals the current year — the same season a real expansion franchise would actually be joining.

   **Follow-up #1, same day:** the user reported it was STILL happening after this fix shipped. Root cause of the miss: the fix above only changes what a NEWLY-generated career does at draft night — it can't retroactively clean an ALREADY-in-progress save whose `leagueRivals` was already populated with all 32 teams (including future ones) back when that specific career started, before this fix existed. `spawnNewFranchiseRivals` only ever ADDED a missing team's rival; it never REMOVED an already-existing phantom one. Fixed with the same "repair going forward" self-heal pattern as Round 11's `safeNum`: `spawnNewFranchiseRivals` now also walks every active rival each season and retires any whose team's `t.start` is still after the current year, before spawning anything — so an existing corrupted save heals itself the very next season instead of needing a new career. `simulateDepthChartSeasons` got the matching guard (skip a team whose `t.start>year` rather than aging/simulating its bench players). Verified by seeding a save with phantom rivals for SEA/TB/BAL directly (reproducing an old, pre-fix save exactly), confirming they're all retired and the League tab leaderboard is clean after one season advance.

   **Follow-up #2, same day:** user pushback (correct) on follow-up #1 — "the fix shouldn't be when we advance a season, it should just not be a visible issue in the first place." The self-heal only runs at the START of generating a NEW season, so a save that's ALREADY corrupted still shows the bad data for whatever season is CURRENTLY on screen until the player advances once — for an already-recorded historical season, that stale display is permanent (the self-heal can't rewrite a season already simulated, only stop future ones from repeating it). Fixed properly by moving the guarantee to the actual DISPLAY boundary instead of relying on write-time cleanup: `computeSeasonAwardRows()` — the single function every leaderboard/award-ceremony view reads from — now skips any rival whose team's `t.start` is after `season.year` right where it builds each row, independent of whatever `career.leagueRivals`/`.seasons` currently contains. This makes "a team that doesn't exist yet is never visible" an invariant of the RENDER path itself, not something that depends on when a save happened to get corrupted or whether a self-heal has caught up — verified by seeding a phantom rival with an ALREADY-baked season entry for the CURRENT season (no advance at all) and confirming it's absent from the leaderboard the instant the tab is opened.

**3. A related, second cause of the same symptom: switching teams never displaced the AI rival already there.** `career.leagueRivals` is supposed to mean "one starter per team, with the player filling their own team's slot" — but none of the 5 places the player can change teams (waiver re-sign, trade, granted trade request, expansion draft, free-agent sign) ever touched `leagueRivals`. So the AI rival who already occupied the team the player just JOINED kept right on generating a full starter's stats and awards for that same team — this is the literal "another Miami Dolphins QB got a Pro Bowl over me, and I was playing every game" report. Meanwhile the team the player just LEFT was silently left with no starter at all. Fixed with a new `reassignRivalsForTeamChange(oldTeamId, newTeamId)`, called at all 5 team-change sites right before `career.teamId` is reassigned: retires whichever active rival currently occupies `newTeamId` (the player now IS that team's starter), and spawns a fresh rival for `oldTeamId` if it's now starter-less. Both this and item 2 share one new extracted helper, `spawnFreshRival(teamId, decade, year, idSuffix)`, pulled out of the old `generateLeagueRivals()` inline object literal. Skipped entirely while `career.isBackup` is true — that's the one deliberate, pre-existing case where an incumbent is SUPPOSED to share the player's own team slot (see Round 7).

**4. Also fixed while investigating the above: the actual "team doesn't exist in standings, #0 of N in the conference" report.** Root cause was unrelated to items 2-3 — a genuine off-by-one in `expansionDraftCheck()`. The whole waiver → expansion → trade → free-agency transaction chain runs from `advanceCareer()`, which `nextSeason()` calls AFTER already incrementing `career.year` for the season about to be played (confirmed by reading the call chain directly). But `expansionDraftCheck()` computed `nextYear = career.year+1` and looked for `t.start===nextYear` — one year too far ahead given where it actually sits in that chain. A player accepting the expansion offer got attached to a team whose `t.start` was one year LATER than the season about to be simulated, so `divisionsForYear(year)` (correctly, per its own filtering) didn't yet recognize that team as existing — `confTeamIds`/`results` never included it, and `confRanked.findIndex(...)+1` fell back to `0`. Fixed by using `career.year` directly (not `+1`) in both the team-search filter and the display name lookup. Confirmed via a standalone Node diagnostic (extracting just `TEAMS`/`divisionsForYear`/`teamsAvailable` and evaluating them outside the app) that every real team in `TEAMS`, including all 6 modern expansion franchises (SEA/TB/JAX/CAR/BAL/HOU), IS correctly found in `divisionsForYear` at its own exact start year — the bug was purely in when `expansionDraftCheck` asked, not in the standings math itself.

All four verified together in one Playwright suite: (1) seeded a corrupted Trophy Room entry and confirmed the screen still opens and renders a row; (2) started a fresh 1960s-decade career and confirmed `career.leagueRivals` contains none of the 6 modern-expansion team ids; (3) forced free agency, signed with a team that had an active rival, and confirmed that rival is retired while the vacated old team gets a fresh one, with zero active rivals ever sharing the player's own team; (4) forced `career.teamId`/`career.year` to the exact fencepost (a save mid-resume, one season before Seattle's 1976 start, so the simulated season lands on exactly 1976) and confirmed `confRank`/`confSize` come back real (`7 of 14`) instead of `0`. All 3 pre-existing regression suites (NaN self-heal, FA-offer grades, achievement toast/scroll-to-top) re-verified passing unchanged. Zero page errors across all of it.

**Turned out all 4 of Round 12's commits had never been pushed** — user kept re-reporting the same bugs after each fix, and it took a `git status` check to notice the local branch was 4 commits ahead of `origin/master` the whole time. This project auto-deploys to GitHub Pages on push (`.github/workflows/deploy-pages.yml`), so every "still broken" report during that window was the user correctly re-testing the exact same unfixed live build, every time. Pushed once confirmed (`git log`/`gh`/the Actions API all confirm the deploy succeeded at each commit going forward) — **lesson: for a project with a push-triggered deploy, verify `git status`/`ahead of origin` before telling a user a fix "shipped."** A local commit is not a deploy.

Added a standing diagnostic for exactly this class of confusion going forward: a small `#buildStamp` element, bottom-right corner of the app, showing the build timestamp (`__BUILD_TIME__`, a Vite `define` baked in at build time — see `vite.config.js`). Also relevant here: this app is a PWA with `registerType:"autoUpdate"` (`vite-plugin-pwa`) — the service worker updates in the background on its own, but the ALREADY-OPEN tab keeps running the old in-memory JS until at least one reload after the new SW takes over. If the stamp ever looks stale after a confirmed-deployed fix, a hard refresh (or fully closing/reopening the tab/installed PWA) is the first thing to try before assuming the code itself is wrong.

Also ran one additional exhaustive sanity sweep while chasing this (pure Node, no browser): for every one of the 32 teams in `TEAMS` and every year 1960–2024, confirmed `divisionsForYear`/`teamsAvailable`'s `t.start<=year` filtering has zero mismatches and zero not-yet-founded team ever passes `generateLeagueRivals()`'s admission filter — the underlying logic itself has no known remaining gap as of this commit.

**Follow-up #3 (a genuinely new site, found after the deploy was actually confirmed live):** "Around the League" — the front-office news feed — reported the same symptom (a Houston Texans headline in a 1960s-decade career). Root cause was a THIRD unguarded `TEAMS.filter(t=>t.id!==career.teamId)` (after `generateLeagueRivals` and `computeSeasonAwardRows`, both already fixed): `rollLeagueNews(year)` picked headline candidates from every team in `TEAMS` with no `t.start<=year` check at all. Fixed both ends the same way as the leaderboard: the write-time filter (`t.start<=year` added to the candidate list) stops new phantom entries, and a matching display-time guard in `buildLeagueNewsFeedHTML()` (skip any logged entry whose team hadn't started as of that entry's own year) makes it a genuine invariant of the render path, not something that depends on write-time cleanup alone. Also hardened the otherwise-already-safe `evaluateSuccession` team loop with the same `t.start<=year` filter (it was already transitively protected since `evaluateSuccession` no-ops without an active rival, but this closes the loop defensively and skips wasted work). Did a full audit of every remaining `TEAMS.filter`/`TEAMS.forEach`/`TEAMS.map` call site in the file afterward (`teamsAvailable`, the two draft-night `leagueStrength`/`teamScheme` initializers, `spawnNewFranchiseRivals`, `expansionDraftCheck`) — all either already correctly filtered or are internal-only lookups that never reach a team-list DISPLAY path directly, so a not-yet-founded team can only ever surface through something that iterates `TEAMS`/`leagueRivals` and shows team names, which is now fully covered. Verified via Playwright: ran a 1960s-decade career through 7 real season advances and confirmed zero `leagueNewsLog` entries were ever recorded for a team before its own start year.

### Round 13 (Phase 1 of 4) — merit-based bench promotion + league-wide bench visibility

First phase of a larger, user-approved redesign (see the plan doc from this session): depth-chart
bench players should be able to win a job on merit, not just once an entrenched starter's contract
happens to expire, and a bench player who actually plays should show up somewhere, not vanish into
an abstraction that never touches the league leaderboard. Full plan covers 4 phases (this one, real
bench trades + a free-agent portal, universal boom/bust talent development, and free-agency team-fit
realism) — phases 2-4 not started yet.

**Merit override in `evaluateSuccession`.** The existing internal-promotion branch only runs AFTER
a starter's `contract.years`/`entrenchedYears` both hit 0 — a QB2 who is dramatically better than an
entrenched, still-effective starter could sit for years with literally zero chance of promotion,
purely because of contract timing (the reported "90-overall QB3 stuck behind an 82-overall
starter"). Added a new, independent check that fires even while `stillEntrenched`: if
`rivalEffTalent(qb2) - rivalEffTalent(rival) >= 16` (a MUCH bigger bar than the post-entrenchment
promotion check's own `-5`), roll 28%/season. On success it falls into the exact same promotion
mechanics as before (extracted into a shared `promoteQb2()` helper so nothing is duplicated) — just
with a different flavor line ("can't justify sitting him any longer" vs. "who'd been waiting for
exactly this shot"). Calibrated via a pure-math sweep (`merit_override_sweep.mjs`, scratchpad)
BEFORE shipping — the standing rule after the Round 6 succession-churn miscalibration — confirming
16/28% resolves a genuinely dominant bench QB within ~2-3 seasons of qualifying, while adding only a
handful of events per 31-team league per 15 years, a clear minority next to the already-calibrated
~20-event baseline for normal succession.

**Bench visibility on the League tab.** `computeSeasonAwardRows()` now also appends a row for any
bench player (`career.leagueDepthCharts[teamId].qb2`/`qb3`) with a real season entry (`games>0`) for
that year — previously bench players' stats/awards-eligibility were computed by
`simulatePlayerSeasonStats` but literally never read by anything display-facing. Their `awards`
field stays computed-but-never-GRANTED (unchanged Round 6 design — `resolveSeasonMVP`/
`resolveSeasonAllProAndProBowl` still only ever read `career.leagueRivals`), so this is visibility
only, not a new way to actually win an award. New `findDepthChartPlayerById(id)` lets
`openRivalProfile` resolve a bench player's `bqb_...` id (it already tries `findRivalById` first,
now falls back to this) — no changes needed to `buildRivalProfileHTML` itself since
`generateBenchPlayer`'s object literal already mirrors a rival's shape exactly.

Verified via Playwright: rigged a bench QB2 with a 30-point gap over an entrenched, freshly-signed
starter (5 years left on contract) and confirmed the merit override promotes him within a handful of
simulated seasons; separately seeded a bench player with a real (`games>0`) season entry for the
current year and confirmed he appears on the League tab leaderboard and that clicking his row opens
a working profile instead of crashing. All prior regression suites re-run clean (the one recurring
failure, "reached a free-agency offers screen," is the already-documented pre-existing FA-candidate-
generation flakiness, unrelated to this change — confirmed passing on retry).

### Round 14 (Phase 2 of 4) — real bench trades and a free-agent portal

Second phase of the QB-entity redesign. Depth-chart bench players can now genuinely move between
teams instead of only ever aging out and being regenerated in place, and a QB who loses his job
(starter or bench) doesn't just vanish — he either lands directly on an acquiring team's roster (a
real trade) or enters a shared jobless-QB pool other teams might sign him from later, exactly per
the user's explicit direction. All of this is simulated background roster movement the player has
no control over, same spirit as `rollLeagueNews` — none of it is a player-facing mechanic.

**`career.freeAgentPool = []`** (new career field, self-heals `?? []` on older saves). **New
`enterFreeAgentPool(entity, reason)`**: the single choke point every "this QB just lost his job"
site now routes through. If the entity is still plausibly good enough to play
(`rivalEffTalent>=50`) and hasn't hit his own `retireAge`, he goes into the pool; otherwise this is
just a normal, permanent retirement — unchanged from the prior behavior. Wired into 3 existing
displacement sites: `evaluateSuccession`'s internal-promotion branch (the QB who just lost his job
to the QB2 who beat him for it), its external-signing branch, and `reassignRivalsForTeamChange` (a
rival displaced when the PLAYER takes over a team). The external-signing branch was also changed to
PREFER an actual free agent already sitting in the pool over conjuring a brand-new veteran from thin
air — the pool is a real destination now, not an inert holding pen.

**New `evaluateBenchMobility(teamId, decade, year)`** (once per season per bench slot, 6% roll —
`BENCH_MOBILITY_RATE`) decides trade vs. waive. **New `tradeBenchPlayer(player, fromTeamId,
fromSlot, decade, year)`** finds a destination team whose equivalent slot is clearly weaker
(`rivalEffTalent` gap >= 10), moves the player there DIRECTLY (a real roster move, landing him on
the acquiring team's actual depth chart — per the user's explicit correction to an earlier
"displace-and-discard" draft of this plan), and pushes whoever previously held that slot into the
free-agent pool via `enterFreeAgentPool` rather than silently overwriting them. The origin slot
backfills with `generateBenchPlayer`, same as any other bench departure.

**New `resolveFreeAgentPool(decade, year)`** (once per season): ages every pool entry by one jobless
season and applies a swept retirement hazard, then gives survivors a modest (15%) chance a team
signs them to an open/weak bench slot via **new `pickBenchSigningDestination(entity, year)`**
(starter-job pool pulls are handled separately, by the external-signing branch above). Calibrated
via two pure-math sweeps BEFORE shipping (the standing rule, not optional): `pool_hazard_sweep.mjs`
found that a flat/constant per-season hazard can't satisfy "low chance at 1 jobless season, near-
certain by 4-5" at the same time — landed on evaluating retirement chance directly as
`clamp(0.05 * joblessSeasons^2, 0, 0.95)` instead (5%/20%/45%/80%/95% at seasons 1-5); separately,
`pool_size_sweep.mjs` confirmed the resulting pool stays small (a handful of entries) over a
25-season career at these rates rather than growing unbounded.

**A real, non-obvious implementation trap worth flagging for future edits**: `resolveFreeAgentPool`
iterates a SNAPSHOT of the pool (`career.freeAgentPool.slice()`), not the live array, because
`enterFreeAgentPool` (called from inside this same function, when a bench-slot sign displaces an
incumbent) pushes a new entry into the very array being processed. Reassigning
`career.freeAgentPool = survivors` at the end from a naive forEach accumulator would silently
discard that mid-pass addition; instead this collects a `toRemove` Set and filters the LIVE array
against it at the end, so anything added mid-pass survives into next season correctly.

Verified two ways: (1) a controlled pure-Node extraction (`phase2_extract.js`, mocking
`Math.random()` to force exact branches deterministically) confirming a rigged 95-talent bench QB
actually lands on the acquiring team's roster with the displaced incumbent correctly entering the
pool (not discarded), the waive path correctly pools its displaced player too, 20 pool entries at
`joblessSeasons=10` overwhelmingly retire in one pass, and a viable surviving free agent gets signed
to a genuinely weak destination slot; (2) real Playwright gameplay for the pool retirement hazard
specifically (20 seeded entries at `joblessSeasons=10`, confirmed the pool shrank from 20 to 3 after
one real season advance). The pure-Node route was necessary for the trade/waive/sign mechanics
specifically because verifying them via real gameplay requires surviving many organic season
advances without the player's OWN career ending first (a real, unrelated risk for any multi-season
Playwright test in this game) — deterministic `Math.random()` mocking sidesteps that survival-bias
problem entirely rather than fighting it with more retries.

### Round 15 (Phase 3 of 4) — universal boom/bust talent development, harsher decline past prime

Third phase of the QB-entity redesign, and per user correction to the original plan: applies to
EVERY QB entity (starters and bench alike, not bench-only), but boom/bust activity itself only
happens while young — past that cutoff it stops (a small ordinary plateau drift continues for a few
more years) and age-driven decline gets meaningfully harsher, scaled by era and a new per-entity
durability proxy, exactly per the user's own framing: "every QB... but the boom or bust mechanic
should only be happening when the player is still young... age/injury decline should be harsher,
especially for older eras (dependent on durability)."

**New `developEntityTalent(entity, decade)`**, called from both `simulateRivalSeasons` and
`simulateDepthChartSeasons` right after `simulatePlayerSeasonStats` each season — mirrors the
player's OWN `career.devSpeed`/`developAttributes` boom/bust system, but at a single-scalar
(`entity.talent`) scale instead of a 12-attribute build, since a rival/bench entity only has one
number to develop. New per-entity fields `entity.devSpeed` (mirrors `career.devSpeed`, via the SAME
`rollDevSpeed()`) and `entity.durability` (a new lightweight 20-99 proxy — rivals don't have a full
attribute build, so this is a standalone stat, not part of one) are rolled LAZILY on first read
inside this function (`entity.devSpeed==null` / `entity.durability==null` checks) rather than at
every one of the many rival/bench creation sites — this is the self-heal-on-read pattern from this
session's earlier fixes, applied here so an existing save never needs migrating.

Three age bands, `TALENT_DEV_YOUNG_CUTOFF=27` / `TALENT_DEV_DECLINE_START=32`:
- **Young (<=27):** smooth per-season drift scaled by `devSpeed`, plus a rare (devSpeed-volatility-
  scaled, same shape as the player's `devVolatility`) capped-at-2 breakout/bust-spiral swing that
  ALSO permanently shifts `devSpeed` itself — a breakout compounds into faster growth for his
  remaining young seasons, a bust-spiral compounds the opposite way, identical spirit to the
  player's own system.
- **Plateau (28-31):** a small ordinary drift either way, but no more career-defining swings — this
  is the literal "can still develop and regress but the idea of booming or busting sorta stops" the
  user asked for.
- **Decline (32+):** `entity.talent` erodes each season, scaled by `ERA_ATTR_MULT[decade].injury`
  (the EXISTING per-era severity multiplier, reused rather than reinvented) and by
  `(99-entity.durability)` — a low-durability guy in a rougher era declines harder past his prime
  than a high-durability one in a modern era. Deliberately implemented as a permanent erosion of the
  RAW `entity.talent` value (inside this new function, which already has `decade` in scope) rather
  than as a change to `rivalEffTalent`'s age-EXPRESSION curve — `rivalEffTalent` and the
  `primeMultiplier` it shares with the player's own `effOverall` calculation are both left
  completely untouched, so this cannot accidentally alter how the PLAYER's own build ages. This
  mirrors the exact same separation of concerns the player's own system already has (development
  changes the build; the prime curves only change how much of a FIXED build expresses at a given
  age).

Both the young-phase drift and the decline-phase severity were swept BEFORE shipping
(`talent_dev_sweep.mjs`): a representative talent=60 prospect sees a median +8.4 drift from age
22→27 with a real (13.7%) minority swinging 15+ points either direction; decline severity was swept
across durability × era combinations, confirming a genuinely harsher gradient for low-durability
players in rougher eras (1960s/dur=20 falls ~15.6 points by 40 vs. 2020s/dur=90's ~3.8) without
anyone collapsing to the floor outright in even the harshest combination.

Verified via a controlled pure-Node extraction (`phase3_extract.js`, same deterministic
`Math.random()`-mocking approach as Phase 2, for the same career-survival-confound reason): confirmed
`devSpeed`/`durability` self-heal correctly on first read; confirmed a forced breakout meaningfully
raises both talent and `devSpeed` permanently; confirmed NO breakout/bust swings ever fire past the
young cutoff regardless of how high `devSpeed` is (a would-be-constant-swinger simply stops swinging
on schedule); and confirmed the durability/era decline gradient holds across 3000-trial averages. All
prior regression suites re-run clean (the handful of failures across the run — the pre-existing
FA-offer-candidate flakiness, the news-feed test's own naive fixed-name-list false positive, and one
instance of the Phase 1 merit-override's expected ~15-20% miss rate within its 8-season test window —
are all previously-documented, unrelated artifacts, not regressions from this phase).

### Round 16 (Phase 4 of 4) — free-agency team-fit realism, final phase

Fourth and final phase of the QB-entity redesign. Free agency now reasons about a team's actual
competitive situation and the player's own profile (age, not just current-season tier), instead of
a flat tier-vs-team-need band — the exact behaviors the user asked for: a young/mediocre player
draws a real QB1 shot from a team with nothing at the position, and an old/accomplished player only
draws real interest from a team actually trying to win now.

**New `teamCompetitiveWindow(teamId)`** buckets a team as `"win-now"` (`leagueStrength>=72`),
`"rebuild"` (`<=45`), or `"retool"` — deliberately just the already-tracked `career.leagueStrength`
rather than scanning multiple seasons of a rival's win history (the original plan's first draft);
simpler to reason about and `leagueStrength` already reflects the trend that matters here.

**`teamNeedRank`** gets one addition: a team with an aging (34+), short-leash (`contract.years<=1`)
starter now reads as real future need even while he's still playing fine — a `+15` bump to the
underlying `need` score before bucketing.

**`buildFreeAgentOffers`**'s candidate loop gets two new rules layered on top of the existing
tier-vs-need gate, keyed off the player's own age (`isYoungPlayer<=27`, `isOldAccomplished` =
age>=34 AND tier is good/elite):
- **Rebuild-youth carve-out**: a `"rebuild"`-window team with real need (`needRank>=3`) always
  connects with a young player and always offers `role:"starter"`, bypassing the tier-gap gate
  entirely — this is what lets a merely-average young QB draw a genuine starting shot from a
  team with nothing at the position, instead of being filtered out by the numbers alone.
- **Win-now exclusion**: an old, accomplished player is excluded from any team that ISN'T in
  `"win-now"` mode (unless the rebuild-youth carve-out somehow also applies, which it structurally
  can't for an old player) — a rebuilding team doesn't spend a roster spot on a short-term rental.

Each offer now also carries a **`reason`** string (rendered as a new `.fa-offer-reason` line in
`renderFAOffers`) naming WHY that specific team is calling — reusing the existing flavor-text
convention from `LEAGUE_NEWS_EVENTS`/`ORG_EVENTS` — so the team-fit logic above is legible to the
player through the UI, not just felt through which offers happen to show up.

Verified via 2 targeted Playwright scenarios (not a pure-math sweep — these are gate/exclusion
rules, not new probability dials, so there's no distribution to calibrate, just correctness to
confirm): (1) forced an old (36), maxed-out elite-tier build with exactly one `"win-now"`-grade team
and every other team depressed to `"rebuild"` — confirmed the ONLY offer that appeared was the
win-now team, with the correct reason text, and no rebuild team ever showed interest; (2) forced a
young (25), mediocre-build player against one desperate `"rebuild"` team (a terrible, entrenched
rival) with every OTHER team's rival made deliberately excellent (so they're naturally excluded by
the existing gap gate, isolating the carve-out under test) — confirmed the rebuild team appeared
with `role:"starter"` and the correct "don't have a real answer at the position" reason, despite the
player's own mediocre tier not naturally matching that team's raw need band. Full regression suite
re-run clean (one failure, the already-documented Around the League test's naive fixed-name-list
false positive, confirmed non-regression by its own zero-violations rigorous check passing).

**This closes out the 4-phase QB-entity redesign** (Rounds 13-16): merit-based promotion + league
visibility, real bench trades + a free-agent portal, universal boom/bust development, and now
free-agency team-fit. See each round's own entry and the architecture notes below for the individual
pieces; together they turn the league's ~90+ other QBs from a mostly-static backdrop into entities
that develop, bust, get hurt (already existed), get traded, land on waivers, and get signed based on
actual team situation and player profile — matching what was originally a single combined user ask
this session, deliberately shipped in verified, independently-calibrated increments rather than one
large unreviewable change.

### Round 17 — bug fix: "present day" marker at the wrong end of the career event log

Playtester report (via Discord): the career event/transaction log ("Round 1, Pick 28 overall...",
"Announces He's Expecting.", etc.) showed "— present day" next to the OLDEST entry instead of the
newest. `buildEventLogFeedHTML()` builds `rows` newest-first (`career.transactions.slice().reverse()`)
but then appended the "— present day" line AFTER `rows` in the returned markup — landing it at the
visual BOTTOM of a newest-first list, i.e. right next to the oldest entry, backwards. Fixed by moving
that line to the front of the returned string instead. Verified via Playwright: advanced a couple of
real seasons (so more than one transaction exists) and confirmed "— present day" renders as the
FIRST line in the feed, not the last.

### Round 21 — real weekly schedule, elite-QB stat realism pass #2, and a real Playoff Tree bracket diagram

Follow-up after Round 20 shipped: user screenshots caught a real bug plus two open issues.

**Part A — schedule double-booking bug, fixed.** Screenshots showed the Cincinnati Bengals AND the
Cleveland Browns both listed as playing the Baltimore Ravens in "week 1" and "week 2" — impossible,
confirmed by code reading: `buildScheduleResults`'s `week` was `gameLogs[id].length+1`, purely local
to each team's own array with zero cross-team coordination. Fixed with a real week-by-week
construction: new `scheduleGamesIntoWeeks(divs, allIds, gamesN)` tracks `divNeeded[a][b]` (each
division pair owes 2 meetings) and `remaining[id]` (starts at `gamesN`), and for each week greedily
pairs teams still needing a game — preferring an owed division rival, falling back to any other
team still needing a game — leaving a team unpaired (a bye) rather than ever double-booking, which
is impossible by construction since a `usedThisWeek` set gates every pairing. `buildScheduleResults`
now resolves games week-by-week using this real week index instead of a per-team counter. Validated
collision-free via `week_schedule_sweep.mjs` (0 collisions, 0 leftover teams, exact `gamesN` weeks
used, across both an even 32-team/8-division setup and an uneven pre-1970-style division setup) and
confirmed live: 496 games checked across 32 teams, zero global collisions, every game mutually
consistent between both teams' logs (same week, opponent points back, scores mirror).

**Part B — elite-QB stat clustering, second pass.** A screenshot showed 9 rival QBs simultaneously
at 4500-5300+ yards in one season (real NFL history: only 15 5000-yard seasons ever, by 9 different
QBs, max 4 in the same season across all of history). Diagnosed via an Explore agent + a validating
sweep: `RIVAL_STAT_SCALE=0.75` meant a merely talent~72-85 rival (not a rare outlier) already
reached 4500-5300 yards at prime age with a full workload, and since ~30 rivals exist with talent
naturally spread wide, many clustered near the shared ceiling simultaneously most seasons — worse,
a sweep showed baseline modern-era attempt volume (34-37/game × 17 games) alone got a perfectly
AVERAGE-talent rival to ~4200 yards, since every rival was modeled as an equally high-volume passer
regardless of team identity. The earlier `developEntityTalent` upward-bias bug (Round 18) was
confirmed NOT a live contributor — already fixed. Three changes, swept together via
`stat_inflation_fix_sweep2.mjs`: `RIVAL_STAT_SCALE` 0.75→0.22; new persistent per-rival
`entity.volumeLean` trait (rolled once lazily, like `devSpeed`/`durability`, via new
`rollVolumeLean()`) replacing pure per-season attempt noise, so not every team is a high-volume
passing offense (`attPerGame = league.attPerGame + volumeLean*12 + randInt(-2,2)`); `missedGames`
chance 0.18→0.30 with its range widened 1-7→1-9 games. Confirmed live across 10 real seasons:
average 0.6 QBs/season ≥4500 yards, 0.0 ≥5000 (previously up to 9 simultaneous ≥4500, several
≥5000) — a large, validated improvement, though flagged as an ongoing calibration surface (this is
the second stat-inflation pass after Round 18's) if a future report shows it drifting again.

**Part C — Playoff Tree rebuilt as a real connected bracket diagram.** The tab already had correct
underlying data and era-accurate bracket sizing (`PLAYOFF_ERAS`/`playoffFormatForYear` already
tracks real NFL playoff-format expansion history from 0-wildcard pre-1970 through the 14-team 2020s
format — confirmed via code reading, no changes needed there) but rendered as plain stacked tables.
New `renderBracketTreeSVG(rounds, year)` draws a real SVG bracket — one column per round, connector
lines from a winning seed's box to its slot in the next round (tracked via `seedRowY`, a per-round
seed→y lookup, so a bye correctly draws with no incoming connector for that gap) — reusing the exact
visual language (`.bracket-team-name`/`.bracket-score`/`.bracket-round-label`) the player's own
single-path bracket (`renderPlayoffBracketSVG`, pre-existing) already established. Replaces the
Round 20 `renderBracketRoundsHTML`/`renderMyPlayoffPathHTML` pair entirely: the OTHER conference (and
the player's own conference in a season they missed the playoffs) now renders via
`renderBracketTreeSVG`; the player's own conference in a season they DID make the playoffs now
literally REUSES `renderPlayoffBracketSVG(season.playoffs.rounds, season.teamName, season.year)` —
the exact same function the Season tab's own bracket already calls — instead of a separate
custom-built path renderer, guaranteeing the two views can never visually diverge. Per user-approved
scope, this ships as ONE clean, polished visual style; the 7-decade-specific aesthetic reskin
(chalk-ledger 1960s, CRT chyron 1970s, 8-bit 1980s, brushed metal 1990s, carbon fiber 2000s, flat
minimalist 2010s, cyber-broadcast 2020s) the user separately requested is an explicitly deferred,
much larger follow-up round, not part of this pass. Verified live: both conferences render a real
SVG bracket (2 SVGs), including a season the player missed the playoffs entirely.

Full regression suite re-run clean (`pw_bugfix_regression`, `pw_partd_test`, `pw_presentday_test`,
`pw_career_save`, plus the Round 20 schedule/League/Playoff-Tree verification test re-run against
the new week-by-week scheduling code) — all pass.

### Round 20 — real per-team schedules, exact QB game attribution, league-wide playoff bracket

Follow-up to Round 19 Part B: the user clarified a proportional win/loss split wasn't what they
meant by "simulate every team's game" — `buildScheduleResults` already resolves a real, shared
schedule game-by-game internally, but threw away everything except final win/loss counters. The ask:
keep that per-game detail (a Schedule-tab dropdown to view ANY team's real week-by-week season, with
the correct QB per game), and actually simulate every team's playoff run so a real Super Bowl winner
exists every season, not just the ones the player wins personally.

Two scope decisions confirmed with the user before building: (1) the new per-team game-by-game detail
is CURRENT SEASON ONLY, not persisted forever (avoids ~32x storage growth per season compounding over
a long career) — lives on a new, always-overwritten `career.currentSeasonSchedules`, never inside the
`season` object `career.seasonLog` retains forever; (2) another team's QB's per-game stat line is the
QB's already-calculated season aggregate distributed across his real games with natural variance, not
a second, independently-calibrated per-game simulation engine.

**Part A — real per-team, per-game log.** `buildScheduleResults`'s `playGame` closure now also
pushes `{week, opponentId, won, myScore, oppScore}` into per-team `gameLogs` arrays (`week` = that
team's own running game count, so every team gets a clean 1..gamesN sequence regardless of the
randomized global resolution order). New `approxGameScore(winnerStrength, loserStrength)` fills in a
plausible score for games where only two raw strength numbers exist (swept via
`approx_score_sweep.mjs` for realistic NFL-ish ranges). `buildScheduleResults` returns
`{results, gameLogs}`; `simulateLeagueStandings` stashes `gameLogs` onto `career.currentSeasonSchedules`
(overwritten every season) while `results` keeps its existing cheap, forever-retained shape on
`season.leagueStandings` unchanged.

**Part B — exact per-game QB attribution, replacing Round 19 Part B's proportional split.**
`simulateRivalSeasons` now tags the EXACT weeks on `career.currentSeasonSchedules[teamId]` a bench
QB2 covered (a random contiguous block sized to the starter's real `missedGames` count) with
`.qbId`, defaulting every other week to the starter — `chart.qb2._reliefWeeks` carries the exact
slice reference so `simulateDepthChartSeasons` doesn't need to re-derive it. New
`distributeAcrossGames(total, n)` (integer split across n games, natural variance, exact sum
preserved) and `applyStatLineToGames(games, qbId, comp, att, yards, td, int)` (comp derived from
each game's OWN attempts share so it can never exceed that game's attempts) turn a QB's season
aggregate into a believable per-game log. New `reconcileWinLossFromGames(entity, season, games)`
overwrites the season object's `wins/losses/winPct` (and fixes `entity.totals`) with an EXACT count
from the real tagged games — `simulatePlayerSeasonStats` itself still rolls a placeholder win/loss
internally (needed only to feed `evaluateSeasonAwards` before the caller knows which real games this
entity covered) but that number is never what ends up displayed; the `teamRecord`-based proportional
split from Round 19 Part B is gone entirely, along with the now-unused `leagueStandings` param on
`simulateRivalSeasons`/`simulateDepthChartSeasons` (both read `career.currentSeasonSchedules`
directly instead). Verified via a live data check: 27/27 teams' game logs matched their aggregate
standings record exactly, and bench-relief QB win/loss matched his exact tagged games exactly.

**Part C — Schedule tab: pick any team.** New `<select>` (module-level `scheduleTabTeamId`/
`scheduleTabSeason`, mirroring the pre-existing Trends-tab stat-picker pattern) — the player's own
team renders exactly as before from `season.gameLog` (`renderOwnScheduleTable`, untouched, still the
more detailed sacks/rush-inclusive simulation); any other team renders from
`career.currentSeasonSchedules[teamId]` (`renderOtherTeamScheduleTable`), resolving each game's QB
via new `resolveScheduleQb(qbId)` (checks `findRivalById` then `findDepthChartPlayerById`). Wired
through the same delegated `#careerContent` listener already used for League-tab subtabs/sorts, as a
new `change` branch (selects don't fire `click`).

**Part D — a real, permanent league-wide playoff bracket every season.** Confirmed via code reading:
unless the player personally reached the Super Bowl, NOTHING recorded who actually won it — a
season the player missed the playoffs had no bracket data at all beyond seeding, and even a season
the player won it all only ever resolved the OTHER conference far enough to name a Super Bowl
opponent, discarding the rest. New `resolveFullBracketWithRounds(seeds, format)` (unlike the
pre-existing `resolveConferenceBracket`, which only ever records a round when `myTeamId` is actually
in it — passing `"__none__"` there silently produces zero rounds) ALWAYS records every round's
matchups via the flat `simpleWinProb` formula, reusing the exact same recursive bye/wildcard/
divisional/conference-championship pairing shape. New `resolveRemainingBracketField(field)` finishes
an in-progress bracket flat once the player's real run ends mid-bracket, so whoever beat them for
real is always a valid path to conference champion, never a disconnected parallel universe. New
`finalizeLeaguePlayoffBracket(season, myPlayoffs)` ties it together — called from `resolvePlayoffs`
immediately when the player misses the playoffs (`myPlayoffs=null`), and from `finalizeRound`'s
"whole run is done" branch (right alongside the pre-existing `finalizePlayoffOutcome` call) once the
player's own reveal, if any, has fully finished — reaching a REAL, revealed Super Bowl round already
means winning the conference for real, so that overrides the flat sim's guess for the player's own
conference; the other conference's flat bracket always stands as-is. Stores
`season.leagueStandings.playoffBracket = {[myConf]:{championId,rounds}, [otherConf]:{...},
superBowlWinnerId, superBowlLoserId, superBowlScore}` — small (seeds/matchups/round winners only, no
per-game logs), so unlike Part A's schedule detail this IS kept forever on every past season. New
**Playoff Tree** dash-tab (`buildPlayoffTreeTabHTML`): the player's own conference shows their REAL
path (`season.playoffs.rounds`, via `renderMyPlayoffPathHTML`) whenever they made the playoffs — the
`rounds` field is deliberately left `null` in that case specifically so the UI never has to choose
between two conflicting versions of the same conference; the other conference (and the player's own
when they missed the playoffs entirely) shows the full flat bracket matchup-by-matchup via
`renderBracketRoundsHTML`, reusing the existing `roundDisplayLabel`/`confLabel`/`superBowlDisplayName`
era-aware wrappers and the exact same internal round-name literals everything else keys off. Verified
live: a season the player missed the playoffs rendered a complete, real bracket with a genuine
champion and Super Bowl winner; a season the player made the playoffs and was eliminated mid-bracket
rendered their real path plus the correct real conqueror as conference champion.

Full regression suite re-run clean (`pw_bugfix_regression`, `pw_partd_test`, `pw_presentday_test`,
`pw_career_save`, `pw_rival_test`, `pw_depthchart_test` — the last one failed once in 4 runs on an
assertion that assumes the first League-tab row is always a full rival, not a bench player, a
pre-existing fragility unrelated to this round's changes).

### Round 19 — single-season parity, unified QB win/loss, Standings/League UI, era-aware rubberbanding

Follow-up report after Round 18 shipped: screenshots showed ~8 of 32 teams at 12+ wins in a single
season alongside several 2-5 win teams — a bimodal, absurd-looking spread distinct from Round 18
Part A's MULTI-season drift fix, since this was happening WITHIN one season's schedule simulation.
Bundled with several UI/data asks and a request for stronger, era-dependent team-strength volatility.

**Part A — single-season win distribution too extreme.** A sweep (`winprob_tune2.mjs`) against the
real `simpleWinProb`/`buildScheduleResults` formula confirmed it: at the old `0.5+(a-b)*0.012`
coefficient with a `[0.06,0.94]` clamp, a 31-team season averages 7-8 teams at 12+ wins, matching the
screenshots. Retuned to `0.5+(a-b)*0.006` with a tighter `[0.10,0.90]` clamp — drops the 12+-win count
to ~4, cuts 14+-win teams from ~3.4 to ~1, still leaves real season-to-season spread.

**Part B — rival/bench QB win-loss unified with the real shared schedule sim.** Code reading found
`buildScheduleResults` already simulates a real, shared, division-aware schedule for every team
(exactly the "simulate every team's game" the user asked for) and caches it once per season on
`season.leagueStandings` — but `simulatePlayerSeasonStats` (every rival's/bench player's own stat
line) was rolling a SECOND, independent per-game Bernoulli win/loss, completely disconnected from it.
Same team-season, two different win/loss numbers. Fixed: `simulatePlayerSeasonStats` now takes an
optional `teamRecord` (that team's already-simulated `{wins,losses}` for the season) and, when
present, allocates a proportional share of it to the entity based on how many games he actually
played (`Math.round(winPct*gamesPlayed)`) instead of re-flipping independent coins. `season.leagueStandings`
is already computed (inside `resolvePlayoffs`) before `simulateRivalSeasons`/`simulateDepthChartSeasons`
run in `generateSeason()`'s existing call order, so no reordering was needed — just threaded through
as a 4th param on both. Verified via Playwright + a direct localStorage data check: every rival who
played a full season this year matched the shared schedule record exactly (32/32 in the test run).

**Part C — Standings tab shows each team's overall.** `buildStandingsTabHTML` now renders a small
`.team-ovr` badge (e.g. "78 OVR") next to every team name in both the playoff-seed list and the
division tables, reading the exact same `career.teamStrength`/`career.leagueStrength[id]` values that
drive win probability — a lopsided-looking record now has a visible cause.

**Part D — League tab: Games Played column + click-to-sort headers.** `computeSeasonAwardRows` now
copies `games` onto every row (player/rival/bench); the active table shows a new GP column. Generalized
the existing Trophy Room `TROPHY_ROOM_SORTERS` comparator-map idiom to clickable `<th>` headers
instead of external toggle buttons — `LEAGUE_ACTIVE_SORTERS`/`LEAGUE_INACTIVE_SORTERS`, wired through
the same delegated `#careerContent` click listener already handling `[data-rival-id]`/
`[data-league-subtab]`. Clicking a header toggles ascending/descending (flips on repeat click, resets
to descending on a new column); `reRenderLeagueTables()` regenerates just the two `<tbody>`s in place
so the active/inactive sub-tab toggle survives a sort click. Verified via Playwright (GP values sane,
sort order correct both directions, arrow indicator, sub-tab state preserved).

**Part E — stronger, era-dependent team-strength rubberbanding.** `CONTENDER_DECLINE_THRESHOLD`
76→72, `RATE` 0.22→0.32; `REBUILD_THRESHOLD` 45→48, `RATE` 0.22→0.32 (tighter thresholds, stronger
pull). New `ERA_TEAM_VOLATILITY` per-decade multiplier (0.55 in the 1960s ramping to 1.3 in the
2020s, mirroring the existing `ERA_ATTR_MULT.injury` precedent) applied to every churn source found:
the flat per-season noise term, the decline/rebuild pull's rate (not its threshold), `rollLeagueNews`'
headline swings (previously an unclamped, era-blind ±4-to-8 jump on ~10% of teams a season), and a
rival's succession-nudge jump when a starter retires. Verification caveat, confirmed empirically during
planning: a simplified noise+pull-only proxy sweep produced ZERO teams at either extreme even at the
OLD, weaker rates — meaning the real game's visible extremes are very likely driven substantially by
the two lumpy, non-continuous events this part also scales (news swings, succession jumps), not the
smooth per-season noise/pull terms alone. A real 12-season Playwright run in each of a 1960s-start and
a 2010s-start career completed cleanly post-fix (0-1 teams at either extreme out of 32 in both single
runs) — a single-trial comparison is too noisy to confirm the era-scaling DIRECTION specifically, so
that remains an open, lower-confidence part of this fix if a future report suggests it isn't working.

Regression: ran `pw_bugfix_regression`, `pw_partd_test`, `pw_presentday_test`, `pw_career_save`,
`pw_depthchart_test`, `pw_rival_test` — all pass. `pw_phase4_test`/`pw_phase4_test2` failed
intermittently, but a controlled 3-old-vs-3-new-code comparison confirmed the SAME failure rate on
the pre-Round-19 baseline (2/3 and prior sessions' own notes) — pre-existing test-rigging fragility,
not a regression from this round; see the Round 18 entry's testing-methodology note in CLAUDE.md.

### Round 18 — league parity, elite-QB stat inflation, and honest bench-stat generation

Three more reports, all confirmed or partially confirmed via diagnostic sweeps BEFORE touching any
code (the standing rule), following a planned 4-part approach.

**Part A — too many teams stuck at either extreme.** A 31-team/20-season pure-math sweep of the
EXACT real team-strength drift formula (`team_parity_sweep.js`) showed why: `contenderDeclinePull`
only ever pulls a team DOWN once it clears a high threshold — nothing pulls a bad team back UP
toward the middle. Result: ~48% of the league ends up at the extremes (many literally pinned at the
20 floor), with almost nothing in a healthy middle band. Fixed with a new, exactly symmetric
`rebuildPull(strength)` (`REBUILD_THRESHOLD=45`, `REBUILD_RATE=0.22` — deliberately the same numbers
as the existing decline pull), applied both to the per-rival team-strength loop and the player's own
team-strength drift line in `generateSeason()`. Re-swept against the ACTUAL updated formula (not
just the standalone extraction): extreme share drops to ~0.6% average, middle-band share nearly
doubles to ~48%. Dynasties and tanks still exist — a team can still sit at an extreme for a while
early on — they just can't get stuck there permanently, the identical relationship the existing
decline pull already has at the top end.

**Part B — Phase 3's own systematic talent-inflation bug.** The user separately reported "15 QBs
throwing 5000 yards" league-wide; a sweep using the real stat formula could NOT reproduce that scale
(worst case found: 7/31 rivals over 5000 yards in a season) — but it DID find that this session's own
Round 15 (Phase 3) `developEntityTalent` has a real, if modest, systematic upward bias: its young-
phase `baseDrift` floors at 0 and can only ever ADD talent on an ordinary season, so the league's
average rival talent measurably inflates over a long career (median +8.4 by age 27, never negative
on its own). Fixed by replacing it with a genuinely zero-centered drift keyed only on `devSpeed`
(`lean = (devSpeed-1.0)*2.2`, symmetric `variance`), leaving the rare capped breakout/bust-spiral
swing underneath completely unchanged (that asymmetry IS intentional — real boom/bust events, not
ordinary noise). Re-swept against the actual code: median drift is now ~0.0, and the 5000+-yard-
season count is back down close to a no-development baseline. **Open question, not fully resolved**:
the "15 QBs" figure itself was never reproduced even before this fix — if it's still happening at
that scale on the current build, something the sweep's simplifications don't capture (it approximates
award-eligibility rather than the full cross-league MVP/Pro-Bowl/All-Pro ranking) needs a fresh,
targeted look with a concrete recent example, not a further guess-and-tighten pass.

**Part C — bench-stat generation was completely disconnected from the team's real season.** The
actual root cause of "everyone in the league seemingly has stats": `simulateDepthChartSeasons`
rolled a full, INDEPENDENT season of stats for every bench player every year (own `attPerGame`, own
missed-games roll, ~82% chance of a non-zero statline), with zero connection to whether the team's
real starter actually missed any games. Fixed by making bench-player stats causally follow the
starter's own season: `simulatePlayerSeasonStats` gained an optional `forcedGames` parameter (fully
backward compatible — every existing call site omits it); `simulateRivalSeasons` now reads its own
return value's `games` field to compute the starter's real `missedGames` and stashes it on
`chart.qb2._reliefGames` (QB2 only, never QB3 — mirrors real depth charts, per user direction);
`simulateDepthChartSeasons` only calls `simulatePlayerSeasonStats` (with `forcedGames`) when
`_reliefGames>0` — otherwise the bench player just ages and develops with NO season entry at all
that year, matching "no stats because he didn't play." This makes the Round 13 `games>0` leaderboard
filter genuinely meaningful for the first time (previously mostly decorative, since a bench player
almost always HAD a nonzero-but-hidden statline). Verified with a deterministic pure-Node test
(mocked `Math.random()` forcing the starter's own missed-games roll to fire/not-fire): confirmed a
full-attendance season leaves QB2 with zero season entries (still aging), and a forced starter
absence gives QB2 a season entry with games matching EXACTLY what the starter missed.

**Part D — a new "Inactive / Free Agents" sub-tab within League.** New `computeInactiveQbRows(year)`
gathers every bench player with no season entry for `year` (didn't get relief duty) plus every
`career.freeAgentPool` entry, one combined list tagged `"Bench — {team}"` or `"Free Agent — N
seasons unsigned"`. `buildLeagueTabHTML` now renders two panels behind a `.mode-toggle`-style pill
toggle (`.league-subtab-btn`/`.league-subtab-panel`, pure show/hide via a new case in the existing
delegated `#careerContent` click listener — no re-render needed, both panels are already in the DOM).
The main "Played This Season" panel is now honestly named — with Part C shipped, it genuinely only
ever contains QBs who took real snaps. Verified via Playwright: a seeded free agent is absent from
the default panel, appears correctly tagged after toggling, and toggling correctly hides the active
panel.

All four parts verified against the ACTUAL updated code (not just standalone extractions) before
shipping. Full regression suite re-run; a few pre-existing/known-flaky browser tests (older,
single-blind-click retry loops, already documented earlier this session) needed a retry or two — the
underlying mechanisms they check were independently re-confirmed via the deterministic/pure-math
routes above, and nothing in Parts A-D touches code those flaky tests exercise beyond the intended
changes.

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
- `career.rivalries` / `bumpRivalry(rival, opts)` / `topActiveRivalry(minScore)` (Round 5) — the rivalry-growth system, keyed by the RIVAL's own id (not team id) so a personal rivalry correctly resets when that rival retires/is succeeded. `bumpRivalry` is the only writer, called from `simulateRegularSeasonGames` (regular season) and `confirmPlayoffRound` (every playoff round) — NOT from the 3 bracket-resolution functions (`resolveConferenceBracket`'s `playMatch`, `stepConferenceBracket`'s `simulateMatch`, `buildSuperBowlRound`) that compute a round's baseline result, since a Key Moment swing can still flip `round.won` before `confirmPlayoffRound` reports the FINAL result — any future rivalry-affecting hook on a playoff game should go through `confirmPlayoffRound` for the same reason. `RIVALRY_EVENTS`/`rivalryEventCheck()` follow the exact same pure-narrative, no-attribute-effects convention as `LIFEPATH_EVENTS`. `rivalryAffairCheck()`/`renderRivalryAffairEvent()` is the one rivalry event with real mechanical teeth (ends the relationship) and is checked ONLY in the primary `lifeEventCheck()` chain, never `secondaryLifeEventCheck()` (same reasoning as `relationshipCheck` itself, to avoid soap-opera pacing) — its low trigger rate sits behind `relationshipCheck()`'s own unrelated gate in the same tick, which is why it isn't in the Admin panel's force-fire pools the way `RIVALRY_EVENTS` is (there's no single event object to pick by id — it needs a live relationship + a qualifying rivalry, not a pool entry).
- `career.leagueDepthCharts` / `generateBenchPlayer` / `simulatePlayerSeasonStats` / `simulateDepthChartSeasons` / `evaluateSuccession` (Round 6) — the rival depth-chart/contract/succession system. `leagueDepthCharts[teamId] = {qb2, qb3}` is a DELIBERATELY separate structure from `career.leagueRivals` (which means "current starters only" everywhere else in the codebase — MVP/Pro-Bowl pooling, the team-grade drift loop, the classmates table, `teamNeedRank`, etc. all assume one entry per team) — never fold bench players into `leagueRivals`, and never let a bench player's stats reach any of those pooling sites. `simulatePlayerSeasonStats(entity, decade, league, year)` is the ONE shared per-player season-math function both `simulateRivalSeasons` (starters) and `simulateDepthChartSeasons` (bench) call — any future tuning of rival stat generation belongs there, not duplicated in two places. `rollRivalContract`/`rollEntrenchedYears`/`rollRookieDepthContract` are the contract-economics helpers, built directly on the player's own `veteranAPY`/`rookieAPY`/`performanceTier` — reuse these, don't invent a parallel rival-only pay scale. `evaluateSuccession`'s "survives → signs a fresh extension" branch is load-bearing, not optional — removing it (or forgetting it on any future edit to this function) reintroduces the exact 68-succession-events-in-11-years bug this round shipped and then had to recalibrate; a starter who passes his eligibility check MUST get a new `contract`/`entrenchedYears` roll, or he's stuck permanently re-eligible every subsequent season. Any future numeric change to the succession odds (currently 22%/15%, entrenchment 2-8 years by tier, decline threshold -15) should be re-verified with a fresh multi-team/multi-year pure-math sweep first, the same way this round's fix was, not shipped on instinct.
- `career.isBackup` / `rollDraftIncumbent` / `resolveBackupSeasonSnaps` / `resolveBackupCompetition` (Round 7) — the player's own bench mechanic. `career.isBackup` is set exactly once, at draft night, and cleared exactly by `resolveBackupCompetition` (never anywhere else) — no other code path should toggle it. When true, an incumbent object lives in `career.leagueRivals` at `career.teamId`, deliberately NOT excluded from `simulateRivalSeasons` (he ages/retires/gets fully simulated like any other rival — this is what lets him retire naturally and open the job) but IS excluded from `evaluateSuccession` (that loop already skips `career.teamId` — never remove that exclusion, or the AI succession system would bench/replace the incumbent invisibly, behind a mechanic the player has no visibility into or agency over). The core design trick: `resolveBackupSeasonSnaps` doesn't build a parallel "bench season" stat pipeline — it just sets `career._backupMissedGames` (a third category alongside the pre-existing `_injuryMissedGames`/`_suspensionMissedGames`) and lets the ALREADY-GENERAL `gamesPlayed=clamp(league.games-missedGames,0,league.games)` formula in `generateSeason()` do the rest, including degrading all the way to a legitimate 0-game season for free. Any future change to the missed-games aggregation in `generateSeason()` must keep summing all three categories, and must read `career._backupIncumbent*` into LOCAL variables before the reset block zeroes them (a real ordering bug caught during this round's own implementation — the fields are read again later, after the reset, to build the season object).
- `career.defense` / `career.coaching` / `career.gmGrade` (Round 9) — the three new team-quality grades, rolled via the same `rollSupportingCastGrade` as `oline`/`weapons` at all 6 team-join sites (grep for `rollSupportingCastGrade(career.teamStrength)` to find them all if adding a 7th team-change path later — one site was missed on the first implementation pass and had to be caught and fixed separately, so don't trust memory here, verify the count). `gmGrade` is deliberately separate from the pre-existing `career.gmRelationship` (front-office SKILL vs. how much the GM personally likes the player) — a future feature should be careful never to conflate the two. Each has exactly one real mechanical hook, not flavor: `defense` → `simulateGameScore`'s optional third parameter (`offOverall*0.8 + myDefense*0.2` for what opponents score) — the 0.2 weight is load-bearing, re-verify with a fresh win-rate sweep before changing it, since an earlier 0.65 weight let this one grade swing win rate MORE than the QB's own full skill range; `coaching` → `developAttributes`'s `coachingMult`; `gmGrade` → `buildFreeAgentOffers`'s `homeGmSkillMult`/`awayGmMult` and `waiverCheck`'s `gmSkillRelief`. `buildTeamTabHTML()` is the single place all 5 supporting-cast/organization grades are displayed together — extend that, don't build a second team-info view elsewhere.
- **Not yet started**: the third requested QOL item, a "Simulate to Free Agency"/"Simulate to End of Contract" fast-forward button that auto-advances through purely-narrative interstitials (no real choice) but stops the moment a genuine decision comes up (free agency offers, injury choice, infractions, locker-room choices, trade responses, retirement, Key Moment). Scoped as its own follow-up: the real design work is classifying every existing `render*Event` function as auto-passable vs. requires-input and building a fast-forward loop around that classification, not a small change.
- `queueAchievementToasts(defs)` / `showNextAchievementToast()` (Round 10) — the achievement-unlock toast. `checkAchievements()` is the only caller, and only ever passes achievements it JUST flipped false→true this call (never re-notifies for one already unlocked). The queue shows one toast at a time even if several unlock in the same tick — never make this stack multiple toasts at once, that was a deliberate choice to avoid a wall of popups after a big season. Reuses `badgeIconSVG` for the icon rather than a separate rendering path — any future change to how achievement icons look should stay in that one function.
- `safeNum(v, fallback)` (Round 11) — use this, NOT `??`, for `career.oline`/`weapons`/`teamStrength`/`leagueStrength[id]` (and `rollSupportingCastGrade`'s input). `??` only replaces `null`/`undefined`; it lets a literal `NaN` straight through. These specific fields drift every season via `career.X = clamp(career.X + delta, ...)`, so `??` guards elsewhere in the codebase (there are many, and they're fine for other purposes) do NOT stop a `NaN` from persisting forever once it appears — `NaN + delta` is always `NaN`, and `NaN ?? 60` is still `NaN`. Any new code path that assigns `career.teamStrength = career.leagueStrength[someTeamId]` (a new team-reassignment event, an admin tool, whatever) MUST go through `safeNum(..., 60)`, not a bare read or a plain `??`, or this exact bug (NaN pass yards/sacks that outlive every future season) reappears.
- `spawnFreshRival(teamId, decade, year, idSuffix)` / `spawnNewFranchiseRivals(year)` / `reassignRivalsForTeamChange(oldTeamId, newTeamId)` (Round 12) — `generateLeagueRivals()` now only seeds a rival for teams with `t.start<=career.year` at draft night; `spawnNewFranchiseRivals(year)` (called once per season, right before `simulateRivalSeasons`) is what gives a team born mid-career its own starter, the exact season it joins. IMPORTANT: `spawnNewFranchiseRivals` ALSO self-heals — it retires any currently-active rival whose team's `t.start>year` BEFORE spawning anything, because an already-in-progress save from before this filter existed can still have phantom future-team rivals baked in, and the spawn-only half of this function can't clean those up by itself (it only skips re-adding a duplicate, never removes an existing one). If you ever touch this function, keep BOTH halves — dropping the retire pass reintroduces "QBs for teams that don't exist yet" for any save that predates whatever fix you're making. `simulateDepthChartSeasons` has the matching `t.start>year` skip for the same reason. `reassignRivalsForTeamChange` MUST be called at every site that sets `career.teamId` to a new value (grep `career.teamId = ` to find them all — 5 as of this round: waived-sign, trade, granted-trade-request, expansion-draft-accept, FA-sign) — it retires whichever rival currently sits at the destination team (the player is now that team's starter, never both) and backfills the team being vacated so it isn't left starter-less. Skips entirely while `career.isBackup` is true — that incumbent is DELIBERATELY sharing the player's own team slot (Round 7), not a bug to fix. Adding a 6th team-change path later without wiring this back in reintroduces the "two starters, one team" bug (a rival outright winning a Pro Bowl on the same team the player is the actual, every-game starter for).
- `computeSeasonAwardRows()`'s `t.start>year` guard (Round 12, follow-up #2) — THIS is the real invariant boundary for "a team that doesn't exist yet is never visible on the league leaderboard/award ceremony," not `generateLeagueRivals()`/`spawnNewFranchiseRivals()`'s write-time filtering. Those two stop the bad data from being CREATED (or, for an old save, from persisting past the next season); this one stops it from ever being DISPLAYED, even for a season some other bug already recorded bad data into, even with zero season advances since. If a future rendering path ever reads `career.leagueRivals` directly to build a per-season list (a new leaderboard variant, a historical-season browser, whatever), it needs this same guard — don't assume `leagueRivals` is already clean by the time it reaches display code.
- `expansionDraftCheck()`'s team-year filter (Round 12 fix) — uses `t.start===career.year`, NOT `career.year+1`. The whole waiver→expansion→trade→free-agency chain runs from `advanceCareer()`, called by `nextSeason()` AFTER `career.year` is already incremented for the season about to be played — so a franchise joining THIS season already has `t.start===career.year` by the time this function runs. `+1` was checking one year too far ahead, attaching the player to a team `divisionsForYear`/the standings math wouldn't recognize yet for the season actually being simulated (the "#0 of N in the conference, team missing from standings" bug). Any other code that reasons about "does a new team exist yet" at this point in the chain should use `career.year` directly for the same reason, not `+1`.
- `promoteQb2()` / the merit-override branch in `evaluateSuccession` (Round 13, Phase 1) — a NARROW, deliberate exception to the Round 6 rule above ("never let a bench player's stats reach any pooling site"): `computeSeasonAwardRows()` now DOES show a bench player who actually played (`games>0`) on the League tab. This is visibility only — their `awards` field is still computed-but-never-GRANTED, since `resolveSeasonMVP`/`resolveSeasonAllProAndProBowl` are UNTOUCHED and still only ever read `career.leagueRivals`. Don't let a future change accidentally route bench stats into either of those two functions — that's the actual invariant Round 6 was protecting, not "bench players can never be displayed anywhere." The merit-override's `MERIT_GAP_OVERRIDE=16`/`MERIT_OVERRIDE_PROB=0.28` pair was swept (`merit_override_sweep.mjs`) against the SAME ~20-events/15-years baseline the normal succession odds were calibrated to (see the Round 6 note above) — any future change to either number should be re-swept the same way, not shipped on instinct, for the same reason Round 6 got burned once already.
- This is Phase 1 of a larger 4-phase redesign (bench mobility/trades/free-agent portal, universal boom/bust talent development, free-agency team-fit realism) — see the plan doc referenced in this round's log entry for the full scope and design rationale before starting Phase 2, rather than re-deriving it from scratch.
- `career.freeAgentPool` / `enterFreeAgentPool(entity, reason)` / `resolveFreeAgentPool(decade, year)` / `evaluateBenchMobility(teamId, decade, year)` / `tradeBenchPlayer(...)` / `pickBenchSigningDestination(entity, year)` (Round 14, Phase 2) — `enterFreeAgentPool` is the ONE choke point for "a QB just lost his job": any FUTURE displacement site (a new team-change event, a new succession branch) MUST route through it rather than setting `retired=true` directly, or that QB silently skips the pool and the whole mobility system has a hole. It's a no-op pass-through to a plain retirement for anyone not `rivalEffTalent>=50`/under `retireAge` — don't lower that bar without re-running `pool_size_sweep.mjs`, since it's what keeps the pool from filling with replacement-level scrubs. `resolveFreeAgentPool` iterates a SNAPSHOT (`.slice()`) of the pool, not the live array, specifically because a mid-pass bench-slot sign can itself call `enterFreeAgentPool` (displacing that slot's incumbent) — reassigning `career.freeAgentPool` from a plain forEach accumulator at the end would silently drop that new arrival; it filters the LIVE array against a `toRemove` Set instead. `pool_hazard_sweep.mjs`'s finding is the one to remember if this ever needs re-tuning: a FLAT per-season retirement hazard cannot be both "low right after a cut" and "near-certain after a few years" at once — this needs the direct `clamp(A*n^POWER, 0, CAP)` shape (currently A=0.05, POWER=2), not a cumulative survival-curve hazard.
- `developEntityTalent(entity, decade)` / `entity.devSpeed` / `entity.durability` (Round 15, Phase 3; young-drift formula corrected in Round 18) — called from BOTH `simulateRivalSeasons` and `simulateDepthChartSeasons`, right after `simulatePlayerSeasonStats`, for every entity (never bench-only, per an explicit user correction to the original 4-phase plan). Deliberately modifies the RAW `entity.talent` value, never `rivalEffTalent`/`primeMultiplier` — those stay the exact same curve the player's own `effOverall` shares, so this can never accidentally change how the PLAYER's own build ages. `TALENT_DEV_YOUNG_CUTOFF=27`/`TALENT_DEV_DECLINE_START=32` are the two age bands to know about: boom/bust swings (capped at 2 per entity, same as the player's `_breakoutCount<2`) ONLY happen at or below 27 — a future change that needs "does boom/bust still apply" logic elsewhere should key off this same constant, not re-derive its own age threshold. **IMPORTANT, Round 18 correction**: the young-phase drift MUST stay zero-centered (`lean = (devSpeed-1.0)*2.2` plus symmetric variance) — the original Round 15 version (`clamp(2.4-(age-22)*0.4, 0, 2.4)`, floored at 0) looked reasonable in isolation but is a systematic per-season positive bias that compounds into real league-wide talent inflation over a long career (confirmed via `qb_inflation_sweep.js`/re-swept post-fix) — never reintroduce an age-only, floor-at-0 drift term here. Past 32, decline severity depends on `ERA_ATTR_MULT[decade].injury` (reused, not reinvented) and `entity.durability` — any future re-tuning of the young-drift or decline-severity dials needs a fresh sweep first (the standing rule), specifically checking that (a) the young-phase median drift stays near zero (not systematically positive OR negative), and (b) nobody collapses to the floor by their late 30s even in the worst durability/era combination.
- `rebuildPull(strength)` / `REBUILD_THRESHOLD=45` / `REBUILD_RATE=0.22` (Round 18) — the symmetric counterpart `contenderDeclinePull` never had. Applied alongside `contenderDeclinePull` at BOTH sites in `generateSeason()`'s team-strength block (the per-rival loop AND the player's own team-strength line) — if a future change ever adds a THIRD site that drifts team strength on a similar cadence (not a one-off org-event nudge, an ongoing per-season baseline), it needs this pull too, or that team can silently re-develop the pinned-at-extremes problem this round fixed (confirmed via `team_parity_sweep.js`: ~48% of the league at the extremes with no rebuild pull vs. ~0.6% with it, re-verified against the actual post-fix formula). Deliberately kept at the SAME threshold/rate magnitude as the existing decline pull for symmetry — re-verify with a fresh sweep before changing either number independently.
- `forcedGames` param on `simulatePlayerSeasonStats` / `chart.qb2._reliefGames` (Round 18) — this is now the ONLY path by which a bench player gets a real season entry: `simulateDepthChartSeasons` skips the stats call entirely (just ages/develops) unless `_reliefGames>0`, which only `simulateRivalSeasons` ever sets (derived from the team's actual starter's own missed-games roll that season). A bench player's `.seasons` array being SHORTER than his real age/career length is correct and expected now — don't "fix" a bench player with gaps in his season history, that gap IS him not playing that year. QB3 NEVER gets `_reliefGames` (only qb2) — a future change that wants QB3 to ever play (e.g. QB2 also hurt) needs new logic, this doesn't fall out of the existing mechanism automatically.
- `teamCompetitiveWindow(teamId)` / the age-based carve-outs in `buildFreeAgentOffers` (Round 16, Phase 4, the LAST phase of the QB-entity redesign — see Round 13-16 for the full arc) — `isYoungPlayer`/`isOldAccomplished` are computed from `career.age`/`tier` fresh at the top of `buildFreeAgentOffers`, not stored anywhere; don't try to read them from `career` elsewhere. The rebuild-youth carve-out (`rebuildYouthFit`) BYPASSES the normal `Math.abs(needRank-rank)>1` gate entirely and forces `role:"starter"` — if this function is ever restructured, keep that bypass explicit and early (before the normal gate check), not folded into the gate's own condition, or a future edit could silently narrow it back down without noticing. Every offer now carries a `reason` string — `renderFAOffers` already renders it via `.fa-offer-reason`; any NEW offer-construction path (there's currently only the one home re-sign + the one away-candidate loop) should set a `reason` too, or that offer will just render with no line there instead of erroring (the `o.reason ? ... : ""` guard is silent-safe, which means a missing reason is easy to miss in review — check for it explicitly).
- `simpleWinProb(aStrength,bStrength)` (Round 19) — `0.5+(a-b)*0.006` clamped to `[0.10,0.90]`, tuned via `winprob_tune2.mjs` to keep a 31-team single season from producing the old formula's 7-8 teams at 12+ wins. This is the WITHIN-season schedule win-probability, separate from `contenderDeclinePull`/`rebuildPull`'s BETWEEN-season drift — don't conflate the two when retuning either.
- ~~`teamRecord` param on `simulatePlayerSeasonStats`~~ **SUPERSEDED in Round 20** — the proportional-split approach this bullet described no longer exists. See the Round 20 notes below (`reconcileWinLossFromGames`/`career.currentSeasonSchedules`) for the current, exact-per-game-count mechanism.
- `.team-ovr` / `teamOverall(id)` in `buildStandingsTabHTML` (Round 19) — reads the exact same `career.teamStrength`/`career.leagueStrength[id]` values `simpleWinProb` uses, so the Standings tab's displayed overall is always consistent with what's actually driving that team's win odds. `.seed-list li span{float:right}` predates this and would've broken the badge's layout — the fix is `.seed-list li span.team-ovr{float:none}`, keep that override if the seed-list markup is ever touched again.
- `leagueActiveSortKey`/`leagueInactiveSortKey` + `LEAGUE_ACTIVE_SORTERS`/`LEAGUE_INACTIVE_SORTERS` + `reRenderLeagueTables()` (Round 19) — click-to-sort on the League tab's column headers, generalizing the pre-existing Trophy Room `TROPHY_ROOM_SORTERS` comparator-map idiom from external toggle buttons to `data-league-sort` attributes on `<th>` elements, wired into the SAME delegated `#careerContent` click listener that already handles `[data-rival-id]`/`[data-league-subtab]` (Round 12/18) — any future League-tab interactive element should follow this same one-listener pattern, not attach its own. `reRenderLeagueTables()` only replaces the two tables' `<tbody>` innerHTML (via `leagueTabSeason`, set at the top of `buildLeagueTabHTML`) specifically so a sort click never disturbs the active/inactive sub-tab toggle state or anything else on the card — a future column addition should update `LEAGUE_ACTIVE_SORTERS`/`LEAGUE_INACTIVE_SORTERS` and the `activeTh`/`inactiveTh` header calls together, or the new column simply won't be sortable.
- `ERA_TEAM_VOLATILITY[decade]` (Round 19) — per-decade multiplier (0.55 in the 1960s ramping to 1.3 in the 2020s) on team-strength CHURN, mirroring the pre-existing `ERA_ATTR_MULT.injury` precedent. Applied at three call sites, all found by grepping this constant: the flat per-season noise + `contenderDeclinePull`/`rebuildPull` output in `generateSeason()`'s drift block, `rollLeagueNews`'s per-event `strengthDelta` roll, and `simulateRivalSeasons`' succession-nudge jump when a rival retires. It scales the RATE of churn, never a threshold (`CONTENDER_DECLINE_THRESHOLD`/`REBUILD_THRESHOLD` stay absolute across eras) — a future 4th churn source should be scaled by this same multiplier at its own call site, not by inventing a second era table. `CONTENDER_DECLINE_RATE`/`REBUILD_RATE` were also raised 0.22→0.32 and thresholds tightened 76/45→72/48 in this same round (stronger rubberbanding, on top of the era scaling) — re-verify with a fresh sweep before changing either further, same standing rule as Round 5/18's tuning of these same two functions.
- `career.currentSeasonSchedules` (Round 20; week-assignment rewritten in Round 21, see below) — a real per-team, per-game log (`{week, opponentId, won, myScore, oppScore, qbId, comp, att, yards, td, int}` per game) for EVERY team in the league, built fresh every season inside `buildScheduleResults` and assigned wholesale in `simulateLeagueStandings`. Deliberately CURRENT-SEASON-ONLY and NOT part of the `season` object `career.seasonLog` retains forever — this is a top-level `career` field, overwritten (not accumulated) every season specifically to avoid a ~32x-per-season storage multiplier compounding over a long career (confirmed user decision, not an oversight). Any future feature wanting a past season's full league-wide schedule detail needs a fresh design decision (change what's persisted), not just a read off old data that was deliberately never kept. The player's OWN entry in this structure (`career.currentSeasonSchedules[career.teamId]`) is a throwaway artifact of the shared-schedule pass and is NEVER read back — the player's real per-game log is still `season.gameLog`, a separate, more detailed simulation (includes sacks/rush, which aren't modeled for any other team).
- `applyStatLineToGames`/`distributeAcrossGames`/`reconcileWinLossFromGames` (Round 20) — the shared machinery that turns a QB's already-calculated season aggregate into a believable, EXACTLY-summing per-game log and corrects win/loss to match. Any future code that gives an entity a `forcedGames`-style partial season MUST call `reconcileWinLossFromGames` afterward (passing the exact games tagged to that entity) or its `season.wins/losses` will silently stay at `simulatePlayerSeasonStats`'s internal placeholder roll, which is deliberately NOT meant to be the displayed number anymore (see the note above where the old `teamRecord` param was removed). `chart.qb2._reliefWeeks` (set in `simulateRivalSeasons`, consumed and nulled in `simulateDepthChartSeasons`) is the pointer to exactly which of `career.currentSeasonSchedules[teamId]`'s entries belong to the bench QB this season — don't try to re-derive this slice independently elsewhere, use the stored reference so the starter's and bench's tagged games can never overlap or leave a gap.
- `resolveFullBracketWithRounds(seeds, format)` / `resolveRemainingBracketField(field)` / `finalizeLeaguePlayoffBracket(season, myPlayoffs)` (Round 20) — a real, permanent champion for both conferences and the Super Bowl, every season, previously undetermined unless the player personally won it. `resolveFullBracketWithRounds` is DIFFERENT from the pre-existing `resolveConferenceBracket` (Round 5-era) — the old one only ever records a round when `myTeamId` is actually playing in it, so passing a sentinel like `"__none__"` silently produces zero rounds; the new one always records every matchup, which is what `finalizeLeaguePlayoffBracket` and the Playoff Tree tab actually need. `finalizeLeaguePlayoffBracket` has exactly two call sites and must keep having exactly those two: inside `resolvePlayoffs` (immediately, when `mySeedIdx===-1` — the player missing the playoffs is known instantly) and inside `finalizeRound`'s "whole run is done" branch, right alongside the pre-existing `finalizePlayoffOutcome(season)` call (the player making the playoffs isn't fully resolved until their own reveal, Key Moments included, actually finishes — same timing dependency `finalizePlayoffOutcome` already has). A future third path that can end a player's playoff involvement (there isn't one today) would need this call added too, or that season's `leagueStandings.playoffBracket` silently never gets set. Deliberate design choice, not an oversight: the player's own conference NEVER gets a from-scratch flat re-simulation once they've made the playoffs, even if they're eliminated early — `resolveRemainingBracketField` only continues resolving from the REAL point of elimination (after committing that round's real, possibly Key-Moment-swung result via `confirmRoundAdvancement` if it hasn't been already), so the team that beat the player for real is always a valid path to conference champion. This is also why `buildPlayoffTreeTabHTML`'s `[myConf].rounds` field is deliberately left `null` whenever the player made the playoffs — there is no full matchup-grid for their conference to show without contradicting their own real path (`season.playoffs.rounds`, rendered in Round 21 via the pre-existing `renderPlayoffBracketSVG` rather than a separate custom path renderer — see the Round 21 note below); only when they missed the playoffs entirely does their conference get the same flat `rounds` grid the other conference always has.
- `scheduleGamesIntoWeeks(divs, allIds, gamesN)` (Round 21) — replaced `buildScheduleResults`'s old per-team-local `week` counter (`gameLogs[id].length+1`, zero cross-team coordination) after it produced a real, user-reported bug: two DIFFERENT teams both showing "week 1 vs the Ravens." Builds a real, collision-free week-by-week schedule via a greedy weekly matching (prefer an owed division rival, fall back to any other team still needing a game, leave a team unpaired/bye rather than ever double-booking — impossible by construction since a `usedThisWeek` set gates every pairing within a week). `buildScheduleResults` then resolves each week's pairs in order, giving both teams in a game the SAME real week number. If a future change ever touches how many games a division/cross-division pairing owes, keep it flowing through `divNeeded`/`remaining` here rather than reintroducing a separate, uncoordinated per-team counter — that's exactly how the original bug happened. Validated collision-free via `week_schedule_sweep.mjs` across both even and uneven division-size setups (0 collisions, 0 leftover teams, exact `gamesN` weeks used every trial).
- `RIVAL_STAT_SCALE=0.22` / `entity.volumeLean` / `rollVolumeLean()` (Round 21, second stat-inflation pass after Round 18's) — three-part fix for elite-QB clustering (a screenshot showed 9 rivals at 4500+ yards simultaneously; real NFL history has only 15 5000-yard seasons ever). `RIVAL_STAT_SCALE` was 0.75, steep enough that merely talent~72-85 (not a rare outlier) reached 4500-5300 yards. `entity.volumeLean` (rolled once lazily, exactly like `devSpeed`/`durability` — see `developEntityTalent`) gives each rival a PERSISTENT pass-volume identity instead of fresh per-season noise, since baseline high-volume attempts alone (every rival previously modeled as an equally pass-heavy offense) was enough to approach 4200 yards with no elite talent required. `missedGames` chance/range also widened (0.18→0.30, 1-7→1-9 games). Confirmed live across 10 real seasons: avg 0.6 QBs/season >=4500 yards, 0.0 >=5000 (previously up to 9 and several respectively) — re-verify with a fresh in-game sample (not just a sweep) if a future report shows clustering creeping back, same as Round 18/19's other empirically-tuned dials.
- `renderBracketTreeSVG(rounds, year)` (Round 21) — draws a real, connected multi-matchup bracket for a full flat-resolved conference (see `resolveFullBracketWithRounds`), replacing the Round 20 plain-table `renderBracketRoundsHTML`. Reuses the exact `.bracket-team-name`/`.bracket-score`/`.bracket-round-label` CSS the pre-existing single-path `renderPlayoffBracketSVG` (Round 3-era) already established. Matchups within each round are sorted by lowest seed so the tree reads top=best seed; `seedRowY` (a per-round seed→y lookup) tracks where a surviving seed was drawn in the PREVIOUS round so a bye correctly draws with no incoming connector line for that gap — any future change to the pairing/bye logic in `resolveFullBracketWithRounds` needs to keep `aSeed`/`bSeed`/`winnerId` on every matchup, since that's all this renderer needs to lay itself out correctly, no separate topology data required. Connector lines are deliberately straight (not right-angle "elbow" connectors) — a scope simplification for this pass, not an oversight. The player's OWN conference in a season they made the playoffs does NOT use this function at all — `buildPlayoffTreeTabHTML`'s `confSection` calls the pre-existing `renderPlayoffBracketSVG(season.playoffs.rounds, season.teamName, season.year)` instead (the exact same function the Season tab's own bracket calls), so the two views can never visually diverge; only a season they missed the playoffs uses `renderBracketTreeSVG` for their own conference too. The 7-decade-specific visual reskin (chalk-ledger/CRT/8-bit/metal/carbon-fiber/flat/cyber-broadcast) requested alongside this was explicitly deferred to its own follow-up round given its size — this function currently renders ONE consistent style regardless of decade.
