# Gridiron Lab → Diamond Lab: baseball conversion tracker

Live checklist for the football→baseball conversion. Phases match the approved plan. Check items
off as they land; keep the build green at each phase boundary.

## Ground rules
- Sibling folder `../gridiron-export` and its GitHub repo are OFF LIMITS. This folder
  (`diamond-export`) had its `origin` remote removed so nothing here can push to Gridiron Lab.
  Work happens on branch `baseball-conversion`. A new GitHub repo (`diamond-lab`) gets wired up
  once it exists.
- Player type: **everyday position player / hitter**. Position is an identity field.
- Name: **Diamond Lab**, app id `com.diamondlab.app`, storage namespace `diamondlab.*`.
- No football save-migration/back-compat.
- Internal playoff round literals renamed to MLB terms (grep-driven, test-covered).

## Attribute map (keys unchanged, labels/groups changed)
ARM→Arm Strength(phys) · REL→Bat Speed(phys) · MOB→Speed(phys) · IMP→Baserunning Instinct(phys)
DAC→Raw Power(hit) · SHA→Contact Hitting(hit) · TCH→Bat Control(hit) · PKT→Plate Discipline(hit)
ANT→Pitch Recognition(mtl) · DEC→Plate Approach(mtl) · CLU→Clutch(mtl) · DUR→Durability(mtl)
(group `accuracy` → `hitting`)

## Phase status

### Phase 0 — identity/scaffolding
- [x] capacitor.config.json, vite.config.js (base path, PWA manifest)
- [x] android: strings.xml, build.gradle, MainActivity package, assets config
- [x] index.html title/meta/brand
- [x] storage keys `gridironlab.*` → `diamondlab.*` in main.js
- [x] README rewrite
- [x] icon.svg → baseball (PNG regeneration in public/ still TODO — no converter installed)
- [ ] deploy-pages.yml: branch `master` → whatever the new repo uses

### Phase 1 — domain data (src/data/)  ✅ committed
- [x] teams.js — 30 MLB franchises, leagues (AFC=AL/NFC=NL), divisions by era, colors, PLAYOFF_ERAS
- [x] players.js (replaces qbs.js) — ~150 real MLB hitters, 12 tools, era
- [x] schemes.js — 8 hitting-approach philosophies
- [x] awards.js (data) — baseball icons, MLB_RECORDS; checkSeason/CareerRecords call sites migrated

### Phase 2 — attribute & rating core  ✅ (draft order + prospect-field rename deferred to a cleanup pass)
- [x] ATTRIBUTES (12 hitter tools) / groups (accuracy→hitting everywhere incl. development.js)
- [x] LEAGUE era table → avg/obp/slg/hrRate/bbRate/kRate/paPerGame; DECADE_BLURB
- [x] sim/ratings.js → HITTER_OVERALL_WEIGHTS (+ aliases), hitterOverall
- [x] STAT_CAL era ceilings/floors → avg/iso/hr/bb/k grounded in real record seasons
- [x] ERA_ATTR_MULT → baseball offensive-environment lean per era
- [x] CURVES / PRIME_CURVE → hitter aging (physical peak ~25-27, hitting ~28-31, mental ~31-34)

### Phase 3 — season sim  ✅ core (tuning + playoffs/box-score polish remain)
- [x] passerRating() → OPS+ index (h,pa,tb,hr,k,bb)
- [x] QB_INFLUENCE 0.45/0.35 → 0.12/0.10 (one bat barely moves team W/L)
- [x] generateSeason stat block → avg/iso/hr/bb/k signals → full batting line (PA/AB/H split/BB/K/HBP/SB/RBI/R/AVG/OBP/SLG/OPS/OPS+), legacy slot aliases kept
- [x] simulateRegularSeasonGames → per-game batting line, HR decoupled from scoreboard, rush slots → SB
- [x] simulatePlayerSeasonStats (rivals/bench) → same; RIVAL_STAT_SCALE 0.75→0.10
- [x] computeMetricBreakdown / admin calc → new keys (labels still football-ish)
- [x] leagueAvgRatingForDecade → 100 (era-relative OPS+)
- [x] sim/awards.js Pro Bowl/All-Pro/MVP thresholds retuned HR/OPS+ (not TD counts)
- [x] career.totals + rival totals carry bb/ab/2b/3b/sb/cs/rbi/runs
- [x] smoke test: full career runs 6 seasons, no page errors, plausible .270/.340/.450-ish lines
- [ ] simulateGameScore still produces football-scale scores (17-24, want 3-6 runs)
- [ ] resolvePlayoffs / animatePlayoffQuarters → innings/series reveal
- [ ] per-game gameLog HR/TB sums drift from reconciled season line (schedule tab cosmetic)
- [ ] season-rate tuning sweep (project norm) — coefficients are first-pass

