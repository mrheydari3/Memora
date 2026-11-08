import { test, expect, type Page } from '@playwright/test';

/**
 * The shared menu contract.
 *
 * At desktop widths a menu is anchored to its trigger, portal-rendered above
 * the page, keyboard driven and closed by Escape/outside press. Below 640px the
 * same content becomes a compact sheet. These tests exercise those two
 * presentations against real screens rather than mounting the primitives alone.
 */

const DECK = 'Schritt Plus Neu A2/B1';
const DECK_ID = 'deck-german-a2b1';

const settle = async (page: Page) => {
  await page.waitForSelector('[role="main"]', { timeout: 30_000 });
  await page.waitForTimeout(700);
};

const insideViewport = (box: { x: number; y: number; width: number; height: number }, width: number, height: number) => {
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(width + 0.5);
  expect(box.y + box.height).toBeLessThanOrEqual(height + 0.5);
};

test.describe('anchored menus', () => {
  test.use({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });

  test('sort anchors below its trigger and supports arrow-key selection', async ({ page }) => {
    await page.goto(`/deck/${DECK_ID}`);
    await settle(page);

    const trigger = page.getByRole('button', { name: /^Sort:/ });
    await trigger.click();
    const menu = page.getByRole('menu', { name: 'Sort cards' });
    await expect(menu).toBeVisible();

    const triggerBox = await trigger.boundingBox();
    const menuBox = await menu.boundingBox();
    expect(triggerBox).not.toBeNull();
    expect(menuBox).not.toBeNull();
    if (triggerBox && menuBox) {
      expect(menuBox.y).toBeGreaterThanOrEqual(triggerBox.y + triggerBox.height);
      insideViewport(menuBox, 1280, 900);
    }

    const options = menu.getByRole('menuitemradio');
    await expect(options).toHaveCount(3);
    await expect(options.first()).toBeFocused();

    await page.keyboard.press('ArrowDown');
    await expect(options.nth(1)).toBeFocused();
    await page.keyboard.press('Enter');

    await expect(menu).toBeHidden();
    await expect(trigger).toHaveAttribute('aria-label', 'Sort: A–Z');
    await expect(trigger).toBeFocused();
  });

  test('a submenu stays inside the viewport and Escape steps back one level', async ({ page }) => {
    await page.goto(`/deck/${DECK_ID}`);
    await settle(page);

    const trigger = page.getByRole('button', { name: 'More options', exact: true });
    await trigger.click();
    const root = page.getByRole('menu', { name: 'Deck options' });
    await expect(root).toBeVisible();

    const parent = root.getByRole('menuitem', { name: 'Move to folder' });
    await parent.click();
    const submenu = page.getByRole('menu', { name: 'Move to folder' });
    await expect(submenu).toBeVisible();
    await expect(root).toBeVisible();

    const box = await submenu.boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      insideViewport(box, 1280, 900);
      expect(box.width).toBeLessThanOrEqual(340);
    }

    await page.keyboard.press('Escape');
    await expect(submenu).toBeHidden();
    await expect(root).toBeVisible();
    await expect(parent).toBeFocused();

    await page.keyboard.press('Escape');
    await expect(root).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test('right-click opens the same actions at the pointer', async ({ page }) => {
    await page.goto(`/deck/${DECK_ID}`);
    await settle(page);

    await page.getByTestId('deck-card-row').first().click({ button: 'right' });
    const menu = page.getByRole('menu', { name: /^Actions for / });
    await expect(menu).toBeVisible();

    const box = await menu.boundingBox();
    expect(box).not.toBeNull();
    if (box) insideViewport(box, 1280, 900);

    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();
  });

  test('repeatable deck actions keep the menu open', async ({ page }) => {
    await page.goto('/home');
    await settle(page);

    const trigger = page.getByRole('button', { name: `Options for deck ${DECK}`, exact: true });
    await trigger.click();
    const menu = page.getByRole('menu', { name: `Options for deck ${DECK}` });
    await expect(menu).toBeVisible();

    await menu.getByRole('menuitem', { name: /^(Pin deck|Unpin deck)/ }).click();
    await expect(menu).toBeVisible();
    await menu.getByRole('menuitem', { name: 'Move down' }).click();
    await expect(menu).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();
    await expect(trigger).toBeFocused();
  });
});

test.describe('compact sheet fallback', () => {
  test.use({ viewport: { width: 320, height: 740 }, reducedMotion: 'reduce' });

  test('a sort menu fits the viewport and closes on Escape', async ({ page }) => {
    await page.goto(`/deck/${DECK_ID}`);
    await settle(page);

    const trigger = page.getByRole('button', { name: /^Sort:/ });
    await trigger.click();
    const dialog = page.getByRole('dialog', { name: 'Sort cards' });
    await expect(dialog).toBeVisible();

    const box = await dialog.boundingBox();
    expect(box).not.toBeNull();
    if (box) insideViewport(box, 320, 740);

    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
      true
    );

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test('Escape leaves a nested picker one level before closing the sheet', async ({ page }) => {
    await page.goto(`/deck/${DECK_ID}`);
    await settle(page);

    const trigger = page.getByRole('button', { name: 'More options', exact: true });
    await trigger.click();
    let dialog = page.getByRole('dialog', { name: DECK });
    await expect(dialog).toBeVisible();

    await dialog.getByRole('button', { name: 'Move to folder' }).click();
    dialog = page.getByRole('dialog', { name: 'Move to folder' });
    await expect(dialog).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: DECK })).toBeVisible();
    await expect(page.getByRole('dialog', { name: 'Move to folder' })).toBeHidden();

    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: DECK })).toBeHidden();
    await expect(trigger).toBeFocused();
  });
});
