// Pure pitcher season-stat engine (Phase 16), the mound-side analogue of the hitting math that
// lives inline in main.js's generateSeason / simulatePlayerSeasonStats. DOM-free and
// career-state-free so the balance suite can sweep it headless -- main.js imports these and wires
// them to the player's build and to the league's rotation/bullpen entities.
//
// The 12 pitching tools (see src/data/pitchers.js) collapse to a single 0-99 `talent` scalar via
// PITCHER_OVERALL_WEIGHTS (src/sim/ratings.js) exactly the way the hitter tools collapse to
// `hitterOverall`. From there a pitcher's era-relative expectation is a function of his edge over a
// neutral 65 build, his age, and the decade's run environment.

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// Per-decade mound environment a league-average starter pitches in. Grounded against real MLB
// decade aggregates (not a certified encyclopedia):
//   era    league earned-run average          k9/bb9/hr9  per-9-inning rates
//   h9     hits allowed per 9                  ipPerStart  innings a healthy full-time starter averages
//   startsFull  starts a healthy season-long rotation arm makes (higher in the four-man-rotation eras)
//   cgRate the share of a workhorse's starts that go the distance (collapses toward zero post-1990)
//   fipConst  the additive constant that puts FIP on the same scale as ERA that decade
export const PITCH_LEAGUE = Object.freeze({
  "1960s": { era: 3.62, k9: 5.6, bb9: 3.1, hr9: 0.78, h9: 8.5, ipPerStart: 7.1, startsFull: 35, cgRate: 0.28, fipConst: 3.05 },
  "1970s": { era: 3.72, k9: 5.0, bb9: 3.3, hr9: 0.72, h9: 8.7, ipPerStart: 6.9, startsFull: 35, cgRate: 0.24, fipConst: 3.10 },
  "1980s": { era: 3.85, k9: 5.4, bb9: 3.2, hr9: 0.85, h9: 8.8, ipPerStart: 6.5, startsFull: 34, cgRate: 0.14, fipConst: 3.15 },
  "1990s": { era: 4.30, k9: 6.4, bb9: 3.4, hr9: 1.01, h9: 9.2, ipPerStart: 6.2, startsFull: 33, cgRate: 0.06, fipConst: 3.25 },
  "2000s": { era: 4.45, k9: 6.6, bb9: 3.3, hr9: 1.10, h9: 9.3, ipPerStart: 5.9, startsFull: 33, cgRate: 0.03, fipConst: 3.30 },
  "2010s": { era: 4.05, k9: 7.7, bb9: 3.0, hr9: 1.06, h9: 8.7, ipPerStart: 5.8, startsFull: 31, cgRate: 0.015, fipConst: 3.10 },
  "2020s": { era: 4.25, k9: 8.7, bb9: 3.3, hr9: 1.24, h9: 8.4, ipPerStart: 5.3, startsFull: 30, cgRate: 0.008, fipConst: 3.20 },
});

// Per-decade clamp bounds + delta coefficients, the pitcher-side STAT_CAL. `up`/`down` are the
// per-point coefficients on the build's age-adjusted edge over neutral (up when the edge helps the
// stat, down when it's a negative edge). ERA is expressed in ERA+ space (higher edge -> higher
// ERA+), then converted back to a raw ERA and clamped to [eraLo, eraHi]. bb9/hr9/h9 are inverted
// like ERA (a better arm allows fewer). Ceiling refs: Gibson 1968 (1.12 ERA / 258 ERA+), Maddux
// 1994-95 (~1.60 / ~270), Pedro 2000 (1.74 / 291, the all-time mark), deGrom 2018-21 & Sale 2018
// (~13-14 K/9 as a starter), Maddux/Hughes (sub-1.0 BB/9).
export const PITCH_STAT_CAL = Object.freeze({
  "1960s": { eraLo:1.05, eraHi:6.20, k9:{ up:0.115, down:0.075, lo:2.6, hi:11.5 }, bb9:{ up:0.052, down:0.060, lo:0.9, hi:6.8 }, hr9:{ up:0.013, down:0.011, lo:0.20, hi:1.9 }, h9:{ up:0.085, down:0.070, lo:5.4, hi:11.5 } },
  "1970s": { eraLo:1.05, eraHi:6.20, k9:{ up:0.115, down:0.075, lo:2.4, hi:11.0 }, bb9:{ up:0.053, down:0.060, lo:0.9, hi:7.0 }, hr9:{ up:0.012, down:0.010, lo:0.18, hi:1.8 }, h9:{ up:0.085, down:0.070, lo:5.4, hi:11.6 } },
  "1980s": { eraLo:1.30, eraHi:6.40, k9:{ up:0.120, down:0.078, lo:2.8, hi:11.8 }, bb9:{ up:0.053, down:0.060, lo:1.0, hi:7.0 }, hr9:{ up:0.014, down:0.011, lo:0.24, hi:2.0 }, h9:{ up:0.086, down:0.070, lo:5.6, hi:11.8 } },
  "1990s": { eraLo:1.45, eraHi:6.80, k9:{ up:0.130, down:0.082, lo:3.2, hi:12.6 }, bb9:{ up:0.055, down:0.062, lo:1.0, hi:7.4 }, hr9:{ up:0.016, down:0.012, lo:0.32, hi:2.3 }, h9:{ up:0.090, down:0.072, lo:5.8, hi:12.2 } },
  "2000s": { eraLo:1.55, eraHi:6.90, k9:{ up:0.132, down:0.083, lo:3.4, hi:12.8 }, bb9:{ up:0.055, down:0.062, lo:1.0, hi:7.4 }, hr9:{ up:0.017, down:0.013, lo:0.38, hi:2.4 }, h9:{ up:0.090, down:0.072, lo:5.9, hi:12.2 } },
  "2010s": { eraLo:1.50, eraHi:6.70, k9:{ up:0.150, down:0.090, lo:4.0, hi:14.6 }, bb9:{ up:0.056, down:0.063, lo:0.9, hi:7.2 }, hr9:{ up:0.017, down:0.013, lo:0.36, hi:2.4 }, h9:{ up:0.092, down:0.073, lo:5.4, hi:11.8 } },
  "2020s": { eraLo:1.55, eraHi:6.90, k9:{ up:0.165, down:0.095, lo:4.4, hi:15.4 }, bb9:{ up:0.056, down:0.063, lo:0.9, hi:7.6 }, hr9:{ up:0.018, down:0.014, lo:0.42, hi:2.6 }, h9:{ up:0.092, down:0.073, lo:5.2, hi:11.6 } },
});

