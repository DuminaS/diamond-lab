import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

// GitHub Pages serves this repo from a /gridiron-export/ subpath, but the Capacitor native app
// (and local dev) needs asset paths rooted at "/" -- the deploy workflow sets DEPLOY_TARGET=pages
// only when building for Pages, everything else (npm run dev/build/android) is unaffected.
const isPagesDeploy = process.env.DEPLOY_TARGET === "pages";

// Stamped into the corner of the menu screen (see index.html/style.css) so a stale PWA/browser
// cache is immediately visible as a mismatch instead of silently serving old logic while looking
// identical -- baked in at BUILD time, not runtime, so it genuinely reflects what bundle shipped.
const buildTime = new Date().toISOString();

export default defineConfig({
  base: isPagesDeploy ? "/gridiron-export/" : "/",
  define: {
    __BUILD_TIME__: JSON.stringify(buildTime),
  },
  plugins: [
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon-32.png", "apple-touch-icon.png"],
      manifest: {
        name: "Gridiron Lab",
        short_name: "Gridiron Lab",
        description: "Build a quarterback, take him through the Combine, and simulate his whole career.",
        theme_color: "#12181B",
        background_color: "#12181B",
        display: "standalone",
        orientation: "portrait",
        start_url: ".",
        scope: ".",
        icons: [
          { src: "pwa-192.png", sizes: "192x192", type: "image/png" },
          { src: "pwa-512.png", sizes: "512x512", type: "image/png" },
          { src: "pwa-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,png,svg}"],
      },
    }),
  ],
});
