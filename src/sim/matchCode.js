// Multiplayer Parallel Universe Mode (MULTIPLAYER_MODE_SPEC.md section 12.1): Private matches have
// no server to look anything up in, so the match "code" a player shares has to be fully
// self-describing -- it directly encodes the shared PRNG seed and the locked decade choice, nothing
// else. Pure, side-effect-free (no Math.random() in here -- picking the actual random seed value at
// match-creation time is the CALLER's job, using real ambient randomness; this module only ever
// encodes/decodes numbers it's handed).
//
// Format: an 8-character code (shown as two groups of 4, e.g. "K7QX-9BWM") over a 32-symbol
// alphabet that excludes visually-ambiguous characters (0/O, 1/I) so it reads and types cleanly out
// loud or by hand. The first 7 characters encode `seed*8 + decadeIndex` (decadeIndex needs only 3
// bits, packed into the low end); the 8th is a simple checksum character, so a single mistyped or
// misheard character is caught immediately as "this code looks wrong" instead of silently joining a
// match with the wrong seed or decade.
//
// This file also carries the RESULT code (encodeResultCode/decodeResultCode) -- a separate concern
// (a finished career's small scoring summary, not a seed) but the same "self-describing string,
// copy-pasted between two people, no server" shape, so it lives alongside the match code rather than
// in its own file. Unlike the match code, a result code is pasted, not typed/spoken, so it doesn't
// need the friendly short alphabet -- it's base64 JSON with a lightweight version tag and checksum.

const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"; // 32 chars: digits 2-9, A-Z minus I/O
const CHAR_TO_VAL = {};
ALPHABET.split("").forEach((c, i) => { CHAR_TO_VAL[c] = i; });

// Must match DECADES.length in src/main.js (7 decades, 1960s-2020s) -- decadeIndex is packed into
// 3 bits (0-7) but only 0-6 are ever valid; a decoded 7 means a corrupted/foreign code.
export const DECADE_COUNT = 7;

function encodeBase32(n, minLength) {
  let out = "";
  let v = n;
  if (v === 0) out = ALPHABET[0];
  while (v > 0) {
    out = ALPHABET[v % 32] + out;
    v = Math.floor(v / 32);
  }
  while (out.length < minLength) out = ALPHABET[0] + out;
  return out;
}

function decodeBase32(str) {
  let v = 0;
  for (const ch of str) {
    const val = CHAR_TO_VAL[ch];
    if (val === undefined) return null;
    v = v * 32 + val;
  }
  return v;
}

export function encodeMatchCode(seed, decadeIndex) {
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xFFFFFFFF) {
    throw new Error(`encodeMatchCode: seed out of range (0-4294967295): ${seed}`);
  }
  if (!Number.isInteger(decadeIndex) || decadeIndex < 0 || decadeIndex >= DECADE_COUNT) {
    throw new Error(`encodeMatchCode: decadeIndex out of range (0-${DECADE_COUNT - 1}): ${decadeIndex}`);
  }
  const combined = seed * 8 + decadeIndex; // safe: max 2^32*8 = 2^35, well under Number.MAX_SAFE_INTEGER
  const dataStr = encodeBase32(combined, 7);
  let checksum = 0;
  for (const ch of dataStr) checksum = (checksum + CHAR_TO_VAL[ch]) % 32;
  const raw = dataStr + ALPHABET[checksum];
  return `${raw.slice(0, 4)}-${raw.slice(4)}`;
}

// Returns { seed, decadeIndex } or null for anything that doesn't decode to a valid, checksum-clean
// code -- callers should treat null as "show the player a 'that code looks wrong' message," never
// throw, since this is parsing untrusted human-typed/pasted input by design.
export function decodeMatchCode(code) {
  const cleaned = (code || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (cleaned.length !== 8) return null;
  const dataStr = cleaned.slice(0, 7);
  const checkChar = cleaned[7];
  let checksum = 0;
  for (const ch of dataStr) {
    const val = CHAR_TO_VAL[ch];
    if (val === undefined) return null;
    checksum = (checksum + val) % 32;
  }
  if (ALPHABET[checksum] !== checkChar) return null;
  const combined = decodeBase32(dataStr);
  if (combined === null) return null;
  const decadeIndex = combined % 8;
  if (decadeIndex >= DECADE_COUNT) return null;
  const seed = Math.floor(combined / 8);
  return { seed, decadeIndex };
}

const RESULT_CODE_PREFIX = "GLR1"; // "Gridiron Lab Result v1" -- a version tag, not decorative;
// bumping this if the payload shape ever changes lets decodeResultCode refuse a code from an
// incompatible future/past version instead of misparsing it.

// payload is a plain JSON-serializable object (matchId, slot, player name, decade, and the small
// scoring-input summary from src/sim/multiplayerScore.js) -- deliberately never the whole career,
// both to keep the pasteable code short and because the other player never needs (or should get)
// fine-grained build detail, only the scoring-relevant summary.
export function encodeResultCode(payload) {
  const json = JSON.stringify(payload);
  const b64 = btoa(unescape(encodeURIComponent(json)));
  let sum = 0;
  for (let i = 0; i < b64.length; i++) sum = (sum + b64.charCodeAt(i)) % 36;
  return `${RESULT_CODE_PREFIX}-${b64}-${sum.toString(36)}`;
}

// Returns the decoded payload object, or null for anything that doesn't parse cleanly -- untrusted
// pasted input, same contract as decodeMatchCode.
export function decodeResultCode(code) {
  const trimmed = (code || "").trim();
  const match = trimmed.match(new RegExp(`^${RESULT_CODE_PREFIX}-(.+)-([0-9a-z])$`, "i"));
  if (!match) return null;
  const [, b64, checkChar] = match;
  let sum = 0;
  for (let i = 0; i < b64.length; i++) sum = (sum + b64.charCodeAt(i)) % 36;
  if (sum.toString(36) !== checkChar.toLowerCase()) return null;
  try {
    const json = decodeURIComponent(escape(atob(b64)));
    return JSON.parse(json);
  } catch (e) {
    return null;
  }
}
