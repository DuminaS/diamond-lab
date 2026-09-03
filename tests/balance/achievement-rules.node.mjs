import test from "node:test";
import assert from "node:assert/strict";

import {
  maxConsecutive, seasonRule, consecutiveSeasonRule, eventCountRule, sequenceRule, ledgerStep,
  allOf, anyOf, not,
} from "../../src/sim/achievementRules.js";

test("maxConsecutive finds the longest run, not just the total count", () => {
  const list = [1, 1, 0, 1, 1, 1, 0, 1];
  assert.equal(maxConsecutive(list, (x) => x === 1), 3);
  assert.equal(maxConsecutive([], (x) => x === 1), 0);
  assert.equal(maxConsecutive([0, 0], (x) => x === 1), 0);
});

test("seasonRule counts matching seasons against an atLeast threshold", () => {
  const career = { seasonLog: [{ teamOverall: 40 }, { teamOverall: 90 }, { teamOverall: 30 }] };
  const rule = seasonRule((s) => s.teamOverall < 45, 2);
  assert.equal(rule(career), true);
  assert.equal(seasonRule((s) => s.teamOverall < 45, 3)(career), false);
});

test("consecutiveSeasonRule requires an unbroken run, not just a total", () => {
  const career = { seasonLog: [{ won: true }, { won: false }, { won: true }, { won: true }] };
  assert.equal(consecutiveSeasonRule((s) => s.won, 2)(career), true);
  assert.equal(consecutiveSeasonRule((s) => s.won, 3)(career), false);
});

function fakeLedger(entries) {
  return { eventLedger: entries.map((e, i) => ({ sequenceIndex: i + 1, seasonIndex: e.seasonIndex ?? 0, ...e })) };
}

test("eventCountRule matches only on the filter fields actually provided", () => {
  const career = fakeLedger([
    { eventId: "contract_signed", teamId: "BUF", choiceId: "recordSetting" },
    { eventId: "contract_signed", teamId: "BUF", choiceId: "teamFriendly" },
    { eventId: "contract_signed", teamId: "CLE", choiceId: "recordSetting" },
    { eventId: "trade_accepted", teamId: "BUF" },
  ]);
  assert.equal(eventCountRule({ eventId: "contract_signed" }, 3)(career), true);
  assert.equal(eventCountRule({ eventId: "contract_signed" }, 4)(career), false);
  assert.equal(eventCountRule({ eventId: "contract_signed", choiceId: "recordSetting" }, 2)(career), true);
  assert.equal(eventCountRule({ eventId: "contract_signed", teamId: "CLE" }, 1)(career), true);
  assert.equal(eventCountRule({ eventId: "contract_signed", teamId: "CLE" }, 2)(career), false);
});

test("eventCountRule on an empty/missing ledger never throws and reads as zero matches", () => {
  assert.equal(eventCountRule({ eventId: "contract_signed" }, 1)({}), false);
  assert.equal(eventCountRule({ eventId: "contract_signed" }, 1)({ eventLedger: [] }), false);
});

test("sequenceRule requires steps to match in order, not just all be present", () => {
  const career = fakeLedger([
    { eventId: "bust", outcomeId: "bad" },
    { eventId: "breakthrough", outcomeId: "good" },
  ]);
  const forward = sequenceRule([ledgerStep({ eventId: "bust" }), ledgerStep({ eventId: "breakthrough" })]);
  assert.equal(forward(career), true);
  const backward = sequenceRule([ledgerStep({ eventId: "breakthrough" }), ledgerStep({ eventId: "bust" })]);
  assert.equal(backward(career), false);
});

test("sequenceRule respects withinSeasons as a real time-window constraint", () => {
  const career = fakeLedger([
    { eventId: "step1", seasonIndex: 0 },
    { eventId: "step2", seasonIndex: 5 },
  ]);
  const rule = [ledgerStep({ eventId: "step1" }), ledgerStep({ eventId: "step2" })];
  assert.equal(sequenceRule(rule, { withinSeasons: 2 })(career), false);
  assert.equal(sequenceRule(rule, { withinSeasons: 5 })(career), true);
  assert.equal(sequenceRule(rule)(career), true); // no window given -- no constraint
});

test("sequenceRule fails cleanly (not throws) against an empty ledger", () => {
  const rule = sequenceRule([ledgerStep({ eventId: "anything" })]);
  assert.equal(rule({}), false);
  assert.equal(rule({ eventLedger: [] }), false);
});

test("allOf/anyOf/not compose rules the way boolean logic implies", () => {
  const alwaysTrue = () => true;
  const alwaysFalse = () => false;
  assert.equal(allOf(alwaysTrue, alwaysTrue)({}), true);
  assert.equal(allOf(alwaysTrue, alwaysFalse)({}), false);
  assert.equal(anyOf(alwaysFalse, alwaysTrue)({}), true);
  assert.equal(anyOf(alwaysFalse, alwaysFalse)({}), false);
  assert.equal(not(alwaysTrue)({}), false);
  assert.equal(not(alwaysFalse)({}), true);
});

test("allOf lets a real achievement-shaped rule combine a season condition with a negation", () => {
  // "Reached the title game 3+ times with team X, but never actually won one there" --
  // the exact shape purplepain (Wave 6) uses.
  const career = { seasonLog: [
    { teamId: "MIN", reachedTitleGameAndLost: true },
    { teamId: "MIN", reachedTitleGameAndLost: true },
    { teamId: "MIN", reachedTitleGameAndLost: true },
    { teamId: "MIN", wonTitle: false },
  ] };
  const rule = allOf(
    seasonRule((s) => s.teamId === "MIN" && s.reachedTitleGameAndLost, 3),
    not(seasonRule((s) => s.teamId === "MIN" && s.wonTitle, 1)),
  );
  assert.equal(rule(career), true);
  const careerWithWin = { seasonLog: [...career.seasonLog, { teamId: "MIN", wonTitle: true }] };
  assert.equal(rule(careerWithWin), false);
});
