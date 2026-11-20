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

async function startTabDrag(page: Page) {
  const tabs = page.getByRole('tab');
  const home = await tabs.nth(0).boundingBox();
  const profile = await tabs.nth(2).boundingBox();
  expect(home).not.toBeNull();
  expect(profile).not.toBeNull();

  const x = home!.x + home!.width / 2;
  const y = home!.y + home!.height / 2;
  const targetX = profile!.x + profile!.width / 2;
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

  const rowX = await tabs.nth(2).evaluate((node) => {
    const row = node.parentElement;
    return row ? row.getBoundingClientRect().x : 0;
  });
  const tabX = (await tabs.nth(2).boundingBox())!.x;
  expect(await lensX(page)).toBeCloseTo(tabX - rowX + 3, 0);
});
