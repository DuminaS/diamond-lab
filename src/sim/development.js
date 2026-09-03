// Pure player-development model. The browser adapter in main.js owns narrative
// logging; this module owns every numeric rule so balance tests cannot silently
// drift away from production behavior.

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export const DEVELOPMENT_ATTRIBUTE_GROUPS = Object.freeze({
  ARM: "physical", REL: "physical", MOB: "physical", IMP: "physical",
  DAC: "hitting", SHA: "hitting", TCH: "hitting", PKT: "hitting",
  ANT: "mental", DEC: "mental", CLU: "mental", DUR: "mental",
});

export const DEVELOPMENT_ATTRIBUTE_KEYS = Object.freeze(Object.keys(DEVELOPMENT_ATTRIBUTE_GROUPS));

const freezePlan = plan => Object.freeze({
  ...plan,
  growth: Object.freeze({ ...plan.growth }),
  decline: Object.freeze({ ...plan.decline }),
  targetKeys: Object.freeze([...(plan.targetKeys || [])]),
});

// One offseason buys one program. The multipliers only affect positive ordinary
// development; decline has its own table so, for example, Recovery can protect
// an older player's body without also becoming the best way to gain ratings.
export const DEVELOPMENT_PLANS = Object.freeze({
  balanced: freezePlan({
    id: "balanced", label: "Balanced Program", icon: "BAL",
    summary: "No shortcuts and no major weakness: steady work across the whole game.",
    growth: { physical: 1, hitting: 1, mental: 1 },
    decline: { physical: 1, hitting: 1, mental: 1 },
    injuryRisk: 1, wearDelta: 0, chemistryDelta: 1,
    targetKeys: DEVELOPMENT_ATTRIBUTE_KEYS.filter(key => key !== "DUR"),
  }),
  mechanics: freezePlan({
    id: "mechanics", label: "Mechanics Lab", icon: "ACC",
    summary: "Accelerate hitting work, but sacrifice athletic and mental-development time.",
    growth: { physical: 0.70, hitting: 1.40, mental: 0.85 },
    decline: { physical: 1, hitting: 0.95, mental: 1 },
    injuryRisk: 1.04, wearDelta: 1, chemistryDelta: -3,
    breakthroughBonus: 0.008,
    targetKeys: ["DAC", "SHA", "TCH", "PKT"],
  }),
  film: freezePlan({
    id: "film", label: "Film Room", icon: "IQ",
    summary: "Build anticipation, decisions, and clutch processing while physical work takes a back seat.",
    growth: { physical: 0.65, hitting: 0.80, mental: 1.50 },
    decline: { physical: 1, hitting: 0.95, mental: 0.85 },
    injuryRisk: 0.96, wearDelta: -1, chemistryDelta: -2,
    breakthroughBonus: 0.008,
    targetKeys: ["ANT", "DEC", "CLU"],
  }),
  athletic: freezePlan({
    id: "athletic", label: "Athletic Camp", icon: "PHY",
    summary: "Chase arm and movement gains through a harder workload with real injury and wear costs.",
    growth: { physical: 1.55, hitting: 0.70, mental: 0.65 },
    decline: { physical: 1.15, hitting: 1, mental: 1 },
    injuryRisk: 1.18, wearDelta: 4, chemistryDelta: -4,
    breakthroughBonus: 0.012,
    targetKeys: ["ARM", "REL", "MOB", "IMP"],
  }),
  chemistry: freezePlan({
    id: "chemistry", label: "Chemistry Camp", icon: "TEAM",
    summary: "Trade individual growth for timing, trust, and a small on-field team edge this season.",
    growth: { physical: 0.80, hitting: 0.80, mental: 0.85 },
    decline: { physical: 1, hitting: 1, mental: 1 },
    injuryRisk: 0.96, wearDelta: 0, chemistryDelta: 14,
    targetKeys: ["ANT", "DEC", "CLU", "TCH"],
  }),
  recovery: freezePlan({
    id: "recovery", label: "Recovery & Rehab", icon: "REST",
    summary: "Give up most growth to shed wear, lower injury risk, and slow age-related decline.",
    growth: { physical: 0.45, hitting: 0.45, mental: 0.45 },
    decline: { physical: 0.45, hitting: 0.55, mental: 0.65 },
    injuryRisk: 0.70, wearDelta: -12, chemistryDelta: -1,
    targetKeys: [],
  }),
});

