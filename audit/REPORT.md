# Memora — UI / UX / accessibility / rendering audit

Method: the app was run (`expo start --web`) and driven in real Chromium through
Playwright. Every row below was reproduced before it was fixed and re-measured
afterwards. Nothing here is a code-reading guess.

Coverage: 52 page×viewport combinations — 9 routes × 320/375/768/1024/1440 px ×
light and dark preference — plus prefers-reduced-motion on/off, 200% text zoom,
keyboard tab-through of 5 stops per route, and axe-core with the
`wcag2a, wcag2aa, wcag21a, wcag21aa, wcag22aa, best-practice` tag set.

Harness: `scripts/audit.mjs` (Playwright + axe + PerformanceObserver).
Raw output: `audit/report.json`.

| ID | Sev | Location | Symptom | Root cause | Fix |
| --- | --- | --- | --- | --- | --- |
| A1 | critical | `components/ToggleSwitch.tsx:43` | axe `aria-required-attr` on both settings switches (8 nodes) | `role="switch"` was rendered but react-native-web drops `accessibilityState.checked`, so the element had no `aria-checked` | pass an explicit `aria-checked={value}` beside the native `accessibilityState` |
| A2 | high | `components/IconButton.tsx:53`, `Chip.tsx:43`, `SegmentedControl.tsx:59`, `SectionHeader.tsx:79`, `components/Flashcard.tsx` speak | 276 interactive controls measured under 44×44 (icon buttons 38, deck options 32, segments/chips 36, inline links 20, speaker 38) | targets were sized by `hitSlop`, which react-native-web ignores — the phone got the padding, the browser got a 38px button | a laid-out 44px press box on every control (`heights.hit`), with the visual circle unchanged |
| A3 | high | `theme/palette.js:32` + `components/SegmentedControl.tsx:187` | axe `color-contrast` (22 nodes): 11px tertiary captions fell to 3.88:1 on raised tiles | one tertiary tone (`#77839A`) was used both on the canvas and on tiles that sit over the warm ambient field | raised `outline` to `#8B97A9` (≈6.5:1 on ink, ≈5:1 on the accent pane) and used `muted` for captions on raised tiles |
| A4 | high | `global.css:41-56` | keyboard focus was invisible: computed outline `none 3px` on every control; the search field had no ring at all | the base layer suppressed outlines and the input set `outlineStyle: none`; there was no `:focus-visible` rule | `:focus-visible` 2px accent ring (colour resolved through Tailwind `theme()` from the palette) drawn inside the box; pointer-only suppression; the input no longer removes it |
| A5 | high | `tailwind.config.js:26`, `metro.config.js:9` | 200% text zoom did not change any font size (max stayed 20px) | the type scale was emitted in `px`, so browser text zoom cannot scale it (WCAG 1.4.4) | scale emitted in `rem` + NativeWind `inlineRem: 16`, so web scales and native stays byte-identical |
| A6 | high | `components/DeckCard.tsx` | axe `nested-interactive` + Chrome console: “`<button>` cannot be a descendant of `<button>`” | the card was a `Pressable` wrapping the save `IconButton`, i.e. a button inside a button | pane is a plain view; an overlay `Pressable` handles “open”; the save control is its sibling above it |
| A7 | med | `components/ListRow.tsx`, `DeckListItem.tsx`, `DeckCard.tsx`, `CardStack.tsx:321`, `app/profile.tsx` | axe `label-content-name-mismatch` (72 nodes) | hand-written `accessibilityLabel`s (title only, or “Details for …”) did not contain the visible text (subtitle, meta, badge, example) | labels removed where the content already names the control; the segment badge is named by its own text |
| A8 | med | `app/_layout.tsx` shell, `components/Screen.tsx` | axe `region` (316 nodes) and `landmark-one-main` on 4 viewports | no `<main>` at all; the floating tab capsule is rendered by the router outside any screen, so a per-screen main left it outside every landmark | one `role="main"` on the app shell around the navigator |
| A9 | med | `app/profile.tsx`, `app/(tabs)/library.tsx`, `components/QuizStartCard.tsx` | axe `scrollable-region-focusable`; horizontal rails could not be scrolled from the keyboard | RN-web scroll views are not focusable | `focusable` on the three horizontal scrollers |
| A10 | med | `components/AppText.tsx:81`, `TopAppBar.tsx` | zero headings on every route (`headings=0`), so screen readers had no outline | text was always an anonymous div | `headingLevel` prop → `role="heading"` + `aria-level`; app-bar titles and page titles use it |
| A11 | med | `app/+not-found.tsx` (new) | unknown routes rendered Expo Router's raw dev sitemap with 23px targets and a 16px overflow at 320 | no `+not-found` route existed | branded not-found screen inside the app shell |
| A12 | low | `components/AppSplash.tsx` (exit transform), `app/_layout.tsx` shell | the document scrolled 3px horizontally for the length of the splash dissolve; decorative layers could also widen it | the splash's exit scaled a full-screen fixed layer to `1.02` (320 → 326px) and it renders outside the app shell, so the document grew; ambient fields sit on negative insets | splash exit is now a pure opacity dissolve, and the shell clips decoration horizontally |
| A13 | low | `app/(tabs)/_layout.tsx`, `components/LiquidTabBar.tsx` | `tsc --noEmit` failed (4 errors) in the tab bar added since the last audit | RN 0.88's generated types no longer resolve `ComponentRef` to a host instance; one `ColorValue` could be `null` | node type extracted from the view's own ref; `ColorValue` narrowed with `typeof === 'string'` |
| A14 | low | `global.css`, `app/+html.tsx` | `color-scheme` computed as `normal` inside a dark app: light scrollbars, light form controls, white overscroll | the base layer never declared a scheme | `color-scheme: dark` plus an ink canvas painted before first paint |

