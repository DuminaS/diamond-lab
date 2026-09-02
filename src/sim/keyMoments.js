// Pure Key Moment decision model shared by the browser game and any headless test/audit. Keep
// this module free of DOM and career-state access -- main.js owns the overlay rendering,
// narrative text, and score-swing application; this owns the actual decision math.
//
// Balance Wave 3 (difficulty/balance remediation brief item 2): replaces a permanent 1:1
// "this play call always counters that opponent tendency" answer key with a genuine contextual
// EV model. A call's tendency counter is still real signal, but it can be outweighed entirely by
// the situation's own structured flags -- so the textbook counter for a given tendency is no
// longer guaranteed to be the best choice once context (protecting a lead vs. needing a score,
// short vs. long yardage, how late/close the game is) disagrees with it. See the specific reported
// defect this fixes: "'control the clock' marked correct against prevent defense even when
// trailing late and needing a touchdown" -- controlclock's badWhen below (needScore/lateAndClose/
// explosiveNeeded) now outweighs its tendency-counter bonus in exactly that situation.

export const PLAY_CALLS = Object.freeze([
  Object.freeze({ id:"spreadthrow", label:"Spread them out and throw", countersTendencyId:"runheavy",
    goodWhen:Object.freeze(["explosiveNeeded","needScore","longYardage"]), badWhen:Object.freeze(["protectLead","ballSecurity","shortYardage"]),
    why:"A run-committed front leaves light coverage behind it — make them defend the whole field through the air." }),
  Object.freeze({ id:"quickgame", label:"Quick game — get the ball out fast", countersTendencyId:"blitzheavy",
    goodWhen:Object.freeze(["mustConvert","lateAndClose","shortYardage"]), badWhen:Object.freeze(["explosiveNeeded","longYardage"]),
    why:"Beat extra rushers before they arrive with a fast, pre-determined read." }),
  Object.freeze({ id:"attackmiddle", label:"Attack the middle of the field", countersTendencyId:"lockdowncorners",
    goodWhen:Object.freeze(["mustConvert"]), badWhen:Object.freeze(["protectLead"]),
    why:"Their corners are the strength — work the throws that never go near them." }),
  Object.freeze({ id:"controlclock", label:"Keep it on the ground, control the clock", countersTendencyId:"preventlate",
    goodWhen:Object.freeze(["protectLead","ballSecurity"]), badWhen:Object.freeze(["needScore","lateAndClose","explosiveNeeded"]),
    why:"Against a shell that's conceding everything underneath, don't force a shot you don't need." }),
  Object.freeze({ id:"checkdowns", label:"Play it safe — check downs only", countersTendencyId:"turnoverhunting",
    goodWhen:Object.freeze(["ballSecurity","protectLead","shortYardage"]), badWhen:Object.freeze(["explosiveNeeded","needScore","longYardage"]),
    why:"Ball-hawking safeties feed on risk — take what's guaranteed and live for the next down." }),
  Object.freeze({ id:"playaction", label:"Play-action to slow the rush", countersTendencyId:"physicalfront",
    goodWhen:Object.freeze(["explosiveNeeded"]), badWhen:Object.freeze(["lateAndClose"]),
    why:"A run fake buys a beat of hesitation from a front that's pinning its ears back." }),
  Object.freeze({ id:"horizontalstretch", label:"Stretch them horizontally with quick outs", countersTendencyId:"disciplinedzone",
    goodWhen:Object.freeze(["mustConvert"]), badWhen:Object.freeze(["shortYardage","explosiveNeeded"]),
    why:"A patient zone won't bite on a double move — make it defend sideline to sideline instead." }),
  Object.freeze({ id:"protectball", label:"Play conservative, protect the ball", countersTendencyId:"suddenchange",
    goodWhen:Object.freeze(["protectLead","ballSecurity"]), badWhen:Object.freeze(["needScore","mustConvert","explosiveNeeded"]),
    why:"Give this defense a short field off a turnover and they'll make it count — don't hand it to them." }),
]);

// Structured, machine-readable half of each situation (the prose the player reads lives in
// main.js's KEY_MOMENT_SITUATIONS, which carries the exact same ids/flags). protectLead/needScore/
// explosiveNeeded/shortYardage/longYardage/mustConvert/lateAndClose/ballSecurity are what
// keyMomentCallScore actually reasons about.
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

// The per-option expected-value score: +2 for directly countering the revealed tendency, +/-1.5
// per matching situational flag. A call's tendency counter alone (2) is deliberately smaller than
// two matching bad-fit flags (3), so a genuinely wrong-context call can't hide behind "but it
// counters the tendency" -- context can and does override the textbook answer.
export function keyMomentCallScore(call, tendencyId, situationFlags) {
  let score = call.countersTendencyId === tendencyId ? 2 : 0;
  for (const flag of call.goodWhen || []) if (situationFlags.includes(flag)) score += 1.5;
  for (const flag of call.badWhen || []) if (situationFlags.includes(flag)) score -= 1.5;
  return score;
}

// Ranks every play call for this exact tendency+situation pairing. The true best-EV call (across
// all 8) is always returned first so callers can guarantee it's presented as an option -- there's
// always a genuinely correct answer available to reward real reasoning, it just isn't the same
// call every time the same tendency shows up.
export function rankKeyMomentCalls(tendencyId, situationFlags, calls = PLAY_CALLS) {
  return [...calls]
    .map(call => ({ call, score: keyMomentCallScore(call, tendencyId, situationFlags) }))
    .sort((a, b) => b.score - a.score);
}

// Balance Wave 3: Key Moment execution variance. The "quality" a choice earns (good/meh/bad, from
// rankKeyMomentCalls) is a statement about the DECISION; this is what actually happens on the
// field once Clutch (a trait for executing under pressure, not for deciding whether to
// participate at all) gets a say. A low-Clutch player can occasionally blow the execution of a
// genuinely correct read; a high-Clutch player can occasionally salvage a bad one. "Meh" is
// deliberately untouched in both directions -- it's already the designed-neutral, capped tier.
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

// Balance Wave 3: trigger odds are leverage-only -- Clutch no longer decides whether the player is
// even allowed to participate (see the reported complaint: "Clutch should influence execution
// under pressure, not whether the player is allowed to participate"). Chosen as roughly the
// population-weighted average of the old clu-scaled 0.05-0.55 formula (most builds cluster in the
// 55-75 Clutch range, which used to land close to this same number) so total Key-Moment frequency
// across a career doesn't shift wildly for a typical build -- only WHO gets to see one changes.
export const KEY_MOMENT_BASE_TRIGGER_CHANCE = 0.28;