export const DEVELOPMENT_PLAN_LIST = Object.freeze(Object.values(DEVELOPMENT_PLANS));

export function developmentPlanFor(planId) {
  return DEVELOPMENT_PLANS[planId] || DEVELOPMENT_PLANS.balanced;
}

// Chemistry naturally slides 25% of the way back toward neutral every
// offseason before the selected program is applied. This prevents Chemistry
// Camp from becoming a permanent one-click buff while still rewarding repeats.
export function applyOffseasonPlanResources(resources, planId) {
  const plan = developmentPlanFor(planId);
  const wear = clamp(Number(resources?.wear || 0) + plan.wearDelta, 0, 100);
  const currentChemistry = Number(resources?.chemistry ?? 50);
  const retainedChemistry = 50 + (currentChemistry - 50) * 0.75;
  const chemistry = clamp(retainedChemistry + plan.chemistryDelta, 0, 100);
  return { wear, chemistry, plan };
}

export function evaluatePerformanceOverExpectation(input = {}) {
  const actual = input.actual || {};
  const expected = input.expected || {};
  const attempts = Math.max(0, Number(actual.attempts || 0));
  const leagueGames = Math.max(1, Number(input.leagueGames || 17));
  if (attempts < 20) {
    return {
      index: 0, label: "No meaningful sample", reliability: 0,
      components: { completion: 0, yardsPerAttempt: 0, touchdowns: 0, interceptions: 0 },
    };
  }

  const actualCompletion = attempts ? Number(actual.completions || 0) / attempts : 0;
  const actualYpa = attempts ? Number(actual.yards || 0) / attempts : 0;
  const actualTdRate = attempts ? Number(actual.touchdowns || 0) / attempts : 0;
  const actualIntRate = attempts ? Number(actual.interceptions || 0) / attempts : 0;
  const components = {
    completion: clamp((actualCompletion - Number(expected.completionPct || 0)) / 0.055, -1.5, 1.5),
    yardsPerAttempt: clamp((actualYpa - Number(expected.yardsPerAttempt || 0)) / 1.10, -1.5, 1.5),
    touchdowns: clamp((actualTdRate - Number(expected.touchdownRate || 0)) / 0.025, -1.5, 1.5),
    interceptions: clamp((Number(expected.interceptionRate || 0) - actualIntRate) / 0.020, -1.5, 1.5),
  };
  const raw = components.completion * 0.25 + components.yardsPerAttempt * 0.30
    + components.touchdowns * 0.20 + components.interceptions * 0.25;
  // About 30 attempts per scheduled game is a full starter sample. Small
  // samples can still be encouraging, but cannot manufacture a breakthrough.
  const reliability = clamp(Math.sqrt(attempts / (leagueGames * 30)), 0.15, 1);
  const index = clamp(raw * reliability, -1, 1);
  const label = index >= 0.55 ? "Crushed expectations"
    : index >= 0.25 ? "Outperformed"
    : index <= -0.55 ? "Collapsed below expectations"
    : index <= -0.25 ? "Underperformed"
    : "Met expectations";
  return { index, label, reliability, components };
}

export function nextBreakthroughMomentum(current, performanceIndex, gamesPlayed, leagueGames) {
  const share = leagueGames > 0 ? gamesPlayed / leagueGames : 0;
  let delta;
  if (share < 0.40) delta = -6;
  else if (performanceIndex >= 0.55) delta = Math.round(12 + (performanceIndex - 0.55) * 20);
  else if (performanceIndex >= 0.25) delta = 6;
  else if (performanceIndex >= 0.05) delta = 1;
  else if (performanceIndex <= -0.25) delta = -10;
  else delta = -4;
  return clamp(Number(current || 0) + delta, 0, 100);
}

