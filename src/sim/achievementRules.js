// Balance Wave 6 (difficulty/balance remediation brief item 5): "Structured event ledger and
// declarative expansion from the current achievements toward 250." This module is the declarative
// half of that: a small set of reusable, pure rule-builder primitives that turn "did X happen"
// into DATA (an event id, a team id, a count, an ordering) instead of a hand-rolled imperative
// closure scanning career.seasonLog/lifeEventLog by hand. Every ACHIEVEMENTS entry in main.js can
// still use whatever shape it wants (check: ()=>boolean) -- these builders just let a growing share
// of NEW entries be one-liners built from data, which is what "declarative" means here in practice.
// Kept free of DOM/career-state access (same convention as ratings.js/development.js/keyMoments.js/
// awards.js) so the rule shapes themselves are unit-testable headlessly against a fake career object.
//
// Two data sources these rules read, both already real, per-entry, structured records on `career`:
//   - career.seasonLog: one entry per season played (already rich -- teamId, teamOverall, awards,
//     playoffs, age, stat totals) -- most "team-specific" and "career arc" achievements fit here.
//   - career.eventLedger: a NEW flat log of narrative-scale events (see main.js's recordLedgerEvent),
//     each `{ eventId, year, seasonIndex, sequenceIndex, teamId, opponentId, choiceId, outcomeId,
//     severity, metadata }`, added alongside (not replacing) the older career.lifeEventLog so the
//     existing dark-humor achievements that already key off lifeEventLog's achievementId field keep
//     working untouched. sequenceIndex is a career-long monotonic counter (one shared timeline across
//     every event type) -- what sequenceRule orders against.

export function maxConsecutive(list, pred) {
  let max = 0, cur = 0;
  (list || []).forEach((x) => { if (pred(x)) { cur++; max = Math.max(max, cur); } else cur = 0; });
  return max;
}

// True if at least `atLeast` seasons in career.seasonLog satisfy `predicate`.
export function seasonRule(predicate, atLeast = 1) {
  return (career) => (career.seasonLog || []).filter(predicate).length >= atLeast;
}

// True if the longest consecutive run of seasons satisfying `predicate` reaches `atLeast`.
export function consecutiveSeasonRule(predicate, atLeast) {
  return (career) => maxConsecutive(career.seasonLog, predicate) >= atLeast;
}

// True if the career has at least `minSeasons` seasons AND every single one of them (not just a
// streak within a longer career) satisfies `predicate` -- a genuinely different shape from
// consecutiveSeasonRule, which is satisfied by any qualifying run inside a longer, mixed career.
// ("Play 10+ seasons and never once miss a game to injury" fails the moment ANY season anywhere in
// the career breaks it, even after 10 clean years already happened -- consecutiveSeasonRule would
// wrongly still call that a pass.)
export function everySeasonRule(predicate, minSeasons = 1) {
  return (career) => {
    const log = career.seasonLog || [];
    return log.length >= minSeasons && log.every(predicate);
  };
}

// True if at least `atLeast` ledger entries match every provided filter field. A filter field left
// undefined is not checked at all (so {eventId:"contract_signed"} alone counts every signing,
// regardless of team/choice/outcome).
export function eventCountRule({ eventId, teamId, opponentId, outcomeId, severity, choiceId } = {}, atLeast = 1) {
  return (career) => (career.eventLedger || []).filter((e) =>
    (eventId === undefined || e.eventId === eventId) &&
    (teamId === undefined || e.teamId === teamId) &&
    (opponentId === undefined || e.opponentId === opponentId) &&
    (outcomeId === undefined || e.outcomeId === outcomeId) &&
    (severity === undefined || e.severity === severity) &&
    (choiceId === undefined || e.choiceId === choiceId)
  ).length >= atLeast;
}

