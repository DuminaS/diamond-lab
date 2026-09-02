// Wave 0: a deterministic Math.random() replacement, installed into the PAGE (not the Node
// process) via page.addInitScript() before src/main.js's IIFE ever runs. This is what lets a test
// reproduce an exact draft, an exact schedule, an exact injury/suspension roll, or an exact tie --
// with zero player-visible test mode and zero production code changes. Never used outside tests/.
//
// mulberry32: small, fast, good-enough statistical quality for this purpose, and (importantly)
// trivially portable as an inline source string via addInitScript, which only accepts a function
// or a string -- no module imports resolve inside the injected script.
export function seededRandomInitScript(seed) {
  return `(() => {
    let s = ${JSON.stringify(seed >>> 0)};
    Math.random = function mulberry32() {
      s |= 0; s = (s + 0x6D2B79F5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  })();`;
}

// Installs the seeded RNG on a Playwright `page` before navigation. Call this BEFORE page.goto().
export async function installSeededRandom(page, seed) {
  await page.addInitScript(seededRandomInitScript(seed));
}
