/**
 * UI audit — every screen, every width, measured in a real browser.
 *
 *   node scripts/audit-ui.mjs            # full matrix
 *   node scripts/audit-ui.mjs --quick    # 431 only
 *
 * Writes audit/ui-1.2.0.json and screenshots/audit-1.2.0/<w>-<route>.png
 */
import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdirSync, writeFileSync } from 'node:fs';

const BASE = process.env.BASE_URL ?? 'http://localhost:8081';
const QUICK = process.argv.includes('--quick');
const OUT = 'screenshots/audit-1.2.0';
const WIDTHS = QUICK ? [431] : [320, 390, 431, 768];
const HEIGHT = (w) => (w >= 768 ? 900 : w === 320 ? 700 : 822);

const ROUTES = [
  { id: 'home', path: '/home' },
  { id: 'library', path: '/library' },
  { id: 'settings', path: '/settings' },
  { id: 'deck', path: '/deck/deck-german-a2b1' },
  { id: 'add-card', path: '/deck/deck-german-a2b1/add-card' },
  { id: 'study', path: '/study/deck-german-a2b1' },
  { id: 'quiz', path: '/quiz/deck-german-a2b1' },
  { id: 'statistics', path: '/statistics' },
  { id: 'profile', path: '/profile' },
  { id: 'add-deck', path: '/add-deck' },
  { id: 'mass-import', path: '/mass-import' },
  { id: 'algorithm', path: '/settings/algorithm' },
  { id: 'algorithm-advanced', path: '/settings/algorithm-advanced' },
  { id: 'offline', path: '/settings/offline' },
  { id: 'tts', path: '/settings/tts' },
  { id: 'discover', path: '/discover/discover-french-basics' },
  { id: 'not-found', path: '/this-route-does-not-exist' },
];

/** Runs in the page. Everything here is measurement only. */
function measure() {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const round = (n) => Math.round(n * 10) / 10;
  const text = (el) => (el.getAttribute('aria-label') || el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 48);
  const visible = (el) => {
    const s = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return s.display !== 'none' && s.visibility !== 'hidden' && Number(s.opacity) > 0.05 && r.width > 0 && r.height > 0;
  };
  const descriptor = (el) => {
    const cls = typeof el.className === 'string' ? el.className.split(' ').slice(0, 3).join('.') : '';
    return `${el.tagName.toLowerCase()}${el.getAttribute('role') ? `[role=${el.getAttribute('role')}]` : ''}.${cls}`;
  };
  const all = [...document.querySelectorAll('*')].filter(visible);

  // ---------- horizontal overflow ----------
  const docOverflow = Math.max(0, document.documentElement.scrollWidth - vw);
  const overflowing = all
    .filter((el) => !el.closest('[aria-hidden="true"]'))
    .map((el) => ({ el, r: el.getBoundingClientRect() }))
    .filter(({ r }) => r.right > vw + 1 || r.left < -1)
    .slice(0, 12)
    .map(({ el, r }) => ({ el: descriptor(el), left: round(r.left), right: round(r.right), text: text(el) }));

  // ---------- touch targets ----------
  const interactive = all.filter((el) => {
    const role = el.getAttribute('role');
    return (
      ['button', 'link', 'switch', 'radio', 'checkbox', 'tab', 'menuitem', 'textbox', 'combobox'].includes(role) ||
      ['BUTTON', 'A', 'INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName) ||
      el.getAttribute('tabindex') === '0'
    );
  });
  const smallTargets = interactive
    .map((el) => ({ el, r: el.getBoundingClientRect() }))
    .filter(({ r }) => r.width < 44 || r.height < 44)
    .map(({ el, r }) => ({
      el: descriptor(el),
      w: Math.round(r.width),
      h: Math.round(r.height),
      text: text(el),
      parent: el.parentElement ? descriptor(el.parentElement) : '',
    }));

  // ---------- surfaces (radius / fill / padding) ----------
  const surfaces = [];
  for (const el of all) {
    const s = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    if (r.width < 24 || r.height < 24) continue;
    const bg = s.backgroundColor;
    const radius = s.borderTopLeftRadius;
    const hasBg = bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent';
    const hasRadius = radius && radius !== '0px';
    if (!hasBg || !hasRadius) continue;
    surfaces.push({
      el: descriptor(el),
      radius: round(parseFloat(radius)),
      bg,
      pad: [s.paddingTop, s.paddingRight, s.paddingBottom, s.paddingLeft].map((v) => round(parseFloat(v))).join('/'),
      w: Math.round(r.width),
      h: Math.round(r.height),
      text: text(el).slice(0, 30),
    });
  }

  // ---------- vertical rhythm (gaps between stacked siblings) ----------
  const gaps = [];
  for (const el of all) {
    const kids = [...el.children].filter(visible);
    if (kids.length < 2) continue;
    for (let i = 1; i < kids.length; i++) {
      const a = kids[i - 1].getBoundingClientRect();
      const b = kids[i].getBoundingClientRect();
      if (b.top < a.bottom - 1) continue; // not stacked
      const gap = round(b.top - a.bottom);
      if (gap > 48) continue; // section spacing is fine to be large
      gaps.push({ parent: descriptor(el), gap, between: `${descriptor(kids[i - 1])} → ${descriptor(kids[i])}`.slice(0, 90) });
    }
  }

  // ---------- type ----------
  const types = new Map();
  for (const el of all) {
    const hasOwnText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 1);
    if (!hasOwnText) continue;
    const s = getComputedStyle(el);
    const key = `${round(parseFloat(s.fontSize))}/${round(parseFloat(s.lineHeight))} w${s.fontWeight} ls${round(parseFloat(s.letterSpacing) || 0)}`;
    const rec = types.get(key) ?? { key, count: 0, sample: text(el), color: s.color, families: new Set() };
    rec.count += 1;
    rec.families.add(s.fontFamily.split(',')[0]);
    types.set(key, rec);
  }

  return {
    viewport: { w: vw, h: vh },
    docOverflow,
    overflowing,
    interactiveCount: interactive.length,
    smallTargets,
    surfaces,
    gaps,
    types: [...types.values()].map((t) => ({ ...t, families: [...t.families] })),
    headings: document.querySelectorAll('[role="heading"]').length,
    landmarks: {
      main: document.querySelectorAll('[role="main"], main').length,
      nav: document.querySelectorAll('[role="navigation"], nav').length,
    },
    scroll: {
      scrollHeight: document.documentElement.scrollHeight,
      bodyScroll: document.body.scrollHeight,
    },
  };
}

