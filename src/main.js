import { showRewardedAd } from "./ads/rewardedAd.js";
import { openDialog, closeDialog } from "./ui/dialog.js";
import { TEAMS, TEAM_COLORS, DIVISIONS, DIVISIONS_1994_2012, DIVISIONS_1969_1993, DIVISIONS_PRE_1970, PLAYOFF_ERAS } from "./data/teams.js";
import { PLAYERS as QBS } from "./data/players.js";
import { SCHEMES } from "./data/schemes.js";
import { shuffle, pick, clamp, randInt, lerp, svgEscape, fmtPct, safeNum, fmtMoney, fmtDelta, recordLine } from "./utils/index.js";
import { BADGE_ICONS, MLB_RECORDS, TROPHY_ICONS } from "./data/awards.js";
import { FOOTBALL_OVERALL_WEIGHTS as OVERALL_WEIGHTS, chooseDraftTeam, evaluateProspect } from "./sim/ratings.js";
import {
  KEY_MOMENT_BASE_TRIGGER_CHANCE,
  KEY_MOMENT_SITUATION_FLAGS,
  PLAY_CALLS,
  executeKeyMomentQuality,
  keyMomentCallScore,
} from "./sim/keyMoments.js";
import { evaluateSeasonAwardScores, expectedWinPctForTeamOverall } from "./sim/awards.js";
import {
  maxConsecutive as ruleMaxConsecutive, seasonRule, consecutiveSeasonRule, everySeasonRule,
  eventCountRule, sequenceRule, ledgerStep, sameFieldAs, groupCountRule, allOf, anyOf, not as ruleNot,
} from "./sim/achievementRules.js";
import { installSeededRandom, restoreRandom } from "./sim/prng.js";
import { encodeMatchCode, decodeMatchCode, encodeResultCode, decodeResultCode, DECADE_COUNT as MP_DECADE_COUNT } from "./sim/matchCode.js";
import { computeMatchScore } from "./sim/multiplayerScore.js";
import {
  DEVELOPMENT_PLAN_LIST,
  advanceDevelopmentSeason,
  applyOffseasonPlanResources,
  developmentBaseForOverall,
  developmentCoachingMultiplier,
  developmentPlanFor,
  developmentSpeedTag as devSpeedTag,
  developmentSwingChance,
  earnedBreakthroughChance,
  evaluatePerformanceOverExpectation,
  nextBreakthroughMomentum,
  rollDevelopmentSpeed as rollDevSpeed,
} from "./sim/development.js";

(function(){
  "use strict";

  /* ================= Data ================= */
  // The 12 hitter tools. Keys are inherited unchanged from the Gridiron Lab skeleton (ATTR_KEYS,
  // the radar chart, the development curves, and every scheme multiplier key off these 3-letter
  // codes); only the labels and the group a tool belongs to changed for baseball. The group
  // formerly called "accuracy" is now "hitting".
  const ATTRIBUTES = [
    {"key":"ARM","label":"Arm Strength","group":"physical"},
    {"key":"REL","label":"Bat Speed","group":"physical"},
    {"key":"MOB","label":"Speed","group":"physical"},
    {"key":"IMP","label":"Baserunning Instinct","group":"physical"},
    {"key":"DAC","label":"Raw Power","group":"hitting"},
    {"key":"SHA","label":"Contact Hitting","group":"hitting"},
    {"key":"TCH","label":"Bat Control","group":"hitting"},
    {"key":"PKT","label":"Plate Discipline","group":"hitting"},
    {"key":"ANT","label":"Pitch Recognition","group":"mental"},
    {"key":"DEC","label":"Plate Approach","group":"mental"},
    {"key":"CLU","label":"Clutch","group":"mental"},
    {"key":"DUR","label":"Durability","group":"mental"},
  ];
  const DECADES = ["1960s","1970s","1980s","1990s","2000s","2010s","2020s"];
  const DECADE_BLURB = {"1960s":"Pitching rules the earth — high mounds, big parks, a .240 hitter plays every day. 1968 is the nadir.","1970s":"Turf, the DH arrives in the AL, and speed comes back. Contact and stolen bases over the long ball.","1980s":"Balanced baseball — 30-30 seasons, artificial turf gap power, and the leadoff man as a weapon.","1990s":"Expansion, smaller parks, and the start of an offensive surge. Forty homers stops being special.","2000s":"The height of the offensive era — 50-homer seasons, .300 team averages, and a rewritten record book.","2010s":"The strikeout explosion and the launch-angle revolution. Velocity up, contact down, defense shifted.","2020s":"Three true outcomes, a lively then a deadened ball, the universal DH, and a pitch clock."};
  // Per-era league-average rate context, consumed by the season stat engine. `games` is the
  // schedule length; the rest are the offensive environment a league-average regular posts.
  //   avg   batting average        obp   on-base percentage      slg   slugging percentage
  //   hrRate  HR per plate appearance     bbRate  BB per PA      kRate  K per PA
  //   paPerGame  plate appearances a full-time hitter gets per team game
  const LEAGUE = {
    "1960s":{ games:162, avg:0.248, obp:0.312, slg:0.375, hrRate:0.021, bbRate:0.082, kRate:0.157, paPerGame:4.2 },
    "1970s":{ games:162, avg:0.256, obp:0.322, slg:0.375, hrRate:0.019, bbRate:0.085, kRate:0.135, paPerGame:4.2 },
    "1980s":{ games:162, avg:0.258, obp:0.324, slg:0.393, hrRate:0.021, bbRate:0.085, kRate:0.138, paPerGame:4.2 },
    "1990s":{ games:162, avg:0.266, obp:0.335, slg:0.418, hrRate:0.027, bbRate:0.090, kRate:0.163, paPerGame:4.25 },
    "2000s":{ games:162, avg:0.267, obp:0.335, slg:0.427, hrRate:0.030, bbRate:0.088, kRate:0.168, paPerGame:4.25 },
    "2010s":{ games:162, avg:0.255, obp:0.320, slg:0.410, hrRate:0.028, bbRate:0.079, kRate:0.204, paPerGame:4.2 },
    "2020s":{ games:162, avg:0.246, obp:0.317, slg:0.407, hrRate:0.031, bbRate:0.085, kRate:0.223, paPerGame:4.15 },
  };
  // ---- Career stat ceilings/floors ----
  // Each era's realistic rate-stat range is grounded against real record seasons and that era's
  // LEAGUE average above. The season engine derives five primitives from the build's era/scheme/
  // age-adjusted edge over a neutral (65-everywhere) baseline, then clamps each to [lo, hi]:
  //   avg  batting average (H/AB)        iso  isolated power (SLG - AVG)
  //   hr   home runs per plate appearance                 bb  walks per PA
  //   k    strikeouts per PA (LOWER is better -- the formula sites invert this one, like INT was)
  // CEILING sources (illustrative, not a certified encyclopedia): Bonds 2001 (.863 SLG, 73 HR,
  //   .515 OBP), Bonds 2004 (.609 OBP), McGwire 1998 (.470 ISO), Brett 1980 / Gwynn 1994 (~.394
  //   AVG), Ted Williams 1941 (.406, pre-scope), Gwynn (career ~4.5% K), Judge 2022 (62 HR).
  // Ceilings ACCUMULATE forward across eras (a 2020s build can still reach a mark set in the
  // 1990s); the FLOOR is a flat, era-independent estimate (nobody keeps a "worst regular" board).
  // Field meaning matches the old table: lo/hi are the hard clamp bounds; up/down are the
  // coefficients on the build's blended delta from neutral (up when delta>=0, down when negative).
  const STAT_CAL = {
    "1960s": { avg:{lo:0.195,hi:0.394,up:0.0150,down:0.0075}, iso:{lo:0.045,hi:0.330,up:0.0300,down:0.0110},
      hr:{lo:0.0015,hi:0.078,up:0.0075,down:0.0026}, bb:{lo:0.020,hi:0.230,up:0.0210,down:0.0080}, k:{lo:0.030,hi:0.360,up:0.0130,down:0.0250} },
    "1970s": { avg:{lo:0.198,hi:0.394,up:0.0150,down:0.0078}, iso:{lo:0.045,hi:0.340,up:0.0310,down:0.0110},
      hr:{lo:0.0015,hi:0.080,up:0.0078,down:0.0026}, bb:{lo:0.020,hi:0.245,up:0.0220,down:0.0082}, k:{lo:0.030,hi:0.360,up:0.0130,down:0.0250} },
    "1980s": { avg:{lo:0.200,hi:0.394,up:0.0150,down:0.0080}, iso:{lo:0.050,hi:0.360,up:0.0330,down:0.0120},
      hr:{lo:0.0018,hi:0.086,up:0.0084,down:0.0028}, bb:{lo:0.022,hi:0.255,up:0.0230,down:0.0085}, k:{lo:0.030,hi:0.380,up:0.0135,down:0.0260} },
    "1990s": { avg:{lo:0.200,hi:0.394,up:0.0152,down:0.0082}, iso:{lo:0.052,hi:0.430,up:0.0400,down:0.0130},
      hr:{lo:0.0018,hi:0.100,up:0.0098,down:0.0030}, bb:{lo:0.024,hi:0.290,up:0.0260,down:0.0090}, k:{lo:0.030,hi:0.400,up:0.0150,down:0.0280} },
    "2000s": { avg:{lo:0.200,hi:0.394,up:0.0150,down:0.0082}, iso:{lo:0.055,hi:0.470,up:0.0440,down:0.0140},
      hr:{lo:0.0018,hi:0.112,up:0.0110,down:0.0032}, bb:{lo:0.026,hi:0.320,up:0.0290,down:0.0095}, k:{lo:0.030,hi:0.400,up:0.0150,down:0.0280} },
    "2010s": { avg:{lo:0.198,hi:0.394,up:0.0148,down:0.0082}, iso:{lo:0.055,hi:0.470,up:0.0440,down:0.0142},
      hr:{lo:0.0018,hi:0.112,up:0.0112,down:0.0033}, bb:{lo:0.026,hi:0.320,up:0.0290,down:0.0098}, k:{lo:0.030,hi:0.420,up:0.0160,down:0.0300} },
    "2020s": { avg:{lo:0.195,hi:0.394,up:0.0146,down:0.0082}, iso:{lo:0.055,hi:0.470,up:0.0440,down:0.0142},
      hr:{lo:0.0018,hi:0.115,up:0.0116,down:0.0034}, bb:{lo:0.026,hi:0.320,up:0.0290,down:0.0098}, k:{lo:0.030,hi:0.430,up:0.0165,down:0.0310} },
  };
  // Rival hitters (simulateRivalSeasons) are driven off a single "talent" scalar instead of the
  // player's twelve-tool build. Their talent-vs-65 `delta` is RAW (not run through the player's
  // STAT_BLEND/STAT_SENSITIVITY compression, ~0.34x), so this scale has to absorb that compression
  // itself plus stay conservative -- a hand-built min-maxed archetype should out-hit a random
  // league talent grade. First pass at 0.30 gave talent-90 rivals 70+ HR / .390 seasons league-
  // wide; 0.10 brings a talent-90 to a believable ~35-40 HR / ~.300 peak. Re-verify with a seeded
  // sweep if live seasons still cluster near the records.
  const RIVAL_STAT_SCALE = 0.10;

  const ATTR_KEYS = ATTRIBUTES.map(a=>a.key);
  const ATTR_BY_KEY = Object.fromEntries(ATTRIBUTES.map(a=>[a.key,a]));

  /* ----- Era-adjusted combine ratings -----
     The raw QBS ratings sit on one flat 0-99 scale, so an attribute a given era simply valued
     less (touch/anticipation passing in the 1960s, etc.) reads as uniformly bad next to a modern
     player's card, even for someone who was the best of his own generation at it. Combine cards
     display a value NORMALIZED against that attribute's own decade average instead of the raw
     number, so "elite for his era" always reads as elite no matter which era a round happens to
     roll. Relative ranking within a round is unaffected -- every round's 4 candidates are always
     from the same decade (see rollCandidates), so this is a decade-wide shift, not a reordering.
     The normalized value is also what gets stored into the build when picked, so an "authentic
     old-era" build doesn't get double-penalized later by ERA_ATTR_MULT during career sim on top
     of an already-deflated raw pick. */
  const ERA_ATTR_AVG = {};
  DECADES.forEach(d=>{
    const pool = QBS.filter(p=>p.decade===d);
    const avg = {};
    ATTR_KEYS.forEach(k=>{ avg[k] = pool.length ? pool.reduce((s,p)=>s+p.r[k],0)/pool.length : 65; });
    ERA_ATTR_AVG[d] = avg;
  });
  function eraNormalizedValue(player, key){
    const avg = (ERA_ATTR_AVG[player.decade]||{})[key];
    if(avg==null) return player.r[key];
    return clamp(Math.round(65 + (player.r[key]-avg)), 15, 99);
  }

  /* ================= Utilities ================= */

  /* ----- reusable inline-SVG charts: no chart library, just plain SVG strings, so every
     visual works inside a single self-contained HTML file. ----- */

  function renderRadarChartSVG(attrs, opts={}){
    const size = opts.size || 340;
    const cx = size/2, cy = size/2;
    const radius = size*0.34;
    const labelR = radius + 22;
    const n = attrs.length;
    const angleFor = i => (-90 + (360/n)*i) * Math.PI/180;
    const rings = [0.25, 0.5, 0.75, 1];
    const ringPolys = rings.map(f=>{
      const pts = attrs.map((a,i)=>{
        const ang = angleFor(i);
        return `${cx + Math.cos(ang)*radius*f},${cy + Math.sin(ang)*radius*f}`;
      }).join(" ");
      return `<polygon points="${pts}" fill="none" stroke="var(--line-strong)" stroke-width="1"/>`;
    }).join("");
    const axisLines = attrs.map((a,i)=>{
      const ang = angleFor(i);
      const x = cx + Math.cos(ang)*radius, y = cy + Math.sin(ang)*radius;
      return `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="var(--line-strong)" stroke-width="1"/>`;
    }).join("");
    const dataPts = attrs.map((a,i)=>{
      const ang = angleFor(i);
      const f = clamp(a.value,0,100)/100;
      return `${cx + Math.cos(ang)*radius*f},${cy + Math.sin(ang)*radius*f}`;
    }).join(" ");
    const dataDots = attrs.map((a,i)=>{
      const ang = angleFor(i);
      const f = clamp(a.value,0,100)/100;
      const x = cx + Math.cos(ang)*radius*f, y = cy + Math.sin(ang)*radius*f;
      return `<circle cx="${x}" cy="${y}" r="3" fill="var(--field)"/>`;
    }).join("");
    const labels = attrs.map((a,i)=>{
      const ang = angleFor(i);
      const x = cx + Math.cos(ang)*labelR, y = cy + Math.sin(ang)*labelR;
      const anchor = Math.cos(ang)>0.25 ? "start" : Math.cos(ang)<-0.25 ? "end" : "middle";
      return `<text x="${x}" y="${y}" text-anchor="${anchor}" dominant-baseline="middle" class="radar-axis-label">${svgEscape(a.key)}</text>
        <text x="${x}" y="${y+11}" text-anchor="${anchor}" dominant-baseline="middle" class="radar-axis-value">${Math.round(a.value)}</text>`;
    }).join("");
    return `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img" aria-label="Attribute radar chart">
      ${ringPolys}${axisLines}
      <polygon points="${dataPts}" fill="var(--field)" fill-opacity="0.22" stroke="var(--field)" stroke-width="2"/>
      ${dataDots}
      ${labels}
    </svg>`;
  }

  function renderSparklineSVG(values, opts={}){
    const w = opts.width || 560, h = opts.height || 90, pad = 8;
    if(!values.length) return `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"></svg>`;
    const lo = Math.min(...values), hi = Math.max(...values);
    const range = (hi-lo) || 1;
    const stepX = values.length>1 ? (w-pad*2)/(values.length-1) : 0;
    const pts = values.map((v,i)=>{
      const x = pad + i*stepX;
      const y = h - pad - ((v-lo)/range)*(h-pad*2);
      return [x,y];
    });
    const line = pts.map(p=>p.join(",")).join(" ");
    const areaPath = `M${pts[0][0]},${h-pad} L` + pts.map(p=>p.join(",")).join(" L") + ` L${pts[pts.length-1][0]},${h-pad} Z`;
    const dots = pts.map((p,i)=>{
      const isLast = i===pts.length-1;
      return `<circle cx="${p[0]}" cy="${p[1]}" r="${isLast?3.5:2}" fill="${isLast?"var(--field)":"var(--good)"}"/>`;
    }).join("");
    return `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" preserveAspectRatio="none" role="img" aria-label="Trend over time">
      <path d="${areaPath}" fill="var(--good)" fill-opacity="0.12" stroke="none"/>
      <polyline points="${line}" fill="none" stroke="var(--good)" stroke-width="2"/>
      ${dots}
    </svg>`;
  }

  /* ----- playoff bracket: the game only tracks the games the player's own team actually
     played (not every parallel matchup across the bracket), so this renders that path — Wild
     Card through Super Bowl — as a connected chain of round boxes rather than a fabricated
     full bracket. The user's team is always the gold-highlighted side. ----- */
  // One playoff round's box markup -- extracted so it can be appended into the DOM progressively,
  // one round at a time, exactly when the player reaches it (see animatePlayoffQuarters), instead
  // of every round the player eventually took part in being rendered up front. That distinction
  // matters: even with every SCORE hidden behind placeholders, a "Conference Championship" box
  // simply existing on the page before the Wild Card game has been simmed still tells the player
  // they won both earlier rounds -- so the DOM itself must not contain a round's box until the
  // round before it has actually been finished as a win.
  function playoffRoundBoxHtml(r, i, year){
    const isSB = r.round==="Super Bowl";
    if(isSB){
      return `
        <div class="superbowl-box" data-round-idx="${i}" data-round-state="pending">
          <div class="sb-title" id="sbTitle-${i}">${svgEscape(roundDisplayLabel(r.round, year)).toUpperCase()}</div>
          <div class="sb-final" id="sbFinal-${i}">vs. the ${svgEscape(r.opponent)}</div>
          ${r._defOverall!=null ? `<div class="sb-oppgrade">Their team overall: <b>${Math.round(r._defOverall)}</b> &nbsp;·&nbsp; Your team overall: <b>${Math.round(career.teamStrength)}</b></div>` : ""}
          ${r._oppQbName ? `<div class="sb-oppgrade">Their QB: <button type="button" class="rival-link" data-rival-id="${r._oppQbId}">${svgEscape(r._oppQbName)}</button> (${r._oppQbOverall} overall)</div>` : ""}
          ${r.oppTendency ? `<div class="pr-tendency" style="color:var(--header-muted);text-align:center;">Scouting report: <b style="color:var(--header-accent);">${svgEscape(r.oppTendency.label)}</b> — ${svgEscape(r.oppTendency.blurb)}</div>` : ""}
          <div class="sb-quarters" id="pqQuarters-${i}"></div>
          <div class="pr-controls" id="pqControls-${i}"></div>
          <div class="sb-box" id="sbBox-${i}" style="display:none;">
            <div><div class="sbx-label">Comp/Att</div><div class="sbx-value tabular">${r.box.comp}/${r.box.att}</div></div>
            <div><div class="sbx-label">Yards</div><div class="sbx-value tabular">${r.box.yards}</div></div>
            <div><div class="sbx-label">TD</div><div class="sbx-value tabular">${r.box.td}</div></div>
            <div><div class="sbx-label">INT</div><div class="sbx-value tabular">${r.box.int}</div></div>
            ${r.box.rushAtt>0?`<div><div class="sbx-label">Rush</div><div class="sbx-value tabular">${r.box.rushAtt}-${r.box.rushYards}${r.box.rushTd?" · "+r.box.rushTd+" TD":""}</div></div>`:""}
          </div>
        </div>`;
    }
    const tendencyHtml = r.oppTendency ? `<div class="pr-tendency">Scouting report: <b>${svgEscape(r.oppTendency.label)}</b> — ${svgEscape(r.oppTendency.blurb)}</div>` : "";
    return `
      <div class="playoff-round-box" data-round-idx="${i}" data-round-state="pending">
        <div class="pr-box-title" id="prTitle-${i}">${svgEscape(roundDisplayLabel(r.round, year)).toUpperCase()}</div>
        <div class="pr-box-final" id="prFinal-${i}">vs. the ${svgEscape(r.opponent)}</div>
        ${r._defOverall!=null ? `<div class="pr-oppgrade">Their team overall: <b>${Math.round(r._defOverall)}</b> &nbsp;·&nbsp; Your team overall: <b>${Math.round(career.teamStrength)}</b></div>` : ""}
        ${r._oppQbName ? `<div class="pr-oppgrade">Their QB: <button type="button" class="rival-link" data-rival-id="${r._oppQbId}">${svgEscape(r._oppQbName)}</button> (${r._oppQbOverall} overall)</div>` : ""}
        ${tendencyHtml}
        <div class="pr-quarters" id="pqQuarters-${i}"></div>
        <div class="pr-controls" id="pqControls-${i}"></div>
      </div>`;
  }
  // renderPlayoffBracketSVG (the Season tab's own post-reveal single-path bracket summary,
  // shown once directly under the round-by-round reveal boxes) removed in Round 29 -- fully
  // redundant once the Playoff Tree tab existed as a real, better-looking, more complete place to
  // see the exact same real path, and a real, reported source of confusion sitting right next to
  // it (two different visual bracket systems for the same underlying data). The round-by-round
  // reveal itself (playoffRoundBoxHtml / #playoffRoundsHolder, just above this comment) is
  // untouched -- that's the actual interactive gameplay, not a redundant summary graphic.

  function curveVal(points, age){
    if(age<=points[0][0]) return points[0][1];
    for(let i=0;i<points.length-1;i++){
      const [a0,v0]=points[i], [a1,v1]=points[i+1];
      if(age>=a0 && age<=a1){ const t=(age-a0)/(a1-a0); return lerp(v0,v1,t); }
    }
    return points[points.length-1][1];
  }
  // Hitter aging: physical tools (bat speed / speed / arm / baserunning) peak early-mid 20s and
  // fade first; hitting skill (power / contact / bat control / plate discipline) holds through the
  // late 20s and declines gently; the mental group (pitch recognition / approach / clutch) keeps
  // improving into the early-mid 30s and erodes the least -- the "old-player skills" that let a
  // career run to 40.
  const CURVES = {
    physical: [[21,0.88],[23,0.95],[25,1.00],[27,1.00],[29,0.98],[31,0.93],[33,0.86],[35,0.76],[37,0.64],[39,0.52],[41,0.42]],
    hitting:  [[21,0.80],[23,0.88],[26,0.96],[28,1.00],[31,1.00],[33,0.97],[35,0.92],[37,0.85],[39,0.76],[41,0.66]],
    mental:   [[21,0.66],[23,0.76],[25,0.86],[27,0.93],[29,0.98],[31,1.00],[34,1.00],[36,0.98],[38,0.94],[40,0.88],[42,0.80]],
  };
  function ageMultiplier(group, age){ return curveVal(CURVES[group] || CURVES.mental, age); }

  // Separate from the neutral-baseline mechanic (which cancels raw age-curve noise so a
  // rookie's build doesn't read as "bad" just for being 22): this curve independently caps how
  // much of a build's talent EXPRESSES itself statistically at a given age. It's mild for young
  // players (still adjusting to the speed of the pro game) and real for older ones — even a
  // well-preserved 38-year-old throws a visibly smaller season than his 27-year-old self, on
  // top of whatever the neutral comparison already accounts for. This is what makes careers
  // regress with age instead of staying statistically flat until a hard cutoff.
  const PRIME_CURVE = [[21,0.86],[23,0.93],[25,0.98],[27,1.00],[30,1.00],[32,0.97],[34,0.91],[36,0.82],[38,0.71],[40,0.58],[42,0.45]];
  function primeMultiplier(age){ return curveVal(PRIME_CURVE, age); }

  /* ================= Development =================
     Everything above (CURVES/ageMultiplier, PRIME_CURVE/primeMultiplier) governs how much of a
     FIXED build's talent gets EXPRESSED at a given age -- it never touches the build itself. Until
     now the actual attribute numbers were static for the whole career (aside from a rare permanent
     injury hit or a temporary event boost), so a 22-year-old rookie's true skill was, mechanically,
     exactly as good as it would ever get. This section makes the build itself grow and decline over
     a career -- real development, not just re-expression of the same fixed number.
     Driven by three things, deliberately NOT by how well a season actually went (no rich-get-richer
     snowball where a hot season accelerates growth):
       1. Age + attribute group, via the shared DEVELOPMENT_CURVES module -- mental attributes (DEC/ANT/CLU)
          grow the longest and decline the least, matching how football IQ/experience actually age;
          accuracy/technical (SHA/DAC/TCH/PKT/REL) grows hard early on real reps and coaching, then
          erodes mildly late; physical (ARM/MOB/IMP) gets a small early bump from strength/
          conditioning gains, then declines the earliest and steepest -- arm strength and mobility
          are the most visibly age-limited parts of the position in real football.
       2. Actual reps: growth scales with gamesPlayedShare THAT season (see experienceFactor below)
          -- a QB stuck on a clipboard develops slower than one thrown into full-time starts, same
          as real player development. A season lost to injury/suspension still gives a reduced floor
          (meeting rooms and practice reps still count for something).
       3. devSpeed, a hidden per-career trait rolled once at the Combine -- some builds are simply
          faster or slower developers than others, the same real-world scouting uncertainty that
          makes "what's his ceiling" an actual question rather than a solved one. Surfaced to the
          player (not hidden as a spoiler stat) in the Stat Calculator tab's Career Development card.
     DUR is deliberately excluded, same as everywhere else it's treated specially -- see the note by
     ERA_ATTR_MULT: it's a fixed personal toughness trait, only ever moved by a permanent injury hit
     or the offseasontrain event boost, never by ordinary development. */
  // A rival/bench QB's real, persistent pass-volume identity -- rolled once (lazily, same pattern
  // as devSpeed/durability) rather than re-rolled every season, since not every real NFL team runs
  // a high-volume passing scheme. Bell-shaped in [-1,1], skewed slightly toward run-first (most
  // teams cluster near league-average volume; a real tail runs meaningfully lower). Part of the
  // stat-realism pass: previously every rival was modeled as an equally high-volume passer every
  // year, which alone was enough for a perfectly average-talent QB to approach 4200+ yards.
  function rollVolumeLean(){
    const r = (Math.random()+Math.random()+Math.random())/3*2-1;
    return clamp(r - 0.15, -1, 1);
  }
  // Applies this season's development to `build` in place, based on the season just played (so a
  // season's OWN production always uses the pre-development attribute values -- growth from a
  // season's reps pays off starting next season, same as career.age++ in nextSeason()). Called at
  // the end of generateSeason, after that season's stats/awards are already locked in.
  function developAttributes(season, decade, league){
    if(!career.devSpeed) return; // guards old/replayed states with no devSpeed roll
    const result = advanceDevelopmentSeason({
      build,
      originalBuild: career.originalBuild || build,
      carry: career.devCarry || {},
      ceilingBonus: career.devCeilingBonus || {},
      devSpeed: career.devSpeed,
      breakoutCount: career._breakoutCount,
      bustCount: career._bustCount,
      earnedBreakthroughCount: career._earnedBreakthroughCount,
      breakthroughMomentum: career.breakthroughMomentum,
    }, {
      age: career.age,
      gamesPlayed: season.games,
      leagueGames: league.games,
      coaching: career.coaching,
      orgStability: !!career._orgStability,
      orgTurmoil: !!career._orgTurmoil,
      planId: career.developmentPlan,
      performance: {
        actual: {
          attempts: season.att,
          completions: season.comp,
          yards: season.yards,
          touchdowns: season.td,
          interceptions: season.int,
        },
        expected: season.developmentExpectation,
        leagueGames: league.games,
      },
    });

    build = result.build;
    career.originalBuild = result.originalBuild;
    career.devCarry = result.carry;
    career.devCeilingBonus = result.ceilingBonus;
    career.devSpeed = result.devSpeed;
    career._breakoutCount = result.breakoutCount;
    career._bustCount = result.bustCount;
    career._earnedBreakthroughCount = result.earnedBreakthroughCount;
    career.breakthroughMomentum = result.breakthroughMomentum;
    season.attrChanges = result.changes;
    season.developmentPlanId = result.planId;
    season.developmentReport = {
      performance: result.performance,
      performanceMultiplier: result.performanceMultiplier,
      momentumBefore: result.momentumBefore,
      momentumAfter: result.breakthroughMomentum,
      earnedBreakthroughChance: result.earnedBreakthroughChance,
    };

    if(result.arcEvent){
      season.devArcEvent = result.arcEvent;
      const labels = result.arcEvent.keys.map(k=> (ATTR_BY_KEY[k]||{}).label || k);
      if(result.arcEvent.type==="earned-breakthrough"){
        career.transactions.push(`${season.year}: Earned breakthrough -- sustained overperformance turns ${labels.join(", ")} into a new level of his game.`);
      } else if(result.arcEvent.type==="breakout"){
        career.transactions.push(`${season.year}: Breakout season — ${labels.join(", ")} all took a real step forward. He looks like a different player.`);
      } else {
        career.transactions.push(`${season.year}: A concerning stretch — ${labels.join(", ")} all slipped noticeably. Scouts are starting to ask questions.`);
      }
    }
  }

  function prepareDevelopmentPlanForSeason(){
    const plan = developmentPlanFor(career.developmentPlan);
    if(career._developmentPlanAppliedYear===career.year) return plan;
    const resources = applyOffseasonPlanResources({
      wear: career.wearAndTear,
      chemistry: career.teamChemistry,
    }, plan.id);
    career.wearAndTear = resources.wear;
    career.teamChemistry = resources.chemistry;
    career._developmentPlanAppliedYear = career.year;
    return plan;
  }

  function teamChemistryEdge(){
    return clamp((career.teamChemistry ?? 50) - 50, -50, 50);
  }

  function decadeForYear(year){
    const d = Math.floor(year/10)*10;
    const key = d + "s";
    return DECADES.includes(key) ? key : (year < 1960 ? "1960s" : "2020s");
  }

  /* ----- Experimental: era-themed event cards. A single wrapper (renderEraCard / eraWrap) that
     re-skins the visual chrome of an event card based on the decade currently being simulated —
     vintage newspaper, TV chyron, teletext, Web 1.0, forum post, push notification, social post.
     It never touches the inner markup (eyebrow/h3/p/choices) that each event-rendering function
     already builds, so every existing button id and class (#infAccept, .fa-accept, etc.) and its
     addEventListener wiring keeps working untouched — only the outer container and a few purely
     decorative, id-free header/footer bits change per era. ----- */
  function eraChrome(decade){
    switch(decade){
      case "1960s": return { wrapClass:"era-1960s",
        before:`<div class="era-tag">The Gridiron Gazette — Late Edition</div>` };
      case "1970s": return { wrapClass:"era-1970s",
        before:`<div class="era-scanlines"></div><div class="era-tag">◉ LIVE — GRIDIRON SPORTS DESK</div>` };
      case "1980s": return { wrapClass:"era-1980s",
        before:`<div class="era-tag">▌TELETEXT 108▐ GRIDIRON NEWS</div>` };
      case "1990s": return { wrapClass:"era-1990s",
        before:`<div class="era-tag">GridironLab.net</div>` };
      case "2000s": return { wrapClass:"era-2000s",
        before:`<div class="era-forum-head"><span class="era-forum-title">Thread: Breaking News</span><span class="era-forum-time">Posted ${randInt(1,11)}:${String(randInt(0,59)).padStart(2,"0")} ${Math.random()<0.5?"AM":"PM"}</span></div>` };
      case "2010s": return { wrapClass:"era-2010s", overlay:true, before:"" };
      case "2020s": return { wrapClass:"era-2020s",
        before:`<div class="era-social-head"><span class="era-social-avatar">🏈</span><span class="era-social-name">Gridiron Insider<span class="era-verified">✔</span></span><span class="era-social-handle">@gridironlab</span></div>`,
        after:`<div class="era-social-icons"><span>↩ Reply</span><span>⟲ Retweet</span><span>♥ Like</span></div>` };
      default: return { wrapClass:"", before:"", after:"" };
    }
  }
  function eraWrap(decade, innerHtml, opts){
    opts = opts || {};
    const toneClass = opts.tone==="bad" ? "event-card-bad" : opts.tone==="good" ? "event-card-good" : "";
    const chrome = eraChrome(decade);
    const card = `<div class="event-card ${chrome.wrapClass} ${toneClass}">${chrome.before||""}${innerHtml}${chrome.after||""}</div>`;
    return chrome.overlay ? `<div class="era-2010s-overlay">${card}</div>` : card;
  }
  function teamNameAt(teamId, year){
    const t = TEAMS.find(x=>x.id===teamId);
    if(!t) return teamId;
    for(const seg of t.names){ if(year>=seg.from && year<=seg.to) return seg.name; }
    return t.names[t.names.length-1].name;
  }
  function teamsAvailable(year){ return TEAMS.filter(t=>t.start<=year); }

  function teamColors(teamId){ return TEAM_COLORS[teamId] || ["#3a4a5c","#8a95a3"]; }
  function teamInitials(name){
    const last = name.split(" ").slice(-1)[0] || name;
    return last.slice(0,2).toUpperCase();
  }

  /* ----- player identity: name / college / hometown, all optional and randomizable ----- */
  const FIRST_NAMES = [
    "Marcus","Jalen","Trevor","Colt","Deshawn","Bryce","Kellen","Dax","Reggie","Chase",
    "Grayson","Malik","Tucker","Dominic","Cade","Jaxon","Landon","Miles","Truett","Isaiah",
    "Beau","Corey","Wyatt","Xavier","Levi","Sawyer","Damon","Elias","Reid","Zion",
    "Holden","Tyree","Nash","Barrett","Kingston","Emory","Jett","Rhett","Amir","Callahan",
  ];
  const LAST_NAMES = [
    "Kessler","Whitfield","Bramlett","Osei","McAllister","Dunbar","Villanueva","Strickland","Beaumont","Cutshall",
    "Delgado","Marchetti","Okafor","Prewitt","Sandoval","Tillery","Vance","Winslow","Yarborough","Zaleski",
    "Hargrove","Ledet","Munroe","Petrocelli","Quintero","Rutledge","Sorensen","Thibodeaux","Ulrich","Voss",
    "Broussard","Callender","Dietrich","Escamilla","Fontenot","Garrity","Hollis","Ibarra","Jorstad","Kilbride",
  ];
  // Fun easter egg: the gloriously fake football-player names from Key & Peele's "East/West
  // College Bowl" sketches (all three of them), folded into the name generator at low odds so
  // a league full of Marcus Kesslers occasionally turns up a Hingle McCringleberry. Deliberately
  // excludes the handful of names in the sketches that are actually real NFL players' names
  // (the joke there was "spot the real one among the fakes") and a few pure sound-effect/symbol
  // "names" that don't read right as a roster entry.
  const EASTER_EGG_NAMES = [
    "D'Marcus Williums","T.J. Juckson","T'Variusness King","Tyroil Smoochie-Wallace","D'Squarius Green Jr.",
    "Ibrahim Moizoos","Jackmerius Tacktheritrix","D'Isiah T. Billings-Clyde","D'Jasper Probincrux III",
    "Leoz Maxwell Jilliumz","Javaris Jamar Javarison-Lamar","Davoin Shower-Handel","Hingle McCringleberry",
    "L'Carpetron Dookmarriot","J'Dinkalage Morgoone","Xmus Jaxon Flaxon-Waxon","Saggitariutt Jefferspin",
    "D'Glester Hardunkichud","Swirvithan L'Goodling-Splatt","Quatro Quatro","Ozamataz Buckshank",
    "Beezer Twelve Washingbeard","Shakiraquan T.G.I.F. Carter","Sequester Grundelplith M.D.",
    "Scoish Velociraptor Maloish","T.J. A.J. R.J. Backslashinfourth V","Donkey Teeth","Torque Lewith",
    "Coznesster Smiff","Elipses Corter","Nyquillus Dillwad","Bismo Funyuns","Decatholac Mango",
    "Mergatroid Skittle","Quiznatodd Bidness","D'Pez Poopsie","Quackadilly Blip","Goolius Boozler",
    "Bisquiteen Trisket","Fartrell Cluggins","Blyrone Blashinton","Cartoons Plural","Jammie Jammie-Jammie",
    "Equine Ducklings","Dahistorius Lamystorius","Ewokoniad Sigourneth Juniorstein","King Prince Chambermaid",
    "Ladennifer Jadaniston","Creme De La Creme","Cosgrove Shumway","Doink Ahanahue","Legume Duprix",
    "Leger Douzable","Quisperny G'Dunzoid Sr.","Grunky Peep","Strunk Flugget","Stumptavian Roboclick",
    "Vagonius Thicket-Suede","Marmadune Shazbot","Swordless Mimetown","Faux Doadles","Myriad Profiteroles",
    "Busters Brownce","Turdine Cupcake","Rerutweeds Myth","Ishmaa'ily Kitchen","Snarf Mintz-Plasse",
    "Splendiferous Finch","Triple Parakeet-Shoes","Logjammer D'Baggagecling",
  ];
  function randomFullName(){
    if(Math.random()<0.04) return pick(EASTER_EGG_NAMES);
    return `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`;
  }

  const COLLEGES = [
    "Alabama","Ohio State","Georgia","Clemson","Oklahoma","USC","Michigan","LSU","Texas","Florida State",
    "Penn State","Notre Dame","Oregon","Wisconsin","Auburn","Florida","Tennessee","Miami (FL)","Texas A&M","Washington",
    "Michigan State","Iowa","UCLA","Baylor","TCU","Utah","North Carolina","Louisville","Mississippi","Stanford",
    "Boise State","Cincinnati","Memphis","Toledo","Fresno State","Appalachian State","Coastal Carolina","Youngstown State",
    "North Dakota State","Eastern Washington","Delaware","Villanova","James Madison","Sam Houston State",
  ];
  function randomCollege(){ return pick(COLLEGES); }

  const HOMETOWNS = [
    ["Odessa","TX"],["Massillon","OH"],["Aliquippa","PA"],["Thibodaux","LA"],["Valdosta","GA"],
    ["Ada","OK"],["Lakeland","FL"],["Concord","NC"],["Muncie","IN"],["Everett","WA"],
    ["Chandler","AZ"],["Folsom","CA"],["Owasso","OK"],["Southlake","TX"],["Bellevue","WA"],
    ["Hoover","AL"],["Marietta","GA"],["Council Bluffs","IA"],["Butte","MT"],["Cheyenne","WY"],
    ["Biloxi","MS"],["Fargo","ND"],["Bristol","CT"],["Erie","PA"],["Duluth","MN"],
    ["Provo","UT"],["Spokane","WA"],["Chattanooga","TN"],["Waco","TX"],["Canton","OH"],
    ["Napa","CA"],["Missoula","MT"],["Huntington","WV"],["Beaumont","TX"],["Rapid City","SD"],
    ["Macon","GA"],["Flint","MI"],["Yuma","AZ"],["Bangor","ME"],["Laramie","WY"],
  ];
  function randomHometown(){ const h = pick(HOMETOWNS); return { city:h[0], state:h[1] }; }

  // Fielding position -- an identity/flavor field that also gates the Gold Glove and gives a
  // small defensive contribution. Weighted a little toward the bat-first spots most star hitters
  // actually play. `key` is the internal code, `label` the display name, `defWeight` how much the
  // Arm Strength tool matters for that spot's defensive value.
  const POSITIONS = [
    { key:"C",  label:"Catcher",       w:8,  defWeight:0.9 },
    { key:"1B", label:"First Base",    w:14, defWeight:0.3 },
    { key:"2B", label:"Second Base",   w:11, defWeight:0.6 },
    { key:"3B", label:"Third Base",    w:12, defWeight:0.8 },
    { key:"SS", label:"Shortstop",     w:11, defWeight:0.9 },
    { key:"LF", label:"Left Field",    w:12, defWeight:0.4 },
    { key:"CF", label:"Center Field",  w:10, defWeight:0.7 },
    { key:"RF", label:"Right Field",   w:12, defWeight:0.7 },
    { key:"DH", label:"Designated Hitter", w:8, defWeight:0.0 },
  ];
  function positionLabel(key){ const p = POSITIONS.find(x=>x.key===key); return p ? p.label : (key||"—"); }
  function randomPosition(){
    const total = POSITIONS.reduce((s,p)=>s+p.w,0);
    let r = Math.random()*total;
    for(const p of POSITIONS){ if((r-=p.w)<=0) return p.key; }
    return "RF";
  }

  function divisionsForYear(year){
    const table = year>=2013 ? DIVISIONS
      : (year>=1994 ? DIVISIONS_1994_2012
      : (year>=1969 ? DIVISIONS_1969_1993 : DIVISIONS_PRE_1970));
    const avail = new Set(teamsAvailable(year).map(t=>t.id));
    return table
      .map(d=>({ conf:d.conf, name:d.name, teams:d.teams.filter(id=>avail.has(id)) }))
      .filter(d=>d.teams.length>0);
  }
  function playoffFormatForYear(year){
    const era = PLAYOFF_ERAS.find(e=>year>=e.from && year<=e.to) || PLAYOFF_ERAS[PLAYOFF_ERAS.length-1];
    const divisionsPerConf = divisionsForYear(year).filter(d=>d.conf==="AFC").length;
    const seedsPerConf = divisionsPerConf + era.wildcards;
    return { divisionsPerConf, wildcards: era.wildcards, wcGames: Math.min(era.wcGames, Math.floor(seedsPerConf/2)), seedsPerConf };
  }
  function divisionOf(teamId, year){
    const divs = divisionsForYear(year || 2024);
    return divs.find(d=>d.teams.includes(teamId)) || divs[0];
  }
  function conferenceOf(teamId, year){ return divisionOf(teamId, year).conf; }

  /* ----- QOL: era-accurate conference/round display names -----
     Internal codes ("AFC"/"NFC") and internal round labels ("Wild Card", "Divisional",
     "Conference Championship", "Super Bowl") are used throughout for LOGIC (bracket
     dispatch, ROUND_DIFFICULTY_WEIGHTS lookups, isSB checks, etc.) and must NEVER change --
     these are pure display-layer wrappers used only at render sites. In baseball terms:
     AFC = American League, NFC = National League; and the rounds display as Wild Card Series /
     Division Series / League Championship Series (ALCS/NLCS) / World Series. The pre-1969 eras
     had no Division Series (one pennant winner per league straight to the World Series), which
     the bracket already handles via PLAYOFF_ERAS. */
  function toRoman(num){
    const vals = [[1000,"M"],[900,"CM"],[500,"D"],[400,"CD"],[100,"C"],[90,"XC"],[50,"L"],[40,"XL"],[10,"X"],[9,"IX"],[5,"V"],[4,"IV"],[1,"I"]];
    let n = Math.max(1, Math.round(num)), out = "";
    for(const [v,s] of vals){ while(n>=v){ out+=s; n-=v; } }
    return out;
  }
  function confLabel(conf, year){
    return conf==="AFC" ? "American League" : "National League";
  }
  function confShort(conf){ return conf==="AFC" ? "AL" : "NL"; }
  function superBowlDisplayName(year){ return "World Series"; }
  function roundDisplayLabel(internalRound, year){
    if(internalRound==="Super Bowl") return "World Series";
    if(internalRound==="Conference Championship"){
      return `${confShort(conferenceOf(career.teamId, year))} Championship Series`;
    }
    if(internalRound==="Divisional") return "Division Series";
    if(internalRound==="Wild Card") return "Wild Card Series";
    return internalRound;
  }
  function pickTeamByStrength(year, excludeId, lo, hi){
    const pool = teamsAvailable(year).filter(t=>t.id!==excludeId);
    const inRange = pool.filter(t=> (career.leagueStrength ? career.leagueStrength[t.id] : 60) >= lo && (career.leagueStrength ? career.leagueStrength[t.id] : 60) <= hi);
    return pick(inRange.length ? inRange : pool);
  }

  // ----- Supporting cast: a team's overall grade is one number, but "how good is the roster
  // around the QB specifically" is really at least two separable things -- the offensive line and
  // the skill-position weapons -- and a good team can absolutely have a bad one of either (the
  // "great team, terrible left tackle" case). Independently noisy against team strength (not just
  // a copy of it) so this is a real distinct signal, not a redundant display of the same number.
  // NaN-safe fallback -- deliberately NOT `??`, since `??` only catches null/undefined and lets a
  // literal NaN straight through. That distinction matters here specifically: oline/weapons/
  // teamStrength drift every season via `career.X = clamp(career.X + delta, ...)`, so if any of
  // them ever goes NaN even once (e.g. an unguarded `career.leagueStrength[someTeamId]` read at a
  // team-reassignment site), every subsequent season's drift step re-applies `NaN + delta` and it
  // never recovers on its own -- this is what let the post-suspension NaN-stats bug persist for the
  // reported ~3 seasons instead of self-correcting.
  function rollSupportingCastGrade(teamStrength){
    return clamp(Math.round(safeNum(teamStrength,60) + randInt(-18,18)), 20, 99);
  }
  // ----- Wave 5 (MASTER_REMEDIATION_SPEC.md): a team's overall/"Team Grade" is now a real,
  // documented, reproducible DERIVATION of its five persistent component grades -- never an
  // independently-drifting number of its own. Confirmed with the user: non-QB roster quality only
  // (the QB's own value is blended in separately everywhere it matters -- see blendOffenseWithTeam/
  // QB_INFLUENCE_REGULAR/PLAYOFF -- so this never double-counts the quarterback). Weights are the
  // spec's own recommended calibration: O-line 20%, Weapons 20%, Defense 30% (the single biggest
  // lever, since it's the one grade with no other mechanical outlet at all), Coaching 20%, Front
  // Office 10%. Every consumer of career.teamStrength/career.leagueStrength[id] is unchanged --
  // this only changes WHERE that number comes from.
  const TEAM_OVERALL_WEIGHTS = { oline:0.20, weapons:0.20, defense:0.30, coaching:0.20, gmGrade:0.10 };
  // Wave 2B's deterministic starter-selection thresholds (originally local to evaluateSuccession),
  // hoisted to module scope in Wave 6 so free-agency role projection can reuse the EXACT same
  // numbers a real in-season promotion decision uses -- "never calculate FA role with a separate
  // estimate." SUCCESSION_HYSTERESIS_MARGIN: the zone just below the promotion gap where an
  // incumbent is deliberately kept even though a challenger reads slightly ahead (a real starter
  // shouldn't lose the job over a 1-2 point noise-level edge). SUCCESSION_PROMOTION_GAP: the real
  // trigger -- a challenger (in-season) or an FA candidate (projectDepthRoleForCandidate) clearing
  // the incumbent by this much wins the job outright. Values unchanged from Wave 2B's own
  // calibration (succession_gap_sweep.mjs; see PROGRESS.md).
  const SUCCESSION_HYSTERESIS_MARGIN = 2, SUCCESSION_PROMOTION_GAP = 3;
  function computeTeamOverall(grades){
    const g = grades || {};
    return safeNum(g.oline,60)*TEAM_OVERALL_WEIGHTS.oline + safeNum(g.weapons,60)*TEAM_OVERALL_WEIGHTS.weapons +
      safeNum(g.defense,60)*TEAM_OVERALL_WEIGHTS.defense + safeNum(g.coaching,60)*TEAM_OVERALL_WEIGHTS.coaching +
      safeNum(g.gmGrade,60)*TEAM_OVERALL_WEIGHTS.gmGrade;
  }
  // Applies a team-quality delta to a holder object's five persistent components (never the
  // aggregate directly) -- since TEAM_OVERALL_WEIGHTS sums to 1.0, nudging all five by the same
  // `delta` reproduces the exact same aggregate movement a direct "strength += delta" used to, while
  // keeping the components (the Team page's actual, displayed, persistent source of truth) legibly
  // in sync instead of letting them go stale under an aggregate that moved out from under them.
  // `noiseSpread` adds an independent +/-N wobble per component on top of delta -- 0 for a
  // deliberate, already-calibrated event/succession delta; >0 for open-ended seasonal drift.
  function driftFiveGrades(holder, delta, noiseSpread){
    const spread = noiseSpread || 0;
    ["oline","weapons","defense","coaching","gmGrade"].forEach(k=>{
      const noise = spread>0 ? randInt(-spread, spread) : 0;
      holder[k] = clamp(Math.round(safeNum(holder[k],60) + delta + noise), 20, 99);
    });
  }
  // Re-derives the player's own team-level teamStrength/leagueStrength entry from whatever's
  // currently in career.oline/weapons/defense/coaching/gmGrade -- call this after ANY direct edit to
  // one of those five fields (a targeted org event, a fresh signing) so the aggregate never goes
  // stale relative to the components that are now supposed to define it.
  function recomputeMyTeamStrength(){
    career.teamStrength = clamp(Math.round(computeTeamOverall(career)), 20, 97);
    career.leagueStrength[career.teamId] = career.teamStrength;
    return career.teamStrength;
  }
  // The one shared entry point for "this team's quality should move by `delta`" -- whether that's
  // the player's own team or any other team in the league. Never touches leagueStrength/teamStrength
  // directly; always goes through the five persistent components first (driftFiveGrades) and derives
  // the aggregate from them (computeTeamOverall), so career.leagueTeamGrades (ensureLeagueTeamGrades)
  // can never drift out of sync with the number the Team page/Standings/FA offers all show.
  function adjustTeamStrength(teamId, delta, noiseSpread){
    if(teamId===career.teamId){
      driftFiveGrades(career, delta, noiseSpread);
      return recomputeMyTeamStrength();
    }
    ensureLeagueTeamGrades(career.year);
    if(!career.leagueTeamGrades) career.leagueTeamGrades = {};
    const g = career.leagueTeamGrades[teamId] || (career.leagueTeamGrades[teamId] = { oline:60, weapons:60, defense:60, coaching:60, gmGrade:60 });
    driftFiveGrades(g, delta, noiseSpread);
    const overall = clamp(Math.round(computeTeamOverall(g)), 20, 96);
    career.leagueStrength[teamId] = overall;
    return overall;
  }
  // Called at every site the PLAYER's own team assignment changes (trade, waiver pickup, expansion
  // draft, free-agent sign). Hands the OLD team back its own real, persistent five-grade profile --
  // frozen at whatever it actually was under the player, never a fresh re-roll -- and gives the
  // player the NEW team's own real, persistent profile in return: the exact same numbers
  // buildTeamPageHTML/buildFreeAgentOffers already show for that franchise, never a second,
  // independently-rolled copy. Must be called AFTER career.teamId is already reassigned to the new
  // team, since recomputeMyTeamStrength writes into career.leagueStrength[career.teamId].
  function handOffTeamProfile(oldTeamId, newTeamId){
    if(oldTeamId){
      if(!career.leagueTeamGrades) career.leagueTeamGrades = {};
      career.leagueTeamGrades[oldTeamId] = { oline: career.oline, weapons: career.weapons, defense: career.defense, coaching: career.coaching, gmGrade: career.gmGrade };
    }
    ensureLeagueTeamGrades(career.year);
    const np = (career.leagueTeamGrades && career.leagueTeamGrades[newTeamId]) || { oline:60, weapons:60, defense:60, coaching:60, gmGrade:60 };
    career.oline = np.oline; career.weapons = np.weapons; career.defense = np.defense; career.coaching = np.coaching; career.gmGrade = np.gmGrade;
    career.teamChemistry = 45;
    recomputeMyTeamStrength();
  }
  function castLetterGrade(value){
    if(value>=93) return "A+"; if(value>=87) return "A"; if(value>=82) return "A-";
    if(value>=77) return "B+"; if(value>=72) return "B"; if(value>=67) return "B-";
    if(value>=62) return "C+"; if(value>=55) return "C"; if(value>=48) return "C-";
    if(value>=40) return "D+"; if(value>=32) return "D"; if(value>=24) return "D-";
    return "F";
  }

  // Rate-quality index on the OPS+ scale (100 = league average, ~150 = MVP-caliber, ~60 = a bat
  // that shouldn't be playing every day). Inherited name `passerRating` kept so the ~15 call
  // sites don't churn; args are (hits, plateAppearances, totalBases, homeRuns, strikeouts, walks).
  // `walks` is optional -- career/rival totals didn't always carry BB during the baseball
  // conversion, so a league-ish fallback keeps old data from reading as a sub-.300 OBP.
  function passerRating(h, pa, tb, hr, k, bb){
    if(pa<=0) return 0;
    const walks = bb!=null ? bb : Math.max(0, pa*0.085);
    const hbp = pa*0.009, sf = pa*0.006;
    const ab = Math.max(1, pa - walks - hbp - sf);
    const obp = clamp((h + walks + hbp) / Math.max(1, ab + walks + hbp + sf), 0, 1);
    const slg = clamp(tb / ab, 0, 4);
    const LG_OBP = 0.328, LG_SLG = 0.410;
    return Math.round((obp/LG_OBP + slg/LG_SLG - 1) * 100 * 10) / 10;
  }

  /* ================= Achievements =================
     A pure achievement system: every entry in ACHIEVEMENTS is a one-time, PERMANENT unlock tied to
     a specific, often unusual career moment or milestone -- never tiered, never re-checked once
     earned, and never equipped (no slots, no cosmetic loadout; simply "did this happen in this
     career, yes or no"). career.achievements = { unlocked: {[key]: true} } is the entire state.
     checkAchievements() is the ONLY writer, safe to call as often as convenient (idempotent -- it
     only ever flips an entry from missing/false to true) -- called from generateSeason() (so
     season-level thresholds like a big statistical year are caught the moment they happen),
     finalizePlayoffOutcome() (so this season's ring/playoff result is final before streak checks
     run), and finishCareer() (so a career-ending-only condition, like retiring loyal to one team,
     can still fire on the very last tick). The Baseball Card's back face shows every achievement
     actually earned in that career -- not a curated equip loadout -- via entry.achievements
     (see saveTrophyRoomEntry in finishCareer). */
  // maxConsecutive/seasonRule/consecutiveSeasonRule/eventCountRule/sequenceRule/ledgerStep are the
  // pure declarative rule-builder primitives (src/sim/achievementRules.js, Balance Wave 6) -- kept
  // as bare imports (not re-wrapped) so achievement `check` closures below can call them directly.
  const maxConsecutive = ruleMaxConsecutive;
  function wonTitle(s){ return !!(s.playoffs && s.playoffs.wonRing); }
  // Reached the actual title game (internal round label is always "Super Bowl", every era -- see
  // buildSuperBowlRound) and did NOT come away with the ring. Pre-1966 seasons can win their ring
  // via the Conference Championship and then lose the fictional exhibition Super Bowl afterward
  // (see finalizePlayoffOutcome) -- the wonRing check here is what keeps that case from being
  // misread as a title-game loss.
  function reachedTitleGameAndLost(s){
    if(!s.playoffs || !s.playoffs.rounds || !s.playoffs.rounds.length) return false;
    const last = s.playoffs.rounds[s.playoffs.rounds.length-1];
    return last.round==="Super Bowl" && !last.won && !wonTitle(s);
  }
  // RARE_EVENTS/select INFRACTION_EVENTS entries carry a stable achievementId (see resolveInfraction,
  // which stamps it onto the career.lifeEventLog entry it pushes) specifically so the dark-humor
  // achievements below can hook a specific scandal/easter-egg event without matching on title text.
  function hadLifeEvent(achievementId){ return (career.lifeEventLog||[]).some(e=>e.achievementId===achievementId); }

  // Balance Wave 6: career.eventLedger is a NEW, structured, career-long timeline -- added ALONGSIDE
  // career.lifeEventLog (never replacing it, so the dark-humor achievements above keep working
  // unchanged) specifically so achievement rules can be DATA (an eventId + a few stable-id filters
  // + a count or an ordering) instead of a hand-rolled scanning closure. Every field but eventId is
  // optional and stable-id-based on purpose -- teamId/opponentId are real team codes (e.g. "BUF"),
  // never a rendered display name, so a team-specific achievement never breaks if flavor text
  // changes. sequenceIndex is one shared, monotonic, career-long counter across every event type,
  // which is what sequenceRule (achievementRules.js) orders multi-step achievements against.
  function recordLedgerEvent(eventId, opts={}){
    if(!career.eventLedger) career.eventLedger = [];
    career._eventSequenceCounter = (career._eventSequenceCounter||0)+1;
    career.eventLedger.push({
      eventId,
      year: career.year,
      seasonIndex: career.seasonLog.length,
      sequenceIndex: career._eventSequenceCounter,
      teamId: opts.teamId!==undefined ? opts.teamId : (career.teamId||null),
      opponentId: opts.opponentId!==undefined ? opts.opponentId : null,
      choiceId: opts.choiceId!==undefined ? opts.choiceId : null,
      outcomeId: opts.outcomeId!==undefined ? opts.outcomeId : null,
      severity: opts.severity!==undefined ? opts.severity : null,
      metadata: opts.metadata!==undefined ? opts.metadata : null,
    });
  }

  function badgeIconSVG(key){
    return `<svg viewBox="0 0 24 24" class="pb-icon-svg" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${BADGE_ICONS[key]||BADGE_ICONS.star}</svg>`;
  }

  const ACHIEVEMENTS = [
    // ----- single-season statistical moments -----
    // Balance Wave 7: migrated to seasonRule(pred,1) -- career.seasonLog.some(pred) IS
    // seasonRule(pred,1)(career) by definition, so this is a zero-risk, behavior-identical
    // refactor, same as Wave 6's wagons/buffalobills/wiretowire/juggernaut migration.
    { key:"gunslinger", name:"Gunslinger", icon:"bolt",
      blurb:"A season spent daring defenses to stop the deep ball, consequences be damned.",
      hint:"Post a season with huge yardage, a big TD count, and a high INT total to match.",
      check: ()=> seasonRule(s=> s.yards>=4200 && s.td>=32 && s.int>=18)(career) },
    { key:"fieldgeneral", name:"Field General", icon:"target",
      blurb:"A season of surgical, mistake-free precision.",
      hint:"Post a season with elite completion% and very few interceptions on heavy volume.",
      check: ()=> seasonRule(s=> s.att>=400 && (s.pct||0)>=0.685 && s.int<=7)(career) },
    { key:"ghostinthepocket", name:"Ghost in the Pocket", icon:"wing",
      blurb:"A season where the pass rush simply couldn't find him.",
      hint:"Post a season with a very low sack rate on heavy passing volume.",
      check: ()=> seasonRule(s=> s.att>=400 && s.sacks/s.att<=0.025)(career) },
    { key:"vault", name:"Vault", icon:"lock",
      blurb:"A season of total ball security under a heavy workload.",
      hint:"Post a high-volume season with almost no interceptions.",
      check: ()=> seasonRule(s=> s.att>=450 && s.int<=5)(career) },
    { key:"ironarmed", name:"Iron-Armed", icon:"mountain",
      blurb:"A season of pure, league-leading workload.",
      hint:"Post a season with an enormous number of pass attempts.",
      check: ()=> seasonRule(s=> s.att>=620)(career) },
    { key:"groundthreat", name:"Threat on the Ground", icon:"football",
      blurb:"A season defenses had to game-plan for on the ground, not just through the air.",
      hint:"Post a season with four-digit rushing yardage.",
      check: ()=> seasonRule(s=> (s.rushYards||0)>=1000)(career) },
    { key:"perfection", name:"Perfection", icon:"gauge",
      blurb:"A passer rating so high it barely seems fair.",
      hint:"Post a season with a passer rating north of 112.",
      check: ()=> seasonRule(s=> s.rating>=112)(career) },

    // ----- accolades, arcs, and off-the-field moments -----
    { key:"hollywoodending", name:"Hollywood Ending", icon:"heart",
      blurb:"Won it all the same year he put a ring on it, off the field too.",
      hint:"Win a championship the same season you get married.",
      check: ()=>{ const last = career.seasonLog[career.seasonLog.length-1];
        return !!(career.relationship && career.relationship.status==="married" && career.relationship.startYear===career.year && last && wonTitle(last)); } },
    { key:"againstallodds", name:"Against All Odds", icon:"compass",
      blurb:"Dragged a roster that had no business contending to the top of the mountain.",
      hint:"Win an MVP or a championship on a bottom-tier (under 45 grade) team.",
      check: ()=> seasonRule(s=> s.teamOverall<45 && ((s.awards||[]).includes("MVP") || wonTitle(s)))(career) },
    { key:"phoenixrising", name:"Phoenix Rising", icon:"flame",
      blurb:"Written off after a bust stretch, then came back better than ever.",
      hint:"Recover from a bust development swing with a later breakout.",
      check: ()=>{ let sawBust=false;
        for(const s of career.seasonLog){
          if(s.devArcEvent && s.devArcEvent.type==="bust") sawBust=true;
          if(sawBust && s.devArcEvent && s.devArcEvent.type==="breakout") return true;
        }
        return false; } },
    { key:"ironwill", name:"Iron Will", icon:"shield",
      blurb:"Played through more pain than the roster around him ever knew.",
      hint:"Make Pro Bowl or All-Pro in a season your Wear & Tear meter is above 45.",
      check: ()=>{ const last = career.seasonLog[career.seasonLog.length-1];
        return !!(last && (career.wearAndTear||0)>45 && ((last.awards||[]).includes("Pro Bowl")||(last.awards||[]).includes("All-Pro"))); } },
    { key:"theunanimous", name:"The Unanimous", icon:"star",
      blurb:"An MVP season nobody in the league could argue with.",
      hint:"Win MVP with a passer rating of 105 or higher.",
      // Balance Wave 7: migrated from "check only the MOST RECENT season" to "any season ever" --
      // behaviorally identical under this codebase's own call pattern (checkAchievements() runs
      // right after every season, is idempotent once unlocked, so both versions first flip true at
      // the exact same season) and a strict superset otherwise (also catches a milestone that a
      // skipped/delayed checkAchievements() call would have missed under the old "last season only"
      // shape -- an existing-but-unlikely edge case, not a new risk).
      check: ()=> seasonRule(s=> (s.awards||[]).includes("MVP") && s.rating>=105)(career) },
    { key:"oldmanwinter", name:"Old Man Winter", icon:"gem",
      blurb:"Still doing it well past the age everyone said he'd be done.",
      hint:"Make Pro Bowl, All-Pro, or win a ring at age 38 or older.",
      // season.age is stamped from career.age at push time (see generateSeason's season object
      // literal), so "any season with age>=38" is exactly the old "last season + current age" check.
      check: ()=> seasonRule(s=> s.age>=38 && ((s.awards||[]).includes("Pro Bowl")||(s.awards||[]).includes("All-Pro")||wonTitle(s)))(career) },
    { key:"loyaltothedeath", name:"Loyal to the Death", icon:"anchor",
      blurb:"One team, one city, an entire career — and he walked away on his own terms.",
      hint:"Retire (not released or traded away) after 10+ seasons with a single team.",
      check: ()=> allOf(
        ()=> career.exitReason==="retired",
        everySeasonRule(s=>s.teamId===career.teamId, 10),
      )(career) },
    { key:"latebloomer", name:"Late Bloomer", icon:"sunrise",
      blurb:"Took the long way to stardom, and got there anyway.",
      hint:"Earn your first Pro Bowl or All-Pro nod at age 30 or older.",
      // A genuine "first occurrence must itself satisfy X" shape -- doesn't reduce cleanly to any
      // current rule builder (seasonRule counts ANY match; this needs the FIRST match specifically),
      // so this one honestly stays a short hand-written closure.
      check: ()=>{ const first = career.seasonLog.find(s=> (s.awards||[]).includes("Pro Bowl")||(s.awards||[]).includes("All-Pro"));
        return !!(first && first.age>=30); } },
    { key:"storybook", name:"Storybook Career", icon:"book",
      blurb:"A career people will still be telling stories about decades from now.",
      hint:"Rack up 3 or more legendary career moments.",
      // Deliberately left reading career.lifeEventLog directly, NOT migrated to eventCountRule over
      // career.eventLedger -- see Wave 6's own rationale for the dark-humor achievements: an old save
      // that already had a legendary event happen in a PRE-Wave-6 season has it in lifeEventLog but
      // NOT in eventLedger (which didn't exist yet), so switching this would make the achievement
      // permanently unreachable for such saves. Not every eventLedger-shaped check is safe to migrate.
      check: ()=> (career.lifeEventLog||[]).filter(e=>e.legendary).length>=3 },
    { key:"scartissue", name:"Scar Tissue", icon:"mountain",
      blurb:"Broken down more than once, and got back up every single time.",
      hint:"Survive 2 or more permanent wear-and-tear breakdowns.",
      check: ()=> seasonRule(s=>s.wearBreakdown, 2)(career) },

    // ----- dynasties, droughts, and history-flavored streaks -----
    // wagons/buffalobills migrated to the Balance Wave 6 declarative rule builders as a proof-of-
    // concept -- consecutiveSeasonRule(pred,n)(career) is exactly maxConsecutive(seasonLog,pred)>=n,
    // so this is byte-for-byte the same condition, just expressed as data (a predicate + a count)
    // instead of an inline maxConsecutive call.
    { key:"wagons", name:"No One Circles the Wagons", icon:"crown",
      blurb:"Four straight championships. The league simply couldn't answer.",
      hint:"Win the championship in four consecutive seasons.",
      check: ()=> consecutiveSeasonRule(wonTitle, 4)(career) },
    { key:"buffalobills", name:"Quiet Like the Buffalo Bills", icon:"snow",
      blurb:"Four straight trips to the big game. Four straight times the confetti was the wrong color.",
      hint:"Reach the championship game four seasons in a row without ever winning it.",
      check: ()=> consecutiveSeasonRule(reachedTitleGameAndLost, 4)(career) },
    { key:"snakebitten", name:"Snake Bitten", icon:"gem",
      blurb:"So close, so many times, and never once close enough.",
      hint:"Reach the championship game 3+ times across your career without ever winning one.",
      check: ()=> allOf(()=> career.totals.rings===0, seasonRule(reachedTitleGameAndLost, 3))(career) },
    { key:"ringchaser", name:"Ring Chaser", icon:"chain",
      blurb:"Found a way to win it all no matter which jersey he was wearing.",
      hint:"Win a championship with two or more different teams.",
      check: ()=> new Set(career.seasonLog.filter(wonTitle).map(s=>s.teamId)).size>=2 },
    { key:"dynasty", name:"Dynasty", icon:"trophy",
      blurb:"Built something that lasted — the trophy case has one team's name all over it.",
      hint:"Win 4 or more championships with a single team.",
      check: ()=>{ const counts={}; career.seasonLog.filter(wonTitle).forEach(s=> counts[s.teamId]=(counts[s.teamId]||0)+1);
        return Object.values(counts).some(c=>c>=4); } },
    { key:"perfectseason", name:"Perfect Season", icon:"star",
      blurb:"Not one single loss, all year.",
      hint:"Finish a season with a perfect team record.",
      check: ()=> seasonRule(s=> s.teamGames>0 && s.teamLosses===0)(career) },
    { key:"turnaround", name:"The Turnaround", icon:"sunrise",
      blurb:"Walked into a rebuild and walked out a champion.",
      hint:"Join a bottom-tier (under 45 grade) team and win a championship with them within 3 seasons.",
      check: ()=>{
        for(let i=0;i<career.seasonLog.length;i++){
          if(career.seasonLog[i].teamOverall<45){
            for(let j=i;j<Math.min(career.seasonLog.length,i+4);j++){
              if(career.seasonLog[j].teamId===career.seasonLog[i].teamId && wonTitle(career.seasonLog[j])) return true;
            }
          }
        }
        return false; } },
    { key:"wiretowire", name:"Wire to Wire", icon:"infinity",
      blurb:"The best player in the league, two years running.",
      hint:"Win MVP in back-to-back seasons.",
      check: ()=> consecutiveSeasonRule(s=>(s.awards||[]).includes("MVP"), 2)(career) },
    { key:"faceoftheleague", name:"Face of the League", icon:"star",
      blurb:"The league ran through him for the better part of a decade.",
      hint:"Win MVP three or more times across your career.",
      check: ()=> career.totals.mvps>=3 },
    { key:"juggernaut", name:"Juggernaut", icon:"shield",
      blurb:"Three straight years fielding one of the best rosters in football.",
      hint:"Keep your team grade at 90 or higher for three consecutive seasons.",
      check: ()=> consecutiveSeasonRule(s=>s.teamOverall>=90, 3)(career) },
    { key:"onemanteam", name:"One-Man Team", icon:"mountain",
      blurb:"Carried a bad roster to individual honors again and again.",
      hint:"Make Pro Bowl or All-Pro three or more times on a bottom-tier (under 45 grade) team.",
      check: ()=> seasonRule(s=> s.teamOverall<45 && ((s.awards||[]).includes("Pro Bowl")||(s.awards||[]).includes("All-Pro")), 3)(career) },
    { key:"biggamehunter", name:"Big Game Hunter", icon:"flame",
      blurb:"Walked into the championship as the lesser team, and walked out with the trophy anyway.",
      hint:"Win the championship as the lower-graded team in the Super Bowl.",
      check: ()=> seasonRule(s=>{
        if(!wonTitle(s) || !s.playoffs.rounds.length) return false;
        const last = s.playoffs.rounds[s.playoffs.rounds.length-1];
        return last.round==="Super Bowl" && last._defOverall!=null && s.teamOverall<last._defOverall;
      })(career) },
    { key:"ironclad", name:"Ironclad", icon:"shield",
      blurb:"A full decade-plus in the league, and never once missed a game to injury.",
      hint:"Play 10+ seasons without ever missing a game to injury.",
      // The genuine "every season of a 10+ year career, not just a 10-season streak within a longer
      // one" shape everySeasonRule (Wave 7) exists specifically to express -- see its own header
      // comment for why consecutiveSeasonRule would silently be a different, more lenient condition.
      check: ()=> everySeasonRule(s=>(s.missedGamesInjury||0)===0, 10)(career) },

    // ----- dark-humor achievements, tied to specific rare/infraction scandal events -----
    // Each hooks a single specific event via its stable achievementId (see RARE_EVENTS/animalring
    // above) rather than a generic stat threshold -- these are jokes about a specific bad night, not
    // a pattern of behavior, so a title-only match (in case an event's flavor text ever changes)
    // would be fragile where the id-based hadLifeEvent() lookup isn't.
    { key:"gotthatdawg", name:"He Got That Dawg in Him", icon:"paw",
      blurb:"Not the kind of \"dawg in him\" anyone meant. A very, very wrong kind of dog story.",
      hint:"Get caught up in a career-altering federal investigation.",
      check: ()=> hadLifeEvent("got_that_dawg") },
    { key:"shotfoot", name:"Shot Himself in the Foot (Literally)", icon:"flame",
      blurb:"The only casualty of the incident was, unfortunately, himself.",
      hint:"Have an extremely avoidable off-field accident go very publicly, very badly wrong.",
      check: ()=> hadLifeEvent("own_worst_enemy") },
    { key:"bountyhunter", name:"Bounty Hunter", icon:"target",
      blurb:"Put a price on some heads, and the league found out.",
      hint:"Get caught running a pay-for-injury bounty scheme.",
      check: ()=> hadLifeEvent("bounty_hunter") },
    { key:"masterofdisguise", name:"Master of Disguise", icon:"compass",
      blurb:"The wig did not, in fact, work.",
      hint:"Get caught sneaking past team compliance in a disguise.",
      check: ()=> hadLifeEvent("master_of_disguise") },
    { key:"walkabout", name:"Walkabout", icon:"sunrise",
      blurb:"No scandal, no arrest — just up and gone, mid-career, to go find himself.",
      hint:"Walk away from football entirely, mid-career, with no explanation.",
      check: ()=> hadLifeEvent("walked_away") },
    { key:"wrongplacewrongtime", name:"Wrong Place, Wrong Time", icon:"clock",
      blurb:"Wasn't the shooter. Was, unfortunately, still there.",
      hint:"Get named in a nightclub shooting investigation you had nothing to do with.",
      check: ()=> hadLifeEvent("wrong_place_wrong_time") },
    { key:"housealwayswins", name:"The House Always Wins", icon:"chain",
      blurb:"The bookie always gets paid, one way or another.",
      hint:"Let a gambling problem spiral into a career-ending scandal.",
      check: ()=> hadLifeEvent("house_always_wins") },
    { key:"donotdisturb", name:"Do Not Disturb", icon:"wing",
      blurb:"Redecorated a hotel room. Not on purpose. Definitely on camera.",
      hint:"Have a bizarre, furniture-throwing public meltdown go viral.",
      check: ()=> hadLifeEvent("unraveling_on_camera") },
    { key:"twotimeloser", name:"Two-Time Loser", icon:"heart",
      blurb:"Lost to the same guy twice — once on the scoreboard, once at home.",
      hint:"Have your partner get caught up in a scandal with a bitter rival.",
      check: ()=> hadLifeEvent("two_time_loser") },

    // ----- Balance Wave 6: team-specific declarative achievements -----
    // Each reads career.seasonLog (already a rich, structured, per-season record -- teamId,
    // teamOverall, awards, playoffs) through the achievementRules.js rule builders, so the LOGIC is
    // data (a predicate + a count/ordering) rather than a bespoke scan -- the actual "declarative"
    // half of this wave. A couple (clevelandfirst, jetsredemption, bayarearesurgence) still read as
    // a short hand-written closure because the exact ordering they need (first-ever win at 20+
    // seasons; a stat threshold that must hold BEFORE a later award) doesn't reduce cleanly to the
    // current rule vocabulary -- that's an honest limit of this wave's engine, not an oversight.
    { key:"buffaloclosure", name:"Buffalo Closure", icon:"snow",
      blurb:"Four straight heartbreaks in Buffalo, and then, finally, the one that counted.",
      hint:"Lose four straight championship games with the Bills, then eventually win one with them.",
      check: ()=> allOf(
        consecutiveSeasonRule(s=>s.teamId==="BUF"&&reachedTitleGameAndLost(s), 4),
        seasonRule(s=>s.teamId==="BUF"&&wonTitle(s), 1),
      )(career) },
    { key:"clevelandfirst", name:"Cleveland, Finally", icon:"sunrise",
      blurb:"Two decades of waiting, and the city finally gets its parade.",
      hint:"Win the Browns' first championship of your career after 20+ seasons with no ring at all.",
      check: ()=>{
        const idx = career.seasonLog.findIndex(s=>s.teamId==="CLE"&&wonTitle(s));
        return idx>=20 && career.seasonLog.slice(0,idx).every(s=>!wonTitle(s));
      } },
    { key:"motorcitymiracle", name:"Motor City Miracle", icon:"gem",
      blurb:"Nobody outside the city gave this Detroit team a single chance. They didn't need one.",
      hint:"Win a championship with the Lions in a season that started with a team grade under 50.",
      check: ()=> seasonRule(s=>s.teamId==="DET"&&s.teamOverall<50&&wonTitle(s), 1)(career) },
    { key:"purplepain", name:"Purple Pain", icon:"compass",
      blurb:"Minnesota gets there. Minnesota just never, ever finishes it.",
      hint:"Reach the championship game 3+ times with the Vikings without ever winning one there.",
      check: ()=> allOf(
        seasonRule(s=>s.teamId==="MIN"&&reachedTitleGameAndLost(s), 3),
        ruleNot(seasonRule(s=>s.teamId==="MIN"&&wonTitle(s), 1)),
      )(career) },
    { key:"steeltown", name:"Steel Town", icon:"shield",
      blurb:"Pittsburgh doesn't rebuild. Pittsburgh reloads.",
      hint:"Win two or more championships with the Steelers.",
      check: ()=> seasonRule(s=>s.teamId==="PIT"&&wonTitle(s), 2)(career) },
    { key:"jetsredemption", name:"Broadway Reboot", icon:"star",
      blurb:"Buried on the bench once. Impossible to bench by the end.",
      hint:"Earn Pro Bowl, All-Pro, or MVP with the Jets in a later season after logging real bench time with them.",
      check: ()=>{
        const bIdx = career.seasonLog.findIndex(s=>s.teamId==="NYJ"&&(s.missedGamesBackup||0)>0);
        if(bIdx===-1) return false;
        return career.seasonLog.slice(bIdx+1).some(s=>s.teamId==="NYJ"&&((s.awards||[]).includes("Pro Bowl")||(s.awards||[]).includes("All-Pro")||(s.awards||[]).includes("MVP")));
      } },
    { key:"bayarearesurgence", name:"Bay Area Resurgence", icon:"mountain",
      blurb:"Walked into a rebuild in the Bay. Walked out with a real contender.",
      hint:"Improve the 49ers' team grade by 30+ points from your first season there to a later one.",
      check: ()=>{
        const sf = career.seasonLog.filter(s=>s.teamId==="SF");
        if(sf.length<2) return false;
        return sf[sf.length-1].teamOverall - sf[0].teamOverall >= 30;
      } },
    { key:"patriotway", name:"The Patriot Way", icon:"crown",
      blurb:"Five straight years of one of the best rosters in football, all under one hood in Foxborough.",
      hint:"Keep a 85+ team grade for 5 consecutive seasons with the Patriots.",
      check: ()=> consecutiveSeasonRule(s=>s.teamId==="NE"&&s.teamOverall>=85, 5)(career) },

    // ----- Balance Wave 6: achievements tied to the newer Development/Contract/Key Moment/
    // Coordinator-Carousel systems (Waves 2-5), showcasing mechanics the original 39 achievements
    // predate. Several of these are the first achievements built against career.eventLedger (see
    // recordLedgerEvent in main.js), the new structured event log this wave adds. -----
    { key:"earnedit", name:"Earned It", icon:"bolt",
      blurb:"Not a gift from the dice. A breakthrough he actually played his way into.",
      hint:"Trigger at least one earned development breakthrough.",
      check: ()=> (career._earnedBreakthroughCount||0)>=1 },
    { key:"selfmade", name:"Self-Made", icon:"mountain",
      blurb:"Every real leap in this career traces back to a Sunday, not a die roll.",
      hint:"Trigger three or more earned development breakthroughs across a career.",
      check: ()=> (career._earnedBreakthroughCount||0)>=3 },
    { key:"betonyourself", name:"Bet on Yourself", icon:"gauge",
      blurb:"Took the record-setting number every time, cap pressure be damned.",
      hint:"Sign three or more record-setting contract structures across a career.",
      check: ()=> eventCountRule({ eventId:"contract_signed", choiceId:"recordSetting" }, 3)(career) },
    { key:"hometowndiscount", name:"Hometown Discount", icon:"heart",
      blurb:"Left real money on the table, more than once, to keep the roster around him whole.",
      hint:"Sign three or more team-friendly contract structures across a career.",
      check: ()=> eventCountRule({ eventId:"contract_signed", choiceId:"teamFriendly" }, 3)(career) },
    { key:"capcasualty", name:"Cap Casualty", icon:"chain",
      blurb:"The record deal looked great on signing day. The front office remembered it two years later.",
      hint:"Sign a record-setting contract, then get traded within 2 seasons.",
      check: ()=> sequenceRule(
        [ledgerStep({ eventId:"contract_signed", choiceId:"recordSetting" }), ledgerStep({ eventId:"traded" })],
        { withinSeasons:2 },
      )(career) },
    { key:"coordinatorsnightmare", name:"Coordinator's Nightmare", icon:"wing",
      blurb:"His own staff keeps getting head-coaching interviews. It's a compliment that costs him every time.",
      hint:"Have the coordinator carousel hit your own team's coaching grade twice in a career.",
      check: ()=> eventCountRule({ eventId:"coordinator_carousel" }, 2)(career) },
    { key:"icecold", name:"Ice Cold", icon:"clock",
      blurb:"When it mattered most, the read was wrong more often than it was right.",
      hint:"Come up short in 8 or more Key Moment decisions across a career.",
      check: ()=> ((career.keyMomentRecord&&career.keyMomentRecord.bad)||0)>=8 },
    { key:"clutchgene", name:"Clutch Gene", icon:"target",
      blurb:"When the possession decides it, he's the one you want holding the ball.",
      hint:"Deliver 10 or more good Key Moment decisions across a career.",
      check: ()=> ((career.keyMomentRecord&&career.keyMomentRecord.good)||0)>=10 },
    { key:"moneymoment", name:"Money Moment", icon:"trophy",
      blurb:"The right call, executed exactly right, with a Super Bowl hanging on it.",
      hint:"Deliver a good Key Moment decision that flips the result of a Super Bowl in your favor.",
      check: ()=> (career.eventLedger||[]).some(e=> e.eventId==="key_moment" && e.severity==="good" && e.metadata && e.metadata.round==="Super Bowl" && e.metadata.flippedResult) },
    { key:"heartbreaker", name:"Heartbreaker", icon:"flame",
      blurb:"One wrong read, one Super Bowl, gone.",
      hint:"Come up short on a Key Moment decision that flips a Super Bowl win into a loss.",
      check: ()=> (career.eventLedger||[]).some(e=> e.eventId==="key_moment" && e.severity==="bad" && e.metadata && e.metadata.round==="Super Bowl" && e.metadata.flippedResult) },

    // ----- Balance Wave 6: multi-event chains, using career.eventLedger's sequenceIndex to require
    // real ORDER (not just that both things happened somewhere in the career) -- the kind of
    // condition the old lifeEventLog-only system had no clean way to express at all. -----
    { key:"redemptionarc", name:"Redemption Arc", icon:"sunrise",
      blurb:"Lost the big one once. Made sure it didn't define him.",
      hint:"Lose a championship game, then win one in a later season.",
      check: ()=> sequenceRule([ledgerStep({ eventId:"championship_lost" }), ledgerStep({ eventId:"championship_won" })])(career) },
    { key:"backtobackheartbreak", name:"Third Time's the Charm", icon:"infinity",
      blurb:"Lost the big one twice running. Didn't let there be a third.",
      hint:"Lose two straight championship games, then win the next one you reach.",
      check: ()=> sequenceRule([
        ledgerStep({ eventId:"championship_lost" }), ledgerStep({ eventId:"championship_lost" }), ledgerStep({ eventId:"championship_won" }),
      ])(career) },
    { key:"scandalthensuccess", name:"Rewriting the Headline", icon:"star",
      blurb:"The tabloids had their story. Then he went and won MVP before they could finish telling it.",
      hint:"Survive a scandal, then win MVP within 3 seasons.",
      check: ()=> sequenceRule(
        [ledgerStep({ eventId:"infraction_event" }), ledgerStep({ eventId:"award_won", outcomeId:"MVP" })],
        { withinSeasons:3 },
      )(career) },
    { key:"cleanslate", name:"Clean Slate", icon:"crown",
      blurb:"The scandal was real. So, eventually, was the ring.",
      hint:"Survive a scandal, then win a championship in a later season.",
      check: ()=> sequenceRule([ledgerStep({ eventId:"infraction_event" }), ledgerStep({ eventId:"championship_won" })])(career) },
    { key:"deniednotdefeated", name:"Denied, Not Defeated", icon:"gauge",
      blurb:"They said no to the trade request. He made them regret it fast.",
      hint:"Get a trade request denied, then win MVP with that same front office within 2 seasons.",
      check: ()=> sequenceRule(
        [ledgerStep({ eventId:"trade_requested", outcomeId:"denied" }), ledgerStep({ eventId:"award_won", outcomeId:"MVP" })],
        { withinSeasons:2 },
      )(career) },

    // ----- Balance Wave 6: career-shape achievements reading the ledger's broader transaction
    // history (trades, signings, requests) as a whole rather than one specific chain. -----
    { key:"wanderlust", name:"Wanderlust", icon:"compass",
      blurb:"Three different lockers, three different playbooks, one very well-traveled career.",
      hint:"Change teams (by trade or free-agent signing) three or more times in a career.",
      check: ()=> (career.eventLedger||[]).filter(e=> e.eventId==="traded" || (e.eventId==="contract_signed" && e.outcomeId==="signed")).length>=3 },
    { key:"frontofficefavorite", name:"Front Office Favorite", icon:"anchor",
      blurb:"They kept bringing him back. He kept giving them a reason to.",
      hint:"Re-sign with the same team two or more times in a career.",
      check: ()=> eventCountRule({ eventId:"contract_signed", outcomeId:"re-signed" }, 2)(career) },
    { key:"persistent", name:"Persistent", icon:"paw",
      blurb:"Asked for a way out three separate times. Never stopped asking.",
      hint:"Request a trade three or more times across a career.",
      check: ()=> eventCountRule({ eventId:"trade_requested" }, 3)(career) },

    // ----- Balance Wave 7: opponent/revenge achievements -----
    // Wave 6's own "not done" note claimed a playoff round's opponent was only known by display
    // name, not a stable id -- that was wrong (season.playoffs.rounds[i].oppId already existed, see
    // stepConferenceBracket); the real gap was that the championship_won/championship_lost/
    // key_moment ledger events never threaded it through, fixed this wave (see recordLedgerEvent
    // call sites in finalizePlayoffOutcome/triggerKeyMoment). sameFieldAs/groupCountRule (new this
    // wave, src/sim/achievementRules.js) are what actually make an opponent-SPECIFIC condition
    // expressible: "the SAME team" rather than "any team", which sequenceRule/eventCountRule alone
    // couldn't say.
    { key:"revenge", name:"Revenge Tour", icon:"flame",
      blurb:"They beat him for a ring once. He made sure there wasn't a second time.",
      hint:"Lose a championship to a specific team, then later beat that SAME team for a ring.",
      check: ()=> sequenceRule([
        ledgerStep({ eventId:"championship_lost" }),
        sameFieldAs(0, { eventId:"championship_won" }),
      ])(career) },
    { key:"rivalgauntlet", name:"Personal Nemesis", icon:"chain",
      blurb:"Whatever they tried, it never worked twice. He owns this matchup.",
      hint:"Beat the same team for a championship two or more times across a career.",
      check: ()=> groupCountRule({ eventId:"championship_won" }, "opponentId", 2)(career) },
    { key:"hauntedbythesamedemon", name:"Haunted", icon:"gem",
      blurb:"One franchise, twice, in the biggest game there is. Some ghosts don't leave.",
      hint:"Lose a championship to the same team two or more times across a career.",
      check: ()=> groupCountRule({ eventId:"championship_lost" }, "opponentId", 2)(career) },
    { key:"signaturewin", name:"Signature Win", icon:"target",
      blurb:"The team that beat him for a ring once. This time, in a Key Moment, he had the answer.",
      hint:"Lose a championship to a team, then later deliver a good Key Moment decision against that same team.",
      check: ()=> sequenceRule([
        ledgerStep({ eventId:"championship_lost" }),
        sameFieldAs(0, { eventId:"key_moment", severity:"good" }),
      ])(career) },
    { key:"familiarfoe", name:"Familiar Foe", icon:"compass",
      blurb:"Every big possession of his career, it feels like, has come against this one team.",
      hint:"Face the same opponent in 5 or more Key Moment decisions across a career.",
      check: ()=> groupCountRule({ eventId:"key_moment" }, "opponentId", 5)(career) },

    // ----- Balance Wave 7: development-plan and team-chemistry achievements -----
    { key:"filmroommvp", name:"Student of the Game", icon:"star",
      blurb:"Won it with anticipation and processing, not with the arm.",
      hint:"Win MVP in a season spent on the Film Room development plan.",
      check: ()=> seasonRule(s=> s.developmentPlanId==="film" && (s.awards||[]).includes("MVP"))(career) },
    { key:"athleticfreak", name:"Athletic Freak", icon:"mountain",
      blurb:"A brutal offseason in the weight room, cashed in every Sunday.",
      hint:"Post a 1,000-yard rushing season while on the Athletic Camp development plan.",
      check: ()=> seasonRule(s=> s.developmentPlanId==="athletic" && (s.rushYards||0)>=1000)(career) },
    { key:"chemistryguru", name:"Chemistry Guru", icon:"heart",
      blurb:"This locker room trusts him completely, and it shows on every snap.",
      hint:"Reach 90+ team chemistry in a season.",
      check: ()=> seasonRule(s=> (s.teamChemistry||0)>=90)(career) },
    { key:"lonewolf", name:"Lone Wolf", icon:"wing",
      blurb:"Nobody in that building liked him. They still won it all.",
      hint:"Win a championship in a season with 20 or lower team chemistry.",
      check: ()=> seasonRule(s=> (s.teamChemistry??50)<=20 && wonTitle(s))(career) },

    // ----- Balance Wave 7: more team-specific declarative achievements -----
    { key:"titletown", name:"Titletown", icon:"crown",
      blurb:"Green Bay collects championships the way other towns collect parking tickets.",
      hint:"Win three or more championships with the Packers.",
      check: ()=> seasonRule(s=>s.teamId==="GB"&&wonTitle(s), 3)(career) },
    { key:"americasteam", name:"America's Team", icon:"star",
      blurb:"Four straight years, the Cowboys were appointment television, and it was because of him.",
      hint:"Keep an 85+ team grade for 4 consecutive seasons with the Cowboys.",
      check: ()=> consecutiveSeasonRule(s=>s.teamId==="DAL"&&s.teamOverall>=85, 4)(career) },
    { key:"redsea", name:"Red Sea", icon:"bolt",
      blurb:"Kansas City turned into the league's toughest building to play in, twice over.",
      hint:"Win two or more championships with the Chiefs.",
      check: ()=> seasonRule(s=>s.teamId==="KC"&&wonTitle(s), 2)(career) },
    { key:"legionofboom", name:"Legion of Boom", icon:"shield",
      blurb:"The defense won this one. He just had to not lose it.",
      hint:"Win a championship with the Seahawks in a season with fewer than 25 passing touchdowns.",
      check: ()=> seasonRule(s=>s.teamId==="SEA"&&wonTitle(s)&&s.td<25)(career) },
    { key:"windycitychill", name:"Windy City Chill", icon:"snow",
      blurb:"Chicago keeps getting there. Chicago keeps freezing at the door.",
      hint:"Reach the championship game 3+ times with the Bears without ever winning one.",
      check: ()=> allOf(
        seasonRule(s=>s.teamId==="CHI"&&reachedTitleGameAndLost(s), 3),
        ruleNot(seasonRule(s=>s.teamId==="CHI"&&wonTitle(s), 1)),
      )(career) },
    { key:"birdgang", name:"Bird Gang", icon:"wing",
      blurb:"Philadelphia doesn't do quiet championships. It doesn't need to — it's won two of them.",
      hint:"Win two or more championships with the Eagles.",
      check: ()=> seasonRule(s=>s.teamId==="PHI"&&wonTitle(s), 2)(career) },

    // ----- Balance Wave 7: more career-shape/ledger achievements -----
    { key:"dealmaker", name:"Dealmaker", icon:"gauge",
      blurb:"Five contracts, five negotiations, one very well-worn pen.",
      hint:"Sign 5 or more contracts (any structure) across a career.",
      check: ()=> eventCountRule({ eventId:"contract_signed" }, 5)(career) },
    { key:"neverssettled", name:"Never Settled", icon:"compass",
      blurb:"Told no once. Asked again anyway. Got the yes the second time.",
      hint:"Get a trade request denied, then later get one granted.",
      check: ()=> sequenceRule([
        ledgerStep({ eventId:"trade_requested", outcomeId:"denied" }),
        ledgerStep({ eventId:"trade_requested", outcomeId:"granted" }),
      ])(career) },
    { key:"clutchunderpressure", name:"Clutch Under Pressure", icon:"trophy",
      blurb:"Every big possession in the biggest game, he had the answer.",
      hint:"Deliver 3 or more good Key Moment decisions specifically in Super Bowl rounds.",
      check: ()=> (career.eventLedger||[]).filter(e=> e.eventId==="key_moment" && e.severity==="good" && e.metadata && e.metadata.round==="Super Bowl").length>=3 },
    { key:"coasttocoast", name:"Coast to Coast", icon:"infinity",
      blurb:"A ring from each side of the league. There's no bracket he hasn't conquered.",
      hint:"Win a championship with a team from both the AFC and the NFC.",
      check: ()=>{
        const confs = new Set(career.seasonLog.filter(wonTitle).map(s=>conferenceOf(s.teamId, s.year)));
        return confs.size>=2;
      } },
    { key:"underthelights", name:"Under the Lights, Then Without Them", icon:"sunrise",
      blurb:"Won it in the modern spotlight, and won it back when the game barely had cameras at all.",
      hint:"Win a championship in the pre-Super Bowl era (before 1966) and another in the Super Bowl era.",
      check: ()=> career.seasonLog.some(s=>wonTitle(s)&&s.year<1966) && career.seasonLog.some(s=>wonTitle(s)&&s.year>=1966) },
  ];

  function achievementDefFor(key){ return ACHIEVEMENTS.find(a=>a.key===key); }

  function ensureAchievementState(){
    if(!career.achievements) career.achievements = { unlocked:{} };
  }

  // The only writer of career.achievements.unlocked -- permanent, never re-checked once true.
  // Safe to call from anywhere, as often as convenient: called from generateSeason() (catches a
  // season-level statistical achievement the moment it happens), finalizePlayoffOutcome() (this
  // season's ring/awards are final by then, so streak/title-game checks are accurate), and
  // finishCareer() (so a career-ending-only condition, like retiring loyal to one team, can fire).
  function checkAchievements(){
    ensureAchievementState();
    const newlyUnlocked = [];
    ACHIEVEMENTS.forEach(a=>{
      if(career.achievements.unlocked[a.key]) return;
      if(a.check()){ career.achievements.unlocked[a.key] = true; newlyUnlocked.push(a); recordGlobalFirstUnlock(a); }
    });
    if(newlyUnlocked.length) queueAchievementToasts(newlyUnlocked);
  }

  // ----- Global (cross-career) achievement record: "every achievement you've ever earned, across
  // every QB you've ever built, and which one got there first" -- distinct from career.achievements
  // above, which is scoped to the CURRENT career only and discarded once that career ends (only its
  // key LIST survives, copied into a Trophy Room entry's `achievements` array). Same storage
  // convention as Trophy Room (safeStorage-wrapped localStorage + an in-memory session mirror so a
  // blocked-storage context still behaves correctly for the life of this page load).
  const ACHIEVEMENTS_GLOBAL_KEY = "diamondlab.achievementsGlobal";
  let _sessionAchievementsGlobal = null;
  function loadGlobalAchievementsRaw(){
    if(_sessionAchievementsGlobal) return Object.assign({}, _sessionAchievementsGlobal);
    if(!store) return {};
    try{ return JSON.parse(store.getItem(ACHIEVEMENTS_GLOBAL_KEY)||"{}"); }catch(e){ return {}; }
  }
  function saveGlobalAchievements(obj){
    _sessionAchievementsGlobal = Object.assign({}, obj);
    if(!store) return;
    try{ store.setItem(ACHIEVEMENTS_GLOBAL_KEY, JSON.stringify(obj)); }catch(e){}
  }
  // The ONLY writer -- called the moment checkAchievements() unlocks something NEW in the CURRENT,
  // live career, so "first unlocked by" is captured in real time as it actually happens (never
  // overwritten once set -- first claim wins, permanently, even if a later/faster career could in
  // principle have earned it "more impressively").
  function recordGlobalFirstUnlock(def){
    const g = loadGlobalAchievementsRaw();
    if(g[def.key]) return;
    g[def.key] = { name: career.name, team: teamNameAt(career.teamId, career.year), year: career.year };
    saveGlobalAchievements(g);
  }
  // Read path used by the Achievements screen: backfills from Trophy Room history (oldest career
  // first) for anything the live-write path above never got a chance to record -- lets a player who
  // already earned achievements in past careers, before this cross-career view existed, still see
  // accurate "first unlocked by" credit instead of the record only starting from whenever this
  // feature happened to ship. Self-healing and idempotent: once an achievement is backfilled it's
  // saved back, so this scan only ever does real work the first time it finds something missing.
  function loadGlobalAchievementsWithBackfill(){
    const g = loadGlobalAchievementsRaw();
    let changed = false;
    loadTrophyRoom().slice().sort((a,b)=>a.completedAt-b.completedAt).forEach(entry=>{
      (entry.achievements||[]).forEach(key=>{
        if(g[key]) return;
        g[key] = { name: entry.name, team: (entry.teams&&entry.teams.length)?entry.teams[entry.teams.length-1]:null, year: entry.finalYear };
        changed = true;
      });
    });
    if(changed) saveGlobalAchievements(g);
    return g;
  }

  function achievementStatusFor(key){
    ensureAchievementState();
    const def = achievementDefFor(key);
    if(!def) return null;
    return { def, unlocked: !!career.achievements.unlocked[key] };
  }

  function achievementFrameHTML(def, unlocked){
    return `<div class="pb-frame ${unlocked?"unlocked":"locked"}">${badgeIconSVG(def.icon)}</div>`;
  }

  // QOL: a Steam-style "Achievement Unlocked" toast, bottom-right, non-interactive, auto-dismissing.
  // Multiple unlocks in the same tick queue up and show one at a time (never stacked) so a season
  // that happens to earn 2-3 achievements at once doesn't dump a wall of popups simultaneously.
  let achievementToastQueue = [];
  let achievementToastShowing = false;
  function queueAchievementToasts(defs){
    achievementToastQueue.push(...defs);
    if(!achievementToastShowing) showNextAchievementToast();
  }
  function showNextAchievementToast(){
    const def = achievementToastQueue.shift();
    const container = document.getElementById("achievementToastContainer");
    if(!def || !container){ achievementToastShowing = false; return; }
    achievementToastShowing = true;
    const toast = document.createElement("div");
    toast.className = "achievement-toast";
    toast.innerHTML = `<div class="at-frame">${badgeIconSVG(def.icon)}</div>
      <div class="at-text"><div class="at-label">Achievement Unlocked</div><div class="at-name">${svgEscape(def.name)}</div></div>`;
    container.appendChild(toast);
    requestAnimationFrame(()=> requestAnimationFrame(()=> toast.classList.add("show")));
    const dwell = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 2200 : 3500;
    setTimeout(()=>{
      toast.classList.remove("show");
      toast.classList.add("hide");
      setTimeout(()=>{ toast.remove(); showNextAchievementToast(); }, 450);
    }, dwell);
  }

  function safeStorage(){ try{ const k="__glab__"; localStorage.setItem(k,"1"); localStorage.removeItem(k); return window.localStorage; }catch(e){ return null; } }
  const store = safeStorage();
  // In-memory fallback, alongside localStorage: some embedded/preview contexts silently block
  // storage (safeStorage() returns null, or reads/writes quietly no-op), which used to mean
  // best.score never persisted and every single combine falsely claimed "New personal best."
  // _sessionBest mirrors the last-saved value for the life of this page load, so at minimum
  // back-to-back builds in one sitting correctly remember the real best, storage or not.
  let _sessionBest = null;
  function loadBest(){
    if(_sessionBest) return Object.assign({}, _sessionBest);
    if(!store) return {};
    try{ return JSON.parse(store.getItem("diamondlab.qb.best")||"{}"); }catch(e){ return {}; }
  }
  function saveBest(obj){
    _sessionBest = Object.assign({}, obj);
    if(!store) return;
    try{ store.setItem("diamondlab.qb.best", JSON.stringify(obj)); }catch(e){}
  }

  // ----- Trophy Room: a local leaderboard across every completed career on this browser, not just
  // the single "best" HOF tier diamondlab.qb.best already tracks -- lets a player who's run a dozen
  // builds actually compare them (most rings, highest yards, best rating, biggest paycheck), same
  // "browser-local, no real accounts" constraint as the last-build profile above. Capped at 60
  // entries, dropping the OLDEST first, so this can't grow without bound over a long play history.
  const TROPHY_ROOM_KEY = "diamondlab.trophyroom";
  const TROPHY_ROOM_CAP = 60;
  let _sessionTrophyRoom = null;
  function loadTrophyRoom(){
    if(_sessionTrophyRoom) return _sessionTrophyRoom.slice();
    if(!store) return [];
    try{ const raw = store.getItem(TROPHY_ROOM_KEY); return raw ? JSON.parse(raw) : []; }catch(e){ return []; }
  }
  function saveTrophyRoomEntry(entry){
    const list = loadTrophyRoom();
    list.push(entry);
    while(list.length>TROPHY_ROOM_CAP) list.shift();
    _sessionTrophyRoom = list;
    if(!store) return;
    try{ store.setItem(TROPHY_ROOM_KEY, JSON.stringify(list)); }catch(e){}
  }
  const TROPHY_ROOM_SORTERS = {
    recent: (a,b)=> b.completedAt-a.completedAt,
    rings: (a,b)=> b.rings-a.rings,
    yards: (a,b)=> b.yards-a.yards,
    rating: (a,b)=> b.rating-a.rating,
    earnings: (a,b)=> b.earnings-a.earnings,
    seasons: (a,b)=> b.seasons-a.seasons,
    td: (a,b)=> b.td-a.td,
  };
  function buildTrophyRoomTableHTML(sortKey){
    const list = loadTrophyRoom();
    if(!list.length){
      return `<div class="calc-refnote">No completed careers yet — retire, get released, or ride one out to the end to start building your Trophy Room.</div>`;
    }
    const sorted = list.slice().sort(TROPHY_ROOM_SORTERS[sortKey]||TROPHY_ROOM_SORTERS.recent);
    // Records are computed across the WHOLE room, independent of the current sort, so which cell
    // is gold never changes just because you're looking at a different order.
    const maxOf = key => list.reduce((m,e)=>Math.max(m,safeNum(e[key],0)), 0);
    const maxRings = maxOf("rings"), maxYards = maxOf("yards"), maxRating = maxOf("rating"),
      maxEarnings = maxOf("earnings"), maxSeasons = maxOf("seasons"), maxTd = maxOf("td");
    // safeNum guards every cell here, not just the ones that are visibly wrong -- a career saved
    // to the Trophy Room while its stats were NaN (e.g. the post-scandal team-reassignment bug,
    // see PROGRESS.md Round 11) round-trips through localStorage as `null` (JSON has no NaN), and
    // `null.toLocaleString()`/`null.toFixed()` throw. That throw happened INSIDE this function,
    // which renderTrophyRoomScreen() calls BEFORE showScreen("trophyroom") -- so the screen never
    // showed at all, which is exactly what "clicked Trophy Room, nothing happens" looks like from
    // the outside. A single already-corrupted entry from before this fix was in place was enough
    // to permanently block the whole room from ever opening again.
    const cell = (value, isMax, fmt) => { const v = safeNum(value,0); return `<td class="tabular${isMax && v>0 ? " tr-record" : ""}">${fmt?fmt(v):v}</td>`; };
    const rows = sorted.map(e=>`<tr>
        <td>${svgEscape(e.name)} <span style="color:var(--ink-muted);">— ${svgEscape(e.decade)}</span></td>
        <td>${svgEscape(e.verdict)}</td>
        ${cell(e.seasons, e.seasons===maxSeasons)}
        ${cell(e.rings, e.rings===maxRings)}
        ${cell(e.yards, e.yards===maxYards, v=>v.toLocaleString())}
        ${cell(e.td, e.td===maxTd)}
        ${cell(e.rating, e.rating===maxRating, v=>v.toFixed(1))}
        ${cell(e.earnings, e.earnings===maxEarnings, v=>fmtMoney(v))}
        <td><button type="button" class="btn-ghost-inline" data-card-id="${e.id}">Card</button></td>
      </tr>`).join("");
    return `<div class="table-wrap">
        <table class="league-table">
          <thead><tr><th>QB</th><th>Verdict</th><th class="tabular">Seasons</th><th class="tabular">Rings</th><th class="tabular">Pass Yds</th><th class="tabular">TD</th><th class="tabular">Rating</th><th class="tabular">Earnings</th><th></th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      <div class="calc-refnote" style="margin-top:0.6rem;">Gold cells mark this browser's all-time record in that column. ${list.length} career${list.length===1?"":"s"} logged (last ${TROPHY_ROOM_CAP} kept).</div>`;
  }

  /* ================= Exportable Baseball Card =================
     A flippable trading-card visual for one completed career (Trophy Room entry shape --
     see saveTrophyRoomEntry above). Built ENTIRELY as inline SVG (front and back faces, each a
     self-contained "0 0 400 560" viewBox string) rather than HTML/CSS, specifically so the exact
     same markup can be (a) dropped into the DOM for the on-screen flip view and (b) serialized
     straight into a data:image/svg+xml URI for the PNG export -- no html2canvas or any other
     library involved, same "no chart library, just plain SVG strings" convention as the radar
     chart / sparkline / bracket renderers above. Because the export path re-parses this markup
     in an isolated (non-page) SVG context, it can't resolve the app's CSS custom properties
     (var(--gold) etc.) or guarantee the Google Fonts are loaded there -- so every color below is a
     literal hex (see CARD_HEX), and font-family lists a system fallback first for the export to
     degrade gracefully; the on-screen version still looks identical since it's the same string. */
  const CARD_HEX = { gold:"#D4AF37", goldStrong:"#E8C860", ink:"#ECF2EC", inkMuted:"#8CA096",
    surface:"#1A2622", surfaceRaised:"#202F29", bg:"#12181B", leather:"#B08D2E", line:"rgba(236,242,236,0.18)" };
  const CARD_FONT_DISPLAY = "Oswald, Arial Narrow, Impact, sans-serif";
  const CARD_FONT_BODY = "Libre Franklin, -apple-system, Segoe UI, sans-serif";
  const CARD_RARITY = {
    "Out of the League": { border:"#5b564f", label:"COMMON" },
    "Cup of Coffee": { border:"#5b564f", label:"COMMON" },
    "Journeyman": { border:"#8a8377", label:"COMMON" },
    "Longtime Regular": { border:"#B08D2E", label:"UNCOMMON" },
    "Hall of Very Good": { border:"#c9cdd6", label:"RARE" },
    "Hall of Famer": { border:"#D4AF37", label:"LEGENDARY" },
    "First-Ballot Hall of Famer": { border:"#E8C860", label:"HOLO" },
  };
  function cardRarityFor(verdict){ return CARD_RARITY[verdict] || CARD_RARITY["Journeyman"]; }
  const CARD_EXIT_LINES = {
    waived: "Released — and the phone never rang again.",
    age: "Played until his body wouldn't let him anymore.",
    banned: "Banned from the league.",
    injury: "Forced out by injury.",
    retired: "Walked away on his own terms.",
  };
  function cardExitLine(exitReason){ return CARD_EXIT_LINES[exitReason] || "Career complete."; }

  function cardIconSVG(iconKey, x, y, size, color){
    return `<svg x="${x}" y="${y}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${BADGE_ICONS[iconKey]||BADGE_ICONS.star}</svg>`;
  }
  // Every achievement shown on a card is, by definition, one this career actually earned -- no
  // locked state to represent here, so this is a single flat gold-medallion style, not the
  // tiered/multi-shape frame the old equip system used.
  function cardAchievementGlyphSVG(def, cx, cy){
    const r = 18;
    return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${CARD_HEX.goldStrong}" stroke="${CARD_HEX.gold}" stroke-width="1.5"/>${cardIconSVG(def.icon, cx-11, cy-11, 22, "#1c1a17")}`;
  }

  function cardCenteredText(x, y, text, opts={}){
    const { size=16, weight=600, color=CARD_HEX.ink, font=CARD_FONT_BODY, letterSpacing=0, anchor="middle" } = opts;
    return `<text x="${x}" y="${y}" text-anchor="${anchor}" font-family="${font}" font-size="${size}" font-weight="${weight}" fill="${color}"${letterSpacing?` letter-spacing="${letterSpacing}"`:""}>${svgEscape(text)}</text>`;
  }
  function cardTruncate(text, max){ return text.length>max ? text.slice(0,max-1)+"…" : text; }
  // Greedy word-wrap onto up to `maxLines` lines of at most `maxPerLine` characters each --
  // used for the achievement-grid labels on the card back. Balance Wave 6/7 added several longer
  // achievement names ("Under the Lights, Then Without Them", "Rewriting the Headline") that the
  // old 2-line-only version (cardWrapTwoLines) mishandled: it split once, and if what remained
  // after that single split was STILL too long for one line, it just sliced+ellipsized that
  // overlong remainder WITHOUT re-wrapping it -- rendering one line of unwrapped SVG <text> wider
  // than the grid cell, which bleeds visibly into the neighboring cell (SVG text never auto-wraps
  // or clips to a box on its own). This version always emits <=maxLines lines each <=maxPerLine
  // chars; only if the name genuinely needs MORE than maxLines does the last line take an ellipsis
  // (folding in whatever words didn't fit), so real names load right up to 3 full lines before any
  // truncation happens at all -- 3 lines fits this card's own vertical budget (see the row-spacing
  // math in the caller: startY/cellH leave exactly enough room for a 3-line label without colliding
  // with the achievement icon in the row below).
  function cardWrapLines(text, maxPerLine, maxLines=3){
    const words = text.split(/\s+/).filter(Boolean);
    const lines = [];
    let current = "";
    words.forEach(word=>{
      const candidate = current ? `${current} ${word}` : word;
      if(candidate.length<=maxPerLine){ current = candidate; return; }
      if(current) lines.push(current);
      if(word.length>maxPerLine){
        // a single word longer than a whole line on its own: hard-break it across lines
        let remainder = word;
        while(remainder.length>maxPerLine){ lines.push(remainder.slice(0,maxPerLine)); remainder = remainder.slice(maxPerLine); }
        current = remainder;
      } else {
        current = word;
      }
    });
    if(current) lines.push(current);
    if(lines.length<=maxLines) return lines;
    const kept = lines.slice(0, maxLines-1);
    const rest = lines.slice(maxLines-1).join(" ");
    kept.push(rest.length>maxPerLine ? rest.slice(0,maxPerLine-1)+"…" : rest);
    return kept;
  }

  function buildCardFaceSVG(entry, side){
    const rarity = cardRarityFor(entry.verdict);
    const glow = rarity.label==="HOLO" || rarity.label==="LEGENDARY";
    const nameSize = entry.name.length>18 ? 26 : entry.name.length>13 ? 30 : 34;
    const bg = `<defs>
        <linearGradient id="cardBg-${side}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${CARD_HEX.surfaceRaised}"/>
          <stop offset="100%" stop-color="${CARD_HEX.bg}"/>
        </linearGradient>
      </defs>
      <rect x="4" y="4" width="392" height="552" rx="20" fill="url(#cardBg-${side})" stroke="${rarity.border}" stroke-width="${glow?5:3}"/>
      ${glow ? `<rect x="9" y="9" width="382" height="542" rx="16" fill="none" stroke="${rarity.border}" stroke-width="1" opacity="0.5"/>` : ""}
      <rect x="300" y="20" width="84" height="22" rx="11" fill="rgba(0,0,0,0.35)" stroke="${rarity.border}" stroke-width="1"/>
      ${cardCenteredText(342, 35, rarity.label, {size:11, weight:800, color:rarity.border, font:CARD_FONT_DISPLAY, letterSpacing:1, anchor:"middle"})}`;

    // A fixed-size row of small team badges (same gradient+initials treatment as the draft-night
    // reveal's .dn-badge -- teamColors()/teamInitials(), reused here rather than re-invented) in
    // place of an open-ended "→"-joined team-name text line. That text line (teamsLine, below) had
    // no real ceiling: a well-traveled, many-team career could grow it past any truncation length
    // that still reads cleanly, and a long team name (e.g. "Tampa Bay Buccaneers") multiplied across
    // several teams made it worse. A badge is a FIXED width regardless of how long the team's name
    // is, and capping at 5 badges (+N beyond that) bounds the row's total width outright instead of
    // guessing a character budget. Only used when entry.teamIds exists -- trophy entries saved
    // before this existed only have team NAMES (entry.teams), which can't be mapped back to a
    // stable id (team display names change by era and aren't unique across teams), so those fall
    // back to the original text line exactly as before; this is purely additive for new entries.
    function cardTeamBadgesSVG(teamIds, teamNames, cy){
      if(!teamIds || !teamIds.length) return null;
      const MAX_BADGES = 5;
      const ids = teamIds.slice(0, MAX_BADGES);
      const extra = teamIds.length - ids.length;
      const r = 11, gap = 14, stepW = r*2+gap;
      const totalW = ids.length*r*2 + (ids.length-1)*gap + (extra>0 ? stepW : 0);
      let x = 200 - totalW/2 + r;
      let out = "";
      ids.forEach((tid,i)=>{
        if(i>0) out += cardCenteredText(x-stepW/2, cy+4, "→", {size:10, color:CARD_HEX.inkMuted});
        const [c1,c2] = teamColors(tid);
        out += `<circle cx="${x}" cy="${cy}" r="${r}" fill="${c1}" stroke="${c2}" stroke-width="1.5"/>`;
        out += cardCenteredText(x, cy+3, teamInitials(teamNames[i]||tid), {size:8.5, weight:800, color:"#fff", font:CARD_FONT_DISPLAY});
        x += stepW;
      });
      if(extra>0){
        out += cardCenteredText(x-stepW/2, cy+4, "→", {size:10, color:CARD_HEX.inkMuted});
        out += `<circle cx="${x}" cy="${cy}" r="${r}" fill="rgba(255,255,255,0.08)" stroke="${CARD_HEX.line}" stroke-width="1"/>`;
        out += cardCenteredText(x, cy+3, `+${extra}`, {size:8, weight:700, color:CARD_HEX.inkMuted, font:CARD_FONT_DISPLAY});
      }
      return out;
    }

    if(side==="front"){
      const teamsLine = cardTruncate(entry.teams && entry.teams.length ? entry.teams.join(" → ") : "—", 44);
      const teamBadgeRow = cardTeamBadgesSVG(entry.teamIds, entry.teams, 128);
      const trophyBits = [];
      if(entry.mvps) trophyBits.push(`${entry.mvps}x MVP`);
      if(entry.allPros) trophyBits.push(`${entry.allPros}x All-Pro`);
      if(entry.proBowls) trophyBits.push(`${entry.proBowls}x Pro Bowl`);
      // Uncapped, a max-decorated (GOAT-tier) career's trophy line can genuinely run long --
      // e.g. "9x MVP  ·  12x All-Pro  ·  15x Pro Bowl" -- cap it defensively the same way teamsLine
      // just above already is.
      const trophyLine = cardTruncate(trophyBits.length ? trophyBits.join("  ·  ") : "No accolades logged", 48);
      const statBoxes = [
        ["SEASONS", entry.seasons],
        ["RINGS", entry.rings],
        ["PASS YDS", entry.yards.toLocaleString()],
        ["PASS TD", entry.td],
        ["INT", entry.int],
        ["RATING", entry.rating.toFixed(1)],
      ];
      const gridX = 40, gridY = 366, boxW = 106, boxH = 66, gapX = 8, gapY = 8;
      const statHtml = statBoxes.map((s,i)=>{
        const col = i%3, row = Math.floor(i/3);
        const x = gridX + col*(boxW+gapX), y = gridY + row*(boxH+gapY);
        return `<rect x="${x}" y="${y}" width="${boxW}" height="${boxH}" rx="8" fill="rgba(255,255,255,0.04)" stroke="${CARD_HEX.line}" stroke-width="1"/>
          ${cardCenteredText(x+boxW/2, y+24, String(s[0]), {size:10, weight:700, color:CARD_HEX.inkMuted, font:CARD_FONT_DISPLAY, letterSpacing:0.5})}
          ${cardCenteredText(x+boxW/2, y+50, String(s[1]), {size:20, weight:800, color:CARD_HEX.ink, font:CARD_FONT_DISPLAY})}`;
      }).join("");
      return `<svg viewBox="0 0 400 560" xmlns="http://www.w3.org/2000/svg">
          ${bg}
          ${cardCenteredText(200, 82, cardTruncate(entry.name,22), {size:nameSize, weight:800, font:CARD_FONT_DISPLAY, letterSpacing:0.5})}
          ${(()=>{
            // Truncate the COLLEGE name if the combined line is too long, never the "Class of
            // YYYY" suffix -- the draft year is the more load-bearing half of this line, and a
            // flat cardTruncate(combinedString,40) could just as easily eat into it instead (a
            // real case: "University of Southern California · Class of 1974" cut to "...· Cla…",
            // silently dropping the year).
            const classSuffix = ` · Class of ${entry.draftYear}`;
            const collegeBudget = Math.max(10, 40-classSuffix.length);
            return cardCenteredText(200, 106, `${cardTruncate(entry.college||"—", collegeBudget)}${classSuffix}`, {size:13, color:CARD_HEX.inkMuted});
          })()}
          ${teamBadgeRow || cardCenteredText(200, 128, teamsLine, {size:12, color:CARD_HEX.goldStrong})}
          <circle cx="200" cy="210" r="58" fill="rgba(212,175,55,0.08)" stroke="${CARD_HEX.gold}" stroke-width="2.5"/>
          ${cardCenteredText(200, 202, "PEAK OVERALL", {size:10, weight:700, color:CARD_HEX.inkMuted, font:CARD_FONT_DISPLAY, letterSpacing:1})}
          ${cardCenteredText(200, 238, String(entry.peakOverall||Math.round(entry.rating)), {size:42, weight:800, color:CARD_HEX.gold, font:CARD_FONT_DISPLAY})}
          ${cardCenteredText(200, 296, entry.verdict, {size:14, weight:700, color:CARD_HEX.ink, font:CARD_FONT_DISPLAY})}
          ${cardCenteredText(200, 318, trophyLine, {size:11, color:CARD_HEX.inkMuted})}
          ${statHtml}
          ${cardCenteredText(200, 540, "GRIDIRON LAB", {size:10, weight:700, color:CARD_HEX.inkMuted, font:CARD_FONT_DISPLAY, letterSpacing:2})}
        </svg>`;
    }

    // ----- back face -----
    // entry.achievements is an array of keys (current shape); entry.equippedBadges is the older,
    // pre-rework shape (array of {key,tier} from the 3-slot equip system) -- read defensively so a
    // card saved before this round still renders instead of showing nothing.
    const earnedKeys = entry.achievements || (entry.equippedBadges||[]).map(b=>b.key) || [];
    const earnedDefs = earnedKeys.map(k=>achievementDefFor(k)).filter(Boolean);
    const GRID_COLS = 4, GRID_ROWS = 3, MAX_GRID = GRID_COLS*GRID_ROWS;
    const shown = earnedDefs.slice(0, MAX_GRID);
    const overflow = earnedDefs.length - shown.length;
    const cellW = 88, cellH = 76, startX = 68, startY = 118;
    const achHtml = shown.length ? shown.map((def,i)=>{
      const col = i%GRID_COLS, row = Math.floor(i/GRID_COLS);
      const cx = startX + col*cellW, cy = startY + row*cellH;
      const lines = cardWrapLines(def.name, 15, 3);
      const labelHtml = lines.map((line,li)=> cardCenteredText(cx, cy+30+li*11, line, {size:8, weight:700, color:CARD_HEX.ink})).join("");
      return `${cardAchievementGlyphSVG(def, cx, cy)}${labelHtml}`;
    }).join("") : cardCenteredText(200, 150, "No achievements earned this career.", {size:12, color:CARD_HEX.inkMuted});
    const overflowHtml = overflow>0 ? cardCenteredText(200, startY+GRID_ROWS*cellH-6, `+${overflow} more`, {size:10, weight:700, color:CARD_HEX.goldStrong}) : "";
    let y = 340;
    const infoLines = [];
    if(entry.position) infoLines.push(["POSITION", positionLabel(entry.position)]);
    infoLines.push(["DRAFTED", entry.draftLine ? entry.draftLine.replace(/^\d{4}:\s*/,"") : "Undrafted"]);
    infoLines.push(["HOW IT ENDED", cardExitLine(entry.exitReason)]);
    if(entry.relationshipLine) infoLines.push(["OFF THE FIELD", entry.relationshipLine]);
    const infoHtml = infoLines.map(([label, text])=>{
      const html = `${cardCenteredText(200, y, label, {size:10, weight:700, color:CARD_HEX.goldStrong, font:CARD_FONT_DISPLAY, letterSpacing:1})}
        ${cardCenteredText(200, y+20, cardTruncate(text,52), {size:13, color:CARD_HEX.ink})}`;
      y += 56;
      return html;
    }).join("");
    return `<svg viewBox="0 0 400 560" xmlns="http://www.w3.org/2000/svg">
        ${bg}
        ${cardCenteredText(200, 60, "CAREER FILE", {size:14, weight:700, color:CARD_HEX.inkMuted, font:CARD_FONT_DISPLAY, letterSpacing:2})}
        ${cardCenteredText(200, 82, `ACHIEVEMENTS EARNED (${earnedDefs.length})`, {size:10, weight:700, color:CARD_HEX.inkMuted, font:CARD_FONT_DISPLAY, letterSpacing:1})}
        ${achHtml}
        ${overflowHtml}
        ${infoHtml}
        ${cardCenteredText(200, 540, cardTruncate(`${entry.name} — ${entry.decade}`, 42), {size:10, weight:700, color:CARD_HEX.inkMuted, font:CARD_FONT_DISPLAY, letterSpacing:1})}
      </svg>`;
  }

  function openBaseballCard(entry){
    const overlay = document.getElementById("baseballCardOverlay");
    if(!overlay || !entry) return;
    overlay.innerHTML = `<div class="card-scene">
        <button type="button" class="be-close card-close" id="cardCloseBtn" aria-label="Close">×</button>
        <div class="card-flip" id="cardFlip">
          <div class="card-face card-front">${buildCardFaceSVG(entry,"front")}</div>
          <div class="card-face card-back">${buildCardFaceSVG(entry,"back")}</div>
        </div>
        <div class="card-actions">
          <button type="button" class="btn btn-ghost" id="cardFlipBtn">Flip card</button>
          <button type="button" class="btn btn-leather" id="cardExportBtn">Save as image</button>
        </div>
        <div class="card-export-status" id="cardExportStatus"></div>
      </div>`;
    const flipEl = overlay.querySelector("#cardFlip");
    overlay.querySelector("#cardCloseBtn").addEventListener("click", closeBaseballCard);
    overlay.querySelector("#cardFlipBtn").addEventListener("click", ()=> flipEl.classList.toggle("flipped"));
    flipEl.addEventListener("click", ()=> flipEl.classList.toggle("flipped"));
    overlay.querySelector("#cardExportBtn").addEventListener("click", (e)=>{ e.stopPropagation(); exportBaseballCard(entry); });
    openDialog(overlay, { label: `${entry.name} baseball card`, initialFocus: overlay.querySelector("#cardCloseBtn") });
  }
  function closeBaseballCard(){
    const overlay = document.getElementById("baseballCardOverlay");
    if(!overlay) return;
    closeDialog(overlay);
    overlay.innerHTML = "";
  }
  function exportBaseballCard(entry){
    const status = document.getElementById("cardExportStatus");
    const front = buildCardFaceSVG(entry,"front");
    const back = buildCardFaceSVG(entry,"back");
    const combined = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="1140" viewBox="0 0 400 1140">
        <rect width="400" height="1140" fill="${CARD_HEX.bg}"/>
        <g>${front}</g>
        <g transform="translate(0,580)">${back}</g>
      </svg>`;
    try{
      const svgDataUri = "data:image/svg+xml;charset=utf-8;base64," + btoa(unescape(encodeURIComponent(combined)));
      const img = new Image();
      img.onload = ()=>{
        const scale = 2;
        const canvas = document.createElement("canvas");
        canvas.width = 400*scale; canvas.height = 1140*scale;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const pngUrl = canvas.toDataURL("image/png");
        const a = document.createElement("a");
        a.href = pngUrl;
        a.download = `${entry.name.replace(/[^a-z0-9]+/gi,"_")}_card.png`;
        document.body.appendChild(a); a.click(); a.remove();
        if(status) status.textContent = "Saved.";
      };
      img.onerror = ()=>{ if(status) status.textContent = "Couldn't export an image in this browser — try a different browser."; };
      img.src = svgDataUri;
    }catch(e){
      if(status) status.textContent = "Couldn't export an image in this browser — try a different browser.";
    }
  }

  // ----- Local build profile: the practical version of "player accounts" on a platform with no
  // sign-in and no per-account server storage (the Artifact runtime only exposes a single SHARED
  // document, downloads, and MCP -- there's no viewer-identity capability to build real accounts
  // on). This remembers the player's last completed combine build on THIS browser/device only, so
  // returning to the game doesn't mean starting completely from scratch -- not a login, no
  // cross-device sync, just continuity for the one person actually sitting at this browser.
  // Same safeStorage/in-memory-fallback pattern as loadBest/saveBest above, for the same reason:
  // some embedded/preview contexts silently block real localStorage.
  let _sessionLastBuild = null;
  function loadLastBuildProfile(){
    if(_sessionLastBuild) return _sessionLastBuild;
    if(!store) return null;
    try{ const raw = store.getItem("diamondlab.lastbuild"); return raw ? JSON.parse(raw) : null; }catch(e){ return null; }
  }
  function saveLastBuildProfile(picks){
    // cs.picks holds live player object references (whole QBS entries) -- only the handful of
    // fields finishCombine()/computeCombineScore() and the roster-list/radar UI actually need get
    // serialized, not the full historical-player object graph.
    const serial = picks.map(p=>({ attr:p.attr, key:p.key, value:p.value, decade:p.decade,
      playerName:p.player.name, playerTeam:p.player.team }));
    const obj = { picks: serial, savedAt: Date.now() };
    _sessionLastBuild = obj;
    if(!store) return;
    try{ store.setItem("diamondlab.lastbuild", JSON.stringify(obj)); }catch(e){}
  }
  function relativeTimeAgo(ms){
    const diffSec = Math.max(0, Math.round((Date.now()-ms)/1000));
    if(diffSec<60) return "just now";
    const diffMin = Math.round(diffSec/60);
    if(diffMin<60) return `${diffMin} minute${diffMin===1?"":"s"} ago`;
    const diffHr = Math.round(diffMin/60);
    if(diffHr<24) return `${diffHr} hour${diffHr===1?"":"s"} ago`;
    const diffDay = Math.round(diffHr/24);
    if(diffDay<30) return `${diffDay} day${diffDay===1?"":"s"} ago`;
    const diffMonth = Math.round(diffDay/30);
    if(diffMonth<12) return `${diffMonth} month${diffMonth===1?"":"s"} ago`;
    const diffYear = Math.round(diffMonth/12);
    return `${diffYear} year${diffYear===1?"":"s"} ago`;
  }
  function renderLastBuildStrip(){
    const el = document.getElementById("lastBuildStrip");
    if(!el) return;
    const saved = loadLastBuildProfile();
    if(!saved || !saved.picks || !saved.picks.length){ el.style.display="none"; return; }
    const score = computeCombineScore(saved.picks).score;
    const g = gradeFor(score);
    el.style.display="flex";
    el.innerHTML = `Last build: <b>${score}</b> (${svgEscape(g.flavor)}) — saved ${relativeTimeAgo(saved.savedAt)} on this browser <button type="button" class="btn-ghost-inline" id="loadLastBuildBtn">Resume this build →</button>`;
    const btn = document.getElementById("loadLastBuildBtn");
    if(btn) btn.addEventListener("click", loadLastBuildIntoCombine);
  }
  function loadLastBuildIntoCombine(){
    const saved = loadLastBuildProfile();
    if(!saved || !saved.picks || !saved.picks.length) return;
    cs.picks = saved.picks.map(sp=>({
      attr: sp.attr, key: sp.key, value: sp.value, decade: sp.decade,
      player: { name: sp.playerName, team: sp.playerTeam },
    }));
    finishCombine();
  }

  // ----- In-progress career save/resume: on a native mobile shell the OS can kill a backgrounded
  // tab far more readily than a desktop browser ever would, and until now a career lived ONLY in
  // memory (`career`/`build` above) -- closing or losing the app mid-career meant starting over.
  // Checkpointed once per season (see playSeasonAndRender) rather than continuously, since that's
  // the one point in the whole career-advance chain where state is simple and stable: no mid-event
  // choice pending, no animation half-played. `build` is saved alongside `career` because it's a
  // separate top-level variable that developAttributes mutates over time -- career.originalBuild
  // is only the frozen draft-day snapshot, not the current attributes.
  // Wave 1 (MASTER_REMEDIATION_SPEC.md): a versioned save envelope wrapping the same {career,build}
  // shape that always lived at the top level here -- {schemaVersion, savedAt, checkpoint, career,
  // build}. `checkpoint` records WHERE in the career-advance flow the save happened (phase/year/
  // playoffRoundIndex), for diagnostics and for future waves that need to resume more precisely
  // than "re-render the last logged season's card" -- that resume behavior itself is unchanged
  // this wave.
  // Wave 2A: bumped to schemaVersion 2 -- the canonical qbsById/teamQbDepth/freeAgentQbIds/
  // retiredQbIds registry (Section 5's target schema). See syncQbRegistryFromLegacy for what
  // building it actually involves.
  const SAVE_SCHEMA_VERSION = 3;
  const SOLO_ACTIVE_CAREER_KEY = "diamondlab.activeCareer";
  // Multiplayer Parallel Universe Mode (MULTIPLAYER_MODE_SPEC.md section 12.3): solo play always
  // uses the plain key above, completely untouched -- a multiplayer session (Create/Join Private
  // Match, or resuming one from the "Active Multiplayer Matches" list) points this at a namespaced
  // key instead, `diamondlab.activeCareer.mp.<matchId>.<slot>`, so a device can hold any number of
  // concurrent multiplayer matches (plus one ordinary solo save) without any of them colliding.
  // Every read/write in this file already goes through saveActiveCareer/loadActiveCareer/
  // clearActiveCareer, which all read this ONE variable -- switching it is the entire mechanism.
  let activeCareerKey = SOLO_ACTIVE_CAREER_KEY;
  function multiplayerSaveKey(matchId, slot){ return `${SOLO_ACTIVE_CAREER_KEY}.mp.${matchId}.${slot}`; }
  // The current multiplayer session context, if any -- null for ordinary solo play. Stamped onto
  // a career the moment it's created (see the career={...} object literal) so a finished career
  // still remembers which match it belonged to even after this in-memory context is gone.
  let currentMultiplayerContext = null; // { matchId, slot, seed, decadeIndex } | null
  // Every ordinary (non-multiplayer) combine entry point calls this first: points saves back at the
  // plain solo key, drops any lingering multiplayer context, and restores real (unseeded)
  // Math.random if a previous multiplayer session left it installed. Without this, starting a solo
  // combine right after playing a multiplayer match would silently keep running on that match's
  // seed and save into that match's slot instead of a fresh solo save.
  function resetToSoloSession(){
    activeCareerKey = SOLO_ACTIVE_CAREER_KEY;
    currentMultiplayerContext = null;
    restoreRandom();
    // Multiplayer force-sets cs.mode="blind" without ever touching the Combine Setup screen's own
    // toggle (it never shows that screen) -- reset back to the plain default here so a solo Combine
    // right after a multiplayer match doesn't silently inherit a forced-blind mode the player never
    // actually chose. cs itself is declared further down but already initialized by the time any
    // click handler can call this.
    cs.mode = "classic";
  }
  let _lastCheckpoint = null;
  // Pure -- never mutates `raw` in place (spreads into new objects instead), and never rolls fresh
  // Math.random() (migration requirement #9: the same save must migrate identically every time).
  // A pre-Wave-1 save has no schemaVersion at all (just {career,build,savedAt}); wrap it into the
  // v1 envelope with a safe, generic checkpoint rather than guessing which exact phase it was
  // mid-flow (resume's own logic -- re-rendering the last logged season's card -- already handles
  // any of those cases identically today, so nothing here needs to be precise, only present).
  // Wave 2A: every load -- pre-Wave-1, v1, or already-v2 -- then runs syncQbRegistryFromLegacy on
  // whatever `career` it has, unconditionally. This is what actually builds qbsById/teamQbDepth/
  // freeAgentQbIds/retiredQbIds for a save that never had them (the real v1->v2 migration), AND
  // re-derives them fresh for an already-v2 save loaded in a NEW session -- a save/reload round trip
  // deserializes every object reference independently, so without an unconditional rebuild here,
  // a previously-serialized qbsById's copies and the legacy leagueRivals/leagueDepthCharts/
  // freeAgentPool arrays' copies would silently diverge into different object instances sharing the
  // same id the moment either was mutated post-reload.
  function migrateSaveEnvelope(raw){
    if(!raw) return null;
    let envelope = raw;
    if(envelope.schemaVersion==null){
      envelope = {
        schemaVersion: 1,
        savedAt: envelope.savedAt || Date.now(),
        checkpoint: { phase:"decision", year: envelope.career ? envelope.career.year : null, eventId:null, playoffRoundIndex:null },
        career: envelope.career,
        build: envelope.build,
      };
    }
    if(envelope.career){
      syncQbRegistryFromLegacy(envelope.career);
      migrateTiesDefaults(envelope.career);
      migrateTeamOverallDerivation(envelope.career);
      migrateDevelopmentAgency(envelope.career);
    }
    if(envelope.schemaVersion < SAVE_SCHEMA_VERSION) envelope = { ...envelope, schemaVersion: SAVE_SCHEMA_VERSION };
    return envelope;
  }
  // Wave 4 (MASTER_REMEDIATION_SPEC.md, Section 6 migration requirement #8 / required design #5):
  // "Add ties defaults to season/totals rows." A save made before ties existed as a concept has
  // season rows and totals objects with no `ties` field at all (not even 0) -- every ties-aware
  // display site in this file already treats a missing ties as 0 via `||0`/`??0` at the READ point,
  // so this migration is defense-in-depth (matching the pattern every other Wave 2A/2B migration
  // step already follows: repair the data itself once, on load, rather than relying on every future
  // reader to keep remembering the same fallback) rather than a fix for an otherwise-broken display.
  // Runs on every load (like syncQbRegistryFromLegacy), which is safe and idempotent -- a save that
  // already has ties everywhere is untouched.
  function migrateTiesDefaults(careerObj){
    if(!careerObj) return;
    const fixTotals = t => { if(t && t.ties==null) t.ties = 0; };
    const fixSeasons = seasons => { (seasons||[]).forEach(s=>{ if(s.ties==null) s.ties = 0; }); };
    fixTotals(careerObj.totals);
    fixSeasons(careerObj.seasonLog);
    Object.values(careerObj.qbsById||{}).forEach(qb=>{
      fixTotals(qb.totals);
      fixSeasons(qb.seasons);
    });
    Object.keys(careerObj.teamSeasonHistory||{}).forEach(teamId=>{
      // Wave 5 (task #8): a save from before the championship flag existed has no wonChampionship
      // field at all on its history rows -- every read site already treats a missing flag as falsy,
      // so this is defense-in-depth, matching the ties backfill right above it.
      // Wave 6: a save from before madePlayoffs existed has no way to know whether a given old
      // season's row was actually a playoff team (that fact lived only in the season's own
      // leagueStandings.seeded, long gone from a season predating this field) -- best-effort
      // backfill from whatever title flags the row DOES have (a division/conference/championship
      // win implies a playoff appearance); a wildcard team eliminated in the first round with no
      // title flag will read as false for any pre-existing row, a documented approximation limited
      // to saves made before this wave. Every row recorded from here forward is exact.
      (careerObj.teamSeasonHistory[teamId]||[]).forEach(h=>{
        if(h.ties==null) h.ties = 0;
        if(h.wonChampionship==null) h.wonChampionship = false;
        if(h.madePlayoffs==null) h.madePlayoffs = !!(h.wonDivision || h.wonConference || h.wonChampionship);
      });
    });
  }
  // Wave 5 (MASTER_REMEDIATION_SPEC.md task #3): reconciles every team's aggregate (leagueStrength/
  // teamStrength) to computeTeamOverall's derivation from its five persistent components, exactly
  // once on load. A save from before this wave has leagueStrength/teamStrength values that drifted
  // independently of oline/weapons/defense/coaching/gmGrade -- without this one-time reconciliation,
  // the very next adjustTeamStrength call (any seasonal drift, any org event) would silently snap
  // the aggregate to whatever computeTeamOverall already implies, an unexplained jump the player
  // never asked for. Deterministic and pure -- no Math.random(), just re-deriving from data the
  // save already has. Safe to run every load: a save whose aggregate already matches its components
  // is untouched (up to integer rounding).
  function migrateTeamOverallDerivation(careerObj){
    if(!careerObj) return;
    if(careerObj.oline!=null){
      careerObj.teamStrength = clamp(Math.round(computeTeamOverall(careerObj)), 20, 97);
      if(careerObj.leagueStrength && careerObj.teamId) careerObj.leagueStrength[careerObj.teamId] = careerObj.teamStrength;
    }
    if(careerObj.leagueTeamGrades && careerObj.leagueStrength){
      Object.keys(careerObj.leagueTeamGrades).forEach(teamId=>{
        const g = careerObj.leagueTeamGrades[teamId];
        if(!g) return;
        careerObj.leagueStrength[teamId] = clamp(Math.round(computeTeamOverall(g)), 20, 96);
      });
    }
  }
  // `checkpointPatch` merges onto whatever checkpoint fields the last save already had (tracked in
  // _lastCheckpoint for this session; a cold load falls back to a generic "decision" phase) -- so
  // any NEW call site (Wave 1 adds several -- see the calls after confirmPlayoffRound,
  // tryFinalizeLeaguePlayoffBracket, finalizePlayoffOutcome, and every material transaction) only
  // needs to state what actually changed, not reconstruct the whole checkpoint from scratch.
  function saveActiveCareer(checkpointPatch){
    if(!store || !career) return;
    try{
      const base = _lastCheckpoint || { phase:"regular_season", year: career.year, eventId:null, playoffRoundIndex:null };
      const checkpoint = { ...base, year: career.year, ...(checkpointPatch||{}) };
      _lastCheckpoint = checkpoint;
      store.setItem(activeCareerKey, JSON.stringify({ schemaVersion: SAVE_SCHEMA_VERSION, savedAt: Date.now(), checkpoint, career, build }));
    }catch(e){}
  }
  // Migration requirement #12: persist the migrated/repaired envelope immediately once it's built,
  // rather than waiting for gameplay's own next natural checkpoint (playing a season, a trade, a
  // signing...) -- otherwise a corrupted or pre-Wave-2A save's fix (a new schemaVersion, a rebuilt
  // qbsById registry, a repaired duplicate starter) only ever lives in the in-memory `career` object
  // returned here, and closing the app before the next checkpoint would mean the very same repair
  // has to run again next time (harmless, since migration is pure/idempotent, but never actually
  // converges in storage). The untouched original is kept once under a one-time backup key so a
  // migration bug discovered later still has the pre-migration data to recover from; it's
  // overwritten (never accumulated) on each subsequent real migration, so this never grows
  // unbounded.
  // `keyOverride` lets a caller peek at a SPECIFIC save (e.g. the "Active Multiplayer Matches" list
  // reading several different matches' saves to render summaries) without disturbing
  // `activeCareerKey` -- the key the game is actually currently playing against. Defaults to that
  // live key, matching every existing call site's behavior unchanged.
  function loadActiveCareer(keyOverride){
    if(!store) return null;
    const key = keyOverride || activeCareerKey;
    try{
      const raw = store.getItem(key);
      if(!raw) return null;
      const parsed = JSON.parse(raw);
      const wasCurrent = parsed.schemaVersion===SAVE_SCHEMA_VERSION && parsed.career && parsed.career.qbsById;
      const migrated = migrateSaveEnvelope(parsed);
      if(migrated && !wasCurrent){
        try{ store.setItem(key+".backup", raw); }catch(e){}
      }
      if(migrated){
        try{ store.setItem(key, JSON.stringify(migrated)); }catch(e){}
      }
      return migrated;
    }catch(e){ return null; }
  }
  function clearActiveCareer(){
    if(!store) return;
    _lastCheckpoint = null;
    try{ store.removeItem(activeCareerKey); }catch(e){}
  }
  function renderActiveCareerStrip(){
    const el = document.getElementById("activeCareerStrip");
    if(!el) return;
    const saved = loadActiveCareer();
    if(!saved || !saved.career || !saved.career.seasonLog || !saved.career.seasonLog.length){ el.style.display="none"; return; }
    const c = saved.career;
    const lastSeason = c.seasonLog[c.seasonLog.length-1];
    el.style.display="flex";
    el.innerHTML = `In progress: <b>${svgEscape(c.name)}</b>, ${teamNameAt(c.teamId, c.year)} · Age ${c.age} · ${c.seasonLog.length} season${c.seasonLog.length===1?"":"s"} played — saved ${relativeTimeAgo(saved.savedAt)} <button type="button" class="btn-ghost-inline" id="resumeCareerBtn">Resume career →</button>`;
    const btn = document.getElementById("resumeCareerBtn");
    if(btn) btn.addEventListener("click", ()=> resumeActiveCareer(saved, lastSeason));
  }
  function resumeActiveCareer(saved, lastSeason){
    career = saved.career;
    build = saved.build;
    // Carry the resumed save's own checkpoint forward as the base for the NEXT saveActiveCareer()
    // call in this session, rather than starting from a fresh default -- keeps the checkpoint
    // trail continuous across a reload instead of silently resetting it.
    _lastCheckpoint = saved.checkpoint || null;
    showScreen("career");
    updateHeaderCareerTicker();
    renderSeasonCard(lastSeason);
  }

  // Key Moment mini-game toggle: off by default (an explicit opt-in for a new, still-being-tested
  // mechanic) and persisted the same way as the sound preference, with an in-memory fallback for
  // the same storage-blocked contexts _sessionBest exists for.
  let _sessionKeyMoments = null;
  const KeyMomentSettings = {
    isEnabled(){
      if(_sessionKeyMoments!==null) return _sessionKeyMoments;
      if(!store) return false;
      try{ return store.getItem("diamondlab.keymoments")==="on"; }catch(e){ return false; }
    },
    setEnabled(v){
      _sessionKeyMoments = !!v;
      if(!store) return;
      try{ store.setItem("diamondlab.keymoments", v?"on":"off"); }catch(e){}
    },
  };

  /* ----- sound: small procedural Web Audio cues (no audio files, nothing licensed) — a rising
     horn-stab swell for the draft night reveal, and a retirement chime whose warmth and length
     scale with how the career actually graded out. Muted by default the instant the tab is
     backgrounded is unnecessary since nothing loops; a single header toggle covers it. ----- */
  const SFX = (()=>{
    let ctx = null, enabled = true;
    try{ const saved = store && store.getItem("diamondlab.sound"); if(saved==="off") enabled=false; }catch(e){}
    function getCtx(){
      if(!enabled) return null;
      if(!ctx){ try{ const AC = window.AudioContext || window.webkitAudioContext; if(AC) ctx = new AC(); }catch(e){ ctx = null; } }
      if(ctx && ctx.state==="suspended"){ ctx.resume().catch(()=>{}); }
      return ctx;
    }
    function tone(freq, startAt, dur, opts={}){
      const c = getCtx(); if(!c) return;
      const osc = c.createOscillator(); const gain = c.createGain();
      osc.type = opts.type || "triangle";
      osc.frequency.setValueAtTime(freq, c.currentTime+startAt);
      if(opts.slideTo) osc.frequency.exponentialRampToValueAtTime(opts.slideTo, c.currentTime+startAt+dur);
      const peak = opts.gain!=null ? opts.gain : 0.11;
      gain.gain.setValueAtTime(0.0001, c.currentTime+startAt);
      gain.gain.exponentialRampToValueAtTime(peak, c.currentTime+startAt+Math.min(0.03,dur*0.25));
      gain.gain.exponentialRampToValueAtTime(0.0001, c.currentTime+startAt+dur);
      osc.connect(gain); gain.connect(c.destination);
      osc.start(c.currentTime+startAt); osc.stop(c.currentTime+startAt+dur+0.02);
    }
    return {
      isEnabled(){ return enabled; },
      setEnabled(v){ enabled=v; try{ store && store.setItem("diamondlab.sound", v?"on":"off"); }catch(e){} },
      draftHorn(){
        // a quick three-note brass-ish stab, landing on the tonic — "you're drafted"
        tone(220, 0.00, 0.22, { type:"sawtooth", gain:0.09 });
        tone(277.18, 0.05, 0.22, { type:"sawtooth", gain:0.09 });
        tone(329.63, 0.11, 0.40, { type:"sawtooth", gain:0.12 });
        tone(440, 0.11, 0.40, { type:"triangle", gain:0.07 });
      },
      retirement(tier){
        // ordinal tiers, worst to best — richer/longer chime the more storied the career
        const order = ["Out of the League","Cup of Coffee","Journeyman","Longtime Regular","Hall of Very Good","Hall of Famer","First-Ballot Hall of Famer"];
        const idx = Math.max(0, order.indexOf(tier));
        if(idx<=1){
          // quiet, a little wistful — a short descending pair
          tone(311.13, 0.00, 0.5, { type:"sine", gain:0.07, slideTo:246.94 });
          tone(246.94, 0.35, 0.6, { type:"sine", gain:0.06 });
        } else if(idx<=3){
          // solid, workmanlike — a simple settled two-note close
          tone(293.66, 0.00, 0.4, { type:"triangle", gain:0.08 });
          tone(392.00, 0.18, 0.55, { type:"triangle", gain:0.09 });
        } else {
          // Hall of Fame-tier — a full ascending chord swell
          [261.63, 329.63, 392.00, 523.25].forEach((f,i)=> tone(f, i*0.09, 0.9, { type:"triangle", gain:0.085 }));
          tone(523.25, 0.55, 0.7, { type:"sine", gain:0.06, slideTo:659.25 });
        }
      },
    };
  })();
  function initSoundToggle(){
    const btn = document.getElementById("soundToggleBtn");
    if(!btn) return;
    const sync = ()=>{
      const on = SFX.isEnabled();
      btn.textContent = on ? "🔊" : "🔇";
      btn.classList.toggle("muted", !on);
      btn.setAttribute("aria-pressed", on ? "true":"false");
      btn.title = on ? "Sound on — click to mute" : "Sound off — click to unmute";
    };
    btn.addEventListener("click", ()=>{ SFX.setEnabled(!SFX.isEnabled()); sync(); });
    sync();
  }
  function initKeyMomentsToggle(){
    const box = document.getElementById("keyMomentsToggle");
    if(!box) return;
    box.checked = KeyMomentSettings.isEnabled();
    box.addEventListener("change", ()=> KeyMomentSettings.setEnabled(box.checked));
  }

  /* ================= Screens ================= */
  const screens = {
    menu: document.getElementById("screen-menu"),
    combineSetup: document.getElementById("screen-combine-setup"),
    draft: document.getElementById("screen-draft"),
    results: document.getElementById("screen-results"),
    careerSetup: document.getElementById("screen-career-setup"),
    draftnight: document.getElementById("screen-draftnight"),
    career: document.getElementById("screen-career"),
    careerSummary: document.getElementById("screen-career-summary"),
    trophyroom: document.getElementById("screen-trophyroom"),
    achievements: document.getElementById("screen-achievements"),
    mpHub: document.getElementById("screen-mp-hub"),
    mpCreate: document.getElementById("screen-mp-create"),
    mpJoin: document.getElementById("screen-mp-join"),
    mpCompare: document.getElementById("screen-mp-compare"),
  };
  function showScreen(name){
    Object.values(screens).forEach(s=>s.classList.remove("active"));
    screens[name].classList.add("active");
    window.scrollTo({top:0, behavior:"auto"});
  }

  /* ================= Combine state ================= */
  const MAX_AD_RESPINS_PER_COMBINE = 3;
  let cs = {
    mode: "classic",
    order: [],
    round: 0,
    picks: [],
    currentDecade: null,
    currentCandidates: [],
    respinEraLeft: 1,
    respinPlayersLeft: 1,
    // Ad-earned respins: a shared pool spendable on EITHER respin button (see renderRound/click
    // handlers below), separate from the one free respin-of-each the combine already grants.
    bonusRespinLeft: 0,
    adWatchesUsed: 0,
  };

  const modeHelpText = {
    classic: "Classic shows every rating up front. Pick with the numbers in front of you.",
    blind: "Blind hides the ratings. Pick on name, team, and reputation — the grade reveals after you choose.",
  };
  document.querySelectorAll(".mode-toggle button").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      document.querySelectorAll(".mode-toggle button").forEach(b=>{ b.classList.remove("active"); b.setAttribute("aria-checked","false"); });
      btn.classList.add("active"); btn.setAttribute("aria-checked","true");
      cs.mode = btn.dataset.mode;
      document.getElementById("modeHelp").textContent = modeHelpText[cs.mode];
    });
  });
  // The Combine Setup screen's own toggle only updates cs.mode/its own visible "active" state when
  // CLICKED -- nothing re-syncs the displayed button to cs.mode's actual current value when the
  // screen is simply shown again. Without this, a multiplayer combine (which force-sets
  // cs.mode="blind" without touching this UI at all, since it never shows this screen) could leave
  // a LATER solo Combine Setup visit still visually showing "Classic" while cs.mode was actually
  // still "blind" underneath. Called every time the solo entry points show this screen.
  function syncModeToggleDisplay(){
    document.querySelectorAll(".mode-toggle button").forEach(b=>{
      const active = b.dataset.mode===cs.mode;
      b.classList.toggle("active", active);
      b.setAttribute("aria-checked", active?"true":"false");
    });
    const helpEl = document.getElementById("modeHelp");
    if(helpEl) helpEl.textContent = modeHelpText[cs.mode] || modeHelpText.classic;
  }

  function renderBestStrip(){
    const best = loadBest();
    const el = document.getElementById("bestStrip");
    if(!best.score){ el.style.display="none"; return; }
    el.style.display="flex";
    el.innerHTML = `Best combine grade <b>${best.score}</b> (${best.grade}) — best career: <b>${best.careerVerdict || "—"}</b>`;
  }

  // Mode + Key Moments are asked on a dedicated Combine Setup screen right before the Combine
  // itself starts, not as a persistent menu-level toggle -- both solo entry points funnel here now.
  document.getElementById("startBtn").addEventListener("click", ()=>{ resetToSoloSession(); syncModeToggleDisplay(); showScreen("combineSetup"); });
  document.getElementById("brandHome").addEventListener("click", ()=>{ resetToSoloSession(); renderBestStrip(); renderLastBuildStrip(); renderActiveCareerStrip(); renderMultiplayerMatchesStrip(); showScreen("menu"); });
  document.getElementById("playAgainBtn").addEventListener("click", ()=>{ resetToSoloSession(); syncModeToggleDisplay(); showScreen("combineSetup"); });
  document.getElementById("combineSetupBeginBtn").addEventListener("click", ()=> startCombine());
  document.getElementById("combineSetupBackBtn").addEventListener("click", ()=>{ renderBestStrip(); renderLastBuildStrip(); renderActiveCareerStrip(); renderMultiplayerMatchesStrip(); showScreen("menu"); });

  function startCombine(){
    cs.order = shuffle(ATTRIBUTES);
    cs.round = 0;
    cs.picks = [];
    // Respins are a scarce resource for the WHOLE combine, not a per-round freebie: one respin of
    // the round's era and one respin of its player options, total, across all 12 rounds. Available
    // in multiplayer too (a direct follow-up reversed the earlier "no respins" restriction -- the
    // only combine-side restriction multiplayer keeps is "Run it back," the Results screen's
    // whole-combine redo, hidden separately in finishCombine()).
    cs.respinEraLeft = 1;
    cs.respinPlayersLeft = 1;
    cs.bonusRespinLeft = 0;
    cs.adWatchesUsed = 0;
    renderYardTicks();
    showScreen("draft");
    beginRound();
  }

  function renderYardTicks(){
    const el = document.getElementById("yardTicks");
    el.innerHTML = cs.order.map((a,i)=>`<span id="tick-${i}">${a.key}</span>`).join("");
    document.getElementById("roundTotal").textContent = cs.order.length;
  }

  function decadePool(decade){ return QBS.filter(p=>p.decade===decade); }

  function beginRound(){
    cs.currentDecade = pick(DECADES);
    rollCandidates();
    renderRound();
  }
  function rollCandidates(){
    const pool = decadePool(cs.currentDecade);
    cs.currentCandidates = shuffle(pool).slice(0, Math.min(4, pool.length));
  }
  function renderRound(){
    const attr = cs.order[cs.round];
    document.getElementById("draftPosLabel").textContent = "Draft Showcase · " + (cs.mode==="blind" ? "Blind" : "Classic");
    document.getElementById("draftAttrLabel").textContent = attr.label;
    document.getElementById("roundNum").textContent = cs.round+1;
    document.getElementById("eraPill").textContent = cs.currentDecade;

    const pct = (cs.round/cs.order.length)*100;
    document.getElementById("yardFill").style.width = pct+"%";
    cs.order.forEach((a,i)=>{ const t=document.getElementById("tick-"+i); if(t) t.classList.toggle("done", i<cs.round); });

    const eraBtn = document.getElementById("respinEraBtn");
    const playersBtn = document.getElementById("respinPlayersBtn");
    eraBtn.disabled = cs.respinEraLeft<=0 && cs.bonusRespinLeft<=0;
    playersBtn.disabled = (cs.respinPlayersLeft<=0 && cs.bonusRespinLeft<=0) || decadePool(cs.currentDecade).length<=cs.currentCandidates.length;
    document.getElementById("respinEraCount").textContent = "("+(cs.respinEraLeft+cs.bonusRespinLeft)+")";
    document.getElementById("respinPlayersCount").textContent = "("+(cs.respinPlayersLeft+cs.bonusRespinLeft)+")";
    renderWatchAdRespinBtn();

    renderCards();
  }
  function renderCards(){
    const attr = cs.order[cs.round];
    const grid = document.getElementById("cardGrid");
    grid.innerHTML = "";
    cs.currentCandidates.forEach(player=>{
      const val = eraNormalizedValue(player, attr.key);
      const card = document.createElement("button");
      card.type = "button";
      card.className = "player-card";
      const statBlock = cs.mode==="blind"
        ? `<p class="pc-blind">Rating hidden — go with your gut.</p>`
        : `<div class="pc-stat"><span class="pc-stat-label">${attr.label}</span><span class="meter"><span class="meter-fill" style="width:${val}%"></span></span><span class="pc-value tabular">${val}</span></div>`;
      card.innerHTML = `
        <div class="pc-top">
          <div><div class="pc-name">${player.name}</div><div class="pc-meta">${player.team} · ${player.years}</div></div>
          <span class="pc-era">${player.decade}</span>
        </div>
        ${statBlock}`;
      card.addEventListener("click", ()=> choosePlayer(player, val, attr));
      grid.appendChild(card);
    });
  }
  function choosePlayer(player, val, attr){
    cs.picks.push({ attr: attr.label, key: attr.key, player, value: val, decade: player.decade });
    cs.round++;
    if(cs.round >= cs.order.length) finishCombine(); else beginRound();
  }
  document.getElementById("respinEraBtn").addEventListener("click", ()=>{
    if(cs.respinEraLeft>0) cs.respinEraLeft--;
    else if(cs.bonusRespinLeft>0) cs.bonusRespinLeft--;
    else return;
    const others = DECADES.filter(d=>d!==cs.currentDecade);
    cs.currentDecade = pick(others);
    rollCandidates();
    renderRound();
  });
  document.getElementById("respinPlayersBtn").addEventListener("click", ()=>{
    if(cs.respinPlayersLeft>0) cs.respinPlayersLeft--;
    else if(cs.bonusRespinLeft>0) cs.bonusRespinLeft--;
    else return;
    rollCandidates();
    renderRound();
  });

  function renderWatchAdRespinBtn(){
    const adBtn = document.getElementById("watchAdRespinBtn");
    if(!adBtn) return;
    const label = adBtn.querySelector(".ad-respin-label");
    const badge = document.getElementById("bonusRespinBadge");
    const adsLeft = MAX_AD_RESPINS_PER_COMBINE - cs.adWatchesUsed;
    adBtn.disabled = adsLeft<=0;
    label.textContent = adsLeft>0 ? "Watch Ad for Bonus Reroll" : "No bonus rerolls left this combine";
    badge.textContent = adsLeft>0 ? `(${adsLeft} left)` : "";
  }
  document.getElementById("watchAdRespinBtn").addEventListener("click", async ()=>{
    if(cs.adWatchesUsed >= MAX_AD_RESPINS_PER_COMBINE) return;
    const adBtn = document.getElementById("watchAdRespinBtn");
    adBtn.disabled = true;
    const completed = await showRewardedAd({ rewardLabel: "Bonus Reroll" });
    if(completed){
      cs.adWatchesUsed++;
      cs.bonusRespinLeft++;
    }
    renderRound();
  });

  // A combine score sits on the exact same 0-99 raw scale as an attribute value, and every
  // attribute at a flat 65 is this game's defined "league average" (see the neutral baseline used
  // throughout computeEffOverall/neutralOverall). So these labels are calibrated AROUND 65, not
  // around the 0-98 clamp range gradeFor's inputs can technically span -- a 62 sits BELOW league
  // average and has to read that way (not "Pro Bowl"), and the marquee tiers (Pro Bowl, All-Pro,
  // Hall of Fame, GOAT) are pushed up to where they're actually rare, mirroring how few real NFL
  // starters ever sniff a Pro Bowl nod, let alone Canton. More levels than before, too, so the
  // long middle of the distribution (most builds land somewhere in C/B territory) doesn't get
  // flattened into one bucket.
  function gradeFor(score){
    if(score>=94) return {grade:"S",  flavor:"GOAT-Tier Build"};
    if(score>=89) return {grade:"A+", flavor:"Hall of Fame Build"};
    if(score>=84) return {grade:"A",  flavor:"All-Pro Build"};
    if(score>=79) return {grade:"A-", flavor:"Pro Bowl Build"};
    if(score>=74) return {grade:"B+", flavor:"Borderline Pro Bowler"};
    if(score>=69) return {grade:"B",  flavor:"Above-Average Starter"};
    if(score>=63) return {grade:"C+", flavor:"Average Starter"};
    if(score>=56) return {grade:"C",  flavor:"Below-Average Starter"};
    if(score>=48) return {grade:"D+", flavor:"Fringe Starter"};
    if(score>=40) return {grade:"D",  flavor:"Backup-Caliber"};
    if(score>=32) return {grade:"D-", flavor:"Camp Body"};
    return {grade:"F", flavor:"Cut Day"};
  }
  function computeCombineScore(picks){
    return evaluateProspect(picks);
  }

  let build = null; // {key: value, ...} — the finished prospect
  let lastCombine = null;

  function finishCombine(){
    const result = computeCombineScore(cs.picks);
    const g = gradeFor(result.score);
    lastCombine = { result, grade: g };
    build = {};
    cs.picks.forEach(p=> build[p.key] = p.value);
    saveLastBuildProfile(cs.picks);

    document.getElementById("resultScore").textContent = result.score;
    document.getElementById("resultGrade").innerHTML = `<b>${g.grade}</b>`;
    document.getElementById("resultFlavor").textContent = g.flavor;
    document.getElementById("resultBreakdown").innerHTML = `
      Football OVR <b class="tabular">${result.footballOverall}</b><br>
      Average <b class="tabular">${result.avg}</b><br>
      Balance penalty <b class="tabular">-${result.balancePenalty}</b><br>
      Floor bonus <b class="tabular">+${result.floorBonus}</b>`;

    const best = loadBest();
    const newBestBadge = document.getElementById("newBestBadge");
    if(!best.score || result.score > best.score){
      best.score = result.score; best.grade = g.grade;
      saveBest(best);
      newBestBadge.innerHTML = `<span class="new-best">New personal best</span>`;
    } else newBestBadge.innerHTML = "";

    const rosterList = document.getElementById("rosterList");
    rosterList.innerHTML = cs.picks.map(p=>`
      <div class="roster-row">
        <span class="roster-attr">${p.attr}</span>
        <span class="roster-player"><span class="rp-name">${p.player.name}</span><br><span class="rp-meta">${p.player.team} · ${p.decade}</span></span>
        <span class="roster-meter meter"><span class="meter-fill" style="width:${p.value}%"></span></span>
        <span class="roster-value tabular">${p.value}</span>
      </div>`).join("");

    document.getElementById("scoutingOverallLabel").textContent = result.score;
    const radarAttrs = cs.picks.map(p=>({ key:p.key, label:p.attr, value:p.value }));
    document.getElementById("scoutingRadar").innerHTML = renderRadarChartSVG(radarAttrs) +
      `<div class="radar-legend">
        <span>Best: <b>${radarAttrs.slice().sort((a,b)=>b.value-a.value)[0].label}</b></span>
        <span>Weakest: <b>${radarAttrs.slice().sort((a,b)=>a.value-b.value)[0].label}</b></span>
      </div>`;

    // Multiplayer: no "Run it back" -- redoing the whole Combine from scratch would let a player
    // see an entirely fresh set of rolls and try again, which is exactly the "same rolls, one shot,
    // blind" guarantee the whole mode exists to protect. This is the SAME restriction as the
    // in-round respin buttons (see startCombine/renderRound), just at the "redo everything" grain
    // instead of "reroll one round."
    const playAgainBtn = document.getElementById("playAgainBtn");
    if(playAgainBtn) playAgainBtn.style.display = currentMultiplayerContext ? "none" : "";

    showScreen("results");
  }

  document.getElementById("shareBtn").addEventListener("click", ()=>{
    const lines = [
      `GRIDIRON LAB — QB build`,
      `Combine grade: ${lastCombine.result.score}/100 (${lastCombine.grade.grade} · ${lastCombine.grade.flavor})`,
      ...cs.picks.map(p=>`${p.attr}: ${p.player.name} (${p.decade}) — ${p.value}`),
      window.location.href,
    ];
    copyText(lines.join("\n"), document.getElementById("shareBtn"));
  });
  function copyText(text, btn){
    const done = ()=>{ const old=btn.textContent; btn.textContent="Copied!"; setTimeout(()=>btn.textContent=old, 1600); };
    if(navigator.clipboard && navigator.clipboard.writeText){ navigator.clipboard.writeText(text).then(done).catch(()=>window.prompt("Copy:", text)); }
    else window.prompt("Copy:", text);
  }

  /* ================= Career setup ================= */
  let chosenDecade = null;
  let chosenDecadeWasRandom = false;
  function renderDecadeGrid(){
    const grid = document.getElementById("decadeGrid");
    grid.innerHTML = "";
    // Multiplayer Parallel Universe Mode (MULTIPLAYER_MODE_SPEC.md section 12): the era is locked
    // into the match code at creation time, for both players -- "the exact same rolls" only means
    // something fair to compare if both careers play out in the same league era, so this isn't a
    // free choice once a multiplayer context is active. Renders a single non-interactive card
    // showing the locked era instead of the normal pick-any grid.
    if(currentMultiplayerContext){
      chosenDecade = DECADES[currentMultiplayerContext.decadeIndex];
      chosenDecadeWasRandom = false;
      const league = LEAGUE[chosenDecade];
      const lockedCard = document.createElement("div");
      lockedCard.className = "decade-card selected";
      lockedCard.innerHTML = `<div class="dc-label">🔒 ${chosenDecade}</div><div class="dc-blurb">${DECADE_BLURB[chosenDecade]}</div>
        <div class="dc-facts">${league.games}-game season · ${fmtPct(league.comp)} lg. completion</div>
        <div class="dc-era-lean">Locked for this Private Match — both players play the same era.</div>`;
      grid.appendChild(lockedCard);
      document.getElementById("enterDraftNightBtn").disabled = false;
      return;
    }
    const randomCard = document.createElement("button");
    randomCard.type = "button";
    randomCard.className = "decade-card decade-card-random" + (chosenDecadeWasRandom ? " selected" : "");
    randomCard.innerHTML = `<div class="dc-label">🎲 Random Decade</div><div class="dc-blurb">Let the league office pick your era for you.</div>
      <div class="dc-facts">${chosenDecadeWasRandom ? "Landed on " + chosenDecade : "Any of the seven eras, evenly"}</div>`;
    randomCard.addEventListener("click", ()=>{
      chosenDecade = pick(DECADES); chosenDecadeWasRandom = true;
      renderDecadeGrid(); document.getElementById("enterDraftNightBtn").disabled=false;
    });
    grid.appendChild(randomCard);
    const rec = build ? recommendedDecadeInfo(build) : null;
    DECADES.forEach(d=>{
      const league = LEAGUE[d];
      const card = document.createElement("button");
      card.type="button";
      card.className = "decade-card" + (chosenDecade===d && !chosenDecadeWasRandom ? " selected":"");
      let recBadge = "";
      if(rec && rec.decades.includes(d)){
        const reasons = rec.reasonsByDecade[d];
        const title = reasons ? `Rewards your strongest attributes: ${reasons.join(", ")}` : `This build's specific attribute profile tests best in the ${d}.`;
        recBadge = `<div class="dc-recommend" title="${title.replace(/"/g,"&quot;")}">🎯 Recommended for your build</div>`;
      }
      card.innerHTML = `<div class="dc-label">${d}</div>${recBadge}<div class="dc-blurb">${DECADE_BLURB[d]}</div>
        <div class="dc-facts">${league.games}-game season · ${fmtPct(league.comp)} lg. completion</div>
        <div class="dc-era-lean" title="${(ERA_LEAN_WHY[d]||"").replace(/"/g,"&quot;")}">${eraFavorText(d)}</div>`;
      card.addEventListener("click", ()=>{ chosenDecade=d; chosenDecadeWasRandom=false; renderDecadeGrid(); document.getElementById("enterDraftNightBtn").disabled=false; });
      grid.appendChild(card);
    });
  }
  document.getElementById("goProBtn").addEventListener("click", ()=>{
    renderDecadeGrid();
    renderIdentityPanel();
    showScreen("careerSetup");
  });
  document.getElementById("backToResultsBtn").addEventListener("click", ()=> showScreen("results"));

  /* ================= Multiplayer: Parallel Universe Mode, Private Match =================
     MULTIPLAYER_MODE_SPEC.md sections 2/3/6/12. Purely additive -- a player who never opens the
     Multiplayer menu entry sees zero behavior change anywhere else in the app.

     Seeding window: the shared seed only needs to cover COMBINE + DRAFT NIGHT (installSeededRandom
     at "Start My Combine", restoreRandom at "Report to Camp"/startCareerBtn) -- "the exact same
     rolls in order" is specifically about the blind build/draft comparison, not the ongoing season
     simulation afterward. Once a career actually exists, each player's own season-by-season play
     (injuries, development swings, AI behavior) runs on genuine, unseeded randomness exactly like
     solo play always has -- there is no requirement, and no practical way without a much bigger
     undertaking, to keep two independently-played, possibly-days-apart careers deterministically in
     lockstep for their whole multi-season length. This also means a resumed multiplayer career
     needs no seed/decade at all -- only which save key to point at. */
  document.getElementById("multiplayerBtn").addEventListener("click", ()=> showScreen("mpHub"));
  document.getElementById("mpHubBackBtn").addEventListener("click", ()=>{ renderBestStrip(); renderLastBuildStrip(); renderActiveCareerStrip(); renderMultiplayerMatchesStrip(); showScreen("menu"); });

  // ----- Create -----
  let mpCreateDecadeIndex = null;
  let mpCreateSeed = null;
  let mpCreateCode = null;
  function renderMpCreateDecadeGrid(){
    const grid = document.getElementById("mpCreateDecadeGrid");
    grid.innerHTML = "";
    DECADES.forEach((d,i)=>{
      const league = LEAGUE[d];
      const card = document.createElement("button");
      card.type = "button";
      card.className = "decade-card" + (mpCreateDecadeIndex===i ? " selected" : "");
      card.innerHTML = `<div class="dc-label">${d}</div><div class="dc-blurb">${DECADE_BLURB[d]}</div>
        <div class="dc-facts">${league.games}-game season · ${fmtPct(league.comp)} lg. completion</div>`;
      card.addEventListener("click", ()=>{
        mpCreateDecadeIndex = i;
        renderMpCreateDecadeGrid();
        // The seed itself is picked with REAL ambient randomness, once, at creation time -- it's
        // an arbitrary starting point, not part of the shared roll sequence it goes on to produce.
        mpCreateSeed = Math.floor(Math.random()*0x100000000);
        mpCreateCode = encodeMatchCode(mpCreateSeed, mpCreateDecadeIndex);
        document.getElementById("mpCreateCodeText").textContent = mpCreateCode;
        document.getElementById("mpCreateCodePanel").style.display = "block";
      });
      grid.appendChild(card);
    });
  }
  document.getElementById("mpCreateBtn").addEventListener("click", ()=>{
    mpCreateDecadeIndex = null; mpCreateSeed = null; mpCreateCode = null;
    document.getElementById("mpCreateCodePanel").style.display = "none";
    document.getElementById("mpCreateKeyMomentsToggle").checked = KeyMomentSettings.isEnabled();
    renderMpCreateDecadeGrid();
    showScreen("mpCreate");
  });
  document.getElementById("mpCreateBackBtn").addEventListener("click", ()=> showScreen("mpHub"));
  document.getElementById("mpCreateCopyBtn").addEventListener("click", ()=> copyText(mpCreateCode, document.getElementById("mpCreateCopyBtn")));
  document.getElementById("mpCreateStartBtn").addEventListener("click", ()=>{
    if(mpCreateCode==null) return;
    KeyMomentSettings.setEnabled(document.getElementById("mpCreateKeyMomentsToggle").checked);
    beginMultiplayerCombine(mpCreateCode, mpCreateSeed, mpCreateDecadeIndex, "A");
  });

  // ----- Join -----
  let mpJoinDecoded = null;
  document.getElementById("mpJoinBtn").addEventListener("click", ()=>{
    document.getElementById("mpJoinCodeInput").value = "";
    document.getElementById("mpJoinError").style.display = "none";
    document.getElementById("mpJoinConfirmPanel").style.display = "none";
    document.getElementById("mpJoinKeyMomentsToggle").checked = KeyMomentSettings.isEnabled();
    mpJoinDecoded = null;
    showScreen("mpJoin");
  });
  document.getElementById("mpJoinBackBtn").addEventListener("click", ()=> showScreen("mpHub"));
  document.getElementById("mpJoinCheckBtn").addEventListener("click", ()=>{
    const code = document.getElementById("mpJoinCodeInput").value;
    const decoded = decodeMatchCode(code);
    const errEl = document.getElementById("mpJoinError");
    const confirmPanel = document.getElementById("mpJoinConfirmPanel");
    if(!decoded){
      errEl.textContent = "That code doesn't look right — double-check it and try again.";
      errEl.style.display = "block";
      confirmPanel.style.display = "none";
      mpJoinDecoded = null;
      return;
    }
    errEl.style.display = "none";
    mpJoinDecoded = decoded;
    document.getElementById("mpJoinConfirmText").textContent =
      `Joining a ${DECADES[decoded.decadeIndex]} Private Match. Once you start, you'll draft blind from the exact same rolls your opponent did — don't compare notes until you've both locked in a build.`;
    confirmPanel.style.display = "block";
  });
  document.getElementById("mpJoinStartBtn").addEventListener("click", ()=>{
    if(!mpJoinDecoded) return;
    const code = document.getElementById("mpJoinCodeInput").value.trim().toUpperCase();
    KeyMomentSettings.setEnabled(document.getElementById("mpJoinKeyMomentsToggle").checked);
    beginMultiplayerCombine(code, mpJoinDecoded.seed, mpJoinDecoded.decadeIndex, "B");
  });

  // Shared by Create's and Join's "Start My Combine": installs the shared seed, points saves at
  // this match's own namespaced key so it can't collide with any other save on this device, forces
  // Blind mode (multiplayer is never Classic -- best player available on name/reputation alone is
  // the whole point of a fair blind draft), then runs the ordinary solo combine flow -- unchanged
  // from here on except that startCombine() itself zeroes out respins for a multiplayer context.
  function beginMultiplayerCombine(matchId, seed, decadeIndex, slot){
    currentMultiplayerContext = { matchId, slot, seed, decadeIndex };
    activeCareerKey = multiplayerSaveKey(matchId, slot);
    cs.mode = "blind";
    installSeededRandom(seed);
    startCombine();
  }

  // ----- Compare -----
  document.getElementById("mpCompareBtn").addEventListener("click", ()=>{
    document.getElementById("mpCompareCodeA").value = "";
    document.getElementById("mpCompareCodeB").value = "";
    document.getElementById("mpCompareError").style.display = "none";
    document.getElementById("mpCompareResult").innerHTML = "";
    showScreen("mpCompare");
  });
  document.getElementById("mpCompareBackBtn").addEventListener("click", ()=> showScreen("mpHub"));
  document.getElementById("mpCompareRunBtn").addEventListener("click", ()=>{
    const errEl = document.getElementById("mpCompareError");
    const resultEl = document.getElementById("mpCompareResult");
    errEl.style.display = "none"; resultEl.innerHTML = "";
    const payloadA = decodeResultCode(document.getElementById("mpCompareCodeA").value);
    const payloadB = decodeResultCode(document.getElementById("mpCompareCodeB").value);
    if(!payloadA || !payloadB){
      errEl.textContent = "One or both result codes don't look right — double-check them and try again.";
      errEl.style.display = "block";
      return;
    }
    if(payloadA.matchId !== payloadB.matchId){
      errEl.textContent = "These two result codes are from different matches — make sure you're comparing the right pair.";
      errEl.style.display = "block";
      return;
    }
    resultEl.innerHTML = buildMultiplayerScoreboardHTML(payloadA, payloadB);
  });

  function buildMultiplayerScoreboardHTML(payloadA, payloadB){
    const { componentsA, componentsB, winner } = computeMatchScore(payloadA.summary, payloadB.summary);
    const round = v => Math.round(v);
    const rowsFor = c => `
      <div class="mp-score-row"><span>Rings</span><span>${round(c.rings)}</span></div>
      <div class="mp-score-row"><span>Accolades</span><span>${round(c.accolades)}</span></div>
      <div class="mp-score-row"><span>Peak &amp; Rate</span><span>${round(c.peakAndRate)}</span></div>
      <div class="mp-score-row"><span>Career Totals</span><span>${round(c.careerTotals)}</span></div>
      <div class="mp-score-row"><span>Achievements</span><span>${round(c.achievements)}</span></div>
      <div class="mp-score-row"><span>Earnings</span><span>${round(c.earnings)}</span></div>
      <div class="mp-score-row mp-score-total"><span>TOTAL</span><span>${round(c.total)}</span></div>`;
    const winnerLabel = winner==="A" ? svgEscape(payloadA.name) : winner==="B" ? svgEscape(payloadB.name) : null;
    return `
      <div class="calc-refnote" style="text-align:center; font-size:1.1rem;">${winnerLabel ? `<b>${winnerLabel}</b> wins the match` : "It's a tie!"}</div>
      <div class="mp-scoreboard">
        <div class="mp-score-col${winner==="A"?" winner":""}">
          <div class="section-label">${svgEscape(payloadA.name)}${payloadA.decade?` — ${svgEscape(payloadA.decade)}`:""}</div>
          ${rowsFor(componentsA)}
        </div>
        <div class="mp-score-vs">VS</div>
        <div class="mp-score-col${winner==="B"?" winner":""}">
          <div class="section-label">${svgEscape(payloadB.name)}${payloadB.decade?` — ${svgEscape(payloadB.decade)}`:""}</div>
          ${rowsFor(componentsB)}
        </div>
      </div>`;
  }

  // ----- Active Multiplayer Matches (menu strip) -----
  // Scans localStorage directly rather than maintaining a separate index that could drift out of
  // sync -- two prefixes cover everything: in-progress saves (SOLO_ACTIVE_CAREER_KEY+".mp."), and
  // finished-match results (persisted separately, see finishCareer's multiplayer hook, since
  // clearActiveCareer() removes the in-progress save the instant a career actually ends).
  const MP_RESULT_KEY_PREFIX = "diamondlab.mpResult.";
  function multiplayerResultKey(matchId, slot){ return `${MP_RESULT_KEY_PREFIX}${matchId}.${slot}`; }
  function splitMatchSlotSuffix(rest){
    const lastDot = rest.lastIndexOf(".");
    if(lastDot===-1) return null;
    return { matchId: rest.slice(0,lastDot), slot: rest.slice(lastDot+1) };
  }
  function renderMultiplayerMatchesStrip(){
    const el = document.getElementById("multiplayerMatchesStrip");
    if(!el) return;
    if(!store){ el.style.display = "none"; return; }
    const inProgressPrefix = SOLO_ACTIVE_CAREER_KEY + ".mp.";
    const items = [];
    for(let i=0;i<store.length;i++){
      const key = store.key(i);
      if(!key) continue;
      if(key.startsWith(inProgressPrefix) && !key.endsWith(".backup")){
        const parts = splitMatchSlotSuffix(key.slice(inProgressPrefix.length));
        if(!parts) continue;
        const saved = loadActiveCareer(key);
        if(!saved || !saved.career) continue;
        items.push({ ...parts, key, status:"in-progress", saved });
      } else if(key.startsWith(MP_RESULT_KEY_PREFIX)){
        const parts = splitMatchSlotSuffix(key.slice(MP_RESULT_KEY_PREFIX.length));
        if(!parts) continue;
        let data = null;
        try{ data = JSON.parse(store.getItem(key)); }catch(e){}
        if(!data) continue;
        items.push({ ...parts, key, status:"finished", data });
      }
    }
    if(!items.length){ el.style.display = "none"; return; }
    el.classList.add("mp-matches-strip");
    el.style.display = "flex";
    el.innerHTML = `<div class="mp-match-header">Active Multiplayer Matches</div>` + items.map(item=>{
      if(item.status==="in-progress"){
        const c = item.saved.career;
        return `<div class="mp-match-row">
          <span>Match <b>${svgEscape(item.matchId)}</b> · Slot ${svgEscape(item.slot)} — <b>${svgEscape(c.name)}</b>, ${c.seasonLog.length} season${c.seasonLog.length===1?"":"s"} played</span>
          <button type="button" class="btn-ghost-inline" data-mp-resume-key="${svgEscape(item.key)}">Resume →</button>
        </div>`;
      }
      return `<div class="mp-match-row">
        <span>Match <b>${svgEscape(item.matchId)}</b> · Slot ${svgEscape(item.slot)} — <b>${svgEscape(item.data.name)}</b>, finished</span>
        <button type="button" class="btn-ghost-inline" data-mp-export-code="${svgEscape(item.data.resultCode)}">Copy Result Code</button>
      </div>`;
    }).join("");
    el.querySelectorAll("[data-mp-resume-key]").forEach(btn=>{
      btn.addEventListener("click", ()=>{
        const key = btn.dataset.mpResumeKey;
        const saved = loadActiveCareer(key);
        if(!saved || !saved.career) return;
        activeCareerKey = key;
        currentMultiplayerContext = { matchId: saved.career.multiplayerMatchId, slot: saved.career.multiplayerSlot };
        const lastSeason = saved.career.seasonLog[saved.career.seasonLog.length-1];
        resumeActiveCareer(saved, lastSeason);
      });
    });
    el.querySelectorAll("[data-mp-export-code]").forEach(btn=>{
      btn.addEventListener("click", ()=> copyText(btn.dataset.mpExportCode, btn));
    });
  }

  /* ----- identity panel: prefill with random defaults every time career setup is entered,
     but never clobber text the user already typed in this session. ----- */
  let identity = { name: "", college: "", hometown: null, position: "" };
  function renderIdentityPanel(){
    const nameInput = document.getElementById("identityNameInput");
    const collegeInput = document.getElementById("identityCollegeInput");
    const hometownValue = document.getElementById("identityHometownValue");
    const positionValue = document.getElementById("identityPositionValue");
    if(!identity.name) identity.name = randomFullName();
    if(!identity.college) identity.college = randomCollege();
    if(!identity.hometown) identity.hometown = randomHometown();
    if(!identity.position) identity.position = randomPosition();
    nameInput.value = identity.name;
    collegeInput.value = identity.college;
    hometownValue.textContent = `${identity.hometown.city}, ${identity.hometown.state}`;
    if(positionValue) positionValue.textContent = positionLabel(identity.position);
    const dl = document.getElementById("collegeList");
    if(!dl.childElementCount) dl.innerHTML = COLLEGES.map(c=>`<option value="${c}"></option>`).join("");
  }
  document.getElementById("identityNameInput").addEventListener("input", (e)=>{ identity.name = e.target.value; });
  document.getElementById("identityCollegeInput").addEventListener("input", (e)=>{ identity.college = e.target.value; });
  document.getElementById("identityHometownRerollBtn").addEventListener("click", ()=>{
    identity.hometown = randomHometown();
    document.getElementById("identityHometownValue").textContent = `${identity.hometown.city}, ${identity.hometown.state}`;
  });
  document.getElementById("identityPositionRerollBtn").addEventListener("click", ()=>{
    identity.position = randomPosition();
    document.getElementById("identityPositionValue").textContent = positionLabel(identity.position);
  });
  document.getElementById("identityRerollAllBtn").addEventListener("click", ()=>{
    identity.name = randomFullName();
    identity.college = randomCollege();
    identity.hometown = randomHometown();
    identity.position = randomPosition();
    renderIdentityPanel();
  });

  /* ================= Career state ================= */
  let career = null;
  let lastFinishedCareerEntry = null; // trophy-room-entry-shaped snapshot of the career just finished, for "View Trading Card" on the HOF screen

  /* ----- contracts & money -----
     MLB salary history, roughly. `rookie` blends a first-pro-deal signing bonus with the near-
     minimum pre-arbitration / early-arb pay a young player actually earns (keyed by draft round,
     a simplification -- draft slot mostly drives the BONUS, not the MLB salary). `vet` is the
     free-agent market by tier: elite = a top-of-market star, good = a solid everyday regular,
     average = a second-division regular / strong platoon, backup = a bench bat, minimum = a
     league-minimum roster spot. Numbers are annual-average-value in that era's dollars. */
  const CONTRACT_SCALE = {
    "1960s": { rookie:{1:50000,   2:22000,   4:12000,   6:8000,    udfa:6000},   vet:{elite:115000,   good:55000,    average:24000,   backup:14000,   minimum:7000} },
    "1970s": { rookie:{1:130000,  2:55000,   4:28000,   6:18000,   udfa:12000},  vet:{elite:280000,   good:120000,   average:55000,   backup:30000,   minimum:18000} },
    "1980s": { rookie:{1:600000,  2:230000,  4:110000,  6:70000,   udfa:45000},  vet:{elite:2300000,  good:1000000,  average:430000,  backup:180000,  minimum:62000} },
    "1990s": { rookie:{1:2600000, 2:1000000, 4:450000,  6:230000,  udfa:150000}, vet:{elite:9000000,  good:4200000,  average:1600000, backup:650000,  minimum:150000} },
    "2000s": { rookie:{1:4200000, 2:1400000, 4:600000,  6:360000,  udfa:250000}, vet:{elite:21000000, good:10000000, average:4200000, backup:1400000, minimum:330000} },
    "2010s": { rookie:{1:5200000, 2:1900000, 4:820000,  6:530000,  udfa:410000}, vet:{elite:31000000, good:17000000, average:7500000, backup:2400000, minimum:520000} },
    "2020s": { rookie:{1:7800000, 2:2700000, 4:1150000, 6:820000,  udfa:720000}, vet:{elite:43000000, good:27000000, average:12000000,backup:4000000, minimum:740000} },
  };
  function rookieAPY(decade, round){
    const t = CONTRACT_SCALE[decade].rookie;
    if(round<=0) return t.udfa;
    if(round===1) return t[1];
    if(round<=3) return t[2];
    if(round<=10) return t[4];
    return t[6];
  }
  function veteranAPY(decade, tier){ return CONTRACT_SCALE[decade].vet[tier]; }
  function performanceTier(effOverall){
    if(effOverall>=80) return "elite";
    if(effOverall>=68) return "good";
    if(effOverall>=56) return "average";
    if(effOverall>=44) return "backup";
    return "minimum";
  }
  // Rival/depth-chart contract economics -- reuses the exact same CONTRACT_SCALE tiers the
  // player's own contract math is built on (veteranAPY/performanceTier), so a rival's deal reads
  // on the same real-money scale as the player's, instead of an invented parallel number.
  function rollRivalContract(decade, talent){
    const tier = performanceTier(talent);
    const apy = Math.round(veteranAPY(decade, tier) * (0.85 + Math.random()*0.3));
    const years = tier==="elite" ? randInt(5,9) : tier==="good" ? randInt(3,6) : tier==="average" ? randInt(2,4) : randInt(1,3);
    return { apy, years, tier };
  }
  function rollRookieDepthContract(decade, round){
    return { apy: rookieAPY(decade, round), years: 6, tier: "rookie" };
  }
  // "Stuck on a big contract" proxy (user's own framing) -- a team won't bench/replace a starter
  // while this is still positive unless he's declined sharply or is clearly past his prime (see
  // evaluateSuccession), the same way a real second-contract veteran is hard to bench purely for
  // a promising backup. Scales with talent since a real second contract is a reward for being good,
  // not a random dice roll independent of quality.
  function rollEntrenchedYears(talent){
    return talent>=80 ? randInt(5,8) : talent>=65 ? randInt(3,6) : randInt(2,4);
  }
  // Signed number for legible "Effect:" lines on event cards -- always shows the sign so a delta
  // of 0 (or a positive number without a leading "+") never reads as ambiguous.
  // Ties QOL: a real record display, "-T" only shown when ties>0 -- keeps every pre-tie-era record
  // (and the vast majority of post-1974 seasons, where ties stay rare) reading exactly as before,
  // rather than cluttering every record everywhere with an always-present "-0".

  /* ----- era style: the same build plays differently depending on when it lands -----
     Grounded in real offensive-environment history, not a smooth gradient:
     - SHA/TCH/MOB/IMP peak in the 1960s-80s: high mounds and big parks suppressed power, so
       contact hitting, bat control, and a running game were how you scored. They fall through the
       1990s-2020s as the launch-angle / three-true-outcomes approach takes over and the stolen
       base (2000s) then partly rebounds (2020s bigger bases, pickoff limits).
     - DAC/REL (raw power, bat speed) are suppressed in the 60s-70s dead-ball environment, climb
       through the 90s-2000s offensive surge, and stay high into the 2010s-2020s once selling out
       for the barrel became the league-wide approach.
     - PKT (plate discipline / working a walk) is lowest in the aggressive 60s-70s, peaks in the
       Moneyball 2000s, and holds high after.
     - DUR (the attribute) is deliberately left UN-adjusted -- a personal, timeless toughness
       trait. The era's actual injury danger lives entirely in the separate "injury" multiplier
       below (checkInjuryThenPlay applies it on top of the DUR-driven base chance): no injured
       list, worse turf, and year-round grind made the 60s-70s far riskier, and modern sports
       science / load management made it steadily safer.
     - ANT/DEC/CLU are left near-neutral as timeless fundamentals -- pitch recognition, a
       professional approach, and composure aren't era-contingent the way environment-driven
       tools are. */
  const ERA_ATTR_MULT = {
    "1960s": {SHA:1.12, TCH:1.10, MOB:1.15, IMP:1.12, DAC:0.78, REL:0.92, PKT:0.90, injury:1.35},
    "1970s": {SHA:1.08, TCH:1.06, MOB:1.16, IMP:1.14, DAC:0.82, REL:0.94, PKT:0.94, injury:1.28},
    "1980s": {SHA:1.04, TCH:1.02, MOB:1.12, IMP:1.12, DAC:0.92, REL:0.98, PKT:1.00, injury:1.15},
    "1990s": {SHA:1.02, TCH:1.00, MOB:1.00, IMP:1.00, DAC:1.06, REL:1.02, PKT:1.06, injury:1.05},
    "2000s": {SHA:1.04, TCH:1.02, MOB:0.88, IMP:0.90, DAC:1.12, REL:1.04, PKT:1.10, injury:1.00},
    "2010s": {SHA:0.94, TCH:0.92, MOB:1.00, IMP:1.00, DAC:1.10, REL:1.08, PKT:1.00, injury:0.92},
    "2020s": {SHA:0.90, TCH:0.88, MOB:1.10, IMP:1.06, DAC:1.12, REL:1.10, PKT:1.06, injury:0.85},
  };
  function eraAdjust(eff, decade){
    const mult = ERA_ATTR_MULT[decade] || {};
    const out = {};
    ATTR_KEYS.forEach(k=> out[k] = clamp(Math.round(eff[k]*(mult[k]||1)), 10, 99));
    return out;
  }
  // Human-readable "this era favors X, hurts Y" hint for the decade picker, derived straight from
  // the same multiplier table the sim actually plays by (see ERA_ATTR_MULT above) -- so the hint
  // is never at odds with what actually happens on the field.
  function eraFavorText(decade){
    const mult = ERA_ATTR_MULT[decade] || {};
    const up = [], down = [];
    ATTR_KEYS.forEach(k=>{
      const m = mult[k]; if(m==null) return;
      const label = (ATTR_BY_KEY[k]||{}).label || k;
      if(m>=1.05) up.push(label); else if(m<=0.95) down.push(label);
    });
    if(!up.length && !down.length) return "League-average across the board — no era lean.";
    const parts = [];
    if(up.length) parts.push(`favors ${up.join(", ")}`);
    if(down.length) parts.push(`hurts ${down.join(", ")}`);
    return parts.join(" · ").replace(/^./, c=>c.toUpperCase());
  }

  /* ----- Recommended Decade (item #9): which era(s) this SPECIFIC build's attribute profile is
     rewarded by, isolated from raw overall talent. This deliberately does NOT go through
     effectiveAttr()/eraEffective() -- those read live career state (career.tempBoosts, via
     activeBoostDelta) that doesn't exist yet at the pre-draft build screen (career is still null
     there). No temp boosts pre-career means re-deriving the same age+era math directly against a
     supplied build is exactly equivalent, just without the career dependency. -----*/
  function decadeFitEdge(buildObj, decade, age){
    const eff = {}, neutral = {};
    ATTR_KEYS.forEach(k=>{
      if(k==="DUR"){ eff[k]=clamp(buildObj[k],10,99); neutral[k]=65; return; }
      const mult = ageMultiplier(ATTR_BY_KEY[k].group, age);
      eff[k] = clamp(Math.round(clamp(buildObj[k],10,99)*mult), 15, 99);
      neutral[k] = clamp(Math.round(65*mult), 15, 99);
    });
    const effEra = eraAdjust(eff, decade), neutralEra = eraAdjust(neutral, decade);
    return weighted(effEra, OVERALL_WEIGHTS) - weighted(neutralEra, OVERALL_WEIGHTS);
  }
  const DECADE_FIT_REF_AGE = 29; // "prime" age -- see PRIME_CURVE -- used purely as a consistent
  // yardstick to compare the seven eras against each other, not a claim about any specific season.
  function computeDecadeFit(buildObj){
    const scores = {};
    DECADES.forEach(d=> scores[d] = decadeFitEdge(buildObj, d, DECADE_FIT_REF_AGE));
    return scores;
  }
  // A build only gets tagged when an era's edge is both the best AND meaningfully era-driven --
  // a flat, balanced build (every attribute near 65) will show a near-zero edge everywhere and
  // correctly gets no recommendation at all, rather than an arbitrary tie-break.
  const DECADE_FIT_MIN_EDGE = 1.5;
  const DECADE_FIT_TIE_MARGIN = 1.0;
  function recommendedDecadeInfo(buildObj){
    if(!buildObj) return null;
    const scores = computeDecadeFit(buildObj);
    const ranked = DECADES.slice().sort((a,b)=> scores[b]-scores[a]);
    const topScore = scores[ranked[0]];
    if(topScore < DECADE_FIT_MIN_EDGE) return { decades: [], scores };
    const decades = ranked.filter(d=> scores[d] >= topScore-DECADE_FIT_TIE_MARGIN).slice(0,2);
    const topAttrs = ATTR_KEYS.filter(k=>k!=="DUR").slice().sort((a,b)=> buildObj[b]-buildObj[a]).slice(0,4);
    const reasonsByDecade = {};
    decades.forEach(d=>{
      const mult = ERA_ATTR_MULT[d]||{};
      const favored = topAttrs.filter(k=> (mult[k]||1)>=1.05).map(k=>ATTR_BY_KEY[k].label);
      reasonsByDecade[d] = favored.length ? favored : null;
    });
    return { decades, scores, reasonsByDecade };
  }
  // One-sentence "why" behind each decade's lean, surfaced as a hover tooltip on the decade card
  // so the hint reads as researched reasoning, not an arbitrary dial.
  const ERA_LEAN_WHY = {
    "1960s": "Minimal pass protection and defenses that teed off on the passer made scrambling a survival skill; timing/anticipation passing as a coached system didn't exist yet.",
    "1970s": "The most brutal, hit-everything era for QBs (pre-facemask-contact and roughing rules); offenses were still run-first and ad-libbed, not built around rhythm passing.",
    "1980s": "Bill Walsh's West Coast offense (post-1978 rule changes) spreads across the league, rewarding timing and anticipation for the first time; the game starts getting safer.",
    "1990s": "Timing passing is now mainstream and decision-making is coached hard; the position is safer than the 70s-80s but still well short of modern protections.",
    "2000s": "The prototypical pocket-passer golden age (Manning/Brady/Brees) — offenses are built entirely around staying in the pocket, so mobility and scrambling instinct are actively undervalued.",
    "2010s": "Kaepernick/RG3/Wilson-era zone-read and RPO schemes bring coached mobility back into style, while player-safety rules keep compounding.",
    "2020s": "The Mahomes/Allen/Jackson/Hurts dual-threat renaissance makes mobility and improvisation MVP-caliber traits, not a fallback — while targeting/roughing rules make this the safest era to play in.",
  };

  /* ----- coaching schemes: every team plays a real, named offensive system, and that system
     rewards a different build than the raw attribute grades alone would suggest — the exact same
     architecture as ERA_ATTR_MULT/eraAdjust above (a per-attribute multiplier table, applied on
     TOP of the era adjustment, DUR deliberately excluded for the same reason DUR is excluded from
     the era table: it's a personal toughness trait, not something a playbook changes). Each team
     is assigned one scheme at draft time (see the teamScheme map built alongside leagueStrength)
     and it persists until a coaching change rolls a new one (see ORG_EVENTS' coachfired/newgm
     handling). Applying the same multiplier to both the player's effective attributes AND the
     neutral/league-average baseline (see neutralEffective below) is what makes "fit" emergent
     instead of a separate bolt-on system: a scheme that discounts arm strength makes a cannon arm
     matter less AND makes a weak arm cost less, exactly like a real playbook would. */
  function schemeAdjust(eff, schemeId){
    const scheme = SCHEMES.find(s=>s.id===schemeId);
    const mult = scheme ? scheme.mult : {};
    const out = {};
    ATTR_KEYS.forEach(k=> out[k] = clamp(Math.round(eff[k]*(mult[k]||1)), 10, 99));
    return out;
  }
  // Human-readable "this scheme favors X, hurts Y" hint, derived from the same multiplier table
  // the sim actually plays by — the same technique as eraFavorText above.
  function schemeFavorText(schemeId){
    const scheme = SCHEMES.find(s=>s.id===schemeId);
    if(!scheme) return "";
    const up = [], down = [];
    ATTR_KEYS.forEach(k=>{
      const m = scheme.mult[k]; if(m==null) return;
      const label = (ATTR_BY_KEY[k]||{}).label || k;
      if(m>=1.05) up.push(label); else if(m<=0.95) down.push(label);
    });
    const parts = [];
    if(up.length) parts.push(`favors ${up.join(", ")}`);
    if(down.length) parts.push(`hurts ${down.join(", ")}`);
    return parts.join(" · ").replace(/^./, c=>c.toUpperCase());
  }

  // MLB draft: ~20 rounds, first round ~1-30. A prospect's slot follows the same weighted hitter
  // rating the career engine uses; the Showcase grade stays a separate measure of completeness.
  function draftSlotFor(score){
    if(score>=72) return { round:1, pickLo:1, pickHi:10, label:"First Round — Top 10" };
    if(score>=62) return { round:1, pickLo:11, pickHi:30, label:"First Round" };
    if(score>=52) return { round:randInt(2,3), pickLo:31, pickHi:100, label:"Day 1 (Rounds 2–3)" };
    if(score>=42) return { round:randInt(4,10), pickLo:101, pickHi:310, label:"Day 2 (Rounds 4–10)" };
    if(score>=32) return { round:randInt(11,20), pickLo:311, pickHi:610, label:"Day 3 (Rounds 11–20)" };
    return { round:0, pickLo:0, pickHi:0, label:"Undrafted Free Agent" };
  }

  document.getElementById("enterDraftNightBtn").addEventListener("click", ()=>{
    const decade = chosenDecade;
    const league = LEAGUE[decade];
    const decadeStart = parseInt(decade,10);
    const draftYear = randInt(decadeStart, decadeStart+9);
    // Draft value follows the same weighted football rating the career engine
    // actually uses. Combine grade remains a separate measure of completeness.
    const slot = draftSlotFor(lastCombine.result.footballOverall);
    const teamsPool = teamsAvailable(draftYear);
    const overallPick = slot.round===0 ? null : randInt(slot.pickLo, slot.pickHi);
    const leagueStrength = {};
    TEAMS.forEach(t=>{ leagueStrength[t.id] = randInt(30,90); });
    const team = chooseDraftTeam(teamsPool, leagueStrength, slot, overallPick);
    const teamName = teamNameAt(team.id, draftYear);
    const pickLabel = slot.round===0 ? "Signed as an undrafted free agent" : `${slot.label}, Pick ${overallPick} overall`;
    const rookieApy = rookieAPY(decade, slot.round);

    const teamScheme = {};
    TEAMS.forEach(t=>{ teamScheme[t.id] = pick(SCHEMES).id; });

    // blank name/college fields mean "randomize for me" — resolve that at the moment of
    // declaring for the draft, not just at panel-render time, so a deliberately cleared field
    // still gets a real value.
    const playerName = (identity.name||"").trim() || randomFullName();
    const playerCollege = (identity.college||"").trim() || randomCollege();
    const playerHometown = identity.hometown || randomHometown();
    const playerPosition = identity.position || randomPosition();
    identity.name = playerName; identity.college = playerCollege; identity.hometown = playerHometown; identity.position = playerPosition;

    career = {
      decade, league, draftYear, slot, overallPick,
      prospectGrade: lastCombine.result.score,
      draftOverall: lastCombine.result.footballOverall,
      name: playerName,
      college: playerCollege,
      hometown: playerHometown,
      position: playerPosition,
      teamId: team.id,
      draftTeamId: team.id,
      leagueStrength,
      teamStrength: leagueStrength[team.id],
      oline: rollSupportingCastGrade(leagueStrength[team.id]),
      weapons: rollSupportingCastGrade(leagueStrength[team.id]),
      defense: rollSupportingCastGrade(leagueStrength[team.id]),
      coaching: rollSupportingCastGrade(leagueStrength[team.id]),
      gmGrade: rollSupportingCastGrade(leagueStrength[team.id]),
      wearAndTear: 0,
      relationship: null,
      achievements: { unlocked:{} },
      teamScheme,
      gmRelationship: 50,
      fanSupport: 50,
      leaguePopularity: 50,
      seasonsWithTeam: 0,
      age: 22,
      year: draftYear,
      seasonNumber: 1,
      seasonLog: [],
      totals: { games:0, comp:0, att:0, yards:0, td:0, int:0, sacks:0, proBowls:0, allPros:0, mvps:0, rings:0, earnings:0, rushYards:0, rushTd:0,
        bb:0, ab:0, hbp:0, sf:0, doubles:0, triples:0, sb:0, cs:0, rbi:0, runs:0 },
      contract: { apy: rookieApy, years: 6, tier: "rookie" },
      badStreak: 0,
      forcedOut: false,
      exitReason: null,
      transactions: [ `${draftYear}: ${pickLabel} by the ${teamName}.` ],
      peakSeason: null,
      reputation: 50,
      suspensionSeasonsRemaining: 0,
      injuryLeaveSeasonsRemaining: 0,
      banned: false,
      tempBoosts: [],
      lifeEventLog: [],
      _cutShieldSeasons: 0,
      leagueRivals: [],
      leagueDepthCharts: {},
      teamSeasonHistory: {},
      leagueTeamGrades: {},
      freeAgentPool: [],
      rivalries: {},
      isBackup: false,
      _backupSeasonsCount: 0,
      leagueNewsLog: [],
      devSpeed: rollDevSpeed(),
      devCarry: {},
      devCeilingBonus: {},
      breakthroughMomentum: 0,
      _earnedBreakthroughCount: 0,
      developmentPlan: "balanced",
      teamChemistry: 50,
      capPressure: 0,
      _developmentPlanAppliedYear: draftYear,
      _coordinatorCarouselCheckedYear: draftYear,
      // Balance Wave 6: the structured event ledger -- see recordLedgerEvent's own comment.
      eventLedger: [],
      _eventSequenceCounter: 0,
      // Multiplayer Parallel Universe Mode (MULTIPLAYER_MODE_SPEC.md section 3): null for an
      // ordinary solo career. Read-only bookkeeping from here on -- nothing about gameplay checks
      // these, they only matter to finishCareer()'s result-export hook and the "Active Multiplayer
      // Matches" menu strip.
      multiplayerMatchId: currentMultiplayerContext ? currentMultiplayerContext.matchId : null,
      multiplayerSlot: currentMultiplayerContext ? currentMultiplayerContext.slot : null,
      originalBuild: {...build},
      // Wave 2A (MASTER_REMEDIATION_SPEC.md): the canonical, ID-based QB registry -- see the
      // "Canonical QB registry" block above rivalForTeam for what owns these and how they stay in
      // sync with the legacy leagueRivals/leagueDepthCharts/freeAgentPool arrays above.
      qbsById: {},
      teamQbDepth: {},
      freeAgentQbIds: [],
      retiredQbIds: [],
    };
    career.leagueRivals = generateLeagueRivals();
    career.leagueRivals.forEach(r=> assignQuarterbackToRoster(r.id, r.teamId, "QB1"));
    // Player's own team gets a depth chart too (QB2/QB3 behind whoever's QB1) -- purely
    // informational/flavor, never a mechanism that can autonomously bench the player (that's what
    // the incumbent check right below is for; see PROGRESS.md Round 7 for the scope boundary).
    // generateDepthChart itself registers + assigns both slots into the canonical registry.
    career.leagueDepthCharts[team.id] = generateDepthChart(team.id, decade, draftYear, leagueStrength[team.id]);
    // Is there already an established, entrenched starter blocking this rookie? A true 1st-round
    // pick only sits behind a truly elite incumbent; anyone else needs a merely-good one. If so,
    // the player starts as QB2 and has to win the job -- see resolveBackupSeasonSnaps/the
    // end-of-season competition roll in generateSeason().
    const incumbent = rollDraftIncumbent(team.id, decade, draftYear, leagueStrength[team.id]);
    const entrenchThreshold = slot.round===1 ? 80 : 72;
    if(incumbent.talent>=entrenchThreshold && incumbent.age<=32){
      assignQuarterbackToRoster(incumbent.id, team.id, "QB1");
      career.isBackup = true;
      career.transactions.push(`${draftYear}: Enters camp behind ${incumbent.name}, QB1.`);
    }

    showScreen("draftnight");
    document.getElementById("draftNightActions").style.visibility = "hidden";
    playDraftNightAnimation(teamName, draftYear, decade, pickLabel, slot);
  });

  function playDraftNightAnimation(teamName, draftYear, decade, pickLabel, slot){
    const card = document.getElementById("draftNightCard");
    const reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const [c1, c2] = teamColors(career.teamId);
    card.innerHTML = `
      <div class="dn-badge cycling" id="dnBadge" style="background:linear-gradient(135deg, var(--surface-raised), var(--surface-raised));"></div>
      <div class="dn-eyebrow">${draftYear} MLB Draft · ${decade}</div>
      <div class="dn-eyebrow" style="margin-top:0.2rem;">${svgEscape(career.name)} · ${svgEscape(positionLabel(career.position))} · ${svgEscape(career.college)} · ${svgEscape(career.hometown.city)}, ${svgEscape(career.hometown.state)}</div>
      <div class="dn-team cycling" id="dnTeamText">On the clock…</div>
      <div class="dn-pick" id="dnPickText" style="visibility:hidden;">${pickLabel}</div>
      <div class="dn-flavor" id="dnFlavorText" style="visibility:hidden;">${draftNightFlavor(slot, lastCombine.grade)}</div>`;
    const teamTextEl = document.getElementById("dnTeamText");
    const badgeEl = document.getElementById("dnBadge");
    const finish = ()=>{
      teamTextEl.textContent = teamName;
      teamTextEl.classList.remove("cycling");
      teamTextEl.classList.add("landed");
      badgeEl.textContent = teamInitials(teamName);
      badgeEl.style.background = `linear-gradient(135deg, ${c1}, ${c2})`;
      badgeEl.classList.remove("cycling");
      badgeEl.classList.add("landed");
      document.getElementById("dnPickText").style.visibility = "visible";
      document.getElementById("dnFlavorText").style.visibility = "visible";
      document.getElementById("draftNightActions").style.visibility = "visible";
      SFX.draftHorn();
    };
    if(reduced){ finish(); return; }
    const decoyPool = teamsAvailable(draftYear).map(t=>teamNameAt(t.id, draftYear)).filter(n=>n!==teamName);
    let i = 0;
    const total = 12;
    const step = ()=>{
      if(i>=total){ finish(); return; }
      teamTextEl.textContent = pick(decoyPool.length?decoyPool:[teamName]);
      badgeEl.textContent = teamInitials(teamTextEl.textContent);
      i++;
      const delay = 90 + i*14; // decelerate
      setTimeout(step, delay);
    };
    step();
  }

  function draftNightFlavor(slot, grade){
    const name = svgEscape(career.name), college = svgEscape(career.college);
    const pos = positionLabel(career.position).toLowerCase();
    if(slot.round===1 && slot.pickLo===1) return `The cameras find ${name} at the podium. Scouts loved the ${college} bat — ${grade.flavor.toLowerCase()} — and a front office just spent a top-10 pick on a ${pos}.`;
    if(slot.round===1) return `A first-round grade out of ${college}, a small slide, and an organization that expects ${name} to move quickly through the system.`;
    if(slot.round===0) return `No call over the three days for the ${college} product. ${name} signs a non-drafted free-agent deal and a shot at an affiliate roster.`;
    return `A solid showcase out of ${college} and a mid-round flier on ${name} — the kind of pick that either forces its way up the ladder in three years or gets released.`;
  }

  document.getElementById("startCareerBtn").addEventListener("click", ()=>{
    // Multiplayer's shared-seed window ends here (see the section header comment above the
    // Multiplayer wiring block) -- combine + draft night are done, so the ongoing season-by-season
    // simulation goes back to genuine, unseeded randomness exactly like solo play. A no-op for solo
    // play, which was never seeded in the first place.
    restoreRandom();
    showScreen("career"); advanceCareer();
  });

  /* ----- season generation ----- */
  // temporary attribute nudges from life events (a legend's mentorship, a scheme that fits, a
  // rough offseason) — each entry {key, delta, seasonsLeft}, ticked down once per season and
  // dropped at zero. Kept separate from the permanent build so they never touch the combine card.
  function activeBoostDelta(key){
    return (career.tempBoosts||[]).filter(b=>b.key===key).reduce((sum,b)=>sum+b.delta, 0);
  }
  function tickTempBoosts(){
    if(!career.tempBoosts) return;
    career.tempBoosts.forEach(b=> b.seasonsLeft--);
    career.tempBoosts = career.tempBoosts.filter(b=>b.seasonsLeft>0);
  }
  function effectiveAttr(key, age){
    const group = ATTR_BY_KEY[key].group;
    const boosted = clamp(build[key] + activeBoostDelta(key), 10, 99);
    if(key==="DUR"){
      const mult = age<=33 ? 1 : clamp(1-(age-33)*0.03, 0.55, 1);
      return clamp(Math.round(boosted*mult), 20, 99);
    }
    const mult = ageMultiplier(group, age);
    return clamp(Math.round(boosted*mult), 15, 99);
  }
  function currentEffective(age){
    const eff = {};
    ATTR_KEYS.forEach(k=> eff[k]=effectiveAttr(k, age));
    return eff;
  }

  function weighted(eff, weights){
    let sum=0, wsum=0;
    for(const k in weights){ sum += eff[k]*weights[k]; wsum += weights[k]; }
    return sum/wsum;
  }
  function eraEffective(age, decade){ return eraAdjust(currentEffective(age), decade); }
  // Scheme-adjusted effective attributes: era adjustment first (when/how the game is played),
  // then the current team's coaching scheme on top (what THIS playbook rewards). Used for actual
  // stat production and overall grade; deliberately NOT used for the injury-DUR, infraction-DEC,
  // or Key-Moment-CLU rolls, since those are behavioral/injury mechanics, not stat production.
  function schemeEffective(age, decade, schemeId){ return schemeAdjust(eraEffective(age, decade), schemeId); }
  function computeEffOverall(age, decade){
    const d = decade || decadeForYear(career.year);
    const schemeId = career.teamScheme ? career.teamScheme[career.teamId] : null;
    return weighted(schemeEffective(age, d, schemeId), OVERALL_WEIGHTS);
  }

  // A league-average (65 raw, every attribute) build run through the exact same age curve and
  // era reweighting as the player's actual build. Season stats are driven by the GAP between the
  // player's effective attributes and this neutral baseline, not a flat number — so a rookie's
  // real age-22 penalty (or a harsh era mismatch) doesn't read as "this build is bad," only a
  // genuinely below-average build does.
  function neutralEffective(age, decade, schemeId){
    const eff = {};
    ATTR_KEYS.forEach(k=>{
      if(k==="DUR"){ eff[k]=65; return; }
      const mult = ageMultiplier(ATTR_BY_KEY[k].group, age);
      eff[k] = clamp(Math.round(65*mult), 15, 99);
    });
    const eraAdjusted = eraAdjust(eff, decade);
    return schemeId ? schemeAdjust(eraAdjusted, schemeId) : eraAdjusted;
  }

  /* ----- postseason & the World Series ----- */
  // One half-inning of run scoring. `off` is the batting side's lineup grade, `def` the fielding
  // side's pitching+defense grade. Most half-innings are scoreless; a rally is usually 1-2 runs
  // with a rare crooked number. The `tds`/`fgs` fields are kept at 0 so the overtime/box-score
  // code that still destructures them keeps working during the conversion.
  function scoreForInning(off, def){
    const diff = off - def;
    // Deliberately shallow: even a huge lineup-vs-staff mismatch only shifts a half-inning's
    // rally odds a little, so a great team beats a bad one ~60-65% of the time, not 85%+.
    const rallyProb = clamp(0.205 + diff*0.0017, 0.09, 0.34);
    let runs = 0;
    if(Math.random() < rallyProb){
      runs = 1;
      if(Math.random() < 0.34) runs++;                    // two-run inning
      if(Math.random() < 0.10) runs += randInt(1, 3);     // big inning
    }
    return { pts: runs, tds: 0, fgs: 0 };
  }
  // myDefense (career.defense, 20-99, same independently-noisy scale as oline/weapons) is optional
  // so rival-vs-rival math elsewhere that has no such concept keeps working unchanged -- when
  // given, it blends into how many points the OPPONENT scores (80% offOverall / 20% myDefense),
  // decoupling "how good is my defense" from "how good is my own QB" the way real football works:
  // a great defense meaningfully helps, without overshadowing the QB-skill mechanic the whole game
  // is built around. Diagnostically swept before landing on 20%: an initial 65% weight produced a
  // 51-POINT win-rate swing (20 vs 99 defense) for a mediocre QB -- larger than the QB's own full
  // skill range (Round 4's QB_INFLUENCE calibration) -- so the defense grade was overpowering the
  // player's own performance. At 20% weight the same swing is ~14 points: a real, felt effect that
  // stays clearly secondary to the QB's own play.
  // Wave 4 (MASTER_REMEDIATION_SPEC.md, required design #1): a single source of truth for whether
  // overtime exists at all, and whether the result is allowed to stay level, for a given year/
  // context. Historical boundaries (verified against known, well-documented NFL rule-change years):
  //   - Before 1974: the regular season had NO overtime of any kind. A game level after 60 minutes
  //     was final, full stop -- there is no "extra period" to simulate at all.
  //   - 1974-2011: a single 15-minute sudden-death regular-season overtime period was introduced
  //     (1974) -- first score wins; if nobody scores, the game ends level.
  //   - 2012-2016: the regular season adopted the "modified" sudden-death rule the postseason had
  //     used since 2010 -- each team is guaranteed a possession unless the first-possession team
  //     scores a touchdown. Still one 15-minute period; still can end level.
  //   - 2017-present: the regular-season overtime period was shortened to 10 minutes; the modified
  //     rule stays in place; still can end level.
  //   - Postseason, every era: sudden death, unlimited periods, plays until a winner -- a playoff
  //     game has never been allowed to end in a tie. year>=2010 reflects the postseason's own
  //     adoption of the modified rule.
  // `modifiedSuddenDeath`/`periodMinutes` are recorded for documentation/completeness (the spec
  // asks this table to "distinguish... modified-sudden-death eras, period-length changes") but are
  // NOT separately simulated possession-by-possession below -- a documented simplification, since
  // only the outcome (who wins, or whether it stays level) is what standings/history/records need
  // to agree on, not shot-by-shot overtime fidelity. `hasOvertime` and `canEndInTie` are the two
  // fields resolveOvertime actually branches on.
  // Baseball: a game always plays until someone leads at the end of an inning -- there is always
  // "overtime" (extra innings). The postseason can NEVER end level. The regular season can, but
  // only very rarely and only in the older eras (a game called for weather/curfew while tied,
  // never resumed); from the mid-1970s on, a tied game is suspended and finished later, so ties
  // effectively vanish. `modifiedSuddenDeath` / `periodMinutes` no longer mean anything and are
  // left as harmless constants for any code still reading the shape.
  function overtimeRulesForYear(year, postseason){
    if(postseason) return { hasOvertime:true, modifiedSuddenDeath:false, periodMinutes:0, canEndInTie:false };
    return { hasOvertime:true, modifiedSuddenDeath:false, periodMinutes:0, canEndInTie: year<1975 };
  }
  // Wave 4 required design #2: regulation scoring separated from tie/overtime resolution -- the two
  // used to be one monolithic function, which made it impossible to ask "is this level after 4
  // quarters" without also deciding what happens next. Never returns won/tie itself; the caller (or
  // resolveOvertime) does that once it knows whether the two totals actually match.
  // Wave 7 (MASTER_REMEDIATION_SPEC.md task #2): `oppDefense` -- the opponent's REAL persistent
  // defense grade (opponentDefenseGrade) -- is what MY offense is actually resisted by; `defOverall`
  // (the opponent's OFFENSE) still does exactly what it always did for the OTHER half of this
  // function: it's what determines how many points THEY score. Before this wave, defOverall alone
  // fed the resistance my own scoring faced too -- the confirmed defect. `oppDefense` defaults to
  // `defOverall` when omitted so a caller that hasn't been updated yet keeps the exact old
  // behavior (rival-vs-rival math elsewhere has no such concept and never passes it); every real
  // simulateGameScore call site is updated to pass it. The OPPONENT's own resistance
  // (oppFacingGrade, myDefense blended 80/20 with offOverall) is unchanged -- a separate, already-
  // calibrated mechanic (see scoreForQuarter's own comment for the diagnostic sweep behind that
  // 80/20 split), not part of this defect.
  function simulateRegulationScore(offOverall, defOverall, myDefense, oppDefense){
    // myDefense (career.defense -- the player's team's pitching+fielding grade) blends into how
    // many runs the OPPONENT puts up (80% their lineup / 20% my staff), the same 80/20 split the
    // football version used, decoupling "how good is my run prevention" from "how good is my bat."
    const myFacingGrade = oppDefense!=null ? oppDefense : defOverall;   // the pitching I face
    const oppFacingGrade = myDefense!=null ? (offOverall*0.8 + myDefense*0.2) : offOverall;
    const quarters = []; // one entry per inning (field name kept for the reveal code)
    let myTotal=0, oppTotal=0, myTds=0, myFgs=0, oppTds=0, oppFgs=0;
    for(let q=1;q<=9;q++){
      const myQ = scoreForInning(offOverall, myFacingGrade);
      // Home team bats last: skip the bottom of the 9th if they're already ahead.
      const oppQ = (q===9 && oppTotal>myTotal) ? { pts:0, tds:0, fgs:0 } : scoreForInning(defOverall, oppFacingGrade);
      myTotal+=myQ.pts; oppTotal+=oppQ.pts;
      quarters.push({ q, myQ: myQ.pts, oppQ: oppQ.pts, myTotal, oppTotal });
    }
    return { quarters, myTotal, oppTotal, myTds, myFgs, oppTds, oppFgs };
  }
  // Only ever called when regulation ended level. `tieProb` is the CONDITIONAL "stays tied given
  // level after regulation" probability (tieStayProbability) -- optional, and only meaningful when
  // overtimeRulesForYear says this era/context canEndInTie; postseason callers never pass it (every
  // pre-existing caller -- every playoff round, the Super Bowl -- omits it), since a playoff game
  // keeps playing until someone wins regardless. Before this wave the pre-1974 "no overtime"
  // history above didn't exist as a real rule at all -- a level game in that era still ran a
  // fictional coin-flip "OT" period most of the time (whenever the tieProb roll happened not to
  // fire), which is historically false: there was no extra period to play, ever, before 1974.
  function resolveOvertime(regulation, offOverall, defOverall, year, postseason, tieProb){
    const rules = overtimeRulesForYear(year, postseason);
    const { myTds, myFgs, oppTds, oppFgs } = regulation;
    let { myTotal, oppTotal } = regulation;
    if(!rules.hasOvertime){
      return { quarters: regulation.quarters, myTotal, oppTotal, won:null, tie:true, myTds, myFgs, oppTds, oppFgs };
    }
    if(rules.canEndInTie && tieProb && Math.random()<tieProb){
      return { quarters: regulation.quarters, myTotal, oppTotal, won:null, tie:true, myTds, myFgs, oppTds, oppFgs };
    }
    // Extra innings: play full frames until one side leads at the end of one. A generous cap then
    // a coin flip so a sim can never loop forever on two dead-even offenses.
    const quarters = [...regulation.quarters];
    for(let inn=10; inn<=21; inn++){
      const myR = scoreForInning(offOverall, defOverall).pts + (Math.random()<0.12 ? 1 : 0);
      const oppR = scoreForInning(defOverall, offOverall).pts + (Math.random()<0.12 ? 1 : 0);
      myTotal += myR; oppTotal += oppR;
      quarters.push({ q: inn, myQ: myR, oppQ: oppR, myTotal, oppTotal });
      if(myTotal !== oppTotal) break;
    }
    if(myTotal === oppTotal){
      if(Math.random() < 0.5 + (offOverall-defOverall)*0.01) myTotal++; else oppTotal++;
      const last = quarters[quarters.length-1];
      last.myTotal = myTotal; last.oppTotal = oppTotal;
    }
    return { quarters, myTotal, oppTotal, won: myTotal>oppTotal, tie:false, myTds, myFgs, oppTds, oppFgs };
  }
  // Thin wrapper kept for every existing call site: runs regulation, and only consults
  // overtimeRulesForYear/resolveOvertime when the two totals actually match after 4 quarters.
  // `year`/`postseason` default to a modern, postseason-shaped context (hasOvertime with no
  // tie possible) so any call site that genuinely doesn't care about era (none currently exist,
  // but this keeps the function total/safe) degrades to the pre-Wave-4 "always resolves a winner"
  // behavior rather than throwing.
  // Wave 7: `oppDefense` (opponentDefenseGrade(oppId), trailing/optional for backward compatibility)
  // threads through to simulateRegulationScore -- see its own comment for the defect this fixes.
  function simulateGameScore(offOverall, defOverall, myDefense, tieProb, year, postseason, oppDefense){
    const regulation = simulateRegulationScore(offOverall, defOverall, myDefense, oppDefense);
    if(regulation.myTotal!==regulation.oppTotal){
      return { ...regulation, won: regulation.myTotal>regulation.oppTotal, tie:false };
    }
    return resolveOvertime(regulation, offOverall, defOverall, year ?? 2020, postseason ?? true, tieProb);
  }
  // One postseason game's batting line for the player, sampled around this season's per-game
  // rates. Real fields: ab / r / h / doubles / triples / hr / rbi / bb / k / sb. Legacy aliases
  // (att=AB, comp=H, yards=TB, td=HR, int=K, sacks=GIDP, rushAtt=BB, rushYards=RBI, rushTd=SB)
  // are kept so the box-score modal keeps rendering until Phase 10 relabels it.
  function generateGameBoxScore(season, myRuns, _unused){
    const gp = season.games || 1;
    const per = k => (season[k]||0)/gp;
    const ab = clamp(Math.round(3.4 + Math.random()*1.6), 2, 6);
    const seasonAvg = season.avg || 0.255;
    const h = clamp(Math.round(ab * clamp(seasonAvg*(0.2+Math.random()*2.4), 0, 1)), 0, ab);
    const hr = h>0 && Math.random() < clamp(per("hr")/Math.max(1,per("hits"))*(h), 0, 0.6) ? 1 + (Math.random()<0.12?1:0) : 0;
    const hrCapped = Math.min(hr, h);
    const doubles = (h - hrCapped) > 0 && Math.random() < 0.28 ? 1 : 0;
    const triples = (h - hrCapped - doubles) > 0 && Math.random() < 0.05 ? 1 : 0;
    const singles = Math.max(0, h - hrCapped - doubles - triples);
    const tb = singles + 2*doubles + 3*triples + 4*hrCapped;
    const bb = Math.random() < clamp(per("bb")/4.2, 0.02, 0.5) ? 1 + (Math.random()<0.14?1:0) : 0;
    const k = Math.max(0, Math.round(clamp(per("k")/4.2, 0, 0.9) * (ab) * (0.4+Math.random()*1.6)));
    const kCapped = Math.min(k, ab - h);
    const rbi = clamp(hrCapped + (h-hrCapped>0 && Math.random()<0.45 ? randInt(1,2) : 0) + Math.round((myRuns||0)*0.12*Math.random()), 0, 7);
    const r = clamp((h>0 || bb>0) && Math.random()<0.5 ? 1 + (Math.random()<0.15?1:0) : 0, 0, 4);
    const sb = Math.random() < clamp(per("sb")/4.2, 0, 0.4) ? 1 : 0;
    const gidp = Math.random() < 0.09 ? 1 : 0;
    return {
      ab, r, h, doubles, triples, hr: hrCapped, rbi, bb, k: Math.max(0,kCapped), sb,
      // legacy aliases
      att: ab, comp: h, pct: ab>0 ? h/ab : 0, yards: tb, td: hrCapped, int: Math.max(0,kCapped),
      sacks: gidp, rushAtt: bb, rushYards: rbi, rushTd: sb,
    };
  }

  /* ----- regular season: the player's own team-quality-aware, per-game engine -----
     Previously the player's regular-season record came from a single abstracted win% roll
     (flat vs. league, no opponent identity at all) while buildScheduleResults() ran a REAL
     opponent-identity-aware simulation for every OTHER team in the league and then discarded
     its own result for the player, overwriting it with that abstracted number. That was two
     disconnected systems pretending to be one. Then (Round 20) the player got their OWN real
     schedule (division rivals home-and-home, rest of the league filling the slate), but generated
     independently of everyone else's shared schedule -- which could occasionally make the two
     disagree about who's playing whom in a given week (see the Round 25/26 history on
     buildWeekMatchups). As of Round 27, the player is just another team inside ONE shared
     schedule (see buildSeasonSchedule, called once per season before anyone's games are
     simulated) -- no separate opponent-picking logic of its own anymore. Each game is still
     resolved by the same simulateGameScore() engine the playoffs already use against that
     specific opponent's real team grade, with a per-game stat line sampled around the season's
     calibrated rates so the box scores have real game-to-game texture instead of one
     deterministic season formula. See regularSeasonOffenseGrade (Round 4) for how the offensive
     grade fed into simulateGameScore is computed -- it blends effOverall with career.teamStrength
     instead of just nudging effOverall by a small team-quality edge. */
  // The player's own opponent-by-week list is read straight off the shared season schedule (see
  // buildSeasonSchedule) -- this is what makes the player just another team in the same single
  // standings/schedule board. A season's worth of slots (one per scheduled week, byes excluded)
  // gets split into "started" (this QB actually played, full per-game stat simulation, exactly as
  // before) and "missed" (injury/suspension/backup-incumbent -- a placeholder result only, no
  // personal stat line) -- see missedGamesBackup/genericMissedGames below for how that split is
  // decided and reported back to generateSeason().
  function simulateRegularSeasonGames({ schedule, gamesPlayed, missedGamesBackup, genericMissedGames,
      incumbentWinRate, incumbentId, incumbentName, effOverall, comp, ypa, tdRate, intRate, bbRate, attPerGame, perfMult, effRush, sackRate, age, decade }){
    // Baseball reinterpretation of the slot names: comp = hits-per-PA, ypa = total-bases-per-PA,
    // tdRate = HR-per-PA, intRate = K-per-PA, bbRate = BB-per-PA, sackRate = GIDP-per-PA, attPerGame
    // = PA per game, effRush = stolen-base signal.
    bbRate = bbRate || 0.08;
    const mySlots = schedule.weeks
      .map((pairs, wIdx)=>{
        const pair = pairs.find(([a,b])=>a===career.teamId || b===career.teamId);
        if(!pair) return null;
        return { week: wIdx+1, opponentId: pair[0]===career.teamId ? pair[1] : pair[0] };
      })
      .filter(Boolean);
    // Normally mySlots.length===schedule.gamesN exactly; clamp against it anyway so the rare
    // odd-team-count shortfall (see scheduleGamesIntoWeeks) degrades gracefully into "one fewer
    // game played" instead of a negative count.
    const totalMissed = clamp(mySlots.length - gamesPlayed, 0, mySlots.length);
    const missedIdxs = shuffle(mySlots.map((_,i)=>i)).slice(0, totalMissed);
    const incumbentCount = clamp(missedGamesBackup, 0, totalMissed);
    const incumbentIdxSet = new Set(missedIdxs.slice(0, incumbentCount));
    const missedIdxSet = new Set(missedIdxs);
    const genericWinProb = clamp(0.5 + (career.teamStrength-65)*0.01, 0.12, 0.88);
    // Ties QOL: two DIFFERENT probabilities for two different resolution mechanisms. The
    // missed-game/generic-backup branch below rolls a plain win/loss coinflip with no score
    // simulated first, exactly like simpleGameWinner -- it needs the UNCONDITIONAL tieProbability
    // (this game is a tie, period). The real per-quarter branch (simulateGameScore) only checks for
    // a tie once already level after regulation -- it needs the CONDITIONAL tieStayProbability, or
    // the player's own real games would tie far less often than everyone else's at the "same" rate
    // (see tieStayProbability's own comment for the empirical sweep behind this).
    const tieProbFlat = tieProbability(career.year);
    const tieProbConditional = tieStayProbability(career.year);

    const myOff = regularSeasonOffenseGrade(effOverall, age, decade);
    const games = [];
    let tComp=0,tAtt=0,tYards=0,tTd=0,tInt=0,tSacks=0,tBb=0,tRushAtt=0,tRushYards=0,tRushTd=0,wins=0,ties=0,started=0,personalTies=0;
    let backupWins=0, backupLosses=0, incumbentWins=0, incumbentLosses=0;
    mySlots.forEach((slot, idx)=>{
      const oppId = slot.opponentId;
      const oppGrade = oppId===career.teamId ? career.teamStrength : (career.leagueStrength[oppId] ?? 60);
      const oppRival = rivalForTeam(oppId);
      if(missedIdxSet.has(idx)){
        // A generic backup (or the named incumbent, if this slot's the one covering him) plays
        // this week instead -- team quality alone decides it, not this QB's skill, and no personal
        // stat line gets attached. Still a real, scored entry on the shared schedule so the team's
        // weekly board never shows a hole where a game should be.
        const isIncumbent = incumbentIdxSet.has(idx);
        const isTie = Math.random()<tieProbFlat;
        const won = !isTie && Math.random() < (isIncumbent ? incumbentWinRate : genericWinProb);
        if(isTie){ ties++; }
        else if(isIncumbent){ if(won) incumbentWins++; else incumbentLosses++; }
        else { if(won) backupWins++; else backupLosses++; }
        let winnerScore, loserScore;
        if(isTie){ const s = approxGameScore(Math.max(career.teamStrength,oppGrade), Math.min(career.teamStrength,oppGrade)); winnerScore = loserScore = Math.round((s.winnerScore+s.loserScore)/2); }
        else ({ winnerScore, loserScore } = approxGameScore(won?career.teamStrength:oppGrade, won?oppGrade:career.teamStrength));
        // Wave 2B: tag exactly WHO started this game -- the named incumbent (if this is one of his
        // planned weeks) or nobody in particular (a generic missed game, e.g. injury/suspension
        // coverage) -- so schedule cards and the box-score modal can show the real starter instead
        // of silently assuming it was always the player. comp/att/yards/td/int stay 0 here; the
        // incumbent's real stat line gets distributed onto exactly these tagged weeks once
        // simulateRivalSeasons actually simulates him, later this same generateSeason() call (see
        // applyStatLineToGames there).
        games.push({ week: slot.week, opponentId: oppId, opponentName: teamNameAt(oppId, career.year),
          opponentGrade: Math.round(oppGrade), opponentQbId: oppRival?oppRival.id:null,
          opponentQbName: oppRival?oppRival.name:null, opponentQbOverall: oppRival?rivalEffTalent(oppRival):null,
          won: isTie?null:won, tie: isTie, myScore: isTie?winnerScore:(won?winnerScore:loserScore), oppScore: isTie?loserScore:(won?loserScore:winnerScore),
          comp:0, att:0, yards:0, td:0, int:0, sacks:0, bb:0, rushAtt:0, rushYards:0, rushTd:0, startedByBackup:true,
          qbId: isIncumbent ? incumbentId : null, qbName: isIncumbent ? incumbentName : null });
        return;
      }
      started++;
      const oppOffense = opponentOffenseGrade(oppId, QB_INFLUENCE_REGULAR);
      const scoreSim = simulateGameScore(myOff, oppOffense, career.defense, tieProbConditional, career.year, false, opponentDefenseGrade(oppId));
      const won = scoreSim.won;
      // ties (shared with the missed-games/incumbent-covered branch above, since season.teamTies
      // needs every tie regardless of who was under center) is NOT the right subtrahend for
      // personal `losses` below -- see personalTies.
      if(scoreSim.tie){ ties++; personalTies++; } else if(won) wins++;
      bumpRivalry(oppRival, { divisionRival: divisionOf(career.teamId, career.year).teams.includes(oppId), won: scoreSim.tie?false:won, close: Math.abs(scoreSim.myTotal-scoreSim.oppTotal)<=3 });

      // A hitter's box line for this game. Per-game noise averages to 1.0x the season rate over a
      // full slate, so summed game logs land on the same season totals -- this only adds texture.
      // Deliberately NOT tied to this game's run total (unlike the old scoreboard-coupled TD rule):
      // one bat's HR/hits aren't the team's runs.
      const gAtt = Math.max(2, Math.round(attPerGame*(0.55+Math.random()*0.9)));   // PA
      const gComp = clamp(Math.round(gAtt*clamp(comp*(0.35+Math.random()*1.3), 0, 0.9)*perfMult), 0, gAtt);   // hits
      const gYards = Math.max(gComp, Math.round(gAtt*clamp(ypa*(0.3+Math.random()*1.55), 0, 3.2)*perfMult));   // total bases
      const gInt = Math.max(0, Math.round(gAtt*clamp(intRate*(0.2+Math.random()*1.7), 0, 0.9)*(2-perfMult))); // strikeouts
      const gBb = Math.max(0, Math.round(gAtt*clamp(bbRate*(0.25+Math.random()*1.6), 0, 0.7)));               // walks
      const gSacks = Math.max(0, Math.round(gAtt*clamp(sackRate*(0.2+Math.random()*2.0), 0, 0.5)));           // GIDP
      const gTd = clamp(Math.round(gAtt*clamp(tdRate*(0.15+Math.random()*2.2), 0, 0.5)*perfMult), 0, Math.max(1,gComp)); // HR

      // Stolen bases: effRush is the SB signal. Attempts per game run ~0..0.9, success ~62-90%.
      const gRushAttPerGame = clamp((effRush-58)*0.010, 0, 0.9);
      const gRushAtt = Math.max(0, Math.round(gRushAttPerGame*(0.3+Math.random()*1.7)));
      const gSbSuccess = clamp(0.62 + (effRush-60)*0.006, 0.45, 0.92);
      const gRushYards = gRushAtt>0 ? Math.min(gRushAtt, Math.round(gRushAtt*gSbSuccess + (Math.random()<0.5?0:1))) : 0; // SB made
      const gRushTd = 0;

      tComp+=gComp; tAtt+=gAtt; tYards+=gYards; tTd+=gTd; tInt+=gInt; tSacks+=gSacks; tBb+=gBb;
      tRushAtt+=gRushAtt; tRushYards+=gRushYards; tRushTd+=gRushTd;

      games.push({ week: slot.week, opponentId: oppId, opponentName: teamNameAt(oppId, career.year),
        opponentGrade: Math.round(oppGrade),
        opponentQbId: oppRival ? oppRival.id : null,
        opponentQbName: oppRival ? oppRival.name : null,
        opponentQbOverall: oppRival ? rivalEffTalent(oppRival) : null,
        won, tie: !!scoreSim.tie, myScore: scoreSim.myTotal, oppScore: scoreSim.oppTotal,
        comp: gComp, att: gAtt, yards: gYards, td: gTd, int: gInt, sacks: gSacks, bb: gBb,
        rushAtt: gRushAtt, rushYards: gRushYards, rushTd: gRushTd });
    });
    return { games, comp:tComp, att:tAtt, yards:tYards, td:tTd, int:tInt, sacks:tSacks, bb:tBb,
      rushAtt:tRushAtt, rushYards:tRushYards, rushTd:tRushTd, wins, losses: started-wins-personalTies, ties,
      backupWins, backupLosses, incumbentWins, incumbentLosses };
  }

  /* ----- league-wide standings: EVERY team's non-player games are resolved through a shared,
     correlated schedule — division rivals play each other twice, and every other game is
     drawn once and applied to both teams at once — instead of each team rolling its own
     independent win total. That's what keeps division records internally consistent (a team
     that goes 0-16 guarantees its rivals at least 2 wins each, so a same-division 1-15 next
     to it is no longer possible). The player's own team is overwritten with its REAL record
     (starter + backup starts combined) afterward. Division winners + best-record wildcards
     seed the playoffs, so a team's seed and its "made/missed" status can never contradict
     each other, and both the bracket shape and the division map are era-accurate by year. ----- */
  // Baseball has far more per-game parity than football -- the best teams win ~62% (about 100-62),
  // the worst ~38%, over 162. The clamp caps a single team at ~.66 win prob vs. a league-worst
  // opponent (~107 wins) and floors it at ~.35 (~57 wins), and the coefficient is a third of the
  // football value. Retune with a full-season standings sweep if the spread looks wrong.
  function simpleWinProb(aStrength, bStrength){ return clamp(0.5 + (aStrength-bStrength)*0.0032, 0.35, 0.66); }
  // Ties QOL: `tieProb` is OPTIONAL and defaults to falsy, so every pre-existing call site (every
  // flat PLAYOFF resolution -- playoffs never end in a tie in real NFL rules, and none of those
  // call sites pass this) is completely unaffected. Only buildScheduleResults' regular-season flat
  // resolution passes a real, era-based probability (see tieProbability below). Returns `null` as
  // the tie sentinel -- every caller that can receive a tieProb must handle a null return.
  function simpleGameWinner(idA, sA, idB, sB, tieProb){
    if(tieProb && Math.random()<tieProb) return null;
    return Math.random() < simpleWinProb(sA, sB) ? idA : idB;
  }
  // Real NFL overtime history, regular season only: no overtime existed at all before 1974 (a level
  // game after 60 minutes simply ended in a tie); 1974-2011 was a single sudden-death period, which
  // made a tie rare but still possible if nobody scored in it; 2012 on shortened that period and
  // guaranteed each team a possession unless the first score was a touchdown, very slightly raising
  // the tie rate versus the preceding rule (more clock ticks off without a possession-ending score
  // before the period can end level). Playoffs are NEVER subject to this -- see the note on
  // simpleGameWinner above and simulateGameScore's own tieProb param below; a playoff game just
  // keeps calling this function with no tieProb until it flat-out doesn't.
  // Wave 4 (MASTER_REMEDIATION_SPEC.md, required design #8 -- "calibrate league tie rates by era
  // with seeded multi-season sweeps, do not choose... by intuition"): the pre-1974 value used to be
  // a flat 0.02 (an assumed "couple percent of all games" figure), but Wave 4 also fixed
  // resolveOvertime to make a level-after-regulation pre-1974 game ALWAYS stay tied (no fictional
  // "OT" -- overtime genuinely did not exist that era) instead of only 33% of the time. Under that
  // now-historically-accurate mechanism, the real aggregate tie rate is however often two simulated
  // teams naturally end up level after 4 real quarters -- measured via tie_sweep.mjs at 6 seeds x 15
  // seasons in the 1960s (406 real player games): 4.93% (20/406), clearly higher than the old 2%
  // assumption once ties are no longer artificially suppressed by a fictional OT most of the time.
  // Raised to 0.05 so career.leagueRivals' flat-resolved games (simpleGameWinner, which has no
  // separate regulation/OT concept to derive this from) tie at the SAME real aggregate rate the
  // player's own mechanism now naturally produces for the same era, instead of two different
  // "2% vs ~5%" answers to "how tie-prone is 1965" depending purely on whose game it was. The
  // 1974+ eras were RE-VERIFIED by the same sweep (1980s: 0/704 my games vs 0.39% league, consistent
  // with the existing 0.3% target at this sample size; 2020s: 0.57% my vs 0.56% league, matching the
  // existing 0.5% target closely) and are unchanged.
  // Unconditional "this game ended in a tie" rate. Baseball ties are vanishingly rare -- a called
  // game in the pre-suspension-rule era, essentially never after. Used by simpleGameWinner (every
  // flat-resolved, non-player game).
  function tieProbability(year){
    if(year<1975) return 0.010;
    if(year<2000) return 0.0015;
    return 0.0004;
  }
  // simulateGameScore's tie check is CONDITIONAL -- it only ever fires when the game is already
  // level after regulation, unlike simpleGameWinner's tieProb above, which is an UNCONDITIONAL
  // "this game is a tie" roll applied to every flat-resolved game regardless of score. Naively
  // reusing the same unconditional probability at a conditional check point would silently produce
  // a much LOWER real-world tie rate for the player's own games than for every other (flat-resolved)
  // team's games at the "same" tieProb -- a real inconsistency caught by a quick empirical sweep
  // (scoreForQuarter's own scoring math puts two evenly-matched teams level after regulation
  // ~6% of the time; see the Round 33 PROGRESS.md entry for the sweep). This divides the target
  // UNCONDITIONAL rate by that measured ~6% to get the conditional "stays tied" probability that
  // actually produces a matching overall tie rate for the player, whichever era they're in.
  // Two evenly-matched teams reach the end of 9 tied ~9% of the time in scoreForInning's math
  // (roughly the real MLB extra-inning-game rate). tieStayProbability converts the unconditional
  // target rate into the conditional "stays a tie once level after 9" figure the player's own
  // real games check at.
  const LEVEL_AFTER_REGULATION_RATE = 0.09;
  function tieStayProbability(year){
    return clamp(tieProbability(year) / LEVEL_AFTER_REGULATION_RATE, 0, 1);
  }
  // A plausible final score for a game resolved from two raw team-strength numbers only (not the
  // full lineup/pitching split simulateGameScore uses for the player's own games) -- fills a
  // per-team schedule row. Baseball run totals: winners mostly 3-7, margins mostly 1-4.
  function approxGameScore(winnerStrength, loserStrength){
    const edge = clamp((winnerStrength-loserStrength)*0.05, 0, 3);
    const winnerScore = clamp(Math.round(3.4 + edge + (Math.random()*4-1)), 1, 16);
    const margin = clamp(Math.round(1 + edge*0.4 + Math.random()*3.4), 1, winnerScore);
    const loserScore = clamp(winnerScore - margin, 0, winnerScore-1);
    return { winnerScore, loserScore };
  }
  // Splits an integer total across n games with natural game-to-game variance while the shares
  // still sum EXACTLY back to total -- used to turn a QB's already-calculated season aggregate into
  // a plausible per-game log without inventing a second, separately-calibrated per-game engine.
  function distributeAcrossGames(total, n){
    if(n<=0) return [];
    if(n===1) return [total];
    const raw = Array.from({length:n}, ()=> 0.6+Math.random()*0.8);
    const rawSum = raw.reduce((a,b)=>a+b,0);
    const shares = raw.map(w=> Math.round(total*w/rawSum));
    let diff = total - shares.reduce((a,b)=>a+b,0);
    let i = 0;
    while(diff!==0 && i<10000){
      const idx = i % n;
      if(diff>0){ shares[idx]++; diff--; } else if(shares[idx]>0){ shares[idx]--; diff++; }
      i++;
    }
    return shares;
  }
  // Attaches per-game QB attribution + a plausible per-game stat line onto a slice of a team's real
  // game log (career.currentSeasonSchedules[teamId]) -- comp is derived from each game's own
  // attempts share so it can never exceed that game's attempts, unlike distributing comp/att
  // independently would risk.
  function applyStatLineToGames(games, qbId, comp, att, yards, td, int){
    if(!games || !games.length) return;
    const attShares = distributeAcrossGames(att, games.length);
    const ydShares = distributeAcrossGames(yards, games.length);
    const tdShares = distributeAcrossGames(td, games.length);
    const intShares = distributeAcrossGames(int, games.length);
    const compPct = att>0 ? comp/att : 0;
    games.forEach((g,i)=>{
      g.qbId = qbId;
      g.att = attShares[i];
      g.comp = Math.min(attShares[i], Math.round(attShares[i]*compPct));
      g.yards = ydShares[i];
      g.td = tdShares[i];
      g.int = intShares[i];
    });
  }
  // Recomputes a QB's real win/loss/winPct from the exact games tagged to him (see
  // applyStatLineToGames/the qbId tagging in simulateRivalSeasons), and corrects the totals that
  // simulatePlayerSeasonStats already incremented once using its own (now-superseded) estimate.
  // Wave 2B (MASTER_REMEDIATION_SPEC.md, required design #5: "Reconcile real W-L-T first, then
  // compute award scores. Never preserve award scores based on placeholder records."): winPct feeds
  // directly into proBowlScore/allProScore/mvpScore (see evaluateSeasonAwards) -- before this wave,
  // those were computed ONCE, from the placeholder winPct simulatePlayerSeasonStats rolled before
  // any real per-game result existed, and never recomputed after the real winPct above landed. A
  // confirmed defect (Section 4): the award RACE itself (resolveSeasonMVP/
  // resolveSeasonAllProAndProBowl, which run after every QB's season this year is locked in) was
  // comparing everyone's scores fairly, but the scores being compared could each individually be
  // stale for anyone whose placeholder win/loss diverged from their real per-game record -- exactly
  // the case for a QB with missed/relief games, which is most of the league in most seasons.
  // `decade`/`leagueGames` are needed only for this recompute; every existing call site already has
  // both in scope.
  function reconcileWinLossFromGames(entity, season, games, decade, leagueGames){
    if(!games) return;
    const wins = games.filter(g=>g.won===true).length, ties = games.filter(g=>g.tie).length, losses = games.length-wins-ties;
    entity.totals.wins += (wins-season.wins); entity.totals.losses += (losses-season.losses);
    entity.totals.ties = (entity.totals.ties||0) + (ties-(season.ties||0));
    season.wins = wins; season.losses = losses; season.ties = ties;
    // Ties QOL: real NFL winPct formula -- a tie counts as half a win, half a loss.
    season.winPct = games.length>0 ? (wins+0.5*ties)/games.length : 0;
    if(decade){
      const recomputed = evaluateSeasonAwards({
        rating: season.rating, td: season.td, winPct: season.winPct, attempts: season.att,
        gamesPlayed: season.games, leagueGames: leagueGames, decade,
        teamOverall: career.leagueStrength[entity.teamId] ?? 60,
      });
      season.proBowlScore = recomputed.proBowlScore; season.proBowlEligible = recomputed.proBowlEligible;
      season.allProScore = recomputed.allProScore; season.allProEligible = recomputed.allProEligible;
      season.mvpScore = recomputed.mvpScore; season.mvpEligible = recomputed.mvpEligible;
    }
  }

  // Builds a real, collision-free week-by-week schedule: every team plays at most one real game
  // per week, so two different teams can never both show, say, "week 1 vs the Ravens" the way a
  // pure per-team running counter allowed (the bug this replaces -- see PROGRESS.md). Each week,
  // greedily pairs teams still owed a division-rival meeting first, falls back to any other team
  // still needing a game, and leaves a team unpaired (a bye) if no valid partner remains that
  // week rather than ever double-booking one -- validated collision-free via week_schedule_sweep.mjs
  // across both an even 32-team/8-division setup and an uneven pre-1970-style division setup.
  // Division-rival meetings are placed FIRST, one in each half of the season, before any other
  // game is scheduled -- an earlier version instead gave a division rival priority inside the
  // regular per-week greedy loop, which raced every team through its division commitments before
  // ever touching a cross-division opponent, front-loading EVERY division game across the whole
  // league into the first several weeks (a real, reported bug: "week 6" showed almost nothing but
  // division matchups). Real NFL schedules spread each division rivalry across the season instead
  // of clustering it at the start -- placing one meeting per half (with a same-half retry budget,
  // then a full-season fallback for the rare case both teams' preferred half is already full)
  // reproduces that spread. Validated via week_schedule_sweep2.mjs: 0 collisions, 0 leftover
  // teams, 0 placement failures, and division games landing roughly evenly across every week of a
  // 32-team/17-game season instead of bunched at the front.
  // Real bye weeks were introduced league-wide in 1990 -- before that, every team played every
  // single week of the season with no week off (season weeks === games, no slack). From 1990
  // onward each team gets exactly one bye, so the calendar runs one week longer than the game
  // count. An ODD number of teams (only possible during a mid-decade expansion year) makes at
  // least one team's bye mathematically unavoidable every single week regardless of era, so that
  // case always gets extra slack weeks even in a pre-bye decade -- 2 extra rather than 1, since
  // the underlying greedy scheduler (see scheduleGamesIntoWeeks) is noticeably more likely to
  // leave a team a game short of gamesN with only 1 spare week to work with when the team count
  // doesn't divide evenly; validated via schedule_bye_sweep.mjs (odd-count shortfall dropped from
  // ~2.8 teams/season at 1 spare week to ~0.7 teams/season at 2).
  function weeksForSeason(decade, teamCount){
    const gamesN = LEAGUE[decade].games;
    const byeEra = decade!=="1960s" && decade!=="1970s" && decade!=="1980s";
    let weeks = byeEra ? gamesN+1 : gamesN;
    if(teamCount % 2 !== 0) weeks = Math.max(weeks, gamesN+2);
    return weeks;
  }
  // weeksN is now independent of gamesN (see weeksForSeason) -- a team can go multiple weeks
  // without playing (a real bye, or just bad luck in the greedy fill below), it just needs to reach
  // exactly gamesN total games by the end of weeksN weeks. Two-team-double-booking is still
  // structurally impossible (tryPlaceInWeek always checks both teams are free that week first).
  function scheduleGamesIntoWeeks(divs, allIds, gamesN, weeksN){
    const remaining = {}; allIds.forEach(id=>{ remaining[id] = gamesN; });
    const weeks = Array.from({length: weeksN}, ()=>[]);
    const usedThisWeek = Array.from({length: weeksN}, ()=>new Set());
    function tryPlaceInWeek(w, a, b){
      if(usedThisWeek[w].has(a) || usedThisWeek[w].has(b)) return false;
      weeks[w].push([a,b]);
      usedThisWeek[w].add(a); usedThisWeek[w].add(b);
      remaining[a]--; remaining[b]--;
      return true;
    }
    function placeGameInHalf(a, b, half){
      let guard = 0;
      while(guard++<50){
        if(remaining[a]<=0 || remaining[b]<=0) return false;
        const w = half[0] + Math.floor(Math.random()*(half[1]-half[0]));
        if(tryPlaceInWeek(w, a, b)) return true;
      }
      for(let w=half[0]; w<half[1]; w++){ if(remaining[a]>0 && remaining[b]>0 && tryPlaceInWeek(w,a,b)) return true; }
      for(let w=0; w<weeksN; w++){ if(remaining[a]>0 && remaining[b]>0 && tryPlaceInWeek(w,a,b)) return true; }
      return false;
    }
    const mid = Math.floor(weeksN/2);
    divs.forEach(d=>{
      for(let i=0;i<d.teams.length;i++){
        for(let j=i+1;j<d.teams.length;j++){
          placeGameInHalf(d.teams[i], d.teams[j], [0, mid || 1]);
          placeGameInHalf(d.teams[i], d.teams[j], [mid, weeksN]);
        }
      }
    });
    // remaining slate (cross-division/filler): same flat greedy-per-week matching as before,
    // just with no division-rival preference bias left to apply -- those are already placed above.
    // A team left over some week (odd pool size, or everyone else already used) simply sits that
    // week -- a real bye -- and gets another shot at a partner in a later week instead of ever
    // being double-booked.
    for(let w=0; w<weeksN; w++){
      const pool = shuffle(allIds.filter(id=> remaining[id]>0 && !usedThisWeek[w].has(id)));
      pool.forEach(a=>{
        if(usedThisWeek[w].has(a) || remaining[a]<=0) return;
        const cands = pool.filter(id=> id!==a && !usedThisWeek[w].has(id) && remaining[id]>0);
        if(cands.length) tryPlaceInWeek(w, a, pick(cands));
      });
    }
    // Repair pass: the greedy fill above can still leave a handful of teams short of gamesN (each
    // one's remaining free weeks just never lined up with another short team's free weeks in the
    // same single pass). Re-scan every still-short team against every OTHER still-short team, in
    // full passes, until a whole pass places nothing new -- this must retry ALL leftover teams each
    // pass, not just re-attempt the same first one repeatedly (an earlier version of this loop did
    // exactly that: it picked leftover[0] and, on failure, dropped it for the rest of ITS OWN pass
    // but then reintroduced it unchanged at the top of the very next pass, so a single unfixable
    // team could burn the entire retry budget forever while other, actually-fixable teams next to
    // it in the list never got a turn -- confirmed and fixed via schedule_bye_sweep.mjs, which
    // showed near-zero improvement from more retries until this was corrected).
    let changed = true, guard2 = 0;
    while(changed && guard2++<200){
      changed = false;
      const leftover = allIds.filter(id=>remaining[id]>0);
      for(let i=0;i<leftover.length;i++){
        const a = leftover[i];
        if(remaining[a]<=0) continue;
        for(let j=0;j<leftover.length;j++){
          const b = leftover[j];
          if(b===a || remaining[b]<=0) continue;
          let placed = false;
          for(let w=0; w<weeksN; w++){
            if(!usedThisWeek[w].has(a) && !usedThisWeek[w].has(b)){
              tryPlaceInWeek(w,a,b);
              placed = true; changed = true;
              break;
            }
          }
          if(placed) break;
        }
      }
    }
    return weeks;
  }
  // One schedule per season, shared by literally every team including the player's own -- this is
  // what makes a cross-schedule conflict (the same team appearing in two different matchups the
  // same week, once as the player's real opponent and once via an independently-generated shared
  // schedule) structurally impossible, not just less likely. Built once, early in generateSeason(),
  // before either the player's own game-by-game stats or anyone else's results are simulated --
  // both draw their opponent-by-week assignments from this SAME weeks array.
  function buildSeasonSchedule(year, decade){
    const divs = divisionsForYear(year);
    const allIds = divs.flatMap(d=>d.teams);
    const gamesN = LEAGUE[decade].games;
    const weeksN = weeksForSeason(decade, allIds.length);
    const weeks = scheduleGamesIntoWeeks(divs, allIds, gamesN, weeksN);
    return { divs, allIds, gamesN, weeksN, weeks };
  }

  // `schedule` is the SAME weeks array (see buildSeasonSchedule) that already decided the player's
  // own opponent-by-week assignments back in generateSeason() -- this pass never generates a
  // second, independent schedule for the player's team. Wherever a scheduled pairing involves
  // career.teamId, the result is read straight off season.gameLog (already real, already known)
  // instead of being rolled again via simpleGameWinner -- this is what makes a cross-schedule
  // conflict (the same team's record disagreeing with itself, or a team appearing in two different
  // matchups the same week) structurally impossible rather than just less likely.
  function buildScheduleResults(season, schedule){
    const allIds = schedule.allIds;
    const wins = {}, losses = {}, ties = {};
    allIds.forEach(id=>{ wins[id]=0; losses[id]=0; ties[id]=0; });
    // Real per-team, per-game log (opponent/week/score) -- current season only, never persisted
    // into career.seasonLog (see career.currentSeasonSchedules below). `week` is a real, shared
    // week index (see scheduleGamesIntoWeeks) -- both teams in a game get the SAME week number and
    // are correctly each other's opponent that week. A team can have fewer entries than another
    // team this season if it drew a bye some week(s) the other team didn't.
    const gameLogs = {}; allIds.forEach(id=>{ gameLogs[id] = []; });
    const strengthOf = id => id===career.teamId ? career.teamStrength : (career.leagueStrength[id] ?? 60);
    const myResultByWeek = {};
    (season.gameLog||[]).forEach(g=>{ myResultByWeek[g.week] = g; });
    const tieProb = tieProbability(season.year);
    schedule.weeks.forEach((weekPairs, weekIdx)=>{
      const week = weekIdx+1;
      weekPairs.forEach(([a,b])=>{
        const myId = a===career.teamId ? a : (b===career.teamId ? b : null);
        let w, winnerScore, loserScore;
        const myGame = myId!=null ? myResultByWeek[week] : null;
        if(myGame){
          const oppId = myId===a ? b : a;
          if(myGame.tie){
            w = null; winnerScore = loserScore = myGame.myScore;
          } else {
            w = myGame.won ? myId : oppId;
            winnerScore = myGame.won ? myGame.myScore : myGame.oppScore;
            loserScore = myGame.won ? myGame.oppScore : myGame.myScore;
          }
        } else {
          w = simpleGameWinner(a, strengthOf(a), b, strengthOf(b), tieProb);
          if(w===null){
            const s = approxGameScore(strengthOf(a), strengthOf(b));
            winnerScore = loserScore = Math.round((s.winnerScore+s.loserScore)/2);
          } else {
            const loser = w===a ? b : a;
            ({ winnerScore, loserScore } = approxGameScore(strengthOf(w), strengthOf(loser)));
          }
        }
        if(w===null){ ties[a]++; ties[b]++; }
        else if(w===a){ wins[a]++; losses[b]++; } else { wins[b]++; losses[a]++; }
        // Wave 2B: carry the player's own qbId/qbName tag (set by simulateRegularSeasonGames for a
        // backup-incumbent-started week -- see there) onto the shared per-team log entry, so
        // schedule cards/box scores can identify who actually played career.teamId's side of this
        // game. The OPPONENT side's qbId gets filled in later by simulateRivalSeasons/
        // simulateDepthChartSeasons (see applyStatLineToGames) -- never pre-seeded here.
        gameLogs[a].push({ week, opponentId: b, won: w===null?null:w===a, tie: w===null, myScore: w===a||w===null?winnerScore:loserScore, oppScore: w===a||w===null?loserScore:winnerScore,
          qbId: (a===career.teamId && myGame) ? (myGame.qbId||null) : undefined, qbName: (a===career.teamId && myGame) ? (myGame.qbName||null) : undefined,
          startedByBackup: (a===career.teamId && myGame) ? !!myGame.startedByBackup : undefined });
        gameLogs[b].push({ week, opponentId: a, won: w===null?null:w===b, tie: w===null, myScore: w===b||w===null?winnerScore:loserScore, oppScore: w===b||w===null?loserScore:winnerScore,
          qbId: (b===career.teamId && myGame) ? (myGame.qbId||null) : undefined, qbName: (b===career.teamId && myGame) ? (myGame.qbName||null) : undefined,
          startedByBackup: (b===career.teamId && myGame) ? !!myGame.startedByBackup : undefined });
      });
    });
    // Defensive safety net only, not the source of truth anymore -- with the player's own games
    // now read directly off the exact same schedule above, wins[career.teamId]/losses[...] should
    // already exactly equal season.teamWins/teamLosses. Left in case season.gameLog ever falls
    // short of covering every scheduled week (see the odd-team-count shortfall note on
    // scheduleGamesIntoWeeks) so the standings table can never silently disagree with the season object.
    wins[career.teamId] = season.teamWins; losses[career.teamId] = season.teamLosses; ties[career.teamId] = season.teamTies||0;
    const results = {};
    // Ties QOL: winPct follows the real NFL formula -- a tie counts as half a win, half a loss.
    // Wave 4 required design #5: pointsFor/pointsAgainst tracked here (from the same gameLogs every
    // other per-team stat already comes from) specifically to feed the point-differential tiebreak
    // step in compareTeamsForStandings below.
    allIds.forEach(id=>{
      const w=wins[id], l=losses[id], t=ties[id], g=w+l+t;
      const pointsFor = (gameLogs[id]||[]).reduce((s,gm)=>s+gm.myScore, 0);
      const pointsAgainst = (gameLogs[id]||[]).reduce((s,gm)=>s+gm.oppScore, 0);
      results[id] = { id, wins:w, losses:l, ties:t, gamesPlayed:g, winPct: g>0?(w+0.5*t)/g:0, pointsFor, pointsAgainst };
    });
    return { results, gameLogs };
  }

  // Wave 4 (MASTER_REMEDIATION_SPEC.md, required design #7): standings used to sort ONLY by
  // winPct -- an exact tie between two teams silently fell back to whatever order Object.keys/
  // Array.sort happened to leave them in (stable, but arbitrary and undocumented; a confirmed
  // defect: "exact ties inherit stable/static team order rather than football tiebreak logic or a
  // documented fallback"). This is a DOCUMENTED SIMPLIFICATION of the real NFL tiebreak procedure
  // (which also considers common games, strength of victory/schedule, net points/net TDs in common
  // games, and a coin toss, roughly in that order after conference record) -- the minimum fallback
  // chain the spec asks for: win percentage, head-to-head (when the tied teams actually played each
  // other), division record (division ranking only), conference record, point differential, then a
  // stable team-ID string compare so the final order is 100% deterministic no matter what. Reads
  // career.currentSeasonSchedules directly (every call site is either inside the same
  // generateSeason() call that just built it, or rendering the season currently active, which is
  // the only season currentSeasonSchedules is ever valid for -- see its own definition) rather than
  // threading gameLogs through every caller.
  function headToHeadWinPct(idA, idB){
    const log = career.currentSeasonSchedules && career.currentSeasonSchedules[idA];
    if(!log) return null;
    const games = log.filter(g=>g.opponentId===idB);
    if(!games.length) return null;
    let w=0,l=0,t=0;
    games.forEach(g=>{ if(g.tie) t++; else if(g.won) w++; else l++; });
    const total = w+l+t;
    return total>0 ? (w+0.5*t)/total : null;
  }
  function groupWinPct(teamId, groupTeamIds){
    const log = career.currentSeasonSchedules && career.currentSeasonSchedules[teamId];
    if(!log) return null;
    const games = log.filter(g=>g.opponentId!==teamId && groupTeamIds.includes(g.opponentId));
    if(!games.length) return null;
    let w=0,l=0,t=0;
    games.forEach(g=>{ if(g.tie) t++; else if(g.won) w++; else l++; });
    const total = w+l+t;
    return total>0 ? (w+0.5*t)/total : null;
  }
  function pointDifferential(result){
    return (result.pointsFor||0) - (result.pointsAgainst||0);
  }
  // `scope` is "division" (checked before conference -- used when ranking teams WITHIN one
  // division) or "conference" (division record skipped -- used for wildcard/conference seeding
  // among teams that aren't all in the same division). Returns <0 to rank rA above rB, matching the
  // standard Array.sort comparator contract.
  function compareTeamsForStandings(rA, rB, year, scope){
    if(rB.winPct!==rA.winPct) return rB.winPct-rA.winPct;
    const h2h = headToHeadWinPct(rA.id, rB.id);
    if(h2h!=null && h2h!==0.5) return h2h>0.5 ? -1 : 1;
    if(scope==="division"){
      const divTeams = divisionOf(rA.id, year).teams;
      const gA = groupWinPct(rA.id, divTeams), gB = groupWinPct(rB.id, divTeams);
      if(gA!=null && gB!=null && gA!==gB) return gB-gA;
    }
    const confTeams = divisionsForYear(year).filter(d=>d.conf===conferenceOf(rA.id, year)).flatMap(d=>d.teams);
    const cA = groupWinPct(rA.id, confTeams), cB = groupWinPct(rB.id, confTeams);
    if(cA!=null && cB!=null && cA!==cB) return cB-cA;
    const pdA = pointDifferential(rA), pdB = pointDifferential(rB);
    if(pdA!==pdB) return pdB-pdA;
    return rA.id<rB.id ? -1 : (rA.id>rB.id ? 1 : 0);
  }

  function simulateLeagueStandings(season, schedule){
    const { results, gameLogs } = buildScheduleResults(season, schedule);
    career.currentSeasonSchedules = gameLogs;
    career.currentSeasonWeeksN = schedule.weeksN;
    const format = playoffFormatForYear(season.year);
    const divs = divisionsForYear(season.year);
    const year = season.year;
    const seeded = {};
    for(const c of ["AFC","NFC"]){
      const confDivs = divs.filter(d=>d.conf===c);
      const confTeamIds = confDivs.flatMap(d=>d.teams);
      const winners = confDivs.map(d=> d.teams.map(id=>results[id]).sort((a,b)=>compareTeamsForStandings(a,b,year,"division"))[0]).filter(Boolean);
      const winnerIds = new Set(winners.map(w=>w.id));
      const rest = confTeamIds.filter(id=>!winnerIds.has(id)).map(id=>results[id]).sort((a,b)=>compareTeamsForStandings(a,b,year,"conference"));
      seeded[c] = [...winners.slice().sort((a,b)=>compareTeamsForStandings(a,b,year,"conference")), ...rest.slice(0, format.wildcards)];
    }
    return { results, seeded, format, divisions: divs };
  }

  // Opponent tendency tags for playoff games: lightweight flavor (and, going forward, the data
  // the Key Moment mini-game reads to build "know they're run-defense heavy" scenarios) rather
  // than a full second team-personality system. One tag is rolled per playoff opponent and
  // stamped onto that round's data so both the paced quarter reveal and the Key Moment mini-game
  // can reference the exact same read on this specific opponent.
  // Pitcher archetypes for the clutch-at-bat mini-game. Ids are load-bearing (PLAY_CALLS'
  // countersTendencyId map + the balance tests key off them); only labels/blurbs are baseball.
  const OPPONENT_TENDENCIES = [
    { id:"runheavy", label:"Fastball-Heavy, Comes Right At You", blurb:"He'll challenge you with the heater — velocity over deception, pitch after pitch." },
    { id:"blitzheavy", label:"Pounds the Zone Early", blurb:"First-pitch strikes, gets ahead, and makes you hit his pitch on his count." },
    { id:"lockdowncorners", label:"Lives on the Black", blurb:"Paints both edges and expands the zone the moment you start chasing." },
    { id:"preventlate", label:"Nibbles With a Lead", blurb:"Give his team a lead and he won't give you anything to hit — he'll pitch around you all day." },
    { id:"turnoverhunting", label:"Chase-Bait Specialist", blurb:"Sliders and splits just off the plate, daring you to expand the zone." },
    { id:"physicalfront", label:"Overpowering Fastball, Late Life", blurb:"It rides up and gets on you late — he'll blow it right past a slow bat." },
    { id:"disciplinedzone", label:"Crafty Command Lefty", blurb:"Mixes everything, changes eye level, and never shows the same pattern twice." },
    { id:"suddenchange", label:"Bears Down With Runners On", blurb:"Coasts until there's a runner in scoring position, then finds another gear." },
  ];
  function pickOpponentTendency(){ return pick(OPPONENT_TENDENCIES); }

  // General reseeding bracket: pairs the highest remaining seed against the lowest remaining
  // seed each round (real NFL reseeding rules), for however many seeds/byes/wild-card games
  // this year's format calls for — so the exact same routine reproduces the 1970s' no-bye
  // four-team field, the odd 1978-89 shape, and the modern seven-seed bracket alike.
  // Playoff-specific offensive edge, added on top of the player's base effOverall for every
  // postseason game. Two inputs, both centered so a league-average team/player sees no change:
  //  - Team quality: weighted more than twice as heavily here (0.32) as the old flat 0.15 --
  //    a talented roster mattering MORE in January, when the margin for error shrinks and the
  //    opposing defense is playoff-caliber too, is the whole point of this being bigger than the
  //    regular-season figure.
  //  - Clutch: effOverall already folds Clutch in at a flat 10% (OVERALL_WEIGHTS.CLU), same as
  //    every other attribute, all season long -- it doesn't capture that Clutch specifically is
  //    the "plays well under playoff pressure" trait. This adds a second, playoff-only bump for
  //    it on top of that base weighting -- Clutch should matter more exactly when the stakes are
  //    highest, not just at a flat rate across 17 regular-season games and a Super Bowl alike.
  //    Balance Wave 3: the Key Moment mini-game used to ALSO gate on Clutch (whether the mini-game
  //    even triggered at all) -- moved to leverage-only triggering (KEY_MOMENT_BASE_TRIGGER_CHANCE
  //    x keyMomentScoreEligibility); Clutch's role there is now purely execution-variance once a
  //    moment fires (see triggerKeyMoment's resolve()), matching what it already does right here.
  // ----- Round 4: team quality now BLENDS with the QB's own grade instead of just nudging it -----
  // Previously team quality was a small additive edge on top of the QB's own effOverall (out to
  // roughly +-10 points at the extremes) -- meaning an elite individual QB's own grade dominated
  // game outcomes almost entirely, and could single-handedly carry a genuinely bad team (a 40s
  // team overall) to a great record and deep playoff runs against much stronger opposition almost
  // regardless of the roster around him. Real football doesn't work that way: the O-line,
  // receivers, and defense are -- in aggregate -- at least as load-bearing on whether a team
  // actually WINS as any one QB's individual talent, however great. blendOffenseWithTeam pulls
  // the offense's effective grade toward the TEAM's overall quality instead of just adding a
  // small edge on top of the QB's own number -- a QB whose personal grade diverges sharply from
  // his team's quality gets pulled hard toward that team's level in EITHER direction: a great QB
  // on a bad team is capped hard (though never erased -- he still meaningfully outperforms what
  // the team alone would do), and a mediocre QB on a stacked team gets propped up, but not fully.
  // QB_INFLUENCE is how much of the blend is still "the QB's own play" -- playoffs weight team
  // quality even MORE than the regular season (a thinner roster and shakier O-line show up hardest
  // when the margin for error disappears in January), matching the existing "team quality matters
  // more in January" principle this system already had via the old edge's bigger playoff coefficient.
  // This does NOT touch how the QB's own passing STATS (yards/TD/rating) are generated -- those
  // still come from effOverall vs. neutralOverall alone (see generateSeason/STAT_BLEND/
  // STAT_SENSITIVITY) -- only the win/loss engine's offensive grade input changes here.
  // One hitter is ~1/9 of a lineup and doesn't touch defense or pitching at all, so his personal
  // grade moves team wins far less than a quarterback's did (0.45/0.35). A superstar bat still
  // meaningfully lifts a team; a replacement-level one still drags a little -- but the roster
  // around him, and above all the pitching, decides the season. Retune via a seeded win-rate
  // sweep before changing (project norm), same as the QB values were.
  const QB_INFLUENCE_REGULAR = 0.12;
  const QB_INFLUENCE_PLAYOFF = 0.10;
  function blendOffenseWithTeam(effOverall, teamStrength, qbInfluence){
    return teamStrength + (effOverall-teamStrength)*qbInfluence;
  }
  // A "superteam" doesn't just coast on a high grade forever -- real contenders have to keep
  // paying, replacing, and re-signing to stay one, and that's constant downward pressure a plain
  // random walk never modeled. Every team above this line takes a small pull back toward it each
  // season (see generateSeason's team-strength block), scaled by how far above it they are, so a
  // 90-grade team decays faster than a 78-grade one. The player's own team faces the exact same
  // pull -- the one thing that can outrun it is the QB actually playing at an elite level himself
  // (the existing effOverall-vs-neutral nudge), which is the "team stays great because ITS QB is
  // legitimately elite" case asked for, instead of a dynasty just being free to sit at 95 forever.
  // Per-decade volatility multiplier for team-strength churn -- older, roster-continuity-heavy
  // eras (reserve-clause/pre-free-agency) turn over more slowly than the modern free-agency era.
  // Mirrors the existing ERA_ATTR_MULT.injury precedent (1.45x in the 1960s down to 0.85x in the
  // 2020s) for the same kind of era-scaled multiplier, applied to: the flat per-season noise term,
  // the decline/rebuild pull's RATE (not its threshold, which stays absolute), rollLeagueNews'
  // headline swings, and a rival's succession-nudge jump when a starter retires.
  const ERA_TEAM_VOLATILITY = {
    "1960s": 0.55, "1970s": 0.65, "1980s": 0.75, "1990s": 0.85,
    "2000s": 1.0, "2010s": 1.15, "2020s": 1.3,
  };
  const CONTENDER_DECLINE_THRESHOLD = 72;
  // Diagnostically tuned (see PROGRESS.md-style reasoning in commit notes): 0.05 was far too weak
  // against even a modest positive skill nudge -- ANY QB better than dead-average (even a merely
  // "good," non-elite one) rocketed straight to the 97 hard cap within 2-3 seasons and froze there
  // permanently, exactly the "superteam that never has to work for it" complaint this exists to
  // fix. At 0.22, a zero-nudge average QB's team genuinely bleeds out over a decade, a good QB's
  // team settles into real season-to-season texture in the mid-80s instead of pinning at the cap,
  // a truly elite QB's team plateaus around 90-93 (great, but still has to hold that level, not
  // just arrive at 97 and stop), and a bad team with an elite QB takes a believable ~decade to
  // build into a real contender rather than an instant jump.
  const CONTENDER_DECLINE_RATE = 0.32;
  function contenderDeclinePull(strength){
    return strength>CONTENDER_DECLINE_THRESHOLD ? (strength-CONTENDER_DECLINE_THRESHOLD)*CONTENDER_DECLINE_RATE : 0;
  }
  // The symmetric counterpart contenderDeclinePull never had: without this, nothing ever pulls a
  // bad team back toward the middle, and a 31-team/20-season pure-math sweep of the exact real
  // drift formula (team_parity_sweep.js) showed the predictable result -- ~48% of the league
  // pinned at the extremes (many literally stuck at the 20 floor) with almost nothing in a healthy
  // middle band. Deliberately mirrors CONTENDER_DECLINE_THRESHOLD/RATE exactly (45/0.22) for
  // symmetry -- the same sweep confirmed this pair drops the extreme share to ~3% and roughly
  // doubles the middle-band share, while still letting a team sit at an extreme for a while (a real
  // tank or a real early dynasty can still exist -- it just can't get stuck there permanently, the
  // same relationship the existing decline pull already has with a dynasty at the top end).
  const REBUILD_THRESHOLD = 48;
  const REBUILD_RATE = 0.32;
  function rebuildPull(strength){
    return strength<REBUILD_THRESHOLD ? (REBUILD_THRESHOLD-strength)*REBUILD_RATE : 0;
  }
  function regularSeasonOffenseGrade(effOverall, age, decade){
    const clu = eraEffective(age, decade).CLU;
    const clutchEdge = (clu-65)*0.03;
    const chemistryBonus = teamChemistryEdge()*0.04;
    return blendOffenseWithTeam(effOverall, career.teamStrength, QB_INFLUENCE_REGULAR) + clutchEdge + chemistryBonus;
  }
  function playoffOffenseGrade(effOverall, season){
    const age = season ? season.age : career.age;
    const decade = season ? season.decade : decadeForYear(career.year);
    const clu = eraEffective(age, decade).CLU;
    const clutchEdge = (clu-65)*0.09;
    const chemistryBonus = teamChemistryEdge()*0.04;
    return blendOffenseWithTeam(effOverall, career.teamStrength, QB_INFLUENCE_PLAYOFF) + clutchEdge + chemistryBonus;
  }

  // ----- Opponent side of the blend: every OTHER team already has its own persistent starting QB
  // (career.leagueRivals, one per team, generated at career start and simulated every season for
  // league-wide awards) -- it just never fed into the actual game-sim/win-calc before, so every
  // opponent was a single flat team-strength number with no equivalent "their QB is also great"
  // term. This is the direct fix for both "no grind even at 95 overall" (a genuinely elite rival
  // starter can now swing a game on his own, the same way the player's own QB does) and "let me
  // see the opposing QB's overall" (rivalEffTalent IS that displayed number).
  /* ================= Wave 2A (MASTER_REMEDIATION_SPEC.md): canonical QB registry =================
     career.qbsById / career.teamQbDepth / career.freeAgentQbIds / career.retiredQbIds are the
     spec's ID-based ownership model. The pre-existing career.leagueRivals / career.leagueDepthCharts
     / career.freeAgentPool arrays remain the actual backing store the rest of this file's deeply
     calibrated simulation math (simulateRivalSeasons, simulateDepthChartSeasons, standings,
     schedule building, succession, trade/waiver/FA UI, etc.) reads and mutates directly --
     rewriting those call sites' own math is Wave 2B's job, not this one. Every OWNERSHIP change (a
     QB joining a roster, entering free agency, retiring, or swapping depth-chart roles) instead
     goes through one of the 7 helpers below, which mutate the legacy structures in EXACTLY the
     shape they always held (zero behavior change for every pure-read call site elsewhere in this
     file) while keeping qbsById/teamQbDepth/freeAgentQbIds/retiredQbIds in sync as a same-reference
     index over those same objects -- never a second, independently-mutable copy (Section 3
     invariant #15). syncQbRegistryFromLegacy(careerObj) rebuilds that index from whatever the
     legacy structures currently hold; it is pure (no Math.random()) and safe to call on ANY shape
     (a pristine save, one a test mutated directly, or one with duplicate/orphaned entries left over
     from a pre-Wave-2A save) since it always derives the index fresh rather than trusting whatever
     was previously persisted. Called once by migrateSaveEnvelope on every load -- a save/reload
     round-trip deserializes every reference independently, so without an unconditional rebuild on
     load, qbsById's copies and the legacy arrays' copies would silently diverge into two different
     object instances sharing the same id the moment either was mutated post-reload. */
  const USER_QB_ID = "user";
  function _ensureQbRegistryFields(target){
    const c = target || career;
    if(!c.qbsById) c.qbsById = {};
    if(!c.teamQbDepth) c.teamQbDepth = {};
    if(!c.freeAgentQbIds) c.freeAgentQbIds = [];
    if(!c.retiredQbIds) c.retiredQbIds = [];
    return c;
  }
  // Pure, deterministic, no Math.random() -- migration requirement #9. Rebuilds qbsById/
  // teamQbDepth/freeAgentQbIds/retiredQbIds from whatever careerObj.leagueRivals/leagueDepthCharts/
  // freeAgentPool currently hold. Where an id was left dual-tracked by the pre-Wave-2A pattern
  // (enterFreeAgentPool used to set retired=true AND push into freeAgentPool at once, conflating
  // "free agent" with "retired" -- Section 4's named defect), free-agent status wins: a QB still
  // sitting in the free-agent pool is, by definition, not actually retired.
  function syncQbRegistryFromLegacy(careerObj){
    const c = _ensureQbRegistryFields(careerObj);
    c.qbsById = {}; c.teamQbDepth = {}; c.freeAgentQbIds = []; c.retiredQbIds = [];
    const _reservedQb1Teams = new Set();
    (c.leagueRivals||[]).forEach(r=>{
      if(!r || !r.id) return;
      c.qbsById[r.id] = r;
      if(r.retired){
        if(!c.retiredQbIds.includes(r.id)) c.retiredQbIds.push(r.id);
        return;
      }
      // Migration requirement #6: report and repair a duplicate active starter deterministically --
      // a corrupted/pre-Wave-2A save could have two rivals both claiming the same team's QB1 the
      // moment it's loaded. Whoever comes first in leagueRivals array order keeps the job; anyone
      // else claiming an already-reserved team is demoted to free agency instead (never left
      // dangling as "active" while owning no actual roster slot, which would itself violate
      // invariant #2 -- a QB occupies at most one of a roster slot, the free-agent pool, or
      // retired).
      if(_reservedQb1Teams.has(r.teamId)){
        r.retired = false; r.status = "free_agent"; r.rosterRole = null;
        r.exitReason = r.exitReason || "duplicate-starter-migration-repair";
        r.joblessSeasons = r.joblessSeasons || 0;
        if(!c.freeAgentQbIds.includes(r.id)) c.freeAgentQbIds.push(r.id);
        if(!c.freeAgentPool) c.freeAgentPool = [];
        if(!c.freeAgentPool.includes(r)) c.freeAgentPool.push(r);
        return;
      }
      _reservedQb1Teams.add(r.teamId);
      if(!c.teamQbDepth[r.teamId]) c.teamQbDepth[r.teamId] = { QB1:null, QB2:null, QB3:null };
      c.teamQbDepth[r.teamId].QB1 = r.id;
      r.rosterRole = "QB1"; r.status = "active"; r.currentTeamId = r.teamId;
    });
    Object.keys(c.leagueDepthCharts||{}).forEach(teamId=>{
      const chart = c.leagueDepthCharts[teamId];
      if(!chart) return;
      if(!c.teamQbDepth[teamId]) c.teamQbDepth[teamId] = { QB1:null, QB2:null, QB3:null };
      [["qb2","QB2"],["qb3","QB3"]].forEach(([slot,role])=>{
        const p = chart[slot];
        if(!p || !p.id) return;
        c.qbsById[p.id] = p;
        if(!p.retired){
          c.teamQbDepth[teamId][role] = p.id;
          p.rosterRole = role; p.status = "active"; p.currentTeamId = teamId; p.teamId = teamId;
        }
      });
    });
    (c.freeAgentPool||[]).forEach(p=>{
      if(!p || !p.id) return;
      c.qbsById[p.id] = p;
      // Free-agent-pool membership wins over a stale/corrupted roster slot too -- a save produced
      // before this wave (or hand-corrupted by a test) could have the same id sitting in BOTH a
      // team's depth chart AND the pool at once; clearing every roster slot he's found in here is
      // the "duplicate reference resolved deterministically" migration requirement (Section 6 #3).
      Object.keys(c.teamQbDepth).forEach(teamId=>{
        const slots = c.teamQbDepth[teamId];
        ["QB1","QB2","QB3"].forEach(role=>{ if(slots[role]===p.id) slots[role] = null; });
      });
      p.retired = false; p.status = "free_agent"; p.rosterRole = null;
      if(!c.freeAgentQbIds.includes(p.id)) c.freeAgentQbIds.push(p.id);
    });
    // Free-agent status (just set above, if applicable) always wins over a stale retired=true from
    // the old conflated flag -- see the function comment.
    c.retiredQbIds = c.retiredQbIds.filter(id=>!c.freeAgentQbIds.includes(id));
    return c;
  }
  // A live, computed-on-demand view of the user's own QB -- deliberately never a stored qbsById
  // entry with its own copy of name/age/totals, which would be exactly the "same entity duplicated
  // across multiple mutable collections" Section 3 invariant #15 warns against (career/build are
  // already the one real, mutable source for the user's own identity and stats). Lets
  // getTeamQuarterbacks()/getQuarterbackById() answer "who is this team's QB1" / "who is this id"
  // uniformly for the user's own team without a second, driftable copy of the user's data.
  function userQuarterbackView(){
    if(!career) return null;
    return {
      id: USER_QB_ID, isUser: true, name: career.name, teamId: career.teamId, currentTeamId: career.teamId,
      rosterRole: career.isBackup ? "QB2" : "QB1", age: career.age, retireAge: null, retired: false,
      status: "active", talent: null, seasons: career.seasonLog, totals: career.totals,
      contract: career.contract, exitReason: null,
    };
  }
  // Registers (or re-registers) a QB in the canonical index. Does not assign a roster role --
  // callers that already know where the QB belongs call assignQuarterbackToRoster right after.
  function registerQuarterback(qb){
    if(!qb || !qb.id) return qb;
    _ensureQbRegistryFields();
    career.qbsById[qb.id] = qb;
    if(qb.status==null) qb.status = qb.retired ? "retired" : "active";
    if(qb.currentTeamId===undefined) qb.currentTeamId = qb.teamId ?? null;
    if(qb.rosterRole===undefined) qb.rosterRole = null;
    return qb;
  }
  function _clearQbFromAllRosterSlots(qbId){
    _ensureQbRegistryFields();
    Object.keys(career.teamQbDepth).forEach(teamId=>{
      const slots = career.teamQbDepth[teamId];
      ["QB1","QB2","QB3"].forEach(role=>{ if(slots[role]===qbId) slots[role] = null; });
    });
    career.freeAgentQbIds = career.freeAgentQbIds.filter(id=>id!==qbId);
    career.freeAgentPool = (career.freeAgentPool||[]).filter(p=>p.id!==qbId);
    career.retiredQbIds = career.retiredQbIds.filter(id=>id!==qbId);
    // A QB1 lives in the legacy career.leagueRivals array (see assignQuarterbackToRoster's own
    // "QB1" branch below) -- clearing only teamQbDepth above would leave him dual-tracked (still in
    // leagueRivals from his OLD role, ALSO now in a depth-chart slot from his NEW one) the moment
    // he's moved from QB1 to a bench slot or free agency, which is exactly the "same entity
    // duplicated across multiple collections" Section 3 invariant #15 warns against. Also clear any
    // STALE qb2/qb3 slot on a depth chart he used to occupy, for the same reason.
    if(career.leagueRivals) career.leagueRivals = career.leagueRivals.filter(r=>r.id!==qbId);
    Object.keys(career.leagueDepthCharts||{}).forEach(teamId=>{
      const chart = career.leagueDepthCharts[teamId];
      if(!chart) return;
      if(chart.qb2 && chart.qb2.id===qbId) chart.qb2 = null;
      if(chart.qb3 && chart.qb3.id===qbId) chart.qb3 = null;
    });
  }
  // The ONE place a QB ever occupies a roster slot -- removes them from wherever they were first
  // (any team's QB1/QB2/QB3, the free-agent pool, or retired status), then assigns the new slot,
  // mirroring the assignment into the legacy leagueRivals/leagueDepthCharts arrays in the exact
  // shape every existing read call site already expects.
  function assignQuarterbackToRoster(qbId, teamId, role){
    _ensureQbRegistryFields();
    const qb = career.qbsById[qbId];
    if(!qb || !teamId || !role) return null;
    _clearQbFromAllRosterSlots(qbId);
    if(!career.teamQbDepth[teamId]) career.teamQbDepth[teamId] = { QB1:null, QB2:null, QB3:null };
    career.teamQbDepth[teamId][role] = qbId;
    qb.teamId = teamId; qb.currentTeamId = teamId; qb.rosterRole = role;
    qb.retired = false; qb.status = "active"; qb.exitReason = null;
    if(role==="QB1"){
      if(!career.leagueRivals) career.leagueRivals = [];
      if(!career.leagueRivals.includes(qb)) career.leagueRivals.push(qb);
    } else {
      if(!career.leagueDepthCharts) career.leagueDepthCharts = {};
      if(!career.leagueDepthCharts[teamId]) career.leagueDepthCharts[teamId] = { qb2:null, qb3:null };
      career.leagueDepthCharts[teamId][role==="QB2"?"qb2":"qb3"] = qb;
    }
    return qb;
  }
  // Free agency is NOT retirement (Section 4's named defect: the pre-Wave-2A enterFreeAgentPool set
  // retired=true for a free agent too) -- a free-agent QB keeps retired=false and gets a distinct
  // status instead, so any future "is this QB currently retired" check can't be fooled by someone
  // who's merely between jobs.
  function moveQuarterbackToFreeAgency(qbId, reason){
    _ensureQbRegistryFields();
    const qb = career.qbsById[qbId];
    if(!qb) return null;
    _clearQbFromAllRosterSlots(qbId);
    qb.rosterRole = null; qb.retired = false; qb.status = "free_agent";
    qb.exitReason = reason || qb.exitReason || "free_agent";
    qb.joblessSeasons = qb.joblessSeasons || 0;
    if(!career.freeAgentQbIds.includes(qbId)) career.freeAgentQbIds.push(qbId);
    if(!career.freeAgentPool) career.freeAgentPool = [];
    if(!career.freeAgentPool.includes(qb)) career.freeAgentPool.push(qb);
    return qb;
  }
  function retireQuarterback(qbId, reason){
    _ensureQbRegistryFields();
    const qb = career.qbsById[qbId];
    if(!qb) return null;
    _clearQbFromAllRosterSlots(qbId);
    qb.rosterRole = null; qb.retired = true; qb.status = "retired";
    qb.exitReason = reason || qb.exitReason || "retired";
    if(!career.retiredQbIds.includes(qbId)) career.retiredQbIds.push(qbId);
    return qb;
  }
  // Not yet called by any live game system this wave (nothing in the current codebase reorders an
  // existing QB2/QB3 without also regenerating one of them) -- added because the spec names it as
  // one of the 7 sole ownership-mutating helpers, and Wave 2B's starter-selection work is expected
  // to need it for reordering a depth chart without manufacturing a new player.
  function swapDepthRoles(teamId, roleA, roleB){
    _ensureQbRegistryFields();
    const slots = career.teamQbDepth[teamId];
    if(!slots) return;
    const aId = slots[roleA] || null, bId = slots[roleB] || null;
    slots[roleA] = bId; slots[roleB] = aId;
    if(aId && career.qbsById[aId]) career.qbsById[aId].rosterRole = roleB;
    if(bId && career.qbsById[bId]) career.qbsById[bId].rosterRole = roleA;
    const chart = career.leagueDepthCharts && career.leagueDepthCharts[teamId];
    const legacySlot = r => r==="QB2" ? "qb2" : r==="QB3" ? "qb3" : null;
    const sa = legacySlot(roleA), sb = legacySlot(roleB);
    if(chart && sa && sb){ const tmp = chart[sa]; chart[sa] = chart[sb]; chart[sb] = tmp; }
  }
  function getTeamQuarterbacks(teamId){
    _ensureQbRegistryFields();
    const slots = career.teamQbDepth[teamId] || { QB1:null, QB2:null, QB3:null };
    const result = {
      QB1: slots.QB1 ? career.qbsById[slots.QB1] : null,
      QB2: slots.QB2 ? career.qbsById[slots.QB2] : null,
      QB3: slots.QB3 ? career.qbsById[slots.QB3] : null,
    };
    // The user's own team is never tracked in teamQbDepth (career/build ARE the user's own QB
    // record) -- when the user is the active, non-backup starter at their own team, QB1 there is
    // the user, not a registry entry.
    if(career.teamId===teamId && !career.isBackup && !result.QB1) result.QB1 = userQuarterbackView();
    return result;
  }
  function getQuarterbackById(qbId){
    if(!qbId) return null;
    if(qbId===USER_QB_ID) return userQuarterbackView();
    _ensureQbRegistryFields();
    return career.qbsById[qbId] || null;
  }
  // Development-only invariant checker (Section 3). Exposed to Playwright via a single narrow,
  // read-only global (see the __glValidateLeagueState assignment in the Init block) rather than any
  // broader admin/debug surface -- it takes no state, mutates nothing, and returns only a plain
  // array of violation descriptions, so it cannot be used to alter or cheat a real player's career
  // even if found in devtools.
  function validateLeagueState(careerObj, year){
    const issues = [];
    if(!careerObj) return issues;
    const qbsById = careerObj.qbsById || {};
    const teamQbDepth = careerObj.teamQbDepth || {};
    const freeAgentQbIds = careerObj.freeAgentQbIds || [];
    const retiredQbIds = careerObj.retiredQbIds || [];
    const seenSlots = new Map();
    const qb1Owners = new Map();
    Object.keys(teamQbDepth).forEach(teamId=>{
      const slots = teamQbDepth[teamId];
      ["QB1","QB2","QB3"].forEach(role=>{
        const qbId = slots[role];
        if(!qbId) return;
        if(seenSlots.has(qbId)) issues.push({ type:"duplicate-roster-slot", qbId, year, teamId, role, otherLocation: seenSlots.get(qbId) });
        seenSlots.set(qbId, `${teamId}:${role}`);
        if(!qbsById[qbId] && qbId!==USER_QB_ID) issues.push({ type:"roster-slot-unregistered-qb", qbId, year, teamId, role });
        if(freeAgentQbIds.includes(qbId)) issues.push({ type:"rostered-and-free-agent", qbId, year, teamId, role });
        if(retiredQbIds.includes(qbId)) issues.push({ type:"rostered-and-retired", qbId, year, teamId, role });
      });
      const qb1 = slots.QB1;
      if(qb1){
        if(qb1Owners.has(qb1)) issues.push({ type:"duplicate-qb1", qbId:qb1, year, teams:[qb1Owners.get(qb1), teamId] });
        qb1Owners.set(qb1, teamId);
      }
    });
    freeAgentQbIds.forEach(id=>{
      if(retiredQbIds.includes(id)) issues.push({ type:"free-agent-and-retired", qbId:id, year });
      if(!qbsById[id]) issues.push({ type:"free-agent-unregistered", qbId:id, year });
    });
    retiredQbIds.forEach(id=>{ if(!qbsById[id]) issues.push({ type:"retired-unregistered", qbId:id, year }); });
    return issues;
  }

  function rivalForTeam(teamId){
    const slots = career.teamQbDepth && career.teamQbDepth[teamId];
    if(!slots || !slots.QB1) return null;
    return (career.qbsById && career.qbsById[slots.QB1]) || null;
  }
  // Unlike a plain teamQbDepth lookup, this also finds RETIRED/free-agent QBs -- a profile card
  // opened from an old season's schedule/playoff log should still resolve to that season's actual
  // starter, not whoever currently holds the job (or nothing at all, if he's since moved on).
  function findRivalById(id){
    if(!id) return null;
    return getQuarterbackById(id);
  }
  // Age-adjusted the same way a rival's own season stats already are (ageMult in
  // simulateRivalSeasons) -- an aging rival starter shouldn't blend in at his career-peak talent.
  function rivalEffTalent(rival){
    return clamp(Math.round(65 + (rival.talent-65)*primeMultiplier(rival.age)), 20, 99);
  }

  /* ----- Rivalry growth: a per-rival "how personal is this" score, keyed by the individual rival's
     own id (NOT the team) -- a rivalry is between two PEOPLE, so when a team's starter retires and
     is succeeded, that specific personal rivalry naturally stops accumulating and a new one starts
     fresh with whoever replaces him, exactly like a real division rivalry resets when a franchise
     QB retires. career.rivalries = { [rivalId]: {score:0-100, meetings, playoffMeetings, lastYear} }.
     bumpRivalry() is the only writer, called from every site that actually resolves a game against
     a specific opponent (simulateRegularSeasonGames, and the 3 playoff win-calc sites). Score decays
     for nobody -- a one-off cross-conference game only ever adds +1 and the schedule rotation means
     it rarely repeats, so scores stay low there on their own without needing explicit decay. */
  function ensureRivalryRecord(rivalId){
    if(!career.rivalries) career.rivalries = {};
    if(!career.rivalries[rivalId]) career.rivalries[rivalId] = { score:0, meetings:0, playoffMeetings:0, lastYear:null };
    return career.rivalries[rivalId];
  }
  function bumpRivalry(rival, { playoff=false, divisionRival=false, won=true, close=false }={}){
    if(!rival) return;
    const rec = ensureRivalryRecord(rival.id);
    let inc = playoff ? 14 : (divisionRival ? 3 : 1);
    if(rival.isRival) inc += 2; // draft classmate -- shared history from day one
    if(close) inc += 3;
    if(!won) inc += 2; // losing to the same guy stings more than beating him
    rec.score = clamp(rec.score + inc, 0, 100);
    rec.meetings++;
    if(playoff) rec.playoffMeetings++;
    rec.lastYear = career.year;
  }
  // The single most-developed CURRENTLY ACTIVE rivalry (the associated rival hasn't retired/been
  // succeeded) -- used to pick who a rivalry-flavor event is actually about. A high-score rivalry
  // whose rival has since retired is treated as over: no new rival, no new candidate.
  function topActiveRivalry(minScore){
    const candidates = Object.entries(career.rivalries||{})
      .filter(([id,rec])=> rec.score>=minScore)
      .map(([id,rec])=>({ rival: findRivalById(id), rec }))
      .filter(x=> x.rival && !x.rival.retired);
    if(!candidates.length) return null;
    candidates.sort((a,b)=> b.rec.score-a.rec.score);
    return candidates[0];
  }
  function opponentOffenseGrade(teamId, qbInfluence){
    const teamStrength = teamId===career.teamId ? career.teamStrength : (career.leagueStrength[teamId] ?? 60);
    const rival = rivalForTeam(teamId);
    if(!rival) return teamStrength;
    return blendOffenseWithTeam(rivalEffTalent(rival), teamStrength, qbInfluence);
  }
  // Wave 7 (MASTER_REMEDIATION_SPEC.md): the opponent's REAL persistent defense grade -- what MY
  // offense should actually be resisted by. Before this wave, every call to simulateGameScore fed
  // opponentOffenseGrade (the OPPONENT'S OFFENSE) into the parameter used as MY resistance, the
  // confirmed "conflates an opponent's offense with the grade used as its defensive resistance"
  // defect -- Wave 5's persistent per-team defense grades (career.leagueTeamGrades[id].defense)
  // existed by then purely for display, "no game system ever needs to know another team's oline
  // grade to resolve anything" (see that wave's own PROGRESS.md note) -- this is where that changes.
  function opponentDefenseGrade(teamId){
    if(teamId===career.teamId) return career.defense;
    ensureLeagueTeamGrades(career.year);
    const g = career.leagueTeamGrades[teamId];
    return g ? g.defense : (career.leagueStrength[teamId] ?? 60);
  }
  // ----- Rival QB profile: a clickable "character page" for any opposing starter, everywhere one
  // is shown by name (Schedule tab, playoff round boxes, League tab standings). Facts are all
  // derived from data the rival already carries -- no separate hand-authored joke pool to keep in
  // sync -- except one genuine easter egg: rivals are named via the same randomFullName() the
  // player's own prospects use, which has its own small chance of landing on one of the Key &
  // Peele draft-name gags (EASTER_EGG_NAMES), and that's worth calling out when it happens.
  function rivalCareerFunFacts(rival){
    const facts = [];
    const seasonsPlayed = rival.seasons.length;
    if(rival.isRival) facts.push(`Drafted the exact same year as you (${rival.draftYear}) — a true draft classmate.`);
    if(EASTER_EGG_NAMES.includes(rival.name)) facts.push(`Yes, that's really his name.`);
    if(seasonsPlayed){
      const best = rival.seasons.reduce((a,b)=> b.rating>a.rating ? b : a, rival.seasons[0]);
      facts.push(`Best season: ${best.year} — ${best.yards.toLocaleString()} yards, ${best.td} TD, a ${best.rating.toFixed(1)} rating.`);
    }
    if(rival.totals.rings>0) facts.push(`${rival.totals.rings}-time Super Bowl champion.`);
    if(rival.totals.mvps>0) facts.push(`${rival.totals.mvps}-time MVP.`);
    if(rival.totals.allPros>0) facts.push(`${rival.totals.allPros}-time All-Pro.`);
    if(rival.totals.proBowls>0) facts.push(`${rival.totals.proBowls}-time Pro Bowler.`);
    else if(seasonsPlayed>=4) facts.push(`Still hasn't made a Pro Bowl despite ${seasonsPlayed} seasons as a starter.`);
    if(rival.succeededId) facts.push(`Took over the starting job after his predecessor retired.`);
    if(rival.retired){
      const lastYear = seasonsPlayed ? rival.seasons[seasonsPlayed-1].year : rival.draftYear;
      facts.push(`Retired after the ${lastYear} season.`);
    } else {
      facts.push(`Entering year ${seasonsPlayed+1} of his career at age ${rival.age}.`);
    }
    return facts;
  }
  function rivalryLevelLabel(score){
    if(score>=75) return "Blood Feud";
    if(score>=50) return "Heated Rivalry";
    if(score>=25) return "Developing Rivalry";
    if(score>0) return "Building";
    return "No History Yet";
  }
  function buildRivalProfileHTML(rival){
    const t = rival.totals;
    const rating = passerRating(t.comp, t.att, t.yards, t.td, t.int);
    const overall = rivalEffTalent(rival);
    const g = gradeFor(clamp(overall, 0, 98));
    const totalGames = t.wins+t.losses+(t.ties||0);
    const winPct = totalGames>0 ? ((t.wins+0.5*(t.ties||0))/totalGames*100).toFixed(1) : "0.0";
    const badges = [
      t.mvps ? `<span class="badge gold">${t.mvps}x MVP</span>` : "",
      t.allPros ? `<span class="badge good">${t.allPros}x All-Pro</span>` : "",
      t.proBowls ? `<span class="badge good">${t.proBowls}x Pro Bowl</span>` : "",
    ].join("");
    const facts = rivalCareerFunFacts(rival);
    const rec = (career.rivalries||{})[rival.id];
    const rivalryHtml = rec ? fanMeterRow("Rivalry", rec.score,
      `${rivalryLevelLabel(rec.score)} — ${rec.meetings} meeting${rec.meetings===1?"":"s"}${rec.playoffMeetings?`, ${rec.playoffMeetings} in the playoffs`:""}.`) : "";
    const contractLine = (!rival.retired && rival.contract) ? `<div class="rival-meta">Contract: <b>${fmtMoney(rival.contract.apy)}</b>/yr · ${rival.contract.years} year${rival.contract.years===1?"":"s"} left · ${svgEscape(rival.contract.tier)}${rival.entrenchedYears>0?"":" · expiring"}</div>` : "";
    // Wave 3 (MASTER_REMEDIATION_SPEC.md, exit criterion: "AI injury/suspension status is visible
    // on the player profile..."): rival.availability is a single-season-scoped snapshot (see
    // simulatePlayerSeasonStats) of why he missed time THIS season, if he did -- distinct reason/
    // label, not an anonymous missed-games count.
    const availabilityLine = (!rival.retired && rival.availability) ? `<div class="rival-meta">${rival.availability.reason==="suspension"?"Suspended":"Injured"} (${rival.availability.year}): <b>${svgEscape(rival.availability.label)}</b> — missed ${rival.availability.gamesMissed} game${rival.availability.gamesMissed===1?"":"s"}</div>` : "";
    // Round 32 item 4: the depth chart moved OFF a QB's own profile (it's team-organizational
    // info, not something about this specific person) and onto the team page instead (see
    // buildTeamPageHTML/openTeamProfile, reachable from teamNameAt links) -- a QB's own profile now
    // shows what a player profile should: his own season-by-season stat line and awards.
    const seasonsRows = (rival.seasons||[]).slice().reverse().map(s=>`
        <tr><td>${s.year}</td><td>${s.age}</td><td class="tabular">${s.comp}/${s.att}</td>
        <td class="tabular">${s.yards.toLocaleString()}</td><td class="tabular">${s.td}</td><td class="tabular">${s.int}</td>
        <td class="tabular">${s.rating.toFixed(1)}</td><td class="tabular">${recordLine(s.wins, s.losses, s.ties||0)}</td>
        <td>${(s.awards||[]).join(", ")||"—"}</td></tr>`).join("");
    const seasonsTableHtml = seasonsRows ? `<div class="table-wrap" style="margin-top:0.8rem;">
        <table class="career-table">
          <thead><tr><th>Year</th><th>Age</th><th>Comp/Att</th><th>Yards</th><th>TD</th><th>INT</th><th>Rating</th><th>Record</th><th>Awards</th></tr></thead>
          <tbody>${seasonsRows}</tbody>
        </table>
      </div>` : "";
    return `
      <div class="rival-card">
        <div class="rival-eyebrow"><button type="button" class="rival-link" data-team-id="${rival.teamId}">${svgEscape(teamNameAt(rival.teamId, career.year))}</button>${rival.retired?" · Retired":""}</div>
        <h3 id="rivalProfileHeading">${svgEscape(rival.name)}</h3>
        <div class="rival-meta">Age ${rival.age} · Drafted ${rival.draftYear} · Overall <b>${overall}</b> (${svgEscape(g.flavor)})</div>
        ${contractLine}
        ${availabilityLine}
        <div class="rival-stats-grid">
          <div><div class="rv-label">Career Yards</div><div class="rv-value tabular">${t.yards.toLocaleString()}</div></div>
          <div><div class="rv-label">Touchdowns</div><div class="rv-value tabular">${t.td}</div></div>
          <div><div class="rv-label">Interceptions</div><div class="rv-value tabular">${t.int}</div></div>
          <div><div class="rv-label">Rating</div><div class="rv-value tabular">${rating.toFixed(1)}</div></div>
          <div><div class="rv-label">Record</div><div class="rv-value tabular">${recordLine(t.wins, t.losses, t.ties||0)}${totalGames?` (${winPct}%)`:""}</div></div>
          <div><div class="rv-label">Games</div><div class="rv-value tabular">${t.games}</div></div>
        </div>
        ${badges ? `<div class="rival-badges">${badges}</div>` : ""}
        ${rivalryHtml}
        <div class="rival-facts">
          <div class="rival-facts-label">Fun Facts</div>
          <ul>${facts.map(f=>`<li>${svgEscape(f)}</li>`).join("")}</ul>
        </div>
        ${seasonsTableHtml}
        <button type="button" class="btn btn-ghost rival-close">Close</button>
      </div>`;
  }
  function openRivalProfile(rivalId){
    // A League-tab row can now be a bench player (see computeSeasonAwardRows) -- their id is
    // "bqb_..." and they live in career.leagueDepthCharts, not career.leagueRivals, so fall back
    // to findDepthChartPlayerById. Both share the exact same object shape (generateBenchPlayer
    // mirrors the rival object literal), so buildRivalProfileHTML needs no changes either way.
    const rival = findRivalById(rivalId) || findDepthChartPlayerById(rivalId);
    const overlay = document.getElementById("rivalProfileOverlay");
    if(!rival || !overlay) return;
    overlay.innerHTML = buildRivalProfileHTML(rival);
    const closeBtn = overlay.querySelector(".rival-close");
    if(closeBtn) closeBtn.addEventListener("click", closeRivalProfile);
    // The team-name eyebrow link lives inside THIS overlay, which is a sibling of #careerContent
    // (not a descendant of it) -- the shared #careerContent delegated click listener never sees a
    // click here, so it needs its own explicit wiring, same as the close button above.
    const teamLink = overlay.querySelector("[data-team-id]");
    if(teamLink) teamLink.addEventListener("click", ()=>{ closeRivalProfile(); openTeamProfile(teamLink.dataset.teamId); });
    openDialog(overlay, { labelledBy: "rivalProfileHeading" });
  }
  // Round 32 item 4: a generic page for ANY team in the league (not just the player's own, which
  // keeps its own richer, dedicated Team tab -- buildTeamTabHTML, unchanged -- since career.defense/
  // coaching/gmGrade/oline/weapons only ever exist for whichever team the player currently belongs
  // to, never for an arbitrary other team). This is where the depth chart moved OFF a QB's own
  // profile TO -- team-organizational info belongs on the team, not the person.
  // Wave 5 (task #6): one QB1/QB2/QB3 row, clickable to that QB's own profile where one exists,
  // showing overall/age/contract/role/availability -- reads getTeamQuarterbacks (the same live,
  // canonical registry lookup the rest of the app uses), never the older, less-current
  // leagueDepthCharts snapshot, so this can never show a QB who's already been traded/released/
  // retired since that snapshot was taken.
  function teamPageQbRowHTML(qbEntry, slotLabel){
    if(!qbEntry) return `<div><div class="rv-label">${svgEscape(slotLabel)}</div><div class="rv-value">—</div></div>`;
    const isUserEntry = !!qbEntry.isUser;
    const overall = isUserEntry ? Math.round(computeEffOverall(career.age, decadeForYear(career.year))) : rivalEffTalent(qbEntry);
    const bits = [`${overall} ovr`];
    if(qbEntry.age!=null) bits.push(`age ${qbEntry.age}`);
    if(qbEntry.contract) bits.push(`${svgEscape(qbEntry.contract.tier||"")}, ${qbEntry.contract.years||0} yr${qbEntry.contract.years===1?"":"s"}`);
    const availBit = qbEntry.availability ? ` (<b>${svgEscape(qbEntry.availability.label || qbEntry.availability.reason || "Unavailable")}</b>)` : "";
    const nameHtml = isUserEntry
      ? `${svgEscape(qbEntry.name)} (you)`
      : `<button type="button" class="rival-link" data-rival-id="${qbEntry.id}">${svgEscape(qbEntry.name)}</button>`;
    return `<div><div class="rv-label">${svgEscape(slotLabel)}</div><div class="rv-value">${nameHtml} (${bits.join(", ")})${availBit}</div></div>`;
  }
  function buildTeamPageHTML(teamId, faRoleLabel){
    const year = career.year;
    const div = divisionOf(teamId, year);
    const name = teamNameAt(teamId, year);
    const isMine = teamId===career.teamId;
    // Wave 5 (task #1): defensive, idempotent -- guarantees this team already has a persistent
    // five-grade profile before this page reads it, regardless of whether resolvePlayoffs has
    // already run this season for it yet (a fresh save, or a just-joined expansion team).
    ensureLeagueTeamGrades(year);
    const overall = Math.round(isMine ? career.teamStrength : (career.leagueStrength[teamId] ?? 60));
    const g = gradeFor(clamp(overall, 0, 98));
    // Wave 5 (task #6): league rank for the overall number and (via buildGradeCardsHtml) each of
    // the five components below it.
    const ranks = computeTeamGradeRanks(year);
    const overallRankHtml = ranks.overall[teamId] ? ` — #${ranks.overall[teamId]} of ${ranks.total}` : "";
    const qbs = getTeamQuarterbacks(teamId);
    const schemeId = career.teamScheme ? career.teamScheme[teamId] : null;
    const scheme = SCHEMES.find(s=>s.id===schemeId);
    // Wave 5 (task #6): the scheme's ACTUAL mechanical effects, not just its name -- schemeAttrRows
    // is the exact same per-attribute readout the Scheme tab already shows, reused directly so this
    // page can never contradict what schemeEffective() is actually doing to stat production.
    const schemeHtml = scheme ? `<div class="rival-meta">Scheme: <b>${svgEscape(scheme.name)}</b></div>
        <p class="calc-refnote" style="margin-top:0.2rem;">${svgEscape(scheme.blurb)}</p>
        <div class="table-wrap"><table class="career-table"><thead><tr><th>Attribute</th><th class="tabular">Effect</th><th>Fit</th></tr></thead>
          <tbody>${schemeAttrRows(schemeId)}</tbody></table></div>` : "";
    // Round 33 item 5: only shown when this page was opened from a real Free Agency offer for THIS
    // team (faRoleLabel is that offer's own already-computed role string -- reused directly rather
    // than re-deriving a second, potentially-contradictory depth-chart-position estimate).
    const faRoleHtml = faRoleLabel ? `<div class="calc-refnote" style="margin-top:0.4rem;">If you sign here: <b>${svgEscape(faRoleLabel)}</b></div>` : "";
    // Round 33 QOL: the full five-grade breakdown, real for the player's own team, from
    // leagueTeamGrades (ensureLeagueTeamGrades) for anyone else -- see buildGradeCardsHtml. Both
    // surfaces (this page and the player's own Team tab) share this exact same renderer (task #7).
    const teamGrades = isMine
      ? { oline: career.oline, weapons: career.weapons, defense: career.defense, coaching: career.coaching, gmGrade: career.gmGrade }
      : (career.leagueTeamGrades && career.leagueTeamGrades[teamId]);
    const gradeCardsHtml = teamGrades ? `<div class="team-grade-grid" style="margin-top:0.8rem;">${buildGradeCardsHtml(teamGrades, { ranks, teamId })}</div>` : "";
    // Round 33 item 5: a real, permanent past-seasons record (see recordTeamSeasonHistory) --
    // starts accumulating only from whenever this feature first ran for this team, same limitation
    // Trophy Room/Achievements both already have for pre-existing careers.
    const hist = (career.teamSeasonHistory && career.teamSeasonHistory[teamId]) || [];
    const histRows = hist.slice().reverse().map(h=>{
      // Wave 5 (task #8): "Champions" now shows up here the moment the Super Bowl winner's own row
      // is patched (markChampionInHistory), listed first since it's the biggest title of the three.
      const titles = [h.wonChampionship?"Champions":"", h.wonConference?"Conf. Champs":"", h.wonDivision?"Div. Champs":""].filter(Boolean).join(", ");
      return `<tr><td>${h.year}</td><td>${h.qbName?svgEscape(h.qbName):"—"}</td><td class="tabular">${h.qbRings}</td>
          <td class="tabular">${recordLine(h.wins, h.losses, h.ties||0)}</td><td>${titles||"—"}</td><td>${h.scheme?svgEscape(h.scheme):"—"}</td></tr>`;
    }).join("");
    const histHtml = histRows ? `<div class="section-label" style="margin-top:1rem;">Past Seasons</div>
        <div class="table-wrap"><table class="career-table">
          <thead><tr><th>Year</th><th>QB</th><th class="tabular">QB Rings</th><th class="tabular">Record</th><th>Titles</th><th>Scheme</th></tr></thead>
          <tbody>${histRows}</tbody>
        </table></div>` : "";
    const viewFullTeamTabHtml = isMine
      ? `<button type="button" class="btn btn-ghost" id="teamProfileGotoTab">View full Team tab →</button>` : "";
    return `
      <div class="rival-card">
        <div class="rival-eyebrow">${confLabel(div.conf, year)} ${svgEscape(div.name)}</div>
        <h3 id="teamProfileHeading">${svgEscape(name)}${isMine?" (your team)":""}</h3>
        <div class="rival-meta">Team Grade <b>${overall}</b> (${svgEscape(g.flavor)})${overallRankHtml}</div>
        ${schemeHtml}
        <div class="rival-stats-grid">
          ${teamPageQbRowHTML(qbs.QB1, "QB1 (Starter)")}
          ${teamPageQbRowHTML(qbs.QB2, "QB2")}
          ${teamPageQbRowHTML(qbs.QB3, "QB3")}
        </div>
        ${faRoleHtml}
        ${gradeCardsHtml}
        ${histHtml}
        ${viewFullTeamTabHtml}
        <button type="button" class="btn btn-ghost rival-close">Close</button>
      </div>`;
  }
  function openTeamProfile(teamId, faRoleLabel){
    const overlay = document.getElementById("teamProfileOverlay");
    if(!teamId || !overlay) return;
    overlay.innerHTML = buildTeamPageHTML(teamId, faRoleLabel);
    const closeBtn = overlay.querySelector(".rival-close");
    if(closeBtn) closeBtn.addEventListener("click", closeTeamProfile);
    const gotoBtn = overlay.querySelector("#teamProfileGotoTab");
    if(gotoBtn) gotoBtn.addEventListener("click", ()=>{ closeTeamProfile(); switchDashTab("team"); });
    // Same reasoning as openRivalProfile's own team-link wiring: this overlay is a sibling of
    // #careerContent, so every QB row's [data-rival-id] link needs explicit wiring here too.
    // Wave 5: QB2/QB3 are now clickable links alongside QB1, so this wires ALL of them, not just
    // the first match.
    overlay.querySelectorAll("[data-rival-id]").forEach(qbLink=>{
      qbLink.addEventListener("click", ()=>{ closeTeamProfile(); openRivalProfile(qbLink.dataset.rivalId); });
    });
    openDialog(overlay, { labelledBy: "teamProfileHeading" });
  }
  function closeTeamProfile(){
    const overlay = document.getElementById("teamProfileOverlay");
    if(!overlay) return;
    closeDialog(overlay);
    overlay.innerHTML = "";
  }
  function closeRivalProfile(){
    const overlay = document.getElementById("rivalProfileOverlay");
    if(!overlay) return;
    closeDialog(overlay);
    overlay.innerHTML = "";
  }

  // Converts a just-STEPPED (not yet confirmed) conference round's matches into the shared,
  // render-ready {aSeed,aId,aScore,bSeed,bId,bScore,winnerId} shape -- for a real ("isMine") match
  // this reads the round object AFTER any Key Moment swing (nodeMatchFromRealRound, defined further
  // down, reads the live final values off the same object reference), for a flat match it's already
  // in that shape (see stepConferenceBracket's simulateMatch).
  function pendingMatchesToRenderable(pendingMatches){
    return (pendingMatches||[]).map(m=> m.isMine ? nodeMatchFromRealRound(m.round) : m);
  }
  // Confirms one already-stepped round (state._pendingMatches) as final, records it into the given
  // history array using the FINAL (post-Key-Moment, for a real match) values, and advances state.field.
  // This -- not a separate eager full-bracket resolution -- is the ONE place either conference's
  // round-by-round display record gets written, so there is never a second, independently-rolled
  // copy of the same round to disagree with (see the Round 32 PROGRESS.md entry for the bug this
  // replaces: two disconnected resolutions of "who wins which playoff game").
  function confirmAndRecordRound(state, historyArr){
    const pending = state._pendingMatches;
    const label = pending && pending[0] ? (pending[0].isMine ? pending[0].round.round : pending[0].label) : null;
    const matchups = pendingMatchesToRenderable(pending);
    const result = confirmRoundAdvancement(state);
    if(matchups.length) historyArr.push({ label, matchups });
    return result;
  }
  // The canonical round-LABEL sequence for a conference of this size/format, independent of how far
  // resolution has actually progressed -- used only to size the Playoff Tree's placeholder columns
  // for rounds nobody has stepped into yet.
  function canonicalRoundLabels(N, wcGames, byes){
    if(N<2) return [];
    if(wcGames<=0) return ["Conference Championship"];
    const labels = [byes>0 ? "Wild Card" : "Divisional"];
    let fieldLen = byes+wcGames;
    while(fieldLen>1){ labels.push(fieldLen>2 ? "Divisional" : "Conference Championship"); fieldLen = Math.floor(fieldLen/2); }
    return labels;
  }
  // Companion to canonicalRoundLabels -- how many matchup CARDS each round will end up showing,
  // known purely from the format (N/wcGames/byes), independent of how far resolution has actually
  // progressed. Used to size not-yet-reached placeholder columns with the right number of slots
  // instead of one generic "TBD" card regardless of round.
  function expectedMatchupCounts(N, wcGames, byes){
    if(N<2) return [];
    if(wcGames<=0) return [1];
    const counts = [wcGames];
    let fieldLen = byes+wcGames;
    while(fieldLen>1){ counts.push(Math.floor(fieldLen/2)); fieldLen = Math.floor(fieldLen/2); }
    return counts;
  }
  // Round 32 follow-up ("I'd like the entire tree to already be seen, filled in as we simulate"):
  // derives the NEXT round's real matchup pairings -- seeds and team ids, no scores -- straight from
  // the bracket state, WITHOUT stepping/simulating it. This is possible because who plays whom is
  // fully determined by seeding the instant the round that feeds it is confirmed: round 1's pairs
  // come straight from the seed list (s/wcGames/byes), and every later round's pairs come from
  // state.field (already set by confirmRoundAdvancement the moment the PRIOR round confirmed) --
  // reseeded highest-surviving-seed vs lowest-surviving-seed, the exact same pairing rule
  // stepConferenceBracket itself uses when it actually simulates that round. Returns null once the
  // conference is already fully resolved (nothing left to preview).
  function previewNextRoundMatchups(state){
    if(state.field===null){
      const { s, N, wcGames, byes } = state;
      if(N<2) return null;
      if(wcGames<=0){
        const a=s[0], b=s[1]||null;
        return { label:"Conference Championship", matchups:[{ aSeed:a.seed, aId:a.id, bSeed:b?b.seed:null, bId:b?b.id:null }] };
      }
      const label = byes>0 ? "Wild Card" : "Divisional";
      const matchups = [];
      for(let i=0;i<wcGames;i++){ const a=s[byes+i], b=s[N-1-i]; matchups.push({ aSeed:a.seed, aId:a.id, bSeed:b.seed, bId:b.id }); }
      return { label, matchups };
    }
    const field = state.field;
    if(field.length<=1) return null;
    const label = field.length>2 ? "Divisional" : "Conference Championship";
    const matchups = [];
    for(let i=0;i<Math.floor(field.length/2);i++){ const a=field[i], b=field[field.length-1-i]; matchups.push({ aSeed:a.seed, aId:a.id, bSeed:b.seed, bId:b.id }); }
    return { label, matchups };
  }
  // The one case a round FURTHER than "next" can still be partially previewed: a bye team's own
  // identity is fixed by seeding alone (top seed(s) always skip Wild Card weekend) and never
  // depends on any result, so it can be shown sitting in its Divisional slot from the very start,
  // even before Wild Card has been simulated at all -- its actual opponent (whoever wins Wild Card)
  // genuinely can't be known yet, so that side renders as "TBD" (aId/bId "TBD" is a plain sentinel
  // string here, never a real team code, so it always renders as literal "TBD" text and never
  // triggers the separate isBye/bye-badge styling, which is reserved for an actual bye slot).
  // Deliberately only implemented for round index 1 (Divisional immediately following Wild Card) --
  // this game's real historical formats never have byes feeding into anything deeper than that.
  //
  // Pairs indices exactly the way the post-Wild-Card "field" branch of previewNextRoundMatchups
  // does (top-half index i vs bottom-half index fieldLen-1-i) -- NOT "one card per bye team" as a
  // prior version of this function assumed. Those coincide whenever byes<=wcGames (every bye pairs
  // 1:1 with an eventual Wild Card winner, e.g. the 1990-2001 and 2020s+ formats), but the 1978-1989
  // format (wildcards:2, wcGames:1 -> byes:3 -- see PLAYOFF_ERAS in src/data/teams.js) has MORE
  // byes than incoming Wild Card winners: the #1 seed genuinely waits on the Wild Card game's
  // winner, but the #2 and #3 seeds already know they play EACH OTHER regardless of that result
  // (real NFL history) -- both known now, no "TBD" side at all for that matchup. The old version
  // rendered byes-many separate "vs TBD" cards unconditionally (3 cards for a 2-matchup round,
  // wrongly showing #2 and #3 as if each awaited an unknown opponent) instead of exactly `total`.
  function previewByeAheadMatchups(state){
    const { s, byes, wcGames } = state;
    if(!(byes>0)) return null;
    const fieldLen = byes+wcGames;
    const total = Math.floor(fieldLen/2);
    const matchups = [];
    for(let i=0;i<total;i++){
      const bIdx = fieldLen-1-i;
      const a = i<byes ? s[i] : null;
      const b = bIdx<byes ? s[bIdx] : null;
      matchups.push({ aSeed: a?a.seed:null, aId: a?a.id:"TBD", bSeed: b?b.seed:null, bId: b?b.id:"TBD" });
    }
    return matchups;
  }
  // Manually advances ONE conference's bracket state by exactly one round and records it -- used
  // for: the other conference (always flat, myTeamId never present in its field), and the player's
  // own conference ONLY once their real involvement that season is already over (eliminated, won
  // the Super Bowl, or missed the playoffs entirely) so there's nothing left to gate it on. Safe to
  // call repeatedly -- a no-op once that conference already has a champion.
  function stepBracketConferenceOnce(bd, season, whichConf){
    const state = whichConf==="my" ? bd.myState : bd.otherState;
    const historyArr = whichConf==="my" ? bd.myRounds : bd.otherRounds;
    if(state.field && state.field.length<=1) return;
    const step = stepConferenceBracket(state, null, ()=>0, season);
    if(step.done){
      const champId = step.champion ? step.champion.id : null;
      if(whichConf==="my") bd.myChampionId = champId; else bd.otherChampionId = champId;
      return;
    }
    const result = confirmAndRecordRound(state, historyArr);
    if(result.done){
      const champId = result.champion ? result.champion.id : null;
      if(whichConf==="my") bd.myChampionId = champId; else bd.otherChampionId = champId;
    }
  }
  // Lockstep partner call: every time the player's OWN conference confirms a round (whether a bye
  // auto-skip or their own real, revealed game), the OTHER conference gets stepped and confirmed by
  // exactly one round at the very same moment -- never more, never less. This is what makes the two
  // conferences structurally unable to drift out of sync with each other.
  function stepOtherConferenceOnce(bd, season){
    if(bd.otherChampionId!=null) return;
    stepBracketConferenceOnce(bd, season, "other");
  }
  // Once BOTH conferences have a known champion AND the player's own postseason involvement is
  // completely finished (never started, ended in elimination, or their own Super Bowl reveal is
  // done), builds the one, single, permanent record of the whole postseason -- the Super Bowl
  // winner/loser/score, and both conferences' full round-by-round history. Safe to call from many
  // places (every point that could be "the last piece" finishing) since it no-ops once already built.
  function tryFinalizeLeaguePlayoffBracket(season){
    const ls = season.leagueStandings;
    if(!ls || !ls.bracket || ls.playoffBracket) return;
    const bd = ls.bracket;
    const myDone = !season.playoffs || !season.playoffs.made || season.playoffs.done;
    if(!myDone || bd.myChampionId==null || bd.otherChampionId==null) return;
    const reachedSB = season.playoffs.made && (season.playoffs.rounds||[]).some(r=>r.round==="Super Bowl");
    let superBowlWinnerId, superBowlLoserId, superBowlScore;
    if(reachedSB){
      const sb = season.playoffs.rounds.find(r=>r.round==="Super Bowl");
      superBowlWinnerId = sb.won ? career.teamId : bd.otherChampionId;
      superBowlLoserId = sb.won ? bd.otherChampionId : career.teamId;
      superBowlScore = sb.won ? `${sb.myScore}-${sb.oppScore}` : `${sb.oppScore}-${sb.myScore}`;
    } else {
      const sA = career.leagueStrength[bd.myChampionId] ?? 60, sB = career.leagueStrength[bd.otherChampionId] ?? 60;
      const winnerId = simpleGameWinner(bd.myChampionId, sA, bd.otherChampionId, sB);
      const loserId = winnerId===bd.myChampionId ? bd.otherChampionId : bd.myChampionId;
      const scored = approxGameScore(career.leagueStrength[winnerId] ?? 60, career.leagueStrength[loserId] ?? 60);
      superBowlWinnerId = winnerId; superBowlLoserId = loserId; superBowlScore = `${scored.winnerScore}-${scored.loserScore}`;
    }
    ls.playoffBracket = {
      [bd.myConf]: { championId: bd.myChampionId, rounds: bd.myRounds, playerMade: !!season.playoffs.made },
      [bd.otherConf]: { championId: bd.otherChampionId, rounds: bd.otherRounds, playerMade: false },
      superBowlWinnerId, superBowlLoserId, superBowlScore,
    };
    // Round 32 QOL: the Super Bowl is now ALWAYS fully, definitively resolved the instant this runs
    // -- credit the winning QB with a ring on their own record, same as the player's own ring, via
    // career.totals.rings (finalizePlayoffOutcome, unchanged) for the player or the rival's own
    // totals for anyone else.
    if(superBowlWinnerId!==career.teamId) awardRivalSuperBowlRing(superBowlWinnerId);
    // Round 33: patch the conference-champion fact into each conference winner's ALREADY-RECORDED
    // season-history entry (pushed by recordTeamSeasonHistory back in resolvePlayoffs) -- this is
    // the one fact that isn't known until the bracket actually confirms, unlike W-L/division/scheme.
    markConferenceChampionInHistory(bd.myChampionId, season.year);
    markConferenceChampionInHistory(bd.otherChampionId, season.year);
    // Wave 5 (task #8): same idea, one level up -- patch the Super Bowl winner's own season-history
    // row with the championship flag and a fresh ring-count snapshot, now that the ring itself has
    // already been credited above (or, for the player's own real run, earlier still, by
    // finalizePlayoffOutcome before this function was even called).
    markChampionInHistory(superBowlWinnerId, season.year);
  }
  function awardRivalSuperBowlRing(teamId){
    const rival = rivalForTeam(teamId);
    if(rival) rival.totals.rings = (rival.totals.rings||0)+1;
  }
  // Round 33 item 5: a real, permanent per-team season-by-season record, the backbone of the Team
  // page's new "Past Seasons" table -- who started at QB, their ring count (career total, snapshotted
  // as of that team's season), win-loss, whether they won their division (known immediately, straight
  // off that division's own standings sort) or their conference (patched in later, once known -- see
  // markConferenceChampionInHistory), and what scheme they ran. Recorded once per season, for EVERY
  // team, the moment standings/seeding are final (resolvePlayoffs) -- necessarily starts accumulating
  // only from the point this feature shipped forward; there is no way to retroactively reconstruct a
  // season that was never recorded, the same limitation Trophy Room/Achievements both already have.
  function recordTeamSeasonHistory(season){
    const ls = season.leagueStandings;
    const year = season.year;
    const divWinnerIds = new Set();
    (ls.divisions || divisionsForYear(year)).forEach(d=>{
      const ranked = d.teams.map(id=>ls.results[id]).sort((a,b)=>compareTeamsForStandings(a,b,year,"division"));
      if(ranked[0]) divWinnerIds.add(ranked[0].id);
    });
    // Wave 6: "recent playoffs" is a real, distinct signal buildTeamQuarterbackNeed/
    // teamCompetitiveWindow both need -- a wildcard team eliminated in the first round has none of
    // the title flags below but genuinely made the playoffs, a real fact those flags alone can't
    // tell apart from a team that missed entirely. ls.seeded is already built by resolvePlayoffs
    // before this runs.
    const playoffTeamIds = new Set([...(ls.seeded && ls.seeded.AFC || []), ...(ls.seeded && ls.seeded.NFC || [])].map(t=>t.id));
    if(!career.teamSeasonHistory) career.teamSeasonHistory = {};
    divisionsForYear(year).flatMap(d=>d.teams).forEach(teamId=>{
      const r = ls.results[teamId];
      if(!r) return;
      const isMine = teamId===career.teamId;
      const rival = isMine ? null : rivalForTeam(teamId);
      const qbName = isMine ? career.name : (rival ? rival.name : null);
      const qbRings = isMine ? career.totals.rings : (rival ? (rival.totals.rings||0) : 0);
      const schemeId = career.teamScheme ? career.teamScheme[teamId] : null;
      const scheme = SCHEMES.find(s=>s.id===schemeId);
      if(!career.teamSeasonHistory[teamId]) career.teamSeasonHistory[teamId] = [];
      career.teamSeasonHistory[teamId].push({
        year, wins: r.wins, losses: r.losses, ties: r.ties||0, qbName, qbRings,
        madePlayoffs: playoffTeamIds.has(teamId),
        wonDivision: divWinnerIds.has(teamId), wonConference: false, wonChampionship: false,
        scheme: scheme ? scheme.name : null,
      });
    });
  }
  function markConferenceChampionInHistory(teamId, year){
    const hist = career.teamSeasonHistory && career.teamSeasonHistory[teamId];
    if(!hist) return;
    const entry = hist.find(h=>h.year===year);
    if(entry) entry.wonConference = true;
  }
  // Wave 5 (MASTER_REMEDIATION_SPEC.md task #8): recordTeamSeasonHistory snapshots qbRings BEFORE
  // the postseason plays out (it runs from resolvePlayoffs, the moment standings/seeding are known
  // -- long before any bracket round, let alone the Super Bowl, is decided), so the eventual
  // champion's own history row for THIS season is stale the instant they actually win it: it still
  // shows their ring count from BEFORE this season's ring. Called from tryFinalizeLeaguePlayoffBracket
  // once superBowlWinnerId is finally known (after the ring itself has already been credited, either
  // to career.totals.rings via finalizePlayoffOutcome for the player, or to the rival's own totals
  // via awardRivalSuperBowlRing) -- patches both the championship flag and a fresh qbRings snapshot
  // onto that exact season's already-recorded row so the Team page's Past Seasons table always
  // agrees with the real, current ring totals it's built from.
  function markChampionInHistory(teamId, year){
    const hist = career.teamSeasonHistory && career.teamSeasonHistory[teamId];
    if(!hist) return;
    const entry = hist.find(h=>h.year===year);
    if(!entry) return;
    entry.wonChampionship = true;
    const isMine = teamId===career.teamId;
    const rival = isMine ? null : rivalForTeam(teamId);
    entry.qbRings = isMine ? career.totals.rings : (rival ? (rival.totals.rings||0) : entry.qbRings);
  }
  // Full overall-grade breakdown for every OTHER team in the league -- the player's own team keeps
  // using the real, mechanically-wired career.oline/weapons/defense/coaching/gmGrade (those affect
  // actual gameplay: sack rate, dev speed, FA offers, etc.); every other team gets its own
  // persistent set of the same five sub-grades, the real (non-QB) source of truth for both DISPLAY
  // (the Team page's breakdown) and for career.leagueStrength[id] itself (computeTeamOverall).
  // Wave 5 (MASTER_REMEDIATION_SPEC.md): this is now INIT-ONLY -- rolls a team's five components
  // exactly once, the first time it's seen (any active franchise, including a brand-new expansion
  // team the moment it first appears in divisionsForYear), and never touches an existing entry
  // again. All ongoing drift for every other team happens exclusively through adjustTeamStrength
  // (season-end drift, succession, headline events) so the components can never be pulled toward --
  // or silently overwritten by -- an aggregate number that used to be able to drift independently of
  // them. That old "pull toward strength" behavior was the exact backwards causality Wave 5 fixes:
  // components must determine the aggregate, never the other way around.
  function ensureLeagueTeamGrades(year){
    if(!career.leagueTeamGrades) career.leagueTeamGrades = {};
    const keys = ["oline","weapons","defense","coaching","gmGrade"];
    // Wave 5 (task #1): iterates teamsAvailable(year) -- TEAMS.filter(t=>t.start<=year), the same
    // "which franchises exist this year" source buildFreeAgentOffers/pickTeamByStrength/tradeCheck
    // all already use -- rather than divisionsForYear(year)'s per-era division tables. A real gap
    // found by this wave's own FA-offer regression test: an era's DIVISIONS_PRE_1970/1970_2001 table
    // doesn't necessarily list every team TEAMS/teamsAvailable already considers foundeded that
    // year (older division structures don't 1:1 cover every modern franchise id), so a team could be
    // a legitimate FA/trade candidate while divisionsForYear silently never surfaced it here -- this
    // is a strict superset (divisionsForYear itself intersects against teamsAvailable already), so
    // it only ever ADDS coverage, never drops a team the old version already initialized.
    teamsAvailable(year).forEach(t=>{
      const teamId = t.id;
      if(teamId===career.teamId) return;
      if(career.leagueTeamGrades[teamId]) return;
      const strength = career.leagueStrength[teamId] ?? 60;
      const g = {}; keys.forEach(k=> g[k] = rollSupportingCastGrade(strength));
      career.leagueTeamGrades[teamId] = g;
    });
  }
  // The five sub-grade cards shared by the player's own Team tab and any other team's page --
  // `grades` is always {oline,weapons,defense,coaching,gmGrade}, real for the player's own team,
  // from leagueTeamGrades for anyone else. One shared renderer so the two surfaces can never drift
  // apart in look or wording.
  // Wave 5 (task #1): every active franchise's overall AND all five components, ranked against
  // every other active franchise -- a real, mechanical league-rank rather than just a raw number,
  // for the Team page's "league rank" requirement. Reads the exact same sources as everything else
  // this wave touches (career.* for the player's own team, career.leagueTeamGrades for anyone
  // else), so a rank shown here can never disagree with the number it's ranking.
  function computeTeamGradeRanks(year){
    ensureLeagueTeamGrades(year);
    const rows = teamsAvailable(year).map(t=>{
      const isMine = t.id===career.teamId;
      const g = isMine
        ? { oline:career.oline, weapons:career.weapons, defense:career.defense, coaching:career.coaching, gmGrade:career.gmGrade }
        : (career.leagueTeamGrades[t.id] || { oline:60, weapons:60, defense:60, coaching:60, gmGrade:60 });
      const overall = isMine ? career.teamStrength : (career.leagueStrength[t.id] ?? Math.round(computeTeamOverall(g)));
      return { teamId:t.id, overall, ...g };
    });
    const rankOf = key=>{
      const ranks = {};
      rows.slice().sort((a,b)=>b[key]-a[key]).forEach((r,i)=> ranks[r.teamId]=i+1);
      return ranks;
    };
    return { total: rows.length, overall: rankOf("overall"), oline: rankOf("oline"), weapons: rankOf("weapons"),
      defense: rankOf("defense"), coaching: rankOf("coaching"), gmGrade: rankOf("gmGrade") };
  }
  // `ranks`/`teamId` are optional -- when given (rankInfo = {ranks, teamId}), each card also shows
  // this team's league rank for that exact component (computeTeamGradeRanks), never a second,
  // differently-derived ranking.
  function buildGradeCardsHtml(grades, rankInfo){
    const defs = [
      { key:"oline", label:"Offensive Line",
        impact:"Sack rate and injury risk — a shaky line means more hits taken; an elite one buys extra time in the pocket." },
      { key:"weapons", label:"Weapons",
        impact:"Completion % and yards per attempt — better targets make every throw a little easier to complete, and a little more likely to go the distance." },
      { key:"defense", label:"Defense",
        impact:"How many points opponents score, independent of the offense — a great defense can carry a team to wins the stat line alone wouldn't explain." },
      { key:"coaching", label:"Coaching",
        impact:"Attribute development speed, every single season — a strong staff genuinely develops talent faster; a bad one is a permanent drag on growth." },
      { key:"gmGrade", label:"Front Office",
        impact:"Contract offer size and how patient the organization is through a rough stretch — a sharp front office pays fair value and doesn't panic; an incompetent one is erratic either way." },
    ];
    return defs.map(g=>{
      const value = grades[g.key] ?? 60;
      const rankHtml = (rankInfo && rankInfo.ranks && rankInfo.ranks[g.key])
        ? `<div class="tg-rank">#${rankInfo.ranks[g.key][rankInfo.teamId]} of ${rankInfo.ranks.total}</div>` : "";
      return `<div class="team-grade-card">
        <div class="tg-label">${g.label}</div>
        <div class="tg-value tabular">${castLetterGrade(value)} <span class="tg-num">(${value})</span></div>
        ${rankHtml}
        <div class="tg-impact">${g.impact}</div>
      </div>`;
    }).join("");
  }

  /* ----- Live, stepwise postseason resolution -----
     The player's OWN playoff run is deliberately never resolved further ahead than the round
     they've actually played. This used to be one synchronous call (resolvePlayoffs simulating
     the ENTIRE bracket, Super Bowl included, before a single quarter had been revealed) -- which
     meant the season card's awards badge could show "Super Bowl Champion" while the playoff boxes
     below it were still mid-reveal, and a Key Moment mini-game later on was pure cosmetics: the
     win/loss for every round, all the way to the Lombardi Trophy, was already locked in before the
     player made a single read.
     Now resolvePlayoffs only generates the very next round the player is part of. Advancing past
     it -- deciding who plays whom next, or whether the run is over -- happens in
     confirmPlayoffRound, called only once that round (Key Moment included) has fully finished
     revealing, using the round's FINAL result. The rest of the bracket (games the player isn't
     in) is still resolved a round at a time alongside them, same as the real NFL: nobody knows the
     Conference Championship matchups until the Wild Card round is actually over. */
  function startConferenceBracket(seeds, format){
    const s = seeds.map((t,i)=>({ seed:i+1, id:t.id }));
    const N = s.length;
    const wcGames = format ? format.wcGames : Math.floor((N-1)/2);
    const byes = N - 2*wcGames;
    return { s, N, wcGames, byes, field: null, _pendingMatches: null, _pendingByeTeams: null };
  }

  function stepConferenceBracket(state, myTeamId, myOffFn, season){
    function simulateMatch(teamA, teamB, roundLabel){
      if(teamA.id===myTeamId || teamB.id===myTeamId){
        const player = teamA.id===myTeamId ? teamA : teamB;
        const opp = teamA.id===myTeamId ? teamB : teamA;
        const oppStrength = career.leagueStrength[opp.id] ?? 60;
        const oppRival = rivalForTeam(opp.id);
        const oppOffense = opponentOffenseGrade(opp.id, QB_INFLUENCE_PLAYOFF);
        const myOff = playoffOffenseGrade(myOffFn(), season);
        const game = simulateGameScore(myOff, oppOffense, career.defense, null, season ? season.year : career.year, true, opponentDefenseGrade(opp.id));
        const round = {
          round: roundLabel, opponent: teamNameAt(opp.id, career.year), oppId: opp.id, mySeed: player.seed, oppSeed: opp.seed,
          myScore: game.myTotal, oppScore: game.oppTotal, won: game.won, quarters: game.quarters,
          box: season ? generateGameBoxScore(season, game.myTotal, game.myTds) : null,
          oppTendency: pickOpponentTendency(), _offOverall: myOff, _defOverall: oppStrength, _defOffense: oppOffense,
          _oppQbId: oppRival ? oppRival.id : null, _oppQbName: oppRival ? oppRival.name : null, _oppQbOverall: oppRival ? rivalEffTalent(oppRival) : null,
        };
        return { isMine:true, player, opp, round };
      }
      const sA = career.leagueStrength[teamA.id] ?? 60, sB = career.leagueStrength[teamB.id] ?? 60;
      const winnerId = simpleGameWinner(teamA.id, sA, teamB.id, sB);
      const loserId = winnerId===teamA.id ? teamB.id : teamA.id;
      const scored = approxGameScore(career.leagueStrength[winnerId] ?? 60, career.leagueStrength[loserId] ?? 60);
      const aScore = winnerId===teamA.id ? scored.winnerScore : scored.loserScore;
      const bScore = winnerId===teamB.id ? scored.winnerScore : scored.loserScore;
      return { isMine:false, winner: winnerId===teamA.id ? teamA : teamB, label: roundLabel,
        aSeed:teamA.seed, aId:teamA.id, aScore, bSeed:teamB.seed, bId:teamB.id, bScore, winnerId };
    }

    const { s, N, wcGames, byes } = state;
    if(state.field===null){
      if(N<2){ state.field = s.length ? [s[0]] : []; return { myRound:null, done:true, champion:s[0] }; }
      if(wcGames<=0){
        const m = simulateMatch(s[0], s[1] || s[0], "Conference Championship");
        state._pendingMatches = [m];
        state._pendingByeTeams = [];
        return { myRound: m.isMine ? m.round : null };
      }
      const firstRoundLabel = byes>0 ? "Wild Card" : "Divisional";
      const matches = [];
      for(let i=0;i<wcGames;i++) matches.push(simulateMatch(s[byes+i], s[N-1-i], firstRoundLabel));
      state._pendingMatches = matches;
      state._pendingByeTeams = s.slice(0, byes);
      const mine = matches.find(m=>m.isMine);
      return { myRound: mine ? mine.round : null };
    }

    const field = state.field;
    const roundLabel = field.length>2 ? "Divisional" : "Conference Championship";
    const matches = [];
    for(let i=0;i<Math.floor(field.length/2);i++) matches.push(simulateMatch(field[i], field[field.length-1-i], roundLabel));
    state._pendingMatches = matches;
    state._pendingByeTeams = [];
    const mine = matches.find(m=>m.isMine);
    return { myRound: mine ? mine.round : null };
  }

  // Commits who advances using each match's FINAL result -- for the player's own game, that's
  // round.won AFTER any Key Moment swing, never the pre-swing baseline stepConferenceBracket
  // simulated it with.
  function confirmRoundAdvancement(state){
    const matches = state._pendingMatches || [];
    const survivors = matches.map(m=> m.isMine ? (m.round.won ? m.player : m.opp) : m.winner);
    const field = [...(state._pendingByeTeams||[]), ...survivors].sort((a,b)=>a.seed-b.seed);
    state.field = field;
    state._pendingMatches = null; state._pendingByeTeams = null;
    if(field.length<=1) return { done:true, champion: field[0] };
    return { done:false };
  }

  function buildSuperBowlRound(playoffs, season){
    // Round 32: reads the lockstep bracket's own otherChampionId directly -- by the time the player
    // has just won their conference, the other conference has been stepped the exact same number of
    // times (stepOtherConferenceOnce runs alongside every one of my conference's own confirmations),
    // so it should already be resolved too. The while-loop is a defensive fallback only, for the
    // rare case the two conferences have different round counts (asymmetric division sizes).
    const bd = season.leagueStandings.bracket;
    while(bd.otherChampionId==null) stepBracketConferenceOnce(bd, season, "other");
    const otherChampId = bd.otherChampionId;
    const oppStrength = career.leagueStrength[otherChampId] ?? 60;
    const oppRival = rivalForTeam(otherChampId);
    const oppOffense = opponentOffenseGrade(otherChampId, QB_INFLUENCE_PLAYOFF);
    const myOff = playoffOffenseGrade(playoffs._effOverall, season);
    const game = simulateGameScore(myOff, oppOffense, career.defense, null, season.year, true, opponentDefenseGrade(otherChampId));
    const sbRound = {
      round:"Super Bowl", opponent: teamNameAt(otherChampId, career.year), oppId: otherChampId,
      myScore: game.myTotal, oppScore: game.oppTotal, won: game.won,
      quarters: game.quarters, box: generateGameBoxScore(season, game.myTotal, game.myTds),
      oppTendency: pickOpponentTendency(), _offOverall: myOff, _defOverall: oppStrength, _defOffense: oppOffense,
      _oppQbId: oppRival ? oppRival.id : null, _oppQbName: oppRival ? oppRival.name : null, _oppQbOverall: oppRival ? rivalEffTalent(oppRival) : null,
    };
    sbRound._revealedCount = 0; sbRound._keyMomentChecked = false;
    playoffs.rounds.push(sbRound);
  }

  // Advances through the bracket looking for the player's NEXT game. A round the player has a
  // bye in (the top seed(s) skip Wild Card weekend) has nothing uncertain for them -- there's no
  // reveal to wait on -- so it's confirmed immediately and the search continues into the round
  // after it. The moment a round WITH the player in it turns up, it's pushed and this stops, to
  // wait for that round's reveal (Key Moment included) before going any further.
  function advanceToNextPlayoffRound(playoffs, season){
    while(!playoffs.done){
      const step = stepConferenceBracket(playoffs._bracketState, career.teamId, ()=>playoffs._effOverall, season);
      if(step.myRound){
        step.myRound._revealedCount = 0; step.myRound._keyMomentChecked = false;
        playoffs.rounds.push(step.myRound);
        return;
      }
      if(step.done){
        // fewer than 2 teams in the whole conference -- the player was never seeded into a game.
        playoffs.done = true;
        return;
      }
      // a bye round: nothing here involved the player, so it settles on its own -- confirm it
      // and keep looking for their actual next game. Lockstep the other conference by exactly one
      // round at the same moment (Round 32) -- every round of mine that becomes final, real game or
      // not, has a matching round of theirs become final too, never ahead, never behind.
      const bd = season.leagueStandings.bracket;
      const result = confirmAndRecordRound(playoffs._bracketState, bd.myRounds);
      stepOtherConferenceOnce(bd, season);
      if(result.done){
        bd.myChampionId = result.champion ? result.champion.id : null;
        // the whole conference resolved in a round the player sat out -- only possible if that
        // "champion" IS the player (every other team was eliminated around a lone bye), in which
        // case they've won the conference without playing a snap; handle it like any other
        // Conference Championship win. Otherwise there's simply nothing left for them to play.
        if(result.champion && result.champion.id===career.teamId){ buildSuperBowlRound(playoffs, season); }
        else { playoffs.done = true; }
        return;
      }
      // else: field advanced past a bye round with the player still in it somewhere down the
      // bracket -- loop again to find their game.
    }
  }

  // Called once the round most recently pushed onto playoffs.rounds has completely finished
  // revealing (Key Moment included, round.won final). Only from here does the bracket move
  // forward -- and only now can the run actually end, in either direction.
  function confirmPlayoffRound(playoffs, season){
    const round = playoffs.rounds[playoffs.rounds.length-1];
    if(!round){ playoffs.done = true; return; }
    // round.won is final here (Key Moment swing already applied), unlike the baseline result the
    // bracket-resolution functions computed when the round was first created -- this is the one
    // correct place to bump rivalry off a playoff result, for every round type uniformly.
    bumpRivalry(round._oppQbId ? findRivalById(round._oppQbId) : null, { playoff:true, won: round.won, close: Math.abs(round.myScore-round.oppScore)<=3 });
    if(round.round==="Super Bowl"){ playoffs.wonSuperBowl = round.won; playoffs.done = true; return; }
    // Round 32: record MY just-finished round (siblings included -- their results were already
    // rolled back when this round was first generated, but only become visible on the Playoff Tree
    // now that the player's own game is actually decided) and lockstep the other conference by
    // exactly one round at the same moment -- nothing about either side of this round was shown or
    // simulated further until right now.
    const bd = season.leagueStandings.bracket;
    const result = confirmAndRecordRound(playoffs._bracketState, bd.myRounds);
    stepOtherConferenceOnce(bd, season);
    if(!round.won){
      playoffs.done = true;
      if(result.done) bd.myChampionId = result.champion ? result.champion.id : null;
      return;
    }
    if(result.done){
      bd.myChampionId = result.champion ? result.champion.id : null;
      if(result.champion && result.champion.id===career.teamId){ buildSuperBowlRound(playoffs, season); }
      else { playoffs.done = true; }
      return;
    }
    advanceToNextPlayoffRound(playoffs, season);
  }

  function resolvePlayoffs(effOverall, season, schedule){
    const { seeded, results, format, divisions } = simulateLeagueStandings(season, schedule);
    season.leagueStandings = { results, seeded, format, divisions };
    const year = season.year;
    const myConf = conferenceOf(career.teamId, year);
    const otherConf = myConf==="AFC" ? "NFC" : "AFC";
    // Round 32: ONE shared, lockstep, round-by-round bracket resolution for BOTH conferences --
    // replaces the old eager, independent _myConfBracketCache/_otherConfBracketCache (each
    // conference resolved fully and immediately, with no relationship to the player's own real
    // progression, which could disagree with it -- see the Round 32 PROGRESS.md entry for the
    // reported bug). Nothing about either conference exists yet beyond these two starting states;
    // rounds get stepped and recorded one at a time, in lockstep, exactly when the player's own real
    // game (or a manual "Simulate Next Round" click, once nothing further gates it) confirms.
    season.leagueStandings.bracket = {
      myConf, otherConf,
      myState: startConferenceBracket(seeded[myConf], format),
      otherState: startConferenceBracket(seeded[otherConf], format),
      myRounds: [], otherRounds: [],
      myChampionId: null, otherChampionId: null,
    };
    // Round 33 item 5: snapshot this season into every team's permanent history the moment the
    // regular season/standings/seeding are known -- W-L and division are final right here; the
    // conference-champion fact gets patched into this SAME entry later, by
    // markConferenceChampionInHistory, once that conference's bracket actually confirms.
    recordTeamSeasonHistory(season);
    // Round 33 QOL: give every other team its own five-grade breakdown for the Team page, same
    // timing as the history snapshot above (right when this season's standings are known).
    ensureLeagueTeamGrades(year);
    const mySeeds = seeded[myConf];
    const mySeedIdx = mySeeds.findIndex(t=>t.id===career.teamId);

    const confTeamIds = divisions.filter(d=>d.conf===myConf).flatMap(d=>d.teams);
    const confRanked = confTeamIds.map(id=>results[id]).sort((a,b)=>compareTeamsForStandings(a,b,year,"conference"));
    const confRank = confRanked.findIndex(t=>t.id===career.teamId)+1;

    if(mySeedIdx===-1){
      tryFinalizeLeaguePlayoffBracket(season);
      return { made:false, confRank, confSize:confTeamIds.length };
    }

    const seed = mySeedIdx+1;
    const playoffs = {
      made:true, seed, confRank, confSize:confTeamIds.length,
      rounds: [], wonSuperBowl:false, done:false,
      _bracketState: season.leagueStandings.bracket.myState,
      _effOverall: effOverall,
    };
    // Generates round 1's matchup only -- how far this run goes is not decided here, and won't
    // be until the player has actually played their way there.
    advanceToNextPlayoffRound(playoffs, season);
    return playoffs;
  }

  // Shared by generateSeason (the player's own season) and simulateRivalSeasons (every other
  // starting QB in the league) so award odds are computed by the exact same rules for everyone --
  // this is what makes the League tab's award-rate comparison an honest "checkbalance" instead of
  // two formulas that only look similar. (Pro Bowl/All-Pro used to be rolled straight off effOverall
  // with only a token attempts floor -- an elite-rated QB who missed 8 games and threw for 2,000
  // yards could still clear that and get selected purely on talent. The ratingEdge gate also used to
  // allow -2, letting a personally below-average season get carried in by a stacked team's win total
  // alone -- both fixed here, once, for every QB in the league at the same time.)
  function evaluateSeasonAwards({ rating, td, winPct, attempts, gamesPlayed, leagueGames, decade, teamOverall }){
    const awards = [];
    const leagueAvgRating = leagueAvgRatingForDecade(decade);
    const ratingEdge = rating - leagueAvgRating;
    const gamesPlayedShare = leagueGames>0 ? gamesPlayed/leagueGames : 0;

    // Pro Bowl and All-Pro are NOT independent per-QB rolls -- see resolveSeasonAllProAndProBowl
    // below, which mirrors the winner-take-all MVP fix (resolveSeasonMVP): a real Pro Bowl has a
    // fixed number of honorees selected comparatively (top scorers per conference), and a real
    // All-Pro team has exactly one First Team and one Second Team league-wide, not several dozen
    // players each independently "winning" the honor off their own coin flip. These scores are the
    // same ingredients the old rolls used -- how strong a case this season makes -- just no longer
    // fed through a probability; *Eligible gates out a barely-played season (a real Pro Bowl/All-Pro
    // case requires an actual full-ish season, not a plausible score off a tiny sample).
    // Eligibility is PLAYING-TIME only, never an absolute performance bar -- a real Pro Bowl/
    // All-Pro vote doesn't require clearing some fixed rating-above-average threshold, it's a pure
    // RELATIVE comparison among whoever played enough to be considered, and the best of that pool
    // wins every single year no matter how strong or weak the league was overall. An earlier
    // version gated on `ratingEdge>=1`/`>=9` on top of playing time -- in a league-wide down year
    // (or after a stat-realism pass compresses everyone's ratings, as happened once already) that
    // could empty the eligible pool entirely, falling back to resolveSeasonAllProAndProBowl's
    // tiny-sample safety net instead of an honest comparison of who actually played the most/best.
    const proBowlEligible = attempts>200 && gamesPlayedShare>=0.65;
    const allProEligible = attempts>250 && gamesPlayedShare>=0.8;
    // MVP is likewise decided once, league-wide, by resolveSeasonMVP. mvpEligible gates out
    // someone who barely played from ever backing into the award off a tiny sample; a real MVP
    // case requires having actually played the season.
    const mvpEligible = attempts>150 && gamesPlayedShare>=0.5;

    // Balance Wave 5: raw win% used to feed all three scores directly -- since Wave 1 a QB's own
    // team grades no longer inflate from his rating, but the reverse was never broken (a QB drafted
    // onto/re-signed with an already-strong team still just wins more games for reasons that have
    // nothing to do with that season's individual case), so raw win% still silently rewarded
    // "played for a good team" every year. winsAboveExpectation (src/sim/awards.js) replaces it
    // everywhere -- see that module's own header for the full worked-example comparison.
    const { proBowlScore, allProScore, mvpScore, winsAboveExpectation } = evaluateSeasonAwardScores({
      ratingEdge, td, winPct, teamOverall, gamesPlayedShare,
    });

    return { awards, ratingEdge, leagueAvgRating, gamesPlayedShare, winsAboveExpectation,
      proBowlScore, proBowlEligible, allProScore, allProEligible, mvpScore, mvpEligible };
  }

  // Winner-take-all MVP: exactly one season, per year, across the WHOLE league (player + every
  // simulated rival), gets the award -- whoever's mvpScore (see evaluateSeasonAwards) is highest.
  // A genuine tie (identical score) is rare but handled honestly with a co-MVP rather than an
  // arbitrary tiebreak. If literally nobody clears the mvpEligible bar this year (a strike-shortened
  // season, a league-wide injury bug, etc.) the best score on record still wins it rather than the
  // season ending with an unexplained "nobody won MVP" gap -- real MVP voting never goes empty.
  function resolveSeasonMVP(season, year){
    const rows = [{ isMine:true, awards: season.awards, score: season.mvpScore,
      eligible: season.mvpEligible, totals: career.totals }];
    // Wave 7 (MASTER_REMEDIATION_SPEC.md task #7): iterates the full qbsById registry, not just
    // career.leagueRivals (starters only) -- the confirmed defect "their roster label alone must
    // not exclude a qualifying played season." A bench QB who took real relief snaps (a genuine
    // season row via applyStatLineToGames/reconcileWinLossFromGames) is exactly as eligible for MVP
    // as any starter with the same score/eligibility -- the same source buildAllTimeLeaderboardRows
    // already uses for the identical reason (a played season must never be invisible because of
    // roster role).
    Object.values(career.qbsById||{}).forEach(r=>{
      const s = (r.seasons||[]).find(x=>x.year===year);
      if(!s) return;
      rows.push({ isMine:false, awards: s.awards, score: s.mvpScore, eligible: s.mvpEligible, totals: r.totals });
    });
    const pool = rows.filter(r=>r.eligible);
    const field = pool.length ? pool : rows;
    const best = Math.max(...field.map(r=>r.score));
    const winners = field.filter(r=> Math.abs(r.score-best) < 0.0001);
    winners.forEach(r=>{ r.awards.push("MVP"); r.totals.mvps++; });
    return winners.some(r=>r.isMine);
  }

  // Fixed-slot Pro Bowl / All-Pro, resolved comparatively across the whole league at season's
  // end -- same pattern as resolveSeasonMVP, but with a per-conference roster instead of a single
  // winner. Real history: the Pro Bowl selected 2 QBs per conference (4 total) through the 1980s,
  // occasionally stretching to a 3rd per conference for a clearly-deserving extra case, then grew
  // to 3 per conference (6 total) from the 1990s on; the All-Pro team has always named exactly one
  // First Team and one Second Team league-wide (not per-conference). A First/Second-Team All-Pro
  // is, in practice, always also a Pro Bowler -- if the comparative Pro Bowl vote above didn't
  // already seat them, they're added on top of their conference's count (same as a real ballot
  // occasionally runs an extra honoree in).
  function proBowlSlotsForYear(year){
    return year<1990 ? { perConf:2, maxPerConf:3 } : { perConf:3, maxPerConf:3 };
  }
  function resolveSeasonAllProAndProBowl(season, year){
    const rows = [{ isMine:true, teamId: career.teamId, conf: conferenceOf(career.teamId, year),
      awards: season.awards, proBowlScore: season.proBowlScore, proBowlEligible: season.proBowlEligible,
      allProScore: season.allProScore, allProEligible: season.allProEligible, totals: career.totals }];
    // Wave 7 (task #7): same fix as resolveSeasonMVP above -- iterate the full qbsById registry so
    // a bench QB's real, played season is never excluded from Pro Bowl/All-Pro consideration just
    // because career.leagueRivals only ever tracks each team's current starter.
    Object.values(career.qbsById||{}).forEach(r=>{
      const s = (r.seasons||[]).find(x=>x.year===year);
      if(!s) return;
      rows.push({ isMine:false, teamId: r.teamId, conf: conferenceOf(r.teamId, year),
        awards: s.awards, proBowlScore: s.proBowlScore, proBowlEligible: s.proBowlEligible,
        allProScore: s.allProScore, allProEligible: s.allProEligible, totals: r.totals });
    });

    const slots = proBowlSlotsForYear(year);
    const seated = new Set();
    // Wave 7 (MASTER_REMEDIATION_SPEC.md task #6): the confirmed defect -- the standard slots used
    // to take the top `perConf` rows by score with NO proBowlEligible filter at all (only the bonus
    // slot ever checked eligibility), so a QB who fails the real playing-time bar (a short, hot
    // streak) could still win a standard Pro Bowl slot outright. Standard slots now come from the
    // ELIGIBLE pool only; the explicit fallback (required by the same task) fills any slot the
    // eligible pool can't cover from the ineligible pool by score, so a conference is never left
    // with an empty seat just because too few QBs met the playing-time bar this season -- a real
    // Pro Bowl roster is always full. The bonus slot stays eligible-only, same as before.
    ["AFC","NFC"].forEach(conf=>{
      const pool = rows.filter(r=>r.conf===conf);
      if(!pool.length) return;
      const rankedEligible = pool.filter(r=>r.proBowlEligible).sort((a,b)=> b.proBowlScore-a.proBowlScore);
      const selected = rankedEligible.slice(0, slots.perConf);
      if(selected.length<slots.perConf){
        const rankedIneligible = pool.filter(r=>!r.proBowlEligible).sort((a,b)=> b.proBowlScore-a.proBowlScore);
        selected.push(...rankedIneligible.slice(0, slots.perConf-selected.length));
      }
      if(slots.maxPerConf>slots.perConf){
        const bonus = rankedEligible[slots.perConf];
        if(bonus) selected.push(bonus);
      }
      selected.forEach(r=>{ r.awards.push("All-Star"); r.totals.proBowls++; seated.add(r); });
    });

    const eligiblePool = rows.filter(r=>r.allProEligible);
    const field = (eligiblePool.length ? eligiblePool : rows).slice().sort((a,b)=> b.allProScore-a.allProScore);
    const firstTeam = field[0];
    const secondTeam = field.find(r=>r!==firstTeam);
    [["Silver Slugger", firstTeam], ["All-MLB Second Team", secondTeam]].forEach(([label, r])=>{
      if(!r) return;
      r.awards.push(label);
      r.totals.allPros++;
      if(!seated.has(r)){ r.awards.push("All-Star"); r.totals.proBowls++; seated.add(r); }
    });

    const myRow = rows[0];
    return { proBowl: myRow.awards.includes("All-Star"),
      allPro: myRow.awards.includes("Silver Slugger") ? "First-Team" : myRow.awards.includes("All-MLB Second Team") ? "Second-Team" : null };
  }

  // League-wide statistical titles (batting average, home runs, RBI) plus Rookie of the Year,
  // resolved the same comparative way MVP is -- one winner per year across the player + every
  // simulated hitter in career.qbsById. A title needs a real qualifying season (roughly 3.1 PA
  // per team game); ROY needs a real first-year season. Titles/ROY only ever push a label onto
  // season.awards (no totals field of their own yet) -- the Trophy Room counts them off the label.
  function resolveSeasonStatTitlesAndROY(season, year){
    const rows = [{ isMine:true, awards: season.awards, s: season, draftYear: career.draftYear }];
    Object.values(career.qbsById||{}).forEach(r=>{
      const s = (r.seasons||[]).find(x=>x.year===year);
      if(s) rows.push({ isMine:false, awards: s.awards, s, draftYear: r.draftYear });
    });
    const games = (LEAGUE[decadeForYear(year)]||LEAGUE["2000s"]).games;
    const qualified = rows.filter(r=> (r.s.pa||0) >= games*3.1);
    const pool = qualified.length ? qualified : rows;
    const titleFor = (getVal, label) => {
      const best = Math.max(...pool.map(r=> getVal(r.s)||0));
      if(!(best>0)) return;
      pool.filter(r=> Math.abs((getVal(r.s)||0)-best) < 1e-9).forEach(r=>{
        if(!r.awards.includes(label)) r.awards.push(label);
      });
    };
    titleFor(s=>s.avg, "Batting Title");
    titleFor(s=>s.hr, "Home Run Title");
    titleFor(s=>s.rbi, "RBI Title");

    // Rookie of the Year: best OPS+ among genuine first-year players this season. One league-wide
    // winner, kept simple. A "rookie season" is the earliest year in that player's season log
    // with real playing time.
    const rookieRows = [];
    const playerFirstPlayedYear = (career.seasonLog.find(s=>s.games>0)||{}).year;
    if(playerFirstPlayedYear === year && (season.pa||0) >= 200) rookieRows.push({ awards: season.awards, opsPlus: season.opsPlus||0 });
    Object.values(career.qbsById||{}).forEach(r=>{
      const s = (r.seasons||[]).find(x=>x.year===year);
      if(!s || (s.pa||0) < 200) return;
      const firstYear = Math.min(...r.seasons.filter(x=>(x.games||0)>0).map(x=>x.year));
      if(firstYear === year) rookieRows.push({ awards: s.awards, opsPlus: s.opsPlus||0 });
    });
    if(rookieRows.length){
      const best = Math.max(...rookieRows.map(r=>r.opsPlus));
      if(best > 60) rookieRows.filter(r=>r.opsPlus===best).forEach(r=>{
        if(!r.awards.includes("Rookie of the Year")) r.awards.push("Rookie of the Year");
      });
    }
  }

  // Gold Glove: a player-only self-check (the sim doesn't model rival fielding). Chance scales
  // with the fielding-relevant tools for the player's position -- Arm Strength always, plus Speed
  // for the up-the-middle spots -- gated on a real full-ish season. A DH can't win one.
  function maybeAwardGoldGlove(season){
    if(season.awards.includes("Gold Glove")) return;
    const posDef = (POSITIONS.find(p=>p.key===career.position) || { defWeight:0.5 });
    if(posDef.defWeight <= 0) return; // DH
    if((season.pa||0) < 380) return;
    const eff = eraEffective(season.age, season.decade);
    const upTheMiddle = ["C","2B","SS","CF"].includes(career.position);
    const defScore = eff.ARM*posDef.defWeight + (upTheMiddle ? (eff.MOB-50)*0.35 : 0) + (eff.IMP-50)*0.15;
    const chance = clamp((defScore - 58) * 0.012, 0, 0.34);
    if(Math.random() < chance){
      season.awards.push("Gold Glove");
      career.transactions.push(`${season.year}: Wins a Gold Glove at ${positionLabel(career.position)}.`);
      recordLedgerEvent("award_won", { teamId: season.teamId, outcomeId: "Gold Glove" });
    }
  }

  /* ----- Modern-day NFL record tracking -- a Playtester request: flag it with a badge/star when
     a season or career line actually clears a real modern-NFL record, regardless of what decade
     the simulated season is set in (the point is "that's incredible for ANY era," not just this
     one). A small, well-known set of QB records -- exact figures are approximate/illustrative,
     not a certified stat-encyclopedia, which is fine for a flavor badge like this. ----- */
  function checkSeasonRecords(season){
    const broken = [];
    if(season.hr > MLB_RECORDS.seasonHR.value) broken.push({ key:"hr", ...MLB_RECORDS.seasonHR });
    if(season.rbi > MLB_RECORDS.seasonRBI.value) broken.push({ key:"rbi", ...MLB_RECORDS.seasonRBI });
    if(season.hits > MLB_RECORDS.seasonHits.value) broken.push({ key:"hits", ...MLB_RECORDS.seasonHits });
    if(season.opsPlus > MLB_RECORDS.seasonOPSplus.value) broken.push({ key:"opsPlus", ...MLB_RECORDS.seasonOPSplus });
    if(season.sb > MLB_RECORDS.seasonSB.value) broken.push({ key:"sb", ...MLB_RECORDS.seasonSB });
    return broken;
  }
  function checkCareerRecords(totals){
    const broken = [];
    if(totals.hr > MLB_RECORDS.careerHR.value) broken.push({ key:"hr", ...MLB_RECORDS.careerHR });
    if(totals.hits > MLB_RECORDS.careerHits.value) broken.push({ key:"hits", ...MLB_RECORDS.careerHits });
    if(totals.rbi > MLB_RECORDS.careerRBI.value) broken.push({ key:"rbi", ...MLB_RECORDS.careerRBI });
    return broken;
  }
  function recordBadgeHtml(rec){
    const shownVal = rec.value>=1000 ? rec.value.toLocaleString() : rec.value;
    return `<span class="record-badge" title="MLB Record: ${svgEscape(rec.label)} — held by ${svgEscape(rec.holder)} (${shownVal})">★ MLB Record</span>`;
  }

  /* ----- Sim-historical-best tracking -- distinct from MODERN_NFL_RECORDS above: that one checks
     a season/career line against real-world NFL history, regardless of this playthrough's own
     league. This one checks it against the best THIS PLAYTHROUGH'S simulated league has itself
     produced so far -- the player's own past seasons plus every career.leagueRivals season ever
     logged (retired rivals' history stays in the array, see generateLeagueRivals/
     simulateRivalSeasons) -- scoped either to "best within this decade so far" or "best of
     everything up to and including this decade" (which, since seasons only ever move forward in
     time, is simply the all-time-so-far best). A season can only ever earn ONE sim-best badge per
     stat -- all-time takes priority over decade-only, since clearing the all-time bar always also
     clears the decade bar. ----- */
  function collectAllSimSeasons(){
    const all = career.seasonLog.slice();
    (career.leagueRivals||[]).forEach(r=> all.push(...r.seasons));
    return all;
  }
  const SIM_BEST_METRICS = [
    { key:"hr", label:"Home Runs" },
    { key:"rbi", label:"RBI" },
    { key:"opsPlus", label:"OPS+" },
    { key:"hits", label:"Hits" },
    { key:"sb", label:"Stolen Bases" },
  ];
  function checkSimHistoricalBest(season){
    const all = collectAllSimSeasons();
    // Rival season objects (see simulateRivalSeasons) never stamp a `.decade` field the way the
    // player's own season object does -- derive it from the year instead so rival seasons from
    // the same decade actually count toward the "within this decade" comparison pool, rather than
    // silently only ever comparing the player's own history against itself.
    const seasonDecade = season.decade || decadeForYear(season.year);
    const decadeSeasons = all.filter(s=> (s.decade || decadeForYear(s.year))===seasonDecade);
    const upToDecadeSeasons = all; // every sim season ever logged already happened at or before now
    const best = [];
    SIM_BEST_METRICS.forEach(m=>{
      const val = season[m.key];
      if(!(val>0)) return;
      const allTimeBest = Math.max(0, ...upToDecadeSeasons.map(s=> s[m.key]||0));
      const decadeBest = Math.max(0, ...decadeSeasons.map(s=> s[m.key]||0));
      if(val>=allTimeBest) best.push({ key:m.key, label:m.label, value:val, scope:"all-time" });
      else if(val>=decadeBest) best.push({ key:m.key, label:m.label, value:val, scope:"decade", decade:season.decade });
    });
    return best;
  }
  function simBestBadgeHtml(rec){
    const shownVal = rec.value>=1000 ? rec.value.toLocaleString() : rec.value;
    const scopeText = rec.scope==="all-time" ? "the best this league has ever produced, so far" : `the best this league has produced in the ${rec.decade}, so far`;
    return `<span class="sim-best-badge" title="${svgEscape(rec.label)}: ${shownVal} — ${svgEscape(scopeText)}">◆ ${rec.scope==="all-time"?"League Best":"Decade Best"}</span>`;
  }

  /* ================= League rivals =================
     A lightweight parallel simulation of every OTHER starting QB in the league, built to support
     the League tab's season leaderboard and, down the line, an actual head-to-head rivals mechanic
     (see the "checkbalance for awards" + "rivals" note this was requested from). Rivals don't get
     the player's full 12-attribute build -- a single `talent` scalar (same 10-99 scale) stands in
     for effOverall, seeded off that team's own leagueStrength grade (so good teams tend to roll
     good QBs, same as reality skews) and then aged with the SAME primeMultiplier curve the player's
     own attributes use, so a rival's numbers rise and fall with age the same way. One rival per
     team excluding the player's own; when a rival ages past their (randomly rolled once) retirement
     age, a fresh rookie is generated at that team so the league leaderboard never runs dry across a
     very long player career -- exactly like a real league keeps producing new starters. */
  // A depth-chart bench player -- same shape as a starter (rival) object, minus isRival/succeededId,
  // plus a contract. Never appears in career.leagueRivals (that array means "current starters
  // only" everywhere else in the codebase -- MVP/Pro-Bowl pooling, team-grade drift, the classmates
  // table, etc. -- so folding bench players into it would silently double-count or crown a backup
  // MVP). Lives in career.leagueDepthCharts[teamId] = {qb2, qb3} instead. `isProspect` skews young,
  // rookie-contracted, and wide-variance (a real QB3 flier or a groomed QB2 successor) vs. a
  // veteran journeyman backup skewing older and clearly below the starter's own grade.
  function generateBenchPlayer(teamId, decade, year, teamGrade, isProspect){
    const age = isProspect ? randInt(22,25) : randInt(24,32);
    const talent = isProspect ? clamp(teamGrade + randInt(-10,10), 20, 90) : clamp(teamGrade + randInt(-25,-5), 15, 75);
    const contract = isProspect ? rollRookieDepthContract(decade, randInt(2,7)) : rollRivalContract(decade, talent);
    const bench = {
      id: "bqb_"+teamId+"_"+Math.round(Math.random()*1e6),
      name: randomFullName(), teamId, talent, age,
      retireAge: clamp(age + randInt(3,12), 30, 45),
      draftYear: year - (age-22),
      seasons: [], totals: { games:0, comp:0, att:0, yards:0, td:0, int:0, wins:0, losses:0, ties:0, proBowls:0, allPros:0, mvps:0, rings:0 },
      retired: false, contract, entrenchedYears: rollEntrenchedYears(talent),
    };
    return registerQuarterback(bench);
  }
  // Wave 2A: both bench slots are assigned into the canonical registry (teamQbDepth[teamId].QB2/
  // QB3) here, right where teamId is already known -- the one caller (spawnFreshRival) then still
  // assigns the returned {qb2,qb3} directly onto career.leagueDepthCharts[teamId] itself, which is
  // harmless/redundant with what assignQuarterbackToRoster already wrote there (same objects).
  function generateDepthChart(teamId, decade, year, teamGrade){
    const qb2 = generateBenchPlayer(teamId, decade, year, teamGrade, Math.random()<0.3);
    const qb3 = generateBenchPlayer(teamId, decade, year, teamGrade, Math.random()<0.65);
    assignQuarterbackToRoster(qb2.id, teamId, "QB2");
    assignQuarterbackToRoster(qb3.id, teamId, "QB3");
    return { qb2, qb3 };
  }
  // Rolled once, at draft night, purely to answer "is there already a real starter blocking this
  // rookie at his own team" -- an established veteran (never a rookie; a rookie never blocks
  // another rookie's path this hard), skewed a bit above team grade since a guy entrenched enough
  // to sit a draft pick is probably legitimately good. If he clears the entrenchment bar in the
  // draft-night handler, he's assigned as this team's real QB1 (assignQuarterbackToRoster) and
  // ages/retires/gets fully simulated exactly like any other rival from then on; registered here
  // either way so a discarded (non-entrenched) incumbent still has a stable, harmless registry
  // entry rather than an untracked object -- it's never assigned a roster slot, so it never shows
  // up anywhere with totals.games===0.
  function rollDraftIncumbent(teamId, decade, year, teamGrade){
    const age = randInt(26, 34);
    const talent = clamp(teamGrade + randInt(-10, 20), 20, 99);
    const incumbent = {
      id: "riv_"+teamId+"_incumbent",
      name: randomFullName(), teamId, talent, age,
      retireAge: clamp(age + randInt(3,10), 30, 45),
      draftYear: year-(age-22),
      seasons: [], totals: { games:0, comp:0, att:0, yards:0, td:0, int:0, wins:0, losses:0, ties:0, proBowls:0, allPros:0, mvps:0, rings:0 },
      retired: false, contract: rollRivalContract(decade, talent), entrenchedYears: rollEntrenchedYears(talent),
    };
    return registerQuarterback(incumbent);
  }
  // Builds one fresh rival (+ that team's depth chart) for a team that currently has neither --
  // shared by draft night (generateLeagueRivals), a new franchise's first season
  // (spawnNewFranchiseRivals), and whenever the player's own team change leaves a team without a
  // starter (reassignRivalsForTeamChange). Age skews veteran-ish (23-34) rather than rookie-only,
  // matching how a real roster -- whether a fresh expansion team or a team that just lost its guy
  // in a trade -- is stocked from a mix of available veterans, not exclusively rookies. Callers are
  // responsible for assigning the returned rival to QB1 (assignQuarterbackToRoster) -- this
  // function only registers him and builds his bench.
  function spawnFreshRival(teamId, decade, year, idSuffix){
    const teamGrade = career.leagueStrength[teamId] ?? 60;
    const age = randInt(23, 34);
    const talent = clamp(teamGrade + randInt(-15, 15), 20, 99);
    if(!career.leagueDepthCharts) career.leagueDepthCharts = {};
    career.leagueDepthCharts[teamId] = generateDepthChart(teamId, decade, year, teamGrade);
    const rival = {
      id: "riv_"+teamId+"_"+idSuffix,
      name: randomFullName(),
      teamId,
      talent,
      age,
      // Guarantee at least a few seasons of runway from age -- age alone can already be as high
      // as 34 here, and an unguarded randInt(30,40) could land BELOW that, retiring a rival on the
      // very first simulateRivalSeasons() tick before he's ever played a game (zero career stats,
      // yet still shown as that team's real starter in that season's schedule/playoff matchups,
      // since rivalForTeam() only checks `retired`, not games played -- a "phantom starter" bug).
      retireAge: clamp(age + randInt(3, 12), 30, 45),
      draftYear: year - (age-22),
      seasons: [],
      totals: { games:0, comp:0, att:0, yards:0, td:0, int:0, wins:0, losses:0, ties:0, proBowls:0, allPros:0, mvps:0, rings:0 },
      retired: false,
      contract: rollRivalContract(decade, talent),
      entrenchedYears: rollEntrenchedYears(talent),
    };
    return registerQuarterback(rival);
  }
  function generateLeagueRivals(){
    career.leagueDepthCharts = {};
    // Only teams that actually exist as of draft night get a rival here -- a franchise born LATER
    // (a real expansion year, e.g. 1976 Seahawks/Buccaneers, 1995 Panthers/Jaguars, 1996 Ravens,
    // 2002 Texans) gets its starter spawned lazily by spawnNewFranchiseRivals() the season it
    // actually joins instead. Pre-generating one for every team in TEAMS regardless of era used to
    // let a not-yet-founded team's "QB" rack up seasons, stats, and awards for years before the
    // team existed -- a real, user-reported bug (a 1965-decade league table listing the Seattle
    // Seahawks and Tampa Bay Buccaneers, both 11 years from existing).
    const rivals = TEAMS.filter(t=>t.id!==career.teamId && t.start<=career.year).map((t,i)=>
      spawnFreshRival(t.id, career.decade, career.year, i));
    // Three marked "rivals" (distinct from the other ~28 background league QBs) get their draft
    // year pinned to the SAME year the player was drafted -- a true draft classmate, the natural
    // seed for a future head-to-head rivalry mechanic (shared history, same age curve, same era).
    const classmates = rivals.slice().sort(()=>Math.random()-0.5).slice(0, Math.min(3, rivals.length));
    classmates.forEach(r=>{ r.isRival = true; r.age = 22; r.draftYear = career.year; r.retireAge = randInt(32, 42); });
    return rivals;
    // NOTE: callers assign each returned rival to QB1 (career init does this right after calling
    // generateLeagueRivals -- see there) -- this function only builds and registers them.
  }
  // A new franchise joining the league THIS season needs a starter too, same as any other team --
  // generateLeagueRivals() only seeds teams that already existed at draft night (see above), so a
  // team born mid-career needs to be picked up here the exact season it arrives. Skips the
  // player's own team: if they were just expansion-drafted onto this exact franchise this exact
  // season, they ARE its starter, not an AI rival sharing the slot.
  function spawnNewFranchiseRivals(year){
    if(!career.leagueRivals) return;
    const decade = decadeForYear(year);
    // Self-heal: an ALREADY-in-progress save started before this filtering existed (or before this
    // whole system existed) can still have an active rival sitting on a team that hasn't joined
    // the league yet as of `year` -- generateLeagueRivals() only stops the bug for careers
    // generated from here on, it can't retroactively clean data a save already has. Retiring it the
    // moment its team is found not to exist yet means an existing save self-corrects on its very
    // next season instead of needing a fresh career, the same "repair going forward" approach as
    // the Round 11 safeNum fix. Once its team's real start year arrives, the block below spawns it
    // a brand-new (correctly-aged) rival exactly like any other new franchise.
    career.leagueRivals.forEach(r=>{
      if(r.retired) return;
      const t = TEAMS.find(x=>x.id===r.teamId);
      if(t && t.start>year) retireQuarterback(r.id, "not-yet-founded");
    });
    // Wave 3 (MASTER_REMEDIATION_SPEC.md, required design #4): this used to gate on an EXACT
    // `t.start===year` match -- a confirmed defect if the calendar ever advances across a
    // franchise's start year without calling this for every intermediate year individually (a
    // multi-season suspension/injury-leave used to do exactly that before this same wave's
    // simulateLeagueYearWithoutUser started calling generateSeason -- and hence this -- once per
    // year even during an absence; kept as defense-in-depth here regardless, since any other future
    // code path that skips a year would hit the identical bug). Idempotent catch-up instead: any
    // team already born (`t.start<=year`) that still has no starter gets one, regardless of whether
    // this is its exact founding year or a later catch-up.
    TEAMS.forEach(t=>{
      if(t.id===career.teamId) return;
      if(t.start>year) return;
      if(rivalForTeam(t.id)) return;
      const nr = spawnFreshRival(t.id, decade, year, "new"+year);
      assignQuarterbackToRoster(nr.id, t.id, "QB1");
    });
  }
  // Called at every site where the PLAYER changes teams (trade, waiver pickup, free-agent sign,
  // expansion draft) -- career.leagueRivals means "the other teams' starters," one per team, with
  // the player filling whichever slot is their own. Without this, the AI rival who already
  // occupied the team the player is JOINING kept generating a full starter's stats/awards
  // alongside the player for the very same team (the reported "another Miami Dolphins QB got a
  // Pro Bowl over me" bug), while the team the player just LEFT was quietly left with no starter
  // at all. Skipped while career.isBackup is true -- that's the one deliberate exception where an
  // incumbent is SUPPOSED to share the player's own team slot (see Round 7 notes).
  // Phase 2 of the QB-entity redesign: a QB who loses his job doesn't just vanish into a plain
  // "retired" flag -- if he's still plausibly good enough to play (rivalEffTalent>=50) and hasn't
  // hit his own retireAge yet, he goes into career.freeAgentPool instead, a shared jobless-QB
  // portal any team might sign him from later (see resolveFreeAgentPool). Wave 2A: this now
  // delegates to the canonical moveQuarterbackToFreeAgency/retireQuarterback helpers instead of
  // hand-flipping entity.retired -- free agency is no longer represented by the same flag as a
  // genuine retirement (Section 4's named defect), even though every existing call site's own
  // signature/behavior is unchanged.
  function enterFreeAgentPool(entity, reason){
    if(!entity || !entity.id) return;
    if(!career.qbsById || !career.qbsById[entity.id]) registerQuarterback(entity);
    const stillViable = rivalEffTalent(entity)>=50 && entity.age<entity.retireAge;
    if(!stillViable){ retireQuarterback(entity.id, reason); return; }
    moveQuarterbackToFreeAgency(entity.id, reason);
  }
  function reassignRivalsForTeamChange(oldTeamId, newTeamId){
    if(!career.leagueRivals || career.isBackup) return;
    const decade = decadeForYear(career.year);
    const incoming = rivalForTeam(newTeamId);
    if(incoming) enterFreeAgentPool(incoming, "displaced");
    if(oldTeamId && oldTeamId!==newTeamId && !rivalForTeam(oldTeamId)){
      const nr = spawnFreshRival(oldTeamId, decade, career.year, "repl"+career.year);
      assignQuarterbackToRoster(nr.id, oldTeamId, "QB1");
    }
  }
  // Shared per-player season-stat math -- originally inline in simulateRivalSeasons, extracted so
  // depth-chart bench players (simulateDepthChartSeasons) can run the IDENTICAL formula instead of
  // a parallel copy. Mutates entity.seasons/totals/age and returns the season object (callers that
  // need "how did he actually play this year" for a succession decision use the return value).
  function simulatePlayerSeasonStats(entity, decade, league, year, forcedGames){
    const talentEdge = entity.talent - 65;
    const ageMult = primeMultiplier(entity.age);
    const delta = talentEdge*ageMult;
    const cal = STAT_CAL[decade] || STAT_CAL["2000s"];
    // These four rates are THIS entity's own talent/age/era-derived expectation -- exactly the
    // shape generateSeason() computes for the player before that season's own variance is layered
    // on. Balance Wave 2 (AI parity): a real season-level performance swing around that expectation
    // is rolled below and applied on top, so an AI QB's ACTUAL production can differ from what his
    // talent alone would predict -- without that gap, performanceIndex would always land at exactly
    // 0 ("met expectations"), which would make the shared earned-breakthrough path structurally
    // unreachable for AI regardless of any gating, not just rare. This is the one piece Wave 1 left
    // unaddressed in "one shared development model for the player and AI."
    const lgIso = Math.max(0.05, league.slg - league.avg);
    const expectedComp = clamp(league.avg + delta*(delta>=0?cal.avg.up:cal.avg.down)*RIVAL_STAT_SCALE, cal.avg.lo, cal.avg.hi);       // AVG
    const expectedYpa  = clamp(lgIso + delta*(delta>=0?cal.iso.up:cal.iso.down)*RIVAL_STAT_SCALE, cal.iso.lo, cal.iso.hi);            // ISO
    const expectedTdRate = clamp(league.hrRate + delta*(delta>=0?cal.hr.up:cal.hr.down)*RIVAL_STAT_SCALE, cal.hr.lo, cal.hr.hi);      // HR/PA
    const expectedBbRate = clamp(league.bbRate + delta*(delta>=0?cal.bb.up:cal.bb.down)*RIVAL_STAT_SCALE, cal.bb.lo, cal.bb.hi);      // BB/PA
    const expectedIntRate = clamp(league.kRate - delta*(delta>=0?cal.k.up:cal.k.down)*RIVAL_STAT_SCALE, cal.k.lo, cal.k.hi);          // K/PA
    // Bell-shaped, mean 0, in [-1,1] -- the same three-uniform-average technique used for devSpeed
    // and for the balance audit's own ordinary-variance model (see scripts/balance-audit.mjs).
    const performanceIndexRoll = clamp(((Math.random()+Math.random()+Math.random())/3)*2-1, -1, 1);
    const perfSwingMultiplier = clamp(1 + performanceIndexRoll*0.22, 0.78, 1.22);
    const avgR = clamp(expectedComp*perfSwingMultiplier, cal.avg.lo, cal.avg.hi);
    const isoR = clamp(expectedYpa*perfSwingMultiplier, cal.iso.lo, cal.iso.hi);
    const hrRateR = clamp(expectedTdRate*perfSwingMultiplier, cal.hr.lo, cal.hr.hi);
    const bbRateR = clamp(expectedBbRate*perfSwingMultiplier, cal.bb.lo, cal.bb.hi);
    const kRateR = clamp(expectedIntRate*(2-perfSwingMultiplier), cal.k.lo, cal.k.hi);
    if(entity.volumeLean==null) entity.volumeLean = rollVolumeLean();
    const attPerGame = clamp(league.paPerGame + entity.volumeLean*0.45 + randInt(-1,1)*0.15, 2.4, 4.9);
    // forcedGames (Part C of the bench-realism fix): when a caller already knows exactly how many
    // real games this entity played -- specifically a bench QB inheriting the starter's own missed
    // games as his relief appearances -- use that directly instead of rolling an independent
    // missed-games chance. Every existing call site omits this and keeps the original behavior.
    // Miss-chance/range widened in the stat-realism pass -- a meaningful fraction of a ~30-rival
    // league should have SOME missed time in a given year (injury, benching, a QB change), not
    // just 1 in 6, both because that's more realistic and because it further trims how many rivals
    // ever accumulate a full-slate's worth of attempts in the same season.
    // Wave 3 (MASTER_REMEDIATION_SPEC.md, required design #5/#6): this used to just be an anonymous
    // missed-games count with no reason attached anywhere -- "AI injuries are represented only as
    // anonymous random missed games... no persistent injury type... or suspension state." Now rolls
    // a real, distinct reason (injury -- reusing the same INJURY_TYPES table the player's own
    // injury system uses, so an AI QB's injury reads as the exact same kind of thing the user's own
    // could be -- or, much more rarely, a suspension, using neutral labels rather than a fabricated
    // narrative incident, since giving every background AI player their own scripted scandal is a
    // product decision the spec itself flags as needing confirmation, not an engineering detail;
    // revisit if the user wants full narrative incidents for AI suspensions too) and stores it on
    // entity.availability -- a single-season-scoped snapshot of WHY he missed time this year (not
    // multi-season persistent tracking, matching how missedGames itself was already single-season-
    // scoped before this wave). forcedGames callers (a bench QB inheriting relief snaps, or the
    // planned backup incumbent) never roll or overwrite this -- they didn't "miss" anything, they
    // were simply never given the games in the first place.
    let missedGames = 0, availabilityReason = null, availabilityLabel = null;
    if(forcedGames==null && Math.random()<0.30){
      missedGames = randInt(1, 9);
      const isSuspension = Math.random()<0.12;
      if(isSuspension){
        availabilityReason = "suspension";
        availabilityLabel = pick(AI_SUSPENSION_REASONS);
      } else {
        availabilityReason = "injury";
        availabilityLabel = rollInjuryType().name;
      }
    }
    entity.availability = missedGames>0 ? { reason: availabilityReason, label: availabilityLabel, gamesMissed: missedGames, year } : null;
    const gamesPlayed = forcedGames!=null ? clamp(forcedGames, 0, league.games) : clamp(league.games - missedGames, 0, league.games);
    const pa = Math.round(attPerGame*gamesPlayed);
    const walks = Math.max(0, Math.round(pa*bbRateR));
    const hbp = Math.round(pa*0.009), sf = Math.round(pa*0.006);
    const ab = Math.max(0, pa - walks - hbp - sf);
    const hits = clamp(Math.round(ab*avgR), 0, ab);
    const hr = clamp(Math.round(pa*hrRateR), 0, hits);
    const strikeouts = Math.max(0, Math.round(pa*kRateR));
    const tbTarget = Math.round(ab*(avgR+isoR));
    let doubles = clamp(Math.round((tbTarget - hits - 3*hr)/2), 0, Math.max(0, hits-hr));
    const triples = clamp(Math.round((entity.talent-72)*0.05 + Math.random()*3), 0, Math.max(0, hits-hr-doubles));
    const singles = Math.max(0, hits - hr - doubles - triples);
    const tbActual = singles + 2*doubles + 3*triples + 4*hr;
    const sbAtt = Math.max(0, Math.round(gamesPlayed * clamp((entity.talent-70)*0.006, 0, 0.55)));
    const sb = Math.round(sbAtt*0.72), cs = Math.max(0, sbAtt - sb);
    const obp = clamp((hits+walks+hbp)/Math.max(1, ab+walks+hbp+sf), 0, 1);
    const slg = ab>0 ? tbActual/ab : 0;
    const thin = pa < 25;
    const opsPlus = thin ? 0 : Math.round(100*(obp/Math.max(0.001,league.obp) + slg/Math.max(0.001,league.slg) - 1));
    const rbi = thin ? 0 : Math.max(0, Math.round(hr*1.5 + doubles*0.55 + triples*0.5 + singles*0.19 + (entity.talent-65)*0.4));
    const runs = thin ? 0 : Math.max(0, Math.round((hits+walks)*0.33 + hr*0.5 + sb*0.24 + (entity.talent-65)*0.3));
    // Legacy slot aliases (att=PA, comp=hits, yards=TB, td=HR, int=K) so shared distribution and
    // render code keeps working.
    const attempts = pa, completions = hits, yards = tbActual, td = hr, interceptions = strikeouts;
    const rating = opsPlus;
    // This is a placeholder win/loss, used only to feed evaluateSeasonAwards below -- the CALLER
    // (simulateRivalSeasons/simulateDepthChartSeasons) overwrites season.wins/losses/winPct right
    // after this returns with an EXACT count from the real per-game schedule
    // (career.currentSeasonSchedules), via reconcileWinLossFromGames -- see the comment there for why
    // a placeholder is needed here at all (awards eligibility needs SOME winPct before the caller
    // knows which of the team's real games this entity actually played).
    const teamGrade = career.leagueStrength[entity.teamId] ?? 60;
    const winProb = clamp(0.5 + talentEdge*ageMult*0.009 + (teamGrade-65)*0.009, 0.08, 0.92);
    let wins = 0;
    for(let i=0;i<gamesPlayed;i++){ if(Math.random()<winProb) wins++; }
    const losses = gamesPlayed-wins;
    const winPct = gamesPlayed>0 ? wins/gamesPlayed : 0;
    const { awards, proBowlScore, proBowlEligible, allProScore, allProEligible, mvpScore, mvpEligible } = evaluateSeasonAwards({
      rating, td, winPct, attempts, gamesPlayed, leagueGames: league.games, decade, teamOverall: teamGrade,
    });
    // Same function, same shape, as the player's own developmentReport -- real actual production
    // (post-perfSwingMultiplier) against this entity's clean talent-derived expectation. Stashed on
    // the season row so developEntityTalent (called right after this by every caller) can read it
    // without recomputing it a second time or drifting from a slightly different formula.
    const performance = evaluatePerformanceOverExpectation({
      actual: { attempts, completions, yards, touchdowns: td, interceptions },
      expected: { completionPct: expectedComp, yardsPerAttempt: (expectedComp+expectedYpa), touchdownRate: expectedTdRate, interceptionRate: expectedIntRate },
      leagueGames: league.games,
    });
    // nextBreakthroughMomentum (called from developEntityTalent, right after this returns) needs
    // this season's own games-played share, same input the player's own momentum update uses.
    performance.gamesPlayed = gamesPlayed;
    performance.leagueGames = league.games;
    // Wave 4 (MASTER_REMEDIATION_SPEC.md, required design #5): ties:0 is a real default here, not
    // an afterthought -- reconcileWinLossFromGames normally overwrites it with the real count right
    // after this returns, but the rare case where NO real weeks ever get tagged to this entity this
    // season (an incumbent planned for zero games, or any other zero-relief-weeks edge case) skips
    // that call entirely, which used to leave this season row with no ties field at all.
    const season = { year, age: entity.age, teamId: entity.teamId, games: gamesPlayed, comp: completions, att: attempts,
      pct: ab>0?hits/ab:0, yards, td, int: interceptions, rating, wins, losses, ties:0, awards,
      pa, ab, hits, singles, doubles, triples, hr, bb: walks, hbp, sf, k: strikeouts, sb, cs, rbi, runs,
      avg: ab>0?hits/ab:0, obp, slg, ops: obp+slg, opsPlus,
      proBowlScore, proBowlEligible, allProScore, allProEligible, mvpScore, mvpEligible, performance };
    // Wave 2B (MASTER_REMEDIATION_SPEC.md, Section 3 invariant #6 / Section 7 required design #4):
    // a (qbId, year) pair must never get a second season row. This used to be reachable for real --
    // resolveBackupSeasonSnaps simulated the player's own team's incumbent directly, and this same
    // function ran AGAIN for that identical entity/year inside simulateRivalSeasons right after --
    // fixed at the root by making resolveBackupSeasonSnaps pure planning (see there) instead of a
    // second simulation, but this guard stays as the actual enforced invariant: if some future
    // caller (or a resumed save with pre-existing corrupted data) ever asks to simulate an entity
    // for a year it already has a row for, this is a safe no-op that returns the EXISTING row
    // (never a silent double-count of games/totals/age) with a diagnostic warning, rather than a
    // hard throw that could crash a real player's session over a bug in surrounding code.
    const existing = entity.seasons.find(s=>s.year===year);
    if(existing){
      console.warn(`[validateLeagueState] simulatePlayerSeasonStats: ${entity.id||"(no id)"} already has a season row for ${year} -- skipping duplicate simulation.`);
      if(!career._devWarnings) career._devWarnings = [];
      career._devWarnings.push({ type:"duplicate-season-simulation-prevented", qbId: entity.id||null, year });
      return existing;
    }
    entity.seasons.push(season);
    entity.totals.games += gamesPlayed; entity.totals.comp += completions; entity.totals.att += attempts;
    entity.totals.yards += yards; entity.totals.td += td; entity.totals.int += interceptions;
    entity.totals.wins += wins; entity.totals.losses += losses;
    entity.totals.bb = (entity.totals.bb||0) + walks;
    entity.totals.ab = (entity.totals.ab||0) + ab;
    entity.totals.doubles = (entity.totals.doubles||0) + doubles;
    entity.totals.triples = (entity.totals.triples||0) + triples;
    entity.totals.sb = (entity.totals.sb||0) + sb;
    entity.totals.cs = (entity.totals.cs||0) + cs;
    entity.totals.rbi = (entity.totals.rbi||0) + rbi;
    entity.totals.runs = (entity.totals.runs||0) + runs;
    // Pro Bowl/All-Pro/MVP totals are incremented once, league-wide, by
    // resolveSeasonAllProAndProBowl/resolveSeasonMVP after every QB's season this year is locked in
    // -- bench players are never in that pool (they're not in career.leagueRivals), so their
    // awards/eligibility fields above are computed but never actually granted, which is fine.
    entity.age++;
    return season;
  }
  function simulateRivalSeasons(decade, league, year){
    if(!career.leagueRivals) return;
    career.leagueRivals.forEach(r=>{
      if(r.retired) return;
      if(r.age > r.retireAge){
        // Wave 2A: retireQuarterback keeps him permanently discoverable by id (retiredQbIds/
        // qbsById) instead of just flipping a flag on an object nothing else indexes by id.
        retireQuarterback(r.id, "age");
        // replace with a fresh rookie at the same team so the league doesn't thin out over a
        // 20-season player career -- the new starter takes over the same roster spot.
        const teamGrade = career.leagueStrength[r.teamId] ?? 60;
        const newTalent = clamp(teamGrade + randInt(-15,15), 20, 99);
        // A concrete, legible reason a team's grade moves: losing a known, age-adjusted starter
        // for an unproven rookie is a real transition, not neutral -- how big a deal it is depends
        // on how much the succession actually downgrades (or upgrades) the position. Scaled by era
        // volatility too -- an unscaled succession jump was a real, previously era-blind source of
        // sudden large team-strength swings.
        const successionNudge = Math.round((newTalent - rivalEffTalent(r)) * 0.3 * (ERA_TEAM_VOLATILITY[decade] ?? 1.0));
        // Wave 5: lands on the five persistent components, never leagueStrength directly.
        adjustTeamStrength(r.teamId, successionNudge, 0);
        const successor = {
          id: "riv_"+r.teamId+"_"+year, name: randomFullName(), teamId: r.teamId,
          talent: newTalent, age: 22, retireAge: randInt(30,40),
          draftYear: year, seasons: [], totals: { games:0, comp:0, att:0, yards:0, td:0, int:0, wins:0, losses:0, ties:0, proBowls:0, allPros:0, mvps:0, rings:0 },
          retired: false, succeededId: r.id, contract: rollRookieDepthContract(decade, randInt(1,4)), entrenchedYears: rollEntrenchedYears(newTalent),
        };
        registerQuarterback(successor);
        assignQuarterbackToRoster(successor.id, r.teamId, "QB1");
        return;
      }
      // Wave 2B: if this rival is ALSO the incumbent blocking the player at their own team this
      // exact year, resolveBackupSeasonSnaps already planned (not simulated) how many games he
      // gets -- pass it in as forcedGames so this is the ONE place he's ever actually simulated,
      // instead of a second independent roll.
      const isBackupIncumbent = career.isBackup && career._backupUsagePlan && r.id===career._backupUsagePlan.qbId;
      const seasonResult = simulatePlayerSeasonStats(r, decade, league, year, isBackupIncumbent ? career._backupUsagePlan.games : undefined);
      developEntityTalent(r, decade, seasonResult.performance);
      // Wave 3 (MASTER_REMEDIATION_SPEC.md, exit criterion: "AI injury/suspension status is visible
      // on the player profile and transaction/history surfaces"): r.availability was just set (or
      // cleared) inside simulatePlayerSeasonStats -- the player profile already reads it directly
      // (see buildRivalProfileHTML), so this is the transaction/HISTORY half specifically. Scoped to
      // real starters only (not bench relief players, who'd make this log too noisy) since a QB1
      // missing real time is genuine team news the same way a trade or succession event is.
      if(r.availability){
        career.leagueNewsLog.push({ year, teamId: r.teamId,
          title: r.availability.reason==="suspension" ? "Regular Suspended" : "Regular Hits the IL",
          delta: 0,
          flavor: r.availability.reason==="suspension"
            ? `${teamNameAt(r.teamId, year)} starter ${r.name} is suspended for part of the season (${r.availability.label}).`
            : `${teamNameAt(r.teamId, year)} starter ${r.name} misses time with ${r.availability.label.toLowerCase()}.` });
      }
      if(isBackupIncumbent){
        // The games he DIDN'T start this season went to the PLAYER (a different entity entirely,
        // already reflected on career.currentSeasonSchedules[r.teamId] -- which IS career.teamId's
        // own real per-game log here -- via simulateRegularSeasonGames's own startedByBackup/qbId
        // tagging, done earlier this same generateSeason() call). That is NOT this team's actual
        // QB2/QB3 taking relief snaps, so the normal missedGames-to-bench-relief logic below must
        // never run for him -- distribute his real stat line only across the exact weeks already
        // tagged with his id.
        const teamGames = career.currentSeasonSchedules && career.currentSeasonSchedules[r.teamId];
        const hisWeeks = (teamGames||[]).filter(g=>g.qbId===r.id);
        if(hisWeeks.length){
          applyStatLineToGames(hisWeeks, r.id, seasonResult.comp, seasonResult.att, seasonResult.yards, seasonResult.td, seasonResult.int);
          reconcileWinLossFromGames(r, seasonResult, hisWeeks, decade, league.games);
        }
        return;
      }
      // Whatever games the starter's OWN missed-games roll took away from him this season are real,
      // actually-played relief snaps for QB2 -- never QB3, matching real depth charts (a team's
      // third QB essentially never plays). This tags the EXACT weeks on the team's real schedule
      // (career.currentSeasonSchedules, built by buildScheduleResults earlier this same season) so a
      // Schedule-tab view of this team shows the correct QB for every single game, not just a count.
      const missedGames = league.games - seasonResult.games;
      const teamGames = career.currentSeasonSchedules && career.currentSeasonSchedules[r.teamId];
      const chart = career.leagueDepthCharts[r.teamId];
      // Wave 3 (MASTER_REMEDIATION_SPEC.md, required design #7): "QB2 receives exact relief weeks;
      // QB3 receives them if QB2 is also unavailable." Before this wave, an unavailable/retired QB2
      // meant these relief snaps went to NOBODY -- QB3 was never considered as a fallback, so the
      // missed games' box score just showed no attributed passer at all.
      const qb2 = chart && chart.qb2 && !chart.qb2.retired ? chart.qb2 : null;
      const qb3 = chart && chart.qb3 && !chart.qb3.retired ? chart.qb3 : null;
      const reliefTarget = qb2 || qb3;
      if(teamGames && teamGames.length){
        let starterWeeks = teamGames, reliefWeeks = [];
        if(missedGames>0 && reliefTarget){
          const start = randInt(0, Math.max(0, teamGames.length-missedGames));
          reliefWeeks = teamGames.slice(start, start+missedGames);
          starterWeeks = teamGames.filter(g=>!reliefWeeks.includes(g));
        }
        applyStatLineToGames(starterWeeks, r.id, seasonResult.comp, seasonResult.att, seasonResult.yards, seasonResult.td, seasonResult.int);
        reconcileWinLossFromGames(r, seasonResult, starterWeeks, decade, league.games);
        if(reliefWeeks.length>0 && reliefTarget){
          reliefTarget._reliefGames = reliefWeeks.length;
          reliefTarget._reliefWeeks = reliefWeeks;
        }
      } else if(missedGames>0 && reliefTarget){
        // Defensive fallback (should never fire -- buildScheduleResults always builds a log for
        // every team currently in the league): no real schedule to tag against, so relief duty is
        // still credited by count only, same as before this round's per-game attribution existed.
        reliefTarget._reliefGames = missedGames;
      }
    });
  }

  // Bench-player equivalent of simulateRivalSeasons -- same math (simulatePlayerSeasonStats), much
  // simpler retirement handling (no team-grade impact, no news; a bench player quietly ages out and
  // is replaced by a fresh prospect at the same slot). Never touches career.leagueRivals.
  // Part C of the bench-realism fix: a bench player ONLY gets a real stat-line this season if
  // simulateRivalSeasons (called just before this, same season loop) tagged him with real relief
  // games (`_reliefGames`, from the starter's own missed-games roll) -- otherwise he genuinely
  // didn't play, so he gets no season entry at all (not a zero-stat one), matching "no stats
  // because he didn't play." He still ages and develops either way -- prospects don't stop growing
  // just because they didn't see the field this year.
  function simulateDepthChartSeasons(decade, league, year){
    if(!career.leagueDepthCharts) return;
    Object.keys(career.leagueDepthCharts).forEach(teamId=>{
      // Same self-heal as spawnNewFranchiseRivals: an existing save from before that filtering
      // existed can still have a depth chart keyed under a team that hasn't joined the league yet
      // as of `year` -- just leave it dormant (don't age/simulate bench players for a team that
      // doesn't exist) rather than deleting it, since spawnFreshRival will overwrite it correctly
      // once that team's real start year arrives.
      const t = TEAMS.find(x=>x.id===teamId);
      if(t && t.start>year) return;
      const chart = career.leagueDepthCharts[teamId];
      ["qb2","qb3"].forEach(slot=>{
        const p = chart[slot];
        if(!p || p.retired) return;
        if(p.age > p.retireAge){
          // Wave 2A fix: the departing bench player used to just be overwritten here with no
          // retirement/free-agency record anywhere -- unreachable by id, invisible to All-Time even
          // though he may have actually played real relief games. retireQuarterback keeps him
          // permanently discoverable before the slot moves on.
          retireQuarterback(p.id, "age");
          const teamGrade = career.leagueStrength[teamId] ?? 60;
          const repl = generateBenchPlayer(teamId, decade, year, teamGrade, slot==="qb3" ? Math.random()<0.65 : Math.random()<0.3);
          assignQuarterbackToRoster(repl.id, teamId, slot==="qb2"?"QB2":"QB3");
          return;
        }
        let reliefResult = null;
        if(p._reliefGames>0){
          reliefResult = simulatePlayerSeasonStats(p, decade, league, year, p._reliefGames);
          if(p._reliefWeeks && p._reliefWeeks.length){
            applyStatLineToGames(p._reliefWeeks, p.id, reliefResult.comp, reliefResult.att, reliefResult.yards, reliefResult.td, reliefResult.int);
            reconcileWinLossFromGames(p, reliefResult, p._reliefWeeks, decade, league.games);
          }
        } else {
          p.age++;
        }
        developEntityTalent(p, decade, reliefResult ? reliefResult.performance : null);
        p._reliefGames = 0;
        p._reliefWeeks = null;
      });
    });
  }

  /* ----- AI development uses the same age curve and development-speed range as the player.
     Rival and bench QBs still use one scalar instead of twelve attributes, but its drift is the
     exact football-overall-weighted average of those attribute groups. This prevents either side
     from receiving a categorically more generous career model. Fields are initialized lazily so
     existing saves migrate on read without a destructive save-version reset. ----- */
  // `performance` is this entity's own evaluatePerformanceOverExpectation result for the season
  // just played (see simulatePlayerSeasonStats), or null for an entity that didn't play at all this
  // year (a bench player with no relief games -- ages/drifts on the ordinary curve exactly like
  // before, just with nothing to evaluate, same as the player's own <20-attempt neutral fallback).
  function developEntityTalent(entity, decade, performance){
    if(entity.devSpeed==null) entity.devSpeed = rollDevSpeed();
    if(entity.durability==null) entity.durability = clamp(Math.round((Math.random()+Math.random()+Math.random())/3*79)+20, 20, 99);
    if(entity._originalTalent==null) entity._originalTalent = entity.talent;
    if(entity._devCarry==null) entity._devCarry = 0;
    if(entity._talentCeilingBonus==null) entity._talentCeilingBonus = 0;
    if(entity.breakthroughMomentum==null) entity.breakthroughMomentum = 0;
    if(entity._earnedBreakthroughCount==null) entity._earnedBreakthroughCount = 0;
    entity.devSpeed = clamp(entity.devSpeed, 0.6, 1.4);

    // The scalar gets the exact physical/accuracy/mental weighted average of the
    // player's development curves. This keeps AI and player progression on the
    // same scale while preserving the lighter-weight AI representation.
    const teamGrades = career.leagueTeamGrades && career.leagueTeamGrades[entity.teamId];
    const coachingMult = developmentCoachingMultiplier(teamGrades ? teamGrades.coaching : 60);
    // Balance Wave 2 (AI parity): ordinary growth also responds to performance vs. this entity's
    // own expectation, exactly like the player's performanceMultiplier -- meeting expectation is
    // neutral, crushing or missing it nudges the season's growth up or down by the same +/-22%.
    const performanceGrowthMultiplier = performance ? clamp(1 + performance.index*0.22, 0.78, 1.22) : 1;
    const variance = 0.85 + Math.random()*0.3;
    entity._devCarry += developmentBaseForOverall(entity.age) * entity.devSpeed * coachingMult * performanceGrowthMultiplier * variance;
    const whole = Math.trunc(entity._devCarry);
    if(whole!==0){
      entity._devCarry -= whole;
      const lo = clamp(entity._originalTalent-18, 15, 99);
      const hi = clamp(entity._originalTalent+Math.round(11*entity.devSpeed)+entity._talentCeilingBonus, 15, 99);
      entity.talent = clamp(entity.talent+whole, lo, hi);
    }

    const swingChance = developmentSwingChance(entity.devSpeed, entity.age, "normal");
    if(Math.random()<swingChance){
      const isBreakout = Math.random()<clamp(0.5+(entity.devSpeed-1)*0.25, 0.30, 0.70);
      const breakoutAllowed = (entity._breakoutCount||0)<2 && (!(entity._breakoutCount||0) || Math.random()<0.15);
      if(isBreakout && breakoutAllowed){
        entity.talent = clamp(entity.talent + randInt(1,2), 15, clamp(entity._originalTalent+18+entity._talentCeilingBonus,15,99));
        entity._breakoutCount = (entity._breakoutCount||0)+1;
      } else if(!isBreakout && (entity._bustCount||0)<2){
        entity.talent = clamp(entity.talent - randInt(1,2), clamp(entity._originalTalent-24,15,99), 99);
        entity._bustCount = (entity._bustCount||0)+1;
      }
    }

    // Balance Wave 2 (AI parity): the same rare, hard-gated earned-breakthrough path the player's
    // offseason program can unlock -- identical shared gating functions/thresholds
    // (nextBreakthroughMomentum/earnedBreakthroughChance from src/sim/development.js), applied to
    // the single talent scalar instead of picking several attribute keys, since that's the whole
    // point of AI using one lighter-weight number. No devSpeed self-amplification here either.
    if(performance){
      entity.breakthroughMomentum = nextBreakthroughMomentum(entity.breakthroughMomentum, performance.index, performance.gamesPlayed, performance.leagueGames);
      const chance = earnedBreakthroughChance({
        momentum: entity.breakthroughMomentum, performanceIndex: performance.index, age: entity.age,
        devSpeed: entity.devSpeed, planId: "balanced", count: entity._earnedBreakthroughCount,
      });
      if(chance>0 && Math.random()<chance){
        const gain = 3+Math.floor(Math.random()*4);
        entity._talentCeilingBonus = clamp(entity._talentCeilingBonus+gain, 0, 30);
        entity.talent = clamp(entity.talent+gain, 15, 99);
        entity._earnedBreakthroughCount++;
        entity.breakthroughMomentum = Math.max(0, entity.breakthroughMomentum-45);
      }
    }
  }
  // Balance Wave 2: old saves enter the agency system at a neutral baseline.
  // Mark the current year as already prepared so loading an existing season
  // never applies a surprise wear/chemistry change retroactively.
  function migrateDevelopmentAgency(careerObj){
    if(!careerObj) return;
    if(!DEVELOPMENT_PLAN_LIST.some(plan=>plan.id===careerObj.developmentPlan)) careerObj.developmentPlan = "balanced";
    if(careerObj.teamChemistry==null) careerObj.teamChemistry = 50;
    if(careerObj.breakthroughMomentum==null) careerObj.breakthroughMomentum = 0;
    if(careerObj._earnedBreakthroughCount==null) careerObj._earnedBreakthroughCount = 0;
    if(!careerObj.devCeilingBonus) careerObj.devCeilingBonus = {};
    if(careerObj._developmentPlanAppliedYear==null) careerObj._developmentPlanAppliedYear = careerObj.year;
    // Balance Wave 4: same self-heal -- an old save enters cap/coordinator tracking neutral, and the
    // carousel check is marked already-done for the current year so resuming mid-season never rolls
    // a surprise coaching hit off a stale/missing playoffs record from before this wave existed.
    if(careerObj.capPressure==null) careerObj.capPressure = 0;
    if(careerObj._coordinatorCarouselCheckedYear==null) careerObj._coordinatorCarouselCheckedYear = careerObj.year;
    // Balance Wave 6: an old save simply starts its ledger from here forward -- there's no way to
    // retroactively reconstruct earlier seasons' narrative events, and ledger-based achievements are
    // additive (new content), not a rewrite of anything an old save could already have earned.
    if(!careerObj.eventLedger) careerObj.eventLedger = [];
    if(careerObj._eventSequenceCounter==null) careerObj._eventSequenceCounter = 0;
  }

  /* ----- Phase 2 of the QB-entity redesign: real bench mobility and a free-agent pool. A bench
     player traded away lands on the ACQUIRING team's actual roster (not a vanish-and-regenerate);
     a waived one enters career.freeAgentPool, a shared jobless-QB portal any team might sign from
     later, with retirement odds that climb the longer he stays unsigned. The player never controls
     any of this -- same spirit as rollLeagueNews. ----- */
  // Once per season per bench slot: a modest independent chance the player is traded or waived.
  // Deliberately small (BENCH_MOBILITY_RATE=6%) since there are ~2x as many bench slots as starter
  // slots league-wide, so this shouldn't dominate overall roster churn -- see pool_size_sweep.mjs
  // confirming the resulting free-agent pool stays small (a handful of entries) over a full career
  // at this rate, not runaway.
  function evaluateBenchMobility(teamId, decade, year){
    const chart = career.leagueDepthCharts[teamId];
    if(!chart) return;
    const BENCH_MOBILITY_RATE = 0.06;
    ["qb2","qb3"].forEach(slot=>{
      const p = chart[slot];
      if(!p || p.retired) return;
      if(Math.random()>=BENCH_MOBILITY_RATE) return;
      if(Math.random()<0.5){
        tradeBenchPlayer(p, teamId, slot, decade, year);
      } else {
        // Wave 2A: move the departing player before the replacement takes his slot (task 5 --
        // never overwrite a QB object without moving the outgoing occupant to free agency/
        // retirement first).
        enterFreeAgentPool(p, "waived");
        const repl = generateBenchPlayer(teamId, decade, year, career.leagueStrength[teamId] ?? 60, Math.random()<0.4);
        assignQuarterbackToRoster(repl.id, teamId, slot==="qb2"?"QB2":"QB3");
        career.leagueNewsLog.push({ year, teamId, title:"Designates a Bench Bat", delta:0,
          flavor:`${teamNameAt(teamId, year)} designate ${p.name} for assignment to open a roster spot.` });
      }
    });
  }
  // A real trade: finds a destination team whose equivalent bench slot is clearly weaker
  // (rivalEffTalent gap >= 10), moves the player there directly, and pushes whoever previously
  // occupied that slot into the free-agent pool (continuity preserved for them too, not silently
  // overwritten) rather than just regenerating a replacement. The origin slot gets backfilled via
  // the existing generateBenchPlayer, same as any other bench departure.
  function tradeBenchPlayer(player, fromTeamId, fromSlot, decade, year){
    const isUpgradeFor = (teamId)=>{
      const chart = career.leagueDepthCharts[teamId];
      if(!chart) return null;
      return ["qb2","qb3"].find(slot=>{
        const incumbent = chart[slot];
        return !incumbent || rivalEffTalent(player)-rivalEffTalent(incumbent)>=10;
      }) || null;
    };
    const candidates = TEAMS.filter(t=>t.id!==fromTeamId && t.start<=year && isUpgradeFor(t.id));
    if(!candidates.length) return; // no real destination this season -- stays put
    const destTeam = pick(candidates);
    const destChart = career.leagueDepthCharts[destTeam.id];
    const destSlot = isUpgradeFor(destTeam.id);
    const displaced = destChart[destSlot];
    if(displaced) enterFreeAgentPool(displaced, "traded-away");
    const repl = generateBenchPlayer(fromTeamId, decade, year, career.leagueStrength[fromTeamId] ?? 60, Math.random()<0.4);
    assignQuarterbackToRoster(repl.id, fromTeamId, fromSlot==="qb2"?"QB2":"QB3");
    player.contract = rollRivalContract(decade, player.talent);
    player.entrenchedYears = rollEntrenchedYears(player.talent);
    assignQuarterbackToRoster(player.id, destTeam.id, destSlot==="qb2"?"QB2":"QB3");
    career.leagueNewsLog.push({ year, teamId: destTeam.id, title:"Trades for Depth", delta:0,
      flavor:`${teamNameAt(destTeam.id, year)} trade for ${player.name}, adding a real arm to the QB room.` });
  }
  // Once per season: ages every pool entry by one jobless season, applies the swept retirement
  // hazard (retireChance(n)=clamp(0.05*n^2,0,0.95) -- see pool_hazard_sweep.mjs; low at n=1,
  // effectively certain by n~5), then gives survivors a modest chance a team signs them to an
  // open/weak BENCH slot (a starter job is handled separately, by evaluateSuccession's external-
  // signing branch pulling from this same pool -- see there). Iterates a snapshot of the pool so an
  // incumbent displaced mid-pass (pushed in via enterFreeAgentPool) isn't processed again this same
  // tick, then filters the LIVE pool against exactly what was decided, so that newly-arrived entry
  // isn't accidentally dropped by a naive reassignment.
  function resolveFreeAgentPool(decade, year){
    if(!career.freeAgentPool) career.freeAgentPool = [];
    const toRemove = new Set();
    const poolSnapshot = career.freeAgentPool.slice();
    poolSnapshot.forEach(entity=>{
      const n = (entity.joblessSeasons||0) + 1;
      entity.joblessSeasons = n;
      const retireChanceVal = clamp(0.05*n*n, 0, 0.95);
      if(Math.random()<retireChanceVal){
        retireQuarterback(entity.id, "retired-unsigned");
        toRemove.add(entity);
        return;
      }
      if(Math.random()<0.15){
        const dest = pickBenchSigningDestination(entity, year);
        if(dest){
          const { teamId, slot } = dest;
          const chart = career.leagueDepthCharts[teamId];
          const incumbent = chart[slot];
          if(incumbent) enterFreeAgentPool(incumbent, "waived-for-fa");
          entity.contract = rollRivalContract(decade, entity.talent);
          entity.entrenchedYears = rollEntrenchedYears(entity.talent);
          entity.joblessSeasons = 0;
          assignQuarterbackToRoster(entity.id, teamId, slot==="qb2"?"QB2":"QB3");
          toRemove.add(entity);
          career.leagueNewsLog.push({ year, teamId, title:"Signs a Free-Agent Bench Bat", delta:0,
            flavor:`${teamNameAt(teamId, year)} bring in ${entity.name} off the open market for bench depth.` });
        }
      }
    });
    career.freeAgentPool = career.freeAgentPool.filter(e=>!toRemove.has(e));
  }
  function pickBenchSigningDestination(entity, year){
    const candidates = [];
    TEAMS.forEach(t=>{
      if(t.id===entity.teamId || t.start>year) return;
      const chart = career.leagueDepthCharts[t.id];
      if(!chart) return;
      ["qb2","qb3"].forEach(slot=>{
        const incumbent = chart[slot];
        if(incumbent && !incumbent.retired && rivalEffTalent(incumbent)>=rivalEffTalent(entity)-5) return;
        candidates.push({ teamId: t.id, slot });
      });
    });
    return candidates.length ? pick(candidates) : null;
  }

  /* ----- Succession: does a team stick with its starter, promote from within, sign a veteran
     replacement, or add a fresh rookie to the depth chart? Runs once per team per season, after
     both the starter and the bench have their year's stats in hand. "Entrenched" (rollEntrenchedYears)
     plus real contract years remaining is the user's own framing verbatim -- a team won't move on
     from a starter who's still good value on his deal, no matter how good the backup looks; once
     both run out, a real decline (or just clearly being past his prime) opens the door. */
  function evaluateSuccession(teamId, decade, year){
    const rival = rivalForTeam(teamId);
    const chart = career.leagueDepthCharts[teamId];
    if(!rival || !chart) return;
    // Independent of whether the starter is even in question this year -- a team can draft a
    // developmental QB purely to groom a future successor, same as a real front office does.
    if(Math.random()<0.04){
      const teamGrade = career.leagueStrength[teamId] ?? 60;
      // Wave 2A: move the outgoing qb3 to free agency/retirement before the slot is reassigned --
      // he used to just be overwritten here with no trace anywhere (Section 4's named defect).
      if(chart.qb3) enterFreeAgentPool(chart.qb3, "replaced-by-prospect");
      const newQb3 = generateBenchPlayer(teamId, decade, year, teamGrade, true);
      assignQuarterbackToRoster(newQb3.id, teamId, "QB3");
      career.leagueNewsLog.push({ year, teamId, title:"Drafts a Prospect to Develop", delta:0,
        flavor:`${teamNameAt(teamId, year)} use an early pick on a position-player prospect — no pressure on the current regular yet, but the clock is quietly ticking.` });
    }
    // Contract/entrenchment bookkeeping still ticks down every season -- it's real flavor, and it's
    // still what the "survives, signs an extension" branch below reads to reset -- but Wave 2B
    // (MASTER_REMEDIATION_SPEC.md, required design: "Contracts influence whether the team trades/
    // cuts/carries an expensive player, not who is the best healthy starter on Sunday") stops using
    // it to GATE whether a clearly-better rostered QB can actually start. This directly replaces two
    // confirmed defects (Section 4): "an entrenched starter can remain QB1 despite a clearly better
    // healthy rostered QB" (the old stillEntrenched-gated merit-override needed a 16-point gap AND a
    // 28% coin flip just to unseat an entrenched starter) and "AI merit promotion examines QB2 only
    // -- a superior QB3 cannot directly win QB1" (the old normal-path promotion check never looked
    // at qb3 at all).
    rival.contract.years = Math.max(0, rival.contract.years-1);
    rival.entrenchedYears = Math.max(0, rival.entrenchedYears-1);
    // Only a REAL falloff sends a team looking outside -- being merely on an expensive/expiring
    // contract is not enough on its own (the user's own original framing, preserved here for the
    // EXTERNAL-signing decision specifically, even though it no longer gates internal promotion --
    // see above). A first calibration pass let "just old" trigger this too, and left a SURVIVING
    // starter at 0/0 contract/entrenchedYears immediately re-eligible again every subsequent season
    // forever, producing 68 succession events across 30 teams in 11 seasons in real gameplay.
    // Corrected via a 30-team/15-year pure-math sweep before first shipping (see PROGRESS.md); the
    // "survives -- signs an extension" branch below is the actual fix.
    const declinedSharply = rivalEffTalent(rival) <= rival.talent-15;
    // A team is also willing to look outside once the incumbent's contract AND entrenchment window
    // both run out, independent of whether he's actually declined -- ordinary roster churn, not a
    // performance judgment. This is a legitimate, spec-sanctioned use of contracts ("Contracts
    // influence whether the team trades/cuts/carries an expensive player" -- Wave 2B required
    // design): it can only ever open the door to REPLACING him with an outside veteran, it never
    // gates whether a clearly-better ROSTERED challenger can start (that decision above is now
    // unconditional). A first calibration sweep with this path removed entirely (declinedSharply as
    // the only external-signing trigger) measured 0 external signings across 45 team-runs x 15
    // seasons -- contract expiry, not decline, was always the dominant real-world trigger for a
    // team looking outside; see succession_gap_sweep notes in PROGRESS.md.
    const contractExpired = rival.entrenchedYears<=0 && rival.contract.years<=0;
    const qb2 = chart.qb2, qb3 = chart.qb3;
    const teamName = teamNameAt(teamId, year);

    // Deterministic starter selection (required design, Wave 2B): examine BOTH qb2 and qb3, take
    // whichever is the stronger challenger, and reorder the depth chart outright once he clears the
    // incumbent by a real margin -- no additional random promotion roll. SUCCESSION_HYSTERESIS_
    // MARGIN documents the zone just below the promotion gap where the incumbent is deliberately
    // kept even though a challenger reads slightly ahead (a real starter shouldn't lose the job over
    // a 1-2 point noise-level edge); SUCCESSION_PROMOTION_GAP is the actual trigger. Recommended
    // initial values per the spec (2/3); calibrated via succession_gap_sweep.mjs before shipping --
    // see PROGRESS.md for the measured event-frequency distribution this produced. Wave 6: these two
    // constants are now defined at module scope (near TEAM_OVERALL_WEIGHTS) instead of locally here,
    // so FA role projection (projectDepthRoleForCandidate) can reuse the EXACT same numbers --
    // "never calculate FA role with a separate estimate."
    const rivalVal = rivalEffTalent(rival);
    const candidates = [qb2, qb3].filter(p=>p && !p.retired);
    const bestChallenger = candidates.length
      ? candidates.reduce((a,b)=> rivalEffTalent(b)>rivalEffTalent(a) ? b : a)
      : null;
    const bestChallengerVal = bestChallenger ? rivalEffTalent(bestChallenger) : -Infinity;
    // Promotes whichever of qb2/qb3 is passed in -- generalizes the old qb2-only promoteQb2 so a
    // superior qb3 can win the job directly, exactly like a real team would just start its best
    // healthy arm regardless of depth-chart seniority.
    function promoteChallenger(challenger, flavor){
      const oldName = rival.name;
      const fromSlot = challenger===qb3 ? "QB3" : "QB2";
      enterFreeAgentPool(rival, "lost-job");
      // Wave 2A: registerQuarterback re-points qbsById[challenger.id] at this NEW object (the
      // promotion still rebuilds a fresh object here, same as before this wave, to reset contract/
      // entrenchedYears cleanly) -- without this, qbsById would keep pointing at the stale
      // pre-promotion object forever, a real duplicate-identity bug of its own.
      const promoted = { ...challenger, contract: rollRivalContract(decade, challenger.talent), entrenchedYears: rollEntrenchedYears(challenger.talent) };
      registerQuarterback(promoted);
      assignQuarterbackToRoster(promoted.id, teamId, "QB1");
      const teamGrade = career.leagueStrength[teamId] ?? 60;
      const repl = generateBenchPlayer(teamId, decade, year, teamGrade, fromSlot==="QB3" ? Math.random()<0.65 : Math.random()<0.3);
      assignQuarterbackToRoster(repl.id, teamId, fromSlot);
      const delta = randInt(-3,6);
      adjustTeamStrength(teamId, delta, 0);
      career.leagueNewsLog.push({ year, teamId, title:"Bench Bat Wins an Everyday Job", delta, flavor: flavor(oldName, promoted.name) });
    }
    if(bestChallenger && bestChallengerVal-rivalVal>=SUCCESSION_PROMOTION_GAP){
      const isQb3 = bestChallenger===qb3;
      promoteChallenger(bestChallenger, (oldName,newName)=> isQb3
        ? `${teamName} skip right past the pecking order — ${newName}, the team's QB3, was simply too good to keep buried on the bench behind ${oldName}.`
        : `${teamName} bench ${oldName} in favor of ${newName}, who'd been waiting for exactly this shot.`);
      return;
    }
    // No internal answer clears the bar. A real bug caught by this wave's own calibration sweep
    // (succession_gap_sweep -- see PROGRESS.md): there is nothing left to decide most seasons --
    // the incumbent hasn't declined and his contract/entrenchment window hasn't actually run out
    // yet -- and the ONLY thing that should happen is the decrement already applied above. An
    // earlier draft of this wave fell straight through to the "survives, signs a fresh extension"
    // branch below EVERY season regardless, which immediately re-rolled contract.years/
    // entrenchedYears back up to a fresh multi-year value before the decrement could ever
    // accumulate toward true expiry -- contractExpired could then never legitimately become true,
    // silently zeroing out the external-signing path this same wave was trying to preserve. Return
    // here, unchanged, whenever there's genuinely nothing to decide yet.
    if(!(declinedSharply || contractExpired)) return;
    // A sharp performance decline OR the incumbent's own contract/entrenchment simply running out
    // can still send the team looking outside (ordinary roster churn is a legitimate, spec-
    // sanctioned reason to seek external competition -- it's never what decides who's the best
    // ROSTERED starter, which is settled unconditionally above). Same 0.15/season chance as before
    // this wave now that either real gate is actually met.
    if(Math.random()<0.15){
      // External signing: prefer an ACTUAL free agent already sitting in career.freeAgentPool if
      // one's a plausible fit for this team's grade -- this is what makes the pool a real
      // destination for displaced QBs (Phase 2) rather than an inert holding pen. Falls back to
      // conjuring a fresh veteran from outside the sim (the original behavior) only when the pool
      // has nobody suitable.
      const oldName = rival.name;
      enterFreeAgentPool(rival, "lost-job");
      const teamGrade = career.leagueStrength[teamId] ?? 60;
      const poolCandidate = (career.freeAgentPool||[]).filter(p=>p.teamId!==teamId)
        .sort((a,b)=>rivalEffTalent(b)-rivalEffTalent(a))[0];
      let signed;
      if(poolCandidate && rivalEffTalent(poolCandidate)>=teamGrade-15){
        poolCandidate.contract = rollRivalContract(decade, poolCandidate.talent);
        poolCandidate.entrenchedYears = rollEntrenchedYears(poolCandidate.talent);
        assignQuarterbackToRoster(poolCandidate.id, teamId, "QB1");
        signed = poolCandidate;
      } else {
        const newTalent = clamp(teamGrade + randInt(-10,20), 20, 99);
        signed = { id: "riv_"+teamId+"_"+year+"_fa", name: randomFullName(), teamId,
          talent: newTalent, age: randInt(26,34), retireAge: clamp(30+randInt(0,10), 30, 45),
          draftYear: year-randInt(3,10), seasons: [], totals: { games:0, comp:0, att:0, yards:0, td:0, int:0, wins:0, losses:0, ties:0, proBowls:0, allPros:0, mvps:0, rings:0 },
          retired:false, contract: rollRivalContract(decade, newTalent), entrenchedYears: rollEntrenchedYears(newTalent) };
        registerQuarterback(signed);
        assignQuarterbackToRoster(signed.id, teamId, "QB1");
      }
      const delta = randInt(-4,8);
      adjustTeamStrength(teamId, delta, 0);
      career.leagueNewsLog.push({ year, teamId, title:"Free-Agent Signing", delta,
        flavor: poolCandidate===signed
          ? `${teamName} move on from ${oldName} and hand the job to ${signed.name}, plucked off the open market after his last team let him go.`
          : `${teamName} move on from ${oldName} and hand the job to a veteran brought in from outside.` });
    } else {
      // Survives -- signs a fresh extension, protected again for a while. This is what actually
      // keeps a good, stable starter stable long-term instead of facing a fresh coin-flip every
      // single season forever once his first deal runs out.
      rival.contract = rollRivalContract(decade, rival.talent);
      rival.entrenchedYears = rollEntrenchedYears(rival.talent);
    }
  }

  /* ================= Player-as-backup =================
     career.isBackup: true from the moment an entrenched incumbent blocks the player at draft night
     (see the enterDraftNightBtn handler) until the player wins the starting job outright. While
     true, generateSeason() routes almost entirely through the SAME missed-games pipeline that
     already handles injury/suspension -- resolveBackupSeasonSnaps() below just PLANS how many
     games that leaves for the player, feeding that in as career._backupMissedGames exactly like an
     injury or suspension would. A true "clipboard year" (incumbent stays healthy and effective all
     season) naturally falls out of the EXISTING gamesPlayed=clamp(league.games-missedGames,0,
     league.games) formula hitting 0 -- no separate zero-stat code path needed.
     Wave 2B (MASTER_REMEDIATION_SPEC.md, required design #1): this function used to fully simulate
     the incumbent's season right here (simulatePlayerSeasonStats), appending a season row and
     mutating his age/totals -- then simulateRivalSeasons() simulated the SAME entity again later in
     the SAME generateSeason() call, since he's just an ordinary QB1 entry in career.leagueRivals as
     far as that pass is concerned. Two season rows, two age increments, doubled totals -- a
     confirmed defect (see backup-incumbent-double-simulation.spec.js). Fixed at the root: this
     function now only PLANS usage (rolls how many games he'll play, using the identical
     missed-games distribution simulatePlayerSeasonStats always uses) and never simulates or
     mutates him. simulateRivalSeasons is the ONE place his season is ever actually run this year --
     see career._backupUsagePlan, read there via forcedGames so it isn't independently re-rolled. */
  function resolveBackupSeasonSnaps(decade, league){
    const incumbent = rivalForTeam(career.teamId);
    if(!incumbent){ career._backupMissedGames = 0; career._backupUsagePlan = null; return; } // he retired with nobody left to track -- treat as an open competition, handled by the end-of-season roll
    const incumbentMissed = Math.random()<0.30 ? randInt(1, 9) : 0;
    const incumbentGames = clamp(league.games - incumbentMissed, 0, league.games);
    // Games HE'S PLANNED to play are, by definition, games the player will not -- a single source
    // of truth instead of a separate "coach benches for poor play" roll that could double-count
    // games.
    career._backupMissedGames = incumbentGames;
    career._backupUsagePlan = { qbId: incumbent.id, games: incumbentGames };
    career._backupIncumbentName = incumbent.name;
    // Win/loss and stat-line snapshot fields are filled in AFTER simulateRivalSeasons actually runs
    // him for real, later this same generateSeason() call -- see the patch step right after that
    // call. Until then these stay at whatever they were reset to below (zero/null), which is fine:
    // nothing reads them before that point.
    career._backupIncumbentWins = 0;
    career._backupIncumbentLosses = 0;
    career._backupIncumbentSeasonSnapshot = null;
  }
  // Called once per season, after the season is otherwise fully resolved -- decides whether the
  // player keeps competing for the job or wins it outright. A forced resolution after 3 bench
  // seasons keeps a career from getting stuck indefinitely; otherwise the odds scale with how the
  // player's own grade compares to the incumbent's CURRENT (age-adjusted) talent, not his talent
  // at draft time, so a declining incumbent genuinely becomes easier to unseat over the years.
  function resolveBackupCompetition(effOverall){
    career._backupSeasonsCount = (career._backupSeasonsCount||0) + 1;
    const incumbent = rivalForTeam(career.teamId);
    const forcedResolution = career._backupSeasonsCount >= 3;
    const incumbentGone = !incumbent || incumbent.retired;
    const incumbentTalent = incumbentGone ? 0 : rivalEffTalent(incumbent);
    const competeChance = clamp(0.5 + (effOverall-incumbentTalent)*0.025, 0.05, 0.85);
    const wonJob = forcedResolution || incumbentGone || Math.random()<competeChance;
    if(wonJob){
      career.isBackup = false;
      career.transactions.push(`${career.year}: Wins the starting job.`);
      // Wave 2B (MASTER_REMEDIATION_SPEC.md, required design: "the incumbent cannot remain a
      // parallel AI starter"): he used to just sit there with career.teamId's QB1 slot still
      // pointing at him, retired:false, while the player ALSO now occupies that same team --
      // two active starters, the confirmed two-active-starters-after-backup-win defect. Move him
      // to whichever bench slot he actually upgrades, or free agency if he doesn't upgrade either
      // one -- the same displaced-QB pattern every other roster move in this file already uses
      // (move the outgoing occupant before assigning the incoming one).
      if(incumbent && !incumbent.retired){
        const depth = getTeamQuarterbacks(career.teamId);
        const qb2Val = depth.QB2 ? rivalEffTalent(depth.QB2) : -Infinity;
        const qb3Val = depth.QB3 ? rivalEffTalent(depth.QB3) : -Infinity;
        const incumbentVal = rivalEffTalent(incumbent);
        if(!depth.QB2 || incumbentVal>qb2Val){
          if(depth.QB2) enterFreeAgentPool(depth.QB2, "displaced-by-incumbent");
          assignQuarterbackToRoster(incumbent.id, career.teamId, "QB2");
        } else if(!depth.QB3 || incumbentVal>qb3Val){
          if(depth.QB3) enterFreeAgentPool(depth.QB3, "displaced-by-incumbent");
          assignQuarterbackToRoster(incumbent.id, career.teamId, "QB3");
        } else {
          enterFreeAgentPool(incumbent, "lost-job-to-user");
        }
      }
    }
    return wonJob;
  }

  // Balance Wave 4: capPressure (set at signing time by which CONTRACT_STRUCTURE was chosen) nudges
  // O-Line/Weapons specifically -- never the other three grades, which have their own separate life
  // cycles (defense via drafting/free agency/injuries/coordinators, coaching via the carousel below,
  // GM via performance) -- then decays 25%/season toward neutral, the same retention-curve shape
  // teamChemistry already uses, so neither a single discount nor a single record deal has a
  // permanent effect on its own; staying on one structure across re-signs is what compounds it.
  function applyCapPressureToRoster(){
    const pressure = career.capPressure || 0;
    if(pressure!==0){
      const nudge = Math.round(pressure*0.15);
      if(nudge!==0){
        career.oline = clamp(career.oline+nudge, 20, 99);
        career.weapons = clamp(career.weapons+nudge, 20, 99);
        recomputeMyTeamStrength();
      }
    }
    career.capPressure = Math.round(pressure*0.75);
  }
  // Balance Wave 4 ("Coordinator carousel"): "Deep playoff runs should cause assistants to be hired
  // elsewhere. This is a fair, visible 'success tax' and creates dynasty turnover without forced
  // losses." Checked once per year (guarded the same way prepareDevelopmentPlanForSeason guards its
  // own once-per-year application) against the PREVIOUS season's fully-resolved playoff result --
  // the current season's own run isn't decided yet at this point in generateSeason() (playoff
  // rounds resolve later, interactively, via the Key Moment reveal), so this always looks one season
  // back, at career.seasonLog's last entry. Only the two deepest rounds count as "a deep run" --
  // reaching a Conference Championship or Super Bowl is genuinely deep by any real NFL measure;
  // losing in the Wild Card or Divisional round isn't the kind of run that gets a coordinator a
  // head-coaching interview elsewhere.
  // Internal round literals unchanged (load-bearing) -- these mean the LCS and the World Series.
  const COORDINATOR_CAROUSEL_DEEP_ROUNDS = new Set(["Conference Championship","Super Bowl"]);
  function applyCoordinatorCarouselIfDue(){
    if(career._coordinatorCarouselCheckedYear===career.year) return;
    career._coordinatorCarouselCheckedYear = career.year;
    const lastSeason = career.seasonLog[career.seasonLog.length-1];
    const rounds = lastSeason && lastSeason.playoffs && lastSeason.playoffs.made ? (lastSeason.playoffs.rounds||[]) : [];
    if(!rounds.length) return;
    const lastRound = rounds[rounds.length-1];
    if(!COORDINATOR_CAROUSEL_DEEP_ROUNDS.has(lastRound.round)) return;
    // Winning the Super Bowl makes the staff an even bigger hiring target than a deep loss does.
    const wonItAll = lastRound.round==="Super Bowl" && lastRound.won;
    const chance = wonItAll ? 0.38 : 0.25;
    if(Math.random()<chance){
      const before = career.coaching;
      career.coaching = clamp(career.coaching - randInt(6,14), 20, 99);
      recomputeMyTeamStrength();
      const teamName = teamNameAt(career.teamId, career.year);
      career.transactions.push(`${career.year}: Coaching-staff carousel — a deep October run got the ${teamName}'s hitting coach a manager's chair elsewhere (Coaching ${before} → ${career.coaching}).`);
      recordLedgerEvent("coordinator_carousel", { teamId: career.teamId, outcomeId: wonItAll?"won_it_all":"deep_loss", metadata:{coachingBefore:before, coachingAfter:career.coaching} });
    }
  }

  function generateSeason(){
    const decade = decadeForYear(career.year);
    const league = LEAGUE[decade];
    const developmentPlan = prepareDevelopmentPlanForSeason();
    // Must run before career.seasonLog.push(season) below makes THIS season the new "last" entry --
    // applyCoordinatorCarouselIfDue needs the PREVIOUS season's fully-resolved playoffs record.
    applyCoordinatorCarouselIfDue();
    // Built once, right at the top, before anyone's games (the player's own included) are
    // simulated -- see buildSeasonSchedule. Every other team's shared results (buildScheduleResults,
    // called later via resolvePlayoffs) reuses this exact same schedule rather than generating a
    // second one, which is what makes the player's real games structurally unable to disagree with
    // the shared weekly board/standings.
    const schedule = buildSeasonSchedule(career.year, decade);
    if(career.isBackup) resolveBackupSeasonSnaps(decade, league);
    const schemeId = career.teamScheme ? career.teamScheme[career.teamId] : null;
    const eff = schemeEffective(career.age, decade, schemeId);

    // Tool signals -> season rate stats. Each pulls from a concentrated subset of the 12 tools;
    // effK's sense is "higher signal = FEWER strikeouts" (the formula site inverts it, the way INT
    // was handled). See STAT_CAL near LEAGUE for the era ceilings these feed.
    const AVG_W = {SHA:0.40, TCH:0.25, ANT:0.20, DEC:0.15};
    const ISO_W = {DAC:0.55, REL:0.30, TCH:0.15};
    const HR_W  = {DAC:0.62, REL:0.30, ANT:0.08};
    const BB_W  = {PKT:0.52, ANT:0.28, DEC:0.20};
    const K_W   = {SHA:0.34, TCH:0.30, ANT:0.24, DEC:0.12};
    const SPEED_W = {MOB:0.62, IMP:0.34, ARM:0.04};
    const effAcc = weighted(eff, AVG_W);   // batting-average signal
    const effYpa = weighted(eff, ISO_W);   // isolated-power signal
    const effTd  = weighted(eff, HR_W);    // home-run-rate signal
    const effInt = weighted(eff, K_W);     // contact (anti-strikeout) signal
    const effBb  = weighted(eff, BB_W);    // walk-rate signal
    const effOverall = weighted(eff, OVERALL_WEIGHTS);
    const effRush = weighted(eff, SPEED_W); // stolen-base / baserunning signal

    const neutral = neutralEffective(career.age, decade, schemeId);
    const neutralAcc = weighted(neutral, AVG_W);
    const neutralYpa = weighted(neutral, ISO_W);
    const neutralTd  = weighted(neutral, HR_W);
    const neutralInt = weighted(neutral, K_W);
    const neutralBb  = weighted(neutral, BB_W);
    const neutralOverall = weighted(neutral, OVERALL_WEIGHTS);
    // independent age-expression cap (see primeMultiplier) — applied to the deltas below, not
    // to the neutral baseline itself, so league-average stays league-average at every age and
    // only an individual build's edge over it compresses late in a career.
    const primeMult = primeMultiplier(career.age);

    // injury/suspension check (before stats, may already be resolved via event -> flags on
    // career.injuryPenalty). These are tracked separately so the season narrative can tell a
    // suspension apart from an actual injury instead of always saying "to injury".
    const missedGamesInjury = career._injuryMissedGames || 0;
    const missedGamesSuspension = career._suspensionMissedGames || 0;
    const missedGamesBackup = career._backupMissedGames || 0;
    let missedGames = missedGamesInjury + missedGamesSuspension + missedGamesBackup;
    let perfPenalty = career._injuryPenalty || 0;
    const hadInjuryThisSeason = !!career._hadInjuryThisSeason;
    // Captured into locals BEFORE the reset below, since they're needed further down (team-record
    // composition and the season object) -- reading career._backup* again after this point would
    // just see the zeroed-out values.
    const backupIncumbentWins = career._backupIncumbentWins || 0;
    const backupIncumbentLosses = career._backupIncumbentLosses || 0;
    const backupIncumbentName = career._backupIncumbentName || null;
    const backupIncumbentSeasonSnapshot = career._backupIncumbentSeasonSnapshot || null;
    career._injuryMissedGames = 0; career._suspensionMissedGames = 0; career._injuryPenalty = 0; career._hadInjuryThisSeason = false;
    career._backupMissedGames = 0; career._backupIncumbentWins = 0; career._backupIncumbentLosses = 0;
    career._backupIncumbentName = null; career._backupIncumbentSeasonSnapshot = null;

    const gamesPlayed = clamp(league.games - missedGames, 0, league.games);

    // a reduced-role contract (backup/minimum) means fewer starts, not just worse play
    const roleShare = career.contract.tier==="minimum" ? clamp(0.15+Math.random()*0.4, 0.1, 0.6)
      : career.contract.tier==="backup" ? clamp(0.45+Math.random()*0.35, 0.3, 0.85)
      : 1;

    // Variance by design: a build well below the age/era-adjusted league-average baseline
    // throws like a bust, and one well above it throws like an all-time great — but the gap
    // between "good" (a 15ish-point delta, an 80ish overall) and "great" (a 25-30-point delta,
    // a 90+ overall) has to actually SHOW UP in the numbers, not saturate the same ~70%-completion,
    // ~5000-yard, sub-5-INT ceiling for both. These coefficients are calibrated so a delta of 0
    // (neutral/league-average) throws league-average ball, +15 throws like a good starter
    // (high-60s completion, ~25-28 TD), and +25-30 throws like a real MVP case (high-60s/low-70s
    // completion, 30+ TD, single-digit INTs) — with real separation in between. Everything is
    // measured against the NEUTRAL baseline (a 65-everywhere build through the same age curve
    // and era reweighting), so a rookie-year age penalty or a tough era doesn't read as "bad
    // build" on its own — only a genuinely below-average build does.
    // Per-decade, real-record-grounded ceilings/floors -- see the STAT_CAL constant near LEAGUE
    // for the sourced seasons and full methodology (this replaced a flat, non-decade-aware set of
    // coefficients that saturated well short of realistic decade-relative production).
    const cal = STAT_CAL[decade] || STAT_CAL["2000s"];
    const dCompRaw = (effAcc-neutralAcc)*primeMult, dYpaRaw = (effYpa-neutralYpa)*primeMult,
      dTdRaw = (effTd-neutralTd)*primeMult, dIntRaw = (effInt-neutralInt)*primeMult,
      dBbRaw = (effBb-neutralBb)*primeMult;
    // Blend each narrow per-stat delta with the broad effOverall delta. The per-stat formulas
    // above each pull from a small, concentrated subset of attributes (YPA only cares about
    // ARM/DAC/TCH/IMP, for instance), so a build can max out one of those subsets -- swinging
    // its stat delta close to the ~34-point ceiling STAT_CAL assumes is needed for record-book
    // numbers -- while its OVERALL rating (spread evenly across all 11 attributes via
    // OVERALL_WEIGHTS) stays merely decent. That mismatch is exactly what let 70-overall builds
    // throw for 4,000+ yards and 40+ TD: a narrow specialist reading as "average" on the card but
    // "elite" on the stat sheet. STAT_BLEND is deliberately low (mostly the BROAD/overall delta,
    // only a small taste of the narrow one) -- a first pass at 0.5 still let a ~69-overall,
    // 2-attribute specialist AVERAGE 4,600+ yards over a season (median 4,633, still hitting
    // 5,600+ on good years), which is exactly the bug this exists to fix, just less blatantly. At
    // 0.18 that same build averages solidly "mediocre" territory while a build whose narrow and
    // broad deltas already agree (a genuinely balanced build, elite or otherwise) is completely
    // unaffected by the blend ratio either way -- so raising or lowering STAT_BLEND only ever
    // changes how much a NARROW specialist can outperform their overall, never a balanced build's
    // ceiling.
    const dOverall = (effOverall-neutralOverall)*primeMult;
    const STAT_BLEND = 0.18;
    // A second, independent dial from STAT_BLEND above: even after narrow-vs-broad blending, the
    // raw delta-to-stat coefficients in STAT_CAL (calibrated assuming a ~34-point max theoretical
    // delta) were steep enough that a merely decent, perfectly BALANCED build -- no specialist
    // gaming involved at all -- still posted MVP-caliber ratings (100+) well before its displayed
    // overall left the "good starter" range. STAT_SENSITIVITY compresses every blended delta by
    // the same factor, in both directions, so the full displayed-overall range maps onto a
    // believable production curve: ~60-65 overall reads as a mediocre/fringe starter, ~75 as a
    // solid regular, ~85 as a genuine Pro Bowl-caliber year, and ~90+ as the rare, era-defining
    // season that occasionally actually clears a real modern-NFL record (see MODERN_NFL_RECORDS)
    // instead of blowing past it as a matter of course.
    // Round 4: tightened further, from 0.5 to 0.32 -- players kept posting gaudy statlines on
    // mediocre-to-average builds even after the Round 2 pass, so this squeezes the whole curve
    // again on top of that. Re-calibrated via the same flat-build diagnostic sweep methodology:
    // ~55-65 overall now tops out well shy of 90 rating even on a hot-streak season (was ~87-91
    // before this pass, itself down from routinely 100+ pre-Round-2), ~75-80 caps out high-90s,
    // and a truly maxed 99-everywhere build's ceiling comes down from ~120 to ~112 rating.
    const STAT_SENSITIVITY = 0.34;
    const blendD = raw => (raw*STAT_BLEND + dOverall*(1-STAT_BLEND))*STAT_SENSITIVITY;
    const dComp = blendD(dCompRaw); // AVG
    const dYpa  = blendD(dYpaRaw);  // ISO
    const dTd   = blendD(dTdRaw);   // HR rate
    const dInt  = blendD(dIntRaw);  // contact (fewer K)
    const dBb   = blendD(dBbRaw);   // BB rate
    // The lineup around him (career.weapons) is a small independent nudge -- a better supporting
    // cast means more hittable counts and more RBI chances, but can't turn a weak bat into a
    // strong one, so it stays a modest post-hoc addition, not folded into the main blend.
    const weaponsNudge = (safeNum(career.weapons,60)-65);
    const chemistryNudge = teamChemistryEdge();
    const lgIso = Math.max(0.05, league.slg - league.avg);
    const avgRate = clamp(league.avg + dComp*(dComp>=0?cal.avg.up:cal.avg.down) + weaponsNudge*0.0005 + chemistryNudge*0.0003, cal.avg.lo, cal.avg.hi);
    const isoRate = clamp(lgIso + dYpa*(dYpa>=0?cal.iso.up:cal.iso.down) + weaponsNudge*0.0009, cal.iso.lo, cal.iso.hi);
    const hrRate = clamp(league.hrRate + dTd*(dTd>=0?cal.hr.up:cal.hr.down), cal.hr.lo, cal.hr.hi);
    const bbRate = clamp(league.bbRate + dBb*(dBb>=0?cal.bb.up:cal.bb.down) + weaponsNudge*0.0002, cal.bb.lo, cal.bb.hi);
    const kRate  = clamp(league.kRate - dInt*(dInt>=0?cal.k.up:cal.k.down), cal.k.lo, cal.k.hi);
    // Per-plate-appearance rates fed into the shared game engine (which multiplies each by that
    // game's PA count). AB is ~91% of PA, so per-PA hit/TB rates are the per-AB AVG/SLG scaled down.
    const abShare = clamp(1 - bbRate - 0.015, 0.7, 0.97);
    const comp = clamp(avgRate * abShare, 0.05, 0.60);              // hits per PA
    const ypa  = clamp((avgRate + isoRate) * abShare, 0.05, 1.60);  // total bases per PA
    const tdRate = hrRate;                                          // HR per PA
    const intRate = kRate;                                          // K per PA
    let attPerGame = clamp((league.paPerGame + dOverall*0.010 + randInt(-1,1)*0.12) * roleShare, 2.4, 4.9);
    // GIDP rate reuses the old "sackRate" plumbing slot -- a slow, ground-ball-prone hitter rolls
    // into more double plays; a fast one beats them out.
    const sackRate = clamp(0.022 - (effRush-60)*0.00035 + (isoRate>0.20 ? 0.003 : 0), 0.004, 0.05);

    const perfMult = 1 - perfPenalty*0.01;
    // the team's season doesn't stop when this QB is hurt — a generic backup covers the missed
    // games, playing off team quality alone (not this player's skill), so "team record" and "your
    // record as the starter" can and often do differ. Games missed specifically because a NAMED
    // incumbent started ahead of you (missedGamesBackup) are meant to use HIS real simulated win
    // rate -- but Wave 2B (MASTER_REMEDIATION_SPEC.md) eliminated the early, duplicate simulation
    // that used to produce that number here (see resolveBackupSeasonSnaps): he's now simulated
    // exactly once, later this same generateSeason() call, inside simulateRivalSeasons -- which is
    // AFTER this point needs his win rate. backupIncumbentWins/Losses are therefore always 0 now,
    // so this always falls through to the team-strength-based estimate below -- a deliberate,
    // documented trade-off (a little less precision on this one flavor number) for actually fixing
    // the double-simulation. His REAL per-game stat line still lands on the correct tagged weeks
    // once simulateRivalSeasons runs (see the patch step right after that call).
    const genericMissedGames = missedGamesInjury + missedGamesSuspension;
    const incumbentTotalGames = backupIncumbentWins + backupIncumbentLosses;
    const incumbentWinRate = incumbentTotalGames>0 ? backupIncumbentWins/incumbentTotalGames
      : clamp(0.5 + (career.teamStrength-65)*0.01, 0.12, 0.88);
    const regSeason = simulateRegularSeasonGames({
      schedule, gamesPlayed, missedGamesBackup, genericMissedGames, incumbentWinRate,
      incumbentId: career._backupUsagePlan ? career._backupUsagePlan.qbId : null,
      incumbentName: backupIncumbentName,
      effOverall, comp, ypa, tdRate, intRate, bbRate, attPerGame, perfMult, effRush, sackRate,
      age: career.age, decade,
    });
    const gameLog = regSeason.games, wins = regSeason.wins, losses = regSeason.losses, ties = regSeason.ties||0;
    // Legacy slot names kept so the ~50 render sites still read: att=PA, comp=hits, yards=total
    // bases, td=HR, int=K, sacks=GIDP, rushAtt=SB attempts, rushYards=SB, rushTd=(unused, 0).
    const attempts = regSeason.att, completions = regSeason.comp, yards = regSeason.yards,
      td = regSeason.td, interceptions = regSeason.int, sacks = regSeason.sacks,
      rushAtt = regSeason.rushAtt, rushYards = regSeason.rushYards, rushTd = regSeason.rushTd;
    const walks = regSeason.bb || 0;

    // ---- Derive the full batting line ----
    // The season's power output (isoRate*AB = extra bases beyond singles) is split into HR / 2B /
    // 3B here rather than trusting the per-game HR slot, so ISO and HR can never disagree (an
    // earlier pass produced .478-SLG / 0-HR seasons because the two were computed independently).
    const pa = attempts;
    const hbp = Math.round(pa*0.009), sf = Math.round(pa*0.006);
    const ab = Math.max(0, pa - walks - hbp - sf);
    const hits = clamp(completions, 0, ab);
    const strikeouts = interceptions;
    const powerBases = Math.max(0, Math.round(isoRate * ab)); // 2B + 2*3B + 3*HR
    const hrShare = clamp(0.26 + (effTd - neutralTd)*0.006, 0.12, 0.46); // pull-power vs. gap-power lean
    const hr = clamp(Math.round(powerBases * hrShare / 3), 0, Math.max(0, hits - 3));
    const triples = clamp(Math.round((effRush-64)*0.09 + Math.random()*2.4), 0, Math.max(0, hits - hr));
    let doublesN = Math.round(powerBases*(1-hrShare) - 2*triples);
    doublesN = clamp(doublesN, 0, Math.max(0, hits - hr - triples));
    const singles = Math.max(0, hits - hr - triples - doublesN);
    const totalBases = singles + 2*doublesN + 3*triples + 4*hr;
    const tbActual = totalBases;
    const sb = rushYards, cs = Math.max(0, rushAtt - rushYards);
    const avg = ab>0 ? hits/ab : 0;
    const obp = clamp((hits+walks+hbp) / Math.max(1, ab+walks+hbp+sf), 0, 1);
    const slg = ab>0 ? tbActual/ab : 0;
    const ops = obp+slg;
    const thin = pa < 25; // a lost season -- injury/suspension/blocked; no rate stats
    const opsPlus = thin ? 0 : Math.round(100*(obp/Math.max(0.001,league.obp) + slg/Math.max(0.001,league.slg) - 1));
    const rbi = thin ? 0 : Math.max(0, Math.round(hr*1.55 + doublesN*0.55 + triples*0.55 + singles*0.19 + (eff.CLU-65)*0.30 + weaponsNudge*0.55));
    const runs = thin ? 0 : Math.max(0, Math.round((hits+walks)*0.33 + hr*0.55 + sb*0.24 + weaponsNudge*0.45));
    const rating = opsPlus;
    // Reconciled legacy aliases -- these, not the raw per-game slot sums, are what the season
    // object and career totals store (comp=hits, yards=total bases, td=HR, int=K).
    const completionsFinal = hits, yardsFinal = totalBases, tdFinal = hr, intFinal = strikeouts;
    // "winPct" here is really the player's team's win rate over the games he was in the lineup --
    // kept for every award/HOF/record path that still reads it. A tie counts as half.
    const winPct = gamesPlayed>0 ? (wins+0.5*ties)/gamesPlayed : 0;
    const backupWins = regSeason.backupWins, backupLosses = regSeason.backupLosses;
    const incumbentWins = regSeason.incumbentWins, incumbentLosses = regSeason.incumbentLosses;

    // All three season awards are judged on what actually happened this season -- passer rating
    // relative to that year's league average, raw production, team success, and (for Pro Bowl /
    // All-Pro specifically) how much of the season was actually played -- never on the underlying
    // attribute grade. A merely-good build can win one with a career year; a great build that
    // missed half the season to injury and threw for a below-average line does NOT get voted in
    // just because the roster card says he's talented. evaluateSeasonAwards() is the single shared
    // implementation -- simulateRivalSeasons() calls the exact same function for every other
    // starting QB in the league, which is what makes the League tab's award rates an honest
    // cross-check against the player's own instead of two formulas that only look similar.
    const { awards, ratingEdge, leagueAvgRating, gamesPlayedShare, proBowlScore, proBowlEligible, allProScore, allProEligible, mvpScore, mvpEligible } = evaluateSeasonAwards({
      rating, td: tdFinal, winPct, attempts, gamesPlayed, leagueGames: league.games, decade,
      teamOverall: career.teamStrength,
    });

    // Team quality for THIS season is whatever it already was heading in (see the end of last
    // season's block below) -- it deliberately does NOT change mid-season, so the same team
    // grade is what both the regular season and the playoffs actually played against.

    const season = {
      year: career.year, age: career.age, teamId: career.teamId, teamName: teamNameAt(career.teamId, career.year),
      decade, games: gamesPlayed, comp: completionsFinal, att: attempts, pct: avg,
      yards: yardsFinal, td: tdFinal, int: intFinal, sacks, rating, wins, losses, ties,
      rushAtt, rushYards, rushTd, gameLog,
      // real batting line
      pa, ab, hits, singles, doubles: doublesN, triples, hr, bb: walks, hbp, sf, k: strikeouts,
      sb, cs, rbi, runs, avg, obp, slg, ops, opsPlus,
      teamGames: league.games, teamWins: wins+backupWins+incumbentWins, teamLosses: losses+backupLosses+incumbentLosses, teamTies: ties, missedGames,
      missedGamesInjury, missedGamesSuspension, missedGamesBackup,
      incumbentName: backupIncumbentName,
      incumbentSeasonSnapshot: backupIncumbentSeasonSnapshot,
      teamOverall: career.teamStrength,
      overall: Math.round(effOverall),
      teamChemistry: career.teamChemistry ?? 50,
      developmentPlanId: developmentPlan.id,
      developmentExpectation: {
        completionPct: clamp(comp*perfMult, 0, 1),
        yardsPerAttempt: Math.max(0, ypa*perfMult),
        touchdownRate: tdRate,
        interceptionRate: clamp(intRate*(2-perfMult), 0, 1),
      },
      awards, proBowlScore, proBowlEligible, allProScore, allProEligible, mvpScore, mvpEligible,
      contractApy: career.contract.apy, contractTier: career.contract.tier,
    };

    const playoffs = resolvePlayoffs(effOverall, season, schedule);
    season.playoffs = playoffs;
    // NOTE: no Super Bowl Champion award, no ring, here -- resolvePlayoffs has only generated
    // round 1 of the postseason (if the team made it at all). Whether this season ends in a ring
    // isn't decided yet, let alone known, so nothing referencing it can be added until the player
    // has actually played the run out -- see finalizePlayoffOutcome, called once the reveal ends.

    career.seasonLog.push(season);
    spawnNewFranchiseRivals(career.year);
    simulateRivalSeasons(decade, league, career.year);
    // Wave 2B: now that simulateRivalSeasons has actually simulated the incumbent for real (the
    // ONE simulation pass he gets this year -- see resolveBackupSeasonSnaps/the isBackupIncumbent
    // branch there), patch this season's recap snapshot with his REAL final numbers. Before this
    // wave these came from a separate, now-eliminated early simulation; season.incumbentName was
    // already set correctly at push time (resolveBackupSeasonSnaps still sets that from planning),
    // only the stat-line snapshot needed to wait for the real simulation to finish.
    if(career._backupUsagePlan && career._backupUsagePlan.qbId){
      const incumbentAfter = getQuarterbackById(career._backupUsagePlan.qbId);
      const incumbentSeasonRow = incumbentAfter && incumbentAfter.seasons.find(s=>s.year===career.year);
      if(incumbentSeasonRow){
        season.incumbentSeasonSnapshot = { hr: incumbentSeasonRow.hr ?? incumbentSeasonRow.td, rbi: incumbentSeasonRow.rbi ?? 0, avg: incumbentSeasonRow.avg, opsPlus: incumbentSeasonRow.opsPlus ?? incumbentSeasonRow.rating };
      }
    }
    simulateDepthChartSeasons(decade, league, career.year);
    TEAMS.filter(t=>t.id!==career.teamId && t.start<=career.year).forEach(t=> evaluateSuccession(t.id, decade, career.year));
    // Phase 2 of the QB-entity redesign: real bench mobility (trade/waive) and free-agent-pool
    // resolution (retirement hazard + teams signing off the pool), both once per team per season,
    // same resolution point as everything else above.
    TEAMS.filter(t=>t.id!==career.teamId && t.start<=career.year).forEach(t=> evaluateBenchMobility(t.id, decade, career.year));
    resolveFreeAgentPool(decade, career.year);
    // Winner-take-all MVP (see resolveSeasonMVP) and fixed-slot Pro Bowl/All-Pro (see
    // resolveSeasonAllProAndProBowl): both decided once, here, after every QB in the league -- the
    // player and every simulated rival -- has this year's season locked in.
    const mvp = resolveSeasonMVP(season, career.year);
    const { proBowl, allPro } = resolveSeasonAllProAndProBowl(season, career.year);
    resolveSeasonStatTitlesAndROY(season, career.year);
    maybeAwardGoldGlove(season);
    // Balance Wave 6: NOW (not right after the push above) season.awards actually reflects whatever
    // resolveSeasonMVP/resolveSeasonAllProAndProBowl just decided -- log it to the event ledger too
    // so chain achievements can express "an MVP season eventually followed a scandal" as an ordered
    // sequenceRule instead of a hand-walked seasonLog scan. Only the three generic award labels ever
    // pushed onto season.awards besides a championship ring label qualify here.
    (season.awards||[]).forEach(a=>{
      if(a==="MVP"||a==="All-Star"||a==="Silver Slugger"||a==="Rookie of the Year") recordLedgerEvent("award_won", { teamId: season.teamId, outcomeId: a });
    });

    // ----- Team quality for NEXT season: legible causes first, small residual noise last. -----
    // Team quality moves through roster churn, regression/rebuild pressure, and explicit league
    // news. A quarterback's individual rating or awards no longer improve all five organization
    // grades at once; that feedback loop used to turn one strong QB season into better defense,
    // coaching, and front-office grades, then feed those advantages back into the next season.
    const volMult = ERA_TEAM_VOLATILITY[decade] ?? 1.0;
    career.leagueRivals.forEach(r=>{
      const justSeason = r.seasons.length ? r.seasons[r.seasons.length-1] : null;
      if(!justSeason || justSeason.year!==career.year) return; // retired/succeeded this same year -- handled at the point of succession instead
      const s = career.leagueStrength[r.teamId] ?? 60;
      let nudge = randInt(-2,2)*volMult;
      nudge -= contenderDeclinePull(s)*volMult;
      nudge += rebuildPull(s)*volMult;
      // Wave 5: the delta lands on the team's five persistent components (adjustTeamStrength),
      // never on leagueStrength directly -- the aggregate is derived from them, not the reverse.
      // noiseSpread=2 keeps the same per-component wobble magnitude the old independent oline/
      // weapons noise used to have, just unified into one call instead of two disconnected ones.
      adjustTeamStrength(r.teamId, Math.round(nudge), 2);
    });
    rollLeagueNews(career.year, decade);
    // The player's team uses the same roster-only drift. Player skill still changes game outcomes
    // directly, but cannot manufacture a stronger defense, coach, or GM merely by posting a high
    // overall. Contract/cap and targeted recruitment can add explicit roster effects later.
    const teamNoise = randInt(-2,2)*volMult;
    const teamDeclinePull = Math.round(contenderDeclinePull(safeNum(career.teamStrength,60))*volMult);
    const teamRebuildPull = Math.round(rebuildPull(safeNum(career.teamStrength,60))*volMult);
    const myNudge = Math.round(teamNoise) - teamDeclinePull + teamRebuildPull;
    adjustTeamStrength(career.teamId, myNudge, 2);
    applyCapPressureToRoster();

    // ----- Wear and tear economy: a persistent, career-long meter (not a per-injury dice roll) --
    // see resolveInjuryChoice for the play-through-it vs. shut-it-down wear add, which is where
    // most of a career's real accumulation actually comes from. A small age/durability-scaled
    // baseline applies every season regardless (wear starts accelerating past 26, a low-DUR build
    // wears faster, a high one slower); an injury-free season recovers some of it back, tapering
    // off with age since an older body doesn't bounce back the way a 23-year-old's does. Diagnostically
    // tuned (pure-math trajectory sweep, no game code needed): "always sit out" stays near-zero
    // breakdown risk for a full career; "always gut it out" produces at least one permanent
    // breakdown in ~65-80% of careers (more for a fragile build), with a real (~25-35%) chance of
    // one specifically by age 30 -- a genuine, tangible cost to the choice, not a footnote.
    const ageWear = career.age>26 ? (career.age-26)*0.9 : 0.5;
    const durRelief = (build.DUR-65)*0.04;
    const seasonWear = clamp(ageWear - durRelief, 0.3, 7);
    career.wearAndTear = clamp((career.wearAndTear||0) + seasonWear, 0, 100);
    if(!hadInjuryThisSeason){
      const recovery = career.age<28 ? 3 : 1.2;
      career.wearAndTear = clamp(career.wearAndTear - recovery, 0, 100);
    }
    const WEAR_BREAKDOWN_THRESHOLD = 45;
    if(career.wearAndTear > WEAR_BREAKDOWN_THRESHOLD){
      const breakdownChance = clamp((career.wearAndTear-WEAR_BREAKDOWN_THRESHOLD)*0.012, 0, 0.4);
      if(Math.random() < breakdownChance){
        const physicalKeys = ["ARM","REL","MOB","IMP"].filter(k=>build[k]>18);
        if(physicalKeys.length){
          const hitKeys = shuffle(physicalKeys).slice(0, Math.min(physicalKeys.length, randInt(1,2)));
          hitKeys.forEach(k=>{ build[k] = clamp(build[k]-randInt(2,5), 15, 99); });
          career.wearAndTear = clamp(career.wearAndTear - 22, 0, 100);
          season.wearBreakdown = { keys: hitKeys.slice() };
          const keyLabels = hitKeys.map(k=>(ATTR_BY_KEY[k]||{}).label||k).join(" and ");
          career.transactions.push(`${career.year}: Years of wear catch up with him — a permanent decline in ${keyLabels}.`);
        }
      }
    }

    career.totals.games += gamesPlayed; career.totals.comp += completionsFinal; career.totals.att += attempts;
    career.totals.yards += yardsFinal; career.totals.td += tdFinal; career.totals.int += intFinal; career.totals.sacks += sacks;
    career.totals.rushYards += rushYards; career.totals.rushTd += rushTd;
    career.totals.earnings += career.contract.apy;
    // real batting totals (comp=hits, att=PA, yards=TB, td=HR, int=K carry the aliases above)
    career.totals.bb = (career.totals.bb||0) + walks;
    career.totals.ab = (career.totals.ab||0) + ab;
    career.totals.hbp = (career.totals.hbp||0) + hbp;
    career.totals.sf = (career.totals.sf||0) + sf;
    career.totals.doubles = (career.totals.doubles||0) + doublesN;
    career.totals.triples = (career.totals.triples||0) + triples;
    career.totals.sb = (career.totals.sb||0) + sb;
    career.totals.cs = (career.totals.cs||0) + cs;
    career.totals.rbi = (career.totals.rbi||0) + rbi;
    career.totals.runs = (career.totals.runs||0) + runs;

    // Catches any season-level statistical achievement the moment this season's stat line locks in.
    checkAchievements();

    if(!career.peakSeason || rating>career.peakSeason.rating) career.peakSeason = season;

    // reputation drifts toward how the season actually went — accolades build it, a bad year
    // (or a bad stretch) chips at it. This is what makes organizational-trust and free-agency
    // events feel earned rather than random. The Super Bowl bonus specifically is applied later,
    // in finalizePlayoffOutcome, once a ring is actually something that happened rather than
    // something the sim already knows is coming.
    career.reputation = clamp(career.reputation + (mvp?8:0) + (allPro?4:0) + (proBowl?2:0)
      + (winPct>=0.65?1:winPct<=0.3?-2:0), 0, 100);

    // GM relations, fan support, and league popularity all drift with how the season actually
    // went, on top of whatever event-driven swings already hit them this year (org events,
    // infractions, positive breaks, locker-room outcomes). A good season builds trust with the
    // front office and the fanbase alike; a bad one erodes both, and national fame specifically
    // tracks the biggest, most visible moments (MVP, a ring) rather than routine solid play. Same
    // deferral as reputation above: the ring-sized bonuses land in finalizePlayoffOutcome.
    career.gmRelationship = clamp((career.gmRelationship ?? 50) + (mvp?4:0) + (allPro?2:0)
      + (winPct>=0.65?2:winPct<=0.3?-3:0), 0, 100);
    career.fanSupport = clamp((career.fanSupport ?? 50) + (mvp?5:0) + (proBowl?2:0)
      + (winPct>=0.65?3:winPct<=0.3?-4:0), 0, 100);
    career.leaguePopularity = clamp((career.leaguePopularity ?? 50) + (mvp?7:0) + (allPro?3:0)
      + (proBowl?1:0) - (winPct<=0.2?2:0), 0, 100);

    career.seasonsWithTeam++;
    career.contract.years--;
    tickTempBoosts();
    developAttributes(season, decade, league);
    if(career.isBackup) season.wonStartingJob = resolveBackupCompetition(effOverall);

    return season;
  }

  /* ================= Life events =================
     A season-by-season roll for the stuff that isn't just stat lines: infractions (suspension
     risk scales with DEC as a football-IQ/discipline proxy), rare career-altering scandals,
     positive breaks, and organizational shakeups whose odds scale with how big a deal this
     player actually is to his team (accolades, tenure, reputation). Reputation is a running
     score (0-100, starts at 50) nudged by both on-field results and these events; it feeds back
     into free agency and normal roster-cut risk, so a scandal has knock-on consequences beyond
     the event itself. */
  function playerProminence(){
    const t = career.totals;
    const accolades = t.proBowls*3 + t.allPros*5 + t.mvps*10 + t.rings*6;
    const tenure = Math.min(career.seasonsWithTeam, 10);
    return clamp(accolades + tenure*1.5 + (career.reputation-50)*0.4, 0, 100);
  }

  const INFRACTION_EVENTS = [
    { id:"dui", title:"DUI Arrest", severity:"minor", suspensionGames:[0,1], repHit:[-3,-8], mitigable:true,
      flavor:()=>"A late night, bad judgment, and a police report with his name on it. The league office is reviewing." },
    { id:"weapons", title:"Weapons Charge", severity:"minor", suspensionGames:[0,2], repHit:[-4,-10], mitigable:true,
      flavor:()=>"A legal gray area turns into a real charge. Nothing violent happened, but the headline doesn't say that." },
    { id:"conduct", title:"Conduct Complaint", severity:"minor", suspensionGames:[0,1], repHit:[-3,-9], mitigable:true,
      flavor:()=>"A shouting match, a shove, a story that leaks out of the building. The league wants an explanation." },
    { id:"substance", title:"Substance Issue", severity:"moderate", suspensionGames:[2,6], repHit:[-10,-20], mitigable:true,
      flavor:(decade)=>{
        if(decade==="1970s"||decade==="1980s") return "The party lifestyle catches up with him — a failed test, and whispers around the building about cocaine use finally become public.";
        if(decade==="2000s"||decade==="2010s") return "A dependency on the pills that were supposed to get him through a day game after a night game becomes a real problem, and it shows up on a drug test.";
        return "A failed substance test becomes public, and the league's substance-abuse program is now part of his career.";
      } },
    { id:"ped", title:"PED Suspension", severity:"moderate", minYear:1990, suspensionGames:[4,6], repHit:[-8,-16], mitigable:false,
      flavor:()=>"A positive test for a banned performance-enhancer. There's no appeal that beats a lab result." },
    { id:"gambling", title:"Gambling Policy Violation", severity:"moderate", suspensionGames:[4,10], repHit:[-12,-25], mitigable:true,
      flavor:(decade)=> decade==="2020s"
        ? "Legal sports betting is everywhere now, and he crossed a line the league still takes deadly seriously — a bet placed somewhere it shouldn't have been."
        : "A gambling connection surfaces — nothing about fixing games, but enough for the league to make an example of him." },
    { id:"leaked", title:"Leaked Messages Scandal", severity:"major", minYear:2010, suspensionGames:[4,10], repHit:[-20,-35], mitigable:true,
      flavor:()=>"Years-old private messages leak to the press — ugly, offensive, and now permanently public. Sponsors are already pulling out." },
    { id:"domestic", title:"Off-field Violent Incident", severity:"major", suspensionGames:[6,14], repHit:[-25,-40], mitigable:true,
      flavor:()=>"A police report from a domestic incident becomes national news. The league has a policy for exactly this, and it isn't lenient." },
    { id:"animalring", achievementId:"got_that_dawg", title:"Federal Investigation", severity:"career-multi", minYear:1990, suspensionSeasons:[2,3], repHit:[-40,-55], mitigable:false,
      flavor:()=>"Federal investigators uncover his financing of an underground animal fighting operation. The evidence is overwhelming, and this is no longer a baseball story." },
    { id:"video", title:"Video Evidence Goes Public", severity:"career-end", minYear:2000, repHit:-60, mitigable:false,
      flavor:()=>"Surveillance footage of a violent incident becomes public, and there is no explaining it away.",
      finalFlavor:"The commissioner's statement is one line long. He will not play in this league again." },
    { id:"sideline", title:"Dugout Meltdown Goes Viral", severity:"minor", suspensionGames:[0,1], repHit:[-4,-9], mitigable:true,
      flavor:()=>"A bat rack destroyed, a water cooler drop-kicked, a shouting match with the manager — all of it on camera. The clip is everywhere by the next morning." },
    { id:"tabloid", title:"Tabloid Scandal", severity:"minor", suspensionGames:[0,0], repHit:[-3,-7], mitigable:true,
      flavor:()=>"A messy public breakup, or worse, splashes across the tabloids. Nothing the league can touch, but it's the only thing anyone wants to ask about." },
    { id:"business", title:"Failed Business Venture Goes Public", severity:"minor", suspensionGames:[0,1], repHit:[-3,-8], mitigable:true,
      flavor:()=>"A restaurant, a crypto play, a clothing line — whatever it was, it collapsed publicly, and now there are headlines instead of a business." },
    { id:"hotmic", title:"Hot Mic Slur Controversy", severity:"moderate", suspensionGames:[1,4], repHit:[-10,-22], mitigable:true,
      flavor:()=>"A live mic catches something ugly. The league fines and suspends, and sponsors go quiet for a while." },
    { id:"socialmedia", title:"Deleted Tweet Controversy", severity:"minor", minYear:2006, suspensionGames:[0,0], repHit:[-2,-6], mitigable:true,
      flavor:()=>"An old post resurfaces at the worst possible time. He deletes it fast — too fast for it not to already be everywhere." },
    { id:"contractholdout", title:"Public Contract Standoff Turns Ugly", severity:"minor", suspensionGames:[0,2], repHit:[-5,-12], mitigable:true,
      flavor:()=>"A quiet push for a new deal spills into the media, and both sides start saying things in public they can't really walk back." },
  ];
  function infractionEventsFor(){
    const year = career.year;
    return INFRACTION_EVENTS.filter(e=> (!e.minYear || year>=e.minYear) && (!e.maxYear || year<=e.maxYear));
  }

  // A coach getting fired for poor results the SAME offseason the team just won it all reads as
  // flatly illogical (a real reported complaint) -- excludes just that one entry right after a
  // title, rather than suppressing org news generally (a new GM, ownership sale, etc. can still
  // happen for reasons that have nothing to do with the season just played).
  function orgEventsFor(){
    const lastSeason = career.seasonLog.length ? career.seasonLog[career.seasonLog.length-1] : null;
    const justWonTitle = !!(lastSeason && lastSeason.playoffs && lastSeason.playoffs.wonRing);
    return justWonTitle ? ORG_EVENTS.filter(e=>e.id!=="coachfired") : ORG_EVENTS;
  }

  // ----- Rare "easter egg" career-altering events -----
  // Reuses the exact same data shape and render/resolve pipeline as INFRACTION_EVENTS (severity,
  // suspensionGames/suspensionSeasons, repHit, mitigable, flavor, finalFlavor) so no new engine
  // code is needed -- only a separate, much lower-odds trigger roll (see the top of
  // lifeEventCheck()). Each is a genericized, fictionalized nod to a real, infamous, "how did he
  // manage to get himself out of the league" NFL moment -- no real player names, but recognizable
  // enough to land the joke. Tagged `legendary:true` and given a stable `achievementId` now so a
  // future achievements system can hook directly off career.lifeEventLog entries without a schema
  // change later.
  const RARE_EVENTS = [
    { id:"shotself", achievementId:"own_worst_enemy", legendary:true, title:"Accidentally Shoots Himself At a Nightclub",
      severity:"major", minYear:1990, suspensionGames:[8,16], repHit:[-30,-45], mitigable:false,
      flavor:()=>"A concealed handgun he wasn't legally carrying goes off in his own waistband on a night out, and he shoots himself in the leg. The league doesn't care that the only victim was him." },
    { id:"bountyscandal", achievementId:"bounty_hunter", legendary:true, title:"Bounty Program Scandal",
      severity:"career-multi", minYear:1985, suspensionSeasons:[1,1], repHit:[-35,-50], mitigable:false,
      flavor:()=>"Investigators uncover a pay-for-injury bounty system he helped run, targeting opposing hitters and pitchers. The commissioner makes an example of him with the harshest penalty short of a permanent ban." },
    { id:"disguiseflight", achievementId:"master_of_disguise", legendary:true, title:"Caught Skipping a Team Flight in Disguise",
      severity:"moderate", suspensionGames:[1,3], repHit:[-8,-18], mitigable:true,
      flavor:()=>"He's spotted boarding a flight in a bad wig and sunglasses to dodge team compliance staff — then gets recognized anyway, mid-disguise, by a fan with a phone camera. The video is not going away." },
    { id:"vanishseason", achievementId:"walked_away", legendary:true, title:"Walks Away Mid-Career to \"Find Himself\"",
      severity:"career-multi", suspensionSeasons:[1,1], repHit:[-15,-5], mitigable:false,
      flavor:()=>"No arrest, no scandal — he just quietly walks away from the game entirely for a while, chasing something the game clearly wasn't giving him. He'll have to talk his way back onto a roster whenever he's ready." },
    { id:"shootinvolved", achievementId:"wrong_place_wrong_time", legendary:true, title:"Named in a Nightclub Shooting Investigation",
      severity:"career-multi", minYear:1990, suspensionSeasons:[1,1], repHit:[-25,-40], mitigable:false,
      flavor:()=>"He wasn't the shooter, but he was there, and his name is now permanently tied to a nightclub shooting investigation. The league suspends him for the full season while it plays out." },
    { id:"gamblingruin", achievementId:"house_always_wins", legendary:true, title:"Gambling Debts Spiral Into a Career-Ending Scandal",
      severity:"career-end", repHit:-55, mitigable:false,
      flavor:()=>"What started as friendly action on the side spirals into a full-blown gambling problem — debts, a bookie who won't be ignored, and a betting pattern the league's investigators can't unsee.",
      finalFlavor:"The commissioner's office doesn't mince words: the integrity of the game comes first. He's out, permanently." },
    { id:"furniturebalcony", achievementId:"unraveling_on_camera", legendary:true, title:"Bizarre Public Meltdown Goes Viral",
      severity:"major", minYear:1990, suspensionGames:[4,10], repHit:[-20,-35], mitigable:true,
      flavor:()=>"Security footage of an unhinged, furniture-throwing meltdown at a hotel goes viral within hours. Teammates say he hasn't been himself for a while; the league says that's not their problem." },
  ];
  function rareEventsFor(){
    const year = career.year;
    return RARE_EVENTS.filter(e=> (!e.minYear || year>=e.minYear) && (!e.maxYear || year<=e.maxYear));
  }

  const POSITIVE_EVENTS = [
    { id:"mentor", title:"A Legend Takes Him Under His Wing", repDelta:[3,8], boosts:[{key:"DEC",delta:7},{key:"ANT",delta:6}], seasons:2,
      flavor:()=>"A recently-retired great from this era starts showing up to early work, unprompted. The extra cage time and pitch-plan talk show up fast." },
    { id:"mechanics", title:"Swing Overhaul", repDelta:[1,4], boosts:[{key:"SHA",delta:6},{key:"TCH",delta:5}], seasons:2,
      flavor:()=>"An offseason with a private hitting coach rebuilds his swing from the ground up. It looks different, and it plays different." },
    { id:"documentary", title:"Subject of a Hit Documentary", repDelta:[6,14], boosts:[], seasons:0,
      flavor:()=>"A behind-the-scenes documentary turns him into a cultural figure well beyond the baseball audience. Endorsement offers follow." },
    { id:"captain", title:"Named a Team Captain", repDelta:[4,9], boosts:[{key:"CLU",delta:5}], seasons:3, cutShield:true,
      flavor:()=>"The clubhouse makes him a captain. It's a vote of confidence, and it visibly changes how he carries himself with the game on the line." },
    { id:"schemefit", title:"A Lineup Built Around Him", repDelta:[1,3], boosts:[{key:"MOB",delta:6},{key:"IMP",delta:5}], seasons:2,
      flavor:()=>"A new hitting coach builds the whole approach around his strengths for the first time in his career." },
    { id:"shoedeal", title:"Signature Cleat Deal", repDelta:[4,10], boosts:[], seasons:0,
      flavor:()=>"An apparel brand builds a signature line around him. It's not about the baseball, but it doesn't hurt his standing either." },
    { id:"campboost", title:"Offseason Hitting Lab Pays Off", repDelta:[1,3], boosts:[{key:"ARM",delta:5},{key:"REL",delta:4}], seasons:2,
      flavor:()=>"A grueling offseason at an elite hitting lab sharpens his tools in ways that show up on video immediately." },
    { id:"filmroom", title:"Turns Into a Film-Room Rat", repDelta:[2,5], boosts:[{key:"DEC",delta:6},{key:"ANT",delta:5}], seasons:3,
      flavor:()=>"He starts showing up before the coaches do, breaking down every pitcher frame by frame. It changes how quickly he picks up spin out of the hand." },
    { id:"communityaward", title:"Wins the Roberto Clemente Award", repDelta:[8,16], boosts:[], seasons:0,
      flavor:()=>"Recognized league-wide for his work off the field. It doesn't move a single stat, but it matters at the negotiating table." },
    { id:"veteranleadership", title:"Becomes the Vocal Leader of a Turnaround", repDelta:[3,7], boosts:[{key:"CLU",delta:6}], seasons:2, cutShield:true,
      flavor:()=>"A young, struggling roster starts rallying around his voice specifically. It shows up in the late innings, with the game still in doubt." },
    { id:"offseasontrain", title:"Revolutionary Offseason Training Program", repDelta:[1,3], boosts:[{key:"DUR",delta:6}], seasons:3,
      flavor:()=>"A new sports-science-driven training regimen reshapes how his body holds up over the length of a full season." },
  ];

  /* ================= Lifepath: relationships & off-field flavor =================
     Two systems, both pure narrative/reputation-adjacent flavor (no attribute effects) so a
     career's PLAY never depends on its love life, but its STORY does. Every real name here is
     invented -- no actual celebrities, same safe convention RARE_EVENTS already established for
     "recognizable but fictional" NFL-moment easter eggs.

     1) A stateful relationship arc (career.relationship): single -> dating -> married, with
        breakup/divorce branches at each stage, so a partner's NAME persists across seasons and the
        story has real continuity instead of independent unconnected dice rolls -- one career's
        messy public breakup is a completely different story from another's quiet Vegas marriage.
     2) LIFEPATH_EVENTS: a large, one-off flavor pool (business ventures, hobbies, family, viral
        moments, a few fictionalized nods to real "how did that happen" pro-sports anecdotes) for
        sheer variety across a career, independent of the relationship arc. */
  const CELEBRITY_ARCHETYPES = [
    { type:"pop star", names:["Wren Delacroix","Journey Vaughn","Nova Sinclair","Bexley Storm","Lyric Monroe"] },
    { type:"movie star", names:["Vesper Kane","Rhys Callahan","Marlowe Voss","Sabine Wilder","August Reyne"] },
    { type:"supermodel", names:["Indigo March","Soleil Rousseau","Zara Winthrop","Lennox Fane","Coco Delvaux"] },
    { type:"reality TV star", names:["Brantley Kesh","Coralie Vance","Dakota Priestly","Harlow Beck","Remy Kingsley"] },
    { type:"R&B singer", names:["Amara Voss","Kingston Reyel","Selah Duvall","Osei Marchetti","Jolene Sharpe"] },
    { type:"late-night host", names:["Chip Halloway","Delancy Fox","Ronan Blackwood"] },
    { type:"tech founder", names:["Priya Kestrel","Wyatt Ashcombe","Neve Callister"] },
    { type:"country singer", names:["Waylon Cruz","Daisy Rae Holt","Tucker Lane"] },
  ];
  function pickCelebrityPartner(){
    const arche = pick(CELEBRITY_ARCHETYPES);
    return { name: pick(arche.names), type: arche.type };
  }
  const RELATIONSHIP_START_FLAVORS = [
    (n,t)=>`He's spotted front-row at a show with ${n}, the ${t}, and within a week it's confirmed — they're dating.`,
    (n,t)=>`A mutual friend sets him up with ${n}. Their first public appearance together, at an afterparty, is all anyone can talk about by morning.`,
    (n,t)=>`He slides into ${n}'s comments after she reposts one of his highlights. Three months later, they're official, and the tabloids are thrilled.`,
    (n,t)=>`They meet at a charity gala. A single blurry photo of the two of them talking is enough to spark a thousand headlines, all of which turn out to be true.`,
    (n,t)=>`A teammate's wedding, an open bar, and a seating chart that puts him next to ${n}. Neither of them saw it coming.`,
    (n,t)=>`${n} shows up to one of his games in a custom jersey, unannounced. The cameras find her by the second inning, and the internet does the rest.`,
  ];
  const RELATIONSHIP_BREAKUP_FLAVORS = [
    (n)=>`He and ${n} announce a quiet, mutual split. Both statements use the word "amicable" — and for once, it actually seems true.`,
    (n)=>`It ends messy — a subtweet, a very-not-vague caption from ${n}, and a week of headlines neither of them wanted.`,
    (n)=>`${n} is spotted with someone else before he's even confirmed the breakup. The internet does not let him forget it.`,
    (n)=>`He and ${n} quietly stop showing up to each other's events. No statement, no drama — just over.`,
    (n)=>`A very public argument at a very public restaurant ends the relationship in front of several people with phones out.`,
  ];
  const RELATIONSHIP_MARRIAGE_FLAVORS = [
    (n,t)=>`A surprise Vegas chapel wedding with ${n} — no guests, no press release, just a photo the next morning that breaks the internet.`,
    (n,t)=>`He proposes to ${n} on the field after a win, in front of a sold-out ballpark. She says yes. The stadium loses its mind.`,
    (n,t)=>`A televised wedding to ${n}, the ${t}, becomes the offseason's biggest media event — even people who don't watch baseball tune in.`,
    (n,t)=>`A quiet backyard ceremony with ${n} — close friends and family only, and it somehow stays out of the tabloids for almost a full week.`,
  ];
  const RELATIONSHIP_DIVORCE_FLAVORS = [
    (n)=>`He and ${n} file for an amicable divorce after growing apart. Both release near-identical statements asking for privacy, which nobody gives them.`,
    (n)=>`The divorce from ${n} gets ugly fast — dueling statements, a leaked prenup detail, and a gossip cycle that runs for months.`,
    (n)=>`${n} files first, and the tabloids spend weeks on "sources say" details neither side confirms.`,
  ];
  const RELATIONSHIP_ASIDE_FLAVORS = [
    (n)=>`He and ${n} welcome their first child. The delivery-room announcement is, briefly, the most-liked post on the internet.`,
    (n)=>`${n} shows up to one of his games wearing a custom jersey with her own name on the back. The replica sells out by the seventh-inning stretch.`,
    (n)=>`He and ${n} launch a joint business venture. Nobody's totally sure what it does, but the launch party is very well attended.`,
    (n)=>`${n} casts him in a two-second cameo in her new project. His one line gets more views than the trailer.`,
    (n)=>`He and ${n} renew their vows somewhere nobody can quite place on a map. The photos are, once again, everywhere.`,
  ];
  // Unified renderer for all 5 relationship-arc beats -- kind decides the flavor pool, the
  // rep/popularity math, and the next career.relationship state.
  function renderRelationshipEvent(kind){
    const content = document.getElementById("careerContent");
    let title, text, repDelta = 0, popDelta = 0;
    if(kind==="start"){
      const partner = pickCelebrityPartner();
      career.relationship = { status:"dating", partnerName:partner.name, partnerType:partner.type, startYear:career.year };
      title = `Dating ${partner.name}`;
      text = pick(RELATIONSHIP_START_FLAVORS)(partner.name, partner.type);
      repDelta = randInt(1,4); popDelta = randInt(4,10);
    } else if(kind==="breakup"){
      const partner = career.relationship;
      text = pick(RELATIONSHIP_BREAKUP_FLAVORS)(partner.partnerName);
      const messy = /messy|subtweet|spotted with someone else|public argument/i.test(text);
      title = `Split From ${partner.partnerName}`;
      repDelta = messy ? -randInt(4,9) : -randInt(0,2);
      popDelta = messy ? randInt(2,8) : randInt(-2,2); // messy breakups are, perversely, great for buzz
      career.relationship = null;
    } else if(kind==="marriage"){
      const partner = career.relationship;
      text = pick(RELATIONSHIP_MARRIAGE_FLAVORS)(partner.partnerName, partner.partnerType);
      title = `Marries ${partner.partnerName}`;
      career.relationship = { status:"married", partnerName:partner.partnerName, partnerType:partner.partnerType, startYear:career.year };
      repDelta = randInt(4,9); popDelta = randInt(6,14);
    } else if(kind==="divorce"){
      const partner = career.relationship;
      text = pick(RELATIONSHIP_DIVORCE_FLAVORS)(partner.partnerName);
      const messy = /ugly fast|files first/i.test(text);
      title = `Divorces ${partner.partnerName}`;
      repDelta = messy ? -randInt(8,16) : -randInt(2,6);
      popDelta = messy ? randInt(3,9) : randInt(-2,3);
      career.relationship = null;
    } else { // aside
      const partner = career.relationship;
      text = pick(RELATIONSHIP_ASIDE_FLAVORS)(partner.partnerName);
      title = `Life With ${partner.partnerName}`;
      repDelta = randInt(2,6); popDelta = randInt(3,8);
    }
    career.reputation = clamp(career.reputation + repDelta, 0, 100);
    career.leaguePopularity = clamp((career.leaguePopularity??50) + popDelta, 0, 100);
    career.lifeEventLog.push({ year:career.year, title, severity:"relationship" });
    recordLedgerEvent("relationship_event", { severity:"relationship" });
    career.transactions.push(`${career.year}: ${title}.`);
    content.innerHTML = eraWrap(decadeForYear(career.year), `
      <div class="ev-eyebrow">${career.year} · Personal Life</div>
      <h3>${title}</h3>
      <p>${text}</p>
      <div class="rep-note">Effect: Reputation ${fmtDelta(repDelta)} · League Popularity ${fmtDelta(popDelta)}.</div>
      <div class="event-choices"><button class="choice-btn" id="relAck"><div class="cb-title">Continue</div></button></div>
    `, {tone: repDelta>=0 ? "good" : "bad"});
    document.getElementById("relAck").addEventListener("click", secondaryLifeEventCheck);
  }
  // The relationship arc's own state machine: called independently of (and BEFORE) the usual
  // infraction/positive/org chain in lifeEventCheck, so it can't be crowded out by them. Returns
  // whether it actually rendered something, so the caller knows to stop dispatching further.
  function relationshipCheck(){
    if(Math.random()>=0.14) return false;
    const rel = career.relationship;
    if(!rel){
      if(Math.random()<0.5){ renderRelationshipEvent("start"); return true; }
      return false;
    }
    if(rel.status==="dating"){
      const roll = Math.random();
      if(roll<0.35){ renderRelationshipEvent("breakup"); return true; }
      if(roll<0.55){ renderRelationshipEvent("marriage"); return true; }
      return false;
    }
    if(rel.status==="married"){
      const roll = Math.random();
      if(roll<0.12){ renderRelationshipEvent("divorce"); return true; }
      if(roll<0.42){ renderRelationshipEvent("aside"); return true; }
      return false;
    }
    return false;
  }

  // General one-off lifepath flavor -- business ventures, hobbies, family, friendships, viral
  // moments, and a handful of fictionalized nods to real "you can't make this up" pro-sports
  // anecdotes (no real names, same convention as RARE_EVENTS). Deliberately mostly small/neutral
  // effects -- the point is variety and a laugh, not a stat lever.
  const LIFEPATH_EVENTS = [
    { id:"restaurant", title:"Opens a Restaurant", repDelta:[1,4],
      flavor:()=>"He opens a restaurant in the city he plays in. The food is, by all accounts, actually good — which surprises everyone, including the health inspector who keeps getting recognized." },
    { id:"cryptoflop", title:"Crypto Venture Quietly Dies", repDelta:[-3,0], minYear:2015,
      flavor:()=>"The token he endorsed a year ago is worth, functionally, nothing. He never brings it up, and neither does anyone in the clubhouse, to his face." },
    { id:"clothingline", title:"Launches a Clothing Line", repDelta:[1,5],
      flavor:()=>"A streetwear line with his logo on it sells out its first drop in nine minutes. Nobody, including him, expected that." },
    { id:"podcast", title:"Starts a Podcast", repDelta:[2,6], minYear:2004,
      flavor:()=>"A weekly podcast, mostly him and a rotating cast of teammates arguing about nothing, quietly becomes must-listen inside the league." },
    { id:"hottakes", title:"Hot Take Goes Viral", repDelta:[-4,4],
      flavor:()=>"An offhand opinion in a radio interview gets clipped, stripped of all context, and turns into a full news cycle. Reactions are, somehow, extremely mixed." },
    { id:"golfhobby", title:"Gets Seriously Into Golf", repDelta:[0,2],
      flavor:()=>"He takes up golf in the offseason and will not stop talking about his handicap. Teammates have started hiding when he brings up his short game." },
    { id:"chesshobby", title:"Becomes a Serious Chess Guy", repDelta:[1,3],
      flavor:()=>"He picks up chess to kill time on flights and, unexpectedly, gets genuinely good at it. His online rating is now a bigger point of pride than his OPS." },
    { id:"sixdogs", title:"Adopts Entirely Too Many Dogs", repDelta:[3,7],
      flavor:()=>"What started as one rescue dog is now, inexplicably, six. His house is reportedly chaos. His Instagram has never been better." },
    { id:"wildtattoo", title:"Gets a Very Large, Very Public Tattoo", repDelta:[-1,3],
      flavor:()=>"A new tattoo, taking up most of an arm, leaks before he's ready to show it off. Opinions on it are loud and extremely divided." },
    { id:"buyparents", title:"Buys His Parents a House", repDelta:[6,13],
      flavor:()=>"His first big veteran contract goes exactly where everyone hoped: a new house for his parents, handed over as a surprise. The video of the reaction is a permanent tearjerker." },
    { id:"siblingdrama", title:"Family Drama Goes Public", repDelta:[-6,-1],
      flavor:()=>"A sibling airs some real family business in an interview nobody asked for. He declines to comment, which somehow makes it a bigger story." },
    { id:"athletefriend", title:"Unlikely Friendship With a Star From Another Sport", repDelta:[2,6],
      flavor:()=>"He strikes up a genuine, very public friendship with a star from another sport entirely. Their courtside/rinkside appearances at each other's games become a whole thing." },
    { id:"mascotbeef", title:"Ongoing Beef With an Opposing Mascot", repDelta:[1,5],
      flavor:()=>"A pregame staredown with a division rival's mascot escalates into a running, mostly good-natured bit that the league's social team leans into every single time they play." },
    { id:"danceviral", title:"Bat Flip Goes Viral", repDelta:[3,8],
      flavor:()=>"A spur-of-the-moment bat flip becomes a genuine cultural moment. Kids in three different countries are doing it in their backyards by the following weekend." },
    { id:"wrongplayer", title:"Mistaken For a Completely Different Athlete", repDelta:[-1,3],
      flavor:()=>"He gets stopped in an airport by a fan absolutely convinced he's someone else, entirely different sport. He plays along for the photo. The story gets funnier every time he retells it." },
    { id:"badpressoutfit", title:"Pregame Outfit Becomes Bigger News Than the Game", repDelta:[0,5],
      flavor:()=>"His arrival outfit before a nationally televised game is, by first pitch, the single most-discussed thing about the series — more than either team's record." },
    { id:"micdup", title:"Mic'd Up Segment Goes Viral for the Wrong Reasons", repDelta:[-2,4],
      flavor:()=>"A mic'd-up broadcast segment catches him talking to himself, at length, in the third person. The clip is delightful. He is somewhat mortified." },
    { id:"chartererror", title:"Locked Out of the Team Facility", repDelta:[-1,2],
      flavor:()=>"He forgets his keycard, his phone is dead, and he spends twenty minutes locked out of the facility before a rookie finally lets him in. Teammates have not let it go." },
    { id:"sleepflight", title:"Caught Asleep on the Team Flight", repDelta:[-1,3],
      flavor:()=>"A photo of him asleep on the team plane, mouth wide open, makes its way around the group chat and then, inevitably, the internet." },
    { id:"charityrun", title:"Charity Foundation Takes Off", repDelta:[5,11],
      flavor:()=>"A foundation he started almost as an afterthought turns into a genuinely major operation. The league starts featuring it in broadcasts unprompted." },
    { id:"badfirstpitch", title:"Airmails a Warmup Throw Into the Stands", repDelta:[-2,3],
      flavor:()=>"A routine between-innings warmup throw across the diamond sails ten rows deep. The blooper packages will not let it go for years." },
    { id:"streamer", title:"Becomes an Unexpectedly Popular Video Game Streamer", repDelta:[1,5], minYear:2011,
      flavor:()=>"An offseason hobby streaming video games picks up a real audience — not huge, but loyal, and mostly there for the trash talk, not the gameplay." },
    { id:"conspiracy", title:"Accidentally Starts a Minor Conspiracy Theory", repDelta:[-1,4],
      flavor:()=>"An offhand, joking comment in an interview gets taken completely seriously by a corner of the internet, and now there's a real conspiracy theory with his name on it that he cannot talk his way out of." },
    { id:"babyannounce", title:"Announces He's Expecting", repDelta:[4,9],
      flavor:()=>"A pregnancy announcement, posted with zero warning, immediately becomes the most-liked thing he's ever put online — by a wide margin." },
    { id:"cameoshow", title:"Cameo on a TV Show", repDelta:[2,6],
      flavor:()=>"He plays a heightened version of himself in a two-episode arc on a network sitcom. His line delivery is, charitably, a work in progress. The internet loves it anyway." },
  ];
  function lifepathEventsFor(){
    const year = career.year;
    return LIFEPATH_EVENTS.filter(e=> !e.minYear || year>=e.minYear);
  }
  function renderLifepathEvent(ev){
    const content = document.getElementById("careerContent");
    const repDelta = randInt(ev.repDelta[0], ev.repDelta[1]);
    career.reputation = clamp(career.reputation + repDelta, 0, 100);
    career.leaguePopularity = clamp((career.leaguePopularity??50) + Math.round(repDelta*0.7), 0, 100);
    career.lifeEventLog.push({ year:career.year, title:ev.title, severity:"lifepath" });
    recordLedgerEvent("lifepath_event", { severity:"lifepath", choiceId: ev.id||null });
    career.transactions.push(`${career.year}: ${ev.title}.`);
    content.innerHTML = eraWrap(decadeForYear(career.year), `
      <div class="ev-eyebrow">${career.year} · Off the Field</div>
      <h3>${ev.title}</h3>
      <p>${ev.flavor()}</p>
      <div class="rep-note">Effect: Reputation ${fmtDelta(repDelta)}.</div>
      <div class="event-choices"><button class="choice-btn" id="lifepathAck"><div class="cb-title">Continue</div></button></div>
    `, {tone: repDelta>=0 ? "good" : "bad"});
    document.getElementById("lifepathAck").addEventListener("click", secondaryLifeEventCheck);
  }
  function lifepathCheck(){
    if(Math.random()>=0.11) return false;
    const pool = lifepathEventsFor();
    if(!pool.length) return false;
    renderLifepathEvent(pick(pool));
    return true;
  }

  /* ================= Rivalry-flavor events =================
     Pure narrative/reputation-adjacent flavor (same convention as lifepath events -- no attribute
     effects), but keyed to a SPECIFIC opponent via topActiveRivalry() rather than picked blind. A
     rivalry has to actually be developed (score>=40, see bumpRivalry) before this pool is even
     eligible to fire, so early-career seasons never see one -- there's nobody to have a rivalry
     with yet. Tone (toxic vs. respectful) is weighted by how hot the rivalry actually is: a fresh
     40-score rivalry skews respectful/competitive, a 90-score blood feud skews toxic. A toxic event
     escalates the score further; a respectful one cools it slightly -- the story and the number stay
     in sync in both directions. */
  const RIVALRY_EVENTS = [
    { id:"handshakesnub", tone:"toxic", title:"Won't Acknowledge Him All Series",
      flavor:(n)=>`He and ${n} won't so much as look at each other all series again this year — the cameras catch it every single time, and neither side denies it's on purpose.` },
    { id:"podcastbeef", tone:"toxic", title:"Dueling Podcast Beef",
      flavor:(n)=>`He and ${n} spend a full week trading shots at each other on their competing podcasts. Neither one backs down an inch.` },
    { id:"sidelineshove", tone:"toxic", title:"Benches-Clearing Shoving Match",
      flavor:(n)=>`Tempers finally boil over late — he and ${n} have to be separated, and both benches and bullpens empty onto the field.` },
    { id:"calledout", tone:"toxic", title:"Called Him Out By Name",
      flavor:(n)=>`A routine press conference question about ${n} gets an answer nobody expected — blunt, personal, and absolutely not what the PR department wanted.` },
    { id:"refusesname", tone:"toxic", title:"Refuses to Say His Name",
      flavor:(n)=>`Asked directly about ${n} in an interview, he pointedly refuses to say the name at all — "that guy" comes up four times in ninety seconds, and everyone notices.` },
    { id:"jerseyswap", tone:"respect", title:"Postgame Jersey Swap",
      flavor:(n)=>`After another classic, he and ${n} trade jerseys near home plate — the photo is everywhere within the hour.` },
    { id:"quietdinner", tone:"respect", title:"Quietly Gets Dinner With Him After the Game",
      flavor:(n)=>`He and ${n} are spotted getting dinner together after the game, like it's nothing. For a rivalry this fierce, it's a genuinely surprising story.` },
    { id:"charityevent", tone:"respect", title:"Co-Hosts a Charity Event With Him",
      flavor:(n)=>`He and ${n} team up for a charity event in the offseason, and the league can't stop talking about the optics.` },
    { id:"bestplayed", tone:"respect", title:"Calls Him the Best He's Ever Played Against",
      flavor:(n)=>`In a rare moment of candor, he calls ${n} "the best I've ever faced" — and clearly means it.` },
    { id:"offseasontexts", tone:"respect", title:"The Two of Them Text Every Offseason",
      flavor:(n)=>`A reporter's offhand mention reveals he and ${n} actually text each other every offseason. The rivalry, it turns out, has a real friendship quietly underneath it.` },
  ];
  function renderRivalryEvent(ev, rival){
    const content = document.getElementById("careerContent");
    const text = ev.flavor(rival.name, teamNameAt(rival.teamId, career.year));
    const repDelta = ev.tone==="toxic" ? -randInt(1,6) : randInt(2,7);
    const popDelta = ev.tone==="toxic" ? randInt(3,10) : randInt(2,6);
    career.reputation = clamp(career.reputation + repDelta, 0, 100);
    career.leaguePopularity = clamp((career.leaguePopularity??50) + popDelta, 0, 100);
    const rec = ensureRivalryRecord(rival.id);
    rec.score = clamp(rec.score + (ev.tone==="toxic" ? 6 : -4), 0, 100);
    career.lifeEventLog.push({ year:career.year, title:ev.title, severity:"rivalry" });
    recordLedgerEvent("rivalry_event", { opponentId: rival.teamId||null, severity:"rivalry", choiceId: ev.id||null });
    career.transactions.push(`${career.year}: ${ev.title} — vs. ${rival.name}.`);
    content.innerHTML = eraWrap(decadeForYear(career.year), `
      <div class="ev-eyebrow">${career.year} · Rivalry</div>
      <h3>${ev.title}</h3>
      <p>${text}</p>
      <div class="rep-note">Effect: Reputation ${fmtDelta(repDelta)} · League Popularity ${fmtDelta(popDelta)}.</div>
      <div class="event-choices"><button class="choice-btn" id="rivEventAck"><div class="cb-title">Continue</div></button></div>
    `, {tone: ev.tone==="toxic" ? "bad" : "good"});
    document.getElementById("rivEventAck").addEventListener("click", secondaryLifeEventCheck);
  }
  function rivalryEventCheck(){
    const top = topActiveRivalry(40);
    if(!top || Math.random()>=0.08) return false;
    const toxicChance = clamp(0.3 + (top.rec.score-40)*0.01, 0.3, 0.8);
    const tone = Math.random()<toxicChance ? "toxic" : "respect";
    const pool = RIVALRY_EVENTS.filter(e=>e.tone===tone);
    renderRivalryEvent(pick(pool), top.rival);
    return true;
  }

  // The one rivalry event with real mechanical teeth: needs an existing relationship AND a
  // genuinely toxic (score>=60) active rivalry to even be eligible, then ends the relationship
  // outright, same as a messy breakup, but tags the escalation onto the actual rivalry (biggest
  // rivalries in a long career should feel like they picked up real scar tissue along the way, not
  // just a scoreboard number). achievementId hooks the dark-humor "Two-Time Loser" achievement via
  // the same hadLifeEvent() mechanism the scandal achievements use.
  function rivalryAffairCheck(){
    if(!career.relationship) return false;
    const top = topActiveRivalry(60);
    if(!top || Math.random()>=0.03) return false;
    renderRivalryAffairEvent(top.rival, top.rec);
    return true;
  }
  function renderRivalryAffairEvent(rival, rec){
    const content = document.getElementById("careerContent");
    const partner = career.relationship;
    const teamName = teamNameAt(rival.teamId, career.year);
    const title = `Caught: ${partner.partnerName} and ${rival.name}`;
    const text = `${partner.partnerName} is photographed leaving dinner with ${rival.name}, the ${teamName} star — yes, THAT ${rival.name}, the one he's spent years trying to beat on the field. The tabloids don't need to add commentary. The photo says all of it.`;
    career.relationship = null;
    const repDelta = -randInt(6,14);
    const popDelta = randInt(8,20); // drama sells, same convention as a messy public breakup
    career.reputation = clamp(career.reputation + repDelta, 0, 100);
    career.leaguePopularity = clamp((career.leaguePopularity??50) + popDelta, 0, 100);
    rec.score = clamp(rec.score + 30, 0, 100);
    career.lifeEventLog.push({ year:career.year, title, severity:"rivalry", legendary:true, achievementId:"two_time_loser" });
    recordLedgerEvent("rivalry_event", { opponentId: rival.teamId||null, severity:"rivalry", outcomeId:"two_time_loser", metadata:{legendary:true} });
    career.transactions.push(`${career.year}: ${title}.`);
    content.innerHTML = eraWrap(decadeForYear(career.year), `
      <div class="ev-eyebrow">${career.year} · Personal Life</div>
      <h3>${title}</h3>
      <p>${text}</p>
      <div class="rep-note">Effect: Reputation ${fmtDelta(repDelta)} · League Popularity ${fmtDelta(popDelta)} · Relationship over.</div>
      <div class="event-choices"><button class="choice-btn" id="rivAffairAck"><div class="cb-title">Continue</div></button></div>
    `, {tone:"bad"});
    document.getElementById("rivAffairAck").addEventListener("click", secondaryLifeEventCheck);
  }

  const ORG_EVENTS = [
    { id:"coachfired", title:"His Coach Gets Fired", repDelta:0, strengthDelta:[-10,-4], gmDelta:[-6,2], setFlag:"_orgTurmoil", schemeChangeChance:0.5,
      flavor:()=>"The manager who believed in him is out after a rough stretch. The new staff doesn't owe him anything." },
    { id:"coachextended", title:"His Coach Gets Extended", repDelta:0, strengthDelta:[3,8], gmDelta:[2,6], setFlag:"_orgStability",
      flavor:()=>"Ownership hands his manager a contract extension. Stability, for once, instead of another regime change." },
    { id:"starleaves", title:"Top Bat Leaves in Free Agency", repDelta:0, strengthDelta:[-12,-5], target:"weapons", setFlag:null,
      flavor:()=>"The best hitter on the roster signs elsewhere for the money. The lineup has to be rebuilt around what's left." },
    { id:"fotrust", title:"Front Office Hands Him the Keys", repDelta:[3,6], strengthDelta:[0,0], gmDelta:[6,12], setFlag:"_leverageBoost", cutShield:true,
      flavor:()=>"Management makes it official in the press: this is the guy they're building around, for better or worse. It won't hurt at the negotiating table." },
    { id:"relocation", title:"Relocation Rumors Swirl", repDelta:0, strengthDelta:[-6,6], setFlag:null,
      flavor:()=>"Ownership is publicly flirting with another city. Nothing's decided, but the clubhouse is distracted." },
    { id:"podcastembarrass", title:"His Girlfriend Airs Their Business on Her Podcast", repDelta:[-9,-3], strengthDelta:[0,0], setFlag:null,
      flavor:()=>"She goes viral dragging him on her show. Nothing illegal, nothing the league can touch — but it's everywhere, and none of it is flattering." },
    { id:"newgm", title:"New GM Takes Over", repDelta:0, strengthDelta:[-8,10], setFlag:null, resetGM:true, schemeChangeChance:0.35,
      flavor:()=>"A front-office shakeup. Could be a fresh voice with a real plan, could be a rebuild with no real place for him — nobody in the building knows yet either. Whatever relationship existed with the old GM doesn't carry over." },
    { id:"oline", title:"Rotation Overhaul in Free Agency", repDelta:0, strengthDelta:[4,11], target:"oline", setFlag:"_orgStability",
      flavor:()=>"The front office actually spends real money on pitching this offseason, and it shows up in the run column immediately." },
    { id:"scandal_org", title:"Ownership Distracted by Off-field Controversy", repDelta:0, strengthDelta:[-9,-2], gmDelta:[-5,-1], setFlag:"_orgTurmoil",
      flavor:()=>"The owner's name is in the headlines for reasons that have nothing to do with baseball, and the whole building feels it." },
    { id:"viral_highlight", title:"A Highlight Goes Viral", repDelta:[3,7], strengthDelta:[0,0], setFlag:null,
      flavor:()=>"One absurd swing gets clipped and reposted everywhere. A nice ego boost, and not much else." },
    { id:"newstadium", title:"Team Opens a New Ballpark", repDelta:[2,5], strengthDelta:[3,8], setFlag:null,
      flavor:()=>"A new billion-dollar ballpark means new revenue, new energy, and ownership suddenly willing to spend to fill the seats." },
    { id:"ownershipsale", title:"Franchise Sold to New Ownership", repDelta:0, strengthDelta:[-8,8], setFlag:null,
      flavor:()=>"The team changes hands. Nobody in the building — including him — knows yet whether that's good news or bad." },
    { id:"gmbadblood", title:"Bad Blood With the GM", repDelta:0, strengthDelta:[0,0], gmDelta:[-18,-8], setFlag:null,
      flavor:()=>"A disagreement over usage, money, or just how a press conference got handled turns into something personal. The GM doesn't forget it." },
    { id:"gmtrust", title:"GM Publicly Backs Him", repDelta:[2,5], strengthDelta:[0,0], gmDelta:[10,18], setFlag:null,
      flavor:()=>"The general manager goes out of his way in a press conference to make it clear: this is his guy, full stop, no caveats." },
  ];
  // Called only for coachfired/newgm — front-office churn is the natural point a new play-caller
  // (and with him, a new offensive identity) shows up. Deliberately excludes the CURRENT scheme
  // from the reroll so "the scheme changed" always means something actually changed.
  function maybeChangeTeamScheme(){
    if(!career.teamScheme) return null;
    const others = SCHEMES.filter(s=>s.id!==career.teamScheme[career.teamId]);
    if(!others.length) return null;
    const next = pick(others);
    career.teamScheme[career.teamId] = next.id;
    return next;
  }

  /* ----- League News: the same "why did that team's grade move" narrative ORG_EVENTS gives the
     player's own team, extended league-wide to every OTHER team. Most seasons only a handful of
     teams roll a news event at all (see rollLeagueNews) -- most of the other ~25+ teams' grades
     that season just take the small residual noise/decline term below, no headline needed. Weights
     are deliberately percentile-shaped: the common entries move a team ±1-3, the two "big swing"
     entries (generational bust/breakout) are both rare (low weight) AND wider (±4-8), so a
     franchise-altering headline is a real but uncommon event, not routine season noise. ----- */
  const LEAGUE_NEWS_EVENTS = [
    { id:"draftbust", title:"Generational Prospect Bust", weight:3, strengthDelta:[-8,-4],
      flavor:(team)=>`The ${team}' can't-miss rookie has looked overmatched all spring — the kind of bust scouts will be dissecting for years.` },
    { id:"rookiestar", title:"Rookie Sensation Wins an Everyday Job", weight:4, strengthDelta:[3,7],
      flavor:(team)=>`A rookie nobody expected to break camp has forced the ${team}' hand and taken an everyday job outright.` },
    { id:"coachchange", title:"Coaching Change", weight:9, strengthDelta:[-5,4],
      flavor:(team)=>`The ${team} moved on from their manager this offseason — could be a fresh system, could be a rebuild nobody's excited about yet.` },
    { id:"blockbuster", title:"Blockbuster Trade", weight:6, strengthDelta:[2,5],
      flavor:(team)=>`The ${team} sent a package of prospects for a proven difference-maker at a position of need.` },
    { id:"capcasualty", title:"Payroll Cuts Gut the Roster", weight:7, strengthDelta:[-5,-1],
      flavor:(team)=>`A budget crunch forced the ${team} to trade and non-tender several longtime regulars this offseason.` },
    { id:"freeagentwin", title:"Front Office Wins Free Agency", weight:6, strengthDelta:[2,5],
      flavor:(team)=>`The ${team} landed the best available name in free agency, and it wasn't particularly close.` },
    { id:"holdOut", title:"Star Holds Out of Spring Training", weight:5, strengthDelta:[-4,-1],
      flavor:(team)=>`A contract standoff kept the ${team}' best player out of camp all spring; timing and chemistry both took a hit.` },
    { id:"ownershipmeddling", title:"Ownership Meddling", weight:4, strengthDelta:[-4,-1],
      flavor:(team)=>`Report after report describes an owner overruling his own front office — the building is reportedly not a fun place to work right now.` },
    { id:"schemeclicks", title:"New Approach Clicks Immediately", weight:5, strengthDelta:[2,4],
      flavor:(team)=>`A new hitting coach's approach fit the existing roster like a glove from the first day of camp.` },
    { id:"injurywave", title:"Rash of Spring Injuries", weight:5, strengthDelta:[-3,-1],
      flavor:(team)=>`An unusually bad run of spring injuries has already thinned the ${team}' roster before Opening Day.` },
  ];
  function rollLeagueNews(year, decade){
    const totalWeight = LEAGUE_NEWS_EVENTS.reduce((s,e)=>s+e.weight, 0);
    function pickWeighted(){
      let r = Math.random()*totalWeight;
      for(const e of LEAGUE_NEWS_EVENTS){ if(r<e.weight) return e; r -= e.weight; }
      return LEAGUE_NEWS_EVENTS[0];
    }
    // A handful of OTHER teams (never the player's own -- that's ORG_EVENTS' job) get a headline
    // this season, each independently, so most seasons feel different but no two feel alike.
    // t.start<=year excludes a team that hasn't joined the league yet -- this was the third
    // unguarded `TEAMS.filter(t=>t.id!==career.teamId)` site found (after generateLeagueRivals and
    // computeSeasonAwardRows), the exact cause of "Around the League" showing a headline for the
    // Houston Texans in a 1960s-decade career.
    const volMult = ERA_TEAM_VOLATILITY[decade] ?? 1.0;
    const others = TEAMS.filter(t=>t.id!==career.teamId && t.start<=year);
    others.forEach(t=>{
      if(Math.random()>=0.1) return;
      const ev = pickWeighted();
      // Scaled by era volatility -- these headline swings were previously era-blind, a real
      // (unclamped) jump source that made older/roster-continuity decades just as churny as modern
      // free agency, contrary to the intent of ERA_TEAM_VOLATILITY.
      const delta = Math.round(randInt(ev.strengthDelta[0], ev.strengthDelta[1]) * volMult);
      adjustTeamStrength(t.id, delta, 0);
      career.leagueNewsLog.push({ year, teamId: t.id, title: ev.title, delta, flavor: ev.flavor(teamNameAt(t.id, year)) });
    });
  }
  function buildLeagueNewsFeedHTML(){
    // Display-boundary guard (same pattern as computeSeasonAwardRows): an already-corrupted save
    // from before the write-time filter above existed can still have a logged entry for a team
    // that hadn't joined the league yet as of that entry's OWN year -- filter those out here too,
    // so this is never visible regardless of when a save got corrupted.
    const log = (career.leagueNewsLog || []).filter(n=>{
      const t = TEAMS.find(x=>x.id===n.teamId);
      return !(t && t.start>n.year);
    });
    if(!log.length) return `<div class="feed-wrap"><div class="feed-empty">No league news yet — check back after your rookie season.</div></div>`;
    const recent = log.slice(-16).reverse();
    const rows = recent.map(n=>`<div class="feed-line ${n.delta>=0?"good":"bad"}"><span class="feed-year tabular">${n.year}</span><span class="feed-text"><b>${svgEscape(teamNameAt(n.teamId, n.year))}</b> — ${svgEscape(n.title)} (${fmtDelta(n.delta)}). ${svgEscape(n.flavor)}</span></div>`).join("");
    return `<div class="feed-wrap">${rows}</div>`;
  }

  /* ----- Locker room & leadership: choice-driven interactions with teammates and coaches, not
     just stat rolls. Each event presents a genuine either/or, and the outcome — good or bad — is
     probabilistic rather than deterministic (the "right-sounding" choice usually works but can
     still backfire, and the riskier choice occasionally pays off big), so replaying the same
     event doesn't always play out the same way. The effect lands on career.teamStrength (the
     same "Team Grade" number every other system already reads and writes), matching the tester's
     own framing verbatim: "if it goes well the team rating increases, if the player chooses
     wrong it decreases." */
  const LOCKER_ROOM_EVENTS = [
    { id:"divawr", title:"The Unhappy Slugger",
      flavor:()=>"Your cleanup hitter is skipping early work, unhappy with where he bats and how he is being used. The rest of the room is starting to notice.",
      choices:[
        { id:"private", label:"Pull him aside, one-on-one", sub:"Handle it man-to-man, away from the cameras.", goodChance:0.72,
          goodText:"He shows up the next day. Not everything's fixed, but he knows you've got his back — and he plays like it.",
          badText:"He nods along in the meeting and keeps skipping practice anyway. Words without leverage don't move him.",
          goodDelta:[3,7], badDelta:[-4,-1] },
        { id:"public", label:"Call him out to the media", sub:"Make it about accountability, in public.", goodChance:0.35,
          goodText:"It works — he shows up humbled, and the rest of the room respects that you didn't let it slide.",
          badText:"He digs in, feels thrown under the bus, and now it's a real story instead of a locker-room issue.",
          goodDelta:[4,9], badDelta:[-9,-3] },
      ] },
    { id:"oline", title:"Winning Over the Pitching Staff",
      flavor:()=>"The rotation has its own culture — steak dinners, inside jokes, a code. Nobody said you're not welcome, but nobody's exactly invited you either.",
      choices:[
        { id:"buyin", label:"Buy the whole room dinner, no cameras", sub:"Show up, spend real money, stay off social media about it.", goodChance:0.78,
          goodText:"An old-school gesture for an old-school room, and it lands exactly right. The guys on the mound pitch for you a little harder after this.",
          badText:"Appreciated, but it doesn't really move anything. A nice gesture, forgotten by Monday's film session.",
          goodDelta:[3,7], badDelta:[-2,0] },
        { id:"performative", label:"Post about it for the fans", sub:"Turn the gesture into good publicity.", goodChance:0.25,
          goodText:"Somehow it still works — the room laughs it off and appreciates the effort anyway.",
          badText:"The room clocks it immediately as a PR move, not a real one. That reads worse than doing nothing at all.",
          goodDelta:[2,5], badDelta:[-7,-2] },
      ] },
    { id:"mentorrookie", title:"Mentoring the Kid", minAge:30,
      flavor:()=>"A prospect at your position just got called up — talented, a little lost, and clearly sizing up whether you're a threat or a resource.",
      choices:[
        { id:"teach", label:"Bring him in, teach him everything", sub:"Full scouting-report access, video sessions, the works.", goodChance:0.75,
          goodText:"He develops fast, the room notices the example you're setting, and it doesn't cost you a single at-bat.",
          badText:"He develops fast — fast enough that the front office starts openly wondering if they even need you anymore.",
          goodDelta:[4,8], badDelta:[-6,-2] },
        { id:"guard", label:"Keep him at arm's length", sub:"Protect your own job security instead.", goodChance:0.30,
          goodText:"Fair or not, it buys you time — and the front office reads it as competitive fire, not selfishness.",
          badText:"The room notices you freezing out a rookie who did nothing wrong. That's not a good look for a leader.",
          goodDelta:[1,4], badDelta:[-8,-3] },
      ] },
    { id:"rookieclass", title:"Setting the Tone for a Young Room",
      flavor:()=>"This year's draft class brought in a wave of new faces. Nobody's told them how things work here yet.",
      choices:[
        { id:"structure", label:"Run your own extra video sessions", sub:"Put in the unpaid extra hours yourself.", goodChance:0.70,
          goodText:"It becomes a standing tradition. The whole young core starts looking noticeably more comfortable at the plate.",
          badText:"Attendance is spotty and it fizzles out after a few weeks. The effort's noticed; the results aren't.",
          goodDelta:[3,6], badDelta:[-2,0] },
        { id:"leaveit", label:"Let the coaches handle it", sub:"That's what they're paid for.", goodChance:0.40,
          goodText:"Not every leader needs to run study hall — the room respects that you trust the staff to do their job.",
          badText:"The young guys quietly notice you never showed up for them. It costs you something in the room.",
          goodDelta:[0,3], badDelta:[-5,-1] },
      ] },
    { id:"contractjealousy", title:"A Teammate Resents Your Contract",
      flavor:()=>"A respected veteran on the roster has been grumbling — not to your face, but loud enough for it to get back to you — about what you're making compared to him.",
      choices:[
        { id:"talkit", label:"Address it directly with him", sub:"Have the uncomfortable conversation.", goodChance:0.68,
          goodText:"It's awkward for about five minutes, then it's actually fine. He respects that you didn't duck it.",
          badText:"He wasn't looking for a conversation, he was looking to vent. Now it's just awkward, permanently.",
          goodDelta:[2,6], badDelta:[-5,-1] },
        { id:"ignore", label:"Let it blow over on its own", sub:"Not every fire needs to be put out personally.", goodChance:0.45,
          goodText:"It does blow over, on its own, the way most locker-room grumbling eventually does.",
          badText:"It doesn't blow over — it curdles into something the whole room can feel on a bad Sunday.",
          goodDelta:[0,3], badDelta:[-6,-2] },
      ] },
    { id:"coachfriction", title:"Friction With the Hitting Coach",
      flavor:()=>"You and the hitting coach see your swing differently, and it's starting to show in the cage — pointed questions, a little too much sarcasm.",
      choices:[
        { id:"private2", label:"Hash it out behind closed doors", sub:"Keep it between the two of you.", goodChance:0.70,
          goodText:"You find common ground, and the meetings get a lot less tense after that.",
          badText:"He hears you out and nothing really changes. At least the room didn't see it happen.",
          goodDelta:[2,6], badDelta:[-2,0] },
        { id:"pushback", label:"Push back in front of the room", sub:"Make your case where everyone can hear it.", goodChance:0.30,
          goodText:"A bold move — and it actually works. The room quietly respects that you didn't back down.",
          badText:"It reads as showing him up in front of his own players. That's a hard thing to walk back.",
          goodDelta:[3,7], badDelta:[-8,-3] },
      ] },
  ];
  function lockerRoomEventsFor(){
    return LOCKER_ROOM_EVENTS.filter(e=> !e.minAge || career.age>=e.minAge);
  }
  function renderLockerRoomEvent(ev){
    const content = document.getElementById("careerContent");
    const choicesHtml = ev.choices.map((c,i)=>
      `<button class="choice-btn" data-i="${i}" id="lockerChoice${i}"><div class="cb-title">${c.label}</div><div class="cb-sub">${c.sub}</div></button>`
    ).join("");
    content.innerHTML = eraWrap(decadeForYear(career.year), `
        <div class="ev-eyebrow">${career.year} · Clubhouse</div>
        <h3>${ev.title}</h3>
        <p>${ev.flavor()}</p>
        <div class="event-choices">${choicesHtml}</div>
      `, {tone:"neutral"});
    ev.choices.forEach((c,i)=>{
      document.getElementById(`lockerChoice${i}`).addEventListener("click", ()=> resolveLockerRoomEvent(ev, c));
    });
  }
  function resolveLockerRoomEvent(ev, choice){
    const content = document.getElementById("careerContent");
    const good = Math.random() < choice.goodChance;
    const delta = good ? randInt(choice.goodDelta[0], choice.goodDelta[1]) : randInt(choice.badDelta[0], choice.badDelta[1]);
    adjustTeamStrength(career.teamId, delta, 0);
    career.lifeEventLog.push({ year:career.year, title:ev.title, severity: good?"locker-good":"locker-bad" });
    recordLedgerEvent("locker_room_event", { severity: good?"locker-good":"locker-bad", outcomeId: good?"good":"bad", metadata:{delta} });
    career.transactions.push(`${career.year}: ${ev.title} — ${good?"handled it well":"handled it poorly"} (team grade ${fmtDelta(delta)}).`);
    content.innerHTML = eraWrap(decadeForYear(career.year), `
        <div class="ev-eyebrow">${career.year} · Clubhouse</div>
        <h3>${ev.title}</h3>
        <p>${good ? choice.goodText : choice.badText}</p>
        <div class="rep-note">Effect: Team grade ${fmtDelta(delta)}.</div>
        <div class="event-choices"><button class="choice-btn" id="lockerAck"><div class="cb-title">Continue</div></button></div>
      `, {tone: good?"good":"bad"});
    document.getElementById("lockerAck").addEventListener("click", secondaryLifeEventCheck);
  }

  function lifeEventCheck(){
    if(career.seasonNumber<2){ waiverCheck(); return; }
    const decade = decadeForYear(career.year);
    // Relationship arc and general lifepath flavor get first priority, ahead of the rest of the
    // chain below -- they're pure narrative/reputation beats, never competing with an actual
    // infraction or org-news roll for the same season's "slot."
    if(relationshipCheck()) return;
    if(rivalryAffairCheck()) return;
    if(lifepathCheck()) return;
    if(rivalryEventCheck()) return;
    // Very-low-odds roll for a bizarre, career-altering easter egg, checked independently and
    // ahead of the ordinary infraction roll -- roughly 1-in-165 seasons, so most careers never see
    // one and a handful of very long careers might see exactly one.
    const rarePool = rareEventsFor();
    if(rarePool.length && Math.random() < 0.006){ renderInfractionEvent(pick(rarePool)); return; }
    const dec = eraEffective(career.age, decade).DEC;
    const infractionChance = clamp(0.02 + Math.max(0,(62-dec))*0.0026, 0.01, 0.13);
    const infractionPool = infractionEventsFor();
    if(infractionPool.length && Math.random()<infractionChance){ renderInfractionEvent(pick(infractionPool)); return; }
    const lockerPool = lockerRoomEventsFor();
    if(lockerPool.length && Math.random()<0.16){ renderLockerRoomEvent(pick(lockerPool)); return; }
    const prominence = playerProminence();
    const notableChance = clamp(0.065 + prominence*0.0032, 0.045, 0.32);
    if(Math.random()<notableChance){
      if(Math.random()<0.55){ renderPositiveEvent(pick(POSITIVE_EVENTS)); return; }
      renderOrgEvent(pick(orgEventsFor()));
      return;
    }
    waiverCheck();
  }

  // A second, independent, lower-odds roll for a different life event later in the same
  // offseason -- so a season can occasionally stack an infraction/positive/org beat with one
  // more instead of always capping at exactly one, without the complexity (or piling-on) of
  // letting a second infraction/suspension land on top of the first one this same season.
  function secondaryLifeEventCheck(){
    if(lifepathCheck()) return;
    if(rivalryEventCheck()) return;
    if(Math.random() < 0.12){
      const roll = Math.random();
      if(roll<0.4){ renderPositiveEvent(pick(POSITIVE_EVENTS)); return; }
      if(roll<0.6){
        const lockerPool = lockerRoomEventsFor();
        if(lockerPool.length){ renderLockerRoomEvent(pick(lockerPool)); return; }
      }
      renderOrgEvent(pick(orgEventsFor()));
      return;
    }
    waiverCheck();
  }

  function renderInfractionEvent(ev){
    const content = document.getElementById("careerContent");
    const flavor = ev.flavor(decadeForYear(career.year));
    let stakesText;
    if(ev.severity==="career-end"){
      stakesText = "At stake: banned from the league, career over.";
    } else if(ev.severity==="career-multi"){
      stakesText = `At stake: ${ev.suspensionSeasons[0]}-${ev.suspensionSeasons[1]} seasons suspended, released outright, reputation ${fmtDelta(ev.repHit[0])} to ${fmtDelta(ev.repHit[1])}.`;
    } else {
      const gLo = ev.suspensionGames ? ev.suspensionGames[0] : 0, gHi = ev.suspensionGames ? ev.suspensionGames[1] : 0;
      stakesText = `At stake: reputation ${fmtDelta(ev.repHit[0])} to ${fmtDelta(ev.repHit[1])}${gHi>0 ? ` · up to ${gHi} game${gHi===1?"":"s"} suspended` : ""}.`;
    }
    content.innerHTML = eraWrap(decadeForYear(career.year), `
        <div class="ev-eyebrow">${career.year} · Off the Field</div>
        <h3>${ev.title}</h3>
        <p>${flavor}</p>
        <div class="rep-note">${stakesText}</div>
        <div class="event-choices">
          <button class="choice-btn" id="infAccept"><div class="cb-title">${ev.severity==="career-end"?"Face the consequences":"Accept the discipline"}</div><div class="cb-sub">Take what's coming and move forward.</div></button>
          ${ev.mitigable ? `<button class="choice-btn" id="infFight"><div class="cb-title">Fight it — PR push &amp; legal team</div><div class="cb-sub">Might reduce it. Might make it worse.</div></button>` : ``}
        </div>
      `, {tone:"bad"});
    document.getElementById("infAccept").addEventListener("click", ()=> resolveInfraction(ev, false));
    const fightBtn = document.getElementById("infFight");
    if(fightBtn) fightBtn.addEventListener("click", ()=> resolveInfraction(ev, true));
  }

  function resolveInfraction(ev, fought){
    const content = document.getElementById("careerContent");
    let games = ev.suspensionGames ? randInt(ev.suspensionGames[0], ev.suspensionGames[1]) : 0;
    let repHit = Array.isArray(ev.repHit) ? randInt(ev.repHit[0], ev.repHit[1]) : ev.repHit;
    let outcomeText;
    if(fought){
      if(Math.random()<0.45){
        games = Math.round(games*0.35); repHit = Math.round(repHit*0.5);
        outcomeText = "The campaign works. The story fades faster than it should have, and the league goes easier than it could have.";
      } else {
        games = Math.round(games*1.6)+1; repHit = Math.round(repHit*1.7);
        outcomeText = "It backfires. The story won't die, the league throws the book at him, and the clubhouse notices.";
      }
    } else {
      outcomeText = games>0 ? "The league hands down its punishment, and that's that." : "A fine, a headline, and it blows over.";
    }
    career.reputation = clamp(career.reputation + repHit, 0, 100);
    // A scandal costs more nationally than it does with the home fanbase — the league office and
    // the rest of the country only know the headline, while the locals have years of context.
    career.fanSupport = clamp((career.fanSupport ?? 50) + Math.round(repHit*0.5), 0, 100);
    career.leaguePopularity = clamp((career.leaguePopularity ?? 50) + Math.round(repHit*0.7), 0, 100);
    career.lifeEventLog.push({ year:career.year, title:ev.title, severity:ev.severity, legendary: !!ev.legendary, achievementId: ev.achievementId||null });
    recordLedgerEvent("infraction_event", { severity: ev.severity, outcomeId: ev.achievementId||null, metadata:{legendary: !!ev.legendary} });

    if(ev.severity==="career-end"){
      career.transactions.push(`${career.year}: ${ev.title} — banned from the league.`);
      career.banned = true;
      // Stashed so finishCareer()/buildHofNarrative() can name the actual event that ended things,
      // instead of every forced-out career reading like a voluntary retirement (see exitReason).
      career._bannedEventTitle = ev.title;
      career._bannedEventNote = ev.finalFlavor || null;
      content.innerHTML = eraWrap(decadeForYear(career.year), `
        <div class="ev-eyebrow">${career.year} · League Discipline</div>
        <h3>Banned from the NFL.</h3>
        <p>${ev.finalFlavor}</p>
        <div class="rep-note">Effect: Reputation ${fmtDelta(repHit)} · career over.</div>
        <div class="event-choices"><button class="choice-btn" id="banAck"><div class="cb-title">See the final verdict</div></button></div>
      `, {tone:"bad"});
      document.getElementById("banAck").addEventListener("click", ()=>{ career.exitReason="banned"; finishCareer(); });
      return;
    }
    if(ev.severity==="career-multi"){
      career.suspensionSeasonsRemaining = randInt(ev.suspensionSeasons[0], ev.suspensionSeasons[1]);
      const oldTeam = teamNameAt(career.teamId, career.year);
      career.transactions.push(`${career.year}: ${ev.title} — suspended ${career.suspensionSeasonsRemaining} season(s), released by the ${oldTeam}.`);
      career.contract = { apy:0, years:0, tier:"minimum" };
      career._comebackFromSuspension = true;
      content.innerHTML = eraWrap(decadeForYear(career.year), `
        <div class="ev-eyebrow">${career.year} · League Discipline</div>
        <h3>Suspended ${career.suspensionSeasonsRemaining} season${career.suspensionSeasonsRemaining===1?"":"s"}.</h3>
        <p>${outcomeText} The ${oldTeam} cut ties immediately. Whatever comes next, he'll have to earn it back.</p>
        <div class="rep-note">Effect: Reputation ${fmtDelta(repHit)} · ${career.suspensionSeasonsRemaining} season${career.suspensionSeasonsRemaining===1?"":"s"} suspended · released, contract voided.</div>
        <div class="event-choices"><button class="choice-btn" id="suspAck"><div class="cb-title">Continue</div></button></div>
      `, {tone:"bad"});
      document.getElementById("suspAck").addEventListener("click", ()=>{ nextSeason(); });
      return;
    }
    // minor/moderate/major: reuse the missed-games/performance-penalty pipeline for the
    // suspension itself (tracked in its own bucket so the season narrative can tell it apart
    // from an actual injury), and let the reputation hit ripple into ordinary roster-cut risk
    // downstream.
    career._suspensionMissedGames = (career._suspensionMissedGames||0) + games;
    if(games>=6) career._injuryPenalty = (career._injuryPenalty||0) + 8;
    content.innerHTML = eraWrap(decadeForYear(career.year), `
      <div class="ev-eyebrow">${career.year} · Off the Field</div>
      <h3>${ev.title}${games>0?` — ${games}-game suspension`:""}</h3>
      <p>${outcomeText}</p>
      <div class="rep-note">Effect: Reputation ${fmtDelta(repHit)}${games>0?` · ${games}-game suspension`:""}${games>=6?" · lingering performance hit":""}.</div>
      <div class="event-choices"><button class="choice-btn" id="infAck"><div class="cb-title">Continue</div></button></div>
    `, {tone:"bad"});
    document.getElementById("infAck").addEventListener("click", ()=>{
      career.transactions.push(`${career.year}: ${ev.title}${games>0?` (${games}-game suspension)`:""}.`);
      secondaryLifeEventCheck();
    });
  }

  function renderPositiveEvent(ev){
    const content = document.getElementById("careerContent");
    const repDelta = randInt(ev.repDelta[0], ev.repDelta[1]);
    career.reputation = clamp(career.reputation + repDelta, 0, 100);
    career.fanSupport = clamp((career.fanSupport ?? 50) + Math.round(repDelta*0.4), 0, 100);
    career.leaguePopularity = clamp((career.leaguePopularity ?? 50) + Math.round(repDelta*0.6), 0, 100);
    if(ev.boosts && ev.boosts.length){
      career.tempBoosts = career.tempBoosts || [];
      ev.boosts.forEach(b=> career.tempBoosts.push({ key:b.key, delta:b.delta, seasonsLeft:ev.seasons }));
    }
    if(ev.cutShield) career._cutShieldSeasons = 1;
    career.lifeEventLog.push({ year:career.year, title:ev.title, severity:"positive" });
    recordLedgerEvent("positive_event", { severity:"positive", choiceId: ev.id||null });
    career.transactions.push(`${career.year}: ${ev.title}.`);
    const boostsText = ev.boosts && ev.boosts.length
      ? ev.boosts.map(b=> `${(ATTR_BY_KEY[b.key]||{}).label||b.key} ${fmtDelta(b.delta)} for ${ev.seasons} season${ev.seasons===1?"":"s"}`).join(" · ")
      : "";
    content.innerHTML = eraWrap(decadeForYear(career.year), `
      <div class="ev-eyebrow">${career.year} · Off the Field</div>
      <h3>${ev.title}</h3>
      <p>${ev.flavor()}</p>
      <div class="rep-note">Effect: Reputation ${fmtDelta(repDelta)}${boostsText ? ` · ${boostsText}` : ""}.</div>
      <div class="event-choices"><button class="choice-btn" id="posAck"><div class="cb-title">Continue</div></button></div>
    `, {tone:"good"});
    document.getElementById("posAck").addEventListener("click", secondaryLifeEventCheck);
  }

  function renderOrgEvent(ev){
    const content = document.getElementById("careerContent");
    const repDelta = Array.isArray(ev.repDelta) ? randInt(ev.repDelta[0], ev.repDelta[1]) : ev.repDelta;
    if(repDelta) career.reputation = clamp(career.reputation + repDelta, 0, 100);
    let strengthDelta = 0;
    if(ev.strengthDelta && (ev.strengthDelta[0]!==0 || ev.strengthDelta[1]!==0)){
      strengthDelta = randInt(ev.strengthDelta[0], ev.strengthDelta[1]);
      // Most org events move the whole team; "oline"/"starleaves" specifically target the
      // Supporting Cast grades instead, since those are a distinct signal from overall team quality.
      // Wave 5: a targeted single-component edit still has to recompute the derived aggregate right
      // after (recomputeMyTeamStrength) so career.teamStrength never goes stale relative to the
      // component that just moved it; an untargeted event nudges all five components equally
      // (adjustTeamStrength, noiseSpread 0) so it reproduces the exact same aggregate swing as
      // before while keeping every component legibly in sync too.
      if(ev.target==="oline"){ career.oline = clamp(career.oline + strengthDelta, 20, 99); recomputeMyTeamStrength(); }
      else if(ev.target==="weapons"){ career.weapons = clamp(career.weapons + strengthDelta, 20, 99); recomputeMyTeamStrength(); }
      else adjustTeamStrength(career.teamId, strengthDelta, 0);
    }
    // GM relations: most org events either nudge the existing relationship (gmDelta) or, for a
    // literal front-office change (resetGM, i.e. "newgm"), wipe the slate — a brand-new GM has no
    // history with him one way or the other, good or bad.
    let gmDelta = 0;
    if(ev.resetGM){
      const newVal = clamp(50 + randInt(-20,20), 0, 100);
      gmDelta = newVal - (career.gmRelationship ?? 50);
      career.gmRelationship = newVal;
    } else if(ev.gmDelta){
      gmDelta = randInt(ev.gmDelta[0], ev.gmDelta[1]);
      career.gmRelationship = clamp((career.gmRelationship ?? 50) + gmDelta, 0, 100);
    }
    let schemeNote = "";
    if(ev.schemeChangeChance && Math.random()<ev.schemeChangeChance){
      const newScheme = maybeChangeTeamScheme();
      if(newScheme) schemeNote = ` The offensive playbook changes with it — the team now runs a ${newScheme.name} system.`;
    }
    if(ev.setFlag) career[ev.setFlag] = true;
    if(ev.cutShield) career._cutShieldSeasons = 1;
    career.lifeEventLog.push({ year:career.year, title:ev.title, severity:"organization" });
    recordLedgerEvent("organization_event", { severity:"organization", choiceId: ev.id||null });
    career.transactions.push(`${career.year}: ${ev.title}${schemeNote?" — new offensive scheme installed":""}.`);
    // tone follows the actual rolled outcome, not just a fixed per-event label -- a swingy event
    // like "New GM Takes Over" (strengthDelta:[-8,10]) reads as good or bad card styling based on
    // which way the dice actually landed this time, not a coin-flip-blind neutral every time.
    const netGood = repDelta>0 || strengthDelta>0 || gmDelta>0 || ev.setFlag==="_orgStability" || ev.setFlag==="_leverageBoost";
    const netBad = repDelta<0 || strengthDelta<0 || gmDelta<0 || ev.setFlag==="_orgTurmoil";
    const good = netGood && !netBad;
    const effectParts = [];
    if(repDelta) effectParts.push(`Reputation ${fmtDelta(repDelta)}`);
    if(strengthDelta) effectParts.push(`${ev.target==="oline"?"O-Line grade":ev.target==="weapons"?"Weapons grade":"Team grade"} ${fmtDelta(strengthDelta)}`);
    if(gmDelta) effectParts.push(`GM relations ${fmtDelta(gmDelta)}`);
    if(!effectParts.length) effectParts.push("No direct stat change — narrative only.");
    content.innerHTML = eraWrap(decadeForYear(career.year), `
      <div class="ev-eyebrow">${career.year} · Around the Building</div>
      <h3>${ev.title}</h3>
      <p>${ev.flavor()}${schemeNote}</p>
      <div class="rep-note">Effect: ${effectParts.join(" · ")}.</div>
      <div class="event-choices"><button class="choice-btn" id="orgAck"><div class="cb-title">Continue</div></button></div>
    `, {tone: good ? "good" : (netBad ? "bad" : "neutral")});
    document.getElementById("orgAck").addEventListener("click", secondaryLifeEventCheck);
  }

  // A durable build plays longer, a fragile one wears out sooner -- DUR is the one attribute
  // deliberately left un-adjusted by era or scheme (see the ERA_ATTR_MULT note above) specifically
  // because it's meant to read as "how long can THIS guy's body hold up," so it's the natural lever
  // for how long a career can run at all, not just how often a given season gets interrupted. 41 was
  // previously a flat wall for every build regardless of DUR; now it's what an average (65) DUR
  // build gets, sliding to as low as 35 for a truly fragile build and as high as 45 for an elite-DUR
  // one who plays like he's ageless. Also feeds waiverCheck's age-related roster risk below, so a
  // high-DUR vet doesn't just play longer -- teams also don't start pushing him out the door as early.
  // Grounded in real NFL career-length data rather than an invented curve. Sourced numbers: QBs on
  // an active roster average ~5.4 years (Statista, Sept-2025 active-roster survey) -- but that pool
  // is dragged down hard by camp arms and career backups who never really start. Two better anchors
  // for "a build good enough to be drafted and handed a starting job" (this game's entire premise)
  // are the reported all-position averages for first-round picks (~9.3 years) and for players with
  // real Pro-Bowl-caliber careers (~11.7 years) (RunRepeat's NFL career-length research review) --
  // this game's mean sits between those two. There's no single published stddev for "starter career
  // length" to lift directly, so 4.5 years is a synthesized estimate consistent with the spread those
  // sources imply (a 2-3 year career for an outright bust, 20+ for a true ironman) -- documented here
  // instead of asserted as more precise than it is. DUR runs 10-99 across every build in the game
  // (the attribute-slider floor/ceiling used everywhere else, e.g. the Build Editor); 65 is the same
  // flat "neutral" value the rest of the sim already treats DUR as when it isn't being adjusted (see
  // neutralEffective). DUR=10 -- the literal floor of the scale, not just "low" -- lands ~2.5 standard
  // deviations below the mean, matching a real-world true outlier; DUR=99 lands ~2.5 above it, checked
  // against the longest QB career ever actually played (George Blanda, 26 seasons) as a sanity ceiling.
  const STARTER_CAREER_MEAN_YEARS = 12;
  const STARTER_CAREER_STDDEV_YEARS = 5;
  const DUR_NEUTRAL = 65, DUR_FLOOR = 10, DUR_CEIL = 99, DUR_EXTREME_Z = 2.5;
  function durabilityCareerYears(dur){
    const d = clamp(dur, DUR_FLOOR, DUR_CEIL);
    const z = d>=DUR_NEUTRAL
      ? ((d-DUR_NEUTRAL)/(DUR_CEIL-DUR_NEUTRAL)) * DUR_EXTREME_Z
      : ((d-DUR_NEUTRAL)/(DUR_NEUTRAL-DUR_FLOOR)) * DUR_EXTREME_Z;
    // floor of 1 (not 0) -- even the single worst-possible-durability build gets to actually play
    // his drafted rookie season before the numbers can end it; a true DUR=10 build then faces the
    // hard cap the very next offseason, which is exactly the "one and done" outcome that grade
    // implies. Ceiling of 26 matches Blanda's real record rather than inventing a fictional max.
    return clamp(STARTER_CAREER_MEAN_YEARS + z*STARTER_CAREER_STDDEV_YEARS, 2, 24);
  }
  function durabilityAgeCap(){
    const dur = build ? build.DUR : DUR_NEUTRAL;
    return clamp(Math.round(22 + durabilityCareerYears(dur)), 25, 44);
  }
  // Roster-cut "aging vet" scrutiny (waiverCheck) and career-arc flavor text (renderSeasonCard)
  // both need a THIS-BUILD-relative "starting to look old" age, but scaling it 1:1 with the hard
  // durability cap above breaks down at the extremes -- a DUR=10 build's cap sits at 23, and nobody
  // should read as a declining veteran at 23. Front offices and fans mostly react to how a guy is
  // actually playing and moving, not a durability grade nobody in-universe can see, so this damps
  // the swing to 40% of how far this build's cap sits from the neutral (DUR=65) cap of 32 -- e.g. a
  // fragile build's scrutiny starts a few years earlier than league-average, an ironman's a few
  // years later, but nothing like the full spread of the underlying durability curve.
  function agingVetThreshold(){
    const cap = durabilityAgeCap();
    return Math.round(34 + (cap-34)*0.4);
  }

  /* ----- career loop control -----
     Priority each offseason: age cap → banned? → serving a suspension? → life event → waived? →
     expansion draft? → traded? → contract expiring? → injury? → play the season.
     Each stage either renders an event and pauses (its buttons call the next stage), or falls through. */
  function advanceCareer(){
    if(career.age>=durabilityAgeCap()){ career.exitReason="age"; career.forcedOut=false; finishCareer(); return; }
    if(career.banned){ career.exitReason="banned"; finishCareer(); return; }
    if(career.suspensionSeasonsRemaining>0){ renderSuspensionYear(); return; }
    if(career.injuryLeaveSeasonsRemaining>0){ renderInjuryLeaveYear(); return; }
    lifeEventCheck();
  }

  /* ================= Wave 3 (MASTER_REMEDIATION_SPEC.md): living league during user absence =====
     Before this wave, renderSuspensionYear/renderInjuryLeaveYear just decremented a counter and
     called nextSeason() directly -- advanceCareer() returned before generateSeason() was ever
     reached, so NOTHING else in the league moved for that calendar year: no rival aged, no new
     season was recorded for anyone, no team's grade drifted, no expansion franchise starting that
     year got initialized, no awards or postseason happened for anyone. A multi-season absence
     silently froze the entire simulated world.
     simulateLeagueYearWithoutUser(reason) fixes this by reusing generateSeason() ITSELF rather than
     a parallel simulation engine: forcing the user's own missed-games count to the full season
     length makes generateSeason()'s EXISTING "a generic backup covers the missed games, team record
     and personal record can differ" machinery produce exactly the right shape (zero personal games,
     a real team record, a real -- if unwatched -- playoff run) using the exact same schedules/
     standings/awards/postseason/contracts/development/mobility/team-drift/history/expansion-
     catch-up code every normal season already runs. There is no second engine to keep in sync. */
  // Auto-resolves the phantom team's playoff run with no interactive reveal -- nobody is watching a
  // season card during an absence, so there's nothing to pace this against. round.won is already
  // fully decided the instant stepConferenceBracket creates each round (see confirmPlayoffRound's
  // own comment); skipping the reveal just means no Key Moment mini-game ever gets a chance to swing
  // it, which is correct here -- a Key Moment is a player skill check, and the player isn't present.
  function autoResolveAbsencePlayoffRun(season){
    const playoffs = season.playoffs;
    const bd = season.leagueStandings && season.leagueStandings.bracket;
    if(playoffs && playoffs.made){
      // confirmPlayoffRound locksteps the other conference by exactly one round every time it
      // confirms one of the phantom team's own -- by the time this loop ends, bd.otherChampionId
      // is already resolved too, same as the normal interactive path.
      while(!playoffs.done) confirmPlayoffRound(playoffs, season);
    } else if(bd){
      // A real bug caught while testing a two-season absence: when the phantom team misses the
      // playoffs entirely, resolvePlayoffs's own mySeedIdx===-1 branch calls
      // tryFinalizeLeaguePlayoffBracket immediately -- but that function only finalizes once
      // bd.myChampionId is already known, and "my" conference's flat bracket normally only steps
      // forward via the player's own "Simulate Next Round" click (simulateNextPlayoffTreeRound),
      // which never happens during an absence with no season card rendered at all. Left alone,
      // bd.myChampionId (and therefore ls.playoffBracket) would simply never resolve for an
      // absence year the phantom team didn't make the playoffs in. Flat-resolve it directly here,
      // exactly like the other conference already is.
      while(bd.myChampionId==null) stepBracketConferenceOnce(bd, season, "my");
    }
    // Safety net regardless of which branch ran above: guarantee BOTH conferences are fully
    // resolved before finalizing (a no-op wherever confirmPlayoffRound's own lockstepping already
    // finished one). Found by Wave 5's own regression sweep: when the phantom team's playoffs.done
    // was ALREADY true the instant this function runs (eliminated in an earlier round, on some
    // earlier call/season), the `while(!playoffs.done)` loop above runs zero iterations -- meaning
    // confirmPlayoffRound never locksteps "my" conference's OWN remaining games (e.g. a Conference
    // Championship the phantom team wasn't part of) even though it was needed. The old version of
    // this safety net only ever covered `otherChampionId`, silently leaving `myChampionId` (and
    // therefore ls.playoffBracket) unresolved forever for that season. Both loops are no-ops once
    // already resolved, so this is safe to run unconditionally regardless of which branch ran above.
    if(bd){
      while(bd.myChampionId==null) stepBracketConferenceOnce(bd, season, "my");
      while(bd.otherChampionId==null) stepBracketConferenceOnce(bd, season, "other");
    }
    finalizeAbsenceSeasonPostseason(season);
    tryFinalizeLeaguePlayoffBracket(season);
  }
  // Counterpart to finalizePlayoffOutcome, deliberately NOT the same function: a ring the phantom
  // team wins during an absence year is a real TEAM fact (recordTeamSeasonHistory/
  // markConferenceChampionInHistory already captured the division/conference title; season.awards
  // gets the ring label for this season's own record) but never a PERSONAL one -- the user did not
  // play a single snap, so crediting career.totals.rings/reputation/gmRelationship/fanSupport/
  // leaguePopularity/a "won the Super Bowl" transaction (everything finalizePlayoffOutcome normally
  // does) would attribute an accomplishment to someone who wasn't on the field for it.
  function finalizeAbsenceSeasonPostseason(season){
    if(season.postseasonFinalized) return;
    season.postseasonFinalized = true;
    const playoffs = season.playoffs;
    if(!playoffs || !playoffs.made) return;
    const wonRing = playoffs.wonSuperBowl;
    playoffs.wonRing = wonRing;
    if(wonRing){
      playoffs.ringLabel = "World Series Champion";
      season.awards.push(playoffs.ringLabel);
    }
  }
  // Runs a full league year -- schedules, every AI QB's usage/stats, standings, awards, postseason
  // champion/ring attribution, contracts, development, mobility, team drift, history, and expansion
  // catch-up -- for a season the user does not personally play. `reason` is "suspension" or
  // "injury"; NOTE: this codebase has no cap/pay-docking mechanic distinguishing the two (contract
  // years/earnings already accrue unconditionally inside generateSeason() for every season, always
  // did before this wave too), so both reasons follow the exact same actual contract rules -- there
  // is no existing "no pay during suspension" rule this wave would need to preserve or bypass.
  function simulateLeagueYearWithoutUser(reason){
    const decade = decadeForYear(career.year);
    const league = LEAGUE[decade];
    if(reason==="suspension") career._suspensionMissedGames = league.games;
    else career._injuryMissedGames = league.games;
    const season = generateSeason();
    season.absenceReason = reason;
    autoResolveAbsencePlayoffRun(season);
    return season;
  }

  function renderSuspensionYear(){
    const content = document.getElementById("careerContent");
    career.suspensionSeasonsRemaining--;
    const remaining = career.suspensionSeasonsRemaining;
    // Wave 3: the league-year simulation runs exactly once per year actually served, right here --
    // never on the "click Wait it out" transition (that would double-run it if the player reloaded
    // mid-interstitial), and never skipped just because nobody's watching.
    simulateLeagueYearWithoutUser("suspension");
    // Wave 1: checkpoint each year of a suspension actually served -- a real "material decision"
    // point (per the spec) that used to only ever get captured by the once-per-season save, which
    // this exact interstitial is never inside of (advanceCareer returns here before generateSeason
    // is ever reached for a suspended year).
    saveActiveCareer({ phase:"decision", eventId:"suspension_year" });
    content.innerHTML = eraWrap(decadeForYear(career.year), `
        <div class="ev-eyebrow">${career.year} · League Suspension</div>
        <h3>Still serving the ban.</h3>
        <p>${remaining>0 ? `The league isn't budging. ${remaining} more season${remaining===1?"":"s"} before he's eligible to play again.` : `The suspension is over. Now it's a question of whether anyone still wants him.`}</p>
        <div class="event-choices"><button class="choice-btn" id="suspContinue"><div class="cb-title">${remaining>0?"Wait it out":"Test the market"}</div></button></div>
      `, {tone:"bad"});
    document.getElementById("suspContinue").addEventListener("click", nextSeason);
  }

  function renderInjuryLeaveYear(){
    const content = document.getElementById("careerContent");
    career.injuryLeaveSeasonsRemaining--;
    const remaining = career.injuryLeaveSeasonsRemaining;
    const teamName = teamNameAt(career.teamId, career.year);
    // Wave 3: same one-league-year-per-real-year rule as renderSuspensionYear above.
    simulateLeagueYearWithoutUser("injury");
    saveActiveCareer({ phase:"decision", eventId:"injury_leave_year" });
    content.innerHTML = eraWrap(decadeForYear(career.year), `
        <div class="ev-eyebrow">${career.year} · Injured Reserve</div>
        <h3>Still rehabbing.</h3>
        <p>${remaining>0 ? `Another year of rehab before he's medically cleared. The ${teamName} are paying him to get better, not to play.` : `He's finally cleared. Now the real question: does the arm — and the nerve — still work like it used to?`}</p>
        <div class="event-choices"><button class="choice-btn" id="injLeaveContinue"><div class="cb-title">${remaining>0?"Keep rehabbing":"Report back to camp"}</div></button></div>
      `, {tone:"bad"});
    document.getElementById("injLeaveContinue").addEventListener("click", nextSeason);
  }

  function waiverCheck(){
    const decade = decadeForYear(career.year);
    const effOverall = computeEffOverall(career.age, decade);
    // "aging vet" scrutiny now kicks in relative to THIS build's own durability-adjusted career
    // window (see durabilityAgeCap) instead of a flat age-32/33 that treated a max-DUR and
    // min-DUR build identically -- a durable build gets treated like a reliable veteran for
    // longer, a fragile one starts looking like a decline case earlier.
    const nearEndAge = agingVetThreshold();
    // Compare to a neutral (65-everywhere) build run through the SAME age/era adjustment rather
    // than a flat number -- otherwise the hitter-overall scale (heavily weighted to the mental
    // group, which ages up slowly) makes every young player read as "below the bar" and rack up a
    // badStreak that gets them cut by year 4. `edge` is how far this build sits above/below
    // replacement level right now; `badThreshold` is expressed on that edge scale.
    const schemeIdW = career.teamScheme ? career.teamScheme[career.teamId] : null;
    const neutralOverallW = weighted(neutralEffective(career.age, decade, schemeIdW), OVERALL_WEIGHTS);
    const edge = effOverall - neutralOverallW;
    const badThreshold = career.age>=nearEndAge ? -2 : -8;
    if(edge<badThreshold) career.badStreak = (career.badStreak||0)+1; else career.badStreak = 0;
    // real rosters get younger as a QB ages late in his window regardless of how well he's still
    // playing — succession planning, cap crunches, a coaching change — so even a still-productive
    // build faces meaningfully rising churn risk late in a career, not just a hard wall at the cap.
    const ageRisk = career.age>nearEndAge ? (career.age-nearEndAge)*0.03 : 0;
    // a battered reputation (a scandal, a bad PR fight) raises ordinary roster risk too — teams
    // are quicker to move on from a name that's become a distraction. Front-office turmoil from
    // a coaching change does the same, one-time, for the season it happens.
    const repRisk = career.reputation<35 ? (35-career.reputation)*0.012 : 0;
    const turmoilRisk = career._orgTurmoil ? 0.08 : 0;
    const stabilityRelief = career._orgStability ? 0.05 : 0;
    career._orgTurmoil = false; career._orgStability = false;
    // Relationships are supposed to matter, not just be a number on a screen: a GM who trusts you
    // and a fanbase that loves you both make the front office measurably more reluctant to cut
    // ties, the same way bad blood with the GM or a booed-out-of-town reputation makes it easier
    // for them to move on. League-wide fame gets a smaller version of the same effect (a bigger
    // name is a bigger story to cut). These used to sit on career untouched by roster-cut risk
    // entirely -- only the separate `reputation` stat fed repRisk above.
    const gmRelief = clamp(((career.gmRelationship ?? 50)-50)*0.0032, -0.14, 0.14);
    const fanRelief = clamp(((career.fanSupport ?? 50)-50)*0.0026, -0.11, 0.11);
    const popRelief = clamp(((career.leaguePopularity ?? 50)-50)*0.0014, -0.06, 0.06);
    // Front-office COMPETENCE (Round 9), distinct from gmRelief (how much the GM likes YOU) -- a
    // sharp front office is more patient and strategic about a roster decision; an incompetent one
    // panics faster, independent of personal rapport.
    const gmSkillRelief = clamp(((career.gmGrade ?? 60)-60)*0.002, -0.08, 0.08);
    // A one-season shield after the org just publicly anointed him (named captain, made the vocal
    // leader of a turnaround, handed the keys by the front office) so that vote of confidence and
    // a roster cut don't land in the same offseason and read as whiplash -- addresses the exact
    // "named captain, cut right after" complaint.
    const captainShield = career._cutShieldSeasons>0 ? 0.09 : 0;
    if(career._cutShieldSeasons>0) career._cutShieldSeasons--;
    const cutChance = clamp(Math.max(0, badThreshold-edge)*0.02 + career.badStreak*0.06 + ageRisk + repRisk + turmoilRisk
      - stabilityRelief - gmRelief - gmSkillRelief - fanRelief - popRelief - captainShield, 0.02, 0.75);
    if(career.seasonNumber>=3 && Math.random()<cutChance){ renderWaivedEvent(effOverall, decade); return; }
    expansionDraftCheck();
  }

  function renderWaivedEvent(effOverall, decade){
    const oldTeam = teamNameAt(career.teamId, career.year);
    // A well-liked, well-known name gets more benefit of the doubt on the open market -- some other
    // front office is more willing to take a flier on a guy the fanbase already loves or the league
    // already knows, even off a release.
    const marketRelief = clamp(((career.fanSupport ?? 50)-50)*0.0016 + ((career.leaguePopularity ?? 50)-50)*0.0012, -0.06, 0.10);
    const reSignChance = clamp(0.7 - (career.age-26)*0.03 - career.badStreak*0.08 + marketRelief, 0.05, 0.85);
    const canSign = Math.random()<reSignChance;
    let offerTeam=null, offerApy=0;
    if(canSign){
      // A cut is still a cut (a "prove-it" deal, not top dollar) but the destination shouldn't be
      // capped at a flat 15-60 team grade regardless of who's being cut -- a real proven starter
      // still draws interest from a genuinely good team looking for a value/prove-it flier, even
      // right after a surprising release. Range scales up with the player's own recent overall.
      const lo = clamp(15 + (effOverall-50)*0.5, 15, 55);
      const hi = clamp(60 + (effOverall-50)*0.7, 60, 92);
      offerTeam = pickTeamByStrength(career.year, career.teamId, lo, hi);
      offerApy = Math.round(veteranAPY(decade,"minimum") * (Math.random()<0.3?1.4:1));
    }
    const content = document.getElementById("careerContent");
    const choices = canSign ? `
        <button class="choice-btn" id="waSign"><div class="cb-title">Sign a prove-it deal with the ${teamNameAt(offerTeam.id, career.year)}</div><div class="cb-sub">${fmtMoney(offerApy)}/yr, no guarantees — just a shot at a bench job.</div></button>
        <button class="choice-btn" id="waRetire"><div class="cb-title">Call it a career</div><div class="cb-sub">Walk away on your own terms instead.</div></button>`
      : `<button class="choice-btn" id="waRetire"><div class="cb-title">There's nothing left.</div><div class="cb-sub">No team is calling. The league has moved on.</div></button>`;
    content.innerHTML = eraWrap(decadeForYear(career.year), `
        <div class="ev-eyebrow">Roster Cuts · ${career.year}</div>
        <h3>Released by the ${oldTeam}.</h3>
        <p>${effOverall<40 ? "The tape hasn't been good, and everyone in the building knows it." : "A numbers game, a new manager, a payroll crunch — the reasons don't matter. You're off the 40-man."}</p>
        <div class="event-choices">${choices}</div>
      `, {tone:"bad"});
    const signBtn = document.getElementById("waSign");
    if(signBtn) signBtn.addEventListener("click", ()=>{
      career.transactions.push(`${career.year}: Released by the ${oldTeam}, signed by the ${teamNameAt(offerTeam.id,career.year)} on a minimum deal.`);
      reassignRivalsForTeamChange(career.teamId, offerTeam.id);
      const _oldTeamId = career.teamId;
      career.teamId = offerTeam.id; career.seasonsWithTeam = 0;
      // Wave 5: inherit the new team's real, persistent profile instead of rolling a fresh one;
      // hand the old team back its own real profile in the same call (handOffTeamProfile).
      handOffTeamProfile(_oldTeamId, offerTeam.id);
      career.contract = { apy: offerApy, years: 1, tier: "minimum" };
      career.badStreak = 0;
      saveActiveCareer({ phase:"decision", eventId:"waiver_signed" });
      checkInjuryThenPlay();
    });
    document.getElementById("waRetire").addEventListener("click", ()=>{
      career.exitReason = "waived";
      career.forcedOut = true;
      career.transactions.push(`${career.year}: Released by the ${oldTeam}. Didn't play again.`);
      finishCareer();
    });
  }

  /* ----- expansion draft: fires the one season a franchise is about to join the league. His
     current team can't protect everyone — the more he actually means to the roster, the safer
     he is, but exposure alone doesn't guarantee the new team actually spends a pick on him. ----- */
  function expansionDraftCheck(){
    // Fires as part of the SAME offseason transaction chain (waiver -> expansion -> trade -> free
    // agency) that runs every call to nextSeason() -- and nextSeason() already increments
    // career.year BEFORE this chain runs (see advanceCareer()). So a new franchise joining the
    // league for the season about to be played has t.start===career.year right now, not
    // career.year+1 -- that off-by-one used to attach the player to a team divisionsForYear(year)
    // (and therefore standings/conference-rank lookups) wouldn't recognize as existing yet for
    // this exact season, producing the "team not in standings, #0 of N in the conference" bug.
    const newTeams = TEAMS.filter(t=>t.start===career.year && t.id!==career.teamId);
    if(!newTeams.length){ tradeCheck(); return; }
    const decade = decadeForYear(career.year);
    const effOverall = computeEffOverall(career.age, decade);
    const prominence = playerProminence();
    const protectChance = clamp(0.25 + prominence*0.007 + (effOverall-60)*0.01, 0.05, 0.95);
    if(Math.random()<protectChance){ tradeCheck(); return; }
    const pickChance = clamp(0.12 + (effOverall-50)*0.006, 0.04, 0.5);
    if(Math.random()<pickChance){ renderExpansionDraftEvent(pick(newTeams)); return; }
    tradeCheck();
  }

  function renderExpansionDraftEvent(newTeam){
    const content = document.getElementById("careerContent");
    const oldTeam = teamNameAt(career.teamId, career.year);
    const newTeamName = teamNameAt(newTeam.id, career.year);
    content.innerHTML = eraWrap(decadeForYear(career.year), `
        <div class="ev-eyebrow">Expansion Draft · ${career.year}</div>
        <h3>Left unprotected — and the ${newTeamName} want him.</h3>
        <p>The ${oldTeam} could only protect so many names before the new franchise picked through the rest of the roster. He's the veteran they build the expansion club around instead.</p>
        <div class="event-choices"><button class="choice-btn" id="expAck"><div class="cb-title">Report to the ${newTeamName}</div></button></div>
      `);
    document.getElementById("expAck").addEventListener("click", ()=>{
      career.transactions.push(`${career.year}: Left unprotected, selected by the expansion ${newTeamName}.`);
      reassignRivalsForTeamChange(career.teamId, newTeam.id);
      const _oldTeamId = career.teamId;
      career.teamId = newTeam.id;
      // Wave 5: inherit the new (expansion) team's real, persistent profile instead of rolling a
      // fresh one -- ensureLeagueTeamGrades (inside handOffTeamProfile) lazily initializes it on
      // first sight, satisfying "every active franchise gets a profile" for a brand-new team too.
      handOffTeamProfile(_oldTeamId, newTeam.id);
      career.seasonsWithTeam = 0;
      tradeCheck();
    });
  }

  function tradeCheck(){
    const decade = decadeForYear(career.year);
    const effOverall = computeEffOverall(career.age, decade);
    const tier = performanceTier(effOverall);
    const eligible = career.contract.years>0 && career.age>=30 && career.teamStrength<42 && (tier==="good"||tier==="average") && career.seasonsWithTeam>=1;
    // a GM who's soured on him is that much quicker to shop him around when he's already an
    // eligible trade candidate; a GM firmly in his corner sits on the asset longer instead.
    const gmRel = career.gmRelationship ?? 50;
    const gmPush = clamp((50-gmRel)*0.004, -0.10, 0.15);
    if(eligible && Math.random()<clamp(0.30+gmPush, 0.08, 0.55)){ renderTradeEvent(); return; }
    freeAgencyCheck();
  }

  function renderTradeEvent(){
    const oldTeam = teamNameAt(career.teamId, career.year);
    const team = pickTeamByStrength(career.year, career.teamId, 55, 95);
    const newTeamName = teamNameAt(team.id, career.year);
    career.transactions.push(`${career.year}: Traded from the ${oldTeam} to the ${newTeamName}.`);
    reassignRivalsForTeamChange(career.teamId, team.id);
    const _oldTeamId = career.teamId;
    career.teamId = team.id; career.seasonsWithTeam = 0;
    handOffTeamProfile(_oldTeamId, team.id);
    recordLedgerEvent("traded", { teamId: team.id, opponentId: _oldTeamId, outcomeId:"sim_initiated" });
    // Wave 1: material transaction -- checkpoint the new team assignment right away.
    saveActiveCareer({ phase:"decision", eventId:"traded" });
    const content = document.getElementById("careerContent");
    content.innerHTML = eraWrap(decadeForYear(career.year), `
        <div class="ev-eyebrow">Trade · ${career.year}</div>
        <h3>Traded to the ${newTeamName}.</h3>
        <p>The ${oldTeam} are rebuilding and cashed in your trade value. A contender picked up the phone. Your contract comes with you.</p>
        <div class="event-choices"><button class="choice-btn" id="tradeAck"><div class="cb-title">Report to your new team</div><div class="cb-sub">Same deal, new clubhouse.</div></button></div>
      `);
    document.getElementById("tradeAck").addEventListener("click", freeAgencyCheck);
  }

  /* ----- Player-initiated trade request: a limited, risky lever the player can pull from the
     season hub instead of just waiting on the sim. Capped at 3 uses per career with a 2-season
     cooldown between asks so it can't be spammed every offseason. Three outcomes: the front
     office grants it (a real trade, same shape as the sim-driven one above), they say no (a small
     reputation ding for the awkward ask, nothing else changes), or -- if the tape has genuinely
     been bad -- they skip the trade shopping entirely and just release him instead. */
  function canRequestTrade(){
    return career.contract.apy>0 && !career.banned && career.suspensionSeasonsRemaining<=0 &&
      career.injuryLeaveSeasonsRemaining<=0 && (career._tradeRequestCooldown||0)<=0 &&
      (career._tradeRequestsUsed||0) < 3;
  }
  function requestTrade(){
    const decade = decadeForYear(career.year);
    const effOverall = computeEffOverall(career.age, decade);
    const content = document.getElementById("careerContent");
    const oldTeam = teamNameAt(career.teamId, career.year);
    career._tradeRequestsUsed = (career._tradeRequestsUsed||0) + 1;
    career._tradeRequestCooldown = 2;

    // GM relations color how this ask lands: a GM who's had bad blood with him is quicker to
    // just cut ties outright and slower to actually grant the trade; a GM in his corner is the
    // opposite — more patient with a bad season, and readier to actually work the phones.
    const gmRel = career.gmRelationship ?? 50;
    const releaseMult = clamp(1 + (50-gmRel)*0.012, 0.5, 1.7);
    const grantChance = clamp(0.45 + (gmRel-50)*0.006, 0.15, 0.75);

    if(effOverall < 45 && Math.random() < 0.35*releaseMult){
      career.reputation = clamp(career.reputation - 6, 0, 100);
      career.transactions.push(`${career.year}: Requested a trade out of the ${oldTeam} — released instead.`);
      recordLedgerEvent("trade_requested", { teamId: career.teamId, outcomeId:"released_instead" });
      content.innerHTML = eraWrap(decade, `
        <div class="ev-eyebrow">${career.year} · Front Office</div>
        <h3>They didn't shop him. They cut him.</h3>
        <p>Asking out with tape like this doesn't land well. The ${oldTeam} decide a trade isn't worth the effort — it's easier to just move on.</p>
        <div class="event-choices"><button class="choice-btn" id="reqTradeCutAck"><div class="cb-title">Continue</div></button></div>
      `, {tone:"bad"});
      document.getElementById("reqTradeCutAck").addEventListener("click", ()=> renderWaivedEvent(effOverall, decade));
      return;
    }

    if(Math.random() < grantChance){
      const team = pickTeamByStrength(career.year, career.teamId, 35, 92);
      const newTeamName = teamNameAt(team.id, career.year);
      career.transactions.push(`${career.year}: Requested a trade — dealt from the ${oldTeam} to the ${newTeamName}.`);
      reassignRivalsForTeamChange(career.teamId, team.id);
      const _oldTeamId = career.teamId;
      career.teamId = team.id; career.seasonsWithTeam = 0;
      handOffTeamProfile(_oldTeamId, team.id);
      recordLedgerEvent("trade_requested", { teamId: team.id, opponentId: _oldTeamId, outcomeId:"granted" });
      // Wave 1: material transaction -- checkpoint the new team assignment right away.
      saveActiveCareer({ phase:"decision", eventId:"trade_requested_granted" });
      content.innerHTML = eraWrap(decade, `
        <div class="ev-eyebrow">${career.year} · Trade Request</div>
        <h3>Request granted — dealt to the ${newTeamName}.</h3>
        <p>The front office honors it. The ${oldTeam} find a willing partner, and a new locker room opens up. Same contract, new colors.</p>
        <div class="event-choices"><button class="choice-btn" id="reqTradeAck"><div class="cb-title">Report to your new team</div></button></div>
      `);
      document.getElementById("reqTradeAck").addEventListener("click", beginOffseason);
      return;
    }

    career.reputation = clamp(career.reputation - 2, 0, 100);
    career.transactions.push(`${career.year}: Requested a trade out of the ${oldTeam} — denied.`);
    recordLedgerEvent("trade_requested", { teamId: career.teamId, outcomeId:"denied" });
    content.innerHTML = eraWrap(decade, `
      <div class="ev-eyebrow">${career.year} · Front Office</div>
      <h3>Request denied.</h3>
      <p>They hear him out and say no. He's still part of the plan — for now — but it's an awkward conversation to have had in that building.</p>
      <div class="event-choices"><button class="choice-btn" id="reqTradeDeniedAck"><div class="cb-title">Continue</div></button></div>
    `);
    document.getElementById("reqTradeDeniedAck").addEventListener("click", beginOffseason);
  }

  function freeAgencyCheck(){
    if(career.contract.years<=0){ renderFreeAgencyEvent(); return; }
    checkInjuryThenPlay();
  }

  /* ----- free agency: a real negotiation, not a pick-a-button menu. A handful of interested
     teams show up based on need (proxied off how strong/weak their roster already grades out),
     the player's last season or two, age, and reputation — a bad team wouldn't offer last
     year's near-MVP a camp-arm role, and a struggling backup won't hear from a contender. Each
     offer can be pushed on for more money; push too hard and that team walks and the offer's
     gone for good. A small independent chance of an "agent event" — a windfall like an
     unexpectedly team-friendly deal working out great, or the opposite, a lowball nobody saw
     coming — can land on any one offer regardless of how the negotiating goes. ----- */
  // Wave 6 (MASTER_REMEDIATION_SPEC.md): tierRank/teamNeedRank (the old contract-tier ranking and
  // "100 minus incumbent talent, bucketed" need proxy) are superseded by buildTeamQuarterbackNeed/
  // scoreFreeAgentFit below, which read the incumbent's real value directly rather than bucketing
  // it into 5 need tiers first -- removed rather than left as dead code.
  // Wave 6 (MASTER_REMEDIATION_SPEC.md): "a current aggregate-grade proxy, not a record/playoff
  // trajectory" was a named defect -- a team's grade alone said nothing about whether it was
  // ACTUALLY on a real run or a real slide. Now blends the persistent grade (still the anchor -- a
  // bad roster can't be a real contender no matter its recent luck) with up to 3 seasons of
  // recency-weighted record (career.teamSeasonHistory) and real titles (division/conference/
  // championship), producing 4 tiers instead of 3 -- "contender" sits between "retool" and
  // "win-now" for a team that's clearly good but hasn't (yet) separated itself into true win-now
  // territory. Calibrated via a seeded sweep (see PROGRESS.md) rather than picked from intuition.
  function teamCompetitiveWindow(teamId, year){
    year = year || career.year;
    const isMine = teamId===career.teamId;
    const overall = isMine ? career.teamStrength : (career.leagueStrength[teamId] ?? 60);
    const hist = ((career.teamSeasonHistory||{})[teamId]||[]).slice(-3);
    let weightedWinPct = 0.5;
    if(hist.length){
      let sumWinPct=0, sumW=0;
      hist.forEach((h,i)=>{
        const w = i+1; // most-recent season (last in the slice) weighted highest
        const gp = (h.wins||0)+(h.losses||0)+(h.ties||0);
        const wp = gp>0 ? ((h.wins||0)+(h.ties||0)*0.5)/gp : 0.5;
        sumWinPct += wp*w; sumW += w;
      });
      weightedWinPct = sumW>0 ? sumWinPct/sumW : 0.5;
    }
    const titleBoost = hist.filter(h=>h.wonChampionship).length*12 + hist.filter(h=>h.wonConference).length*6
      + hist.filter(h=>h.wonDivision).length*3 + hist.filter(h=>h.madePlayoffs).length*2;
    const score = clamp(overall + (weightedWinPct-0.5)*40 + titleBoost, 0, 130);
    if(score>=93) return "win-now";
    if(score>=76) return "contender";
    if(score>=50) return "retool";
    return "rebuild";
  }
  // Wave 6: the player's own resume, built the same way for the user (qbId===USER_QB_ID) or any
  // rival by id -- FA offers only ever build this for the user today, but the shape is genuinely
  // reusable (nothing here special-cases "this must be the person signing"). Every field named in
  // the spec's own "player market profile" list is present; accomplishmentScore is the real
  // substitute for the old isOldAccomplished (age>=34 + current tier, no real achievements
  // inspected at all) -- a real, weighted read of rings/MVPs/All-Pros/Pro Bowls/playoff appearances.
  function buildPlayerMarketProfile(qbId, year){
    const qb = getQuarterbackById(qbId);
    if(!qb) return null;
    const isUserEntry = !!qb.isUser;
    const decade = decadeForYear(year);
    const age = isUserEntry ? career.age : qb.age;
    const effOverall = isUserEntry ? computeEffOverall(career.age, decade) : rivalEffTalent(qb);
    const totals = qb.totals || {};
    const seasons = (qb.seasons || []).slice().sort((a,b)=>a.year-b.year);
    // Last two seasons, recency- AND playing-time-weighted -- a hot LAST year should read stronger
    // than a merely-good year two seasons back, and a token relief season shouldn't count as heavily
    // as a full starter's year even if the per-game rate looked fine.
    const recentSeasons = seasons.slice(-2);
    let recentFormSum = 0, recentFormWeight = 0;
    recentSeasons.forEach((s,i)=>{
      const recencyWeight = i===recentSeasons.length-1 ? 0.65 : 0.35;
      const seasonGames = (LEAGUE[decadeForYear(s.year)]||{}).games || 16;
      const playingTimeShare = clamp((s.games||0)/seasonGames, 0, 1);
      const w = recencyWeight * (0.4 + 0.6*playingTimeShare);
      recentFormSum += (s.rating||0) * w;
      recentFormWeight += w;
    });
    const recentFormRating = recentFormWeight>0 ? recentFormSum/recentFormWeight : null;
    const availability = isUserEntry
      ? ((career.suspensionSeasonsRemaining>0) ? { reason:"suspension" } : (career.injuryLeaveSeasonsRemaining>0 ? { reason:"injury" } : null))
      : (qb.availability || null);
    const mvps = totals.mvps||0, allPros = totals.allPros||0, proBowls = totals.proBowls||0, rings = totals.rings||0;
    const playoffAppearances = isUserEntry ? (career.seasonLog||[]).filter(s=>s.playoffs && s.playoffs.made).length : 0;
    // Rivals don't carry a per-season playoffs.rounds structure the way the user does -- rings/
    // All-Pros/Pro Bowls already capture the bulk of a rival's real playoff-relevant reputation, so
    // playoffAppearances is a documented user-only signal, not a hard requirement of the score below.
    const accomplishmentScore = mvps*20 + allPros*12 + proBowls*6 + rings*25 + playoffAppearances*4;
    const tier = performanceTier(effOverall);
    const expectedApy = veteranAPY(decade, tier);
    return {
      qbId, name: qb.name, age, effOverall, tier,
      expectedApy, contractRange: { low: Math.round(expectedApy*0.82), high: Math.round(expectedApy*1.25) },
      recentFormRating, careerStarts: totals.games||0, availability, isCurrentlyUnavailable: !!availability,
      mvps, allPros, proBowls, rings, playoffAppearances,
      reputation: isUserEntry ? career.reputation : null,
      accomplishmentScore,
      isYoungPlayer: age<=27,
      // Calibrated via a seeded sweep (see PROGRESS.md) against real accomplishmentScore
      // distributions -- replaces the old isOldAccomplished (age alone + current tier).
      isAccomplishedVeteran: age>=32 && accomplishmentScore>=28,
    };
  }
  // Wave 6: everything a team's own front office would actually know about its QB room and recent
  // trajectory before deciding how hard to chase a free agent -- current QB1/QB2/QB3 (live registry,
  // not a stale snapshot), up to 3 seasons of weighted record/titles, the team's real persistent
  // five-grade profile/scheme, and its competitive window (teamCompetitiveWindow above).
  function buildTeamQuarterbackNeed(teamId, year){
    year = year || career.year;
    const decade = decadeForYear(year);
    const qbs = getTeamQuarterbacks(teamId);
    const valOf = qb => qb ? (qb.isUser ? Math.round(computeEffOverall(career.age, decade)) : rivalEffTalent(qb)) : null;
    const rows = ["QB1","QB2","QB3"].map(slot=>{
      const qb = qbs[slot];
      return qb
        ? { slot, present:true, id:qb.id, name:qb.name, val:valOf(qb), age:qb.age, availability: qb.availability||null, contract: qb.contract||null }
        : { slot, present:false };
    });
    const hist = ((career.teamSeasonHistory||{})[teamId]||[]).slice(-3);
    let recentWeightedWinPct = null;
    if(hist.length){
      let sumWinPct=0, sumW=0;
      hist.forEach((h,i)=>{
        const w = i+1;
        const gp = (h.wins||0)+(h.losses||0)+(h.ties||0);
        const wp = gp>0 ? ((h.wins||0)+(h.ties||0)*0.5)/gp : 0.5;
        sumWinPct += wp*w; sumW += w;
      });
      recentWeightedWinPct = sumW>0 ? sumWinPct/sumW : null;
    }
    const titles = {
      playoffAppearances: hist.filter(h=>h.madePlayoffs).length,
      divisions: hist.filter(h=>h.wonDivision).length,
      conferences: hist.filter(h=>h.wonConference).length,
      championships: hist.filter(h=>h.wonChampionship).length,
    };
    const isMine = teamId===career.teamId;
    const grades = isMine
      ? { oline:career.oline, weapons:career.weapons, defense:career.defense, coaching:career.coaching, gmGrade:career.gmGrade }
      : ((career.leagueTeamGrades && career.leagueTeamGrades[teamId]) || { oline:60, weapons:60, defense:60, coaching:60, gmGrade:60 });
    const overall = isMine ? career.teamStrength : (career.leagueStrength[teamId] ?? Math.round(computeTeamOverall(grades)));
    return {
      teamId, qbs: rows, recentWeightedWinPct, titles, grades, overall,
      schemeId: career.teamScheme ? career.teamScheme[teamId] : null,
      window: teamCompetitiveWindow(teamId, year),
    };
  }
  // Wave 6 required design: "Project role by inserting the player into a copy of the team's depth
  // chart and running the same starter-selection function used by the season simulation. Never
  // calculate FA role with a separate estimate." Reuses SUCCESSION_PROMOTION_GAP -- the EXACT same
  // threshold evaluateSuccession uses to decide a rostered challenger wins the job outright -- so a
  // candidate's projected FA role can never disagree with what would actually happen if that same
  // talent gap showed up as an in-season promotion.
  function projectDepthRoleForCandidate(candidateEffOverall, teamId){
    const qbs = getTeamQuarterbacks(teamId);
    const incumbent = qbs.QB1;
    if(!incumbent) return "starter"; // nobody rostered at all -- immediate starter
    // The home re-sign case: when the candidate IS the player and they're already this team's
    // active (non-backup) starter, getTeamQuarterbacks itself resolves QB1 to the player's own
    // userQuarterbackView() (Wave 2A -- the user's own team is never tracked in teamQbDepth) --
    // "the incumbent" and "the candidate" would otherwise be the same person, always reading a
    // zero gap and wrongly projecting "competition" for a normal re-sign. Re-signing where you're
    // already the guy is definitionally staying the guy.
    if(incumbent.isUser && !career.isBackup && teamId===career.teamId) return "starter";
    const decade = decadeForYear(career.year);
    const incumbentVal = incumbent.isUser ? Math.round(computeEffOverall(career.age, decade)) : rivalEffTalent(incumbent);
    return (candidateEffOverall - incumbentVal >= SUCCESSION_PROMOTION_GAP) ? "starter" : "competition";
  }
  // Wave 6: replaces the old ad hoc gate (Math.abs(needRank-rank)>1, isOldAccomplished age+tier
  // check) with a single pure score built entirely from the two real profiles above -- how
  // replaceable the incumbent actually is, whether an accomplished veteran's résumé actually fits
  // this team's real window (not just "is the grade high"), whether a young/mediocre arm fits a
  // rebuilder's real need, and a real availability-risk dampener. Calibrated via a seeded sweep
  // (see PROGRESS.md) so the resulting offer population isn't degenerate (never-fires or always-fires).
  function scoreFreeAgentFit(playerProfile, teamNeedProfile){
    const incumbentRow = teamNeedProfile.qbs.find(r=>r.slot==="QB1");
    const incumbentVal = (incumbentRow && incumbentRow.present) ? incumbentRow.val : 30;
    const window = teamNeedProfile.window;
    let fit = clamp(100 - incumbentVal, 0, 100);
    if(playerProfile.isAccomplishedVeteran){
      // "Accomplished" must inspect actual achievements (accomplishmentScore), not age plus tier --
      // and even a real résumé only draws real interest from a team actually trying to win now.
      fit += window==="win-now" ? 25 : window==="contender" ? 8 : -45;
    }
    if(playerProfile.isYoungPlayer && (window==="rebuild"||window==="retool")){
      fit += 15; // a rebuilder/retooler without a real answer at QB wants a real look at a young arm
    }
    if(playerProfile.isCurrentlyUnavailable) fit -= 15; // real injury/suspension risk, not flavor-only
    return clamp(Math.round(fit), 0, 100);
  }
  // Balance Wave 4 ("Contracts and roster construction"): the same offer can be signed under three
  // real structures, each with a genuine, opposite-direction consequence on the team's own cap
  // health -- "A max contract reduces roster budget; a discount improves retention" from the
  // original brief. capPressureDelta lands on career.capPressure (see signFreeAgentOffer/
  // generateSeason's own team-drift section), a persistent, slowly-decaying value that nudges
  // O-Line/Weapons specifically (not the other three grades, which have their own separate life
  // cycles) -- a full numeric salary-cap ledger is deliberately not built; this is the legible,
  // bounded version of the same real consequence.
  const CONTRACT_STRUCTURES = {
    market: { id:"market", label:"Sign at Market Value", apyMult:1, yearsDelta:0, capPressureDelta:0,
      sub:"The number on the table, as-is." },
    teamFriendly: { id:"teamFriendly", label:"Take a Team-Friendly Discount", apyMult:0.84, yearsDelta:0, capPressureDelta:14,
      sub:"Less money now, but real payroll room for the front office to build around him." },
    recordSetting: { id:"recordSetting", label:"Push for a Record Contract", apyMult:1.20, yearsDelta:1, capPressureDelta:-14,
      sub:"Top of the market and an extra guaranteed year -- the payroll and luxury-tax bill land on the rest of the roster." },
  };
  function buildFreeAgentOffers(decade, tier, oldTeamId){
    // Wave 5: guarantee every candidate team already has its real, persistent five-grade profile
    // before any offer reads from it -- a defensive, idempotent no-op once resolvePlayoffs has
    // already run this season for these teams, but load-bearing the first time a team is seen (a
    // fresh save, or a just-joined expansion team not yet touched by any other code path this year).
    ensureLeagueTeamGrades(career.year);
    const repMult = clamp(0.82 + (career.reputation/100)*0.34, 0.75, 1.25);
    const leverage = career._leverageBoost ? 1.13 : 1;
    const comeback = career._comebackFromSuspension ? 0.55 : 1;
    career._leverageBoost = false;
    // the home team's GM relationship directly shapes the FIRST number they put on the table —
    // a GM who's had bad blood with him lowballs the re-sign offer; a GM who trusts him doesn't.
    // Only applies to the home/re-sign offer -- every other team's GM is an unknown quantity.
    const gmMult = clamp(0.82 + ((career.gmRelationship ?? 50)/100)*0.34, 0.75, 1.22);
    // Separate from relationship (how much they like YOU): front-office COMPETENCE, applied on top --
    // a skilled front office pays market rate regardless of personal rapport; an incompetent one is
    // erratic even toward a player it likes.
    const homeGmSkillMult = clamp(0.9 + ((career.gmGrade ?? 60)/100)*0.2, 0.85, 1.1);
    const candidates = shuffle(teamsAvailable(career.year).filter(t=>t.id!==oldTeamId));
    const offers = [];
    // Wave 6: one real player profile, built once, reused against every candidate team's own real
    // need profile -- never a separate per-team estimate of "is this player good/young/accomplished."
    const playerProfile = buildPlayerMarketProfile(USER_QB_ID, career.year);
    const FA_FIT_THRESHOLD = 35; // calibrated via seeded sweep -- see PROGRESS.md
    // re-sign option with the old team, unless he was just cut loose for cause (contract voided)
    if(oldTeamId && career.contract.apy>0){
      // Required design: role is projected the same way every other offer's is -- never hardcoded
      // "starter" -- so a backup still fighting for the job (career.isBackup) correctly re-signs
      // into "competition" if they haven't actually caught the incumbent yet.
      const homeRole = projectDepthRoleForCandidate(playerProfile.effOverall, oldTeamId);
      const baseApy = veteranAPY(decade, homeRole==="competition" ? (tier==="minimum"?"minimum":"backup") : (tier==="minimum"?"minimum":tier));
      offers.push({
        teamId: oldTeamId, role: homeRole, isHome: true,
        apy: Math.round(baseApy*repMult*gmMult*homeGmSkillMult*leverage*comeback*(0.95+Math.random()*0.2)),
        years: tier==="elite"?5:tier==="good"?4:tier==="average"?2:1,
        patience: randInt(55,85), pushCount:0, withdrawn:false,
        // the home team is the CURRENT roster, not a preview -- show what he actually already plays behind.
        oline: career.oline, weapons: career.weapons, defense: career.defense, coaching: career.coaching, gmGrade: career.gmGrade,
      });
    }
    for(const t of candidates){
      if(offers.length>=4) break;
      const needProfile = buildTeamQuarterbackNeed(t.id, career.year);
      const incumbentRow = needProfile.qbs.find(r=>r.slot==="QB1");
      if(comeback<1 && incumbentRow && incumbentRow.present && incumbentRow.val>=65) continue; // fresh off a suspension — only a real need calls
      const fit = scoreFreeAgentFit(playerProfile, needProfile);
      if(fit<FA_FIT_THRESHOLD) continue;
      // Required design: project role by running the SAME starter-selection comparison the season
      // simulation itself uses -- never a separate estimate.
      const role = projectDepthRoleForCandidate(playerProfile.effOverall, t.id);
      const tierForApy = role==="competition" ? (tier==="minimum"?"minimum":"backup") : (tier==="minimum"?"minimum":tier);
      const baseApy = veteranAPY(decade, tierForApy);
      // Wave 5: read straight from the team's real, persistent five-grade profile (the exact same
      // numbers the Team page shows) instead of rolling a fresh, independent set here -- what you
      // see in the offer ("chase the bag, but you'd play behind a C-grade line") is exactly what
      // you get if you take it (signFreeAgentOffer copies these same fields onto career.*), AND
      // exactly what you'd have seen opening this same team's page from Standings/FA a moment ago.
      const teamProfileForOffer = needProfile.grades;
      const gmGradeForOffer = teamProfileForOffer.gmGrade;
      // A sharp front office pays close to fair value; a bad one is erratic -- sometimes a lowball,
      // sometimes (comedically) an overpay for a player they'll regret. Independent of repMult/
      // leverage, which are about the PLAYER's own standing, not this team's competence.
      const awayGmMult = clamp(0.85 + (gmGradeForOffer/100)*0.3 + (Math.random()-0.5)*0.1, 0.78, 1.2);
      // One legible line for WHY this team is calling -- makes the fit score above visible to the
      // player instead of just felt through the numbers.
      const window = needProfile.window;
      const reason = role==="starter" && window==="rebuild" ? "Rebuilding, and they don't have a real answer at the position."
        : window==="win-now" ? "In win-now mode — they want a proven bat, not a project."
        : window==="contender" ? "A real contender, and this is exactly where they'd upgrade first."
        : window==="rebuild" ? "Rebuilding, and open to seeing what he's got."
        : "Retooling, and the position is squarely in the mix.";
      offers.push({
        teamId: t.id, role, isHome:false, reason,
        apy: Math.round(baseApy*repMult*leverage*comeback*awayGmMult*(0.88+Math.random()*0.3)),
        years: role==="competition" ? 1 : (tier==="elite"?4:tier==="good"?3:tier==="average"?2:1),
        patience: randInt(35,70) - (role==="competition"?10:0), pushCount:0, withdrawn:false,
        oline: teamProfileForOffer.oline, weapons: teamProfileForOffer.weapons,
        defense: teamProfileForOffer.defense, coaching: teamProfileForOffer.coaching, gmGrade: gmGradeForOffer,
      });
    }
    // one rare agent-driven swing, independent of how negotiating goes
    if(offers.length && Math.random()<0.05){
      const target = pick(offers);
      if(Math.random()<0.5){ target.apy = Math.round(target.apy*(1.25+Math.random()*0.2)); target.agentEvent = "lucky"; }
      else { target.apy = Math.round(target.apy*(0.65+Math.random()*0.15)); target.agentEvent = "bad"; }
    }
    return offers;
  }

  function renderFreeAgencyEvent(){
    const decade = decadeForYear(career.year);
    const effOverall = computeEffOverall(career.age, decade);
    const tier = performanceTier(effOverall);
    const oldTeamId = career.contract.apy>0 ? career.teamId : null;
    const oldTeamName = career.teamId ? teamNameAt(career.teamId, career.year) : null;
    const offers = buildFreeAgentOffers(decade, tier, oldTeamId);
    renderFAOffers(offers, { decade, tier, oldTeamId, oldTeamName });
  }

  function renderFAOffers(offers, meta){
    const content = document.getElementById("careerContent");
    const live = offers.filter(o=>!o.withdrawn);
    const cards = live.map((o,i)=>{
      const teamName = teamNameAt(o.teamId, career.year);
      const roleLabel = o.role==="competition" ? "Compete for the job in spring, no guarantees" : (o.isHome ? "Re-sign as the everyday guy" : "Sign as the everyday guy");
      const agentNote = o.agentEvent==="lucky" ? `<div class="rep-note">His agent found something special here.</div>`
        : o.agentEvent==="bad" ? `<div class="rep-note">This one feels light — the agent may have undersold him.</div>` : "";
      const canNegotiate = o.patience>0 && o.pushCount<3;
      const grade = Math.round(career.leagueStrength[o.teamId] ?? 60);
      const gradeTag = grade>=72 ? "Contender" : grade>=52 ? "Solid" : "Rebuilding";
      return `<div class="fa-offer">
        <div class="fa-offer-head"><b><button type="button" class="rival-link" data-team-id="${o.teamId}" data-fa-role="${svgEscape(roleLabel)}">${teamName}</button></b><span class="fa-role">${roleLabel}</span></div>
        <div class="fa-offer-terms tabular">${fmtMoney(o.apy)}/yr · ${o.years} yr${o.years===1?"":"s"}</div>
        <div class="fa-offer-grade">Team grade <b class="tabular">${grade}</b> <span class="fa-grade-tag">${gradeTag}</span></div>
        <div class="fa-offer-cast">O-Line <b>${castLetterGrade(o.oline)}</b> &nbsp;·&nbsp; Weapons <b>${castLetterGrade(o.weapons)}</b></div>
        ${o.reason ? `<div class="fa-offer-reason">${svgEscape(o.reason)}</div>` : ""}
        ${agentNote}
        <div class="event-choices">
          ${Object.values(CONTRACT_STRUCTURES).map(structure=>`
            <button class="choice-btn fa-accept" data-i="${i}" data-structure="${structure.id}">
              <div class="cb-title">${svgEscape(structure.label)}${structure.id!=="market"?` <span class="tabular" style="opacity:0.7;">(${fmtMoney(Math.round(o.apy*structure.apyMult))}/yr)</span>`:""}</div>
              <div class="cb-sub">${svgEscape(structure.sub)}</div>
            </button>`).join("")}
          ${canNegotiate ? `<button class="choice-btn fa-negotiate" data-i="${i}"><div class="cb-title">Negotiate for more</div><div class="cb-sub">Could work. Could blow up the deal.</div></button>` : `<div class="cb-sub" style="padding:0.2rem 0;">They've said their final number.</div>`}
        </div>
      </div>`;
    }).join("");
    content.innerHTML = eraWrap(decadeForYear(career.year), `
        <div class="ev-eyebrow">Free Agency · ${career.year}</div>
        <h3>${live.length ? "The market has spoken." : "Nobody's calling anymore."}</h3>
        <p>${live.length ? `${live.length} team${live.length===1?" is":"s are"} actually interested — everyone else has other plans at the position.` : `Every offer that existed is off the table now. That's still not the same as being done, though.`}</p>
        <div class="fa-offers">${cards}</div>
        <div class="event-choices" style="margin-top:${live.length?"0.4rem":"1.3rem"};">
          ${live.length===0 ? `<button class="choice-btn" id="faMinimum"><div class="cb-title">Beg for a minimum camp deal</div><div class="cb-sub">Somebody, somewhere, needs an arm.</div></button>` : ""}
          <button class="choice-btn" id="faRetire"><div class="cb-title">Retire</div><div class="cb-sub">Walk away while it's still his choice.</div></button>
        </div>
      `);

    content.querySelectorAll(".fa-accept").forEach(btn=>{
      btn.addEventListener("click", ()=>{
        const o = live[parseInt(btn.dataset.i,10)];
        signFreeAgentOffer(o, meta, btn.dataset.structure);
      });
    });
    content.querySelectorAll(".fa-negotiate").forEach(btn=>{
      btn.addEventListener("click", ()=>{
        const o = live[parseInt(btn.dataset.i,10)];
        negotiateOffer(o);
        renderFAOffers(offers, meta);
      });
    });
    const minBtn = document.getElementById("faMinimum");
    if(minBtn) minBtn.addEventListener("click", ()=>{
      const team = pickTeamByStrength(career.year, career.teamId, 15, 55);
      signFreeAgentOffer({ teamId: team.id, apy: veteranAPY(meta.decade,"minimum"), years:1 }, meta);
    });
    document.getElementById("faRetire").addEventListener("click", ()=>{
      career.exitReason = "retired";
      finishCareer();
    });
  }

  function negotiateOffer(o){
    // pushing the HOME team's GM specifically is easier or harder depending on the standing
    // relationship -- a GM already in his corner is more willing to bend, one with bad blood
    // digs in harder on his number.
    const gmTerm = o.isHome ? ((career.gmRelationship ?? 50)-50)*0.003 : 0;
    const successChance = clamp(0.55 + (career.reputation-50)*0.004 + gmTerm - o.pushCount*0.14, 0.1, 0.85);
    o.pushCount++;
    if(Math.random()<successChance){
      o.apy = Math.round(o.apy*(1.05+Math.random()*0.09));
      o.patience -= randInt(15,28);
    } else {
      o.patience -= randInt(25,45);
      if(o.patience<=0 || Math.random()<0.32) o.withdrawn = true;
    }
  }

  function signFreeAgentOffer(o, meta, structureId){
    const teamName = teamNameAt(o.teamId, career.year);
    const structure = CONTRACT_STRUCTURES[structureId] || CONTRACT_STRUCTURES.market;
    const signedApy = Math.round(o.apy*structure.apyMult);
    const signedYears = Math.max(1, o.years+structure.yearsDelta);
    // Balance Wave 4: capPressure decays toward 0 every season (see generateSeason's team-drift
    // section) and nudges O-Line/Weapons specifically while it's non-zero -- a real, if bounded and
    // legible, stand-in for "this contract structure changes how much room the front office has to
    // build the roster around him," without a full numeric cap ledger.
    career.capPressure = clamp((career.capPressure||0) + structure.capPressureDelta, -40, 40);
    // Wave 6 required design: the offer's own projected role must be exactly what happens once
    // signed -- a "competition" role used to be pure flavor text (no mechanical difference from
    // "starter" at all once signed); now it genuinely means competing for the job, the same
    // isBackup-gated mechanism a drafted rookie behind an entrenched incumbent already uses
    // (resolveBackupSeasonSnaps/resolveBackupCompetition). Set BEFORE reassignRivalsForTeamChange
    // for an away sign -- that function's own early-return reads career.isBackup to decide whether
    // to displace the destination team's existing rival (skipped when only competing, not replacing
    // him outright).
    career.isBackup = (o.role === "competition");
    if(career.isBackup) career._backupSeasonsCount = 0; // a fresh competition, not a stale count carried over from a previous team/stint
    const structureNote = structure.id==="teamFriendly" ? " -- a team-friendly discount, clearing real cap room."
      : structure.id==="recordSetting" ? " -- a record-setting deal that will squeeze the roster around him."
      : "";
    if(o.isHome){
      career.transactions.push(`${career.year}: Re-signed with the ${teamName} (${fmtMoney(signedApy)}/yr)${structureNote}`);
      // NOT a team change -- keep his tenure streak intact so the "first season in a new uniform"
      // narrative line (gated on seasonsWithTeam===1) doesn't fire for a guy who never left.
    } else {
      career.transactions.push(`${career.year}: Signed with the ${teamName} (${fmtMoney(signedApy)}/yr)${structureNote}`);
      reassignRivalsForTeamChange(career.teamId, o.teamId);
      // Wave 5: hand the OLD team back its own real, departing profile (never a fresh re-roll)
      // before overwriting career.* with the new team's grades -- the exact grades the offer card
      // already showed (o.oline etc. now come straight from career.leagueTeamGrades[o.teamId] via
      // buildFreeAgentOffers), so "accepting an offer gives exactly the grades that were previewed".
      if(!career.leagueTeamGrades) career.leagueTeamGrades = {};
      career.leagueTeamGrades[career.teamId] = { oline: career.oline, weapons: career.weapons, defense: career.defense, coaching: career.coaching, gmGrade: career.gmGrade };
      career.teamId = o.teamId;
      career.oline = o.oline; career.weapons = o.weapons;
      career.defense = o.defense; career.coaching = o.coaching; career.gmGrade = o.gmGrade;
      career.teamChemistry = 45;
      recomputeMyTeamStrength();
      career.seasonsWithTeam = 0;
    }
    const tier = o.role==="competition" ? "backup" : (meta.tier==="minimum"?"minimum":meta.tier);
    career.contract = { apy: signedApy, years: signedYears, tier };
    recordLedgerEvent("contract_signed", { teamId:o.teamId, choiceId: structure.id, outcomeId: o.isHome?"re-signed":"signed", metadata:{apy:signedApy, years:signedYears} });
    // Wave 1: a signing is exactly the kind of material, hard-to-redo decision the spec calls out
    // by name -- checkpoint it immediately, before whatever comes next (an injury check, then the
    // season itself) has a chance to get interrupted.
    saveActiveCareer({ phase:"decision", eventId:"fa_signed" });
    checkInjuryThenPlay();
  }

  /* ----- injuries: typed, era-sensitive, and durability-driven. Different injuries carry
     different baseline severity and hit different parts of the game (a shoulder injury saps arm
     talent, a concussion saps processing, a knee saps mobility). Medical care is worse in earlier
     decades (reusing the same era injury multiplier the league-wide injury RATE already uses),
     so the exact same injury is more dangerous the further back you play it. Playing through one
     is a real gamble — durability drives how likely it is to get worse — but shutting it down
     isn't risk-free either, just a different one. Most injuries fully heal; a lingering effect is
     usually temporary (a season or two of reduced play, modeled the same way a mentorship or
     scheme-fit boost is, just negative), a small permanent dent is rare, and a season- or
     career-ending outcome is rare-er still and scales down the harder DUR fights it — so a
     bad break doesn't have to be a bad career (a Brees-style full recovery is the common case,
     not the exception). ----- */
  // Wave 3: neutral (not narrative-scripted) reasons for an AI QB's rare suspension roll -- see
  // simulatePlayerSeasonStats's availability comment for why these stay generic rather than reusing
  // the player's own scripted infraction system.
  const AI_SUSPENSION_REASONS = [
    "PED Policy Violation", "Violation of MLB's Joint Domestic Violence Policy",
    "Conduct Detrimental to the Club", "Gambling Policy Violation (Rule 21)",
  ];
  // IL stints. `keys` are the hitter tools a lingering version of the injury nicks; `sev` scales
  // both days missed and the rare permanent-decline roll.
  const INJURY_TYPES = [
    { id:"hamstring",  name:"Hamstring Strain",        weight:22, sev:0.24, keys:["MOB","IMP"] },
    { id:"oblique",    name:"Oblique Strain",          weight:17, sev:0.30, keys:["REL","DAC","TCH"] },
    { id:"wrist",      name:"Wrist Sprain",            weight:12, sev:0.26, keys:["SHA","TCH"] },
    { id:"hbpfrac",    name:"Hit-by-Pitch Fracture",   weight:9,  sev:0.34, keys:["SHA","DAC"] },
    { id:"shoulder",   name:"Shoulder Inflammation",   weight:9,  sev:0.42, keys:["ARM","DAC"] },
    { id:"back",       name:"Back Spasms",             weight:9,  sev:0.34, keys:["PKT","SHA","DAC"] },
    { id:"meniscus",   name:"Meniscus Tear",           weight:7,  sev:0.48, keys:["MOB","IMP","PKT"] },
    { id:"thumb",      name:"Torn Thumb Ligament",     weight:6,  sev:0.28, keys:["TCH","SHA"] },
    { id:"concussion", name:"Concussion",              weight:5,  sev:0.34, keys:["DEC","ANT"] },
    { id:"acl",        name:"Torn ACL",                weight:3,  sev:0.82, keys:["MOB","IMP","PKT"] },
    { id:"achilles",   name:"Torn Achilles",           weight:2,  sev:0.85, keys:["MOB","IMP"] },
  ];
  function rollInjuryType(){
    const total = INJURY_TYPES.reduce((s,t)=>s+t.weight,0);
    let r = Math.random()*total;
    for(const t of INJURY_TYPES){ if(r<t.weight) return t; r -= t.weight; }
    return INJURY_TYPES[0];
  }

  function checkInjuryThenPlay(){
    const decade = decadeForYear(career.year);
    const league = LEAGUE[decade];
    const developmentPlan = prepareDevelopmentPlanForSeason();
    const dur = eraEffective(career.age, decade).DUR;
    const injMult = (ERA_ATTR_MULT[decade]||{}).injury || 1;
    // A bad O-line means more hits taken, not just more sacks -- durability is still the dominant
    // term (this is a real but secondary risk factor, the "play behind a bad line" downside).
    const olineRisk = 1 - (safeNum(career.oline,60)-65)*0.003;
    const injuryChance = clamp((0.26 - (dur-60)*0.006) * injMult * olineRisk * developmentPlan.injuryRisk, 0.035, 0.65);
    if(!career._injuryResolved && Math.random()<injuryChance){
      // the week is rolled once, here, and threaded through to resolveInjuryChoice so the
      // "games missed" total it reports can never exceed how many games are actually left on
      // the schedule after that week -- previously the week shown in the event text and the
      // eventual missed-games count were two fully independent random rolls, so a "Week 12"
      // injury could claim "10 games missed" in a 17-game season with only ~5 left to miss.
      const week = randInt(3, Math.max(3, Math.min(13, league.games-1)));
      renderInjuryEvent(rollInjuryType(), dur, injMult, decade, week);
      return;
    }
    career._injuryResolved = false;
    playSeasonAndRender();
  }

  function playSeasonAndRender(){
    const season = generateSeason();
    renderSeasonCard(season, true);
    saveActiveCareer();
  }

  function renderInjuryEvent(type, dur, injMult, decade, week){
    const content = document.getElementById("careerContent");
    const sevFlavor = type.sev>=0.7 ? "a serious injury — the kind that can end a season" : type.sev>=0.42 ? "a real injury, not a tweak" : "a nagging but manageable injury";
    const wear = career.wearAndTear||0;
    const wearWarning = wear>=45
      ? ` His body's already worn (${Math.round(wear)}/100) — gutting out another one now is a real risk of permanent decline, not just a rough month.`
      : "";
    content.innerHTML = eraWrap(decade, `
        <div class="ev-eyebrow">${career.year} Season · Game ${week}</div>
        <h3>${type.name}.</h3>
        <p>The training staff calls it ${sevFlavor}. Play through it and chase the season, or hit the IL and protect the long game.${wearWarning}</p>
        <div class="event-choices">
          <button class="choice-btn" id="injPlay"><div class="cb-title">Gut it out</div><div class="cb-sub">Stay in the lineup — but pushing through it adds real wear and tear, on top of a chance of making it worse right now.</div></button>
          <button class="choice-btn" id="injSit"><div class="cb-title">Shut it down</div><div class="cb-sub">Miss real time on the IL this year, come back closer to full strength — and barely adds to his long-term wear.</div></button>
        </div>
      `, {tone:"bad"});
    document.getElementById("injPlay").addEventListener("click", ()=> resolveInjuryChoice(type, dur, injMult, decade, true, week));
    document.getElementById("injSit").addEventListener("click", ()=> resolveInjuryChoice(type, dur, injMult, decade, false, week));
  }

  function resolveInjuryChoice(type, dur, injMult, decade, played, week){
    const content = document.getElementById("careerContent");
    const league = LEAGUE[decade];
    if(!week) week = 1; // defensive default (max games-remaining headroom) if ever called without one
    // lower durability makes every bad outcome more likely — worsening, lingering, and the rare
    // catastrophic ones alike.
    const durFactor = clamp((70-dur)/70, -0.3, 1);
    let missedGames, perfPenalty = 0, lingering=false, permanentHit=0, worsened=false;

    if(played){
      missedGames = randInt(0, Math.max(1, Math.round(2 + type.sev*3)));
      perfPenalty = randInt(8,18) + Math.round(type.sev*10);
      const worsenChance = clamp((0.16 + type.sev*0.22 + durFactor*0.18) * injMult, 0.05, 0.65);
      if(Math.random()<worsenChance){
        worsened = true;
        missedGames += randInt(3, Math.round(4+type.sev*10));
        perfPenalty += randInt(5,15);
      }
    } else {
      missedGames = randInt(Math.round(2+type.sev*4), Math.round(4+type.sev*10));
      perfPenalty = Math.round(type.sev*3);
    }
    // ----- Wear and tear: the real, cumulative version of "playing through it has a cost."
    // Gutting it out adds a real chunk to a persistent career-long meter; shutting it down adds
    // almost nothing (rest protects the body). generateSeason() adds a small age/durability-scaled
    // baseline on top every season and lets the meter recover on a clean, injury-free one -- see
    // that function for the threshold check that can turn a high meter into a genuine, permanent
    // physical decline. This is deliberately separate from (and much more common than) the rare
    // structural permanentHit below, which represents one freak injury, not accumulated damage.
    const wearAdd = played
      ? randInt(10,18) + Math.round(type.sev*16) + (worsened ? randInt(4,10) : 0)
      : randInt(0,2) + Math.round(type.sev*3);
    career.wearAndTear = clamp((career.wearAndTear||0) + wearAdd, 0, 100);
    career._hadInjuryThisSeason = true;
    // cap in-season missed games at what's actually left on the schedule after the week the
    // injury happened -- a "Week 12" injury in a 17-game season can miss at most 6 games this
    // year (weeks 12-17), never the 10-14 the raw severity roll above might otherwise produce.
    // seasonEnding is judged against that same remaining-games figure, not a flat league-wide
    // constant, so a genuinely season-ending injury is recognized as such whenever it happens,
    // not only when it happens to land on/after week ~16.
    const gamesRemaining = Math.max(1, league.games - week + 1);
    missedGames = clamp(missedGames, 0, Math.min(league.games, gamesRemaining));
    const seasonEnding = missedGames >= gamesRemaining;
    lingering = Math.random() < clamp((played ? 0.22+type.sev*0.35 : 0.10+type.sev*0.20) * (worsened?1.3:1), 0.04, 0.75);

    // rare, durability-modulated catastrophic branch: a season-ender occasionally becomes a
    // multi-season absence, or — rarest of all — a career-ender. Gutting it out and getting
    // worse raises these odds; shutting it down early lowers them.
    let multiSeasonLeave = 0, careerEnding = false;
    if(seasonEnding){
      const catastropheBase = type.sev>=0.7 ? 0.05 : type.sev>=0.42 ? 0.015 : 0.004;
      const catastropheChance = clamp(catastropheBase*injMult*(worsened?1.6:1)*(1+Math.max(0,durFactor)), 0, 0.22);
      if(Math.random()<catastropheChance){
        if(Math.random()<0.12) careerEnding = true; else multiSeasonLeave = randInt(1,2);
      }
    }
    if(!careerEnding && !multiSeasonLeave && Math.random() < clamp(0.025*injMult*type.sev, 0, 0.10)){
      permanentHit = randInt(1,4); // small, rare, permanent — not the norm
    }

    career.reputation = clamp(career.reputation + (worsened?-2:0), 0, 100);

    if(careerEnding){
      career.transactions.push(`${career.year}: ${type.name} ends his career.`);
      // Same idea as _bannedEventTitle above -- name the actual injury in the retrospective
      // instead of narrating a forced medical retirement as a career he chose to walk away from.
      career._careerEndingInjuryName = type.name;
      content.innerHTML = eraWrap(decade, `
        <div class="ev-eyebrow">${career.year} · Medical</div>
        <h3>Career-ending injury.</h3>
        <p>The ${type.name.toLowerCase()} is worse than anyone let on. The team's doctors, and then a second opinion, agree: this is the end of the line.</p>
        <div class="event-choices"><button class="choice-btn" id="injCareerAck"><div class="cb-title">See the career recap</div></button></div>
      `, {tone:"bad"});
      document.getElementById("injCareerAck").addEventListener("click", ()=>{ career.exitReason="injury"; career.forcedOut=true; finishCareer(); });
      return;
    }
    if(multiSeasonLeave){
      career.injuryLeaveSeasonsRemaining = multiSeasonLeave;
      const teamName = teamNameAt(career.teamId, career.year);
      career.transactions.push(`${career.year}: ${type.name} — out ${multiSeasonLeave} season(s) on injured reserve with the ${teamName}.`);
      content.innerHTML = eraWrap(decade, `
        <div class="ev-eyebrow">${career.year} · Medical</div>
        <h3>${multiSeasonLeave}-season injury absence.</h3>
        <p>The ${type.name.toLowerCase()} needs real time — multiple surgeries, a long rehab. The ${teamName} are keeping him on the books, but he won't play again for a while.</p>
        <div class="event-choices"><button class="choice-btn" id="injLeaveAck"><div class="cb-title">Continue</div></button></div>
      `, {tone:"bad"});
      document.getElementById("injLeaveAck").addEventListener("click", nextSeason);
      return;
    }
    if(lingering && !permanentHit){
      const seasons = randInt(1,2);
      career.tempBoosts = career.tempBoosts || [];
      type.keys.forEach(k=> career.tempBoosts.push({ key:k, delta: -randInt(4,9), seasonsLeft: seasons }));
    }
    if(permanentHit){
      type.keys.forEach(k=>{ build[k] = clamp(build[k]-permanentHit, 15, 99); });
    }
    career._injuryMissedGames = missedGames;
    career._injuryPenalty = perfPenalty;
    career._injuryResolved = true;
    const noteBits = [];
    if(worsened) noteBits.push("It got worse than it needed to.");
    if(lingering && !permanentHit) noteBits.push("Expect it to nag at him for a while yet.");
    if(permanentHit) noteBits.push("It never fully heals — a small, permanent mark on his game.");
    career.transactions.push(`${career.year}: ${type.name}${missedGames>0?` (${missedGames} games missed)`:""}.`);
    if(noteBits.length){
      content.innerHTML = eraWrap(decade, `
        <div class="ev-eyebrow">${career.year} · Medical</div>
        <h3>${type.name}${missedGames>0?` — ${missedGames} game${missedGames===1?"":"s"} missed`:""}</h3>
        <p>${noteBits.join(" ")}</p>
        <div class="event-choices"><button class="choice-btn" id="injContinueAck"><div class="cb-title">Continue</div></button></div>
      `, {tone:"bad"});
      document.getElementById("injContinueAck").addEventListener("click", playSeasonAndRender);
      return;
    }
    playSeasonAndRender();
  }

  /* ----- Season dashboard: one tabbed hub (Season / Standings / League / Trends / Scheme / Log)
     instead of a modal-plus-scroll. Season is the default tab; the others build lazily into the
     same #careerContent so switching tabs never re-simulates anything. ----- */
  function switchDashTab(name){
    const content = document.getElementById("careerContent");
    content.querySelectorAll(".dash-tab").forEach(b=> b.classList.toggle("active", b.dataset.tab===name));
    content.querySelectorAll(".dash-tabpanel").forEach(p=> p.classList.toggle("active", p.id==="tabpanel-"+name));
  }

  // Game-by-game regular season log: the player's real weekly schedule (division rivals home-and-
  // home, the rest of the league filling out the slate -- see buildSeasonSchedule), each game
  // resolved against that WEEK's actual opponent team grade (see simulateRegularSeasonGames),
  // with a per-game stat line so the season totals aren't just one deterministic formula anymore.
  // Resolves a game-log qbId to whichever entity actually played that game -- a current starter
  // (career.leagueRivals) or a bench QB2/QB3 (career.leagueDepthCharts) -- for any OTHER team's
  // game on the week board. Never needs to resolve the player's own id (they're always themselves).
  function resolveScheduleQb(qbId){
    if(!qbId) return null;
    const rival = findRivalById(qbId);
    if(rival) return { id: rival.id, name: rival.name };
    const bench = findDepthChartPlayerById(qbId);
    if(bench) return { id: bench.id, name: bench.name };
    return null;
  }
  // Every real matchup for one week across the WHOLE league -- real NFL schedule pages browse by
  // week (see every game that week), not by team. As of the Round 27 schedule unification, the
  // player is just another entry in career.currentSeasonSchedules (built from the exact same
  // shared schedule as everyone else -- see buildSeasonSchedule/generateSeason), so there is no
  // longer a second, independently-simulated source to reconcile here: a team's own id is the only
  // thing gating whether its card renders, and a missing entry for a given week just means that
  // team drew a real bye, never a silently-dropped or double-booked game (see the Round 25/26
  // history on this function for the two real bugs the old two-source version had).
  function buildWeekMatchups(season, week){
    const teamIds = divisionsForYear(season.year).flatMap(d=>d.teams);
    const seen = new Set();
    const matchups = [];
    teamIds.forEach(id=>{
      if(seen.has(id)) return;
      const log = career.currentSeasonSchedules && career.currentSeasonSchedules[id];
      const g = log && log.find(x=>x.week===week);
      if(!g) return; // real bye week for this team
      seen.add(id); seen.add(g.opponentId);
      // Each team's own currentSeasonSchedules entry only carries ITS OWN qbId (attached later by
      // simulateRivalSeasons/simulateDepthChartSeasons) -- there's no separate opponentQbId field
      // on this shape, so the opponent's QB link is resolved by looking up ITS OWN matching entry
      // for the same week instead (guaranteed to exist now that both sides share one schedule).
      const oppLog = career.currentSeasonSchedules && career.currentSeasonSchedules[g.opponentId];
      const oppEntry = oppLog && oppLog.find(x=>x.week===week);
      const mine = id===season.teamId, oppMine = g.opponentId===season.teamId;
      // Ties QOL: g.won is null for a tie -- aWon/bWon are both explicitly false in that case (not
      // "!aWon", which would incorrectly read a tie's null as "the other side won").
      // Wave 2B: g.qbId is always resolved now, on EITHER side, rather than hardcoded null for
      // "mine" -- normally career.teamId's own entries have no qbId (nobody but the player played,
      // nothing to show), but a week the incumbent started while the player was a backup DOES carry
      // one (see simulateRegularSeasonGames/buildScheduleResults), and that's exactly the case
      // "exact-week schedule cards identify the QB who actually played" needs surfaced here.
      matchups.push({ aId: id, aScore: g.myScore, aWon: g.won===true, bWon: g.won===false, tie: !!g.tie, aQb: resolveScheduleQb(g.qbId),
        bId: g.opponentId, bScore: g.oppScore, bQb: resolveScheduleQb(oppEntry && oppEntry.qbId) });
    });
    return matchups;
  }
  // Round 32 item 2: converts a buildWeekMatchups() entry into the SAME {aId,bId,aScore,bScore,
  // winnerId,realRound} shape the Playoff Tree's box-score modal already expects, so every game
  // card in the app -- playoff or regular season -- opens through the exact one modal
  // (openBracketBoxScore/buildBracketBoxScoreModalHTML), never a second, separate mechanism.
  // career.currentSeasonSchedules never carries a real per-game stat line for anyone (only
  // week/opponent/score, see buildScheduleResults) -- the player's own real comp/att/yards/td/int
  // for this exact week lives on season.gameLog instead, looked up by week (not by opponent id,
  // since a division rival can appear twice in one season).
  function scheduleMatchToBracketMatch(m, week, season){
    const winnerId = m.aWon ? m.aId : (m.bWon ? m.bId : null);
    let realRound = null;
    if(m.aId===career.teamId || m.bId===career.teamId){
      const myWeekEntry = (season.gameLog||[]).find(g=>g.week===week);
      if(myWeekEntry){
        realRound = { box: { comp: myWeekEntry.comp, att: myWeekEntry.att, yards: myWeekEntry.yards, td: myWeekEntry.td, int: myWeekEntry.int } };
        // Wave 2B: a week the named incumbent started (career.isBackup) carries his qbId/qbName --
        // the box-score modal's "mine" QB line must show HIM, not silently assume the player played.
        if(myWeekEntry.qbId){ realRound.qbId = myWeekEntry.qbId; realRound.qbName = myWeekEntry.qbName; }
      }
    }
    return { aId: m.aId, bId: m.bId, aScore: m.aScore, bScore: m.bScore, winnerId, realRound };
  }
  function weekMatchupTeamLineHTML(teamId, score, won, qb, year){
    const mine = teamId===career.teamId;
    const name = svgEscape(teamNameAt(teamId, year)) + (mine ? " (you)" : "");
    const qbHtml = qb ? `<div class="week-matchup-qb">QB <button type="button" class="rival-link" data-rival-id="${qb.id}">${svgEscape(qb.name)}</button></div>` : "";
    return `<div class="week-matchup-team${won?" good":""}${mine?" me":""}">
        <span class="week-matchup-name">${won?"<b>":""}${name}${won?"</b>":""}</span>
        <span class="tabular week-matchup-score">${score}</span>
      </div>${qbHtml}`;
  }
  // Schedule tab week picker -- mirrors the Trends-tab stat-picker pattern (trendsStatKey/
  // renderTrendsSparkline): a module-level selection var, a <select> rebuilt on every render with
  // the current selection marked, wired via the same delegated #careerContent listener the League
  // tab's subtab/sort controls already use (see the `change` branch added there).
  let scheduleTabWeek = 1;
  let scheduleTabSeason = null;
  function renderScheduleTabInner(){
    const season = scheduleTabSeason;
    // The calendar now runs longer than the game count once bye weeks exist (see
    // weeksForSeason/buildSeasonSchedule) -- career.currentSeasonWeeksN is the real week count for
    // THIS season, set alongside currentSeasonSchedules in simulateLeagueStandings. Falls back to
    // the old games-only count only if it's somehow missing (e.g. a schedule tab render before any
    // season has actually been simulated yet).
    const weeksN = career.currentSeasonWeeksN || LEAGUE[season.decade].games;
    const options = Array.from({length: weeksN}, (_,i)=>i+1)
      .map(w=>`<option value="${w}"${w===scheduleTabWeek?" selected":""}>Week ${w}</option>`).join("");
    const matchups = buildWeekMatchups(season, scheduleTabWeek);
    const cards = matchups.map(m=>`<div class="week-matchup-card clickable" data-schedule-week="${scheduleTabWeek}" data-schedule-a="${m.aId}" data-schedule-b="${m.bId}">
        ${weekMatchupTeamLineHTML(m.aId, m.aScore, m.aWon, m.aQb, season.year)}
        ${weekMatchupTeamLineHTML(m.bId, m.bScore, m.bWon, m.bQb, season.year)}
      </div>`).join("");
    const body = matchups.length ? `<div class="week-matchup-grid">${cards}</div>`
      : `<div class="calc-refnote">No games recorded for this week.</div>`;
    return `<div class="schedule-week-picker"><label>Week <select id="scheduleWeekSelect" class="spk-select">${options}</select></label></div>${body}`;
  }
  function buildScheduleTabHTML(season){
    scheduleTabSeason = season;
    scheduleTabWeek = 1;
    return `<div id="scheduleTabRoot">${renderScheduleTabInner()}</div>`;
  }

  // Round 32 follow-up: click-to-team-page kept, but styled to look like plain text again (not an
  // underlined hyperlink) -- a <button> still, for the click handler, just visually inert via
  // .team-name-plain. Also adds three single-letter flags (C/D/P) and a made-the-playoffs vs.
  // missed-entirely color distinction, per direct user feedback on the previous version's look.
  function teamNameLinkHtml(id, year, extraLabel){
    return `<button type="button" class="team-name-plain" data-team-id="${id}">${svgEscape(teamNameAt(id, year))}</button>${extraLabel||""}`;
  }
  function buildStandingsTabHTML(season){
    const ls = season.leagueStandings;
    if(!ls) return `<p style="color:var(--ink-muted);">Standings aren't available for this season.</p>`;
    // Same values driving buildScheduleResults/simpleWinProb -- surfaced here so a lopsided-looking
    // record has a visible cause instead of reading as arbitrary.
    const teamOverall = id => Math.round(id===career.teamId ? career.teamStrength : (career.leagueStrength[id] ?? 60));
    const playoffIds = new Set([...(ls.seeded.AFC||[]), ...(ls.seeded.NFC||[])].map(t=>t.id));
    const divWinnerIds = new Set();
    (ls.divisions || divisionsForYear(season.year)).forEach(d=>{
      const ranked = d.teams.map(id=>ls.results[id]).sort((a,b)=>compareTeamsForStandings(a,b,season.year,"division"));
      if(ranked[0]) divWinnerIds.add(ranked[0].id);
    });
    // Conference champion only exists once the bracket for that conference is actually confirmed --
    // this tab is refreshed in place (see confirmPlayoffRound/simulateNextPlayoffTreeRound/
    // finalizeRound) at the same points the Playoff Tree already is, so the "C" flag appears live
    // the moment that conference's real champion becomes known, not just at initial render.
    const bd = ls.bracket;
    const confChampIds = new Set([bd && bd.myChampionId, bd && bd.otherChampionId].filter(Boolean));
    function flagsFor(id){
      let s = "";
      if(confChampIds.has(id)) s += `<span class="team-flag flag-conf" title="Conference Champion">C</span>`;
      if(divWinnerIds.has(id)) s += `<span class="team-flag flag-div" title="Division Winner">D</span>`;
      if(playoffIds.has(id)) s += `<span class="team-flag flag-playoff" title="Made the Playoffs">P</span>`;
      return s;
    }
    function statusClass(id){ return playoffIds.has(id) ? "team-in-playoffs" : "team-eliminated"; }
    function seedList(conf){
      return `<ol class="seed-list">` + ls.seeded[conf].map(t=>{
        const mine = t.id===career.teamId;
        return `<li class="${mine?"me":""} ${statusClass(t.id)}">${teamNameLinkHtml(t.id, season.year)}${flagsFor(t.id)} <span class="team-ovr">${teamOverall(t.id)} OVR</span><span class="tabular">${recordLine(t.wins, t.losses, t.ties||0)}</span></li>`;
      }).join("") + `</ol>`;
    }
    function divTables(conf){
      return (ls.divisions || divisionsForYear(season.year)).filter(d=>d.conf===conf).map(d=>{
        const rows = d.teams.map(id=>ls.results[id]).sort((a,b)=>compareTeamsForStandings(a,b,season.year,"division")).map(r=>{
          const mine = r.id===career.teamId;
          return `<tr class="${mine?"me":""} ${statusClass(r.id)}"><td class="team-cell">${teamNameLinkHtml(r.id, season.year)}${mine?" (you)":""}${flagsFor(r.id)} <span class="team-ovr">${teamOverall(r.id)} OVR</span></td><td>${recordLine(r.wins, r.losses, r.ties||0)}</td></tr>`;
        }).join("");
        return `<div class="standings-div"><div class="standings-div-name">${confLabel(conf, season.year)} ${d.name}</div><table class="standings-table"><tbody>${rows}</tbody></table></div>`;
      }).join("");
    }
    return `<div class="standings-columns">
        <div><h4>${confLabel("AFC", season.year)} Playoff Seeds</h4>${seedList("AFC")}${divTables("AFC")}</div>
        <div><h4>${confLabel("NFC", season.year)} Playoff Seeds</h4>${seedList("NFC")}${divTables("NFC")}</div>
      </div>
      <div class="calc-refnote" style="margin-top:0.6rem;"><span class="team-flag flag-conf">C</span> Conference Champion &nbsp;·&nbsp; <span class="team-flag flag-div">D</span> Division Winner &nbsp;·&nbsp; <span class="team-flag flag-playoff">P</span> Made the Playoffs</div>`;
  }

  // Maps ONE of the player's own real playoff rounds (season.playoffs.rounds[i]) into the SAME
  // {aSeed,aId,aScore,bSeed,bId,bScore,winnerId} matchup shape a flat match already has, so it can
  // be recorded into bracket.myRounds via confirmAndRecordRound -- one shared node shape everywhere,
  // regardless of source. Reads the round object live, so a Key Moment swing applied after this is
  // called still shows up correctly (nothing here is called until the round is actually final).
  function nodeMatchFromRealRound(r){
    return { aSeed: r.mySeed ?? null, aId: career.teamId, aScore: r.myScore,
      bSeed: r.oppSeed ?? null, bId: r.oppId ?? null, bScore: r.oppScore,
      winnerId: r.won ? career.teamId : (r.oppId ?? null), realRound: r };
  }
  // Round 32: normalizes ONE conference's Playoff Tree display data straight off the lockstep
  // bracket record (season.leagueStandings.bracket) -- myRounds/otherRounds already ARE the one,
  // single, causally-correct history (siblings included), confirmed one round at a time exactly
  // when that round's real result (or a manual "Simulate Next Round" click) becomes final. There is
  // no more splicing a real result into an independently-rolled cache, and no more reveal-counter --
  // a round is either fully confirmed (in the history array) or hasn't happened yet at all.
  function playoffTreeConfDisplay(conf, season){
    const bd = season.leagueStandings.bracket;
    const isMine = conf===bd.myConf;
    const state = isMine ? bd.myState : bd.otherState;
    const rounds = isMine ? bd.myRounds : bd.otherRounds;
    const championId = isMine ? bd.myChampionId : bd.otherChampionId;
    const labels = canonicalRoundLabels(state.N, state.wcGames, state.byes);
    const counts = expectedMatchupCounts(state.N, state.wcGames, state.byes);
    const revealedCount = rounds.length;
    const championKnown = championId!=null;
    return { rounds, labels, counts, state, championKnown, championId, revealedCount, totalRounds: labels.length };
  }
  // Unified bracket-tree renderer for BOTH the player's real conference and any flat-resolved one
  // -- one column per round, connector bezier curves from a winning seed's box to its slot in the
  // next round, gold-bordered "mine" state, grayscale-eliminated losers, a BYE badge, and a
  // clickable node (opens the box-score modal) once a matchup is decided.
  // `mirrored` flips WHICH SIDE each round renders on (round 0 near the outer edge, the final
  // round near the center) without changing the chronological processing order -- this is what
  // lets the "other" conference converge toward a center Super Bowl from the opposite direction of
  // Short, fixed-width column headers -- "Conference Championship" at full length is wide enough to
  // overflow a single grid column. roundDisplayLabel (used elsewhere -- box score modal titles,
  // etc.) is untouched; this is purely a bracket-header shortening.
  function shortRoundLabel(label){
    if(label==="Conference Championship") return "CONF. CHAMPIONSHIP";
    return String(label).toUpperCase();
  }
  // Round 29 rewrite: replaces the SVG-based renderer (renderPlayoffTreeSVG -> renderFullPlayoffTreeSVG)
  // entirely with a real CSS Grid of HTML cards -- a rigid column-per-round structure (AFC always
  // flowing left-to-right, NFC always flowing right-to-left, Super Bowl the exact center column),
  // each column vertically distributing its own cards via flexbox instead of hand-computed SVG
  // pixel coordinates. This is a deliberately simpler, more robust technique than the seed-midpoint
  // SVG layout it replaces: no connector LINES are drawn at all (matching the reference bracket
  // graphic this was modeled on) -- convergence reads purely from column order + flexbox spacing,
  // which can never clip, never needs an overlap-repair pass, and never depends on exact pixel
  // measurement surviving a horizontal scroll/era-theme font change the way the SVG version did.
  //
  // One card per matchup, built by bracketCardHtml -- state is one of:
  //   "revealed"        -- real, decided result (score, winner/loser styling, clickable for a box score)
  //   "pending-known"   -- the NEXT round to reveal: participants are already determined (the round
  //                        feeding it is already revealed), scores just haven't been "shown" yet --
  //                        real bracket information availability, not an arbitrary tease.
  //   "pending-unknown" -- any round further out: real NFL logic doesn't know Divisional matchups
  //                        until Wild Card weekend is over either, so this shows a generic TBD slot,
  //                        never real team identity.
  function bracketCardHtml(match, state, conf, roundIdx, matchIdx, myTeamId){
    if(state==="pending-unknown" || !match){
      return `<div class="pcard pcard-pending">
          <div class="pcard-row"><span class="pcard-seed"></span><span class="pcard-name">TBD</span><span class="pcard-score tabular">-</span></div>
          <div class="pcard-row"><span class="pcard-seed"></span><span class="pcard-name">TBD</span><span class="pcard-score tabular">-</span></div>
          <div class="pcard-badge">SIM PENDING</div>
        </div>`;
    }
    const isBye = match.bId==null;
    const isPending = state==="pending-known";
    const decided = state==="revealed" && !isBye && match.winnerId!=null;
    const aWon = decided && match.winnerId===match.aId, bWon = decided && match.winnerId===match.bId;
    const aMine = match.aId===myTeamId, bMine = match.bId===myTeamId;
    let clickAttr = "";
    if(decided) clickAttr = conf==="SB" ? ` data-bracket-sb="1"` : ` data-bracket-conf="${conf}" data-bracket-round-idx="${roundIdx}" data-bracket-match-idx="${matchIdx}"`;
    function rowHtml(id, seed, score, won, mine){
      const name = id!=null ? svgEscape(id) : "TBD";
      const scoreTxt = isPending ? "-" : (score!=null ? score : "-");
      return `<div class="pcard-row${won?" won":""}${decided&&!won?" lost":""}${mine?" mine":""}">
          <span class="pcard-seed">${seed!=null?"#"+seed:""}</span>
          <span class="pcard-name">${name}</span>
          <span class="pcard-score tabular">${scoreTxt}</span>
        </div>`;
    }
    const bRow = isBye
      ? `<div class="pcard-row bye"><span class="pcard-seed"></span><span class="pcard-name">BYE</span><span class="pcard-score"></span></div>`
      : rowHtml(match.bId, match.bSeed, match.bScore, bWon, bMine);
    return `<div class="pcard${decided?" clickable":""}${aMine||bMine?" mine":""}"${clickAttr}>
        ${rowHtml(match.aId, match.aSeed, match.aScore, aWon, aMine)}
        ${bRow}
        ${isPending?`<div class="pcard-badge">SIM PENDING</div>`:""}
      </div>`;
  }
  // One grid column for one round of one conference. roundIdx indexes into the canonical label
  // sequence (display.labels, stable and known upfront regardless of resolution progress) -- a
  // round is "revealed" once it's actually been confirmed and recorded (roundIdx<revealedCount),
  // else "pending-unknown" (Round 32: there is no more "pending-known" state -- under the lockstep
  // model a round's sibling games are never rolled-but-hidden from the DISPLAY side; they simply
  // haven't happened yet until the round they're gated on is confirmed).
  function bracketColumnHtml(display, roundIdx, conf, myTeamId){
    let matchups = null, cardState = "pending-unknown";
    if(roundIdx<display.revealedCount){
      matchups = display.rounds[roundIdx].matchups;
      cardState = "revealed";
    } else if(roundIdx===display.revealedCount){
      // The very next round to happen -- always fully previewable (see previewNextRoundMatchups),
      // real identities on both sides, score still "-" until it's actually simulated.
      const preview = previewNextRoundMatchups(display.state);
      matchups = preview ? preview.matchups : null;
      cardState = "pending-known";
    } else if(roundIdx===1 && display.state.field===null){
      // Nothing has been stepped at all yet, but a bye team's OWN slot in Divisional is knowable
      // from seeding alone -- show it now, opponent "TBD" (see previewByeAheadMatchups).
      const byeMatchups = previewByeAheadMatchups(display.state);
      if(byeMatchups){ matchups = byeMatchups; cardState = "pending-known"; }
    }
    const expectedCount = display.counts[roundIdx] || 1;
    const cardsHtml = matchups
      ? matchups.map((m,matchIdx)=>bracketCardHtml(m, cardState, conf, roundIdx, matchIdx, myTeamId)).join("")
      : Array.from({length: expectedCount}, (_,matchIdx)=>bracketCardHtml(null, "pending-unknown", conf, roundIdx, matchIdx, myTeamId)).join("");
    const label = display.labels[roundIdx];
    return `<div class="bracket-col"><div class="bracket-col-label">${label?svgEscape(shortRoundLabel(label)):""}</div><div class="bracket-col-cards">${cardsHtml}</div></div>`;
  }
  function bracketSuperBowlColumnHtml(afcDisplay, nfcDisplay, pb, myTeamId){
    const afcChampId = afcDisplay.championKnown ? afcDisplay.championId : null;
    const nfcChampId = nfcDisplay.championKnown ? nfcDisplay.championId : null;
    let match, state;
    if(pb && afcChampId && nfcChampId){
      const [wScore,lScore] = String(pb.superBowlScore).split("-").map(Number);
      const afcWon = pb.superBowlWinnerId===afcChampId;
      match = { aId: afcChampId, bId: nfcChampId, aScore: afcWon?wScore:lScore, bScore: afcWon?lScore:wScore,
        winnerId: pb.superBowlWinnerId, aSeed:null, bSeed:null };
      state = "revealed";
    } else if(afcChampId || nfcChampId){
      match = { aId: afcChampId||"TBD", bId: nfcChampId||"TBD", aScore:null, bScore:null, winnerId:null, aSeed:null, bSeed:null };
      state = "pending-known";
    } else {
      match = null; state = "pending-unknown";
    }
    const cardHtml = bracketCardHtml(match, state, "SB", 0, 0, myTeamId);
    return `<div class="bracket-col bracket-col-sb"><div class="bracket-col-label">🏆 SUPER BOWL</div><div class="bracket-col-cards">${cardHtml}</div></div>`;
  }
  // The whole bracket: AFC's own columns (Wild Card at the far left, running toward the center),
  // one Super Bowl column dead center, then NFC's columns MIRRORED (its Conference Championship
  // sits immediately right of the Super Bowl column, its Wild Card at the far right edge) -- a
  // rigid, always-AFC-left/always-NFC-right structure regardless of which conference the player is
  // actually in (their own team just gets the gold "mine" ring wherever it lands). Column COUNT is
  // fully dynamic per era -- an early-1970s season with only a Conference Championship round
  // renders a 3-column grid (AFC title / Super Bowl / NFC title); a modern 7-seed season renders
  // the full Wild Card-through-Super Bowl spread -- both from the exact same function, since each
  // side's own fullRounds.length already reflects that season's real format.
  function renderPlayoffBracketGrid(afcDisplay, nfcDisplay, pb, myTeamId){
    if(!afcDisplay.totalRounds && !nfcDisplay.totalRounds) return "";
    const afcCols = afcDisplay.labels.map((_,i)=>bracketColumnHtml(afcDisplay, i, "AFC", myTeamId));
    const nfcCols = nfcDisplay.labels.map((_,i)=>bracketColumnHtml(nfcDisplay, i, "NFC", myTeamId)).reverse();
    const sbCol = bracketSuperBowlColumnHtml(afcDisplay, nfcDisplay, pb, myTeamId);
    const totalCols = afcDisplay.totalRounds + 1 + nfcDisplay.totalRounds;
    // Genuinely wide once every round is on-screen at once -- render at a real, legible minimum
    // column width and let the wrapper scroll horizontally rather than shrinking text to fit a
    // narrow card (same "scroll, don't shrink" call as the rest of this tab).
    return `<div class="bracket-grid-wrap"><div class="bracket-grid" style="grid-template-columns: repeat(${totalCols}, minmax(148px, 1fr)); min-width: ${totalCols*164}px;">
        ${afcCols.join("")}${sbCol}${nfcCols.join("")}
      </div></div>`;
  }
  // A plausible single-game stat line for a QB whose SEASON aggregate is all we actually track --
  // flat-resolved playoff games (nobody real involved) never got a per-game simulation, only a
  // final score. Distributes that QB's real per-game AVERAGE with natural variance rather than
  // fabricating something disconnected from his real season.
  function estimateSingleGameStatLine(qb){
    const t = qb && qb.totals;
    if(!t || !t.games) return null;
    const jitter = ()=> 0.75+Math.random()*0.5;
    const att = Math.max(1, Math.round((t.att/t.games)*jitter()));
    const compPct = t.att>0 ? t.comp/t.att : 0, ypa = t.att>0 ? t.yards/t.att : 0;
    const tdRate = t.att>0 ? t.td/t.att : 0, intRate = t.att>0 ? t.int/t.att : 0;
    const comp = Math.min(att, Math.round(att*compPct));
    const yards = Math.round(att*ypa*jitter());
    const td = Math.max(0, Math.round(att*tdRate*jitter()));
    const interceptions = Math.max(0, Math.round(att*intRate*jitter()));
    return { comp, att, yards, td, int: interceptions, rating: passerRating(comp, att, yards, td, interceptions) };
  }
  function buildBracketBoxScoreModalHTML(match, year, roundLabel){
    const aName = svgEscape(teamNameAt(match.aId, year)), bName = svgEscape(teamNameAt(match.bId, year));
    const [q1a,q2a,q3a,q4a] = distributeAcrossGames(match.aScore, 4);
    const [q1b,q2b,q3b,q4b] = distributeAcrossGames(match.bScore, 4);
    function qbLineHTML(teamId, isMine){
      if(isMine){
        // A real playoff game already has a real box score generated for the player's own side
        // (generateGameBoxScore, called when the round itself was created) -- use it directly
        // rather than a placeholder; a flat-side "mine" is impossible (the player is never a
        // participant in a flat-resolved matchup), so this branch only ever fires for real rounds.
        // Wave 2B: a REGULAR-SEASON week the named incumbent started (career.isBackup) instead
        // carries realRound.qbId/qbName (see scheduleMatchToBracketMatch) -- playoffs never route
        // through the backup mechanic at all, so this can only ever be non-null for a schedule-tab
        // match, never a real playoff round.
        const box = match.realRound && match.realRound.box;
        const line = box ? `${box.comp}/${box.att}, ${box.yards} yds, ${box.td} TD, ${box.int} INT` : "";
        const startedByOther = match.realRound && match.realRound.qbId;
        const label = startedByOther ? svgEscape(match.realRound.qbName || "a fill-in") : svgEscape(career.name);
        return `<div class="bracket-qb-line"><b>${label}</b>${line ? ` — ${line}` : ""}</div>`;
      }
      const qb = rivalForTeam(teamId);
      const line = qb ? estimateSingleGameStatLine(qb) : null;
      return `<div class="bracket-qb-line">${qb ? `<button type="button" class="rival-link" data-rival-id="${qb.id}">${svgEscape(qb.name)}</button>` : "—"}${line ? ` — ${line.comp}/${line.att}, ${line.yards} yds, ${line.td} TD, ${line.int} INT, ${line.rating.toFixed(1)} rtg` : ""}</div>`;
    }
    const margin = Math.abs(match.aScore-match.bScore);
    const recap = match.winnerId==null ? "Nobody blinked — this one ended in a tie."
      : margin<=3 ? "A nail-biter decided in the final minutes." : margin>=21 ? "Never really in doubt after the first half." : "A hard-fought, back-and-forth game.";
    return `<div class="modal-box">
        <div class="modal-head"><h3 id="bracketBoxScoreHeading">${svgEscape(roundDisplayLabel(roundLabel, year))}</h3><button type="button" class="modal-close">Close</button></div>
        <div class="table-wrap"><table class="standings-table"><thead><tr><th></th><th class="tabular">Q1</th><th class="tabular">Q2</th><th class="tabular">Q3</th><th class="tabular">Q4</th><th class="tabular">F</th></tr></thead>
          <tbody>
            <tr class="${match.winnerId===match.aId?"me":""}"><td>${aName}</td><td class="tabular">${q1a}</td><td class="tabular">${q2a}</td><td class="tabular">${q3a}</td><td class="tabular">${q4a}</td><td class="tabular"><b>${match.aScore}</b></td></tr>
            <tr class="${match.winnerId===match.bId?"me":""}"><td>${bName}</td><td class="tabular">${q1b}</td><td class="tabular">${q2b}</td><td class="tabular">${q3b}</td><td class="tabular">${q4b}</td><td class="tabular"><b>${match.bScore}</b></td></tr>
          </tbody></table></div>
        ${qbLineHTML(match.aId, match.aId===career.teamId)}
        ${qbLineHTML(match.bId, match.bId===career.teamId)}
        <div class="calc-refnote" style="margin-top:0.6rem;">${recap}</div>
      </div>`;
  }
  function openBracketBoxScore(match, year, roundLabel){
    const overlay = document.getElementById("bracketBoxScoreOverlay");
    if(!overlay || !match.bId) return;
    overlay.innerHTML = buildBracketBoxScoreModalHTML(match, year, roundLabel);
    const closeBtn = overlay.querySelector(".modal-close");
    if(closeBtn) closeBtn.addEventListener("click", closeBracketBoxScore);
    // This overlay is a DOM SIBLING of #careerContent, not a descendant of it -- the shared
    // #careerContent delegated click listener never sees a click on the QB-name [data-rival-id]
    // links qbLineHTML renders inside this modal (the exact same class of bug already fixed for
    // #rivalProfileOverlay/#teamProfileOverlay's own internal links), so they need the same
    // explicit wiring here.
    overlay.querySelectorAll("[data-rival-id]").forEach(link=>{
      link.addEventListener("click", ()=>{ closeBracketBoxScore(); openRivalProfile(link.dataset.rivalId); });
    });
    if(!overlay._backdropWired){
      overlay._backdropWired = true;
      overlay.addEventListener("click", (e)=>{ if(e.target===overlay) closeBracketBoxScore(); });
    }
    openDialog(overlay, { labelledBy: "bracketBoxScoreHeading", initialFocus: closeBtn });
  }
  function closeBracketBoxScore(){
    const overlay = document.getElementById("bracketBoxScoreOverlay");
    if(!overlay) return;
    closeDialog(overlay);
    overlay.innerHTML = "";
  }
  // Playoff Tree, Round 32: lives inside the Season tab now (not its own dash-tab -- see the
  // season-card template), reading straight off the one shared lockstep bracket record
  // (season.leagueStandings.bracket) so it can never contradict the player's own real path anymore.
  // "Simulate Next Round" only ever advances a conference that has NOTHING real left gating it --
  // the other conference while the player is still mid-run is paced automatically, in lockstep,
  // by the player's own reveal (see confirmPlayoffRound/advanceToNextPlayoffRound).
  let playoffTreeSeason = null;
  function buildPlayoffTreeTabHTML(season){
    const ls = season.leagueStandings;
    if(!ls || !ls.bracket) return `<div class="calc-refnote">Standings aren't available for this season.</div>`;
    playoffTreeSeason = season;
    const bd = ls.bracket;
    const pb = ls.playoffBracket;
    const year = season.year;
    const myDisplay = playoffTreeConfDisplay(bd.myConf, season);
    const otherDisplay = playoffTreeConfDisplay(bd.otherConf, season);
    // AFC is ALWAYS the left wing, NFC ALWAYS the right wing, regardless of which one the player is
    // actually in -- a fixed, real-broadcast-style convention, not a "my side first" mirroring rule.
    // The player's own team just gets the gold "mine" ring wherever it lands.
    const afcDisplay = bd.myConf==="AFC" ? myDisplay : otherDisplay;
    const nfcDisplay = bd.myConf==="NFC" ? myDisplay : otherDisplay;

    const myDone = !season.playoffs || !season.playoffs.made || season.playoffs.done;
    const needsRoundSimulate = myDone && (bd.myChampionId==null || bd.otherChampionId==null);
    let actionHtml = "";
    if(needsRoundSimulate){
      actionHtml = `<button type="button" class="btn btn-ghost" id="playoffTreeSimulateBtn" data-bracket-simulate="round">Simulate Next Round <span style="opacity:0.6;">(Space)</span></button>`;
    } else if(!pb){
      actionHtml = `<div class="calc-refnote">Waiting on your own playoff run to finish (see the Season tab) before the Super Bowl can be decided.</div>`;
    }

    const bracketHtml = renderPlayoffBracketGrid(afcDisplay, nfcDisplay, pb, career.teamId)
      || `<div class="calc-refnote">Not simulated yet — use Simulate Next Round below.</div>`;
    const confLabelsHtml = `<div class="bracket-conf-labels"><span>◄ ${confLabel("AFC", year)}${bd.myConf==="AFC"?" (your conference)":""}</span><span>${confLabel("NFC", year)}${bd.myConf==="NFC"?" (your conference)":""} ►</span></div>`;
    const champLines = [
      afcDisplay.championKnown && afcDisplay.championId ? `${confLabel("AFC",year)} Champion: <b>${svgEscape(teamNameAt(afcDisplay.championId, year))}</b>` : "",
      nfcDisplay.championKnown && nfcDisplay.championId ? `${confLabel("NFC",year)} Champion: <b>${svgEscape(teamNameAt(nfcDisplay.championId, year))}</b>` : "",
    ].filter(Boolean);
    const champHtml = champLines.length ? `<div class="calc-refnote" style="margin-top:0.6rem;">${champLines.join(" &nbsp;·&nbsp; ")}</div>` : "";

    let sbHtml = "";
    if(pb){
      const sbWinnerName = svgEscape(teamNameAt(pb.superBowlWinnerId, year)), sbLoserName = svgEscape(teamNameAt(pb.superBowlLoserId, year));
      sbHtml = `<div class="calc-refnote" style="margin-top:0.4rem;">${svgEscape(superBowlDisplayName(year))}: ${sbWinnerName} def. ${sbLoserName}, <span class="tabular">${pb.superBowlScore}</span>${pb.superBowlWinnerId===career.teamId ? " — your Super Bowl!" : ""}</div>`;
    }

    const innerHtml = `<div class="playoff-tree-inner">
        <h4 style="margin-top:0;">Playoff Tree</h4>
        ${actionHtml ? `<div class="playoff-tree-actions">${actionHtml}</div>` : ""}
        ${confLabelsHtml}
        ${bracketHtml}
        ${champHtml}
        ${sbHtml}
      </div>`;
    // Reuses the SAME era-themed chrome (eraWrap/eraChrome) already established for event cards.
    return eraWrap(season.decade, innerHtml);
  }

  // League-wide QB comparison: every other starting QB in the league (see generateLeagueRivals /
  // simulateRivalSeasons), ranked alongside the player for the season just played, judged by the
  // exact same award rules -- the "checkbalance for awards" this was built for -- plus a running
  // comparison against three draft-classmate rivals as the seed for a future head-to-head mechanic.
  // Shared by buildLeagueTabHTML and buildAwardCeremonyHTML so both work off the exact same
  // per-QB season rows (the player plus every rival with a season logged this year), sorted by
  // passer rating -- one source of truth for "who did what this season," not two formulas that
  // could quietly drift apart.
  // League tab click-to-sort: generalizes the existing Trophy Room comparator-map pattern
  // (TROPHY_ROOM_SORTERS) to clickable column headers instead of external toggle buttons. Two
  // independent sort states since the active and inactive tables have different columns.
  let leagueActiveSortKey = "rating", leagueActiveSortDir = -1;
  let leagueInactiveSortKey = "overall", leagueInactiveSortDir = -1;
  let leagueTabSeason = null;
  const LEAGUE_ACTIVE_SORTERS = {
    name: (a,b)=> a.name.localeCompare(b.name),
    age: (a,b)=> a.age-b.age,
    games: (a,b)=> a.games-b.games,
    pct: (a,b)=> a.pct-b.pct,
    att: (a,b)=> a.att-b.att,
    yards: (a,b)=> a.yards-b.yards,
    td: (a,b)=> a.td-b.td,
    int: (a,b)=> a.int-b.int,
    rating: (a,b)=> a.rating-b.rating,
  };
  const LEAGUE_INACTIVE_SORTERS = {
    name: (a,b)=> a.name.localeCompare(b.name),
    age: (a,b)=> a.age-b.age,
    overall: (a,b)=> a.overall-b.overall,
  };
  function sortIndicator(key, activeKey, dir){
    if(key!==activeKey) return "";
    return ` <span class="sort-arrow">${dir===-1?"▼":"▲"}</span>`;
  }
  function computeSeasonAwardRows(season){
    const year = season.year;
    const rows = [{
      name: career.name, teamId: career.teamId, age: season.age, mine:true, games: season.games,
      att: season.att, pct: season.pct, yards: season.yards, td: season.td, int: season.int,
      rating: season.rating, rbi: season.rbi, hits: season.hits, sb: season.sb, awards: season.awards,
    }];
    (career.leagueRivals||[]).forEach(r=>{
      const s = r.seasons.find(x=>x.year===year);
      if(!s) return;
      // Belt-and-suspenders: generateLeagueRivals()/spawnNewFranchiseRivals prevent a rival from
      // being CREATED for a team before it exists, and self-heal an already-corrupted save on its
      // next season advance -- but neither of those retroactively rewrites a season entry a
      // corrupted save already recorded before the fix existed. This is the actual display
      // boundary: a team whose t.start is still after this exact season's year never appears on
      // the leaderboard, full stop, regardless of what's sitting in saved data or whether a
      // self-heal has run yet.
      const t = TEAMS.find(x=>x.id===r.teamId);
      if(t && t.start>year) return;
      rows.push({ name:r.name, teamId:r.teamId, age:s.age, mine:false, games:s.games, att:s.att, pct:s.pct,
        yards:s.yards, td:s.td, int:s.int, rating:s.rating, rbi:s.rbi, hits:s.hits, sb:s.sb, awards:s.awards, isRival:r.isRival, id:r.id });
    });
    // A bench player who actually started games this season (games>0 -- simulatePlayerSeasonStats
    // rolls a missed-games chance for everyone, so most seasons ARE 0-game no-ops here) is now
    // visible on the leaderboard too, just like a real backup who got spot starts would show up in
    // real stats. Their `awards` are computed but deliberately never GRANTED (resolveSeasonMVP/
    // resolveSeasonAllProAndProBowl only ever read career.leagueRivals, untouched by this) -- this
    // only adds visibility, it doesn't let a bench player actually win an award.
    Object.keys(career.leagueDepthCharts||{}).forEach(teamId=>{
      const t = TEAMS.find(x=>x.id===teamId);
      if(t && t.start>year) return;
      const chart = career.leagueDepthCharts[teamId];
      ["qb2","qb3"].forEach(slot=>{
        const p = chart[slot];
        if(!p) return;
        const s = p.seasons.find(x=>x.year===year);
        if(!s || !(s.games>0)) return;
        rows.push({ name:p.name, teamId:p.teamId, age:s.age, mine:false, games:s.games, att:s.att, pct:s.pct,
          yards:s.yards, td:s.td, int:s.int, rating:s.rating, rbi:s.rbi, hits:s.hits, sb:s.sb, awards:s.awards, isBench:true, id:p.id });
      });
    });
    rows.sort((a,b)=> b.rating-a.rating);
    return rows;
  }
  // Wave 2A: registry-backed now, so a bench player who's since been traded/promoted/replaced/
  // retired remains resolvable by id -- previously this only ever found someone CURRENTLY sitting
  // in a live chart slot, so an old schedule/game-log reference to a departed bench player resolved
  // to nothing at all the moment his slot was reassigned.
  function findDepthChartPlayerById(id){
    return getQuarterbackById(id);
  }
  // The counterpart to computeSeasonAwardRows: everyone who did NOT actually play a game this
  // season -- bench players with no season entry for `year` (didn't get relief duty, see Part C of
  // the bench-realism fix) plus every career.freeAgentPool entry (no team at all). One combined
  // list per design, each row tagged so it's still clear at a glance who's where.
  function computeInactiveQbRows(year){
    const rows = [];
    Object.keys(career.leagueDepthCharts||{}).forEach(teamId=>{
      const t = TEAMS.find(x=>x.id===teamId);
      if(t && t.start>year) return;
      const chart = career.leagueDepthCharts[teamId];
      ["qb2","qb3"].forEach(slot=>{
        const p = chart[slot];
        if(!p || p.retired) return;
        const playedThisYear = p.seasons.some(s=>s.year===year);
        if(playedThisYear) return; // already shown on the active tab
        rows.push({ name:p.name, id:p.id, age:p.age, overall:rivalEffTalent(p),
          tag:`Bench — ${teamNameAt(teamId, year)}` });
      });
    });
    (career.freeAgentPool||[]).forEach(p=>{
      rows.push({ name:p.name, id:p.id, age:p.age, overall:rivalEffTalent(p),
        tag:`Free Agent — ${p.joblessSeasons||0} season${(p.joblessSeasons||0)===1?"":"s"} unsigned` });
    });
    rows.sort((a,b)=> b.overall-a.overall);
    return rows;
  }

  // ----- End-of-season Award Ceremony: names the year's MVP, All-Pros, and Pro Bowlers. All three
  // are decided exactly once, league-wide -- MVP by resolveSeasonMVP (the single most
  // statistically impressive season wins outright, with a real tie producing genuine co-MVPs),
  // and Pro Bowl/All-Pro by resolveSeasonAllProAndProBowl (top scorers per conference for the Pro
  // Bowl roster, exactly one First Team and one Second Team All-Pro league-wide) -- never several
  // QBs independently "winning" the same honor off their own coin flip.
  function buildAwardCeremonyHTML(season){
    const year = season.year;
    const rows = computeSeasonAwardRows(season);
    const mvpCandidates = rows.filter(r=>r.awards.includes("MVP")); // already rating-sorted
    const allStars = rows.filter(r=>r.awards.includes("All-Star"));
    const silverSluggers = rows.filter(r=>r.awards.includes("Silver Slugger"));
    const allMlbSecond = rows.filter(r=>r.awards.includes("All-MLB Second Team"));
    const roy = rows.filter(r=>r.awards.includes("Rookie of the Year"));

    const statLine = r => `${r.td} HR · ${r.rbi!=null?r.rbi+" RBI · ":""}${(r.pct||0).toFixed(3).replace(/^0/,"")} AVG · ${Math.round(r.rating)} OPS+`;
    const rowLine = r => `${svgEscape(r.name)}${r.mine?" (you)":""} — ${svgEscape(teamNameAt(r.teamId, year))} — ${statLine(r)}`;

    const mvpHtml = mvpCandidates.length ? `
      <div class="award-hero">
        <div class="award-hero-label">${year} Most Valuable Player${mvpCandidates.length>1?"s (Co-MVP)":""}</div>
        ${mvpCandidates.map(mvpRow => `
          <div class="award-hero-name">${svgEscape(mvpRow.name)}${mvpRow.mine?" (you)":""}</div>
          <div class="award-hero-sub">${svgEscape(teamNameAt(mvpRow.teamId, year))}</div>
          <div class="award-hero-stat">${statLine(mvpRow)}</div>
        `).join(mvpCandidates.length>1 ? '<div style="height:0.6rem;"></div>' : "")}
      </div>` : `
      <div class="award-hero muted">
        <div class="award-hero-label">${year} Most Valuable Player</div>
        <div class="award-hero-name">No consensus winner</div>
        <div class="award-hero-sub">A wide-open field this year — nobody separated from the pack enough to run away with it.</div>
        ${rows[0] ? `<div class="award-hero-stat">Closest to it: ${svgEscape(rows[0].name)}${rows[0].mine?" (you)":""} — ${statLine(rows[0])}</div>` : ""}
      </div>`;

    const listSection = (title, list) => list.length ? `
      <div class="award-list-section">
        <h4>${title} <span class="award-count">${list.length}</span></h4>
        <ul class="award-list">${list.map(r=>`<li class="${r.mine?"me":""}">${rowLine(r)}</li>`).join("")}</ul>
      </div>` : `
      <div class="award-list-section empty">
        <h4>${title}</h4>
        <p>Nobody made the cut league-wide this year.</p>
      </div>`;

    return `<div class="award-ceremony">
        ${mvpHtml}
        ${roy.length ? listSection("Rookie of the Year", roy) : ""}
        ${listSection("Silver Slugger", silverSluggers)}
        ${listSection("All-MLB Second Team", allMlbSecond)}
        ${listSection("All-Star", allStars)}
      </div>`;
  }

  function buildLeagueActiveRowsHtml(season){
    const rows = computeSeasonAwardRows(season);
    const sorter = LEAGUE_ACTIVE_SORTERS[leagueActiveSortKey] || LEAGUE_ACTIVE_SORTERS.rating;
    rows.sort((a,b)=> sorter(a,b)*leagueActiveSortDir);
    return rows.map((r,i)=> `<tr class="${r.mine?"me":""}">
        <td class="tabular">${i+1}</td>
        <td>${r.mine ? svgEscape(r.name)+" (you)" : `<button type="button" class="rival-link" data-rival-id="${r.id}">${svgEscape(r.name)}</button>${r.isRival?" ★":""}`} <span style="color:var(--ink-muted);">— ${svgEscape(teamNameAt(r.teamId, season.year))}</span></td>
        <td class="tabular">${r.age}</td>
        <td class="tabular">${r.games}</td>
        <td class="tabular">${(r.pct*100).toFixed(1)}%</td>
        <td class="tabular">${r.att}</td>
        <td class="tabular">${r.yards.toLocaleString()}</td>
        <td class="tabular">${r.td}</td>
        <td class="tabular">${r.int}</td>
        <td class="tabular"><b>${r.rating.toFixed(1)}</b></td>
        <td>${r.awards.map(a=>`<span class="badge ${a==="MVP"?"gold":"good"}" style="margin-right:0.25rem;">${a}</span>`).join("")}</td>
      </tr>`).join("");
  }
  function buildLeagueInactiveRowsHtml(year){
    const rows = computeInactiveQbRows(year);
    const sorter = LEAGUE_INACTIVE_SORTERS[leagueInactiveSortKey] || LEAGUE_INACTIVE_SORTERS.overall;
    rows.sort((a,b)=> sorter(a,b)*leagueInactiveSortDir);
    return rows.map(r=>`<tr>
        <td><button type="button" class="rival-link" data-rival-id="${r.id}">${svgEscape(r.name)}</button></td>
        <td class="tabular">${r.age}</td>
        <td class="tabular">${r.overall}</td>
        <td>${svgEscape(r.tag)}</td>
      </tr>`).join("");
  }
  // Re-renders just the two League-tab tbodies in place (called after a header-click re-sort), so
  // the active/inactive sub-tab toggle state and everything else on the season card is undisturbed.
  function reRenderLeagueTables(){
    if(!leagueTabSeason) return;
    const container = document.getElementById("careerContent");
    if(!container) return;
    const activeBody = container.querySelector('[data-league-panel="active"] table.league-table tbody');
    if(activeBody) activeBody.innerHTML = buildLeagueActiveRowsHtml(leagueTabSeason);
    const inactiveBody = container.querySelector('[data-league-panel="inactive"] table.league-table tbody');
    if(inactiveBody) inactiveBody.innerHTML = buildLeagueInactiveRowsHtml(leagueTabSeason.year);
    container.querySelectorAll('[data-league-sort]').forEach(th=>{
      const key = th.dataset.leagueSort, table = th.dataset.leagueSortTable;
      const activeKey = table==="active" ? leagueActiveSortKey : leagueInactiveSortKey;
      const dir = table==="active" ? leagueActiveSortDir : leagueInactiveSortDir;
      const label = th.dataset.leagueSortLabel || th.textContent.replace(/\s*[▲▼]\s*$/, "").trim();
      th.innerHTML = label + sortIndicator(key, activeKey, dir);
    });
  }
  // Round 32 item 5: the All-Time leaderboard population -- every QB who's actually played a real
  // game in THIS league's simulated history: the player themselves plus career.leagueRivals
  // (current, retired, free-agent, AND bench -- Wave 2A: this now walks the canonical qbsById
  // registry instead of only career.leagueRivals, which used to explicitly exclude
  // career.leagueDepthCharts even when a bench QB had actually played real relief games -- a
  // confirmed defect, since the product intent is literally "every quarterback who plays at least
  // one real game remains visible... in the All-Time table"). Filtered to totals.games>0 so a
  // rookie successor who was just generated (0 games) doesn't clutter the list with a zero-stat
  // row. Ranked by the exact same greatness score computeHofScore already uses for the player's own
  // Hall of Fame verdict -- one real, already-tuned formula, not a second invented-from-scratch
  // ranking metric. This needs no explicit "update every season" mechanism at all: qbsById/
  // career.totals already mutate every season on their own, so simply recomputing this at render
  // time is always current.
  function buildAllTimeLeaderboardRows(){
    const entries = [
      { id:USER_QB_ID, name:career.name, teamId:career.teamId, isMine:true, totals:career.totals, seasons:career.seasonLog, retired:false, age:career.age, exitReason:null },
    ];
    Object.values(career.qbsById||{}).forEach(r=>{
      entries.push({ id:r.id, name:r.name, teamId:r.teamId, isMine:false, totals:r.totals, seasons:r.seasons, retired:!!r.retired, age:r.age, exitReason:r.exitReason||null });
    });
    return entries.filter(e=>e.totals.games>0).map(e=>{
      const verdict = computeHofScore(e.totals, e.seasons, e.exitReason);
      const rating = passerRating(e.totals.comp, e.totals.att, e.totals.yards, e.totals.td, e.totals.int);
      const hofPct = hofChancePct(e.totals, e.seasons, e.exitReason, e.age, e.retired);
      return { ...e, score: verdict.score, hofTier: verdict.tier, rating, hofPct };
    }).sort((a,b)=> b.score-a.score);
  }
  // Rank-based exclusivity tiers, deliberately a SEPARATE axis from hofTier (which judges accolades
  // against real Hall of Fame bars, independent of population size) -- these are purely "how many
  // people in THIS league's history have ever been better," which is what makes the GOAT slot,
  // specifically, always exactly one QB, ever, no matter how large the league's history grows.
  function allTimeRankTier(rank){
    if(rank===1) return "GOAT";
    if(rank<=5) return "Legend";
    if(rank<=15) return "Icon";
    if(rank<=30) return "All-Time Great";
    return null;
  }
  function buildAllTimeLeaderboardHTML(){
    const rows = buildAllTimeLeaderboardRows();
    const bodyHtml = rows.map((r,i)=>{
      const rank = i+1;
      const tierName = allTimeRankTier(rank);
      const tierBadge = tierName ? ` <span class="badge gold">${svgEscape(tierName)}</span>` : "";
      const nameCell = r.isMine
        ? `${svgEscape(r.name)} (you)`
        : `<button type="button" class="rival-link" data-rival-id="${r.id}">${svgEscape(r.name)}</button>`;
      return `<tr class="${r.isMine?"me":""}">
          <td class="tabular">${rank}</td>
          <td>${nameCell}${r.retired?` <span style="color:var(--ink-muted);">(retired)</span>`:""}${tierBadge}</td>
          <td><button type="button" class="rival-link" data-team-id="${r.teamId}">${svgEscape(teamNameAt(r.teamId, career.year))}</button></td>
          <td class="tabular">${r.totals.yards.toLocaleString()}</td>
          <td class="tabular">${r.totals.td}</td>
          <td class="tabular">${r.totals.int}</td>
          <td class="tabular">${r.rating.toFixed(1)}</td>
          <td class="tabular">${recordLine(r.totals.wins, r.totals.losses, r.totals.ties||0)}</td>
          <td class="tabular">${r.totals.proBowls}</td>
          <td class="tabular">${r.totals.allPros}</td>
          <td class="tabular">${r.totals.mvps}</td>
          <td class="tabular">${r.totals.rings||0}</td>
          <td class="tabular">${r.hofPct}%</td>
        </tr>`;
    }).join("");
    return `<div class="calc-refnote">Every QB who's actually played a real game in this league's history, ranked by a single greatness score — the exact same one behind your own Hall of Fame verdict. Updates automatically as the league plays out. Tiers get more exclusive going up: the GOAT is #1, alone. Hall of Famer % is an estimate for anyone still active — it's their résumé's HOF case if their career ended today, nudged up a little for a young player with real accolades already and real seasons still ahead of him.</div>
      <div class="table-wrap">
        <table class="league-table">
          <thead><tr><th>#</th><th>QB</th><th>Team</th><th>Yds</th><th>TD</th><th>INT</th><th>Rating</th><th>Record</th><th>PB</th><th>AP</th><th>MVP</th><th>Rings</th><th>HOF%</th></tr></thead>
          <tbody>${bodyHtml}</tbody>
        </table>
      </div>`;
  }
  function buildLeagueTabHTML(season){
    const year = season.year;
    leagueTabSeason = season;
    const rows = computeSeasonAwardRows(season);
    const myRank = rows.findIndex(r=>r.mine)+1;
    const proBowlCount = rows.filter(r=>r.awards.includes("Pro Bowl")).length;
    const allProCount = rows.filter(r=>r.awards.some(a=>a.endsWith("All-Pro"))).length;
    const mvpCount = rows.filter(r=>r.awards.includes("MVP")).length;

    const rowsHtml = buildLeagueActiveRowsHtml(season);

    const classmates = (career.leagueRivals||[]).filter(r=>r.isRival);
    const myCareerRating = passerRating(career.totals.comp, career.totals.att, career.totals.yards, career.totals.td, career.totals.int);
    const classmateRows = classmates.map(r=>{
      const rRating = passerRating(r.totals.comp, r.totals.att, r.totals.yards, r.totals.td, r.totals.int);
      return `<tr><td>${svgEscape(r.name)}${r.retired?" <span style=\"color:var(--ink-muted);\">(retired)</span>":""}</td><td>${svgEscape(teamNameAt(r.teamId, year))}</td>
        <td class="tabular">${r.totals.yards.toLocaleString()}</td><td class="tabular">${r.totals.td}</td>
        <td class="tabular">${rRating.toFixed(1)}</td>
        <td class="tabular">${r.totals.proBowls}</td><td class="tabular">${r.totals.allPros}</td><td class="tabular">${r.totals.mvps}</td><td class="tabular">${r.totals.rings||0}</td></tr>`;
    }).join("");
    const classHtml = classmates.length ? `
      <div class="league-classmates">
        <h4>Your Draft Class</h4>
        <div class="table-wrap">
          <table class="standings-table">
            <thead><tr><th>Name</th><th>Team</th><th>Career Yds</th><th>Career TD</th><th>Rating</th><th>PB</th><th>AP</th><th>MVP</th><th>Rings</th></tr></thead>
            <tbody>
              <tr class="me"><td>${svgEscape(career.name)} (you)</td><td>${svgEscape(teamNameAt(career.teamId, year))}</td>
                <td class="tabular">${career.totals.yards.toLocaleString()}</td><td class="tabular">${career.totals.td}</td>
                <td class="tabular">${myCareerRating.toFixed(1)}</td>
                <td class="tabular">${career.totals.proBowls}</td><td class="tabular">${career.totals.allPros}</td><td class="tabular">${career.totals.mvps}</td><td class="tabular">${career.totals.rings}</td></tr>
              ${classmateRows}
            </tbody>
          </table>
        </div>
        <div class="calc-refnote">Three QBs from your own draft class — same rookie year, same age curve, tracked stat-for-stat alongside you all career long. The foundation for a future head-to-head rivals mechanic — for now, a running comparison.</div>
      </div>` : "";

    // Everyone who did NOT actually play a real game this season -- benched all year, or on nobody's
    // roster at all -- lives on a separate sub-tab instead of cluttering the main leaderboard, which
    // is now genuinely "QBs who took real snaps this year" (see Part C of the bench-realism fix).
    const inactiveRows = computeInactiveQbRows(year);
    const inactiveRowsHtml = buildLeagueInactiveRowsHtml(year);
    // Click-to-sort headers: data-league-sort-label preserves the plain column label so
    // reRenderLeagueTables can rebuild "label + arrow" without re-parsing prior arrow HTML.
    function activeTh(key, label, extraClass){
      return `<th class="${extraClass||""}" data-league-sort="${key}" data-league-sort-table="active" data-league-sort-label="${label}">${label}${sortIndicator(key, leagueActiveSortKey, leagueActiveSortDir)}</th>`;
    }
    function inactiveTh(key, label, extraClass){
      return `<th class="${extraClass||""}" data-league-sort="${key}" data-league-sort-table="inactive" data-league-sort-label="${label}">${label}${sortIndicator(key, leagueInactiveSortKey, leagueInactiveSortDir)}</th>`;
    }

    return `<div class="league-tab">
        <div class="mode-toggle league-subtabs">
          <button type="button" class="league-subtab-btn active" data-league-subtab="active">Played This Season</button>
          <button type="button" class="league-subtab-btn" data-league-subtab="inactive">Inactive / Free Agents (${inactiveRows.length})</button>
          <button type="button" class="league-subtab-btn" data-league-subtab="alltime">All-Time</button>
        </div>
        <div class="league-subtab-panel active" data-league-panel="active">
          <div class="calc-refnote">${year} passing leaderboard — every QB who actually played real games for their team this season, judged by the exact same Pro Bowl / All-Pro / MVP rules as you (see the Stat Calculator tab in Admin &amp; Testing for the formulas). You ranked <b>#${myRank}</b> of ${rows.length} in passer rating. League-wide this season: Pro Bowl ×${proBowlCount}, All-Pro ×${allProCount}, MVP ×${mvpCount}.</div>
          <div class="table-wrap">
            <table class="league-table">
              <thead><tr><th>#</th>${activeTh("name","QB")}${activeTh("age","Age","tabular")}${activeTh("games","GP","tabular")}${activeTh("pct","Comp%","tabular")}${activeTh("att","Att","tabular")}${activeTh("yards","Yds","tabular")}${activeTh("td","TD","tabular")}${activeTh("int","INT","tabular")}${activeTh("rating","Rating","tabular")}<th>Awards</th></tr></thead>
              <tbody>${rowsHtml}</tbody>
            </table>
          </div>
          ${classHtml}
        </div>
        <div class="league-subtab-panel" data-league-panel="inactive">
          <div class="calc-refnote">${inactiveRows.length ? "Bench QBs who didn't get real snaps this season, plus every QB currently unsigned — nobody here has stats to show because none of them actually played." : "Nobody's sitting inactive right now — every bench QB in the league got at least a look this season."}</div>
          ${inactiveRows.length ? `<div class="table-wrap">
            <table class="league-table">
              <thead><tr>${inactiveTh("name","QB")}${inactiveTh("age","Age","tabular")}${inactiveTh("overall","Overall","tabular")}<th>Status</th></tr></thead>
              <tbody>${inactiveRowsHtml}</tbody>
            </table>
          </div>` : ""}
        </div>
        <div class="league-subtab-panel" data-league-panel="alltime">
          ${buildAllTimeLeaderboardHTML()}
        </div>
        <div class="section-label" style="margin-top:1.5rem;">Around the League</div>
        <div class="calc-refnote">Front-office news from other teams — this is why their grades move, not just dice.</div>
        ${buildLeagueNewsFeedHTML()}
      </div>`;
  }

  const TREND_STATS = [
    { key:"rating", label:"Passer Rating", get:s=>s.rating },
    { key:"yards", label:"Pass Yards", get:s=>s.yards },
    { key:"td", label:"Touchdowns", get:s=>s.td },
    { key:"int", label:"Interceptions", get:s=>s.int },
    { key:"wins", label:"Wins", get:s=>s.wins },
    { key:"teamOverall", label:"Team Grade", get:s=>s.teamOverall },
    { key:"rushYards", label:"Rush Yards", get:s=>s.rushYards },
  ];
  let trendsStatKey = "rating";

  function renderTrendsSparkline(){
    const holder = document.getElementById("trendsSparklineHolder");
    if(!holder) return;
    const stat = TREND_STATS.find(t=>t.key===trendsStatKey) || TREND_STATS[0];
    const values = career.seasonLog.map(stat.get);
    const current = values[values.length-1] ?? 0;
    const options = TREND_STATS.map(t=>`<option value="${t.key}"${t.key===trendsStatKey?" selected":""}>${t.label}</option>`).join("");
    holder.innerHTML = `<div class="sparkline-head">
        <select class="spk-select" id="trendsStatSelect">${options}</select>
        <span class="spk-current tabular">${current.toLocaleString()}</span>
      </div>
      ${renderSparklineSVG(values)}`;
    document.getElementById("trendsStatSelect").addEventListener("change", (e)=>{
      trendsStatKey = e.target.value;
      renderTrendsSparkline();
    });
  }

  function buildTrendsTabHTML(){
    const log = career.seasonLog;
    const rows = log.slice().reverse().map(s=>`
        <tr><td>${s.year}</td><td class="team-cell">${s.teamName}</td><td>${s.rating}</td><td>${s.yards.toLocaleString()}</td>
        <td>${s.td}</td><td>${recordLine(s.wins, s.losses, s.ties||0)}</td><td>${s.awards.join(", ")||"—"}</td></tr>`).join("");
    return `
      <div class="sparkline-wrap">
        <div id="trendsSparklineHolder"></div>
      </div>
      <div class="trend-table-wrap table-wrap">
        <table class="career-table">
          <thead><tr><th>Year</th><th>Team</th><th>Rating</th><th>Yards</th><th>TD</th><th>Record</th><th>Awards</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  }

  // ----- Coaching Scheme tab: shows the CURRENT team's real, named scheme and exactly which
  // attributes it favors or hurts, using the same SCHEMES multiplier table schemeEffective()
  // actually plays by -- so what the player sees here can never contradict what's happening to
  // their stat production. -----
  function schemeAttrRows(schemeId){
    const scheme = SCHEMES.find(s=>s.id===schemeId);
    if(!scheme) return "";
    return ATTR_KEYS.filter(k=>k!=="DUR").map(k=>{
      const m = scheme.mult[k];
      const label = ATTR_BY_KEY[k].label;
      let cls = "neutral", tagText = "Neutral fit";
      if(m>=1.05){ cls="good"; tagText="Favored"; } else if(m<=0.95){ cls="bad"; tagText="Hurt"; }
      const pct = m!=null ? Math.round((m-1)*100) : 0;
      const pctText = m!=null ? (pct>0?"+":"")+pct+"%" : "—";
      return `<tr class="scheme-row-${cls}"><td>${label}</td><td class="tabular">${pctText}</td><td>${tagText}</td></tr>`;
    }).join("");
  }
  function buildSchemeTabHTML(){
    const schemeId = career.teamScheme ? career.teamScheme[career.teamId] : null;
    const scheme = SCHEMES.find(s=>s.id===schemeId);
    if(!scheme) return `<p style="color:var(--ink-muted);">No scheme data for this team.</p>`;
    return `
      <div class="scheme-head">
        <h4>${scheme.name}</h4>
        <p class="scheme-blurb">${scheme.blurb}</p>
      </div>
      <div class="table-wrap">
        <table class="career-table scheme-table">
          <thead><tr><th>Attribute</th><th>Scheme Impact</th><th>Fit</th></tr></thead>
          <tbody>${schemeAttrRows(schemeId)}</tbody>
        </table>
      </div>
      <p class="scheme-footnote">This is applied directly to on-field production, not flavor text — a favored attribute counts for more and a hurt one counts for less, exactly as shown above. Front-office shakeups (a fired coach, a new GM) can bring in a new coordinator and change the scheme entirely.</p>
    `;
  }

  /* ----- Team tab: the five supporting-cast/organization grades in one place, each with a plain-
     language note on the REAL mechanical effect it has (not flavor text — every one of these
     actually feeds a real formula elsewhere: oline->sack rate, weapons->completion%/YPA,
     defense->opponent scoring in simulateGameScore, coaching->developAttributes' per-season growth
     rate, gmGrade->FA contract offers and waiverCheck's cut-risk). Plus the team's own depth chart
     (QB1/2/3), reusing the same rivalEffTalent/contract fields the rival profile card already
     shows. */
  function buildTeamTabHTML(){
    // Wave 5 (tasks #6/#7): same ranked-grade-card renderer the generic Team page uses.
    const ranks = computeTeamGradeRanks(career.year);
    const gradeCards = buildGradeCardsHtml(
      { oline: career.oline, weapons: career.weapons, defense: career.defense, coaching: career.coaching, gmGrade: career.gmGrade },
      { ranks, teamId: career.teamId }
    );

    // Wave 5 (tasks #6/#7): reads the same live, canonical getTeamQuarterbacks lookup the generic
    // Team page now uses (buildTeamPageHTML/teamPageQbRowHTML) -- never the older, less-current
    // leagueDepthCharts snapshot, so this can't show a QB2/QB3 who's already moved on, and QB2/QB3
    // are clickable to their own profile ([data-rival-id], picked up by #careerContent's existing
    // delegated click listener) exactly like QB1's rival link already was elsewhere in the app.
    const qbs = getTeamQuarterbacks(career.teamId);
    const depthRow = (slot, qbEntry)=>{
      if(!qbEntry) return `<tr><td>${slot}</td><td>—</td><td class="tabular">—</td><td class="tabular">—</td><td>—</td></tr>`;
      const isUserEntry = !!qbEntry.isUser;
      const overall = isUserEntry ? Math.round(computeEffOverall(career.age, decadeForYear(career.year))) : rivalEffTalent(qbEntry);
      const nameHtml = isUserEntry
        ? svgEscape(qbEntry.name)+" (you)"
        : `<button type="button" class="rival-link" data-rival-id="${qbEntry.id}">${svgEscape(qbEntry.name)}</button>`;
      const availHtml = qbEntry.availability ? ` <b>(${svgEscape(qbEntry.availability.label || qbEntry.availability.reason || "Unavailable")})</b>` : "";
      return `<tr${isUserEntry?' class="me"':""}><td>${slot}</td><td>${nameHtml}${availHtml}</td><td class="tabular">${overall}</td><td class="tabular">${qbEntry.age}</td><td>${svgEscape((qbEntry.contract&&qbEntry.contract.tier)||"—")}</td></tr>`;
    };
    // getTeamQuarterbacks only ever fills in the user's own QB1 slot automatically (Wave 2A) --
    // when the user is a BACKUP, their own row has no registry entry at all (career/build ARE that
    // record), so it's inserted here exactly where the old leagueDepthCharts-based version always
    // placed it: QB2, same simplification as before this wave.
    const depthRows = career.isBackup
      ? [depthRow("QB1", qbs.QB1),
         `<tr class="me"><td>QB2</td><td>${svgEscape(career.name)} (you)</td><td class="tabular">${Math.round(computeEffOverall(career.age, decadeForYear(career.year)))}</td><td class="tabular">${career.age}</td><td>${svgEscape(career.contract.tier)}</td></tr>`,
         depthRow("QB3", qbs.QB3)]
      : [depthRow("QB1", qbs.QB1), depthRow("QB2", qbs.QB2), depthRow("QB3", qbs.QB3)];

    const schemeId = career.teamScheme ? career.teamScheme[career.teamId] : null;
    const scheme = SCHEMES.find(s=>s.id===schemeId);
    const teamGrade = Math.round(career.teamStrength);

    const teamRankHtml = ranks.overall[career.teamId] ? ` — #${ranks.overall[career.teamId]} of ${ranks.total}` : "";
    return `<div class="calc-refnote">${svgEscape(teamNameAt(career.teamId, career.year))} — Team Grade <b>${teamGrade}</b> (${svgEscape(gradeFor(clamp(teamGrade,0,98)).flavor)})${teamRankHtml}. Team Grade is a weighted read of the five grades below it (O-Line/Weapons 20% each, Defense 30%, Coaching 20%, Front Office 10%) — each still moves for its own legible reasons (roster variance, coaching changes, front-office moves), and each has a real, direct effect on your own numbers, not just flavor.</div>
      <div class="team-grade-grid">${gradeCards}</div>
      <div class="section-label" style="margin-top:1.4rem;">Depth Chart</div>
      <div class="table-wrap">
        <table class="career-table">
          <thead><tr><th>Slot</th><th>Name</th><th class="tabular">Overall</th><th class="tabular">Age</th><th>Contract</th></tr></thead>
          <tbody>${depthRows.join("")}</tbody>
        </table>
      </div>
      ${career.isBackup ? `<div class="calc-refnote" style="margin-top:0.6rem;">You're competing for the starting job — see the Season tab's front-office widget for how that's going.</div>` : ""}
      ${scheme ? `<div class="calc-refnote" style="margin-top:0.6rem;">Running <b>${svgEscape(scheme.name)}</b> — see the Scheme tab for the full attribute breakdown.</div>` : ""}
    `;
  }

  // ----- Attributes tab (item #10): a player-facing view of the twelve ratings mid-career --
  // draft-day value, current (development-adjusted) value, and what's actually driving THIS
  // season's production once age, era, and scheme are all applied. Reuses the same
  // schemeEffective()/weighted() pipeline generateSeason() itself plays by, so nothing shown here
  // can contradict the season card's actual numbers. -----
  const ATTR_GROUP_LABEL = { physical:"Physical", hitting:"Hitting", mental:"Mental & Intangibles" };
  const ATTR_GROUP_ORDER = ["physical","hitting","mental"];
  // The per-season "This Season's Development" strip at the top of the Attributes tab -- built
  // from season.attrChanges (stashed by developAttributes() the moment it computes them) rather
  // than re-deriving anything, so this can never disagree with the transaction-log breakout/
  // regression line or the cumulative draft-day table below it.
  function buildSeasonProgressHTML(season){
    if(!season || !season.attrChanges) return "";
    // Round 4: a career-arc swing (breakout or bust-spiral) gets its own headline banner above the
    // normal per-attribute list, since it's a career-defining moment (and a devSpeed shift), not
    // just a bigger version of the ordinary drift below it.
    const arc = season.devArcEvent;
    const earnedArc = arc && arc.type==="earned-breakthrough";
    const arcBannerHtml = arc ? `<div class="season-arc-banner ${arc.type}">
        <div class="season-arc-icon">${earnedArc ? "★" : arc.type==="breakout" ? "🔥" : "📉"}</div>
        <div class="season-arc-text">
          <div class="season-arc-title">${earnedArc ? "Earned Breakthrough" : arc.type==="breakout" ? "Breakout Season" : "Development Stalled"}</div>
          <div class="season-arc-sub">${earnedArc
            ? "Repeatedly beating his own expectation unlocked a new ceiling in the program he chose."
            : arc.type==="breakout"
              ? "Something clicked — several skills took an uncommon step forward."
              : "A real setback — several skills slipped at once."}</div>
        </div>
      </div>` : "";
    const report = season.developmentReport;
    const plan = developmentPlanFor(season.developmentPlanId);
    const keyMomentDelta = Number(season.keyMomentDevelopmentDelta || 0);
    const finalMomentum = clamp(Number(report ? report.momentumAfter : career.breakthroughMomentum || 0) + keyMomentDelta, 0, 100);
    const performanceHtml = report ? `<div class="development-context">
        <div><b>${svgEscape(plan.label)}</b> · ${svgEscape(report.performance.label)}</div>
        <div class="development-context-sub">Performance index <b class="tabular">${report.performance.index>=0?"+":""}${report.performance.index.toFixed(2)}</b> · ordinary growth ×<b class="tabular">${report.performanceMultiplier.toFixed(2)}</b> · breakthrough momentum <b class="tabular">${finalMomentum}/100</b>${keyMomentDelta ? ` (key moments ${fmtDelta(keyMomentDelta)})` : ""}</div>
      </div>` : "";
    const changes = season.attrChanges.filter(c=>c.delta!==0);
    if(!changes.length){
      return `<div class="season-progress">
          ${arcBannerHtml}
          ${performanceHtml}
          <div class="season-progress-head">This Season's Development</div>
          <div class="season-progress-empty">No meaningful movement this season — steady as she goes.</div>
        </div>`;
    }
    changes.sort((a,b)=> Math.abs(b.delta)-Math.abs(a.delta));
    const items = changes.map(c=>{
      const label = (ATTR_BY_KEY[c.key]||{}).label || c.key;
      const cls = c.delta>0 ? "up" : "down";
      const tag = c.earnedBreakthrough ? " · earned breakthrough" : c.breakout ? " · breakout" : c.regression ? " · regression" : "";
      return `<div class="season-progress-item ${cls}${c.breakout||c.earnedBreakthrough?" notable":""}${c.regression?" notable":""}">
          <span class="spi-label">${svgEscape(label)}</span>
          <span class="spi-delta">${c.delta>0?"+":""}${c.delta}</span>${tag?`<span class="spi-tag">${tag}</span>`:""}
        </div>`;
    }).join("");
    return `<div class="season-progress">
        ${arcBannerHtml}
        ${performanceHtml}
        <div class="season-progress-head">This Season's Development <span class="award-count">${changes.length}</span></div>
        <div class="season-progress-list">${items}</div>
      </div>`;
  }
  function buildAttributesTabHTML(season){
    const decade = decadeForYear(career.year);
    const schemeId = career.teamScheme ? career.teamScheme[career.teamId] : null;
    const scheme = SCHEMES.find(s=>s.id===schemeId);
    const eff = schemeEffective(career.age, decade, schemeId);
    const original = career.originalBuild || build;
    const devSpeed = career.devSpeed || 1;
    const overallNow = Math.round(weighted(eff, OVERALL_WEIGHTS));
    const totalDelta = ATTR_KEYS.filter(k=>k!=="DUR").reduce((s,k)=> s+(build[k]-(original[k] ?? build[k])), 0);
    const seasonProgressHtml = buildSeasonProgressHTML(season);

    const blocks = ATTR_GROUP_ORDER.map(g=>{
      const keys = ATTR_KEYS.filter(k=> ATTR_BY_KEY[k].group===g);
      const rows = keys.map(k=>{
        const label = ATTR_BY_KEY[k].label;
        const draftVal = original[k] ?? build[k];
        const nowVal = build[k];
        const delta = nowVal-draftVal;
        const cls = delta>0 ? "good" : delta<0 ? "bad" : "";
        const deltaText = delta!==0 ? ` <span class="${cls}">(${delta>0?"+":""}${delta})</span>` : "";
        return `<tr><td>${svgEscape(label)}</td><td class="tabular">${draftVal}</td><td class="tabular">${nowVal}${deltaText}</td><td class="tabular">${eff[k]}</td></tr>`;
      }).join("");
      return `<div class="calc-group">
          <div class="calc-group-head">${ATTR_GROUP_LABEL[g]}</div>
          <div class="admin-table-wrap"><table class="calc-ref-table">
            <thead><tr><th>Attribute</th><th>Draft Day</th><th>Now</th><th>Effective</th></tr></thead>
            <tbody>${rows}</tbody>
          </table></div>
        </div>`;
    }).join("");

    return `
      ${seasonProgressHtml}
      <div class="calc-metric">
        <div class="calc-metric-head"><span class="calc-metric-name">Overall (right now)</span><span class="calc-metric-result">${overallNow}</span></div>
        <div class="calc-refnote">Development trait: <b>${svgEscape(devSpeedTag(devSpeed))}</b>. Ordinary growth now combines age, real playing time, coaching, the offseason program you selected, and performance against this build's own expected production. Meeting an elite player's expectation is neutral; repeatedly beating it builds breakthrough momentum. Random breakouts never accelerate themselves, while an earned breakthrough is the rare route that can permanently raise an attribute ceiling. Net change since draft day: <b>${totalDelta>0?"+":""}${totalDelta}</b> across all eleven developable attributes. "Effective" is the raw rating after age, era, temporary effects, and ${scheme?`the ${svgEscape(scheme.name)} scheme`:"scheme"} are applied.</div>
      </div>
      ${blocks}
    `;
  }

  // ----- Front Office & Fanbase widget: a compact read on GM relations, fan support, and league
  // popularity -- the three relationship stats that drive contract leverage, trade/release risk,
  // and reputation-adjacent narrative, but (unlike Team Grade) aren't broadcast anywhere else in
  // the season card. -----
  function fanMeterRow(label, value, sub){
    return `<div class="fo-row">
        <div class="fo-row-head"><span class="fo-row-label">${label}</span><span class="fo-row-value tabular">${Math.round(value)}</span></div>
        <span class="meter"><span class="meter-fill" style="width:${clamp(value,0,100)}%;"></span></span>
        ${sub?`<div class="fo-row-sub">${sub}</div>`:""}
      </div>`;
  }
  // The player's own spot on the roster at his position -- the everyday job is either the player's
  // or held by the entrenched veteran he's stuck behind; the two bench names are informational
  // flavor (see PROGRESS.md Round 7 for why they never autonomously threaten the player's job).
  function buildDepthChartRowHTML(){
    const chart = (career.leagueDepthCharts||{})[career.teamId];
    const incumbent = career.isBackup ? rivalForTeam(career.teamId) : null;
    const posLbl = positionLabel(career.position);
    const qb1Line = career.isBackup && incumbent
      ? `Everyday ${svgEscape(incumbent.name)} (${rivalEffTalent(incumbent)} ovr) · Bench You`
      : `Everyday You`;
    const benchLine = chart
      ? `${career.isBackup ? "" : "Bench "}${career.isBackup ? "" : `${svgEscape(chart.qb2.name)} (${rivalEffTalent(chart.qb2)} ovr) · `}Bench ${svgEscape(chart.qb3.name)} (${rivalEffTalent(chart.qb3)} ovr)`
      : "";
    return `<div class="fo-row">
        <div class="fo-row-head"><span class="fo-row-label">Roster — ${svgEscape(posLbl)}</span></div>
        <div class="fo-row-sub">${qb1Line}${benchLine?` · ${benchLine}`:""}${career.isBackup ? " — you're fighting for the everyday job." : ""}</div>
      </div>`;
  }
  // Balance Wave 3: a lightweight, visible tally of Key Moment decision quality across the whole
  // career -- "track decision quality... use it for development" from the original brief. The
  // development hook already exists (career.breakthroughMomentum, nudged per-decision in
  // triggerKeyMoment's resolve()); this is the legible surface for it. Coach-trust/contract-value
  // hooks off this same tally are deliberately not built yet -- see PROGRESS.md.
  function keyMomentRecordRowHTML(){
    const rec = career.keyMomentRecord;
    if(!rec || (rec.good+rec.meh+rec.bad)===0) return "";
    const total = rec.good+rec.meh+rec.bad;
    const goodShare = rec.good/total;
    const tag = goodShare>=0.7 ? "Ice in his veins" : goodShare>=0.45 ? "More right than wrong" : goodShare>=0.25 ? "Hit or miss" : "Rattled under pressure";
    return `<div class="fo-row">
        <div class="fo-row-head"><span class="fo-row-label">Key Moment Decisions</span><span class="fo-row-value tabular">${rec.good}-${rec.meh}-${rec.bad}</span></div>
        <div class="fo-row-sub">${tag} (good-meh-bad reads across ${total} possession${total===1?"":"s"} that decided a playoff game). Right reads bank breakthrough momentum; wrong ones cost it.</div>
      </div>`;
  }
  function buildFrontOfficeWidgetHTML(){
    const schemeId = career.teamScheme ? career.teamScheme[career.teamId] : null;
    const scheme = SCHEMES.find(s=>s.id===schemeId);
    const gmTag = career.gmRelationship>=70 ? "Trusts you" : career.gmRelationship>=40 ? "Neutral" : "Bad blood";
    const fanTag = career.fanSupport>=70 ? "Beloved" : career.fanSupport>=40 ? "Mixed" : "Booed";
    const popTag = career.leaguePopularity>=70 ? "National name" : career.leaguePopularity>=40 ? "Known" : "Under the radar";
    const ageCap = durabilityAgeCap();
    const yearsLeft = Math.max(0, ageCap-career.age);
    const durTag = build.DUR>=80 ? "Iron man" : build.DUR>=55 ? "Average wear" : "Fragile";
    const wear = career.wearAndTear||0;
    const wearTag = wear>=85 ? "Running on Fumes" : wear>=65 ? "Breaking Down" : wear>=45 ? "Battle-Tested" : wear>=25 ? "Some Mileage" : "Fresh";
    const chemistry = career.teamChemistry ?? 50;
    const chemistryTag = chemistry>=80 ? "Telepathic" : chemistry>=65 ? "In sync" : chemistry>=45 ? "Functional" : "Disconnected";
    const developmentPlan = developmentPlanFor(career.developmentPlan);
    const wearSub = wear>=45
      ? `Playing through injuries instead of resting them is what built this up — above 45, every season carries a real chance of a permanent physical decline.`
      : `Stays low by resting injuries instead of playing through them. Keep it that way to protect his physical attributes long-term.`;
    return `<div class="front-office-widget">
        ${fanMeterRow("GM Relations", career.gmRelationship, gmTag)}
        ${fanMeterRow("Fan Support", career.fanSupport, fanTag)}
        ${fanMeterRow("League Popularity", career.leaguePopularity, popTag)}
        ${fanMeterRow("Wear & Tear", wear, `${wearTag} — ${wearSub}`)}
        ${fanMeterRow("Team Chemistry", chemistry, `${chemistryTag} — a small timing and team-offense edge, not a permanent roster-grade increase.`)}
        <div class="fo-row">
          <div class="fo-row-head"><span class="fo-row-label">Current Development Program</span><span class="fo-row-value tabular">${svgEscape(developmentPlan.label)}</span></div>
          <div class="fo-row-sub">${svgEscape(developmentPlan.summary)}</div>
        </div>
        ${keyMomentRecordRowHTML()}
        <div class="fo-row">
          <div class="fo-row-head"><span class="fo-row-label">Career Outlook</span><span class="fo-row-value tabular">${durTag}</span></div>
          <div class="fo-row-sub">Durability ${build.DUR} — the body should hold up through roughly age ${ageCap}${yearsLeft>0 ? ` (about ${yearsLeft} more season${yearsLeft===1?"":"s"} at current age, injuries permitting)` : " — this could be the last one"}.</div>
        </div>
        <div class="fo-row">
          <div class="fo-row-head"><span class="fo-row-label">Supporting Cast</span><span class="fo-row-value tabular">O-Line ${castLetterGrade(career.oline)} · Weapons ${castLetterGrade(career.weapons)}</span></div>
          <div class="fo-row-sub">${career.oline<48 ? "A shaky line means more hits taken and a real bump to injury risk. " : career.oline>=82 ? "One of the best lines in the league — extra time in the pocket every week. " : ""}${career.weapons<48 ? "Thin at the skill positions — every rep gets a little harder to complete." : career.weapons>=82 ? "A genuinely stacked group of targets makes every throw a little easier." : ""}</div>
        </div>
        ${buildDepthChartRowHTML()}
        ${scheme ? `<div class="fo-scheme-line">Running <b>${scheme.name}</b> — ${schemeFavorText(schemeId) || "no strong lean"}. <span class="fo-scheme-link" data-goto-scheme="1">See details →</span></div>` : ""}
        ${career.relationship ? `<div class="fo-scheme-line">${career.relationship.status==="married"?"Married to":"Dating"} <b>${svgEscape(career.relationship.partnerName)}</b>, the ${svgEscape(career.relationship.partnerType)}, since ${career.relationship.startYear}.</div>` : ""}
        ${career.achievements ? `<div class="fo-row">
          <div class="fo-row-head"><span class="fo-row-label">Achievements</span><span class="fo-row-value tabular">${Object.values(career.achievements.unlocked).filter(Boolean).length} / ${ACHIEVEMENTS.length}</span></div>
        </div>` : ""}
      </div>`;
  }
  // Re-renders the Front Office widget in place wherever it's currently mounted -- used any time
  // something it displays changes mid-season (a life event, a Key Moment resolving) rather than
  // waiting for the whole season card to next re-render. outerHTML replaces the node itself, so the
  // one internal link it wires up (Scheme tab) needs re-binding after every call.
  function refreshFrontOfficeWidget(){
    const foWidget = document.querySelector(".front-office-widget");
    if(!foWidget) return;
    foWidget.outerHTML = buildFrontOfficeWidgetHTML();
    const content = document.getElementById("careerContent");
    const schemeLink = content && content.querySelector("[data-goto-scheme]");
    if(schemeLink) schemeLink.addEventListener("click", ()=> switchDashTab("scheme"));
  }

  /* Achievements tab: the full 30-achievement roster, earned ones shown gold with their blurb,
     locked ones greyed out with a vague hint instead of the exact threshold. No interaction, no
     equip -- just a trophy case of everything this career has actually done. */
  function buildAchievementsTabHTML(){
    ensureAchievementState();
    const earnedCount = Object.values(career.achievements.unlocked).filter(Boolean).length;
    const cards = ACHIEVEMENTS.map(def=>{
      const unlocked = !!career.achievements.unlocked[def.key];
      return `<div class="pb-card${unlocked?"":" is-locked"}">
          <div class="pb-slot" style="cursor:default;">${achievementFrameHTML(def, unlocked)}</div>
          <div class="pb-card-name">${svgEscape(def.name)}</div>
          <div class="pb-card-tier">${unlocked?"Earned":"Locked"}</div>
          <div class="pb-card-hint">${unlocked ? svgEscape(def.blurb) : svgEscape(def.hint)}</div>
        </div>`;
    }).join("");
    return `<div class="calc-refnote">${earnedCount} of ${ACHIEVEMENTS.length} achievements earned this career. Every one is permanent once earned — no equipping, just a record of what actually happened.</div>
      <div class="pb-grid" style="margin-top:1rem;">${cards}</div>`;
  }

  // Menu-level Achievements screen: every achievement ever unlocked across EVERY career on this
  // browser (not just the current one), plus which character got there first -- same Steam-style
  // unlocked/locked split buildAchievementsTabHTML already uses (full blurb once earned, a vague
  // hint while locked), just scoped to the whole account instead of one career. Unlocked entries
  // sort first so a completionist's progress reads top-to-bottom without hunting through locked
  // filler; within each group, original ACHIEVEMENTS order is kept.
  function buildGlobalAchievementsHTML(){
    const g = loadGlobalAchievementsWithBackfill();
    const unlockedCount = ACHIEVEMENTS.filter(def=>g[def.key]).length;
    const sorted = ACHIEVEMENTS.map((def,i)=>({def,i})).sort((a,b)=>{
      const ua = !!g[a.def.key], ub = !!g[b.def.key];
      if(ua!==ub) return ua ? -1 : 1;
      return a.i-b.i;
    }).map(x=>x.def);
    const cards = sorted.map(def=>{
      const rec = g[def.key];
      const unlocked = !!rec;
      const subLine = unlocked
        ? `<div class="pb-card-sub">First unlocked by <b>${svgEscape(rec.name)}</b>${rec.team?` — ${svgEscape(rec.team)}`:""}${rec.year?`, ${rec.year}`:""}</div>`
        : "";
      return `<div class="pb-card${unlocked?"":" is-locked"}">
          <div class="pb-slot" style="cursor:default;">${achievementFrameHTML(def, unlocked)}</div>
          <div class="pb-card-name">${svgEscape(def.name)}</div>
          <div class="pb-card-tier">${unlocked?"Unlocked":"Locked"}</div>
          <div class="pb-card-hint">${unlocked ? svgEscape(def.blurb) : svgEscape(def.hint)}</div>
          ${subLine}
        </div>`;
    }).join("");
    return `<div class="calc-refnote">${unlockedCount} of ${ACHIEVEMENTS.length} achievements unlocked across every QB you've ever built on this browser.</div>
      <div class="pb-grid" style="margin-top:1rem;">${cards}</div>`;
  }

  function buildEventLogFeedHTML(){
    const lines = (career.transactions||[]).slice().reverse();
    if(!lines.length) return `<div class="feed-wrap"><div class="feed-empty">No transactions logged yet.</div></div>`;
    const rows = lines.map(line=>{
      const m = line.match(/^(\d{4}):\s*(.*)$/);
      const year = m ? m[1] : "";
      const text = m ? m[2] : line;
      let cls = "";
      if(/suspend|bann|released|waived|cut|injur|out \d+ season|federal investigation/i.test(text)) cls = "bad";
      else if(/sign|drafted|re-signed|mvp|champion|pro bowl|all-pro|extended|captain/i.test(text)) cls = "good";
      else if(/traded|draft/i.test(text)) cls = "gold";
      return `<div class="feed-line ${cls}"><span class="feed-year tabular">${year}</span><span class="feed-text">${text}</span></div>`;
    }).join("");
    // "present day" belongs at the TOP: lines are newest-first (the .reverse() above), so the top
    // of the feed is where "now" actually is -- it was previously appended after `rows`, landing it
    // at the bottom next to the OLDEST entry instead, a real reported bug ("present day is at the
    // oldest thing").
    return `<div class="feed-wrap"><div class="feed-line"><span class="feed-year"></span><span class="feed-text" style="color:var(--ink-muted);">— present day<span class="feed-cursor"></span></span></div>${rows}</div>`;
  }

  // QOL: a season's headline stats (yards/TD/INT/rating) tick up from 0 rather than snapping
  // straight to the final number -- only on a genuine "Simulate Season" advance (playSeasonAndRender
  // passes animate=true), never on a resumeActiveCareer() re-render of the same already-seen season.
  function animateNumberTicker(el, finalValue, duration, kind){
    if(!el) return;
    const reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const format = kind==="decimal1" ? (v)=>v.toFixed(1) : (v)=>Math.round(v).toLocaleString();
    if(reduced || !finalValue){ el.textContent = format(finalValue); return; }
    const start = performance.now();
    function frame(now){
      const t = clamp((now-start)/duration, 0, 1);
      const eased = 1 - Math.pow(1-t, 3);
      el.textContent = format(finalValue*eased);
      if(t<1) requestAnimationFrame(frame);
      else el.textContent = format(finalValue);
    }
    requestAnimationFrame(frame);
  }
  function animateSeasonStatTickers(scope){
    scope.querySelectorAll(".sw-num[data-final]").forEach(el=>{
      const finalValue = parseFloat(el.dataset.final);
      animateNumberTicker(el, finalValue, 1500, el.dataset.kind);
    });
  }

  function renderSeasonCard(season, animate){
    const content = document.getElementById("careerContent");
    const badges = season.awards.map(a=>`<span class="badge ${/Champion$/.test(a)||a==="MVP"?"gold":"good"}">${a}</span>`).join("");
    const brokenRecords = checkSeasonRecords(season);
    const recBy = {}; brokenRecords.forEach(r=> recBy[r.key]=r);
    const simBests = checkSimHistoricalBest(season);
    const simBy = {}; simBests.forEach(r=> simBy[r.key]=r);
    const narratives = [];
    if(season.missedGamesInjury>0 && season.missedGamesSuspension>0){
      narratives.push(`Missed ${season.missedGamesInjury} game${season.missedGamesInjury===1?"":"s"} to injury and ${season.missedGamesSuspension} to suspension.`);
    } else if(season.missedGamesSuspension>0){
      narratives.push(`Missed ${season.missedGamesSuspension} game${season.missedGamesSuspension===1?"":"s"} to suspension.`);
    } else if(season.missedGamesInjury>0){
      narratives.push(`Missed ${season.missedGamesInjury} game${season.missedGamesInjury===1?"":"s"} to injury.`);
    }
    if(season.missedGamesBackup>0 && season.games===0){
      const snap = season.incumbentSeasonSnapshot;
      narratives.push(`A bench year — ${svgEscape(season.incumbentName||"the veteran ahead of him")} played all ${season.missedGamesBackup} games at the position${snap ? ` (${snap.hr} HR, ${snap.rbi} RBI, ${snap.opsPlus!=null?snap.opsPlus+" OPS+":""})` : ""}.`);
    } else if(season.missedGamesBackup>0){
      narratives.push(`Got into ${season.games} game${season.games===1?"":"s"} behind ${svgEscape(season.incumbentName||"the veteran ahead of him")}, who took the other ${season.missedGamesBackup}.`);
    }
    if(season.wonStartingJob===true) narratives.push(`Wins the everyday job — the regular at ${positionLabel(career.position)} heading into next season.`);
    else if(season.wonStartingJob===false) narratives.push(`Still on the bench — back to spring training next year to fight for the job again.`);
    if(career.seasonsWithTeam===1 && career.seasonNumber>1) narratives.push(`First season in a new uniform with the ${season.teamName}.`);
    if(season.contractTier==="minimum") narratives.push(`A minimum-deal roster spot — every snap has to be earned.`);
    else if(season.contractTier==="backup") narratives.push(`A backup-caliber deal — the job isn't guaranteed week to week.`);
    if(season.wins/Math.max(1,season.games) >= 0.75) narratives.push(`One of the best rooms in the league all year.`);
    if(season.wins/Math.max(1,season.games) <= 0.25 && season.games>4) narratives.push(`A rough year up front — the offense never found its footing.`);
    if(career.age>=agingVetThreshold()) narratives.push(`Father Time is undefeated — with a durability grade like this, every season from here is borrowed time.`);
    if(season.wearBreakdown){
      const keyLabels = season.wearBreakdown.keys.map(k=>(ATTR_BY_KEY[k]||{}).label||k).join(" and ");
      narratives.push(`⚠ The wear finally caught up with him this year — a permanent decline in ${keyLabels}. Playing through pain has a real cost.`);
    }

    const p = season.playoffs;
    const standingsLine = p.made
      ? `<span class="badge good">Made the playoffs</span> — <b>#${p.seed} seed</b>, ${recordLine(season.teamWins, season.teamLosses, season.teamTies||0)}, #${p.confRank} of ${p.confSize} in the conference.`
      : `Missed the playoffs — ${recordLine(season.teamWins, season.teamLosses, season.teamTies||0)}, #${p.confRank} of ${p.confSize} in the conference.`;
    const recordDiffers = (season.wins!==season.teamWins) || (season.losses!==season.teamLosses);
    const recordNote = recordDiffers
      ? `<div class="record-note">As the starter you went <b>${recordLine(season.wins, season.losses, season.ties||0)}</b>; the backup went ${recordLine(season.teamWins-season.wins, season.teamLosses-season.losses, (season.teamTies||0)-(season.ties||0))} in relief.</div>`
      : "";

    let playoffRoundsHtml = "";
    if(p.made && p.rounds.length){
      // Every playoff round the player actually took part in (not just the Super Bowl) gets its
      // own paced, quarter-by-quarter reveal plus a read on the opponent's tendency -- the Super
      // Bowl keeps the extra gold "championship" treatment and full box score, every other round
      // gets a lighter version of the same box so a deep playoff run genuinely feels like a series
      // of distinct, developing games instead of one bracket graphic.
      // Nothing renders up front here at all beyond an empty holder -- not even round 1's box.
      // animatePlayoffQuarters appends each round's box (via playoffRoundBoxHtml) into it one at a
      // time, only once the player has actually won their way into that round, so the DOM itself
      // never gives away how far a run went before it's been played out. (Round 29: no longer
      // followed by a separate summary bracket graphic once all rounds finish -- see the Playoff
      // Tree tab for that, now the one place a full bracket view lives.)
      playoffRoundsHtml = `<div id="playoffRoundsHolder"></div>`;
    }

    const rushMini = season.rushAtt>0
      ? `<span>Rush <b class="tabular">${season.rushAtt}-${season.rushYards.toLocaleString()}${season.rushTd?" · "+season.rushTd+" TD":""}</b>${recBy.rushYards?recordBadgeHtml(recBy.rushYards):""}${simBy.rushYards?simBestBadgeHtml(simBy.rushYards):""}</span>` : "";
    const sacksMini = `<span>Sacks Taken <b class="tabular">${season.sacks}</b></span>`;

    // Overall delta badge: compares this season's grade against the PREVIOUS season's, the same
    // "roster update" convention sports games use -- so it reads as "what changed since last time,"
    // not a comparison against the draft-day scouting grade (a different, unrelated number). No
    // badge on a debut season since there's nothing yet to compare against.
    const prevSeason = career.seasonLog.length>=2 ? career.seasonLog[career.seasonLog.length-2] : null;
    const overallDelta = prevSeason ? season.overall-prevSeason.overall : null;
    const overallDeltaBadge = (overallDelta!==null && overallDelta!==0)
      ? `<span class="sb-delta ${overallDelta>0?"up":"down"}">${overallDelta>0?"+":""}${overallDelta}</span>` : "";

    content.innerHTML = `
      <div class="season-card">
        <div class="summary-bar">
          <div class="sb-left">
            <div class="sb-name">${svgEscape(career.name)}</div>
            <div class="sb-year">${season.year}</div>
            <div class="sb-sub">Age ${season.age} · ${season.decade}</div>
          </div>
          <div class="sb-mid">
            <div class="sb-stat"><div class="sb-stat-label">Team</div><div class="sb-stat-value" style="font-size:1rem;">${season.teamName}</div></div>
            <div class="sb-stat"><div class="sb-stat-label">Contract</div><div class="sb-stat-value tabular">${fmtMoney(season.contractApy)}<span style="font-size:0.6rem;color:var(--header-muted);text-transform:uppercase;"> /yr ${season.contractTier}</span></div></div>
            <div class="sb-stat grade"><div class="sb-stat-label">Team Grade</div><div class="sb-stat-value tabular">${season.teamOverall}</div></div>
            <div class="sb-stat overall">
              <div class="sb-stat-label">Overall</div>
              <div class="sb-stat-value tabular">${season.overall}</div>
              ${overallDeltaBadge}
            </div>
          </div>
          <div class="sb-right">
            <div class="sb-record"><span>Your Record</span>${recordLine(season.wins, season.losses, season.ties||0)}</div>
          </div>
        </div>

        <div class="season-body">
          <div class="dash-tabs">
            <button type="button" class="dash-tab-arrow" id="dashTabPrev" aria-label="Previous tab">‹</button>
            <div class="dash-tabs-track">
              <button type="button" class="dash-tab active" data-tab="season">Season</button>
              <button type="button" class="dash-tab" data-tab="schedule">Schedule</button>
              <button type="button" class="dash-tab" data-tab="standings">Standings</button>
              <button type="button" class="dash-tab" data-tab="league">League</button>
              <button type="button" class="dash-tab" data-tab="awards">Awards</button>
              <button type="button" class="dash-tab" data-tab="trends">Career Trends</button>
              <button type="button" class="dash-tab" data-tab="attributes">Attributes</button>
              <button type="button" class="dash-tab" data-tab="scheme">Scheme</button>
              <button type="button" class="dash-tab" data-tab="team">Team</button>
              <button type="button" class="dash-tab" data-tab="badges">Achievements</button>
              <button type="button" class="dash-tab" data-tab="log">Log</button>
            </div>
            <button type="button" class="dash-tab-arrow" id="dashTabNext" aria-label="Next tab">›</button>
          </div>

          <div class="dash-tabpanel active" id="tabpanel-season">
            <div class="widget-grid">
              <div class="stat-widget"><span class="sw-label">Pass Yards</span><span class="sw-value tabular"><span class="sw-num" id="swNumYards" data-final="${season.yards}" data-kind="int">${season.yards.toLocaleString()}</span>${recBy.yards?recordBadgeHtml(recBy.yards):""}${simBy.yards?simBestBadgeHtml(simBy.yards):""}</span><span class="sw-sub">${season.comp}/${season.att} · ${(season.pct*100).toFixed(1)}%</span></div>
              <div class="stat-widget"><span class="sw-label">Touchdowns</span><span class="sw-value good tabular"><span class="sw-num" id="swNumTd" data-final="${season.td}" data-kind="int">${season.td}</span>${recBy.td?recordBadgeHtml(recBy.td):""}${simBy.td?simBestBadgeHtml(simBy.td):""}</span><span class="sw-sub">${season.games} games played</span></div>
              <div class="stat-widget${season.int>=15?" neg":""}"><span class="sw-label">Interceptions</span><span class="sw-value${season.int>=15?" bad":""} tabular"><span class="sw-num" id="swNumInt" data-final="${season.int}" data-kind="int">${season.int}</span></span><span class="sw-sub">&nbsp;</span></div>
              <div class="stat-widget"><span class="sw-label">Passer Rating</span><span class="sw-value tabular"><span class="sw-num" id="swNumRating" data-final="${season.rating}" data-kind="decimal1">${season.rating}</span>${recBy.rating?recordBadgeHtml(recBy.rating):""}${simBy.rating?simBestBadgeHtml(simBy.rating):""}</span><span class="sw-sub">&nbsp;</span></div>
            </div>
            <div class="mini-stat-row">
              <span>Games <b class="tabular">${season.games}</b></span>
              ${rushMini}
              ${sacksMini}
            </div>
            <div class="badge-row" id="badgeRow">${badges}</div>
            ${narratives.map(n=>`<div class="narrative">${n}</div>`).join("")}
            <div class="standings-block">
              <div class="standings-line">${standingsLine}</div>
              ${recordNote}
              ${playoffRoundsHtml}
            </div>
            <div id="tabpanel-playofftree">${buildPlayoffTreeTabHTML(season)}</div>
            ${buildFrontOfficeWidgetHTML()}
          </div>

          <div class="dash-tabpanel" id="tabpanel-schedule">${buildScheduleTabHTML(season)}</div>
          <div class="dash-tabpanel" id="tabpanel-standings">${buildStandingsTabHTML(season)}</div>
          <div class="dash-tabpanel" id="tabpanel-league">${buildLeagueTabHTML(season)}</div>
          <div class="dash-tabpanel" id="tabpanel-awards">${buildAwardCeremonyHTML(season)}</div>
          <div class="dash-tabpanel" id="tabpanel-trends">${buildTrendsTabHTML()}</div>
          <div class="dash-tabpanel" id="tabpanel-attributes">${buildAttributesTabHTML(season)}</div>
          <div class="dash-tabpanel" id="tabpanel-scheme">${buildSchemeTabHTML()}</div>
          <div class="dash-tabpanel" id="tabpanel-team">${buildTeamTabHTML()}</div>
          <div class="dash-tabpanel" id="tabpanel-badges">${buildAchievementsTabHTML()}</div>
          <div class="dash-tabpanel" id="tabpanel-log">${buildEventLogFeedHTML()}</div>
        </div>
        <div class="season-actions" id="seasonActions"></div>
      </div>`;

    renderTrendsSparkline();
    content.querySelectorAll(".dash-tab").forEach(btn=>{
      btn.addEventListener("click", ()=> switchDashTab(btn.dataset.tab));
    });
    // Left/right arrow tab switcher: steps to the previous/next tab in DOM order instead of a
    // horizontally-scrolling row of buttons. The individual .dash-tab buttons stay in the DOM
    // (only the active one is shown, see CSS) so switchDashTab/deep-links/tests all keep working
    // unchanged -- this only changes how a tab gets selected.
    const dashTabKeys = Array.from(content.querySelectorAll(".dash-tab")).map(b=>b.dataset.tab);
    function stepDashTab(dir){
      const activeBtn = content.querySelector(".dash-tab.active");
      const curIdx = Math.max(0, dashTabKeys.indexOf(activeBtn ? activeBtn.dataset.tab : dashTabKeys[0]));
      const nextIdx = (curIdx+dir+dashTabKeys.length)%dashTabKeys.length;
      switchDashTab(dashTabKeys[nextIdx]);
    }
    const dashPrevBtn = document.getElementById("dashTabPrev");
    const dashNextBtn = document.getElementById("dashTabNext");
    if(dashPrevBtn) dashPrevBtn.addEventListener("click", ()=> stepDashTab(-1));
    if(dashNextBtn) dashNextBtn.addEventListener("click", ()=> stepDashTab(1));
    const schemeLink = content.querySelector("[data-goto-scheme]");
    if(schemeLink) schemeLink.addEventListener("click", ()=> switchDashTab("scheme"));

    const actions = document.getElementById("seasonActions");
    const tradeBtnHtml = canRequestTrade()
      ? `<button class="btn btn-ghost" id="reqTradeBtn">Request a trade <span class="tabular" style="opacity:0.6;">(${3-(career._tradeRequestsUsed||0)} left)</span></button>` : "";
    if(career.age+1>=29){
      actions.innerHTML = `
        <button class="btn btn-primary" id="playOnBtn">Plan offseason &amp; play</button>
        ${tradeBtnHtml}
        <button class="btn btn-ghost" id="retireBtn">Retire</button>`;
      document.getElementById("playOnBtn").addEventListener("click", beginOffseason);
      document.getElementById("retireBtn").addEventListener("click", ()=>{ career.exitReason="retired"; finishCareer(); });
    } else {
      // Multiplayer: no Fast-Forward -- each season is meant to be played through deliberately,
      // not skipped in bulk, matching the "no respins either" restriction on the Combine side.
      const ffBtnHtml = career.multiplayerMatchId ? "" : `<button class="btn btn-ghost" id="fastForwardBtn">Fast-Forward ⏩</button>`;
      actions.innerHTML = `<button class="btn btn-primary" id="continueBtn">Plan offseason &amp; continue</button>${tradeBtnHtml}${ffBtnHtml}`;
      document.getElementById("continueBtn").addEventListener("click", beginOffseason);
      const ffBtn = document.getElementById("fastForwardBtn");
      if(ffBtn) ffBtn.addEventListener("click", startFastForward);
    }
    const reqTradeBtn = document.getElementById("reqTradeBtn");
    if(reqTradeBtn) reqTradeBtn.addEventListener("click", requestTrade);
    // The playoff reveal is now player-paced (sim quarter/half/end-of-game buttons) rather than
    // automatic, so advancing to next season is held until the ENTIRE league-wide bracket record
    // is final (season.leagueStandings.playoffBracket) -- not just the player's own real
    // involvement. Before this check existed, a player eliminated mid-bracket (or who missed the
    // playoffs entirely) could hit Continue the instant their own reveal ended, well before the
    // other conference -- or the rest of their own, now-flat conference -- had ever been manually
    // simulated via the Playoff Tree's "Simulate Next Round," which meant that data (and any ring
    // it would have awarded) simply never got generated at all once the season moved on. Built
    // AFTER the action buttons above exist, so it can actually disable them.
    if(season.leagueStandings && season.leagueStandings.bracket && !season.leagueStandings.playoffBracket){
      actions.classList.add("pending-reveal");
      actions.querySelectorAll("button").forEach(b=> b.disabled = true);
    }
    animatePlayoffQuarters(season);
    updateHeaderCareerTicker();
    if(animate) animateSeasonStatTickers(content);
  }

  /* ================= Key Moment mini-game ================= */
  // Balance Wave 3 (difficulty/balance remediation brief item 2): PLAY_CALLS, the situational
  // scoring model, and the leverage-only trigger constant all live in src/sim/keyMoments.js now
  // (pure, importable, shared with headless tests) -- see that module's own header comment for the
  // full "why" behind replacing the old permanent 1:1 tendency-to-call answer key.
  // "Hard" difficulty deliberately withholds the tendency's own label/blurb and gives only an
  // indirect, observational clue instead -- genuine deduction rather than just re-reading the
  // scouting-report line already shown on the round card.
  const TENDENCY_SUBTLE_CLUES = {
    runheavy: "The gun hasn't read below 96 once tonight, and it's all four-seamers.",
    blitzheavy: "He's thrown a first-pitch strike to almost every hitter he's faced.",
    lockdowncorners: "Barely anything he's thrown for a strike has caught the middle third.",
    preventlate: "Since his team took the lead, he hasn't been in the zone with two strikes.",
    turnoverhunting: "Half the swings against him tonight have been at pitches in the other batter's box.",
    physicalfront: "Three different hitters have been late on the fastball and fouled it straight back.",
    disciplinedzone: "He hasn't thrown the same pitch twice in a row in two full innings.",
    suddenchange: "Bases empty he's been around the zone; every time a runner reached, the stuff jumped.",
  };
  // Situational flavor is independent of the tendency clue -- varying down/distance/score/clock
  // context across ~18 entries in three difficulty tiers gives "many scenarios," while the clue
  // directness (see TENDENCY_SUBTLE_CLUES / keyMomentClue below) is the actual difficulty lever.
  // Every situation below explicitly reads as the fourth quarter, on purpose: the mini-game is
  // ALWAYS resolved at the checkpoint right after Q3 (see revealOneQuarter's
  // `r._revealedCount===3` check), deciding what happens entering the fourth -- never any other
  // quarter. Two entries used to break that (km_m3 read as a pre-halftime two-minute drill,
  // km_h2 read as if overtime were already happening) even though the moment can only ever be
  // entering the fourth when it fires; both were rewritten below to match what's actually
  // happening on the field.
  // Balance Wave 3: `flags` are pulled from src/sim/keyMoments.js's KEY_MOMENT_SITUATION_FLAGS by
  // id -- one shared source of truth for the structured, machine-readable half of each situation
  // (protectLead/needScore/explosiveNeeded/shortYardage/longYardage/mustConvert/lateAndClose/
  // ballSecurity), which is what keyMomentCallScore actually reasons about. The prose below is
  // what the player reads; the imported flags are the ground truth it describes, and are what
  // makes the same tendency counter genuinely right in one situation and wrong in another (see
  // that module's own comment for the worked "controlclock vs. a trailing, needScore situation"
  // example).
  const KEY_MOMENT_SITUATIONS = [
    { id:"km_e1", difficulty:"easy", text:"Leadoff at-bat in the 7th, the game still very much in the balance either way." },
    { id:"km_e2", difficulty:"easy", text:"Up three in the 7th, leading off the inning. Nothing to chase here — just have a good at-bat." },
    { id:"km_e3", difficulty:"easy", text:"Two down in the 7th, a runner on second, game within reach. This is the at-bat that keeps the inning alive." },
    { id:"km_e4", difficulty:"easy", text:"Runner on first, nobody out, 7th inning, the score close." },
    { id:"km_e5", difficulty:"easy", text:"Runner on third, one out, 7th inning — a ball in the air or on the ground brings him home." },
    { id:"km_e6", difficulty:"easy", text:"Runner on third, two out, 7th — you have to put this in play to get him in." },
    { id:"km_m1", difficulty:"medium", text:"Bottom of the 8th, tie game, two out, runner on second. The whole inning is this at-bat." },
    { id:"km_m2", difficulty:"medium", text:"Down three in the 8th, bases empty, two out. A solo shot barely dents it — you need to start something big." },
    { id:"km_m3", difficulty:"medium", text:"Trailing by one in the 8th, runner on first, one out. You need to move him and find a way to get the run in." },
    { id:"km_m4", difficulty:"medium", text:"Down one in the 8th, two out, runner on second — a walk doesn't help, a base hit ties it." },
    { id:"km_m5", difficulty:"medium", text:"Trailing by two in the 7th, runner on first, nobody out. The offense has to answer this inning." },
    { id:"km_m6", difficulty:"medium", text:"Tie game, 9th inning, two out, the winning run standing on second." },
    { id:"km_h1", difficulty:"hard", text:"Bottom of the 9th, down one, two out, tying run on second. Last swing of the season if this doesn't work." },
    { id:"km_h2", difficulty:"hard", text:"Down four in the 9th, two out, bases loaded. Nothing but a grand slam keeps the season alive." },
    { id:"km_h3", difficulty:"hard", text:"Bottom of the 9th, down one, two out, runner on third. A ball out of the infield ties it; anything less ends it." },
    { id:"km_h4", difficulty:"hard", text:"Down three in the 9th, two out, two on. A single makes it interesting — you need to get all of one." },
    { id:"km_h5", difficulty:"hard", text:"Up one in the 9th, runner on first, one out — the worst thing you can do here is roll into a double play." },
    { id:"km_h6", difficulty:"hard", text:"Up two in the 9th, runner on third, two out — a productive out ices it, a strikeout leaves the door cracked." },
  ].map(s=> ({ ...s, flags: KEY_MOMENT_SITUATION_FLAGS[s.id] || [] }));
  // Higher-stakes rounds skew the situation pool toward the harder tiers -- the deeper the run,
  // the less hand-holding the mini-game gives.
  const ROUND_DIFFICULTY_WEIGHTS = {
    "Wild Card": {easy:0.55, medium:0.35, hard:0.10},
    "Divisional": {easy:0.35, medium:0.45, hard:0.20},
    "Conference Championship": {easy:0.15, medium:0.45, hard:0.40},
    "Super Bowl": {easy:0.05, medium:0.35, hard:0.60},
  };
  function pickKeyMomentSituation(roundLabel){
    const weights = ROUND_DIFFICULTY_WEIGHTS[roundLabel] || {easy:0.34, medium:0.33, hard:0.33};
    const r = Math.random();
    const difficulty = r < weights.easy ? "easy" : (r < weights.easy+weights.medium ? "medium" : "hard");
    const pool = KEY_MOMENT_SITUATIONS.filter(s=>s.difficulty===difficulty);
    return pick(pool.length ? pool : KEY_MOMENT_SITUATIONS);
  }
  // The clue's directness IS the difficulty lever: easy names the tendency outright, medium
  // describes it without naming it, hard gives only an indirect observational detail.
  function keyMomentClue(tendency, difficulty){
    if(difficulty==="easy") return `Your hitting coach has seen it clearly all night: <b>${svgEscape(tendency.label)}</b> — ${svgEscape(tendency.blurb)}`;
    if(difficulty==="medium") return `The advance report keeps coming back to the same read: ${svgEscape(tendency.blurb)}`;
    return `Nobody in the dugout is certain yet, but the tape from earlier tonight hinted at it: ${svgEscape(TENDENCY_SUBTLE_CLUES[tendency.id] || tendency.blurb)}`;
  }
  // Four options, three distinct outcome tiers, RANKED by the shared keyMomentCallScore for THIS
  // exact tendency+situation pairing rather than one fixed call always being "good." The true
  // best-EV call (across all 8, not just the 4 shown) is always included so there's always a
  // genuinely correct answer available to reward real reasoning -- it just isn't the same call
  // every time the same tendency shows up. Ties (a real possibility once situational flags are
  // empty, e.g. km_e1/km_e4 above) break by whichever the fresh shuffle happens to place first,
  // matching how a real coordinator would treat two genuinely equivalent calls.
  function keyMomentOptionsFor(tendency, situation){
    const ranked = [...PLAY_CALLS].sort((a,b)=> keyMomentCallScore(b,tendency.id,situation.flags) - keyMomentCallScore(a,tendency.id,situation.flags));
    const bestCall = ranked[0];
    const others = PLAY_CALLS.filter(c=>c.id!==bestCall.id).sort(()=>Math.random()-0.5).slice(0,3);
    const presented = shuffle([bestCall, ...others]);
    const scored = presented.map(c=> ({ call:c, score: keyMomentCallScore(c,tendency.id,situation.flags) }))
      .sort((a,b)=> b.score-a.score);
    const mehId = scored[1] ? scored[1].call.id : null;
    const goodId = scored[0].call.id;
    return presented.map(c=> ({ ...c, quality: c.id===goodId ? "good" : c.id===mehId ? "meh" : "bad" }));
  }
  // Balance Wave 3: composes a per-moment explanation instead of always reprinting the correct
  // call's static tactical blurb -- when the situation itself (not just the tendency) is what made
  // this call best, say so explicitly, including naming the tempting "textbook" tendency-counter
  // when it would actually have been wrong here. This is the teaching moment that makes the fix
  // legible to the player, not just a different number under the hood.
  function describeKeyMomentReasoning(bestCall, tendency, situation){
    const textbookCounter = PLAY_CALLS.find(c=>c.countersTendencyId===tendency.id);
    const situationalHitsForBest = (bestCall.goodWhen||[]).filter(f=>situation.flags.includes(f));
    if(bestCall.countersTendencyId===tendency.id && (!textbookCounter || textbookCounter.id===bestCall.id)){
      return bestCall.why;
    }
    if(situationalHitsForBest.length && textbookCounter && textbookCounter.id!==bestCall.id){
      const textbookBadHits = (textbookCounter.badWhen||[]).filter(f=>situation.flags.includes(f));
      if(textbookBadHits.length){
        return `${bestCall.why} The textbook answer to that look is normally "${textbookCounter.label}," but not with this much on the line right now — that call would have played right into what the moment actually demanded.`;
      }
    }
    return bestCall.why;
  }
  // Real score swing: a correct read always scores FOR the player, a wrong read always scores
  // for the opponent -- full stop, no safety net. This CAN and regularly will flip who actually
  // wins the round: a correct read in the closing minutes of a game the player was trailing can
  // erase the deficit and win it, and a blown read while protecting a lead can cough it right back
  // up. That's the whole point of a "this possession decides it" moment -- if it can't change who
  // wins, it isn't actually a key moment. (An older version of this function capped the swing so
  // it could never pass the leader; that made every Key Moment cosmetic and has been removed.)
  // If the swing happens to land the score on an exact tie, one more possession -- a coin flip
  // very slightly tilted by who's already carrying momentum -- decides it immediately, same as a
  // real sudden-death possession would.
  // The point value is drawn from actual single-play NFL scoring increments (a field goal, a
  // touchdown with/without the extra point or with a two-point try, a safety) instead of a raw
  // randInt(3,7) -- the old range silently included 4 and 5, deltas no single play can produce,
  // which is exactly what read as "messes with the scoring." When the swing lands in the
  // player's favor via a touchdown-type score, the round's own box score gets that touchdown
  // credited too, so the box stats never drift out of sync with the score they're supposed to
  // describe. round.won is recomputed from the final score once the swing (and any tie-break) has
  // been applied -- it is the single source of truth for who won this round from this point on,
  // and everything downstream (bracket advancement, the Super Bowl, awards) reads it, never the
  // pre-swing baseline.
  // `pts` is RUNS now. On a good read they're the player's; on a bad read they read as the
  // opponent answering in their half of the inning (the rally died and the game turned there).
  const KEY_MOMENT_SCORE_TYPES = [
    { pts:1, type:"an RBI single", w:0.36 },
    { pts:2, type:"a two-run double", w:0.24 },
    { pts:1, type:"a sacrifice fly", w:0.12 },
    { pts:3, type:"a three-run homer", w:0.16 },
    { pts:4, type:"a grand slam", w:0.04 },
    { pts:1, type:"a bases-loaded walk", w:0.08 },
  ];
  // Meh's pool: a defensible-but-not-sharp at-bat. Usually nothing comes of it, worst case a
  // single run trickles across. Bad always costs a real crooked number; Meh usually costs nothing.
  const KEY_MOMENT_MEH_SCORE_TYPES = [
    { pts:0, type:"a hard-hit out", w:0.55 },
    { pts:1, type:"a run on the play", w:0.30 },
    { pts:1, type:"a productive groundout", w:0.15 },
  ];
  function pickKeyMomentScoreType(){
    const r = Math.random();
    let acc = 0;
    for(const s of KEY_MOMENT_SCORE_TYPES){ acc += s.w; if(r<acc) return s; }
    return KEY_MOMENT_SCORE_TYPES[0];
  }
  function pickKeyMomentMehScoreType(){
    const r = Math.random();
    let acc = 0;
    for(const s of KEY_MOMENT_MEH_SCORE_TYPES){ acc += s.w; if(r<acc) return s; }
    return KEY_MOMENT_MEH_SCORE_TYPES[0];
  }
  // The Key Moment fires right after the 6th inning reveals (see revealOneQuarter's
  // `_revealedCount===6` check) -- it's always the at-bat ENTERING the 7th, so the run swing lands
  // on that inning (index 6, the next unrevealed one). Whether the game then needs extra innings
  // is re-derived FRESH from the swung total every time, never inherited from the pre-swing sim.
  const KM_SWING_INNING_IDX = 6;
  const REGULATION_INNINGS = 9;
  function applyKeyMomentSwing(round, quality){
    const good = quality==="good";
    const picked = good || quality==="bad" ? pickKeyMomentScoreType() : pickKeyMomentMehScoreType();
    const scoreType = picked.type;
    const dMy = good ? picked.pts : 0;
    const dOpp = good ? 0 : picked.pts;

    const swingInn = round.quarters[KM_SWING_INNING_IDX] || round.quarters[round.quarters.length-1];
    swingInn.myTotal += dMy; swingInn.oppTotal += dOpp;
    swingInn.myQ = (swingInn.myQ||0) + dMy; swingInn.oppQ = (swingInn.oppQ||0) + dOpp;
    // every inning after the swing carries the new running total forward
    for(let i=KM_SWING_INNING_IDX+1; i<round.quarters.length; i++){
      round.quarters[i].myTotal += dMy; round.quarters[i].oppTotal += dOpp;
    }
    round.myScore += dMy; round.oppScore += dOpp;

    const lastInn = round.quarters[round.quarters.length-1];
    const hadExtras = round.quarters.length > REGULATION_INNINGS;
    const stillTied = lastInn.myTotal === lastInn.oppTotal;
    let otNote = "";

    if(hadExtras && !stillTied){
      // The game used to need extra innings; this at-bat just decided it in regulation. Drop the
      // extra frames that never had to happen and re-sync the score off the 9th.
      round.quarters.length = REGULATION_INNINGS;
      const nine = round.quarters[REGULATION_INNINGS-1];
      round.myScore = nine.myTotal; round.oppScore = nine.oppTotal;
      otNote = "That decided it in nine — no extra innings needed after all.";
    } else if(!hadExtras && stillTied){
      // The game used to end in nine; this at-bat just tied it back up. Play a fair extra frame:
      // a good read that only manages to tie sends it to extras and wins there; a blown read that
      // ties it up hands the other side the walk-off chance.
      let exMy=0, exOpp=0;
      if(good) exMy = 1;
      else if(Math.random() < 0.5 + ((round._offOverall??65)-(round._defOffense??round._defOverall??65))*0.01) exMy = 1;
      else exOpp = 1;
      round.quarters.push({ q:"10", myQ: exMy, oppQ: exOpp, myTotal: lastInn.myTotal+exMy, oppTotal: lastInn.oppTotal+exOpp });
      round.myScore = lastInn.myTotal+exMy; round.oppScore = lastInn.oppTotal+exOpp;
      otNote = good ? "Tied it up, then won it in extras." : "Tied it up, but they walked it off in extras.";
    } else if(hadExtras && stillTied){
      round.myScore = lastInn.myTotal;
      round.oppScore = lastInn.oppTotal;
    }

    // keep the box score's HR count consistent with a homer-type swing in the player's own favor,
    // capped the same way generateGameBoxScore caps it.
    if(dMy>0 && /homer|slam/.test(scoreType) && round.box) round.box.td = clamp((round.box.td||0)+1, 0, 4);
    round.won = round.myScore > round.oppScore;
    return { dMy, dOpp, scoreType, otNote };
  }
  // Balance Wave 3: Clutch's role in the Key Moment mini-game moves from gating PARTICIPATION
  // (removed -- see KEY_MOMENT_BASE_TRIGGER_CHANCE) to gating EXECUTION once a moment fires, via
  // the shared executeKeyMomentQuality (src/sim/keyMoments.js). The "quality" a choice earns
  // (good/meh/bad, from keyMomentOptionsFor's tendency+situation ranking) is a statement about the
  // DECISION; the executed quality is what actually happens on the field this time.
  function triggerKeyMoment(season, round, roundIdx, onResolved, stillCurrent){
    // stillCurrent (optional) guards against a reveal that was superseded by a new season's
    // render between the moment this was scheduled and the moment it actually fires -- without
    // this, a fast-clicking player could see a stale Key Moment pop up over a later season.
    if(stillCurrent && !stillCurrent()) return;
    const situation = pickKeyMomentSituation(round.round);
    const tendency = round.oppTendency;
    const options = keyMomentOptionsFor(tendency, situation);
    const bestCall = options.find(o=>o.quality==="good") || options[0];
    const overlay = document.getElementById("keyMomentOverlay");
    if(!overlay){ onResolved(); return; }
    function renderCard(){
      overlay.innerHTML = `
        <div class="km-card">
          <div class="km-eyebrow">${roundDisplayLabel(round.round, season.year)} · Key Moment <span class="km-difficulty">${situation.difficulty}</span></div>
          <h3 id="keyMomentHeading">Late innings. This at-bat decides it.</h3>
          <div class="km-situation">${svgEscape(situation.text)}</div>
          <div class="km-clue">${keyMomentClue(tendency, situation.difficulty)}</div>
          <div class="km-options">${options.map(o=>`<button type="button" class="km-option" data-call="${o.id}">${svgEscape(o.label)}</button>`).join("")}</div>
        </div>`;
      overlay.querySelectorAll(".km-option").forEach(btn=>{
        btn.addEventListener("click", ()=> resolve(btn.dataset.call));
      });
    }
    function resolve(chosenId){
      const chosenOption = options.find(o=>o.id===chosenId) || {};
      const quality = chosenOption.quality || "bad";
      const clu = eraEffective(season.age, season.decade).CLU;
      const executedQuality = executeKeyMomentQuality(quality, clu);
      const slipped = quality==="good" && executedQuality==="meh";
      const saved = quality==="bad" && executedQuality==="meh";
      const wonBeforeSwing = round.won;
      const swing = applyKeyMomentSwing(round, executedQuality);
      const flippedResult = round.won !== wonBeforeSwing;
      const repDelta = executedQuality==="good" ? randInt(2,5) : executedQuality==="meh" ? randInt(-2,1) : -randInt(2,5);
      career.reputation = clamp(career.reputation + repDelta, 0, 100);
      // Key Moments are the player's direct execution input into development.
      // They happen after the season's ordinary development roll, so they bank
      // momentum for a future earned breakthrough rather than rewriting ratings
      // in the middle of a playoff game. Banked off the DECISION's own quality, not the executed
      // one -- recognizing the right read is the skill this is meant to reward, even on the rare
      // occasion the execution itself (Clutch's own domain) doesn't fully cash it in.
      const requestedDevelopmentDelta = quality==="good" ? 4 : quality==="bad" ? -4 : 0;
      const momentumBefore = career.breakthroughMomentum || 0;
      career.breakthroughMomentum = clamp(momentumBefore + requestedDevelopmentDelta, 0, 100);
      const developmentDelta = career.breakthroughMomentum - momentumBefore;
      season.keyMomentDevelopmentDelta = Number(season.keyMomentDevelopmentDelta || 0) + developmentDelta;
      career.keyMomentRecord = career.keyMomentRecord || { good:0, meh:0, bad:0 };
      career.keyMomentRecord[quality] = (career.keyMomentRecord[quality]||0) + 1;
      recordLedgerEvent("key_moment", { teamId: career.teamId, opponentId: round.oppId||null, choiceId: chosenId, outcomeId: executedQuality, severity: quality, metadata:{round: round.round, flippedResult} });
      const verbPhrase = executedQuality==="good" ? "Delivered" : executedQuality==="meh" ? "Settled for a lesser at-bat" : "Came up short";
      career.transactions.push(`${season.year}: ${verbPhrase} in a clutch at-bat vs. the ${round.opponent} (${roundDisplayLabel(round.round, season.year)}).`);
      overlay.querySelectorAll(".km-option").forEach(btn=>{
        btn.disabled = true;
        if(btn.dataset.call===bestCall.id) btn.classList.add("correct");
        else if(btn.dataset.call===chosenId && quality==="meh") btn.classList.add("meh");
        else if(btn.dataset.call===chosenId) btn.classList.add("wrong");
      });
      const outcomeEl = document.createElement("div");
      outcomeEl.className = "km-outcome " + (executedQuality==="good" ? "good" : executedQuality==="meh" ? "meh" : "bad");
      outcomeEl.innerHTML = slipped
        ? `Right read — but it didn't come out clean under the pressure. He gets just enough of it to fall short of what it should've been.`
        : saved
        ? `Wrong guess — but the bat speed bails him out anyway. Pure talent salvaging a bad approach.`
        : quality==="good"
        ? `Right read. He was on it the whole way and put his best swing on it.`
        : quality==="meh"
        ? `Not the sharpest at-bat — it doesn't blow up on him, but it doesn't beat the pitcher either.`
        : `Wrong read. The pitcher had him set up for it the whole at-bat.`;
      const whyEl = document.createElement("div");
      whyEl.className = "km-why";
      whyEl.textContent = describeKeyMomentReasoning(bestCall, tendency, situation);
      const effectEl = document.createElement("div");
      effectEl.className = "km-effect";
      const scoreBit = swing.dMy ? `Your score ${fmtDelta(swing.dMy)}${swing.scoreType?` (${swing.scoreType})`:""}` : (swing.dOpp ? `Their score ${fmtDelta(swing.dOpp)}${swing.scoreType?` (${swing.scoreType})`:""}` : "No score change — the margin was already too tight to move.");
      effectEl.textContent = `Effect: ${scoreBit} · Reputation ${fmtDelta(repDelta)} · Breakthrough momentum ${developmentDelta===0?"unchanged":fmtDelta(developmentDelta)}.`;
      let flipEl = null;
      if(flippedResult){
        flipEl = document.createElement("div");
        flipEl.className = "km-effect km-flip " + (round.won ? "good" : "bad");
        flipEl.textContent = round.won
          ? "That's the whole game. The at-bat just won it."
          : "That's the whole game. The at-bat just lost it.";
      }
      const continueBtn = document.createElement("button");
      continueBtn.type = "button";
      continueBtn.className = "btn btn-primary km-continue";
      continueBtn.textContent = "Continue";
      continueBtn.addEventListener("click", ()=>{
        closeDialog(overlay);
        overlay.innerHTML = "";
        // refresh the final-score line and the just-revealed quarter cards so the swing is
        // visible immediately, not just once the round finishes revealing.
        const finalEl = document.querySelector(`[data-round-idx="${roundIdx}"] .pr-box-final b, [data-round-idx="${roundIdx}"] .sb-final b`);
        if(finalEl) finalEl.textContent = `${round.myScore}-${round.oppScore}`;
        const attributesPanel = document.getElementById("tabpanel-attributes");
        if(attributesPanel) attributesPanel.innerHTML = buildAttributesTabHTML(season);
        refreshFrontOfficeWidget(); // reflects the just-updated career.keyMomentRecord immediately
        onResolved();
      });
      const card = overlay.querySelector(".km-card");
      card.appendChild(outcomeEl); card.appendChild(whyEl); card.appendChild(effectEl);
      if(flipEl) card.appendChild(flipEl);
      card.appendChild(continueBtn);
    }
    renderCard();
    openDialog(overlay, { labelledBy: "keyMomentHeading" });
  }

  // Player-paced quarter-by-quarter reveal for EVERY playoff round the player took part in, not
  // just the Super Bowl. This used to be fully automatic (either a CSS-timed cascade with Key
  // Moments off, or a setTimeout-sequenced cascade with them on) -- now every quarter only
  // reveals on an explicit click of one of that round's "Sim Quarter / Sim to Half / Sim to End
  // of Game" buttons, and a Key Moment (when one fires) genuinely pauses the sequence: no further
  // quarters reveal, and "Sim to End of Game" won't finish the game, until the mini-game is
  // resolved. Rounds are gone through in order -- the next round's controls only appear once the
  // current one has fully played out -- and "Play another season"/"Continue" stays disabled on
  // the season card until every round the player took part in has finished revealing.
  //
  // A Key Moment is only even rolled for when the score AT THAT POINT IN THE GAME (the running
  // total through the 3rd quarter, not the eventual final -- the player hasn't seen the final
  // yet at this point in the reveal) is still plausibly in play. A 40-0 laugher heading into the
  // 4th never rolls one; a one-score or two-score game always can; a long-shot double-digit
  // comeback can, just less often.
  //
  // Cancellation token: rendering a new season card (the player finished a previous season's
  // reveal, or the whole state got reset) must invalidate every pending callback from the OLD
  // reveal -- otherwise a stale Key Moment for a season the player has already left behind could
  // pop up on top of a completely different screen. Every step below re-checks this token before
  // touching the DOM or opening the overlay.
  let _playoffRevealToken = 0;
  function keyMomentScoreEligibility(round){
    // Checkpoint through 6 innings (index 5) -- late enough that the game's shape is clear.
    const checkpoint = round.quarters[5] || round.quarters[round.quarters.length-1];
    const diff = Math.abs(checkpoint.myTotal - checkpoint.oppTotal);
    if(diff<=2) return 1;      // one- or two-run game -- always live
    if(diff<=4) return 0.7;    // a three-four run game -- still very much in reach
    if(diff<=6) return 0.35;   // a real long-shot, but not impossible
    return 0;                  // blowout -- no point running the mini-game
  }
  function animatePlayoffQuarters(season){
    _playoffRevealToken++;
    const myToken = _playoffRevealToken;
    // defensively close any Key Moment overlay left open by a now-superseded reveal
    const staleOverlay = document.getElementById("keyMomentOverlay");
    if(staleOverlay && staleOverlay.classList.contains("open")){
      closeDialog(staleOverlay);
      staleOverlay.innerHTML = "";
    }
    if(!season.playoffs.made || !season.playoffs.rounds.length) return;
    const actions = document.getElementById("seasonActions");
    const rounds = season.playoffs.rounds;
    rounds.forEach(r=>{ r._revealedCount = 0; r._keyMomentChecked = false; });
    const baseChance = KEY_MOMENT_BASE_TRIGGER_CHANCE;
    function stillCurrent(){ return myToken === _playoffRevealToken; }

    function quarterLabel(q){
      if(typeof q.q!=="number") return q.q;
      const n = q.q, s = n%10, t = Math.floor(n/10)%10;
      const suf = t===1 ? "th" : s===1 ? "st" : s===2 ? "nd" : s===3 ? "rd" : "th";
      return n + suf;
    }

    function finalizeRound(roundIdx){
      if(!stillCurrent()) return;
      const r = rounds[roundIdx];
      const isSB = r.round==="Super Bowl";
      const wrap = document.querySelector(`[data-round-idx="${roundIdx}"]`);
      if(wrap){ wrap.dataset.roundState = "done"; if(!isSB) wrap.classList.add(r.won?"win":"loss"); }
      const titleEl = document.getElementById((isSB?"sbTitle-":"prTitle-")+roundIdx);
      if(titleEl) titleEl.textContent = isSB ? (`${roundDisplayLabel(r.round, season.year).toUpperCase()}${r.won?" — CHAMPIONS":""}`) : (`${svgEscape(roundDisplayLabel(r.round, season.year)).toUpperCase()}${r.won?" — WIN":" — SEASON OVER"}`);
      const finalEl = document.getElementById((isSB?"sbFinal-":"prFinal-")+roundIdx);
      if(finalEl) finalEl.innerHTML = `vs. the ${svgEscape(r.opponent)} — <b>${r.myScore}-${r.oppScore}</b>`;
      if(isSB){
        const boxEl = document.getElementById("sbBox-"+roundIdx);
        if(boxEl) boxEl.style.display = "";
      }
      const controls = document.getElementById("pqControls-"+roundIdx);
      if(controls) controls.innerHTML = "";
      // Only NOW -- with r.won at its final, possibly Key-Moment-flipped value -- does the
      // bracket actually move forward. This is what generates the next round (or the Super Bowl)
      // for the very first time; nothing about how far this run goes existed before this call.
      confirmPlayoffRound(season.playoffs, season);
      // Wave 1: checkpoint right here -- a completed playoff round is exactly the "clean boundary"
      // the existing once-per-season save already relied on (nothing mid-animation, no pending
      // choice), just happening far more often now. Reloading after this point must show the round
      // as already decided, never re-roll it -- season.playoffs.rounds already holds the final,
      // Key-Moment-adjusted result, so there is nothing left for a resume to recompute.
      saveActiveCareer({ phase:"playoffs", playoffRoundIndex: roundIdx });
      if(roundIdx+1 < rounds.length){ appendRoundBox(roundIdx+1); renderControlsFor(roundIdx+1); }
      else {
        // whole run is done -- see the Playoff Tree tab for the full bracket view (Round 29
        // removed the separate summary graphic that used to be drawn here).
        // The run has truly ended (won it all or got eliminated) -- only now do the Super Bowl
        // Champion award, the ring, and the reputation/GM/fan/popularity bumps that come with a
        // title actually land, since only now is any of that a real, played-out fact.
        finalizePlayoffOutcome(season);
        // Same timing logic applies to the league-wide bracket record -- only now is the player's
        // own conference outcome final. Refresh the Playoff Tree tab in place if it's already been
        // rendered (its initial render, before this run finished, would have shown "not decided yet").
        tryFinalizeLeaguePlayoffBracket(season);
        const playoffTreePanel = document.getElementById("tabpanel-playofftree");
        if(playoffTreePanel) playoffTreePanel.innerHTML = buildPlayoffTreeTabHTML(season);
        // The Standings tab's Conference Champion ("C") flag depends on the same just-updated
        // bracket, so it needs the same in-place refresh, at the same moment, or it stays stuck at
        // whatever it looked like when this season's card first rendered.
        const standingsPanel = document.getElementById("tabpanel-standings");
        if(standingsPanel) standingsPanel.innerHTML = buildStandingsTabHTML(season);
        // Continue/Play On only unlocks once the ENTIRE bracket (not just my own real path) is
        // final -- if the other conference (or the rest of my own, now-flat conference) still
        // needs manual "Simulate Next Round" clicks, actions stay disabled until that happens (see
        // simulateNextPlayoffTreeRound, which runs this exact same check after every click).
        if(actions && season.leagueStandings.playoffBracket){
          actions.classList.remove("pending-reveal");
          actions.querySelectorAll("button").forEach(b=> b.disabled=false);
        }
        // Wave 1: save immediately after the ring/awards/reputation bumps from a real title (or
        // the elimination itself) actually land -- see finalizePlayoffOutcome's own
        // season.postseasonFinalized guard for what stops this from ever double-applying even if
        // this code path were somehow re-entered.
        saveActiveCareer({ phase: season.leagueStandings.playoffBracket ? "decision" : "playoffs" });
      }
    }

    function revealOneQuarter(roundIdx, onDone){
      if(!stillCurrent()) return;
      const r = rounds[roundIdx];
      if(r._revealedCount>=r.quarters.length){ onDone(); return; }
      const q = r.quarters[r._revealedCount];
      const isSB = r.round==="Super Bowl";
      const holder = document.getElementById("pqQuarters-"+roundIdx);
      if(holder){
        const el = document.createElement("div");
        el.className = isSB ? "sb-q" : "pr-q";
        el.innerHTML = isSB
          ? `<div class="sb-q-label">${quarterLabel(q)}</div><div class="sb-q-score tabular">${q.myTotal}-${q.oppTotal}</div>`
          : `<div class="pr-q-label">${quarterLabel(q)}</div><div class="pr-q-score tabular">${q.myTotal}-${q.oppTotal}</div>`;
        holder.appendChild(el);
      }
      r._revealedCount++;
      if(r._revealedCount===6 && !r._keyMomentChecked && r.oppTendency && KeyMomentSettings.isEnabled()){
        r._keyMomentChecked = true;
        const elig = keyMomentScoreEligibility(r);
        if(elig>0 && Math.random() < baseChance*elig){
          triggerKeyMoment(season, r, roundIdx, ()=>{ if(stillCurrent()) onDone(); }, stillCurrent);
          return;
        }
      }
      onDone();
    }
    function simQuarter(roundIdx){
      revealOneQuarter(roundIdx, ()=>{
        if(!stillCurrent()) return;
        const r = rounds[roundIdx];
        if(r._revealedCount>=r.quarters.length) finalizeRound(roundIdx);
        else renderControlsFor(roundIdx);
      });
    }
    function simToHalf(roundIdx){
      const r = rounds[roundIdx];
      const target = Math.min(5, r.quarters.length);
      function step(){
        if(!stillCurrent()) return;
        if(r._revealedCount>=r.quarters.length){ finalizeRound(roundIdx); return; }
        if(r._revealedCount>=target){ renderControlsFor(roundIdx); return; }
        revealOneQuarter(roundIdx, step);
      }
      step();
    }
    function simToEnd(roundIdx){
      const r = rounds[roundIdx];
      function step(){
        if(!stillCurrent()) return;
        if(r._revealedCount>=r.quarters.length){ finalizeRound(roundIdx); return; }
        revealOneQuarter(roundIdx, step);
      }
      step();
    }
    function renderControlsFor(roundIdx){
      if(!stillCurrent()) return;
      const r = rounds[roundIdx];
      const wrap = document.querySelector(`[data-round-idx="${roundIdx}"]`);
      if(wrap) wrap.dataset.roundState = "active";
      const controls = document.getElementById("pqControls-"+roundIdx);
      if(!controls) return;
      const nextQ = r.quarters[r._revealedCount];
      const qBtnLabel = nextQ ? `Sim ${quarterLabel(nextQ)}` : "Sim Inning";
      controls.innerHTML = `
        <button type="button" class="btn btn-ghost pq-btn" id="pqSimQ-${roundIdx}">${qBtnLabel}</button>
        ${r._revealedCount<5 ? `<button type="button" class="btn btn-ghost pq-btn" id="pqSimHalf-${roundIdx}">Sim to 5th</button>` : ``}
        <button type="button" class="btn btn-primary pq-btn" id="pqSimEnd-${roundIdx}">Sim to Final Out</button>`;
      document.getElementById("pqSimQ-"+roundIdx).addEventListener("click", ()=> simQuarter(roundIdx));
      const halfBtn = document.getElementById("pqSimHalf-"+roundIdx);
      if(halfBtn) halfBtn.addEventListener("click", ()=> simToHalf(roundIdx));
      document.getElementById("pqSimEnd-"+roundIdx).addEventListener("click", ()=> simToEnd(roundIdx));
    }

    function appendRoundBox(roundIdx){
      const holder = document.getElementById("playoffRoundsHolder");
      if(holder) holder.insertAdjacentHTML("beforeend", playoffRoundBoxHtml(rounds[roundIdx], roundIdx, season.year));
    }

    appendRoundBox(0);
    renderControlsFor(0);
  }

  // Only called once the player's entire postseason run has actually finished playing out --
  // won the Super Bowl, or been eliminated at any round along the way. Before this point
  // season.awards could never have contained "Super Bowl Champion" and none of the ring-sized
  // reputation/GM/fan/popularity bumps had landed, no matter how the sim's internals had already
  // resolved things; this is where that becomes real, and where the DOM (badge row, front-office
  // widget, career trends/log tabs, header ticker) gets patched to finally reflect it.
  function finalizePlayoffOutcome(season){
    // Wave 1 (MASTER_REMEDIATION_SPEC.md, Section 3 invariant #7 / #14): this is the ONE place a
    // ring, a championship award, and the reputation/GM/fan/popularity bumps that come with it are
    // ever granted -- a stable idempotency flag stops it from ever applying twice for the same
    // season, which matters now that saves happen far more often mid-postseason (see the two new
    // saveActiveCareer() calls around this function's own call site in finalizeRound) than the old
    // once-per-season checkpoint ever risked.
    if(season.postseasonFinalized) return;
    season.postseasonFinalized = true;
    const playoffs = season.playoffs;
    // Pre-merger seasons (before Super Bowl I, played after the 1966 season) had no unified
    // championship game in real life -- the AFL and NFL each crowned their own champion via
    // their own Conference Championship round, full stop. Our bracket still simulates a
    // fictional cross-league finale for those years (relabeled "NFL-AFL Championship Game" --
    // see roundDisplayLabel/superBowlDisplayName) purely so a full playoff run always exists to
    // play through, but per the real history it grants no trophy: for year<1966 the actual
    // league title -- and the only thing that counts as a ring here -- is won by taking that
    // season's Conference Championship round, regardless of how the fictional finale afterward
    // turns out. From 1966 on, only an actual (correctly-numbered) Super Bowl win counts, same
    // as before.
    const wonRing = playoffs.wonSuperBowl;
    playoffs.wonRing = wonRing;
    if(wonRing){
      const ringLabel = "World Series Champion";
      playoffs.ringLabel = ringLabel;
      season.awards.push(ringLabel);
      career.totals.rings++;
      career.reputation = clamp(career.reputation + 6, 0, 100);
      career.gmRelationship = clamp((career.gmRelationship ?? 50) + 3, 0, 100);
      career.fanSupport = clamp((career.fanSupport ?? 50) + 8, 0, 100);
      career.leaguePopularity = clamp((career.leaguePopularity ?? 50) + 10, 0, 100);
      career.transactions.push(`${season.year}: Won the World Series with the ${season.teamName}.`);
      // Fixes "won the Super Bowl, got cut" reports: waiverCheck()'s cut chance always has a
      // 2% floor, with no exception for having just won a championship. Reuse the same
      // _cutShieldSeasons mechanic that already protects a newly-named captain (captainShield),
      // but grant it for 2 seasons instead of 1 -- a ring is a bigger deal than a captaincy, and
      // this keeps a cut technically still possible (age/performance can still overwhelm the
      // shield) rather than making champions flatly uncuttable, which would be its own kind of
      // unrealistic.
      career._cutShieldSeasons = Math.max(career._cutShieldSeasons||0, 2);
      // Balance Wave 7 (review-pass fix): season.playoffs.rounds[i].oppId is a real, stable team id
      // stamped on every one of the player's own rounds at simulation time (see stepConferenceBracket)
      // -- Wave 6's own "not done" note claiming this didn't exist was simply wrong; the actual gap
      // was that these two ledger events never threaded it through. The deciding round is the won
      // Conference Championship for a pre-Super-Bowl-era title (a fictional exhibition Super Bowl can
      // still follow it, per reachedTitleGameAndLost's own comment) or otherwise the real last round.
      const decidingRound = playoffs.rounds[playoffs.rounds.length-1];
      recordLedgerEvent("championship_won", { teamId: season.teamId, opponentId: decidingRound ? decidingRound.oppId : null, outcomeId: "super_bowl", metadata:{year: season.year, ringLabel} });
    } else if(reachedTitleGameAndLost(season)){
      const lastRound = playoffs.rounds[playoffs.rounds.length-1];
      recordLedgerEvent("championship_lost", { teamId: season.teamId, opponentId: lastRound ? lastRound.oppId : null, metadata:{year: season.year} });
    }
    checkAchievements();
    const badgesPanel = document.getElementById("tabpanel-badges");
    if(badgesPanel) badgesPanel.innerHTML = buildAchievementsTabHTML();
    const badgeRow = document.getElementById("badgeRow");
    if(badgeRow) badgeRow.innerHTML = season.awards.map(a=>`<span class="badge ${/Champion$/.test(a)||a==="MVP"?"gold":"good"}">${a}</span>`).join("");
    refreshFrontOfficeWidget();
    const trendsPanel = document.getElementById("tabpanel-trends");
    if(trendsPanel){ trendsPanel.innerHTML = buildTrendsTabHTML(); renderTrendsSparkline(); }
    const logPanel = document.getElementById("tabpanel-log");
    if(logPanel) logPanel.innerHTML = buildEventLogFeedHTML();
    updateHeaderCareerTicker();
  }

  function signedPercent(value){
    const rounded = Math.round((value-1)*100);
    return `${rounded>=0?"+":""}${rounded}%`;
  }

  function offseasonPlanMeta(plan){
    const groupLabel = { physical:"Physical", hitting:"Hitting", mental:"Mental" };
    const growth = Object.entries(plan.growth)
      .filter(([,value])=>value!==1)
      .map(([group,value])=>`${groupLabel[group]} growth ${signedPercent(value)}`);
    if(!growth.length) growth.push("All growth at base rate");
    const decline = Object.entries(plan.decline)
      .filter(([,value])=>value!==1)
      .map(([group,value])=>`${groupLabel[group]} decline ${signedPercent(value)}`);
    const riskDelta = Math.round((plan.injuryRisk-1)*100);
    return [
      ...growth,
      ...decline,
      `Injury risk ${riskDelta===0?"unchanged":fmtDelta(riskDelta)+"%"}`,
      `Wear ${plan.wearDelta===0?"unchanged":fmtDelta(plan.wearDelta)}`,
      `Chemistry ${fmtDelta(plan.chemistryDelta)}`,
      plan.id==="recovery" ? "Earned breakthrough unavailable" : "Can convert sustained momentum into a focused breakthrough",
    ];
  }

  function beginOffseason(){
    if(career.age+1>=durabilityAgeCap()){ nextSeason(); return; }
    // A player already serving a multi-season suspension or injury-leave absence isn't on a
    // roster and isn't training with a team -- advanceCareer() (called via nextSeason() below)
    // routes straight into renderSuspensionYear()/renderInjuryLeaveYear() for these years anyway,
    // so there's no season to apply a chosen program TO. Asking for one here would be incoherent
    // (e.g. "Chemistry Camp" while released) and would also skip past the absence-year screen
    // entirely, since this runs before advanceCareer()'s own suspension/injury-leave check does.
    if(career.suspensionSeasonsRemaining>0 || career.injuryLeaveSeasonsRemaining>0){ nextSeason(); return; }
    window.scrollTo(0, 0);
    const content = document.getElementById("careerContent");
    const lastSeason = career.seasonLog[career.seasonLog.length-1];
    const lastReport = lastSeason && lastSeason.developmentReport;
    const performanceLabel = lastReport ? lastReport.performance.label : "No performance grade recorded";
    const momentum = Math.round(career.breakthroughMomentum || 0);
    const choices = DEVELOPMENT_PLAN_LIST.map(plan=>`
      <button class="choice-btn offseason-plan-choice" type="button" data-development-plan="${plan.id}" id="developmentPlan-${plan.id}">
        <div class="cb-title">${svgEscape(plan.icon)} · ${svgEscape(plan.label)}</div>
        <div class="cb-sub">${svgEscape(plan.summary)}</div>
        <div class="offseason-plan-meta">${offseasonPlanMeta(plan).map(item=>`<span>${svgEscape(item)}</span>`).join("")}</div>
      </button>`).join("");
    content.innerHTML = eraWrap(decadeForYear(career.year+1), `
      <div class="ev-eyebrow">${career.year+1} Offseason · One program, one budget</div>
      <h3>Choose what gets the work.</h3>
      <p>You cannot maximize everything. This program applies to the season ahead and redirects development after that season is played. Performance is judged against what this exact build was expected to produce — stars do not receive free growth for merely playing like stars.</p>
      <div class="offseason-status">
        <div class="offseason-status-item"><span class="offseason-status-label">Last season</span><span class="offseason-status-value">${svgEscape(performanceLabel)}</span></div>
        <div class="offseason-status-item"><span class="offseason-status-label">Breakthrough momentum</span><span class="offseason-status-value">${momentum}/100</span></div>
        <div class="offseason-status-item"><span class="offseason-status-label">Body / chemistry</span><span class="offseason-status-value">${Math.round(career.wearAndTear||0)} wear · ${Math.round(career.teamChemistry??50)} chem</span></div>
      </div>
      <div class="event-choices">${choices}</div>
    `);
    content.querySelectorAll("[data-development-plan]").forEach(btn=>{
      btn.addEventListener("click", ()=>{
        const plan = developmentPlanFor(btn.dataset.developmentPlan);
        career.developmentPlan = plan.id;
        career.transactions.push(`${career.year+1}: Offseason program -- ${plan.label}.`);
        saveActiveCareer({ phase:"decision", eventId:"offseason_plan_selected" });
        nextSeason();
      });
    });
  }

  function nextSeason(){
    // QOL: whatever renders next (a fresh season card, or an interstitial life event) should
    // always start the player at the top of the page, not wherever they'd scrolled to reading the
    // previous season's tabs.
    window.scrollTo(0, 0);
    career.age++; career.year++; career.seasonNumber++;
    if(career._tradeRequestCooldown>0) career._tradeRequestCooldown--;
    advanceCareer();
  }

  /* ----- Fast-forward: "Simulate to Free Agency" -----
     Auto-advances through every purely-narrative interstitial (no real choice) between now and
     whatever the next GENUINE decision turns out to be -- most commonly free agency (a contract
     running out), but also an injury choice, an infraction, a locker-room choice, being waived, or
     reaching retirement eligibility. The classification rule is generic, not a hand-maintained list
     of event names: a screen with exactly ONE .choice-btn has nothing to actually decide (click it
     and move on); two or more is a real choice (stop, hand control back). This holds for every
     event in the game today (relationship/lifepath/rivalry/positive/org/suspension/injury-leave/
     expansion/trade beats are always single-button; injury/infraction/locker-room/waived/free-
     agency screens always offer 2+) and stays correct automatically if a future event is added,
     since it's a property of the rendered screen, not a name on a list.
     The season-card's own action row is a separate, explicit check below (it uses .btn, not
     .choice-btn) -- its real-decision signal is specifically the Retire button existing (available
     every season from age 29 on), not a raw button count, since "Request a trade" is a standing
     optional side-lever that sits next to Continue every season without ever forcing a decision. */
  let fastForwardActive = false;
  let fastForwardStepsLeft = 0;
  const FAST_FORWARD_MAX_STEPS = 500;
  function startFastForward(){
    if(fastForwardActive) return;
    fastForwardActive = true;
    fastForwardStepsLeft = FAST_FORWARD_MAX_STEPS;
    const banner = document.getElementById("fastForwardBanner");
    if(banner){ banner.classList.add("show"); banner.setAttribute("aria-hidden", "false"); }
    fastForwardStep();
  }
  function stopFastForward(){
    fastForwardActive = false;
    const banner = document.getElementById("fastForwardBanner");
    if(banner){ banner.classList.remove("show"); banner.setAttribute("aria-hidden", "true"); }
  }
  function scheduleFastForwardStep(){
    // A real (if tiny) delay, not a synchronous recursive loop -- yields back to the browser every
    // step so a long unbroken run can never freeze the tab, so the Stop button stays responsive
    // mid-run, and so count-up stat animations at least get a frame to start before the next swap.
    setTimeout(fastForwardStep, 20);
  }
  function fastForwardStep(){
    if(!fastForwardActive) return;
    if(fastForwardStepsLeft-- <= 0){ stopFastForward(); return; }

    // A Key Moment mini-game is a genuine, skill-based decision -- always stop for it, exactly
    // like every other real choice, never auto-resolved.
    const km = document.getElementById("keyMomentOverlay");
    if(km && km.classList.contains("open")){ stopFastForward(); return; }

    // Mid-reveal on a playoff round: jump straight to its end. simToEnd's own recursion (see
    // revealOneQuarter) already pauses itself the instant a Key Moment fires, so this can never
    // silently blow past one -- the overlay check above will catch it on the very next step.
    const simEndBtn = document.querySelector("#playoffRoundsHolder [id^='pqSimEnd-']:not([disabled])");
    if(simEndBtn){ simEndBtn.click(); scheduleFastForwardStep(); return; }

    const content = document.getElementById("careerContent");
    const choiceBtns = content ? Array.from(content.querySelectorAll(".event-choices .choice-btn")) : [];
    if(choiceBtns.length===1){ choiceBtns[0].click(); scheduleFastForwardStep(); return; }
    if(choiceBtns.length>=2){ stopFastForward(); return; }

    const actions = document.getElementById("seasonActions");
    if(actions && !actions.classList.contains("pending-reveal")){
      if(document.getElementById("retireBtn")){ stopFastForward(); return; }
      const goBtn = document.getElementById("continueBtn") || document.getElementById("playOnBtn");
      if(goBtn && !goBtn.disabled){ goBtn.click(); scheduleFastForwardStep(); return; }
    }

    // Nothing recognized -- the career just ended (Hall of Fame screen) or we've landed somewhere
    // fast-forward doesn't have a rule for. Stop rather than guess.
    stopFastForward();
  }

  function updateHeaderCareerTicker(){
    const el = document.getElementById("headerRight");
    if(!career){ el.textContent = "No builds logged yet"; return; }
    el.innerHTML = `<div class="career-ticker">
        <span><b>${svgEscape(career.name)}</b></span>
        <span>Age <b>${career.age}</b></span>
        <span class="tk-team">${teamNameAt(career.teamId, career.year)}</span>
        <span>Earned <b>${fmtMoney(career.totals.earnings)}</b></span>
        <span>Rings <b>${career.totals.rings}</b></span>
      </div>`;
  }

  function leagueAvgRatingForDecade(decade){
    // Season opsPlus is era-relative (computed against that era's own league OBP/SLG in
    // generateSeason / simulatePlayerSeasonStats), so a league-average regular is 100 in every
    // era by construction. ratingEdge = rating - 100.
    return 100;
  }

  // Round 32 item 5: factored out of hofVerdict() (which was hardcoded to career.totals/
  // career.seasonLog/career.exitReason) so the SAME real, already-tuned scoring can rank the
  // All-Time leaderboard's whole population (the player AND every rival, current or retired) --
  // one formula, not a second invented-from-scratch ranking metric. `seasonLog` entries need a
  // decade to weight the era baseline; a rival's own `.seasons` entries don't carry `.decade`
  // (see the Round 12 note on this elsewhere) so this derives it via decadeForYear(s.year) when
  // `.decade` itself is absent, unlike the original which assumed `.decade` was always there
  // (always true for the player's own seasonLog, never true for a rival's).
  function computeHofScore(totals, seasonLog, exitReason){
    const t = totals;
    const seasons = seasonLog.length;
    // Quality first: career rate (passer rating), then accolades, then a HARD-CAPPED nod to volume.
    // Sheer longevity piling up garbage-time yardage should never outrank real accolades and efficiency —
    // a 20-season .500 game manager is a "Longtime Regular", not a Hall of Famer, no matter the counting stats.
    // The bar itself is era-relative: 3,000 yards and a 78 rating meant something very different in the
    // dead-ball 1970s than in the 2020s, so "average for the era" is computed per-season and attempt-weighted
    // across the whole career, not a flat modern number applied to every decade.
    const careerRating = passerRating(t.comp, t.att, t.yards, t.td, t.int, t.bb); // career OPS+ index
    let baseWeighted = 0, baseAtt = 0;
    seasonLog.forEach(s=>{ const decade = s.decade || decadeForYear(s.year); baseWeighted += leagueAvgRatingForDecade(decade)*s.att; baseAtt += s.att; });
    const eraBaseline = baseAtt>0 ? baseWeighted/baseAtt : 100;
    // A Cooperstown-caliber bat is a career OPS+ around 130-145; a good regular ~105-115.
    const qualityScore = (careerRating-eraBaseline-6)*4;
    // t.proBowls = All-Star selections, t.allPros = Silver Slugger + All-MLB. Baseball stars rack
    // these up (10+ All-Star nods is common for an inner-circle career), so the weights are lower
    // than the QB values were.
    const accoladeScore = t.rings*22 + t.mvps*30 + t.allPros*10 + t.proBowls*3;
    const longevityScore = Math.min(seasons,16)*1.5;
    // Counting stats, hard-capped so a compiler can't outrank real peak value: career hits (comp),
    // home runs (td), RBI.
    const volumeScore = clamp(t.comp/350 + t.td*0.06 + (t.rbi||0)/260, 0, 35);
    const score = qualityScore + accoladeScore + longevityScore + volumeScore;

    if(exitReason==="waived" && score<60) return {score, tier:"Out of the League", note:`Released after ${seasons} season${seasons===1?"":"s"} that never quite came together. The phone stopped ringing.`};

    // Top tiers also gate on a minimum sample size — real Hall of Fame cases are built on sustained
    // excellence, not one hot short stretch. Tiers are checked highest-first; a gated tier that fails
    // the season requirement simply falls through to the next one down.
    const TIERS = [
      // minRingsRoute is a second, independent way into First-Ballot: winner-take-all Pro Bowl
      // slots mean an elite player can genuinely lose out on selections to other elite QBs the
      // very seasons he wins it all, so a 3-Pro-Bowl floor alone can wrongly demote a multi-ring
      // champion (a real reported case: 4 rings in 11 seasons, only Hall of Famer). Real-life
      // multi-ring starters are essentially never a First-Ballot snub over a Pro Bowl technicality.
      { min:150, seasons:10, minProBowls:4, minRingsRoute:3, tier:"First-Ballot Hall of Famer", note:"The bronze plaque in Cooperstown is a formality at this point." },
      { min:100, seasons:8,  minProBowls:2, tier:"Hall of Famer", note:"A career the writers won't be able to leave off the ballot." },
      { min:65,  seasons:0,  minProBowls:0, tier:"Hall of Very Good", note:"A borderline case — the kind that sparks arguments every January." },
      { min:35,  seasons:0,  minProBowls:0, tier:"Longtime Regular", note:"Not a legend, but a team could pencil him into the lineup for a long time." },
      { min:12,  seasons:0,  minProBowls:0, tier:"Journeyman", note:"A real big-league career, bouncing between clubhouses and bench roles." },
      { min:-Infinity, seasons:0, minProBowls:0, tier:"Cup of Coffee", note:"The uniform barely got dirty, but you made it to the show." },
    ];
    for(const tier of TIERS){
      const accoladeGateMet = t.proBowls>=(tier.minProBowls||0) || (tier.minRingsRoute && t.rings>=tier.minRingsRoute);
      if(score>=tier.min && seasons>=tier.seasons && accoladeGateMet){
        // "Hall of Famer" only requires ONE Pro Bowl to gate into -- a career can clear the 100-point
        // bar mostly on longevity/volume score with barely any real accolades to show for it. That's
        // exactly the "hall of fame while being not great" case: the tier is real (the math says so),
        // but calling it a lock ("voters won't be able to leave off the ballot") oversells a résumé
        // that would actually be argued about for years. First-Ballot is unaffected -- its 3-Pro-Bowl
        // floor already screens out the thin cases this is checking for.
        if(tier.tier==="Hall of Famer" && t.proBowls<=2 && t.allPros===0 && t.mvps===0 && t.rings===0){
          return { score, tier: tier.tier, note:"A compiler's case more than a slam dunk — a long, steady résumé without a signature peak or a stacked trophy case. The kind of induction that's still getting argued about after the bust goes up." };
        }
        return { score, ...tier };
      }
    }
    return { score, ...TIERS[TIERS.length-1] };
  }
  function hofVerdict(){
    return computeHofScore(career.totals, career.seasonLog, career.exitReason);
  }
  // A single tier's base HOF-induction likelihood if this career ended exactly as-is today.
  const HOF_TIER_BASE_PCT = {
    "First-Ballot Hall of Famer": 99, "Hall of Famer": 80, "Hall of Very Good": 45,
    "Longtime Regular": 15, "Journeyman": 4, "Cup of Coffee": 1, "Out of the League": 1,
  };
  // "Likelihood of making the Hall of Fame" for a STILL-ACTIVE player is necessarily an estimate,
  // not a verdict -- their résumé is still being written. Base rate comes from the exact same tier
  // computeHofScore would already assign if their career stopped today; an active, young player
  // with a real case already (score>40) gets a modest upward nudge for the seasons still ahead of
  // him, capped so it can never turn a thin résumé into a false lock on its own.
  function hofChancePct(totals, seasonLog, exitReason, age, retired){
    const verdict = computeHofScore(totals, seasonLog, exitReason);
    let pct = HOF_TIER_BASE_PCT[verdict.tier] ?? 5;
    if(!retired && age!=null){
      const youthBoost = clamp((30-age)*1.2, 0, 18) * (verdict.score>40 ? 1 : 0.25);
      pct = clamp(pct + youthBoost, 1, 99);
    }
    return Math.round(pct);
  }

  /* ----- the Hall of Fame retrospective: how history remembers this player ----- */
  function buildHofNarrative(verdict){
    const t = career.totals;
    const seasons = career.seasonLog.length;
    const first = career.seasonLog[0];
    const peak = career.peakSeason || first;
    const last = career.seasonLog[seasons-1];
    const paras = [];

    const safeName = svgEscape(career.name), safeCollege = svgEscape(career.college);
    const originLine = career.slot.round===0
      ? `Nobody called ${safeName}'s name on draft weekend in ${career.draftYear}. Out of ${safeCollege}, he signed with the ${teamNameAt(career.draftTeamId, career.draftYear)} as a non-drafted free agent and had to fight for a roster spot in the minors.`
      : career.slot.round===1
        ? `The ${teamNameAt(career.draftTeamId, career.draftYear)} spent a first-round pick on ${safeName} in the ${career.draftYear} draft, betting a big signing bonus on the bat scouts had raved about since ${safeCollege}.`
        : `A ${career.slot.label.toLowerCase()} selection in ${career.draftYear} out of ${safeCollege}, ${safeName} climbed the farm system with modest expectations and a chip on his shoulder.`;
    paras.push(originLine);

    const peakLine = `The season people still cite is <b>${peak.year}</b>: ${peak.td} home runs, ${peak.rbi!=null?peak.rbi+' RBI, ':''}a ${(peak.avg!=null?peak.avg:0).toFixed(3).replace(/^0/,'')} average and a ${Math.round(peak.rating)} OPS+ for the ${peak.teamName}${peak.awards.length?` \u2014 the year he ${/MVP/.test(peak.awards.join(' '))?'ran away with the MVP':'earned '+peak.awards.slice(0,2).join(' and ')}`:''}. It's the year that told the league who he really was.`;
    paras.push(peakLine);

    if(t.rings>0){
      const sbSeason = career.seasonLog.find(s=> s.playoffs && s.playoffs.wonRing);
      paras.push(`The ring \u2014 the one that ends every "yeah, but" argument \u2014 came in <b>${sbSeason?sbSeason.year:peak.year}</b>. World Series montages still open with that October.`);
    } else if(t.mvps>0){
      paras.push(`An MVP season without a World Series ring to match it \u2014 the kind of r\u00e9sum\u00e9 line that fuels sports-radio arguments every winter.`);
    } else if(career.transactions.length>3){
      paras.push(`It wasn't a straight line: ${career.transactions.length-1} transactions moved him from clubhouse to clubhouse, a journeyman's path more than a franchise cornerstone's.`);
    }

    // A legendary/major life event the player SURVIVED (as opposed to one that outright ended the
    // career, which the exit-reason block below already covers on its own) gets its own line --
    // "here's a Hall of Famer with an MVP season" reads very differently from "here's a Hall of
    // Famer with an MVP season AND a federal animal-fighting investigation on his permanent
    // record," and the retrospective should say so instead of quietly omitting it. Legendary rare
    // events are preferred over ordinary infractions when both exist, since they're the ones
    // actually worth a whole extra sentence of history.
    if(career.lifeEventLog && career.lifeEventLog.length){
      const survivedEvents = career.lifeEventLog.filter(e=>
        (e.severity==="career-multi" || e.severity==="major" || e.legendary) &&
        !(career.exitReason==="banned" && career._bannedEventTitle===e.title));
      if(survivedEvents.length){
        const notable = survivedEvents.find(e=>e.legendary) || survivedEvents[survivedEvents.length-1];
        paras.push(`No retrospective is complete without <b>${notable.year}</b>: ${notable.title.toLowerCase()}. It follows him everywhere his stats do — the first line of every "wait, didn't he also..." conversation about this career.`);
      }
    }

    // Every branch here has to be an ACTUAL reason the career stopped -- career.exitReason is set
    // at several very different trigger points (waived, aged out, banned by the league, a
    // career-ending injury, or a genuine voluntary retirement), and narrating a forced exit as if
    // it were a choice ("walked away on his own terms") is exactly backwards. This used to only
    // special-case "waived" and "age" and silently folded banned/injury exits into the same
    // voluntary-retirement line as an actual retirement -- fixed by giving each its own line, and
    // naming the actual event/injury where the game already tracked one (see _bannedEventTitle /
    // _careerEndingInjuryName, stashed at the moment each one happens).
    let exitLine;
    if(career.exitReason==="waived") exitLine = `The ending wasn't a farewell tour. The ${last.teamName} released him after the ${last.year} season, and no other club called. ${seasons} seasons, no farewell tour.`;
    else if(career.exitReason==="age") exitLine = `He played until his body physically wouldn't let him play anymore \u2014 a ${seasons}-season marathon that outlasted three generations of teammates.`;
    else if(career.exitReason==="banned"){
      const title = career._bannedEventTitle;
      exitLine = title
        ? `There was no farewell tour to cut short — ${title.toLowerCase()} ended it. The league banned him outright in ${career.year}, and whatever he had left in the tank never got to show up on a stat sheet.`
        : `There was no farewell tour to cut short. The league banned him outright in ${career.year}, and whatever he had left in the tank never got to show up on a stat sheet.`;
    }
    else if(career.exitReason==="injury"){
      const injName = career._careerEndingInjuryName;
      exitLine = injName
        ? `The body made the call a front office never had to: a ${injName.toLowerCase()} that doctors agreed he wasn't coming back from. ${seasons} seasons, ended by a diagnosis instead of a decision.`
        : `The body made the call instead of a front office or a calendar — an injury he never came back from, ${seasons} seasons in.`;
    }
    else {
      // A genuine voluntary retirement still reads two different ways depending on how the last
      // season actually went -- walking away while still playing well above league average is a
      // much rarer, more deliberate exit than walking away after a visible decline, so it gets its
      // own line instead of one flat sentence covering both.
      const lastEdge = last.rating - leagueAvgRatingForDecade(last.decade);
      exitLine = lastEdge >= 6
        ? `He walked away at the top of his game after the ${last.year} season — ${career.age} years old and still hitting well above league average. No decline to point to, no club pushing him out. He just decided he was done.`
        : `He walked away on his own terms after the ${last.year} season, ${career.age} years old, leaving the game before the game could leave him.`;
    }
    paras.push(exitLine);

    paras.push(`<span>Around the game now, the verdict is settled: <b>${verdict.tier}</b>. ${verdict.note}</span>`);
    paras[paras.length-1] = paras[paras.length-1]; // legacy paragraph gets special styling via class below

    return paras;
  }

  /* ----- trophy case: a visual read on the totals-grid numbers, one item per ring/MVP season
     (rare enough to name the year) and one grouped badge each for All-Pro/Pro Bowl counts (too
     numerous in a long career to list individually). ----- */
  function buildTrophyCaseHTML(){
    const t = career.totals;
    if(t.rings===0 && t.mvps===0 && t.allPros===0 && t.proBowls===0){
      return `<p class="trophy-empty">No hardware \u2014 that's alright, not every career needs a trophy case.</p>`;
    }
    const items = [];
    career.seasonLog.forEach(s=>{
      if(s.playoffs && s.playoffs.wonRing){
        const label = (s.playoffs.ringLabel || "World Series Champion").replace(/\s(?=\S+$)/, "<br>");
        items.push(`<div class="trophy-item"><div>${TROPHY_ICONS.ring}</div><div class="trophy-year">${s.year}</div><div class="trophy-label">${label}</div></div>`);
      }
      if(s.awards.includes("MVP")){
        items.push(`<div class="trophy-item"><div>${TROPHY_ICONS.mvp}</div><div class="trophy-year">${s.year}</div><div class="trophy-label">MVP</div></div>`);
      }
    });
    if(t.allPros>0) items.push(`<div class="trophy-item badge-count"><div>${TROPHY_ICONS.allpro}</div><div class="trophy-year">${t.allPros}\u00d7</div><div class="trophy-label">Silver Slugger</div></div>`);
    if(t.proBowls>0) items.push(`<div class="trophy-item badge-count"><div>${TROPHY_ICONS.probowl}</div><div class="trophy-year">${t.proBowls}\u00d7</div><div class="trophy-label">All-Star</div></div>`);
    return `<div class="trophy-case">${items.join("")}</div>`;
  }

  function finishCareer(){
    clearActiveCareer();
    checkAchievements(); // catches career-ending-only conditions (e.g. Loyal to the Death) now that exitReason is set
    const verdict = hofVerdict();
    SFX.retirement(verdict.tier);
    const best = loadBest();
    if(!best.careerScoreValue || verdict.tier !== best.careerVerdict){
      // keep the most prestigious verdict seen (rough ordinal by tier order)
      const order = ["Out of the League","Cup of Coffee","Journeyman","Longtime Regular","Hall of Very Good","Hall of Famer","First-Ballot Hall of Famer"];
      const prevIdx = order.indexOf(best.careerVerdict);
      const curIdx = order.indexOf(verdict.tier);
      if(curIdx>prevIdx){ best.careerVerdict = verdict.tier; saveBest(best); }
    }

    const hero = document.getElementById("hofHero");
    // Same fix as buildHofNarrative's exitLine below: banned/injury are forced exits, not a
    // retirement, and used to silently collapse into "retired on his own terms" here too.
    const EXIT_TAGS = { waived:"released, not retired", age:"played it out to the end",
      banned:"banned from the league", injury:"career-ending injury", retired:"retired on his own terms" };
    const exitTag = EXIT_TAGS[career.exitReason] || "retired on his own terms";
    hero.innerHTML = `
      <div class="hh-eyebrow">${svgEscape(career.name)} · ${svgEscape(positionLabel(career.position))} · out of ${svgEscape(career.college)} · ${svgEscape(career.hometown.city)}, ${svgEscape(career.hometown.state)}</div>
      <div class="hh-verdict">${verdict.tier}</div>
      <div class="hh-sub">${career.seasonLog.length}-season career · ${career.draftYear}–${career.year} · ${exitTag}<br>${verdict.note}</div>`;

    const narrative = career.seasonLog.length ? buildHofNarrative(verdict) : [];
    document.getElementById("hofNarrative").innerHTML = narrative.map((p,i)=> `<p${i===narrative.length-1?' class="legacy"':''}>${p}</p>`).join("");

    const t = career.totals;
    const cardTeams = [];
    const cardTeamIds = [];
    career.seasonLog.forEach(s=>{
      if(cardTeams[cardTeams.length-1]!==s.teamName){ cardTeams.push(s.teamName); cardTeamIds.push(s.teamId); }
    });
    const trophyEntry = {
      id: `${Date.now()}_${Math.round(Math.random()*1e6)}`,
      name: career.name, college: career.college, position: career.position,
      hometownCity: career.hometown.city, hometownState: career.hometown.state,
      decade: career.decade, draftYear: career.draftYear, finalYear: career.year,
      verdict: verdict.tier, seasons: career.seasonLog.length, exitReason: career.exitReason,
      games: t.games, yards: t.yards, td: t.td, int: t.int, sacks: t.sacks,
      rushYards: t.rushYards, rushTd: t.rushTd, proBowls: t.proBowls, allPros: t.allPros,
      mvps: t.mvps, rings: t.rings, earnings: t.earnings,
      rating: passerRating(t.comp, t.att, t.yards, t.td, t.int),
      peakOverall: Math.max(0, ...career.seasonLog.map(s=>s.overall||0)),
      teams: cardTeams,
      teamIds: cardTeamIds,
      achievements: (career.achievements ? Object.keys(career.achievements.unlocked).filter(k=>career.achievements.unlocked[k]) : []),
      draftLine: career.transactions[0] || null,
      relationshipLine: career.relationship
        ? `${career.relationship.status==="married"?"Married to":"Dating"} ${career.relationship.partnerName}, the ${career.relationship.partnerType}.`
        : null,
      completedAt: Date.now(),
    };
    saveTrophyRoomEntry(trophyEntry);
    lastFinishedCareerEntry = trophyEntry;
    // Multiplayer Parallel Universe Mode (MULTIPLAYER_MODE_SPEC.md sections 6/12.5): a
    // multiplayer-stamped career, on finishing, gets a small scoring-input summary (built from
    // exactly the same fields trophyEntry above already computed -- no re-derivation) persisted
    // under its OWN key (clearActiveCareer() already removed the in-progress save at the top of
    // this function, so this can't just live there) and offered as a copyable Result Code. Restores
    // real randomness and drops the in-memory multiplayer context -- the match's own work in THIS
    // browser session is done; anything after this point (Play Again, a new solo combine) is
    // ordinary solo play.
    const mpPanel = document.getElementById("mpResultPanel");
    if(career.multiplayerMatchId){
      const summary = {
        rings: trophyEntry.rings, mvps: trophyEntry.mvps, allPros: trophyEntry.allPros, proBowls: trophyEntry.proBowls,
        peakOverall: trophyEntry.peakOverall, rating: trophyEntry.rating,
        yards: trophyEntry.yards, td: trophyEntry.td, games: trophyEntry.games,
        achievementCount: trophyEntry.achievements.length, earnings: trophyEntry.earnings,
      };
      const resultCode = encodeResultCode({
        matchId: career.multiplayerMatchId, slot: career.multiplayerSlot,
        name: career.name, decade: career.decade, summary,
      });
      const resultKey = multiplayerResultKey(career.multiplayerMatchId, career.multiplayerSlot);
      try{
        if(store) store.setItem(resultKey, JSON.stringify({ resultCode, name: career.name, decade: career.decade, finishedAt: Date.now() }));
      }catch(e){}
      if(mpPanel){
        mpPanel.style.display = "block";
        mpPanel.innerHTML = `
          <div class="section-label">Multiplayer · Private Match Result</div>
          <p class="mode-help">This career is part of a multiplayer match. Share this code with your opponent — once you both have each other's, compare them from the Multiplayer menu.</p>
          <div class="mp-code-display" id="mpFinishCodeText" style="font-size:0.85rem; word-break:break-all; user-select:all;">${svgEscape(resultCode)}</div>
          <div class="menu-actions" style="margin-top:0.75rem;"><button class="btn btn-ghost" id="mpFinishCopyBtn" type="button">Copy Result Code</button></div>`;
        const copyBtn = document.getElementById("mpFinishCopyBtn");
        if(copyBtn) copyBtn.addEventListener("click", ()=> copyText(resultCode, copyBtn));
      }
    } else if(mpPanel){
      mpPanel.style.display = "none";
      mpPanel.innerHTML = "";
    }
    restoreRandom();
    currentMultiplayerContext = null;
    const careerRecBy = {}; checkCareerRecords(t).forEach(r=> careerRecBy[r.key]=r);
    document.getElementById("totalsGrid").innerHTML = [
      ["Seasons", career.seasonLog.length],
      ["Career Earnings", fmtMoney(t.earnings)],
      ["Pass Yards", t.yards.toLocaleString(), careerRecBy.yards],
      ["Touchdowns", t.td, careerRecBy.td],
      ["Interceptions", t.int],
      ["Sacks Taken", t.sacks],
      ["Rush Yards", t.rushYards.toLocaleString()],
      ["Rush TDs", t.rushTd],
      ["Pro Bowls", t.proBowls],
      ["All-Pros", t.allPros],
      ["MVPs", t.mvps],
      ["Rings", t.rings],
    ].map(([label,val,rec])=>`<div class="totals-tile"><div class="tt-label">${label}</div><div class="tt-value tabular">${val}</div>${rec?recordBadgeHtml(rec):""}</div>`).join("");

    document.getElementById("trophyCase").innerHTML = buildTrophyCaseHTML();

    const table = document.getElementById("careerTable");
    table.innerHTML = `<thead><tr><th>Year</th><th>Age</th><th>Team</th><th>G</th><th>Comp/Att</th><th>Pct</th><th>Yds</th><th>TD</th><th>INT</th><th>Rating</th><th>Rush</th><th>Record</th><th>Team Rec</th><th>Playoffs</th><th>Pay</th><th>Awards</th></tr></thead>
      <tbody>${career.seasonLog.map(s=>`<tr>
        <td>${s.year}</td><td>${s.age}</td><td class="team-cell">${s.teamName}</td><td>${s.games}</td>
        <td>${s.comp}/${s.att}</td><td>${(s.pct*100).toFixed(1)}%</td><td>${s.yards.toLocaleString()}</td>
        <td>${s.td}</td><td>${s.int}</td><td>${s.rating}</td>
        <td>${s.rushAtt>0 ? s.rushYards.toLocaleString()+" / "+s.rushTd+"TD" : "—"}</td>
        <td>${recordLine(s.wins, s.losses, s.ties||0)}</td><td>${recordLine(s.teamWins, s.teamLosses, s.teamTies||0)}</td>
        <td>${s.playoffs.made ? "Seed #"+s.playoffs.seed+(s.playoffs.wonRing?" — Champs":"") : "Missed"}</td>
        <td>${fmtMoney(s.contractApy)}</td><td>${s.awards.join(", ")||"—"}</td>
      </tr>`).join("")}</tbody>`;

    showScreen("careerSummary");
  }

  document.getElementById("viewCardBtn").addEventListener("click", ()=>{
    if(lastFinishedCareerEntry) openBaseballCard(lastFinishedCareerEntry);
  });

  document.getElementById("shareCareerBtn").addEventListener("click", ()=>{
    const verdict = hofVerdict();
    const t = career.totals;
    const lines = [
      `GRIDIRON LAB — Career Recap`,
      `${career.seasonLog.length} seasons (${career.draftYear}–${career.year}), starting decade ${career.decade}`,
      `Verdict: ${verdict.tier}`,
      `${t.yards.toLocaleString()} yds, ${t.td} TD, ${t.int} INT, ${t.proBowls} Pro Bowls, ${t.allPros} All-Pros, ${t.mvps} MVP, ${t.rings} ring(s)`,
      `Career earnings: ${fmtMoney(t.earnings)}`,
      window.location.href,
    ];
    copyText(lines.join("\n"), document.getElementById("shareCareerBtn"));
  });
  document.getElementById("newCareerBtn").addEventListener("click", ()=>{ resetToSoloSession(); chosenDecade=null; chosenDecadeWasRandom=false; renderDecadeGrid(); renderIdentityPanel(); showScreen("careerSetup"); });
  document.getElementById("careerMenuBtn").addEventListener("click", ()=>{ renderBestStrip(); renderLastBuildStrip(); renderActiveCareerStrip(); renderMultiplayerMatchesStrip(); updateHeaderCareerTicker(); showScreen("menu"); });

  /* ================= Admin / testing panel (V10.1) =================
     A visible, always-on debug panel for browsing the full player and event data and for firing
     any event on demand against the live career, instead of waiting on random rolls to see it.
     Deliberately reuses the exact production render/resolve functions (renderInfractionEvent,
     renderPositiveEvent, renderOrgEvent, resolveInfraction via its own buttons, triggerKeyMoment)
     rather than a separate mock path, so what you see here is exactly what a real playthrough
     would produce -- this is a window into the live game state, not a simulation of it. */
  const ADMIN_EVENT_POOLS = {
    infraction: { label:"Infractions", list: INFRACTION_EVENTS, kind:"infraction" },
    rare: { label:"Rare Easter Eggs", list: RARE_EVENTS, kind:"infraction" },
    positive: { label:"Positive", list: POSITIVE_EVENTS, kind:"positive" },
    org: { label:"Organization", list: ORG_EVENTS, kind:"org" },
    locker: { label:"Locker Room", list: LOCKER_ROOM_EVENTS, kind:"locker" },
    rivalry: { label:"Rivalry", list: RIVALRY_EVENTS, kind:"rivalry" },
  };
  const ADMIN_PLAYER_COLUMNS = [
    { key:"name", label:"Name" }, { key:"team", label:"Team" }, { key:"years", label:"Years" }, { key:"decade", label:"Decade" },
    ...ATTR_KEYS.map(k=>({ key:k, label:k })),
  ];
  const adminState = { tab:"players", search:"", decadeFilter:"all", sortKey:"name", sortDir:"asc", buildSnapshot:null };

  function adminEventRangeText(ev, kind){
    if(kind==="infraction"){
      const parts = [];
      parts.push(`sev: ${ev.severity}`);
      if(Array.isArray(ev.repHit)) parts.push(`rep ${fmtDelta(ev.repHit[0])}..${fmtDelta(ev.repHit[1])}`);
      else if(typeof ev.repHit==="number") parts.push(`rep ${fmtDelta(ev.repHit)}`);
      if(ev.suspensionGames) parts.push(`${ev.suspensionGames[0]}-${ev.suspensionGames[1]} games`);
      if(ev.suspensionSeasons) parts.push(`${ev.suspensionSeasons[0]}-${ev.suspensionSeasons[1]} seasons`);
      if(ev.mitigable) parts.push("mitigable");
      if(ev.minYear) parts.push(`since ${ev.minYear}`);
      if(ev.legendary) parts.push("★ rare");
      return parts.join(" · ");
    }
    if(kind==="positive"){
      const parts = [`rep +${ev.repDelta[0]}..+${ev.repDelta[1]}`];
      if(ev.boosts && ev.boosts.length) parts.push(ev.boosts.map(b=>`${b.key} +${b.delta} (${ev.seasons}s)`).join(", "));
      return parts.join(" · ");
    }
    if(kind==="locker"){
      const parts = [`${ev.choices.length} choices`];
      if(ev.minAge) parts.push(`age ${ev.minAge}+`);
      ev.choices.forEach(c=> parts.push(`"${c.label}": good ${fmtDelta(c.goodDelta[0])}..${fmtDelta(c.goodDelta[1])} (${Math.round(c.goodChance*100)}%) / bad ${fmtDelta(c.badDelta[0])}..${fmtDelta(c.badDelta[1])}`));
      return parts.join(" · ");
    }
    if(kind==="rivalry"){
      return ev.tone==="toxic" ? "toxic · rep -1..-6 · pop +3..+10 · rivalry +6" : "respect · rep +2..+7 · pop +2..+6 · rivalry -4";
    }
    // org
    const parts = [];
    if(Array.isArray(ev.repDelta)) parts.push(`rep ${fmtDelta(ev.repDelta[0])}..${fmtDelta(ev.repDelta[1])}`);
    else if(ev.repDelta) parts.push(`rep ${fmtDelta(ev.repDelta)}`);
    if(ev.strengthDelta && (ev.strengthDelta[0]!==0 || ev.strengthDelta[1]!==0)) parts.push(`grade ${fmtDelta(ev.strengthDelta[0])}..${fmtDelta(ev.strengthDelta[1])}`);
    if(ev.gmDelta) parts.push(`gm ${fmtDelta(ev.gmDelta[0])}..${fmtDelta(ev.gmDelta[1])}`);
    if(ev.resetGM) parts.push("gm: reset");
    if(ev.schemeChangeChance) parts.push(`${Math.round(ev.schemeChangeChance*100)}% new scheme`);
    if(ev.setFlag) parts.push(`flag: ${ev.setFlag}`);
    return parts.join(" · ") || "narrative only";
  }
  function adminFireEvent(poolKey, id){
    const pool = ADMIN_EVENT_POOLS[poolKey];
    const ev = pool.list.find(e=>e.id===id);
    if(!ev || !career) return;
    closeAdminOverlay();
    showScreen("career");
    if(pool.kind==="infraction") renderInfractionEvent(ev);
    else if(pool.kind==="positive") renderPositiveEvent(ev);
    else if(pool.kind==="locker") renderLockerRoomEvent(ev);
    else if(pool.kind==="rivalry"){
      const rival = (topActiveRivalry(0)||{}).rival || (career.leagueRivals||[]).find(r=>!r.retired);
      if(rival) renderRivalryEvent(ev, rival);
    }
    else renderOrgEvent(ev);
  }
  function renderAdminPlayersTab(){
    const search = adminState.search.trim().toLowerCase();
    let rows = QBS.filter(p=>{
      if(adminState.decadeFilter!=="all" && p.decade!==adminState.decadeFilter) return false;
      if(search && !p.name.toLowerCase().includes(search) && !p.team.toLowerCase().includes(search)) return false;
      return true;
    });
    rows = rows.slice().sort((a,b)=>{
      const k = adminState.sortKey;
      let av, bv;
      if(ATTR_KEYS.includes(k)){ av=a.r[k]; bv=b.r[k]; }
      else { av=a[k]; bv=b[k]; }
      if(typeof av==="string") return adminState.sortDir==="asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      return adminState.sortDir==="asc" ? av-bv : bv-av;
    });
    const headerHtml = ADMIN_PLAYER_COLUMNS.map(c=>
      `<th data-sort="${c.key}" class="${adminState.sortKey===c.key?"sorted":""}">${svgEscape(c.label)}${adminState.sortKey===c.key?(adminState.sortDir==="asc"?" ▲":" ▼"):""}</th>`
    ).join("");
    const bodyHtml = rows.map(p=>`<tr>
      <td>${svgEscape(p.name)}</td><td>${svgEscape(p.team)}</td><td>${svgEscape(p.years)}</td><td>${svgEscape(p.decade)}</td>
      ${ATTR_KEYS.map(k=>`<td>${p.r[k]}</td>`).join("")}
    </tr>`).join("");
    return `
      <div class="admin-controls">
        <input type="text" id="adminPlayerSearch" placeholder="Search name or team…" value="${svgEscape(adminState.search)}">
        <select id="adminDecadeFilter">
          <option value="all">All decades</option>
          ${DECADES.map(d=>`<option value="${d}" ${adminState.decadeFilter===d?"selected":""}>${d}</option>`).join("")}
        </select>
        <span class="admin-count">${rows.length} of ${QBS.length} players · click a column to sort</span>
      </div>
      <div class="admin-table-wrap"><table class="admin-table"><thead><tr>${headerHtml}</tr></thead><tbody>${bodyHtml || `<tr><td colspan="${ADMIN_PLAYER_COLUMNS.length}" class="admin-empty">No players match.</td></tr>`}</tbody></table></div>`;
  }
  function renderAdminEventsTab(){
    const disabledAttr = career ? "" : "disabled";
    const sections = Object.entries(ADMIN_EVENT_POOLS).map(([poolKey, pool])=>`
      <div class="admin-event-section">
        <h3>${svgEscape(pool.label)} <span class="admin-count">(${pool.list.length})</span></h3>
        ${pool.list.map(ev=>{
          let flavor = "";
          try{ flavor = typeof ev.flavor==="function" ? ev.flavor("2020s") : ""; }catch(e){ flavor = "(flavor text needs live career context)"; }
          return `
          <div class="admin-event-row">
            <div class="ae-main">
              <div class="ae-title">${svgEscape(ev.title)} <span class="admin-count">#${svgEscape(ev.id)}</span></div>
              <div class="ae-meta">${adminEventRangeText(ev, pool.kind)}</div>
              <div class="ae-flavor">${svgEscape(flavor)}</div>
            </div>
            <button type="button" class="admin-fire-btn" data-pool="${poolKey}" data-id="${ev.id}" ${disabledAttr}>Force fire</button>
          </div>`;
        }).join("")}
      </div>`).join("");
    return `${career ? "" : `<div class="admin-note">Start a career to force-fire events — they render exactly like a real roll, right on the live career screen.</div>`}${sections}`;
  }
  function renderAdminLiveTab(){
    if(!career) return `<div class="admin-empty">No active career. Start one from the menu, then reopen this tab.</div>`;
    const c = career;
    const schemeId = c.teamScheme ? c.teamScheme[c.teamId] : null;
    const scheme = SCHEMES.find(s=>s.id===schemeId);
    const stats = [
      ["Name", c.name], ["Age", c.age], ["Year", c.year], ["Decade", decadeForYear(c.year)],
      ["Team", teamNameAt(c.teamId, c.year)], ["Reputation", c.reputation], ["Team Grade", c.teamStrength],
      ["GM Relations", c.gmRelationship], ["Fan Support", c.fanSupport], ["League Popularity", c.leaguePopularity],
      ["Scheme", scheme ? scheme.name : "—"],
      ["Contract", `${fmtMoney(c.contract.apy)}/yr (${c.contract.tier}, ${c.contract.years}y)`],
      ["Seasons w/ team", c.seasonsWithTeam], ["Trade requests used", c._tradeRequestsUsed||0],
      ["Banned", c.banned ? "yes" : "no"], ["Suspension seasons left", c.suspensionSeasonsRemaining||0],
    ];
    const statsHtml = stats.map(([label,val])=>`<div class="admin-live-stat"><div class="als-label">${svgEscape(label)}</div><div class="als-value">${svgEscape(String(val))}</div></div>`).join("");
    let jsonText = "";
    try{ jsonText = JSON.stringify(career, null, 2); }catch(e){ jsonText = "(could not serialize career state)"; }
    return `
      <div class="admin-live-grid">${statsHtml}</div>
      <div class="admin-nudge-row">
        <button type="button" class="admin-nudge-btn" id="adminRepUp">Reputation +10</button>
        <button type="button" class="admin-nudge-btn" id="adminRepDown">Reputation −10</button>
        <button type="button" class="admin-nudge-btn" id="adminGradeUp">Team Grade +10</button>
        <button type="button" class="admin-nudge-btn" id="adminGradeDown">Team Grade −10</button>
        <button type="button" class="admin-nudge-btn" id="adminGmUp">GM Relations +10</button>
        <button type="button" class="admin-nudge-btn" id="adminGmDown">GM Relations −10</button>
        <button type="button" class="admin-nudge-btn" id="adminFanUp">Fan Support +10</button>
        <button type="button" class="admin-nudge-btn" id="adminFanDown">Fan Support −10</button>
        <button type="button" class="admin-nudge-btn" id="adminPopUp">Popularity +10</button>
        <button type="button" class="admin-nudge-btn" id="adminPopDown">Popularity −10</button>
        <button type="button" class="admin-nudge-btn" id="adminSchemeReroll">Reroll Team Scheme</button>
        <button type="button" class="admin-nudge-btn" id="adminPreviewKeyMoment">Preview a Key Moment</button>
      </div>
      <div class="admin-note">Reputation/grade nudges and the career snapshot below update live; reopen this tab (or click a tab again) to refresh after using a nudge.</div>
      <div class="section-label">Career state (live)</div>
      <div class="admin-json">${svgEscape(jsonText)}</div>`;
  }
  /* ----- Stat Calculator tab: renders the ACTUAL formulas generateSeason() runs, with the
     current build/career's real numbers substituted in, so every metric on the season card can
     be traced back to exactly how it was produced. This is a READ-ONLY preview -- it never calls
     generateSeason() and never touches career/build -- so opening it mid-career can't affect the
     season in progress. It shows the EXPECTED-VALUE shape of the formula: a full healthy season
     (no missed games) and the midpoint of any contract-tier role-share range, since the real sim
     also rolls per-season randomness (role-share jitter, a ±2 attempts/game noise term, and the
     game-by-game win/loss coin flips) on top of this that a static preview can't show. Awards use
     the exact odds formulas generateSeason() uses, gated the same way (see the Pro Bowl/All-Pro/
     MVP section) -- these are genuinely live odds, not flavor text.
     NOTE for future edits: this intentionally mirrors generateSeason()'s math rather than calling
     into it (that function is full of side effects -- it advances career state, rolls RNG, pushes
     to season logs). If generateSeason()'s formulas change, these need to change to match. */
  function computeMetricBreakdown(){
    if(!career || !build) return null;
    const decade = decadeForYear(career.year);
    const league = LEAGUE[decade];
    const schemeId = career.teamScheme ? career.teamScheme[career.teamId] : null;
    const scheme = SCHEMES.find(s=>s.id===schemeId);
    const eff = schemeEffective(career.age, decade, schemeId);
    const neutral = neutralEffective(career.age, decade, schemeId);
    const primeMult = primeMultiplier(career.age);

    // Baseball rate signals -- kept in sync with generateSeason's AVG_W/ISO_W/HR_W/BB_W/K_W.
    const W = {
      acc: {SHA:0.40, TCH:0.25, ANT:0.20, DEC:0.15},   // AVG
      ypa: {DAC:0.55, REL:0.30, TCH:0.15},             // ISO
      td:  {DAC:0.62, REL:0.30, ANT:0.08},             // HR rate
      int: {SHA:0.34, TCH:0.30, ANT:0.24, DEC:0.12},   // contact (anti-K)
      bb:  {PKT:0.52, ANT:0.28, DEC:0.20},             // BB rate
      rush:{MOB:0.62, IMP:0.34, ARM:0.04},             // SB signal
    };
    const effAcc = weighted(eff, W.acc), neutralAcc = weighted(neutral, W.acc);
    const effYpa = weighted(eff, W.ypa), neutralYpa = weighted(neutral, W.ypa);
    const effTd  = weighted(eff, W.td),  neutralTd  = weighted(neutral, W.td);
    const effInt = weighted(eff, W.int), neutralInt = weighted(neutral, W.int);
    const effBb  = weighted(eff, W.bb),  neutralBb  = weighted(neutral, W.bb);
    const effOverall = weighted(eff, OVERALL_WEIGHTS), neutralOverall = weighted(neutral, OVERALL_WEIGHTS);
    const effRush = weighted(eff, W.rush);

    const calRaw = STAT_CAL[decade] || STAT_CAL["2000s"];
    // alias so the existing rateCard renderer's d.cal.comp/ypa/td/int keys still resolve
    const cal = { comp: calRaw.avg, ypa: calRaw.iso, td: calRaw.hr, int: calRaw.k, bb: calRaw.bb };
    const dOverall = (effOverall-neutralOverall)*primeMult;
    const STAT_BLEND = 0.30;
    const STAT_SENSITIVITY = 0.34;
    const blendD = raw => (raw*STAT_BLEND + dOverall*(1-STAT_BLEND))*STAT_SENSITIVITY;
    const dComp = blendD((effAcc-neutralAcc)*primeMult);
    const dYpa  = blendD((effYpa-neutralYpa)*primeMult);
    const dTd   = blendD((effTd-neutralTd)*primeMult);
    const dInt  = blendD((effInt-neutralInt)*primeMult);
    const dBb   = blendD((effBb-neutralBb)*primeMult);
    const weaponsNudge = (safeNum(career.weapons,60)-65);
    const chemistryNudge = teamChemistryEdge();
    const lgIso = Math.max(0.05, league.slg - league.avg);
    const comp = clamp(league.avg + dComp*(dComp>=0?cal.comp.up:cal.comp.down) + weaponsNudge*0.0005 + chemistryNudge*0.0003, cal.comp.lo, cal.comp.hi);   // AVG
    const ypa = clamp(lgIso + dYpa*(dYpa>=0?cal.ypa.up:cal.ypa.down) + weaponsNudge*0.0009, cal.ypa.lo, cal.ypa.hi);                                       // ISO
    const tdRate = clamp(league.hrRate + dTd*(dTd>=0?cal.td.up:cal.td.down), cal.td.lo, cal.td.hi);                                                        // HR/PA
    const bbRate = clamp(league.bbRate + dBb*(dBb>=0?cal.bb.up:cal.bb.down), cal.bb.lo, cal.bb.hi);                                                        // BB/PA
    const intRate = clamp(league.kRate - dInt*(dInt>=0?cal.int.up:cal.int.down), cal.int.lo, cal.int.hi);                                                  // K/PA
    const sackRate = clamp(0.022 - (effRush-60)*0.00035, 0.004, 0.05);

    const roleShareRange = career.contract.tier==="minimum" ? [0.1,0.6] : career.contract.tier==="backup" ? [0.3,0.85] : [1,1];
    const roleShare = (roleShareRange[0]+roleShareRange[1])/2;
    const attPerGameBase = league.paPerGame + dOverall*0.010;
    const attPerGame = clamp(attPerGameBase*roleShare, 2.4, 4.9);

    const expGames = league.games;
    const abShare = clamp(1 - bbRate - 0.015, 0.7, 0.97);
    const expAttempts = Math.round(attPerGame*expGames);         // PA
    const expComp = Math.round(expAttempts*abShare*comp);        // hits
    const expYards = Math.round(expAttempts*abShare*(comp+ypa)); // total bases
    const expTd = Math.max(0, Math.round(expAttempts*tdRate));   // HR
    const expInt = Math.max(0, Math.round(expAttempts*intRate)); // K
    const expRating = passerRating(expComp, expAttempts, expYards, expTd, expInt, Math.round(expAttempts*bbRate));

    const rushAttPerGame = clamp((effRush-58)*0.010, 0, 0.9);
    const rushYpc = clamp(0.62 + (effRush-60)*0.006, 0.45, 0.92); // SB success rate
    const rushTdRate = 0;
    const expRushAtt = Math.round(rushAttPerGame*expGames);       // SB attempts
    const expRushYards = Math.max(0, Math.round(expRushAtt*rushYpc)); // SB
    const expRushTd = 0;
    const expSacks = Math.max(0, Math.round(expAttempts*sackRate));  // GIDP

    // Same engine every real game now uses (simulateGameScore vs. an opponent's team grade, see
    // regularSeasonOffenseGrade) -- this preview shows the per-game win odds against a
    // LEAGUE-AVERAGE (grade 65) opponent specifically, since a real season's actual opponents
    // vary week to week. Note the offensive grade below is BLENDED with team quality (Round 4),
    // not just effOverall plus a small edge -- a bad team meaningfully caps this number even for
    // an elite individual build.
    const myOff = regularSeasonOffenseGrade(effOverall, career.age, decade);
    const winProb = simpleWinProb(myOff, 65);

    // Wave 7 (MASTER_REMEDIATION_SPEC.md task #8): calls the REAL production evaluateSeasonAwards
    // instead of a hand-duplicated, now-OBSOLETE model. The old proBowlOdds/allProOdds ("a
    // percentage chance") never matched how awards actually work at all -- real resolution is a
    // comparative, fixed-slot/winner-take-all selection (resolveSeasonAllProAndProBowl/
    // resolveSeasonMVP), never an independent per-QB coin flip -- and the old proBowlGateOk/
    // allProGateOk gates additionally required ratingEdge>=1/>=9 on top of playing time, a stricter
    // rule production explicitly REMOVED (see evaluateSeasonAwards's own comment: "an earlier
    // version gated on ratingEdge... in a league-wide down year that could empty the eligible pool
    // entirely"). Passing this preview's own expected full-healthy-season numbers through the SAME
    // function production actually calls can never drift from what a real season would compute.
    const gamesPlayedShare = 1; // this preview assumes a full healthy season
    const awardCalc = evaluateSeasonAwards({
      rating: expRating, td: expTd, winPct: winProb, attempts: expAttempts,
      gamesPlayed: expGames, leagueGames: league.games, decade, teamOverall: career.teamStrength,
    });
    const { leagueAvgRating, ratingEdge, winsAboveExpectation, proBowlScore, proBowlEligible, allProScore, allProEligible, mvpScore, mvpEligible } = awardCalc;
    const expectedWinPct = expectedWinPctForTeamOverall(career.teamStrength);

    return {
      decade,
      league: { ...league, comp: league.avg, ypa: Math.max(0.05, league.slg-league.avg), tdRate: league.hrRate, intRate: league.kRate, bbRate: league.bbRate, attPerGame: league.paPerGame },
      schemeId, scheme, eff, neutral, primeMult, W, cal,
      effAcc, neutralAcc, effYpa, neutralYpa, effTd, neutralTd, effInt, neutralInt, effBb, neutralBb,
      effOverall, neutralOverall, effRush,
      comp, ypa, tdRate, intRate, sackRate, expSacks, roleShare, roleShareRange, attPerGame, chemistryNudge,
      expGames, expAttempts, expComp, expYards, expTd, expInt, expRating,
      rushAttPerGame, rushYpc, rushTdRate, expRushAtt, expRushYards, expRushTd,
      winProb, myOff, leagueAvgRating, ratingEdge, gamesPlayedShare, winsAboveExpectation, expectedWinPct,
      proBowlScore, proBowlEligible,
      allProScore, allProEligible,
      mvpScore, mvpEligible,
    };
  }

  function renderAdminCalcTab(){
    const d = computeMetricBreakdown();
    function weightedLine(effObj, weights, label){
      const parts = Object.entries(weights).map(([k,w])=> `${ATTR_BY_KEY[k].label}(${effObj[k].toFixed(0)})×${w.toFixed(2)}`);
      return `${label} = ${parts.join(" + ")} = ${weighted(effObj, weights).toFixed(1)}`;
    }
    function card(name, resultText, lines, gate){
      return `<div class="calc-metric">
          <div class="calc-metric-head"><span class="calc-metric-name">${svgEscape(name)}</span><span class="calc-metric-result">${resultText}</span></div>
          <div class="calc-formula">${svgEscape(lines.join("\n"))}</div>
          ${gate||""}
        </div>`;
    }
    const leagueRefRows = DECADES.map(dk=>{
      const l = LEAGUE[dk];
      const cur = d && d.decade===dk;
      return `<tr class="${cur?"calc-ref-current":""}"><td>${dk}${cur?" ← current":""}</td><td>${l.games}</td><td>${l.avg.toFixed(3)}</td><td>${l.obp.toFixed(3)}</td><td>${l.slg.toFixed(3)}</td><td>${(l.hrRate*100).toFixed(1)}%</td><td>${(l.kRate*100).toFixed(1)}%</td></tr>`;
    }).join("");
    const refTable = `
      <div class="calc-refnote">Every season starts from this decade's league-wide baseline rate, then shifts up or down based on how far the build's effective attributes sit above or below a flat, hypothetical "65-everywhere" neutral build run through that same age/era/scheme adjustment. That's why a rookie-year age penalty or a run-first 1970s era doesn't read as "bad build" on its own -- only a genuinely below-average build does.</div>
      <div class="admin-table-wrap"><table class="calc-ref-table"><thead><tr><th>Era</th><th>Games</th><th>AVG</th><th>OBP</th><th>SLG</th><th>HR%</th><th>K%</th></tr></thead><tbody>${leagueRefRows}</tbody></table></div>`;

    if(!d){
      return `<div class="admin-note">Start a career to see every formula below worked out with real, substituted numbers. The league reference table is always available.</div>
        <div class="calc-group"><div class="calc-group-head">League Baseline by Decade</div>${refTable}</div>`;
    }

    // "Restore Original Build" needs the TRUE draft-day numbers -- career.originalBuild, snapshotted
    // once at the Combine, before either natural development (see developAttributes) or anything
    // typed into this editor has had a chance to move it. The lazy same-session snapshot is only a
    // fallback for states without one (e.g. mid-development saves from before this existed).
    if(!adminState.buildSnapshot) adminState.buildSnapshot = career.originalBuild ? {...career.originalBuild} : {...build};
    const groupOrder = [["hitting","Hitting"], ["physical","Physical"], ["mental","Mental"]];
    const buildEditorHtml = `
      <div class="cbe-wrap">
        <div class="cbe-head">
          <span class="cbe-title">Build Editor — override every attribute</span>
          <span class="cbe-overall">effOverall right now: <b>${d.effOverall.toFixed(1)}</b> (neutral baseline is ${d.neutralOverall.toFixed(1)})</span>
        </div>
        <div class="cbe-presets">
          <button type="button" class="admin-nudge-btn" id="cbeMax99">Max Every Attribute (99)</button>
          <button type="button" class="admin-nudge-btn" id="cbeMin10">Min Every Attribute (10)</button>
          <button type="button" class="admin-nudge-btn" id="cbeNeutral65">League-Average (65 flat)</button>
          <button type="button" class="admin-nudge-btn" id="cbeRestoreOriginal">Restore Original Build</button>
        </div>
        <div class="cbe-groups">
          ${groupOrder.map(([groupKey, groupLabel])=>`
            <div class="cbe-group">
              <div class="cbe-group-label">${svgEscape(groupLabel)}</div>
              ${ATTRIBUTES.filter(a=>a.group===groupKey).map(a=>`
                <div class="cbe-field">
                  <label for="cbeInput-${a.key}">${svgEscape(a.label)}</label>
                  <input type="range" id="cbeRange-${a.key}" data-key="${a.key}" min="10" max="99" step="1" value="${build[a.key]}">
                  <input type="number" id="cbeInput-${a.key}" data-key="${a.key}" min="10" max="99" step="1" value="${build[a.key]}">
                </div>`).join("")}
            </div>`).join("")}
        </div>
        <button type="button" class="btn btn-primary" id="cbeApply" style="font-size:0.82rem;padding:0.5rem 1rem;">Apply Build — recompute everything below</button>
        <div class="cbe-note">This overwrites <b>${svgEscape(career.name)}</b>'s actual build in place -- the next season generated (and every formula below) will use whatever you set here. Nothing here is reversible except by clicking "Restore Original Build" above, so use presets freely to test extremes, then restore before continuing the real career.</div>
      </div>`;

    // Career Development: development is invisible without this -- every season quietly nudges
    // build[] in place (see developAttributes), and this is the one place that shows the drift
    // since draft day, attribute by attribute, plus the hidden devSpeed roll that's been scaling
    // it the whole time.
    const devSpeed = career.devSpeed || 1;
    const original = career.originalBuild || build;
    const devRows = ATTRIBUTES.map(a=>{
      const delta = build[a.key]-(original[a.key] ?? build[a.key]);
      const cls = delta>0 ? "good" : delta<0 ? "bad" : "";
      return `<tr><td>${svgEscape(a.label)}</td><td class="tabular">${original[a.key] ?? build[a.key]}</td><td class="tabular">${build[a.key]}</td><td class="tabular ${cls}">${delta>0?"+":""}${delta}</td></tr>`;
    }).join("");
    const totalDelta = ATTR_KEYS.filter(k=>k!=="DUR").reduce((s,k)=> s+(build[k]-(original[k] ?? build[k])), 0);
    const devCard = `<div class="calc-group">
        <div class="calc-group-head">Career Development</div>
        <div class="calc-refnote">Development trait: <b>${svgEscape(devSpeedTag(devSpeed))}</b> (devSpeed ×${devSpeed.toFixed(2)}, rolled once at the Combine — hidden from you at the time, revealed here, and persistent across the career). Every attribute except Durability drifts a little each season based on age, how much this build actually played that year, and this trait — mental attributes (Anticipation, Decision Making, Clutch) grow the longest and hold up best late; physical attributes (Arm, Mobility, Improvisation) peak early and fade the soonest, same as real QB aging. Breakouts and busts create exceptional seasons without rewriting the player's future development rate. Net change since draft day: <b>${totalDelta>0?"+":""}${totalDelta}</b> points across all eleven developable attributes.</div>
        <div class="admin-table-wrap"><table class="calc-ref-table"><thead><tr><th>Attribute</th><th>Draft Day</th><th>Now</th><th>Δ</th></tr></thead><tbody>${devRows}</tbody></table></div>
      </div>`;

    const primeCard = `<div class="calc-metric">
        <div class="calc-metric-head"><span class="calc-metric-name">Prime Multiplier (age ${career.age})</span><span class="calc-metric-result">×${d.primeMult.toFixed(2)}</span></div>
        <div class="calc-formula">${svgEscape(`Looked up from the age curve: [22→0.90, 24→0.95, 26→0.99, 29→1.00, 32→1.00, 34→0.90, 36→0.78, 38→0.65, 40→0.50, 42→0.38], interpolated between points.
Scales how much of the build's edge OVER neutral actually shows up this season -- 100% in the prime years (29-32), tapering both before and after. It does NOT touch the neutral baseline itself, only the delta.`)}</div>
      </div>`;

    const rateCard = (name, resultText, fmt, base, baseLabel, effVal, neutralVal, calEntry, sign, weights, effObj, neutralObj)=>{
      const rawDelta = (effVal-neutralVal)*d.primeMult;
      const coef = rawDelta>=0 ? calEntry.up : calEntry.down;
      const coefLabel = rawDelta>=0 ? `${calEntry.up} (build ≥ neutral)` : `${calEntry.down} (build < neutral)`;
      const lines = [
        weightedLine(effObj, weights, "eff (you, this season)"),
        weightedLine(neutralObj, weights, "neutral (flat-65 baseline)"),
        "",
        `${name} = clamp(${baseLabel} ${sign} (eff − neutral) × primeMult × coef, ${fmt(calEntry.lo)}, ${fmt(calEntry.hi)})  — ${d.decade} bounds, sourced record`,
        `${" ".repeat(name.length)} = clamp(${fmt(base)} ${sign} (${effVal.toFixed(1)} − ${neutralVal.toFixed(1)}) × ${d.primeMult.toFixed(2)} × ${coefLabel}, ...) = ${resultText}`,
      ];
      return card(name, resultText, lines);
    };
    const asPct1 = x=>fmtPct(x), asPct2 = x=>(x*100).toFixed(2)+"%", asNum1 = x=>x.toFixed(1);

    const compCard = rateCard("Completion %", fmtPct(d.comp), asPct1, d.league.comp, "leagueComp", d.effAcc, d.neutralAcc, d.cal.comp, "+", d.W.acc, d.eff, d.neutral);
    const ypaCard = rateCard("Yards / Attempt", d.ypa.toFixed(2), asNum1, d.league.ypa, "leagueY/A", d.effYpa, d.neutralYpa, d.cal.ypa, "+", d.W.ypa, d.eff, d.neutral);
    const tdRateCard = rateCard("TD Rate (per attempt)", (d.tdRate*100).toFixed(2)+"%", asPct2, d.league.tdRate, "leagueTdRate", d.effTd, d.neutralTd, d.cal.td, "+", d.W.td, d.eff, d.neutral);
    const intRateCard = rateCard("INT Rate (per attempt)", (d.intRate*100).toFixed(2)+"%", asPct2, d.league.intRate, "leagueIntRate", d.effInt, d.neutralInt, d.cal.int, "−", d.W.int, d.eff, d.neutral);

    const attCard = card("Attempts / Game", d.attPerGame.toFixed(1),
      [
        weightedLine(d.eff, OVERALL_WEIGHTS, "effOverall (you, this season)"),
        weightedLine(d.neutral, OVERALL_WEIGHTS, "neutralOverall (flat-65 baseline)"),
        "",
        `Att/Game = clamp((leagueAtt/G − ΔMOB×0.05 + (effOverall−neutralOverall)×primeMult×0.06 ± noise) × roleShare, 4, 48)`,
        `         = clamp((${d.league.attPerGame} − (${d.eff.MOB.toFixed(0)}−${d.neutral.MOB.toFixed(0)})×0.05 + (${d.effOverall.toFixed(1)}−${d.neutralOverall.toFixed(1)})×${d.primeMult.toFixed(2)}×0.06 ± up to 2) × ${d.roleShare.toFixed(2)}, 4, 48)`,
        `         = ${d.attPerGame.toFixed(1)} (shown here without the ±2 per-season noise the real sim adds)`,
        "",
        (career.contract.tier!=="minimum" && career.contract.tier!=="backup")
          ? `Role share: full starter (contract tier "${career.contract.tier}") = 1.00`
          : `Role share: contract tier "${career.contract.tier}" rolls a FRESH random value in [${d.roleShareRange[0].toFixed(2)}, ${d.roleShareRange[1].toFixed(2)}] every season -- ${d.roleShare.toFixed(2)} shown here is just that range's midpoint.`,
      ]);

    const ratingCard = card("Passer Rating (expected, full season)", d.expRating.toFixed(1),
      [
        `Over an expected ${d.expGames}-game healthy season at the rates above:`,
        `  Attempts ≈ ${d.expAttempts}, Completions ≈ ${d.expComp}, Yards ≈ ${d.expYards.toLocaleString()}, TD ≈ ${d.expTd}, INT ≈ ${d.expInt}`,
        "",
        "Standard NFL formula, each of 4 components clamped to [0, 2.375]:",
        `  a = clamp((comp/att − 0.3) × 5)       = ${clamp(((d.expComp/d.expAttempts)-0.3)*5,0,2.375).toFixed(3)}`,
        `  b = clamp((yards/att − 3) × 0.25)     = ${clamp(((d.expYards/d.expAttempts)-3)*0.25,0,2.375).toFixed(3)}`,
        `  c = clamp((td/att) × 20)              = ${clamp((d.expTd/d.expAttempts)*20,0,2.375).toFixed(3)}`,
        `  d = clamp(2.375 − (int/att) × 25)     = ${clamp(2.375-((d.expInt/d.expAttempts)*25),0,2.375).toFixed(3)}`,
        `  Rating = (a+b+c+d)/6 × 100             = ${d.expRating.toFixed(1)}`,
      ]);

    const rushCard = card("Rushing (Att/Game, Yds/Carry, TD Rate)",
      `${d.rushAttPerGame.toFixed(1)} att · ${d.rushYpc.toFixed(2)} ypc · ${(d.rushTdRate*100).toFixed(2)}% TD`,
      [
        weightedLine(d.eff, d.W.rush, "effRush"),
        "",
        `Rush Att/Game = clamp((effRush − 45) × 0.14, 0.2, 9.5)          = ${d.rushAttPerGame.toFixed(2)}`,
        `Rush Yds/Carry = clamp(3.4 + (effRush − 55) × 0.045, 1.8, 7.8)   = ${d.rushYpc.toFixed(2)}`,
        `Rush TD Rate = clamp(0.018 + (effRush − 55) × 0.0006, ...)      = ${(d.rushTdRate*100).toFixed(2)}%`,
        `Over ${d.expGames} games ≈ ${d.expRushAtt} carries, ${d.expRushYards.toLocaleString()} yards, ${d.expRushTd} TD`,
      ]);

    const sackCard = card("Sacks Taken", `${d.expSacks} / season`,
      [
        `SackRate = clamp(0.075 − (PKT−neutralPKT)×0.0012 − (teamGrade−65)×0.0004, 1.5%, 16%)`,
        `         = ${(d.sackRate*100).toFixed(2)}% per dropback`,
        `Over ${d.expGames} games and ${d.expAttempts} attempts ≈ ${d.expSacks} sacks taken`,
        `Driven by pocket presence (individually) and team quality (o-line) -- a good pocket passer on a good team gets sacked well below league-average; a statue on a bad line gets sacked a lot more.`,
      ]);

    const winCard = card("Win Probability (per game)", fmtPct(d.winProb),
      [
        `Each game is now simulated individually against that WEEK'S actual opponent grade (simulateGameScore, the same engine the playoffs use) instead of one flat season-long roll -- so a soft schedule and a brutal one produce visibly different records for the same build.`,
        `Offensive grade is now BLENDED with team quality, not just nudged by it: myOff = teamGrade + (effOverall−teamGrade)×${QB_INFLUENCE_REGULAR} + (Clutch−65)×0.03 = ${d.myOff.toFixed(2)} -- a QB whose personal grade diverges sharply from the team around him gets pulled hard toward that team's level, in EITHER direction.`,
        `Shown here vs. a league-average (grade 65) opponent: WinProb ≈ clamp(0.5 + (myOff−oppGrade)×0.012, 6%, 94%)`,
        `        = clamp(0.5 + (${d.myOff.toFixed(1)}−65)×0.012, ...) = ${fmtPct(d.winProb)} vs. an average opponent this season`,
        `A genuinely better opponent (higher grade) meaningfully lowers this game's odds, and vice versa -- see the Season tab for the real week-by-week schedule and results.`,
      ]);

    function gateLine(ok, text){ return `<div class="calc-gate ${ok?"pass":"fail"}">${ok?"✓":"✗"} ${svgEscape(text)}</div>`; }

    const awardsIntro = `<div class="calc-refnote">All three season awards are judged on what actually happened -- passer rating vs. that year's league average (ratingEdge), TD production, wins ABOVE what this team's own preseason grade already predicted (winsAboveExpectation -- Balance Wave 5, replacing raw win% so a stacked roster's own expected win total no longer inflates the score by itself), and (for Pro Bowl/All-Pro) how much of the season was actually played -- never on the underlying attribute grade. This preview assumes a full healthy season, so the games-played gates always read ✓ here; a real season that misses a big chunk of games fails them and the award becomes unreachable no matter how good the per-game numbers were.</div>`;

    const pbCard = card("Pro Bowl Score", d.proBowlScore.toFixed(2),
      [
        `ratingEdge = expectedRating − leagueAvgRating = ${d.expRating.toFixed(1)} − ${d.leagueAvgRating.toFixed(1)} = ${d.ratingEdge.toFixed(1)}`,
        `expectedWinPct(teamOverall=${career.teamStrength}) = clamp(0.5 + (teamOverall−65)×0.011, 15%, 85%) = ${fmtPct(d.expectedWinPct)}`,
        `winsAboveExpectation = clamp(winPct − expectedWinPct, −0.5, 0.5) = clamp(${d.winProb.toFixed(2)} − ${d.expectedWinPct.toFixed(2)}, ...) = ${d.winsAboveExpectation.toFixed(2)}`,
        `score = ratingEdge×0.6 + max(0, TD−16)×0.45 + winsAboveExpectation×10`,
        `      = ${d.ratingEdge.toFixed(1)}×0.6 + max(0, ${d.expTd}−16)×0.45 + ${d.winsAboveExpectation.toFixed(2)}×10 = ${d.proBowlScore.toFixed(2)}`,
        `Pro Bowl is no longer an independent per-QB roll -- the top scorers in each conference make it (2/conf through the 1980s, 3/conf from the 1990s on, with an extra qualifying 3rd spot possible pre-1990), decided once every other league QB's season is locked in.`,
      ],
      gateLine(d.expAttempts>200, `attempts > 200 (${d.expAttempts})`) +
      gateLine(true, `played ≥ 65% of games (this preview assumes a full healthy season)`) +
      gateLine(d.proBowlEligible, `proBowlEligible (production's real gate — playing time only, no rating bar)`));

    const apCard = card("All-Pro Score", d.allProScore.toFixed(2),
      [
        `score = ratingEdge×0.75 + max(0, TD−22)×0.55 + winsAboveExpectation×18`,
        `      = ${d.ratingEdge.toFixed(1)}×0.75 + max(0, ${d.expTd}−22)×0.55 + ${d.winsAboveExpectation.toFixed(2)}×18 = ${d.allProScore.toFixed(2)}`,
        `All-Pro is no longer an independent per-QB roll -- exactly 1 First-Team and 1 Second-Team All-Pro are named league-wide, the two highest scores across the player and every simulated rival this season.`,
      ],
      gateLine(d.expAttempts>250, `attempts > 250 (${d.expAttempts})`) +
      gateLine(true, `played ≥ 80% of games (this preview assumes a full healthy season)`) +
      gateLine(d.allProEligible, `allProEligible (production's real gate — playing time only, no rating bar)`));

    const mvpCard = card("MVP Score", d.mvpScore.toFixed(1),
      [
        `Balance Wave 5: MVP is a 5-component weighted composite, per the balance brief's own explicit split -- 45% era-relative efficiency, 20% volume, 20% wins above expectation, 10% availability, 5% narrative (an outright winning record, distinct from whether it was "expected").`,
        `score = [clamp(ratingEdge/15,±2)×0.45 + clamp((TD−20)/8,±2)×0.20 + clamp(winsAboveExpectation×8,±2)×0.20 + clamp((gamesShare−0.85)×4,−2,1)×0.10 + clamp((winPct−0.5)×3,±1.5)×0.05] × 16`,
        `      = [${clamp(d.ratingEdge/15,-2,2).toFixed(2)}×0.45 + ${clamp((d.expTd-20)/8,-2,2).toFixed(2)}×0.20 + ${clamp(d.winsAboveExpectation*8,-2,2).toFixed(2)}×0.20 + ${clamp((d.gamesPlayedShare-0.85)*4,-2,1).toFixed(2)}×0.10 + ${clamp((d.winProb-0.5)*3,-1.5,1.5).toFixed(2)}×0.05] × 16 = ${d.mvpScore.toFixed(2)}`,
        `MVP is no longer an independent per-QB roll -- this score is compared against every other starting QB in the league at season's end, and whoever's highest wins it outright (a genuine tie produces co-MVPs).`,
      ],
      gateLine(d.expAttempts>150, `attempts > 150 (${d.expAttempts})`) +
      gateLine(true, `played ≥ 50% of games (this preview assumes a full healthy season)`));

    return `
      <div class="admin-note">Live numbers for <b>${svgEscape(career.name)}</b> — age ${career.age}, ${d.decade}${d.scheme?`, running the ${svgEscape(d.scheme.name)}`:""}, as if the upcoming season is played in full health. Actual results still vary: the sim also rolls role-share/attempts-per-game noise and a game-by-game win/loss coin flip on top of everything shown here.</div>
      ${buildEditorHtml}
      ${devCard}
      <div class="calc-group"><div class="calc-group-head">League Baseline by Decade</div>${refTable}</div>
      <div class="calc-group"><div class="calc-group-head">Age & Scheme</div>${primeCard}</div>
      <div class="calc-group"><div class="calc-group-head">Passing Rates</div>${compCard}${ypaCard}${tdRateCard}${intRateCard}${attCard}</div>
      <div class="calc-group"><div class="calc-group-head">Passer Rating</div>${ratingCard}</div>
      <div class="calc-group"><div class="calc-group-head">Rushing</div>${rushCard}</div>
      <div class="calc-group"><div class="calc-group-head">Sacks</div>${sackCard}</div>
      <div class="calc-group"><div class="calc-group-head">Team Success</div>${winCard}</div>
      <div class="calc-group"><div class="calc-group-head">Season Awards</div>${awardsIntro}${pbCard}${apCard}${mvpCard}</div>`;
  }

  function renderAdminTabContent(){
    const body = document.getElementById("adminTabBody");
    if(!body) return;
    if(adminState.tab==="players") body.innerHTML = renderAdminPlayersTab();
    else if(adminState.tab==="events") body.innerHTML = renderAdminEventsTab();
    else if(adminState.tab==="calc") body.innerHTML = renderAdminCalcTab();
    else body.innerHTML = renderAdminLiveTab();
    wireAdminTabContent();
  }
  function wireAdminTabContent(){
    if(adminState.tab==="players"){
      const search = document.getElementById("adminPlayerSearch");
      if(search) search.addEventListener("input", ()=>{ adminState.search = search.value; renderAdminTabContent(); document.getElementById("adminPlayerSearch").focus(); document.getElementById("adminPlayerSearch").selectionStart = document.getElementById("adminPlayerSearch").value.length; });
      const decadeSel = document.getElementById("adminDecadeFilter");
      if(decadeSel) decadeSel.addEventListener("change", ()=>{ adminState.decadeFilter = decadeSel.value; renderAdminTabContent(); });
      document.querySelectorAll("table.admin-table th[data-sort]").forEach(th=>{
        th.addEventListener("click", ()=>{
          const key = th.dataset.sort;
          if(adminState.sortKey===key) adminState.sortDir = adminState.sortDir==="asc" ? "desc" : "asc";
          else { adminState.sortKey = key; adminState.sortDir = ATTR_KEYS.includes(key) ? "desc" : "asc"; }
          renderAdminTabContent();
        });
      });
    } else if(adminState.tab==="events"){
      document.querySelectorAll(".admin-fire-btn").forEach(btn=>{
        btn.addEventListener("click", ()=> adminFireEvent(btn.dataset.pool, btn.dataset.id));
      });
    } else if(adminState.tab==="live" && career){
      const repUp = document.getElementById("adminRepUp"), repDown = document.getElementById("adminRepDown");
      const gradeUp = document.getElementById("adminGradeUp"), gradeDown = document.getElementById("adminGradeDown");
      const previewKm = document.getElementById("adminPreviewKeyMoment");
      if(repUp) repUp.addEventListener("click", ()=>{ career.reputation = clamp(career.reputation+10,0,100); renderAdminTabContent(); });
      if(repDown) repDown.addEventListener("click", ()=>{ career.reputation = clamp(career.reputation-10,0,100); renderAdminTabContent(); });
      // Wave 5: routed through adjustTeamStrength -- a direct teamStrength/leagueStrength bump here
      // would just get overwritten (silently undone) by the very next season-end drift, which now
      // always re-derives the aggregate from the five persistent components.
      if(gradeUp) gradeUp.addEventListener("click", ()=>{ adjustTeamStrength(career.teamId, 10, 0); renderAdminTabContent(); });
      if(gradeDown) gradeDown.addEventListener("click", ()=>{ adjustTeamStrength(career.teamId, -10, 0); renderAdminTabContent(); });
      const gmUp = document.getElementById("adminGmUp"), gmDown = document.getElementById("adminGmDown");
      const fanUp = document.getElementById("adminFanUp"), fanDown = document.getElementById("adminFanDown");
      const popUp = document.getElementById("adminPopUp"), popDown = document.getElementById("adminPopDown");
      const schemeReroll = document.getElementById("adminSchemeReroll");
      if(gmUp) gmUp.addEventListener("click", ()=>{ career.gmRelationship = clamp(career.gmRelationship+10,0,100); renderAdminTabContent(); });
      if(gmDown) gmDown.addEventListener("click", ()=>{ career.gmRelationship = clamp(career.gmRelationship-10,0,100); renderAdminTabContent(); });
      if(fanUp) fanUp.addEventListener("click", ()=>{ career.fanSupport = clamp(career.fanSupport+10,0,100); renderAdminTabContent(); });
      if(fanDown) fanDown.addEventListener("click", ()=>{ career.fanSupport = clamp(career.fanSupport-10,0,100); renderAdminTabContent(); });
      if(popUp) popUp.addEventListener("click", ()=>{ career.leaguePopularity = clamp(career.leaguePopularity+10,0,100); renderAdminTabContent(); });
      if(popDown) popDown.addEventListener("click", ()=>{ career.leaguePopularity = clamp(career.leaguePopularity-10,0,100); renderAdminTabContent(); });
      if(schemeReroll) schemeReroll.addEventListener("click", ()=>{ maybeChangeTeamScheme(); renderAdminTabContent(); });
      if(previewKm) previewKm.addEventListener("click", ()=>{
        const fakeRound = { round:"Divisional", opponent:"Sample Opponent", myScore:24, oppScore:20, won:true,
          quarters:[{q:1,myTotal:7,oppTotal:3},{q:2,myTotal:14,oppTotal:10},{q:3,myTotal:17,oppTotal:17},{q:4,myTotal:24,oppTotal:20}],
          oppTendency: pickOpponentTendency() };
        closeAdminOverlay();
        triggerKeyMoment(career, fakeRound, -1, ()=>{}, ()=>true);
      });
    } else if(adminState.tab==="calc" && career && build){
      // range/number pairs stay in sync as you drag or type, but nothing touches the actual
      // build until Apply (or a preset) is clicked -- so dragging a slider doesn't trigger a
      // full tab re-render (and lose focus) on every tick.
      ATTR_KEYS.forEach(k=>{
        const range = document.getElementById("cbeRange-"+k), num = document.getElementById("cbeInput-"+k);
        if(!range || !num) return;
        range.addEventListener("input", ()=>{ num.value = range.value; });
        num.addEventListener("input", ()=>{
          const v = clamp(parseInt(num.value,10)||10, 10, 99);
          range.value = v;
        });
      });
      function setAllAttributes(value){
        ATTR_KEYS.forEach(k=> build[k]=value);
        renderAdminTabContent();
      }
      const max99 = document.getElementById("cbeMax99"), min10 = document.getElementById("cbeMin10");
      const neutral65 = document.getElementById("cbeNeutral65"), restoreOrig = document.getElementById("cbeRestoreOriginal");
      const apply = document.getElementById("cbeApply");
      if(max99) max99.addEventListener("click", ()=> setAllAttributes(99));
      if(min10) min10.addEventListener("click", ()=> setAllAttributes(10));
      if(neutral65) neutral65.addEventListener("click", ()=> setAllAttributes(65));
      if(restoreOrig) restoreOrig.addEventListener("click", ()=>{
        if(adminState.buildSnapshot) ATTR_KEYS.forEach(k=> build[k]=adminState.buildSnapshot[k]);
        renderAdminTabContent();
      });
      if(apply) apply.addEventListener("click", ()=>{
        ATTR_KEYS.forEach(k=>{
          const num = document.getElementById("cbeInput-"+k);
          if(num) build[k] = clamp(parseInt(num.value,10)||10, 10, 99);
        });
        renderAdminTabContent();
      });
    }
  }
  function openAdminOverlay(){
    const overlay = document.getElementById("adminOverlay");
    if(!overlay) return;
    overlay.innerHTML = `
      <div class="admin-panel">
        <div class="admin-head">
          <div>
            <h2 id="adminOverlayHeading">Admin &amp; Testing Tools</h2>
            <div class="admin-sub">v10.1 · browse data, force-fire events, inspect live state</div>
          </div>
          <button type="button" class="admin-close" id="adminCloseBtn" aria-label="Close admin panel">✕</button>
        </div>
        <div class="admin-tabs">
          <button type="button" class="admin-tab" data-tab="players">Players (${QBS.length})</button>
          <button type="button" class="admin-tab" data-tab="events">Events</button>
          <button type="button" class="admin-tab" data-tab="live">Live Career</button>
          <button type="button" class="admin-tab" data-tab="calc">Stat Calculator</button>
        </div>
        <div class="admin-body" id="adminTabBody"></div>
      </div>`;
    document.querySelectorAll(".admin-tab").forEach(tabBtn=>{
      tabBtn.classList.toggle("active", tabBtn.dataset.tab===adminState.tab);
      tabBtn.addEventListener("click", ()=>{ adminState.tab = tabBtn.dataset.tab; openAdminOverlay(); });
    });
    document.getElementById("adminCloseBtn").addEventListener("click", closeAdminOverlay);
    if(!overlay._backdropWired){
      overlay._backdropWired = true;
      overlay.addEventListener("click", (e)=>{ if(e.target===overlay) closeAdminOverlay(); });
    }
    renderAdminTabContent();
    openDialog(overlay, { labelledBy: "adminOverlayHeading" });
  }
  function closeAdminOverlay(){
    const overlay = document.getElementById("adminOverlay");
    if(!overlay) return;
    closeDialog(overlay);
    overlay.innerHTML = "";
  }
  function initAdminPanel(){
    const btn = document.getElementById("adminToggleBtn");
    if(!btn) return;
    // Wave 7 (MASTER_REMEDIATION_SPEC.md task #9): "Hide Admin Calc behind a development flag or
    // remove it from production navigation." import.meta.env.DEV is Vite's own dev/production flag
    // -- true under `npm run dev`, statically false (and dead-code-eliminated) in `npm run build` --
    // so the button is removed from the DOM entirely in a production build, not just disabled or
    // hidden by CSS; the whole admin overlay (including the Admin Calc tab) is simply unreachable.
    if(!import.meta.env.DEV){ btn.remove(); return; }
    btn.addEventListener("click", openAdminOverlay);
  }

  /* ================= Init ================= */
  document.getElementById("statQbCount").textContent = QBS.length;
  document.getElementById("howscoreQbCount").textContent = QBS.length;
  renderBestStrip();
  renderLastBuildStrip();
  renderActiveCareerStrip();
  renderMultiplayerMatchesStrip();
  initSoundToggle();
  initKeyMomentsToggle();
  initAdminPanel();
  // One delegated listener, attached once (NOT inside renderSeasonCard -- #careerContent itself is
  // never recreated between seasons, only its innerHTML, so attaching there on every render would
  // stack up a duplicate listener per season). Covers every rival-name link on the card in any tab
  // panel (Schedule, League, playoff boxes) -- panels all stay in the DOM at once (switchDashTab
  // only toggles visibility), so this needs no re-wiring on tab switches or season re-renders.
  document.getElementById("careerContent").addEventListener("click", (e)=>{
    const link = e.target.closest("[data-rival-id]");
    if(link) openRivalProfile(link.dataset.rivalId);
    // Round 32 item 4: "click into the team" -- a generic page for any team, reachable from a QB's
    // own profile (the team-name eyebrow), the Standings tab's team names, or (Round 33) a Free
    // Agency offer card, in which case data-fa-role carries that offer's own role string so the
    // team page can show "if you sign here" without re-deriving a second depth-chart estimate.
    const teamLink = e.target.closest("[data-team-id]");
    if(teamLink) openTeamProfile(teamLink.dataset.teamId, teamLink.dataset.faRole || null);
    // League tab's "Played This Season" / "Inactive / Free Agents" toggle -- pure show/hide, both
    // panels' HTML is already in the DOM (see buildLeagueTabHTML), so no re-render is needed here.
    const subtabBtn = e.target.closest("[data-league-subtab]");
    if(subtabBtn){
      const key = subtabBtn.dataset.leagueSubtab;
      const container = subtabBtn.closest(".league-tab");
      if(container){
        container.querySelectorAll(".league-subtab-btn").forEach(b=> b.classList.toggle("active", b===subtabBtn));
        container.querySelectorAll(".league-subtab-panel").forEach(p=> p.classList.toggle("active", p.dataset.leaguePanel===key));
      }
    }
    // League tab column-header sort -- same delegated-listener idiom as the subtab toggle above.
    // Clicking the already-active column flips direction; clicking a new column resets to descending.
    const sortTh = e.target.closest("[data-league-sort]");
    if(sortTh){
      const key = sortTh.dataset.leagueSort, table = sortTh.dataset.leagueSortTable;
      if(table==="active"){
        leagueActiveSortDir = (leagueActiveSortKey===key) ? -leagueActiveSortDir : -1;
        leagueActiveSortKey = key;
      } else {
        leagueInactiveSortDir = (leagueInactiveSortKey===key) ? -leagueInactiveSortDir : -1;
        leagueInactiveSortKey = key;
      }
      reRenderLeagueTables();
    }
    // Playoff Tree "Simulate Next Round" -- advances every flat-resolved conference (never the
    // player's own real one, which is always paced by the Season tab) one revealed round further.
    const simulateBtn = e.target.closest("[data-bracket-simulate]");
    if(simulateBtn){ simulateNextPlayoffTreeRound(); }
    // Playoff Tree matchup node click -- opens the box-score modal for a decided game.
    const bracketNode = e.target.closest("[data-bracket-conf]");
    if(bracketNode && playoffTreeSeason){
      const season = playoffTreeSeason;
      const conf = bracketNode.dataset.bracketConf;
      const roundIdx = Number(bracketNode.dataset.bracketRoundIdx);
      const matchIdx = Number(bracketNode.dataset.bracketMatchIdx);
      const display = playoffTreeConfDisplay(conf, season);
      const round = display.rounds[roundIdx];
      const match = round && round.matchups[matchIdx];
      if(match) openBracketBoxScore(match, season.year, round.label);
    }
    // Super Bowl node click -- same box-score modal, built from the permanent playoffBracket record
    // (the SB node is only ever clickable once pb exists -- see bracketSuperBowlColumnHtml).
    const sbNode = e.target.closest("[data-bracket-sb]");
    if(sbNode && playoffTreeSeason){
      const season = playoffTreeSeason;
      const pb = season.leagueStandings && season.leagueStandings.playoffBracket;
      if(pb){
        const [wScore,lScore] = String(pb.superBowlScore).split("-").map(Number);
        const bd = season.leagueStandings.bracket;
        const myDisplay = playoffTreeConfDisplay(bd.myConf, season);
        const otherDisplay = playoffTreeConfDisplay(bd.otherConf, season);
        const myWon = pb.superBowlWinnerId===myDisplay.championId;
        // A real playoff game the player personally played (they reached the Super Bowl) already
        // has a real box score attached to that round -- reuse it via qbLineHTML's isMine branch
        // instead of estimating, exactly like any other node's box-score modal.
        const myRealSB = (season.playoffs && season.playoffs.rounds || []).find(r=>r.round==="Super Bowl");
        const match = { aId: myDisplay.championId, bId: otherDisplay.championId,
          aScore: myWon?wScore:lScore, bScore: myWon?lScore:wScore, winnerId: pb.superBowlWinnerId,
          realRound: myRealSB || null };
        if(match.aId!=null && match.bId!=null) openBracketBoxScore(match, season.year, "Super Bowl");
      }
    }
    // Round 32 item 2: every regular-season game card on the Schedule tab opens the exact same
    // box-score modal a playoff matchup does -- re-derive the matchup (never store a duplicate
    // copy of it on the DOM node) the same way the bracket click handlers above already do.
    const scheduleNode = e.target.closest("[data-schedule-a]");
    if(scheduleNode && scheduleTabSeason && !e.target.closest("[data-rival-id]")){
      const season = scheduleTabSeason;
      const week = Number(scheduleNode.dataset.scheduleWeek);
      const aId = scheduleNode.dataset.scheduleA, bId = scheduleNode.dataset.scheduleB;
      const m = buildWeekMatchups(season, week).find(x=>x.aId===aId && x.bId===bId);
      if(m) openBracketBoxScore(scheduleMatchToBracketMatch(m, week, season), season.year, `Week ${week}`);
    }
  });
  // Manually advances whichever conference(s) have nothing real left gating them -- while the
  // player is still actively mid-run, this button doesn't even render (see buildPlayoffTreeTabHTML's
  // needsRoundSimulate check), since lockstep already paces the other conference automatically then.
  function simulateNextPlayoffTreeRound(){
    const season = playoffTreeSeason;
    if(!season || !season.leagueStandings || !season.leagueStandings.bracket) return;
    const bd = season.leagueStandings.bracket;
    const myDone = !season.playoffs || !season.playoffs.made || season.playoffs.done;
    if(myDone && bd.myChampionId==null) stepBracketConferenceOnce(bd, season, "my");
    if(bd.otherChampionId==null) stepBracketConferenceOnce(bd, season, "other");
    tryFinalizeLeaguePlayoffBracket(season);
    const panel = document.getElementById("tabpanel-playofftree");
    if(panel) panel.innerHTML = buildPlayoffTreeTabHTML(season);
    const standingsPanel = document.getElementById("tabpanel-standings");
    if(standingsPanel) standingsPanel.innerHTML = buildStandingsTabHTML(season);
    // If this click was the one that finally finished the whole bracket (and the player's own
    // involvement was already over), Continue/Play On unlocks right here -- see the matching check
    // in finalizeRound, which this mirrors for the case where finishing happens via a manual click
    // rather than the player's own reveal ending.
    if(myDone && season.leagueStandings.playoffBracket){
      const actions = document.getElementById("seasonActions");
      if(actions && actions.classList.contains("pending-reveal")){
        actions.classList.remove("pending-reveal");
        actions.querySelectorAll("button").forEach(b=> b.disabled=false);
      }
    }
    // Wave 1: each "Simulate Next Round" click can complete a real playoff round (or the whole
    // league-wide bracket) just as much as the player's own reveal finishing does -- checkpoint it
    // the same way finalizeRound does, since this can happen across many separate sessions.
    saveActiveCareer({ phase: (myDone && season.leagueStandings.playoffBracket) ? "decision" : "playoffs" });
  }
  // Spacebar shortcut for "Simulate Next Round" -- scoped to only fire while the Season tab (the
  // Playoff Tree now lives inside it, not its own dash-tab) is the currently active panel.
  document.addEventListener("keydown", (e)=>{
    if(e.code!=="Space" && e.key!==" ") return;
    const seasonPanel = document.getElementById("tabpanel-season");
    if(!seasonPanel || !seasonPanel.classList.contains("active")) return;
    if(!document.getElementById("playoffTreeSimulateBtn")) return;
    e.preventDefault();
    simulateNextPlayoffTreeRound();
  });

  // Schedule tab's week picker -- same delegated-listener idiom as the League tab's subtab/sort
  // controls above, on a `change` listener since it's a <select>, not a click target.
  document.getElementById("careerContent").addEventListener("change", (e)=>{
    const select = e.target.closest("#scheduleWeekSelect");
    if(select){
      scheduleTabWeek = Number(select.value);
      const root = document.getElementById("scheduleTabRoot");
      if(root) root.innerHTML = renderScheduleTabInner();
    }
  });

  // Trophy Room: static screen (never recreated), so all wiring happens once, here.
  let trophyRoomSortKey = "recent";
  function renderTrophyRoomScreen(){
    document.getElementById("trophyRoomTable").innerHTML = buildTrophyRoomTableHTML(trophyRoomSortKey);
  }
  document.getElementById("trophyRoomBtn").addEventListener("click", ()=>{
    trophyRoomSortKey = "recent";
    document.querySelectorAll("#trophyRoomSortRow .tr-sort-btn").forEach(b=> b.classList.toggle("active", b.dataset.sort==="recent"));
    renderTrophyRoomScreen();
    showScreen("trophyroom");
  });
  document.getElementById("trophyRoomBackBtn").addEventListener("click", ()=> showScreen("menu"));

  // Achievements screen: static (never recreated), same wire-once convention as Trophy Room above.
  document.getElementById("achievementsBtn").addEventListener("click", ()=>{
    document.getElementById("achievementsGlobalGrid").innerHTML = buildGlobalAchievementsHTML();
    showScreen("achievements");
  });
  document.getElementById("achievementsBackBtn").addEventListener("click", ()=> showScreen("menu"));

  // Fast-forward stop button lives outside #careerContent (see index.html) specifically so it
  // survives every innerHTML swap fast-forward itself triggers -- wired once, here, same as every
  // other static overlay control in this file.
  document.getElementById("fastForwardStopBtn").addEventListener("click", stopFastForward);
  document.querySelectorAll("#trophyRoomSortRow .tr-sort-btn").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      trophyRoomSortKey = btn.dataset.sort;
      document.querySelectorAll("#trophyRoomSortRow .tr-sort-btn").forEach(b=> b.classList.toggle("active", b===btn));
      renderTrophyRoomScreen();
    });
  });
  // #trophyRoomTable itself is never recreated (only its innerHTML, on every sort click), so one
  // delegated listener here -- not inside buildTrophyRoomTableHTML -- is enough for every row ever
  // rendered into it, same pattern as the careerContent listener above.
  document.getElementById("trophyRoomTable").addEventListener("click", (e)=>{
    const btn = e.target.closest("[data-card-id]");
    if(!btn) return;
    const entry = loadTrophyRoom().find(x=>x.id===btn.dataset.cardId);
    if(entry) openBaseballCard(entry);
  });

  // __BUILD_TIME__ is a Vite `define` (see vite.config.js), baked in at BUILD time -- a stale PWA/
  // browser cache serving an old bundle shows an old timestamp here, making that mismatch visible
  // at a glance instead of silently serving pre-fix logic while looking identical to the live site.
  const buildStampEl = document.getElementById("buildStamp");
  if(buildStampEl) buildStampEl.textContent = "build " + __BUILD_TIME__.replace("T"," ").replace(/\.\d+Z$/, "Z");

  // Wave 0/2A (MASTER_REMEDIATION_SPEC.md, Section 3): a single, narrow, READ-ONLY test-only call
  // path for the invariant validator -- deliberately NOT a broader debug/admin surface. It takes no
  // arguments, mutates nothing, and returns only a plain array of violation descriptions (or null if
  // no career is active), so finding it in devtools gives an ordinary player nothing to alter or
  // cheat with. This is the one deliberate, spec-mandated exception to this project's normal "no
  // debug hooks in the real file" rule (see CLAUDE.md) -- Playwright's regression suite runs against
  // a real `vite preview` production build, so a dev-only guard (e.g. import.meta.env.DEV) would be
  // false there too and defeat the point.
  window.__glValidateLeagueState = function(){
    return career ? validateLeagueState(career, career.year) : null;
  };
})();