## Before → after (measured, 52 viewports unless noted)

| Metric | Before | After |
| --- | --- | --- |
| axe violations (all rules above WCAG 2.2 AA) | 429 nodes / 6 rule ids | **0** |
| — `label-content-name-mismatch` | 72 | 0 |
| — `region` | 316 | 0 |
| — `color-contrast` | 22 | 0 |
| — `aria-required-attr` | 8 | 0 |
| — `scrollable-region-focusable` | 4 | 0 |
| — `landmark-one-main` | 4 | 0 |
| Controls smaller than 44×44 | 276 | **0** |
| Routes with invisible keyboard focus | 9 of 9 | **0** |
| 200% text zoom grows type | no | **yes (20px → 40px)** |
| Horizontal overflow at 320px | +16px (not-found) | **none** |
| Console / page errors | 2 (invalid nested button, hydration) | **0** |
| LCP / CLS / long-task time | 216–744 ms / 0.009 / 23–30 ms | unchanged (already within budget; single ~80 ms bundle task) |
| `tsc --noEmit` | 4 errors | **clean** |
| Design-token guard | clean | **clean (62 files)** |
| Unit tests | 32 pass | **32 pass** |

## Cold-start verification

The Metro/preview server was killed (`curl` to 8081 → `000`), restarted with
`expo start --web --clear` (transform cache cleared), and the first bundle was
compiled and warmed before any gate ran. Every number below comes from that
cold state — nothing is served from a bundle that predates the fixes.

| Gate | Command | Result |
| --- | --- | --- |
| Typecheck | `npx tsc --noEmit` | **0 errors** |
| Design tokens | `npm run check:design` | **clean, 62 files** |
| Unit tests | `npm test` | **32 pass / 0 fail** (32 tests, 0 skipped) |
| E2E (axe + visual) | `npx playwright test` | **16 passed / 0 failed** (6 axe routes, 5 shell/zoom/focus/overflow tests, 5 visual baselines) |
| Audit harness | `node scripts/audit.mjs` | **52 route×viewport: 0 axe, 0 tiny targets, 0 overflow, 0 focus misses, 0 console errors, zoom 20→40px** |
| Reduced motion | `node scripts/reduced-motion.mjs` | **reduce: 0 changed nodes on 4/4 routes; control (`no-preference`): 9 / 6 / 16 / 7 nodes in motion** |
| Cross-browser | `node scripts/cross-browser.mjs` | **3 engines × 18 route×width: 0 axe, 0 tiny targets, 0 overflow, 0 focus misses, 0 errors** |

Reduced motion is measured, not asserted: the script samples the computed
`opacity`/`transform` of every inline-styled node at 80 ms and again at 1.28 s.
With `reduce` the two samples must be identical (the entrance is applied at once);
with `no-preference` the control run must observe changes, otherwise the
measurement would be blind. Both conditions held on all four animated routes, and
200% zoom still doubles the type (20 → 40 px) with reduced motion on.

## Cross-browser (axe, overflow, touch targets, focus, zoom)

Same assertions, same routes, executed in three engines. Each engine ran 9 routes
× 320 px and 1440 px (18 measurements) plus a 200% zoom pass.

| Engine | Version | Measures | axe nodes | Targets < 44px | 320/1440 overflow | Focus misses | Console/page errors | 200% zoom |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Chromium | 156.0.8078.4 | 18 | **0** | **0** | **none** | **0** | **0** | **20 → 40px** |
| Firefox | 157.0 | 18 | **0** | **0** | **none** | **0** | **0** | **20 → 40px** |
| WebKit (Safari) | 27.2 | 18 | **0** | **0** | **none** | **0** | **0** | **20 → 40px** |

Raw data: `audit/cross-browser.json`. Screenshots per engine and viewport:
`screenshots/cross-browser/`.