export function earnedBreakthroughChance({ momentum, performanceIndex, age, devSpeed, planId, count }) {
  if (age > 31 || performanceIndex < 0.50 || momentum < 45 || count >= 3 || planId === "recovery") return 0;
  const plan = developmentPlanFor(planId);
  return clamp(0.012 + (momentum - 45) * 0.0007 + (performanceIndex - 0.50) * 0.05
    + Math.max(0, devSpeed - 1) * 0.025 + Number(plan.breakthroughBonus || 0), 0, 0.075);
}

// Rates are raw fractional attribute points per full season before player,
// coaching, organization, and variance multipliers. Compared with the original
// 1.6/2.2/2.6 opening rates, these preserve visible growth without making a
// broad 8-12 point climb the default outcome for every healthy starter.
export const DEVELOPMENT_CURVES = Object.freeze({
  physical: Object.freeze([[22,1.00],[25,0.65],[27,0],[30,-0.40],[33,-0.90],[36,-1.50],[39,-2.20],[42,-3.00]]),
  hitting: Object.freeze([[22,1.45],[25,1.15],[28,0.60],[31,0],[34,-0.40],[37,-0.90],[40,-1.50]]),
  mental: Object.freeze([[22,1.75],[25,1.45],[28,0.95],[31,0.50],[34,0],[37,-0.20],[40,-0.45],[43,-0.70]]),
});

export function curveValue(points, age) {
  if (age <= points[0][0]) return points[0][1];
  for (let index = 0; index < points.length - 1; index++) {
    const [age0, value0] = points[index];
    const [age1, value1] = points[index + 1];
    if (age >= age0 && age <= age1) {
      const ratio = (age - age0) / (age1 - age0);
      return value0 + (value1 - value0) * ratio;
    }
  }
  return points[points.length - 1][1];
}

export function developmentBaseForGroup(group, age) {
  return curveValue(DEVELOPMENT_CURVES[group] || DEVELOPMENT_CURVES.mental, age);
}

// OVERALL_WEIGHTS resolve to 10% physical, 52% hitting, and 38% mental.
// Rival QBs use one talent scalar, so this is the matching weighted development
// curve for that scalar rather than a separate, more or less generous species.
export function developmentBaseForOverall(age) {
  return developmentBaseForGroup("physical", age) * 0.10
    + developmentBaseForGroup("hitting", age) * 0.52
    + developmentBaseForGroup("mental", age) * 0.38;
}

export function rollDevelopmentSpeed(random = Math.random) {
  const bellRoll = (random() + random() + random()) / 3;
  return clamp(0.6 + bellRoll * 0.8, 0.6, 1.4);
}

export function developmentSpeedTag(speed) {
  if (speed < 0.6) return "Recovering Prospect"; // compatibility with old saves
  if (speed < 0.75) return "Slow Burn";
  if (speed < 0.9) return "Steady Riser";
  if (speed < 1.1) return "Standard Development";
  if (speed < 1.25) return "Quick Study";
  if (speed <= 1.4) return "Ascending Fast";
  return "Legacy Breakout Profile"; // compatibility with old pre-balance saves
}

export function developmentExperienceFactor(gamesPlayed, leagueGames) {
  const share = leagueGames > 0 ? gamesPlayed / leagueGames : 0;
  return clamp(0.25 + share * 0.75, 0.25, 1.0);
}

export function developmentCoachingMultiplier(coaching) {
  return clamp(0.90 + (Number(coaching ?? 60) / 100) * 0.20, 0.90, 1.10);
}

export function developmentSwingChance(speed, age, organization = "normal") {
  const ageBase = age <= 32 ? 0.015 : age <= 36 ? 0.0075 : 0.004;
  const orgDelta = organization === "stable" ? 0.005 : organization === "turmoil" ? -0.005 : 0;
  return clamp(ageBase + Math.abs(speed - 1) * 0.05 + orgDelta, 0.005, 0.05);
}