// The talent-edge -> ERA+ response is era-independent (ERA+ is already era-normalized) and
// deliberately convex: an average regular (edge ~+17) lands around a 116 ERA+, an ace (~+27)
// around 145, and only a truly maxed build (~+34) reaches the ~190 that historically means a
// Cy Young. A negative edge decays more gently (a replacement-level starter is ~70-80, not 20).
const ERA_PLUS_UP_K = 0.035, ERA_PLUS_UP_P = 2.17;
const ERA_PLUS_DOWN_K = 0.55, ERA_PLUS_DOWN_P = 1.5;

// Rivals/rotation entities are driven off a single `talent` scalar rather than a 12-tool build; the
// raw edge is nudged by this factor before it hits the response curve, the mound-side twin of
// RIVAL_STAT_SCALE. Tuned so a talent-88 rotation arm reads as a solid #2 (~ERA+ 122) and a
// talent-99 as a perennial ace (~ERA+ 152), not an every-year Pedro 2000.
export const ROTATION_STAT_SCALE = 0.85;

// Pitchers age differently than hitters: velocity peaks early (mid-20s) and command/guile hold up
// longer, so the aggregate curve peaks around 27-28 and declines more gently than a hitter's until
// a steeper drop past 35. Mirrors the shape of primeMultiplier in main.js but shifted.
export function pitcherPrimeMultiplier(age) {
  const pts = [[20, 0.72], [23, 0.88], [26, 0.99], [28, 1.0], [31, 0.98], [33, 0.92], [35, 0.83], [37, 0.70], [39, 0.55], [42, 0.38]];
  if (age <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) {
    if (age <= pts[i][0]) {
      const [a0, m0] = pts[i - 1], [a1, m1] = pts[i];
      return m0 + (m1 - m0) * (age - a0) / (a1 - a0);
    }
  }
  return pts[pts.length - 1][1];
}

