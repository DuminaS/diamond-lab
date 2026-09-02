// Wave 0 (MASTER_REMEDIATION_SPEC.md): the real, committed test harness. Replaces the previous
// norm of disposable one-off scripts in a Claude scratchpad -- those never persisted, could not be
// re-run to confirm a fix, and were explicitly prohibited by the spec ("Do not claim a temporary
// scratchpad test is part of the regression suite"). Every test lives under tests/ from here on.
import { defineConfig, devices } from "@playwright/test";

const PORT = 5342;

export default defineConfig({
  testDir: "./tests",
  timeout: 90_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  // Spec rule: "Do not fix flaky tests by increasing retries until random success; seed the
  // scenario or fix the harness." Zero retries here is deliberate -- a flaky pass must never be
  // mistaken for a real one.
  retries: 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    // Reduced motion keeps era-theme/animation timers from racing test assertions -- the same
    // setting every ad-hoc scratchpad script this session already used.
    reducedMotion: "reduce",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    command: `npx vite preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
