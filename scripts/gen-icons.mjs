// One-off: render icons-src/icon.svg to the PNG sizes public/ needs, using the Chromium that
// Playwright already bundles (no ImageMagick / rsvg / sharp on this dev machine). Re-run whenever
// icon.svg changes:  node scripts/gen-icons.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { chromium } from "playwright-core";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const svg = readFileSync(join(root, "icons-src", "icon.svg"), "utf8");

const targets = [
  ["favicon-32.png", 32],
  ["apple-touch-icon.png", 180],
  ["pwa-192.png", 192],
  ["pwa-512.png", 512],
  ["pwa-maskable-512.png", 512],
];

const browser = await chromium.launch();
const page = await browser.newPage();
for (const [name, size] of targets) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<!doctype html><html><body style="margin:0;padding:0;background:transparent;">` +
    svg.replace("<svg ", `<svg width="${size}" height="${size}" `) +
    `</body></html>`,
    { waitUntil: "networkidle" }
  );
  const buf = await page.locator("svg").screenshot({ omitBackground: true });
  writeFileSync(join(root, "public", name), buf);
  console.log(`wrote public/${name} (${size}x${size}, ${buf.length} bytes)`);
}
await browser.close();
