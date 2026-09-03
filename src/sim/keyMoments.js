// Pure Key Moment decision model shared by the browser game and any headless test/audit. Keep
// this module free of DOM and career-state access -- main.js owns the overlay rendering,
// narrative text, and run-swing application; this owns the actual decision math.
//
// A clutch at-bat: the pitcher has a revealed archetype (fastball-heavy, chase-bait, crafty lefty,
// ...), and the situation carries structured flags. A batter approach's archetype counter is real
// signal, but the situation can outweigh it entirely -- "take your walk against a nibbler" is the
// textbook answer, and it is flatly WRONG when you need the run in and a walk doesn't force it.
//
// The eight approach ids are inherited unchanged from the Gridiron Lab skeleton (the balance tests
// and the archetype-counter map key off them); only the labels, the goodWhen/badWhen fits, and the
// reasoning text changed for baseball. The eight situation FLAGS also keep their inherited names --
// their baseball meaning:
//   protectLead   up multiple runs, nothing to chase
//   needScore     trailing, a run has to come across
//   explosiveNeeded  down multiple -- a single barely matters, you need to drive one
//   shortYardage  runner on third / in scoring position, a ball in play scores him
//   longYardage   a single won't change much (bases empty, or down several)
//   mustConvert   two out, RISP -- this at-bat is the whole inning
//   lateAndClose  late innings, one-run game
//   ballSecurity  don't press, don't be the rally-killing out, avoid the double play

export const PLAY_CALLS = Object.freeze([
  Object.freeze({ id:"spreadthrow", label:"Sit dead-red — gear up for the fastball", countersTendencyId:"runheavy",
    goodWhen:Object.freeze(["explosiveNeeded","needScore","longYardage"]), badWhen:Object.freeze(["protectLead","ballSecurity","shortYardage"]),
    why:"He's going to challenge you with the heater — be on time for it and drive it, don't get beat in the zone." }),
  Object.freeze({ id:"quickgame", label:"Ambush — jump the first hittable pitch", countersTendencyId:"blitzheavy",
    goodWhen:Object.freeze(["mustConvert","lateAndClose","shortYardage"]), badWhen:Object.freeze(["explosiveNeeded","longYardage"]),
    why:"He wants to get ahead with a first-pitch strike — take that pitch away from him before he can bury you 0-1." }),
  Object.freeze({ id:"attackmiddle", label:"Spit on the corners — hunt the pitch over the plate", countersTendencyId:"lockdowncorners",
    goodWhen:Object.freeze(["mustConvert"]), badWhen:Object.freeze(["protectLead"]),
    why:"His edges are the whole game — lay off them and make him come back over the plate." }),
  Object.freeze({ id:"controlclock", label:"Take your walk — don't expand the zone", countersTendencyId:"preventlate",
    goodWhen:Object.freeze(["protectLead","ballSecurity"]), badWhen:Object.freeze(["needScore","lateAndClose","explosiveNeeded"]),
    why:"He won't give in with a lead — don't chase, and make him put you on." }),
  Object.freeze({ id:"checkdowns", label:"Two-strike approach — protect the plate", countersTendencyId:"turnoverhunting",
    goodWhen:Object.freeze(["ballSecurity","protectLead","shortYardage"]), badWhen:Object.freeze(["explosiveNeeded","needScore","longYardage"]),
    why:"He lives off the chase pitch just off the plate — shorten up, spoil it, and live for the next one." }),
  Object.freeze({ id:"playaction", label:"Get your A-swing off — look to drive one", countersTendencyId:"physicalfront",
    goodWhen:Object.freeze(["explosiveNeeded"]), badWhen:Object.freeze(["lateAndClose"]),
    why:"His fastball gets on you late — start your swing early, get the barrel there, and don't miss the one to hit." }),
  Object.freeze({ id:"horizontalstretch", label:"Work a deep count — wear him down", countersTendencyId:"disciplinedzone",
    goodWhen:Object.freeze(["mustConvert"]), badWhen:Object.freeze(["shortYardage","explosiveNeeded"]),
    why:"He never shows a pattern — make him throw strikes, foul off the tough ones, and take the walk if it's there." }),
  Object.freeze({ id:"protectball", label:"Stay within yourself — don't try to do too much", countersTendencyId:"suddenchange",
    goodWhen:Object.freeze(["protectLead","ballSecurity"]), badWhen:Object.freeze(["needScore","mustConvert","explosiveNeeded"]),
    why:"He finds another gear with a runner on — a smooth, simple swing beats trying to be the hero here." }),
]);

