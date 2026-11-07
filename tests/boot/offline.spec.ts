import { expect, test } from '@playwright/test';
import { BUILD_HINT, DIST_EXISTS, startDistServer, stopDistServer } from './distServer';

/**
 * The app shell must reopen offline once the service worker has seen it.
 *
 * `public/sw.js` is network-first with a cache fallback and precaches the shell.
 * Network-first is only correct if the fallback actually works, so this test
 * warms the cache online, cuts the network, reloads, and requires the same
 * structural text the online boot renders. Text is read through `textContent`
 * because `innerText` is empty when the renderer skips layout.
 */

const PORT = Number(process.env.OFFLINE_PORT ?? '3108');
const SCREEN_TEXT = () =>
  (document.querySelector('[data-testid="screen-body"]')?.textContent ?? '').trim();

test.skip(!DIST_EXISTS, BUILD_HINT);

let base = '';

test.beforeAll(async () => {
  base = await startDistServer(PORT);
});

test.afterAll(() => {
  stopDistServer();
});

test('the cached shell reopens with no network', async ({ page, context }) => {
  await page.goto(`${base}/offline`, { waitUntil: 'domcontentloaded' });
  await expect
    .poll(() => page.evaluate(SCREEN_TEXT), { timeout: 30_000, intervals: [250] })
    .not.toBe('');

  const scope = await page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) return null;
    await navigator.serviceWorker.register('/sw.js');
    const registration = await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) {
      await new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, 5000);
        navigator.serviceWorker.addEventListener(
          'controllerchange',
          () => {
            clearTimeout(timer);
            resolve();
          },
          { once: true }
        );
      });
    }
    return registration.scope;
  });
  test.skip(scope === null, 'service workers are unavailable in this browser');
  expect(scope).toContain('127.0.0.1');

  // One controlled online load: every request now passes through the worker and
  // lands in its runtime cache.
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect
    .poll(() => page.evaluate(SCREEN_TEXT), { timeout: 30_000, intervals: [250] })
    .not.toBe('');
  await expect
    .poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller)), { timeout: 10_000 })
    .toBe(true);

  await context.setOffline(true);
  try {
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect
      .poll(() => page.evaluate(SCREEN_TEXT), { timeout: 30_000, intervals: [250] })
      .not.toBe('');
  } finally {
    await context.setOffline(false);
  }
});
