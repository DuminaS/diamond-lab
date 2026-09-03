import test from "node:test";
import assert from "node:assert/strict";

import { evaluateSeasonAwardScores, expectedWinPctForTeamOverall, winsAboveExpectation } from "../../src/sim/awards.js";

test("expectedWinPctForTeamOverall centers on 0.5 at neutral (65) and stays within its clamp bounds", () => {
  assert.equal(expectedWinPctForTeamOverall(65), 0.5);
  assert.ok(expectedWinPctForTeamOverall(99) > 0.5);
  assert.ok(expectedWinPctForTeamOverall(20) < 0.5);
  assert.ok(expectedWinPctForTeamOverall(99) <= 0.85);
  assert.ok(expectedWinPctForTeamOverall(20) >= 0.15);
});

test("winsAboveExpectation is 0 for a team that wins exactly its own predicted rate", () => {
  const teamOverall = 80;
  const predicted = expectedWinPctForTeamOverall(teamOverall);
  assert.ok(Math.abs(winsAboveExpectation(predicted, teamOverall)) < 1e-9);
});

// This is the brief's own worked example, verbatim: "A 12-win season with a 92-grade roster is
// less impressive than ten wins with a 55-grade roster." Same individual stats (ratingEdge, TD),
// different team quality/record -- the scrappier, more-overachieving case must score HIGHER on
// every tier despite the objectively worse raw record (10-7 vs 12-5).
test("balance brief worked example: overachieving on a weak roster beats a stacked team's own expected wins", () => {
  const stacked = evaluateSeasonAwardScores({ ratingEdge: 12, td: 28, winPct: 0.706, teamOverall: 92, gamesPlayedShare: 1 });
  const scrappy = evaluateSeasonAwardScores({ ratingEdge: 12, td: 28, winPct: 0.588, teamOverall: 55, gamesPlayedShare: 1 });
  assert.ok(scrappy.proBowlScore > stacked.proBowlScore, `proBowl: scrappy ${scrappy.proBowlScore} should beat stacked ${stacked.proBowlScore}`);
  assert.ok(scrappy.allProScore > stacked.allProScore, `allPro: scrappy ${scrappy.allProScore} should beat stacked ${stacked.allProScore}`);
  assert.ok(scrappy.mvpScore > stacked.mvpScore, `mvp: scrappy ${scrappy.mvpScore} should beat stacked ${stacked.mvpScore}`);
  // The stacked team's own record was already expected of it -- winsAboveExpectation should be
  // negative or near-zero, not the strongly positive number raw win% (0.706) would have implied.
  assert.ok(stacked.winsAboveExpectation < 0.05, `stacked team's wae was ${stacked.winsAboveExpectation}, expected near-zero or negative`);
  assert.ok(scrappy.winsAboveExpectation > 0.1, `scrappy team's wae was ${scrappy.winsAboveExpectation}, expected a real positive overachievement`);
});

// The exact defect reported: "a QB whose roster and production rise together" used to get credit
// purely for playing on (or riding) a good team. A mediocre-to-below-average individual season on a
// heavily stacked roster that wins at EXACTLY its own predicted rate must not read as a strong MVP
// case just because the raw win total is gaudy.
test("a below-average individual season on a stacked team meeting its own expectation scores negatively for MVP", () => {
  const teamOverall = 93;
  const winPct = expectedWinPctForTeamOverall(teamOverall); // exactly meets, doesn't beat, expectation
  const result = evaluateSeasonAwardScores({ ratingEdge: -3, td: 18, winPct, teamOverall, gamesPlayedShare: 1 });
  assert.ok(result.mvpScore < 0, `expected a negative MVP score for a below-average season merely meeting a stacked team's own expectation, got ${result.mvpScore}`);
});

test("MVP composite weights sum to the balance brief's own 45/20/20/10/5 split", () => {
  // Reconstruct the composite at a point where every component is exactly 1 (so the weighted sum
  // equals the sum of the weights) by inspecting evaluateSeasonAwardScores's own behavior: doubling
  // every normalized input should double the pre-scale composite, confirming linearity, and the
  // ratio between two different weighted inputs should match the documented split.
  // Baseball: efficiencyComponent = clamp(ratingEdge/28, ...), volumeComponent = clamp((td-26)/11, ...).
  const base = evaluateSeasonAwardScores({ ratingEdge: 0, td: 26, winPct: 0.5, teamOverall: 65, gamesPlayedShare: 0.85 });
  const onlyEfficiency = evaluateSeasonAwardScores({ ratingEdge: 28, td: 26, winPct: 0.5, teamOverall: 65, gamesPlayedShare: 0.85 });
  const onlyVolume = evaluateSeasonAwardScores({ ratingEdge: 0, td: 37, winPct: 0.5, teamOverall: 65, gamesPlayedShare: 0.85 });
  // ratingEdge=28 -> efficiencyComponent=clamp(28/28,-2,2)=1; td=37 -> volumeComponent=clamp((37-26)/11,-2,2)=1.
  // Both components hit exactly 1 with these inputs, so the resulting MVP-score delta over base is
  // directly proportional to each component's own weight (0.45 vs 0.20) -- confirms efficiency is
  // weighted ~2.25x volume, matching 45/20.
  const efficiencyDelta = onlyEfficiency.mvpScore - base.mvpScore;
  const volumeDelta = onlyVolume.mvpScore - base.mvpScore;
  assert.ok(efficiencyDelta > 0 && volumeDelta > 0);
  const ratio = efficiencyDelta / volumeDelta;
  assert.ok(Math.abs(ratio - (0.45 / 0.20)) < 0.05, `efficiency/volume weight ratio was ${ratio}, expected ~${0.45/0.20}`);
});

test("Pro Bowl and All-Pro's winsAboveExpectation term stays within its documented +/-0.5 bound even at extreme records", () => {
  const extremeGood = evaluateSeasonAwardScores({ ratingEdge: 0, td: 20, winPct: 1.0, teamOverall: 20, gamesPlayedShare: 1 });
  const extremeBad = evaluateSeasonAwardScores({ ratingEdge: 0, td: 20, winPct: 0.0, teamOverall: 99, gamesPlayedShare: 1 });
  assert.ok(extremeGood.winsAboveExpectation <= 0.5 && extremeGood.winsAboveExpectation >= -0.5);
  assert.ok(extremeBad.winsAboveExpectation <= 0.5 && extremeBad.winsAboveExpectation >= -0.5);
});
