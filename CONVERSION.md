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

### Phase 2 — attribute & rating core  (in progress)
- [x] ATTRIBUTES (12 hitter tools) / groups (accuracy→hitting everywhere incl. development.js) / GROUP_LABEL/ORDER
- [x] LEAGUE era table → avg/obp/slg/hrRate/bbRate/kRate/paPerGame; DECADE_BLURB
- [x] sim/ratings.js → HITTER_OVERALL_WEIGHTS (+ back-compat aliases), hitterOverall
- [ ] STAT_CAL era ceilings/floors → AVG/OBP/SLG/HR/K/BB grounded in real record seasons
- [ ] ERA_ATTR_MULT (era stat multipliers) — still football
- [ ] CURVES / PRIME_CURVE / DEVELOPMENT_CURVES → hitter aging (peak 26-29)
- [ ] draftSlotFor / chooseDraftTeam — MLB draft order
- [ ] evaluateProspect return field footballOverall→hitterOverall (+ 3 main.js sites)

### Phase 3 — season sim
- [ ] stat pipeline (PA/AB/H split/BB/K/RBI/R/SB → AVG/OBP/SLG/OPS/OPS+)
- [ ] schedule/standings (162g, series), simpleWinProb (low hitter influence)
- [ ] playoffs (round literals, best-of-N series, reveal)
- [ ] offense/defense grade → lineup / pitching-staff grade

### Phase 4 — player entity / roster / league
### Phase 5 — contracts / FA / injuries / events
### Phase 6 — Key Moments (batter vs pitcher)
### Phase 7 — awards / records / HOF (Cooperstown)
### Phase 8 — achievements
### Phase 9 — multiplayer (matchCode DLR1, score weights)
### Phase 10 — UI / copy / CSS
### Phase 11 — tests
### Phase 12 — docs / final build