// The core: an age/era-adjusted rate expectation for a given talent edge over neutral (65). Returns
// per-9 rates plus the implied ERA+ and ERA. `scale` compresses the raw edge (1 for the player's
// own precise build, ROTATION_STAT_SCALE for a talent-scalar entity).
// `facets` (optional) gives the tool groups direct, individual responsibilities instead of
// collapsing them all into one `talent` scalar (review finding 9): { stuff } drives K/9 and
// contact quality (H/9, HR/9), { command } drives BB/9. Each facet defaults to `talent`, so a
// caller that only has a talent scalar (every rival) gets exactly the old behavior. ERA+ still
// blends everything (it's the overall).
export function pitcherExpectedRates(talent, age, decade, scale = 1, facets = null) {
  const lg = PITCH_LEAGUE[decade] || PITCH_LEAGUE["2000s"];
  const cal = PITCH_STAT_CAL[decade] || PITCH_STAT_CAL["2000s"];
  const aged = pitcherPrimeMultiplier(age) * scale;
  const edge = (Number(talent) - 65) * aged;
  const stuffEdge = ((facets && Number.isFinite(facets.stuff) ? facets.stuff : talent) - 65) * aged;
  const cmdEdge = ((facets && Number.isFinite(facets.command) ? facets.command : talent) - 65) * aged;
  // Pickoff & Hold -> running-game suppression: holding runners close cuts the extra base that
  // turns a single into a run. A small, ERA-level effect (no separate SB-allowed stat is modelled).
  const holdEdge = ((facets && Number.isFinite(facets.hold) ? facets.hold : talent) - 65) * aged;
  const eraPlusDelta = (edge >= 0
    ? ERA_PLUS_UP_K * Math.pow(edge, ERA_PLUS_UP_P)
    : -ERA_PLUS_DOWN_K * Math.pow(-edge, ERA_PLUS_DOWN_P)) + holdEdge * 0.20;
  const eraPlus = clamp(100 + eraPlusDelta, 28, 320);
  const era = clamp(lg.era * 100 / eraPlus, cal.eraLo, cal.eraHi);
  const k9 = clamp(lg.k9 + stuffEdge * (stuffEdge >= 0 ? cal.k9.up : cal.k9.down), cal.k9.lo, cal.k9.hi);
  const bb9 = clamp(lg.bb9 - cmdEdge * (cmdEdge >= 0 ? cal.bb9.up : cal.bb9.down), cal.bb9.lo, cal.bb9.hi);
  const hr9 = clamp(lg.hr9 - stuffEdge * (stuffEdge >= 0 ? cal.hr9.up : cal.hr9.down), cal.hr9.lo, cal.hr9.hi);
  const h9 = clamp(lg.h9 - stuffEdge * (stuffEdge >= 0 ? cal.h9.up : cal.h9.down), cal.h9.lo, cal.h9.hi);
  const whip = (bb9 + h9) / 9;
  return { eraPlus, era, k9, bb9, hr9, h9, whip };
}

// FIP on the decade's ERA scale from the raw event counts.
export function fip(k, bb, hr, ip, decade) {
  const lg = PITCH_LEAGUE[decade] || PITCH_LEAGUE["2000s"];
  if (!ip) return lg.era;
  return clamp((13 * hr + 3 * bb - 2 * k) / ip + lg.fipConst, 0.5, 12);
}

