/**
 * Reduced-motion check — measured, with a control run.
 *
 *   node scripts/reduced-motion.mjs
 *
 * For four animated routes it samples the computed `opacity`/`transform` of every
 * inline-styled node shortly after mount and again ~1.2s later:
 *
 *   - `prefers-reduced-motion: reduce` must produce **no** further change: the
 *     entrance has to be applied instantly, not merely shortened.
 *   - the same check with `no-preference` is the control: it must observe
 *     changes, otherwise the measurement is blind and proves nothing.
 *
 * Also confirms the media query itself reports the emulated preference, so a
 * silently ignored emulation cannot pass as "reduced motion honoured".
 */
import { chromium } from '@playwright/test';
import { writeFileSync } from 'node:fs';

const BASE = process.env.BASE_URL ?? 'http://localhost:8081';
const ROUTES = [
  { label: 'home', path: '/' },
  { label: 'library', path: '/library' },
  { label: 'study', path: '/study/deck-german-a2b1' },
  { label: 'quiz', path: '/quiz/deck-german-a2b1' },
];

const snapshot = () => {
  const out = [];
  for (const el of document.querySelectorAll('[style]')) {
    const s = getComputedStyle(el);
    if (s.transform === 'none' && s.opacity === '1') continue;
    out.push(`${el.tagName}:${s.opacity}:${s.transform}`);
  }
  return out;
};

const browser = await chromium.launch();
const report = { generatedAt: new Date().toISOString(), engines: 'chromium', runs: [] };

for (const preference of ['reduce', 'no-preference']) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    reducedMotion: preference === 'reduce' ? 'reduce' : 'no-preference',
  });

  for (const route of ROUTES) {
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e).slice(0, 120)));
    await page.goto(BASE + route.path, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[role="main"]');
    // Under reduce, sampling before the route skeleton detaches would report
    // that content swap as motion. The control run deliberately keeps the
    // earliest sample: it only has to prove the sampler sees style changes.
    if (preference === 'reduce') {
      await page
        .locator('[role="progressbar"][aria-label="Loading Memora"]')
        .waitFor({ state: 'detached', timeout: 30_000 })
        .catch(() => {});
    }

    const mediaMatches = await page.evaluate(() =>
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    );

    await page.waitForTimeout(80);
    const first = await page.evaluate(snapshot);
    await page.waitForTimeout(1200);
    const second = await page.evaluate(snapshot);

    const changed = first.reduce((n, value, i) => (value !== second[i] ? n + 1 : n), 0) +
      Math.abs(first.length - second.length);

    report.runs.push({
      preference,
      route: route.label,
      mediaMatches,
      nodesSampled: Math.max(first.length, second.length),
      changedNodes: changed,
      pageErrors: errors,
    });

    await page.close();
  }
  await context.close();
}

// 200% zoom in the same run, with reduced motion on: the two must compose.
{
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    reducedMotion: 'reduce',
  });
  const page = await context.newPage();
  await page.goto(BASE + '/library', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[role="main"]');
  await page.waitForTimeout(1000);
  report.zoomWithReducedMotion = await page.evaluate(() => {
    const sizes = () =>
      [...document.querySelectorAll('div')]
        .filter((el) => (el.textContent ?? '').trim().length > 3 && el.children.length === 0)
        .map((el) => parseFloat(getComputedStyle(el).fontSize));
    const before = Math.max(...sizes());
    document.documentElement.style.fontSize = '200%';
    const after = Math.max(...sizes());
    return { before, after, grew: after >= before * 1.9 };
  });
  await context.close();
}

await browser.close();
writeFileSync('audit/reduced-motion.json', JSON.stringify(report, null, 2));

let failures = 0;
for (const run of report.runs) {
  const ok =
    run.preference === 'reduce'
      ? run.changedNodes === 0 && run.mediaMatches && run.pageErrors.length === 0
      : run.changedNodes > 0; // the control must see motion
  if (!ok) failures++;
  console.log(
    `${run.preference.padEnd(13)} ${run.route.padEnd(8)} media=${run.mediaMatches} nodes=${run.nodesSampled} changed=${run.changedNodes} errors=${run.pageErrors.length} ${ok ? 'ok' : 'FAIL'}`
  );
}
console.log('zoom@reduce:', report.zoomWithReducedMotion);
console.log(failures ? `${failures} run(s) failed` : 'reduced motion honoured on every route; control observed motion');
process.exit(failures ? 1 : 0);