const browser = await chromium.launch();
mkdirSync(OUT, { recursive: true });
const results = [];

for (const width of WIDTHS) {
  const ctx = await browser.newContext({
    viewport: { width, height: HEIGHT(width) },
    deviceScaleFactor: 2,
    colorScheme: 'dark',
    reducedMotion: 'reduce',
  });
  const page = await ctx.newPage();
  const consoleErrors = [];
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 200));
  });
  page.on('pageerror', (e) => consoleErrors.push('PAGEERROR ' + e.message.slice(0, 200)));

  for (const route of ROUTES) {
    const url = BASE + route.path;
    const record = { route: route.id, path: route.path, width, height: HEIGHT(width) };
    try {
      await page.goto(url, { waitUntil: 'load', timeout: 90000 });
      await page.waitForSelector('[role="main"]', { timeout: 30000 });
      await page.waitForTimeout(900);

      const metrics = await page.evaluate(measure);
      let axe = [];
      try {
        const a = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22a', 'wcag22aa'])
          .analyze();
        axe = a.violations.map((v) => ({
          id: v.id,
          impact: v.impact,
          nodes: v.nodes.length,
          target: v.nodes[0]?.target?.join(' '),
          help: v.help,
        }));
      } catch (e) {
        axe = [{ id: 'axe-failed', nodes: 0, target: '', help: String(e).slice(0, 120) }];
      }

      Object.assign(record, metrics, { axe, consoleErrors: consoleErrors.splice(0) });

      if (width === 320 || width === 431) {
        await page.screenshot({ path: `${OUT}/${width}-${route.id}.png`, fullPage: false });
      }
      console.log(
        `${width} ${route.id.padEnd(20)} axe:${String(axe.length).padStart(2)} small:${String(metrics.smallTargets.length).padStart(2)} ovf:${metrics.docOverflow}`
      );
    } catch (e) {
      record.error = String(e).slice(0, 200);
      console.log(`${width} ${route.id.padEnd(20)} ERROR ${record.error}`);
    }
    results.push(record);
  }
  await ctx.close();
}

await browser.close();
writeFileSync('audit/ui-1.2.0.json', JSON.stringify({ generatedAt: new Date().toISOString(), base: BASE, results }, null, 1));

// ---------- aggregate ----------
const ok = results.filter((r) => !r.error);
const sum = (n) => results.reduce((s, r) => (r.axe ? s + r.axe.filter((v) => v.id === n).length : s), 0);
const byRule = {};
for (const r of ok) for (const v of r.axe ?? []) byRule[v.id] = (byRule[v.id] ?? 0) + v.nodes;

console.log('\n=== SUMMARY ===');
console.log('pages measured:', ok.length, '/', results.length);
console.log('axe rule instances:', Object.entries(byRule).map(([k, v]) => `${k}:${v}`).join(' ') || 'none');
console.log('doc overflow pages:', ok.filter((r) => r.docOverflow > 0).length);
console.log('small targets total:', ok.reduce((s, r) => s + r.smallTargets.length, 0));
console.log('console errors pages:', ok.filter((r) => r.consoleErrors?.length).length);
console.log('pages without heading:', ok.filter((r) => r.headings === 0).map((r) => r.route).join(','));
