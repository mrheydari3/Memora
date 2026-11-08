import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * Accessibility regression suite.
 *
 * Every assertion here corresponds to a defect the audit reproduced in the real
 * browser, so a regression fails the build instead of being rediscovered later:
 *
 *   - axe (WCAG 2.2 A/AA): missing aria-checked on the toggles, label/name
 *     mismatches, contrast on tertiary captions, content outside a landmark.
 *   - 44px targets: icon buttons, chips, segments, toggles and inline links.
 *   - keyboard focus: at least one focused control must draw a ring.
 *   - text zoom: the type scale must be rem-based, so 200% actually grows it.
 */

const ROUTES = [
  { label: 'home', path: '/' },
  { label: 'library', path: '/library' },
  { label: 'deck', path: '/deck/deck-german-a2b1' },
  { label: 'study', path: '/study/deck-german-a2b1' },
  { label: 'settings', path: '/settings' },
  { label: 'algorithm', path: '/settings/algorithm' },
  { label: 'advanced', path: '/settings/algorithm-advanced?deckId=deck-german-a2b1' },
  { label: 'tts', path: '/settings/tts' },
  { label: 'offline', path: '/settings/offline' },
  { label: 'import', path: '/mass-import' },
  { label: 'discover', path: '/discover' },
  { label: 'discover-preview', path: '/discover/discover-french-basics' },
  { label: 'dev', path: '/dev' },
  { label: 'add-deck', path: '/add-deck' },
  { label: 'profile', path: '/profile' },
  { label: 'statistics', path: '/statistics' },
];

const settle = async (page: import('@playwright/test').Page) => {
  await page.waitForSelector('[role="main"]', { timeout: 30_000 });
  await page.waitForTimeout(900);
};

test.describe('axe — WCAG 2.2 AA', () => {
  for (const route of ROUTES) {
    test(`${route.label} has no WCAG 2.2 AA violations`, async ({ page }) => {
      await page.goto(route.path);
      await settle(page);

      const { violations } = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
        .analyze();

      const summary = violations.map((v) => ({
        id: v.id,
        impact: v.impact,
        nodes: v.nodes.map((n) => n.target.join(' ')),
      }));
      expect(summary).toEqual([]);
    });
  }
});

test('archived study state has no WCAG 2.2 AA violations', async ({ page }) => {
  await page.goto('/deck/deck-german-a2b1');
  await settle(page);
  await page.getByRole('button', { name: 'More options', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Archive Deck' }).click();
  await expect(page).toHaveURL(/\/library$/);

  await page.goto('/study/deck-german-a2b1');
  await settle(page);
  await expect(page.getByText('This deck is archived')).toBeVisible();

  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  const summary = violations.map((v) => ({
    id: v.id,
    impact: v.impact,
    nodes: v.nodes.map((n) => n.target.join(' ')),
  }));
  expect(summary).toEqual([]);
});

test('page shell is dark, English and landmarked', async ({ page }) => {
  await page.goto('/');
  await settle(page);

  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  const shell = await page.evaluate(() => ({
    scheme: getComputedStyle(document.documentElement).colorScheme,
    main: document.querySelectorAll('[role="main"]').length,
    headings: document.querySelectorAll('h1,h2,h3,[role="heading"]').length,
  }));
  expect(shell.scheme).toBe('dark');
  expect(shell.main).toBeGreaterThan(0);
  expect(shell.headings).toBeGreaterThan(0);
});

test('every interactive control is at least 44x44 CSS px', async ({ page }) => {
  for (const route of ROUTES) {
    await page.goto(route.path);
    await settle(page);

    const undersized = await page.evaluate(() => {
      const nodes = document.querySelectorAll(
        'a[href], button, [role="button"], [role="switch"], [role="tab"]'
      );
      const out: { name: string; w: number; h: number }[] = [];
      for (const el of nodes) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        if (r.width < 44 || r.height < 44) {
          out.push({
            name: (el.getAttribute('aria-label') ?? el.textContent ?? '').trim().slice(0, 50),
            w: Math.round(r.width),
            h: Math.round(r.height),
          });
        }
      }
      return out;
    });

    expect(undersized, `${route.label}: ${JSON.stringify(undersized)}`).toEqual([]);
  }
});

test('keyboard focus draws a ring, including the search field', async ({ page }) => {
  await page.goto('/library');
  await settle(page);

  const rings: boolean[] = [];
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press('Tab');
    const ring = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el || el === document.body) return null;
      const s = getComputedStyle(el);
      return (parseFloat(s.outlineWidth) || 0) > 0 && s.outlineStyle !== 'none';
    });
    if (ring !== null) rings.push(ring);
  }

  expect(rings.length).toBeGreaterThan(0);
  expect(rings.filter((r) => !r)).toEqual([]);
});

test('200% text zoom doubles the type scale', async ({ page }) => {
  await page.goto('/library');
  await settle(page);

  const growth = await page.evaluate(() => {
    const sizes = () =>
      [...document.querySelectorAll('div')]
        .filter((el) => (el.textContent ?? '').trim().length > 3 && el.children.length === 0)
        .map((el) => parseFloat(getComputedStyle(el).fontSize));
    const before = Math.max(...sizes());
    document.documentElement.style.fontSize = '200%';
    const after = Math.max(...sizes());
    return { before, after };
  });

  expect(growth.after).toBeGreaterThanOrEqual(growth.before * 1.9);
});

test('no horizontal overflow at 320px', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 780 });
  for (const route of ROUTES) {
    await page.goto(route.path);
    await settle(page);
    const overflow = await page.evaluate(
      () =>
        Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) -
        window.innerWidth
    );
    expect(overflow, `${route.label} overflows by ${overflow}px`).toBeLessThanOrEqual(1);
  }
});