### Phase 3 — game-score engine  ✅
- [x] scoreForInning (was scoreForQuarter): shallow run-scoring half-inning, most scoreless
- [x] simulateRegulationScore → 9 innings, home team skips bottom 9th if ahead
- [x] resolveOvertime → extra innings until someone leads a full frame (cap 21, then coin flip)
- [x] overtimeRulesForYear / tieProbability → baseball (ties ~never; pre-1975 rare called games)
- [x] approxGameScore → run totals (winners ~3-7, margins ~1-4)
- [x] simpleWinProb → 0.0032 coef, clamp [.35,.66] (best ~107 wins, worst ~57) — records now realistic
- [x] generateGameBoxScore → per-game batting line (ab/r/h/2b/3b/hr/rbi/bb/k/sb + legacy aliases)
- [x] animatePlayoffQuarters reveal: inning labels (1st/2nd…), "Sim to 5th" / "Sim to Final Out",
      Key Moment checkpoint moved to after the 6th, eligibility retuned to run-differential
- [x] verified: reg-season records 76-89 range, game scores baseball-scale, LCS/WS games low-run
- [ ] playoff rounds are still single games, not best-of-5/7 series (follow-up)
- [ ] per-game gameLog HR/TB vs reconciled season line still drifts slightly (schedule tab cosmetic)
- [ ] career length looks short in spot checks (~4-6 seasons) — watch during Phase 4/5 (waiver/durability)
- [ ] seeded tuning sweep still owed on all Phase 3 coefficients

### Phase 4 — player entity / roster / league  ✅ (functional; deep identifier rename deferred)
- [x] POSITIONS + randomPosition + positionLabel; identity.position field + picker in career setup
- [x] career.position stored, shown on draft night / HOF header / baseball card / roster row
- [x] draftSlotFor → MLB draft (20 rounds, 1st round 1-30, Day 1/2/3 labels)
- [x] draft-night flavor + "MLB Draft" + "Report to spring training" + draft screen label
- [x] league-news feed titles → baseball (Designates a Bench Bat / Signs a Free-Agent Bench Bat /
      Drafts a Prospect / Bench Bat Wins an Everyday Job / Regular Hits the IL / Free-Agent Signing)
- [x] buildDepthChartRowHTML → "Roster — <position>", Everyday/Bench instead of QB1/QB2/QB3
- [x] backup/incumbent season narratives → bench-year / everyday-job framing, HR/RBI/OPS+ snapshot
- [x] FA offer reason strings + GM press-conference flavor
- [ ] internal identifiers kept opaque: assignQuarterbackToRoster, QB1/QB2/QB3 role keys,
      USER_QB_ID, career.qbsById, leagueRivals, leagueDepthCharts, career.isBackup — load-bearing
      across ~40 sites, no functional gain in renaming; visible labels handled in Phase 10
- [ ] League/Depth tab column headers (QB / Comp% / Att / Yds / TD / INT) — Phase 10
- [ ] rival/bench totals objects don't init the new bb/ab/2b/3b fields (guarded at accumulation)

### Phase 5 — contracts / FA / injuries / events  ✅ (narrative; deep cap-ledger unchanged)
- [x] CONTRACT_SCALE rebuilt with MLB salary history per era; rookieAPY round bands widened
- [x] CONTRACT_STRUCTURES labels/subs → payroll/luxury-tax framing
- [x] INJURY_TYPES → IL stints (hamstring/oblique/wrist/HBP fracture/shoulder/back/meniscus/
      thumb/concussion/ACL/Achilles), keys mapped to hitter tools
- [x] AI_SUSPENSION_REASONS → PED / domestic violence policy / conduct / Rule 21 gambling
- [x] coordinator carousel → hitting-coach-gets-a-manager-job "success tax" (round literals kept)
- [x] INFRACTION_EVENTS: dugout meltdown, day-game-after-night-game, "baseball story"
- [x] RARE_EVENTS / POSITIVE_EVENTS: swing overhaul, hitting lab, Roberto Clemente Award,
      spin pickup, late innings, cleat deal
