import { join } from 'node:path';
import { defineConfig, devices } from '@playwright/test';

const externalBaseURL = process.env.BASE_URL;

// Linux's chrome-headless-shell aborts in Skia when a glyph needs a system
// fallback but fontconfig has no configuration. The app already ships every
// face it renders, so point the browser at those files.
if (process.platform === 'linux' && !process.env.FONTCONFIG_FILE) {
  process.env.FONTCONFIG_FILE = join(__dirname, 'tests/e2e/fontconfig.conf');
}

/**
 * Playwright config for the audit's regression suite.
 *
 * The dev server is reused when it is already up (the audit harness runs
 * against the same origin), and started only when a bare `npm run test:e2e` is
 * executed. Snapshots live in tests/e2e/__screenshots__ and are committed, so a
 * layout change that shifts a pane shows up as a diff instead of a surprise.
 */
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 90_000,
  expect: { timeout: 10_000, toHaveScreenshot: { maxDiffPixelRatio: 0.02, animations: 'disabled' } },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: externalBaseURL ?? 'http://localhost:8081',
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
    colorScheme: 'dark',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 } } }],
  // When BASE_URL points at an already-running server, do not start a second
  // Expo instance on 8081. This lets CI and the Phase 5 flows target the
  // workspace's reserved preview port.
  webServer: externalBaseURL
    ? undefined
    : {
        command: 'BROWSER=none npx expo start --web --port 8081',
        url: 'http://localhost:8081',
        reuseExistingServer: true,
        timeout: 180_000,
      },
});