// Structured, machine-readable half of each situation (the prose the player reads lives in
// main.js's KEY_MOMENT_SITUATIONS, which carries the exact same ids/flags).
export const KEY_MOMENT_SITUATION_FLAGS = Object.freeze({
  km_e1: Object.freeze([]),
  km_e2: Object.freeze(["protectLead","ballSecurity"]),
  km_e3: Object.freeze(["mustConvert"]),
  km_e4: Object.freeze([]),
  km_e5: Object.freeze(["shortYardage"]),
  km_e6: Object.freeze(["shortYardage","mustConvert"]),
  km_m1: Object.freeze(["mustConvert","lateAndClose"]),
  km_m2: Object.freeze(["longYardage","explosiveNeeded"]),
  km_m3: Object.freeze(["needScore","lateAndClose"]),
  km_m4: Object.freeze(["needScore","mustConvert"]),
  km_m5: Object.freeze(["needScore"]),
  km_m6: Object.freeze(["mustConvert","lateAndClose"]),
  km_h1: Object.freeze(["needScore","mustConvert","lateAndClose"]),
  km_h2: Object.freeze(["longYardage","explosiveNeeded","mustConvert"]),
  km_h3: Object.freeze(["needScore","mustConvert","lateAndClose"]),
  km_h4: Object.freeze(["longYardage","explosiveNeeded","needScore","lateAndClose"]),
  km_h5: Object.freeze(["shortYardage","protectLead","ballSecurity","lateAndClose"]),
  km_h6: Object.freeze(["shortYardage","protectLead","mustConvert"]),
});

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

// The per-option expected-value score: +2 for directly countering the revealed archetype, +/-1.5
// per matching situational flag. The archetype counter alone (2) is deliberately smaller than two
// matching bad-fit flags (3), so a wrong-context approach can't hide behind "but it counters the
// archetype" -- context can and does override the textbook answer.
export function keyMomentCallScore(call, tendencyId, situationFlags) {
  let score = call.countersTendencyId === tendencyId ? 2 : 0;
  for (const flag of call.goodWhen || []) if (situationFlags.includes(flag)) score += 1.5;
  for (const flag of call.badWhen || []) if (situationFlags.includes(flag)) score -= 1.5;
  return score;
}

// Ranks every approach for this exact archetype+situation pairing. The true best-EV approach
// (across all 8) is always returned first so callers can guarantee it's presented as an option --
// there's always a genuinely correct answer to reward real reasoning, it just isn't the same
// approach every time the same archetype shows up.
export function rankKeyMomentCalls(tendencyId, situationFlags, calls = PLAY_CALLS) {
  return [...calls]
    .map(call => ({ call, score: keyMomentCallScore(call, tendencyId, situationFlags) }))
    .sort((a, b) => b.score - a.score);
}

// Key Moment execution variance. The "quality" a choice earns (good/meh/bad, from the ranking) is
// a statement about the DECISION; this is what actually happens in the box once Clutch (a trait
// for executing under pressure, not for deciding whether to participate) gets a say. A low-Clutch
// hitter can occasionally foul off the pitch he should have driven; a high-Clutch one can
// occasionally fight off a bad guess. "Meh" is untouched in both directions.
export function executeKeyMomentQuality(quality, clutch, random = Math.random) {
  if (quality === "good") {
    const slipChance = clamp(0.20 - (clutch - 50) * 0.003, 0.03, 0.30);
    return random() < slipChance ? "meh" : "good";
  }
  if (quality === "bad") {
    const saveChance = clamp((clutch - 50) * 0.004, 0, 0.20);
    return random() < saveChance ? "meh" : "bad";
  }
  return "meh";
}

// Trigger odds are leverage-only -- Clutch no longer decides whether the player even gets a clutch
// at-bat, only how it's executed once it happens. Roughly the population-weighted average of the
// old clu-scaled formula so total Key-Moment frequency across a career doesn't shift for a typical
// build -- only WHO gets one changes.
export const KEY_MOMENT_BASE_TRIGGER_CHANCE = 0.28;