- [x] LIFEPATH_EVENTS: bat flip goes viral, airmailed warmup throw, OPS not completion %
- [x] RIVALRY_EVENTS: benches-clearing shove, won't-acknowledge-all-series, "best I've faced"
- [x] ORG_EVENTS: top bat leaves FA, rotation overhaul, new ballpark, manager not coach
- [x] LEAGUE_NEWS_EVENTS: prospect bust, spring injuries, Opening Day, payroll cuts, hitting coach
- [x] LOCKER_ROOM_EVENTS: unhappy slugger, winning over the pitching staff, hitting-coach friction,
      "clubhouse" everywhere; at-bat not snap
- [x] renderWaivedEvent / renderTradeEvent / renderInjuryEvent / expansion → IL, 40-man, clubhouse
- [x] expansionDraftCheck is data-driven off TEAMS[].start — MLB expansion years already correct
- [ ] evaluatePerformanceOverExpectation still takes football stat inputs (works; ~approx)
- [ ] the 5 team grades (O-Line/Weapons/Defense/Coaching/Front Office) still football-named — Phase 7/10
- [ ] achievement hint text ("passing touchdowns") — Phase 8

### Phase 6 — Key Moments: the clutch at-bat  ✅
- [x] sim/keyMoments.js PLAY_CALLS → 8 batter approaches (sit dead-red / ambush / spit on the
      corners / take your walk / two-strike protect / A-swing / work a deep count / stay within
      yourself). Ids + goodWhen/badWhen kept so the balance tests + counter map hold.
- [x] OPPONENT_TENDENCIES → 8 pitcher archetypes (fastball-heavy / pounds the zone early / lives on
      the black / nibbles with a lead / chase-bait / overpowering FB late life / crafty command
      lefty / bears down with runners on). Ids unchanged.
- [x] TENDENCY_SUBTLE_CLUES → observational pitcher tells; KEY_MOMENT_SITUATIONS → 18 late-inning
      at-bat scenarios matching each id's flags (flag names kept, baseball meaning documented)
- [x] keyMomentClue → hitting coach / advance report / dugout tape
- [x] KEY_MOMENT_SCORE_TYPES → runs (RBI single / two-run double / three-run homer / grand slam /
      bases-loaded walk); MEH → hard-hit out / run on the play
- [x] applyKeyMomentSwing → swing lands on the 7th inning (index 6, matches the post-6th checkpoint),
      extra-innings re-derive, HR box-score sync; heading "Late innings. This at-bat decides it."
- [x] verified live: KM renders, clue/options/outcome all baseball, resolves with no page error;
      key-moments.node.mjs 6/6

### Phase 7 — awards / records / Cooperstown  ✅
- [x] award label strings: "Pro Bowl"→"All-Star", "First-Team All-Pro"→"Silver Slugger",
      "Second-Team All-Pro"→"All-MLB Second Team"; MVP unchanged. internal proBowl/allPro field
      names kept (opaque). ledger award_won check updated.
- [x] new: resolveSeasonStatTitlesAndROY → Batting Title / Home Run Title / RBI Title / Rookie of
      the Year (comparative, league-wide, off qbsById); maybeAwardGoldGlove → player-only self-check
      (ARM × position defWeight, DH excluded)
- [x] SIM_BEST_METRICS → HR / RBI / OPS+ / Hits / SB
- [x] confLabel → American/National League; superBowlDisplayName → "World Series";
      roundDisplayLabel → Wild Card Series / Division Series / ALCS-NLCS / World Series
- [x] ring: preSBEra logic removed (World Series always existed); "World Series Champion"
- [x] computeHofScore retuned (OPS+ quality, lower accolade weights, hits/HR/RBI volume cap);
      tiers → First-Ballot HOF / HOF / Hall of Very Good / Longtime Regular / Journeyman / Cup of
      Coffee; notes → Cooperstown/writers/big-league framing
- [x] buildHofNarrative + buildTrophyCaseHTML → baseball text (HR/OPS+/AVG, October, clubhouse,
      bronze plaque, Silver Slugger / All-Star)
- [x] career longevity fix: rookie contract 4→6 yrs (MLB team control), STARTER_CAREER_MEAN_YEARS
      9.5→12, age caps 23-48→25-44, agingVetThreshold base 32→34, waiverCheck now compares to a
      neutral-build edge instead of a flat football-scale threshold (young players were racking up
      a badStreak and getting cut by year 4), performanceTier thresholds lowered for the hitter scale
