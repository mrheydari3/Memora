import { defineConfig, devices } from '@playwright/test';

// Same browser resolution as scripts/perf.mjs: the workspace keeps Playwright's
// browsers under node_modules and its shared libraries in an extracted prefix.
process.env.PLAYWRIGHT_BROWSERS_PATH ??= '0';
if (process.env.PLAYWRIGHT_LIBS_DIR) {
  process.env.LD_LIBRARY_PATH = `${process.env.PLAYWRIGHT_LIBS_DIR}:${process.env.LD_LIBRARY_PATH ?? ''}`;
}

/**
 * Boot regression suite — the production export under CPU throttling.
 *
 * This is deliberately separate from `playwright.config.ts`: that suite drives
 * the dev server, and the defect this guards (a tab that never mounts under
 * 4× CPU) only reproduced against `dist/`. `tests/boot/mount.spec.ts` starts
 * `scripts/serve-dist.mjs` itself, so no webServer is configured here.
 */
export default defineConfig({
  testDir: './tests/boot',
  timeout: 120_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    viewport: { width: 1280, height: 900 },
    deviceScaleFactor: 1,
    colorScheme: 'dark',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 900 } },
    },
  ],
});
