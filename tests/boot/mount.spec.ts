import { expect, test } from '@playwright/test';
import { BUILD_HINT, DIST_EXISTS, startDistServer, stopDistServer } from './distServer';

/**
 * The first tab must mount and the splash must hand over under 4× CPU.
 *
 * This pins the defect fixed on 2026-11-07: the production build enabled async
 * routes (every route behind `React.lazy`), and under CPU throttling the Home
 * chunk was fetched but its retry never committed. `BottomTabView` rendered the
 * tab bar while the focused screen produced no DOM at all, so the splash waited
 * on content that could never arrive. The assertions read `textContent`, not
 * `innerText`: `innerText` is empty whenever the renderer skips layout, which is
 * exactly what made the old splash gate hang.
 */

const PORT = Number(process.env.BOOT_PORT ?? '3107');
const CPU_RATE = 4;

test.skip(!DIST_EXISTS, BUILD_HINT);

let base = '';

test.beforeAll(async () => {
  base = await startDistServer(PORT);
});

test.afterAll(() => {
  stopDistServer();
});

const bodyText = (page: import('@playwright/test').Page) =>
  page.evaluate(() => {
    const body = document.querySelector('[data-testid="screen-body"]');
    return (body?.textContent ?? '').trim();
  });

const splashCount = (page: import('@playwright/test').Page) =>
  page.locator('[aria-label="Loading Memora"]').count();

test('the first tab mounts under 4× CPU and the splash leaves', async ({ page, context }) => {
  const cdp = await context.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU_RATE });

  await page.goto(`${base}/home`, { waitUntil: 'commit' });

  // The route body is what never appeared: without it the splash has nothing
  // to hand over to, so this is the assertion that matters.
  await expect.poll(() => bodyText(page), { timeout: 30_000, intervals: [250] }).not.toBe('');
  expect(await bodyText(page)).toMatch(/Your decks|cards due|No decks yet/i);

  await expect.poll(() => splashCount(page), { timeout: 20_000, intervals: [250] }).toBe(0);
});

test('a deep link that is not a tab also renders under 4× CPU', async ({ page, context }) => {
  const cdp = await context.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU_RATE });

  await page.goto(`${base}/statistics`, { waitUntil: 'commit' });

  await expect.poll(() => bodyText(page), { timeout: 30_000, intervals: [250] }).not.toBe('');
  await expect.poll(() => splashCount(page), { timeout: 20_000, intervals: [250] }).toBe(0);
});
