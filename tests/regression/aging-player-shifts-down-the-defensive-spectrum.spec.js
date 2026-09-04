// Phase 13c: an aging player is moved DOWN the defensive spectrum -- SS -> 2B/3B -> 1B, CF -> corner
// -> 1B/DH, everyone eventually to 1B or DH. Premium up-the-middle spots shift earliest; the odds
// ramp from age ~31. career.positionHistory records every move; season.position stamps each year.
import { test, expect } from "@playwright/test";
import { startCareer, advanceOneSeason, readActiveCareer } from "../helpers/careerFlow.mjs";
import { installSeededRandom } from "../helpers/seededRandom.mjs";

const EASIER = { C: 3, SS: 3, "2B": 2, "3B": 2, CF: 3, LF: 1, RF: 1, "1B": 1, DH: 0 };

test("an aging player slides down the defensive spectrum", async ({ page }) => {
  test.setTimeout(420_000);

  let anyMoved = false, seedsChecked = 0;
  for (const seed of [3, 11, 24, 42]) {
    if (anyMoved && seedsChecked >= 2) break; // enough evidence; keep the suite fast
    seedsChecked++;
    await installSeededRandom(page, seed);
    await startCareer(page, { decadeIndex: 5 });

    // walk the whole career, keeping the last real season log we saw (the save clears at retirement)
    let log = [];
    let hist = [];
    for (let i = 0; i < 22; i++) {
      const s = await readActiveCareer(page);
      if (s?.career?.seasonLog?.length) { log = s.career.seasonLog; hist = s.career.positionHistory || []; }
      if (!(await advanceOneSeason(page))) break;
    }
    const fin = await readActiveCareer(page);
    if (fin?.career?.seasonLog?.length) { log = fin.career.seasonLog; hist = fin.career.positionHistory || []; }

    log.forEach(s => {
      expect(s.position, `seed ${seed}: every season carries a position`).toBeTruthy();
      if (s.positionChangedFrom) {
        anyMoved = true;
        expect(s.age, `seed ${seed}: position moves only happen at 31+`).toBeGreaterThanOrEqual(31);
        expect(EASIER[s.position], `seed ${seed}: a move is to an equal-or-easier spot`)
          .toBeLessThanOrEqual(EASIER[s.positionChangedFrom]);
      }
    });
    hist.forEach(h => {
      expect(["C","1B","2B","3B","SS","LF","CF","RF","DH"]).toContain(h.to);
      expect(h.from).not.toBe(h.to);
    });
  }

  expect(anyMoved, "across several full careers, at least one aging position shift should occur").toBe(true);
});