- [ ] rival contract terms bumped (elite 5-9 yrs) — light
- [ ] test helper advanceOneSeason stalls at the FA offer screen (multi-choice) — Phase 11

### Phase 8 — achievements  ✅
- [x] ~90 ACHIEVEMENTS rewritten wholesale for baseball, keeping every rule-builder pattern
      (seasonRule / consecutiveSeasonRule / everySeasonRule / eventCountRule / sequenceRule /
      ledgerStep / sameFieldAs / groupCountRule) and every ledger eventId hook
- [x] season stat achievements → 30-30, 40-40, 50 HR, 200 hits, .430 OBP, Triple Crown, the Eye,
      Can't Be Struck Out, the Green Light (45 SB), Video-Game Numbers (175 OPS+), Gap to Gap
- [x] accolade achievements → All-Star ×10, Silver Slugger ×5, Gold Glove ×5, Batting Champion ×4,
      Home Run King ×4, Rookie Phenom, the Ironman (12 yrs no IL), the 500 Club, 3,000 Hits
- [x] team-specific → real MLB ids + lore: 108 Years (CHC), Reverse the Curse (BOS), Bronx Dynasty
      (NYY), Cleveland Finally (CLE), Cardinal Way (STL), Even Year Magic (SF), End the Wait (SEA),
      Worst to First (ATL), the Window (HOU), Two Strikes Away (TEX), We Are Family (PIT),
      Moneyball (OAK), Homer Hankies (MIN), Back-to-Back in Toronto (TOR), Ya Gotta Believe (NYM),
      Blue Bloods (LAD)
- [x] dark-humor achievements kept (same hadLifeEvent hooks on RARE_EVENTS)
- [x] ledger chains reframed (luxury-tax casualty, coaching carousel, revenge tour, walk-off wins,
      a ring in each league) — internal "Super Bowl"/"Conference Championship" metadata literals kept
- [x] achievement-rules.node.mjs 15/15; smoke green
- [ ] opponent-id-ledger revenge regression fails on the FA-screen helper stall (Phase 11)

### Phase 9 — multiplayer (Parallel Universe / Private Match)  ✅
- [x] sim/multiplayerScore.js: caps retuned for baseball (rings→5 WS, OPS+ floor/ceiling 90/155,
      total bases 6000, games 2800, achievements 92, earnings 500M); accolade weights mvp*4 /
      SS*2 / All-Star*0.8; comments reframed
- [x] sim/matchCode.js: RESULT_CODE_PREFIX "GLR1" → "DLR1"; era-index comment
- [x] MP hub / create / join / compare screen copy → Showcase not Combine, "the better hitter wins"
- [x] eraChrome news-desk chrome → The Baseline / Diamond Sports Desk / DiamondLab.net / @diamondlab
- [x] matchCode.node.mjs corrupted-payload test prefix updated (GLR1→DLR1)
- [ ] 2 MP Playwright regressions fail on RNG seed drift (rookie-season injury interstitial,
      hardcoded GLR1 prefix assertion) — Phase 11 re-seeding

### Phase 10 — UI / copy / CSS  ✅ (core; deep prose residue tracked)
- [x] index.html full copy pass (menu, showcase setup, draft, results explainers, summary,
      trophy room, achievements, MP screens, footer)
- [x] 5 team grades relabeled (Rotation/Lineup/Defense & Bullpen/Coaching Staff/Front Office)
- [x] season card stat widgets → AVG/OBP/SLG · HR · Hits · OPS+ (+ PA/SB/BB/K mini row)
- [x] TREND_STATS + Career Trends table + League tab leaderboard → baseball columns/sorters
- [x] rival profile + box-score modal + estimateSingleGameStatLine → batting lines
- [x] gradeFor flavors, baseball card face, Scheme tab → Approach, dev-plan names
- [x] eraChrome news-desk chrome (Phase 9)
- [x] bug fix: 1B/2B/3B/HR split (6 HR / 80 doubles seasons) — HR now a share of power output
- [ ] admin Stat Calculator tab labels still football-ish (Comp%/Y-A/TD%) — admin-only, low priority
- [ ] buildStandingsTabHTML / buildPlayoffTreeTabHTML deep labels — spot-check in Phase 11
- [ ] renderYardTicks / .yardline CSS class names kept (internal, not user text)
- [ ] CSS: no football content strings; .era-* chrome kept

### Phase 11 — tests
### Phase 12 — docs / final build