function shuffled(values, random) {
  const copy = [...values];
  for (let index = copy.length - 1; index > 0; index--) {
    const swapIndex = Math.floor(random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

export function advanceDevelopmentSeason(state, context, random = Math.random) {
  const build = { ...state.build };
  const originalBuild = { ...(state.originalBuild || state.build) };
  const carry = { ...(state.carry || {}) };
  const ceilingBonus = { ...(state.ceilingBonus || {}) };
  // Old saves may contain self-amplified values up to 1.8. Normalize those back
  // into the documented prospect roll without invalidating the save.
  const devSpeed = clamp(Number(state.devSpeed ?? 1), 0.6, 1.4);
  let breakoutCount = Number(state.breakoutCount || 0);
  let bustCount = Number(state.bustCount || 0);
  let earnedBreakthroughCount = Number(state.earnedBreakthroughCount || 0);
  const changes = [];
  const organization = context.orgStability ? "stable" : context.orgTurmoil ? "turmoil" : "normal";
  const orgMultiplier = organization === "stable" ? 1.08 : organization === "turmoil" ? 0.85 : 1;
  const experienceFactor = developmentExperienceFactor(context.gamesPlayed, context.leagueGames);
  const coachingMultiplier = developmentCoachingMultiplier(context.coaching);
  const plan = developmentPlanFor(context.planId);
  const performance = context.performanceIndex == null
    ? evaluatePerformanceOverExpectation(context.performance)
    : {
        index: clamp(Number(context.performanceIndex || 0), -1, 1),
        label: context.performanceLabel || "Met expectations",
        reliability: Number(context.performanceReliability ?? 1),
        components: context.performanceComponents || {},
      };
  const performanceMultiplier = clamp(1 + performance.index * 0.22, 0.78, 1.22);
  const momentumBefore = clamp(Number(state.breakthroughMomentum || 0), 0, 100);
  let breakthroughMomentum = nextBreakthroughMomentum(
    momentumBefore,
    performance.index,
    context.gamesPlayed,
    context.leagueGames,
  );

  for (const key of DEVELOPMENT_ATTRIBUTE_KEYS) {
    if (key === "DUR" || !Number.isFinite(build[key])) continue;
    const group = DEVELOPMENT_ATTRIBUTE_GROUPS[key];
    const base = developmentBaseForGroup(group, context.age);
    const planMultiplier = base >= 0 ? plan.growth[group] : plan.decline[group];
    // Performance changes the rate of positive learning, not biological aging.
    // Recovery is the explicit choice for slowing decline.
    const performanceGrowthMultiplier = base >= 0 ? performanceMultiplier : 1;
    const variance = 0.85 + random() * 0.30;
    const delta = base * devSpeed * experienceFactor * orgMultiplier * coachingMultiplier
      * planMultiplier * performanceGrowthMultiplier * variance;
    carry[key] = (carry[key] || 0) + delta;
    const whole = Math.trunc(carry[key]);
    if (whole === 0) continue;
    carry[key] -= whole;

    const original = Number(originalBuild[key]);
    const maxGain = Math.round(11 * devSpeed);
    const low = clamp(original - 18, 10, 99);
    const high = clamp(original + maxGain + Number(ceilingBonus[key] || 0), 10, 99);
    const before = build[key];
    build[key] = clamp(build[key] + whole, low, high);
    if (build[key] !== before) changes.push({ key, delta: build[key] - before });
  }

  let arcEvent = null;
  const positiveEligible = DEVELOPMENT_ATTRIBUTE_KEYS.filter(key => key !== "DUR" && Number.isFinite(build[key]) && build[key] < 99);
  const negativeEligible = DEVELOPMENT_ATTRIBUTE_KEYS.filter(key => key !== "DUR" && Number.isFinite(build[key]) && build[key] > 10);
  const swingChance = developmentSwingChance(devSpeed, context.age, organization);

  if (positiveEligible.length >= 2 && random() < swingChance) {
    const orgDirection = organization === "stable" ? 0.04 : organization === "turmoil" ? -0.04 : 0;
    const breakoutProbability = clamp(0.5 + (devSpeed - 1) * 0.25 + orgDirection + performance.index * 0.08, 0.30, 0.70);
    const wantsBreakout = random() < breakoutProbability;
    // A second breakthrough is possible but genuinely exceptional. Neither a
    // boom nor a bust mutates devSpeed, eliminating the old runaway loop.
    const breakoutAllowed = breakoutCount < 2 && (breakoutCount === 0 || random() < 0.15);
    const bustAllowed = bustCount < 2;

    if (wantsBreakout && breakoutAllowed) {
      const picked = shuffled(positiveEligible, random).slice(0, Math.min(3, positiveEligible.length));
      const affected = [];
      for (const key of picked) {
        const before = build[key];
        const high = clamp(Number(originalBuild[key]) + 18 + Number(ceilingBonus[key] || 0), 10, 99);
        build[key] = clamp(build[key] + 3 + Math.floor(random() * 4), 10, high);
        if (build[key] !== before) {
          changes.push({ key, delta: build[key] - before, breakout: true });
          affected.push(key);
        }
      }
      if (affected.length) {
        breakoutCount++;
        arcEvent = { type: "breakout", keys: affected };
      }
    } else if (!wantsBreakout && bustAllowed) {
      const count = 2 + Math.floor(random() * 2);
      const picked = shuffled(negativeEligible, random).slice(0, Math.min(count, negativeEligible.length));
      const affected = [];
      for (const key of picked) {
        const before = build[key];
        const low = clamp(Number(originalBuild[key]) - 24, 10, 99);
        build[key] = clamp(build[key] - (2 + Math.floor(random() * 4)), low, 99);
        if (build[key] !== before) {
          changes.push({ key, delta: build[key] - before, regression: true });
          affected.push(key);
        }
      }
      if (affected.length) {
        bustCount++;
        arcEvent = { type: "bust", keys: affected };
      }
    }
  }

  // A generational leap is a different path from the ordinary boom/bust roll:
  // it requires several full seasons of beating this exact player's own talent-
  // based expectation, another excellent current year, an age window, and a
  // final low-probability roll. The chosen program determines what can leap.
  const earnedChance = earnedBreakthroughChance({
    momentum: breakthroughMomentum,
    performanceIndex: performance.index,
    age: context.age,
    devSpeed,
    planId: plan.id,
    count: earnedBreakthroughCount,
  });
  if (!arcEvent && earnedChance > 0 && random() < earnedChance) {
    const eligibleTargets = plan.targetKeys.filter(key => key !== "DUR" && Number.isFinite(build[key]) && build[key] < 99);
    const picked = shuffled(eligibleTargets, random).slice(0, Math.min(4, eligibleTargets.length));
    const affected = [];
    for (const key of picked) {
      const before = build[key];
      const gain = 4 + Math.floor(random() * 4);
      ceilingBonus[key] = clamp(Number(ceilingBonus[key] || 0) + gain, 0, 30);
      build[key] = clamp(build[key] + gain, 10, 99);
      if (build[key] !== before) {
        changes.push({ key, delta: build[key] - before, earnedBreakthrough: true });
        affected.push(key);
      }
    }
    if (affected.length) {
      earnedBreakthroughCount++;
      breakthroughMomentum = Math.max(0, breakthroughMomentum - 45);
      arcEvent = { type: "earned-breakthrough", keys: affected };
    }
  }

  return {
    build, originalBuild, carry, ceilingBonus, devSpeed,
    breakoutCount, bustCount, earnedBreakthroughCount,
    breakthroughMomentum, momentumBefore,
    changes, arcEvent, performance, performanceMultiplier,
    earnedBreakthroughChance: earnedChance,
    planId: plan.id,
  };
}