// A full pitcher season line. `role` is "SP" | "SU" | "CL". `teamGrade` is the club's 0-99 quality
// (drives run support -> W/L, and save/hold opportunities for relievers). `random` defaults to
// Math.random so a caller can pass a seeded stream. `availabilityShare` in (0,1] scales the
// workload down for a partial season (injury, call-up, demotion). Returns raw counting stats plus
// the standard rate stats and the award-relevant indices.
export function simulatePitcherLine({ talent, age, decade, role = "SP", teamGrade = 65, random = Math.random, availabilityShare = 1, scale = 1, facets = null } = {}) {
  const lg = PITCH_LEAGUE[decade] || PITCH_LEAGUE["2000s"];
  const exp = pitcherExpectedRates(talent, age, decade, scale, facets);

  // bell-shaped season swing, mean 0, in [-1,1] (three-uniform average -- same technique as the
  // hitter path's performanceIndexRoll)
  const swing = clamp(((random() + random() + random()) / 3) * 2 - 1, -1, 1);
  const swingMult = clamp(1 + swing * 0.18, 0.80, 1.20);

  const cal = PITCH_STAT_CAL[decade] || PITCH_STAT_CAL["2000s"];
  const era = clamp(exp.era * (2 - swingMult), cal.eraLo, cal.eraHi);
  // re-clamp to the era bounds AFTER the season swing -- exp.* is already clamped, but the swing
  // multiplier can push a maxed build back over the ceiling.
  const k9 = clamp(exp.k9 * swingMult, cal.k9.lo, cal.k9.hi);
  const bb9 = clamp(exp.bb9 * (2 - swingMult), cal.bb9.lo, cal.bb9.hi);
  const hr9 = clamp(exp.hr9 * (2 - swingMult), cal.hr9.lo, cal.hr9.hi);
  const h9 = clamp(exp.h9 * (2 - swingMult), cal.h9.lo, cal.h9.hi);

  // Durability -> availability (how many starts stay healthy); Stamina -> depth per start.
  const durTool = facets && Number.isFinite(facets.durability) ? facets.durability : talent;
  const stamTool = facets && Number.isFinite(facets.stamina) ? facets.stamina : talent;
  const dur = clamp(0.7 + (durTool - 65) * 0.005, 0.5, 1.08);
  let gs = 0, gp = 0, ip = 0, sv = 0, hld = 0, cg = 0, sho = 0, qs = 0;

  if (role === "SP") {
    gs = Math.round(clamp(lg.startsFull * dur, 6, 38) * availabilityShare);
    const ipPerStart = clamp(lg.ipPerStart + (stamTool - 65) * 0.022 + (talent - 65) * 0.006, 4.2, 8.4);
    ip = Math.round(gs * ipPerStart * 10) / 10;
    gp = gs;
    cg = Math.round(clamp(gs * lg.cgRate * (0.5 + (talent - 65) * 0.03), 0, gs));
    sho = Math.round(clamp(cg * 0.35, 0, cg));
    qs = Math.round(clamp(gs * clamp(0.42 + (exp.eraPlus - 100) * 0.006, 0.1, 0.85), 0, gs));
  } else {
    gp = Math.round(clamp((role === "CL" ? 62 : 70) * dur, 20, 78) * availabilityShare);
    const ipPerApp = role === "CL" ? 1.05 : (decade === "1970s" || decade === "1960s" ? 1.9 : 1.25);
    ip = Math.round(gp * ipPerApp * 10) / 10;
    const teamWinsEstimate = clamp(0.5 + (teamGrade - 65) * 0.011, 0.32, 0.66) * lg.startsFull * 4.6;
    if (role === "CL") sv = Math.round(clamp(teamWinsEstimate * 0.52 * clamp(0.6 + (talent - 65) * 0.02, 0.3, 1.15), 0, 62) * availabilityShare);
    else hld = Math.round(clamp(gp * 0.42 * clamp(0.6 + (talent - 65) * 0.02, 0.3, 1.2), 0, gp) * availabilityShare);
  }

  ip = Math.max(0, ip);
  const k = Math.round(k9 * ip / 9);
  const bb = Math.round(bb9 * ip / 9);
  const hr = Math.round(hr9 * ip / 9);
  const h = Math.round(h9 * ip / 9);
  const er = Math.round(era * ip / 9);
  const whip = ip > 0 ? Math.round(((bb + h) / ip) * 1000) / 1000 : 0;
  const eraPlus = era > 0 ? Math.round(lg.era * 100 / era) : 100;
  const fipVal = Math.round(fip(k, bb, hr, ip, decade) * 100) / 100;

  // W/L: run support scales with the club; an ace on a bad team still wins, just fewer.
  let w = 0, l = 0;
  if (role === "SP") {
    const decisions = Math.round(gs * clamp(0.72 - (decade === "2010s" || decade === "2020s" ? 0.12 : 0), 0.5, 0.8));
    const winRate = clamp(0.5 + (eraPlus - 100) * 0.0045 + (teamGrade - 65) * 0.006, 0.15, 0.86);
    w = Math.round(decisions * winRate);
    l = decisions - w;
  } else {
    const decisions = Math.round(gp * 0.14);
    const winRate = clamp(0.5 + (eraPlus - 100) * 0.003 + (teamGrade - 65) * 0.004, 0.2, 0.8);
    w = Math.round(decisions * winRate);
    l = decisions - w;
  }

  return {
    role, gs, gp, ip, w, l, sv, hld, cg, sho, qs,
    k, bb, hr, h, er,
    era: Math.round(era * 100) / 100,
    whip, eraPlus, fip: fipVal,
    k9: Math.round(k9 * 10) / 10, bb9: Math.round(bb9 * 10) / 10, hr9: Math.round(hr9 * 10) / 10,
    kbbRatio: bb > 0 ? Math.round((k / bb) * 100) / 100 : k,
    // A single "how good was this season" index on the 100-centered ERA+ scale, blended with FIP so
    // a lucky low-ERA/high-FIP year doesn't fully count. This is what Cy Young / HOF logic ranks on.
    seasonIndex: Math.round(0.7 * eraPlus + 0.3 * (lg.era * 100 / Math.max(0.5, fipVal))),
    swing,
  };
}

// Cy Young-style season score: era-relative run prevention first, then workload, then the
// peripheral (K) and the counting glamour stats (W, SV). Comparative -- the league's single highest
// wins -- so the absolute scale only needs to be internally consistent.
export function cyYoungScore(line, decade) {
  const lg = PITCH_LEAGUE[decade] || PITCH_LEAGUE["2000s"];
  if (!line || !line.ip) return 0;
  const runPrevention = (line.eraPlus - 100) * 0.9 + (lg.era * 100 / Math.max(0.5, line.fip) - 100) * 0.4;
  const workload = line.role === "SP" ? Math.max(0, line.ip - lg.ipPerStart * 20) * 0.10 : line.ip * 0.05;
  const peripherals = (line.k9 - lg.k9) * 3 + (lg.bb9 - line.bb9) * 4;
  const glamour = line.role === "CL" ? line.sv * 0.8 : Math.max(0, line.w - 10) * 1.4;
  return runPrevention + workload + peripherals + glamour;
}
