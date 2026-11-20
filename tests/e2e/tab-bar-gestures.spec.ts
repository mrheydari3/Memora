import { test, expect, type Page } from '@playwright/test';

test.use({
  hasTouch: true,
  reducedMotion: 'reduce',
  viewport: { width: 390, height: 844 },
});

async function openHome(page: Page) {
  await page.goto('/');
  await page.waitForSelector('[data-testid="today-panel"]');
  await page.waitForTimeout(900);
}

async function lensX(page: Page) {
  const transform = await page
    .getByTestId('tab-lens')
    .evaluate((node) => getComputedStyle(node).transform);
  const match = transform.match(/matrix\(([^)]+)\)/);
  return match ? Number(match[1].split(',')[4]) : 0;
}

async function lensTargetX(page: Page, index: number) {
  const tab = page.getByRole('tab').nth(index);
  const rowX = await tab.evaluate((node) => {
    const row = node.parentElement;
    return row ? row.getBoundingClientRect().x : 0;
  });
  const tabX = (await tab.boundingBox())!.x;
  return tabX - rowX + 3;
}

async function startTabDrag(page: Page, startIndex = 0, targetIndex = 2) {
  const tabs = page.getByRole('tab');
  const start = await tabs.nth(startIndex).boundingBox();
  const target = await tabs.nth(targetIndex).boundingBox();
  expect(start).not.toBeNull();
  expect(target).not.toBeNull();

  const x = start!.x + start!.width / 2;
  const y = start!.y + start!.height / 2;
  const targetX = target!.x + target!.width / 2;
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x, y }],
  });
  for (let step = 1; step <= 10; step += 1) {
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: x + ((targetX - x) * step) / 10, y }],
    });
    await page.waitForTimeout(16);
  }
  await page.waitForTimeout(100);
  return { cdp, x: targetX };
}

test('touch cancel restores the selected tab and lens offset', async ({ page }) => {
  await openHome(page);
  const tabs = page.getByRole('tab');
  const before = await lensX(page);
  const drag = await startTabDrag(page);

  await expect(tabs.nth(2)).toHaveAttribute('aria-selected', 'true');
  expect(await lensX(page)).toBeGreaterThan(before + 40);

  await drag.cdp.send('Input.dispatchTouchEvent', {
    type: 'touchCancel',
    touchPoints: [],
  });
  await page.waitForTimeout(200);

  await expect(tabs.nth(0)).toHaveAttribute('aria-selected', 'true');
  expect(await lensX(page)).toBeCloseTo(before, 0);
  await expect(page).toHaveURL(/\/$|\/home$/);
});

test('release outside the dock commits the tab and parks the lens there', async ({ page }) => {
  await openHome(page);
  const tabs = page.getByRole('tab');
  const drag = await startTabDrag(page);

  await expect(tabs.nth(2)).toHaveAttribute('aria-selected', 'true');
  await drag.cdp.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [{ x: drag.x, y: 300 }],
  });
  await drag.cdp.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: [],
  });

  await expect(page).toHaveURL(/\/profile$/);
  await expect(tabs.nth(2)).toHaveAttribute('aria-selected', 'true');

  expect(await lensX(page)).toBeCloseTo(await lensTargetX(page, 2), 0);
});

test('canceling a drag from an inactive tab restores the selected tab', async ({ page }) => {
  await openHome(page);
  const tabs = page.getByRole('tab');
  const before = await lensX(page);
  const drag = await startTabDrag(page, 1, 2);

  await expect(tabs.nth(2)).toHaveAttribute('aria-selected', 'true');
  await drag.cdp.send('Input.dispatchTouchEvent', {
    type: 'touchCancel',
    touchPoints: [],
  });
  await page.waitForTimeout(200);

  await expect(tabs.nth(0)).toHaveAttribute('aria-selected', 'true');
  expect(await lensX(page)).toBeCloseTo(before, 0);
  await expect(page).toHaveURL(/\/$|\/home$/);
});

test('drag beginning on an inactive tab uses that tab as its origin in RTL', async ({ page }) => {
  await openHome(page);
  await page.evaluate(() => {
    document.documentElement.dir = 'rtl';
  });
  await page.waitForTimeout(300);

  expect(await page.evaluate(() => getComputedStyle(document.documentElement).direction)).toBe(
    'rtl'
  );
  const tabs = page.getByRole('tab');
  const home = await tabs.nth(0).boundingBox();
  const settings = await tabs.nth(3).boundingBox();
  expect(home).not.toBeNull();
  expect(settings).not.toBeNull();
  expect(home!.x).toBeGreaterThan(settings!.x);

  await expect(tabs.nth(0)).toHaveAttribute('aria-selected', 'true');
  const drag = await startTabDrag(page, 1, 2);
  await expect(tabs.nth(2)).toHaveAttribute('aria-selected', 'true');
  await drag.cdp.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: [],
  });

  await expect(page).toHaveURL(/\/profile$/);
  await expect(tabs.nth(2)).toHaveAttribute('aria-selected', 'true');
  expect(await lensX(page)).toBeCloseTo(await lensTargetX(page, 2), 0);
});

test('drag beginning on an inactive tab uses that tab as its origin', async ({ page }) => {
  await openHome(page);
  const tabs = page.getByRole('tab');
  await expect(tabs.nth(0)).toHaveAttribute('aria-selected', 'true');

  const drag = await startTabDrag(page, 1, 2);
  await expect(tabs.nth(2)).toHaveAttribute('aria-selected', 'true');
  await drag.cdp.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: [],
  });

  await expect(page).toHaveURL(/\/profile$/);
  await expect(tabs.nth(2)).toHaveAttribute('aria-selected', 'true');

  expect(await lensX(page)).toBeCloseTo(await lensTargetX(page, 2), 0);
});