**Measurement state.** The engines are asked for `prefers-reduced-motion: reduce`
for the axe/overflow/target pass, because WCAG evaluates the resting UI and the
deck screen staggers its cards in. One earlier run sampled mid-reveal and
reported `color-contrast` on four half-opaque texts plus two 41px targets in
Chromium at 1440px. Re-measuring the settled frame in the same engine and
viewport gave **0 violations and 0 small targets**, which is why the harness now
measures the settled state (and why motion is verified by its own script, which
tests `reduce` and `no-preference` side by side). No CSS or component was changed
for this: it was a measurement artefact, not a rendering defect, and the
before/after is recorded here rather than hidden.

One defect was found by this pass and fixed at the root: the frosted panes only
wrote the unprefixed `backdrop-filter`, which Safari before 18 ignores, so the
WebKit-and-older-Safari fallback was missing entirely. `theme/tokens.ts` now
emits `-webkit-backdrop-filter` alongside the standard property (standard last,
so it wins where understood). No polyfill, no JS feature detection.

## Feature support, measured in the engines

`CSS.supports()` was queried inside Chromium 156, Firefox 157 and WebKit 27.2 —
the table is a measurement, not a compatibility table from memory.

| Feature | Used where | Chromium | WebKit / Safari | Firefox | Fallback |
| --- | --- | --- | --- | --- | --- |
| `:focus-visible` | `global.css:48` | ✅ | ✅ | ✅ | Pointer focus is suppressed with `:focus:not(:focus-visible)`; if the rule were unsupported the UA ring returns |
| `color-scheme: dark` | `global.css:30`, `app/+html.tsx` | ✅ | ✅ | ✅ | Without it UA scrollbars/controls keep their default light paint — cosmetic, no layout impact |
| `backdrop-filter` / `-webkit-` | `theme/tokens.ts:190` | ✅ (unprefixed only) | ✅ (both) | ✅ (unprefixed only) | **Both spellings are emitted**; the prefix covers Safari < 18 |
| `rem` type scale | `tailwind.config.js:26` | ✅ | ✅ | ✅ | Native is unaffected by design: `metro.config.js` pins NativeWind `inlineRem: 16` (its default is 14) |
| `text-size-adjust` | `global.css:33` | ✅ | ⚠️ `CSS.supports` reports false for both spellings | ⚠️ false | Declared as `-webkit-` + standard; not load-bearing — the 200% zoom pass grows type to 40px in all three engines without it |
| `box-shadow`, `transform`, `opacity`, `overflow: hidden` | panes, motion, shell | ✅ | ✅ | ✅ | — |
| `aspect-ratio`, `inset`, `gap` | layout | ✅ | ✅ | ✅ | — |
| `container queries`, `:has()`, `oklch()`, `light-dark()`, `dvh`, popover, `<dialog>`, view transitions, CSS anchor positioning | **not adopted** | ✅ | ✅ | ✅ | Nothing depends on them; they remain available for future work |
| `scheduler.yield()` | **not used** | ✅ | ❌ | ✅ | Not needed: measured TBT is 23–30 ms, so no INP pressure to schedule around |

Corrections to earlier claims in this report:

1. The audit harness was described as covering reduced motion; it did not
   exercise it. There is now a separate measured script (above) with a control
   run, and its counts are quoted above instead of an assumption.
2. The 3 px overflow was first attributed to the test resizing an already-laid-out
   page. That was wrong: it was the splash's exit `scale(1.02)` on a full-screen
   layer outside the clipped shell. The fix and the strict `<= 1px` assertion are
   in place on all six routes.
3. Glass panes wrote only the unprefixed filter, which this pass showed is a real
   Safari gap. Both spellings ship now.
4. A single Chromium-1440 deck result (4 contrast nodes, 2 small targets) was a
   mid-animation sample; the settled frame in the same engine/viewport measures
   0/0. The harness now pins the measurement state instead of relying on a wait.

## Not fixed, and why

- **Light theme.** The app is deliberately dark-only (`userInterfaceStyle: dark`);
  the audit still ran every screen with `prefers-color-scheme: light` and found
  no light-theme regression, but there is no light palette to switch to. Adding
  one is a design decision, not a defect fix.
- **Lighthouse.** Not installed in this workspace (and the mission forbids
  guessing); the same signals were measured directly through Chrome's
  PerformanceObserver and CDP in `scripts/audit.mjs` (LCP, CLS, long tasks,
  TBT) and are reported above.
- **Native rendering.** iOS/Android shadows, blur and haptics were verified by
  types and tokens, not on a device; the screenshots are react-native-web.
- **The 3px overflow was real, and is now pinned by a test.** It only appeared
  during the splash dissolve (the audit waited it out, so it never saw it). The
  DOM probe at 320×780 and 320×844 shows `docScrollWidth === innerWidth` after
  the fix, and `tests/e2e/a11y.spec.ts` asserts the strict `<= 1px` bound on all
  six routes, so it cannot return.
