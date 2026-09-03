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

### Phase 5 — contracts / FA / injuries / events
### Phase 6 — Key Moments (batter vs pitcher)
### Phase 7 — awards / records / HOF (Cooperstown)
### Phase 8 — achievements
### Phase 9 — multiplayer (matchCode DLR1, score weights)
### Phase 10 — UI / copy / CSS
### Phase 11 — tests
### Phase 12 — docs / final build
