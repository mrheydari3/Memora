# Measured checks

Static reading cannot see balance, clipping or overlap. These probes run in the
browser (Playwright `page.evaluate`, the cloud browser, or devtools) and return
numbers you can put in the report as evidence.

Three widths, every route: **320** (smallest real phone), **768** (tablet),
**1280+** (desktop). Tab screens, stacked screens, and the settings/statistics
pages all behave differently — probe all of them, not just the complaint.

## Settle first

`getBoundingClientRect` after a scroll, resize or route change returns the old
frame. Any probe that moves the page must wait before reading:

```js
const settle = (ms = 500) => new Promise((resolve) => setTimeout(resolve, ms));
```

Sampling mid-animation also manufactures findings: text at half opacity "fails"
contrast, an entrance transform makes a control briefly the wrong size. If a
number contradicts what the screenshot shows, wait longer and re-measure before
you report it.

## 1. Overflow and scrollability

```js
const vw = innerWidth;
const scrollers = [...document.querySelectorAll('#root *')]
  .filter((el) => {
    const s = getComputedStyle(el);
    return (s.overflowY === 'auto' || s.overflowY === 'scroll') && el.scrollHeight > el.clientHeight + 2;
  })
  .map((el) => ({ scrollHeight: el.scrollHeight, clientHeight: el.clientHeight, at: el.scrollTop }));

const offenders = [...document.querySelectorAll('body *')]
  .filter((el) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && (r.right > vw + 1 || r.left < -1);
  })
  .map((el) => ({ tag: el.tagName.toLowerCase(), text: (el.textContent ?? '').trim().slice(0, 30),
                  left: Math.round(el.getBoundingClientRect().left), right: Math.round(el.getBoundingClientRect().right) }));

return { vw, docScrollWidth: document.documentElement.scrollWidth, scrollers, offenders: offenders.slice(0, 10) };
```

`docScrollWidth > vw` is a real defect. An element past the edge is only a defect
if nothing scrolls horizontally to reach it (rails, code blocks and carousels are
allowed to overflow their own container).

A page whose content ends below the fold with **no** scroll container is a
defect: content the user cannot reach.

## 2. Column balance (the wide-desktop check)

Find the flex row that owns the content, then compare where each pane ends:

```js
await settle(400);
const rows = [...document.querySelectorAll('div')]
  .filter((el) => {
    const s = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return s.display === 'flex' && s.flexDirection === 'row' && el.children.length >= 2 && r.width > 560 && r.height > 120;
  })
  .map((el) => ({
    rect: { x: Math.round(el.getBoundingClientRect().left), w: Math.round(el.getBoundingClientRect().width) },
    panes: [...el.children].map((child) => {
      const r = child.getBoundingClientRect();
      return { top: Math.round(r.top), bottom: Math.round(r.bottom), h: Math.round(r.height) };
    }),
  }));
return rows;
```

A row whose tallest pane is much taller than a sibling (say > 48px at 1280) is
the "column ends in empty space" defect. The fix is structural — pair panes of
similar height, or give the tall one the full width — not a nudge of the gap.

## 3. Tail gap and floating-bar overlap

```js
await settle(400);
const leaves = [...document.querySelectorAll('#root div')]
  .filter((el) => el.children.length === 0 && (el.textContent ?? '').trim().length > 2);
const last = leaves.at(-1)?.getBoundingClientRect();
const bar = document.querySelector('[role="tablist"]')?.getBoundingClientRect();
return {
  vh: innerHeight,
  lastContentBottom: last ? Math.round(last.bottom) : null,
  tailGap: last ? Math.round(innerHeight - last.bottom) : null,
  floatingBarTop: bar ? Math.round(bar.top) : null,
  covered: bar && last ? last.bottom > bar.top : false,
};
```

- `tailGap > 240` on a page that does not scroll → unfinished-looking desktop.
- `covered: true` at rest is acceptable **only** if scrolling moves the content
  clear. Scroll to the end and re-measure; the last row must end above the bar.
- After scrolling, `tailGap` should land near the page's bottom spacing token
  (Memora: `spacing.screenBottom` 40, or `tabClearance` behind a tab bar).

## 4. Edge alignment

Sections of one screen should share the same left edge; screens should share the
same gutter:

```js
const xs = [...document.querySelectorAll('#root div')]
  .filter((el) => el.children.length === 0 && (el.textContent ?? '').trim().length > 3)
  .map((el) => Math.round(el.getBoundingClientRect().left));
return { distinctLeftEdges: [...new Set(xs)].sort((a, b) => a - b) };
```

Three or four edges are normal (panel text insets from the canvas). Ten distinct
edges mean every section is its own layout.

## 5. Cross-route parity

Same role, every route, one table:

```js
const routes = ['/', '/library', '/deck/deck-german-a2b1', '/statistics', '/settings', '/profile'];
const out = [];
for (const route of routes) {
  await page.goto(base + route, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1800);
  const row = await page.evaluate(() => {
    const heading = document.querySelector('[role="heading"], h1, h2');
    const pane = [...document.querySelectorAll('#root div')]
      .find((el) => getComputedStyle(el).backdropFilter && getComputedStyle(el).backdropFilter !== 'none');
    const h = heading?.getBoundingClientRect();
    const p = pane?.getBoundingClientRect();
    return {
      headingTop: h ? Math.round(h.top) : null,
      headingSize: heading ? getComputedStyle(heading).fontSize : null,
      paneLeft: p ? Math.round(p.left) : null,
      paneRadius: pane ? getComputedStyle(pane).borderTopLeftRadius : null,
      panePad: pane ? getComputedStyle(pane).paddingLeft : null,
    };
  });
  out.push({ route, ...row });
}
return out;
```

Rows that differ in `headingTop`, `paneLeft` or `paneRadius` are the cross-screen
findings: they are what makes two screens feel like two products.

## 6. Screenshots for the report

Capture the frame that shows the finding, at the width where it exists, and say
which width it is. A mobile screenshot cannot evidence a desktop balance problem,
and a cropped one cannot show the empty space you are claiming.
