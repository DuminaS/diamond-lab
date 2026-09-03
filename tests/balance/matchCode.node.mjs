import test from "node:test";
import assert from "node:assert/strict";

import { encodeMatchCode, decodeMatchCode, DECADE_COUNT, encodeResultCode, decodeResultCode } from "../../src/sim/matchCode.js";

test("encode then decode round-trips exactly for a range of seeds/decades", () => {
  const cases = [
    [0, 0], [1, 6], [4294967295, 3], [123456789, 0], [999999, 6], [42, 2],
  ];
  for (const [seed, decadeIndex] of cases) {
    const code = encodeMatchCode(seed, decadeIndex);
    const decoded = decodeMatchCode(code);
    assert.deepEqual(decoded, { seed, decadeIndex }, `round-trip failed for seed=${seed} decadeIndex=${decadeIndex}`);
  }
});

test("code format is two 4-character groups joined by a dash", () => {
  const code = encodeMatchCode(123456, 3);
  assert.match(code, /^[23-9A-HJ-NP-Z]{4}-[23-9A-HJ-NP-Z]{4}$/);
});

test("decodeMatchCode is tolerant of lowercase and stray whitespace/dashes", () => {
  const code = encodeMatchCode(555, 1);
  const messy = "  " + code.toLowerCase().replace("-", " -- ") + "  ";
  assert.deepEqual(decodeMatchCode(messy), { seed: 555, decadeIndex: 1 });
});

test("a single mistyped character is caught by the checksum, not silently accepted", () => {
  const code = encodeMatchCode(1000, 2);
  // Flip the first character to something else in the alphabet and confirm it's rejected.
  const alphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  const firstChar = code.replace("-", "")[0];
  const replacement = alphabet[(alphabet.indexOf(firstChar) + 1) % alphabet.length];
  const corrupted = replacement + code.replace("-", "").slice(1);
  assert.equal(decodeMatchCode(corrupted), null);
});

test("decodeMatchCode rejects garbage input without throwing", () => {
  assert.equal(decodeMatchCode(""), null);
  assert.equal(decodeMatchCode(null), null);
  assert.equal(decodeMatchCode(undefined), null);
  assert.equal(decodeMatchCode("not a code"), null);
  assert.equal(decodeMatchCode("ABCD-EFG"), null); // wrong length after cleaning
});

test("encodeMatchCode rejects out-of-range inputs", () => {
  assert.throws(() => encodeMatchCode(-1, 0));
  assert.throws(() => encodeMatchCode(0x100000000, 0));
  assert.throws(() => encodeMatchCode(0, -1));
  assert.throws(() => encodeMatchCode(0, DECADE_COUNT));
  assert.throws(() => encodeMatchCode(1.5, 0));
});

test("different decadeIndex values with the same seed produce different codes", () => {
  const codes = new Set();
  for (let d = 0; d < DECADE_COUNT; d++) codes.add(encodeMatchCode(42, d));
  assert.equal(codes.size, DECADE_COUNT);
});

test("encodeResultCode/decodeResultCode round-trips an arbitrary payload exactly", () => {
  const payload = {
    matchId: "K7QX-9BWM", slot: "A", name: "Test QB", decade: "1990s",
    summary: { rings: 2, mvps: 1, allPros: 3, proBowls: 5, peakOverall: 88, rating: 98.5, yards: 32000, td: 210, games: 160, achievementCount: 20, earnings: 90000000 },
  };
  const code = encodeResultCode(payload);
  assert.deepEqual(decodeResultCode(code), payload);
});

test("decodeResultCode rejects a corrupted payload (bit-flipped body) via the checksum", () => {
  const code = encodeResultCode({ matchId: "X", slot: "A", name: "N", decade: "1990s", summary: {} });
  const corrupted = code.replace(/^DLR1-./, "DLR1-Z"); // mangle the first base64 char
  assert.equal(decodeResultCode(corrupted), null);
});

test("decodeResultCode rejects garbage/foreign input without throwing", () => {
  assert.equal(decodeResultCode(""), null);
  assert.equal(decodeResultCode(null), null);
  assert.equal(decodeResultCode("not a result code"), null);
  assert.equal(decodeResultCode(encodeMatchCode(1, 0)), null); // a match code is not a result code
});