// True if `steps` (each a predicate over one ledger entry, OR a (entry, matchedSoFar)=>boolean for
// steps that need to reference an earlier step's own matched entry -- see sameFieldAs) all match IN
// ORDER somewhere in career.eventLedger -- the Nth step must match a later sequenceIndex than the
// (N-1)th. Doesn't require adjacency, just order. `opts.withinSeasons`, if set, additionally
// requires the whole chain to complete within that many seasons of its first matched step (a "time
// window"). `matchedSoFar` is the array of entries already matched by earlier steps, in step order
// -- plain ledgerStep()-built matchers ignore it (they only take one argument), so this is a
// backward-compatible addition, not a breaking change to the step signature.
export function sequenceRule(steps, opts = {}) {
  return (career) => {
    const ledger = career.eventLedger || [];
    let cursor = -1;
    let firstSeasonIdx = null;
    const matched = [];
    for (const step of steps) {
      const match = ledger.find((e) => e.sequenceIndex > cursor && step(e, matched));
      if (!match) return false;
      matched.push(match);
      if (firstSeasonIdx === null) firstSeasonIdx = match.seasonIndex;
      cursor = match.sequenceIndex;
      if (opts.withinSeasons != null && (match.seasonIndex - firstSeasonIdx) > opts.withinSeasons) return false;
    }
    return true;
  };
}

// Convenience matcher factory for sequenceRule steps: e=>e.eventId===eventId && ...filters.
export function ledgerStep(filters = {}) {
  const { eventId, teamId, opponentId, outcomeId, severity, choiceId } = filters;
  return (e) =>
    (eventId === undefined || e.eventId === eventId) &&
    (teamId === undefined || e.teamId === teamId) &&
    (opponentId === undefined || e.opponentId === opponentId) &&
    (outcomeId === undefined || e.outcomeId === outcomeId) &&
    (severity === undefined || e.severity === severity) &&
    (choiceId === undefined || e.choiceId === choiceId);
}

// True if ledger entries matching `filters` (ledgerStep-style), grouped by `groupField` (default
// "opponentId"), have ANY single group reach `atLeast` -- e.g. "beaten the SAME opponent for the
// ring 2+ times" (groupCountRule({eventId:"championship_won"}, "opponentId", 2)), a genuinely
// different shape from eventCountRule (which counts ALL matches together, regardless of which
// opponent) or sequenceRule (which cares about order, not repetition against one specific value).
// Entries with a null/undefined groupField value are excluded from every group (a career predating
// opponentId tracking must never count as "the same opponent" as anything).
export function groupCountRule(filters = {}, groupField = "opponentId", atLeast = 2) {
  const match = ledgerStep(filters);
  return (career) => {
    const counts = {};
    (career.eventLedger || []).forEach((e) => {
      if (!match(e)) return;
      const key = e[groupField];
      if (key == null) return;
      counts[key] = (counts[key] || 0) + 1;
    });
    return Object.values(counts).some((c) => c >= atLeast);
  };
}

// A sequenceRule step matcher for "revenge"-shaped achievements: matches an entry with the given
// eventId (plus any other ledgerStep-style filters) whose `field` (default "opponentId") equals the
// SAME value an earlier step in the chain already matched -- e.g. lose a championship to opponent X,
// then beat that SAME X (not just any opponent) in a later one. `stepIndex` is which earlier step
// (0-based) to compare against.
export function sameFieldAs(stepIndex, filters = {}, field = "opponentId") {
  const base = ledgerStep(filters);
  return (e, matchedSoFar) => {
    const anchor = matchedSoFar[stepIndex];
    return !!anchor && anchor[field] != null && e[field] === anchor[field] && base(e);
  };
}

// Composition: combine several rules (or plain (career)=>boolean closures) into one. Lets an
// achievement's check stay a single declarative expression -- e.g. "reached the title game 3+
// times with team X AND never won one there" -- instead of a bespoke imperative function.
export function allOf(...rules) {
  return (career) => rules.every((r) => r(career));
}
export function anyOf(...rules) {
  return (career) => rules.some((r) => r(career));
}
export function not(rule) {
  return (career) => !rule(career);
}
