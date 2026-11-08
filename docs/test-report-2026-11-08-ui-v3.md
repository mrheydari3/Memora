# Memora UI v3 — full measured verification

**Date:** 2026-11-08
**Tree:** `b7637f6` (main, after Task 12) plus the uncommitted Task 14 fixes listed below.
**Environment:** Linux x64, Node 26, Chromium 156.0.8078.4 (Playwright 1.64.1), exported production build (`npm run build:web`) served by `node scripts/serve-dist.mjs --port=3002 --root=dist`. Every browser number below is against that origin; the Expo dev server was not used.

## Verdict

| Acceptance check | Result |
| --- | --- |
| Surfaces visited | **83 / 83** (84 census targets; 0 unvisited) |
| axe violations | **0** (84 targets, 1,168 nodes; 52 route audit also 0) |
| Controls under 44 px | **0** |
| Document overflow at 320 px | **0** (84 / 84 target-widths) |
| Console errors | **0 product errors**; 1 expected fixture error (SH-02 corrupt-storage fixture) |
| Reduced-motion node changes | **0** on all four routes; control observed motion |
| Functional + boot suites | **104 / 104 passed** (40 + 45 + 13 + 3 + 3) |
| Visual suite | **7 passed / 5 failed** — stale baselines, named below |

## Static gates

| Check | Result |
| --- | --- |
| `npm ci` | Succeeded; `package-lock.json` unchanged. 8 moderate advisories reported, not acted on. |
| `npx tsc --noEmit` | 0 errors |
| `npm test` | **164 / 164** |
| `npm run check:design` | clean (82 files) |
| `npm run build:web` | exported `dist/` |
| Static server | HTTP **200**, compiled bundle served |

## Playwright suites

| Suite | Result | Notes |
| --- | --- | --- |
| `a11y`, `group-a`, `hints`, `keyboard`, `menus`, `quiz-result` | **40 / 40** | 2.0 min |
| `flows` | **45 / 45** | 3.5 min |
| `data-truth` | **13 / 13** | 35.9 s |
| `statistics-visual` | **3 / 3** | 6.5 s |
| boot (`playwright.boot.config.ts`) | **3 / 3** | 7.5 s, includes 4× CPU and offline shell |
| `visual` | **7 passed / 5 failed** | see below |

## Route audit

`node scripts/audit.mjs` — 52 measurements:

- widths: 320 (18), 375 (18), 768 (6), 1024 (6), 1440 (4)
- axe nodes: **0**
- controls < 44 px: **0**
- document overflow: **0**
- invisible focus: **0**
- console / page errors: **0**
- 200% text zoom: grew 24 → 48 px

The responsive harness adds 390, 431 and 1280 px across all 84 targets (below).

## Census

`node scripts/census.mjs --base=http://127.0.0.1:3002`:

- surfaces **83**, targets **84**, visited **83**, unvisited **0**
- states: 53 base, 22 triggered, 9 not-automated
- interactive nodes scanned: **1,168**
- axe nodes: **0**
- controls < 44 px: **0**
- focus-ring misses: **0**
- tabs missing `aria-selected`: **0**
- console errors: **1**, the intentional SH-02 corrupt-storage fixture (`Failed to load decks: UnknownError: fixture read failure: memory:decks`); the recovery surface is the thing under test
- remaining heuristic findings (not axe): **100**
  - **25 × `G4-name-contains-text`**, dominated by “Manage folders”. The icon glyph is included by the heuristic's `innerText` extraction even though `MaterialIcons` is `aria-hidden` and the accessible name contains the visible word “Folders”. No axe Label-in-Name failure remains.
  - **75 × `G5-obscured`**, all on the AD-01 add-deck sheet's own controls. `elementFromPoint` lands on the modal layer; the sheet is axe-clean, keyboard-operable and its flows pass. Recorded as a census/modal-layer artifact, not a hidden control.

## Responsive

`node scripts/responsive.mjs --mode=measure`, resumed in chunks across all 84 targets × 8 widths:

- **672 measurements**, **0 flagged**, **0 failed**
- every width 84/84: 320, 375, 390, 431, 768, 1024, 1280, 1440
- checks: document overflow ≤ 1 px, clipped text, horizontal scroller, content under the floating tab capsule, clipped sheet controls

## Reduced motion

`node scripts/reduced-motion.mjs`:

| Preference | Route | Nodes | Changed | Errors | Result |
| --- | --- | --- | --- | --- | --- |
| reduce | home | 7 | **0** | 0 | ok |
| reduce | library | 10 | **0** | 0 | ok |
| reduce | study | 4 | **0** | 0 | ok |
| reduce | quiz | 16 | **0** | 0 | ok |
| no-preference (control) | home | 47 | 83 | 0 | motion observed |
| no-preference (control) | library | 46 | 77 | 0 | motion observed |
| no-preference (control) | study | 23 | 40 | 0 | motion observed |
| no-preference (control) | quiz | 36 | 42 | 0 | motion observed |

200% zoom with reduced motion: 24 → 48 px, `grew: true`.

## Cross-browser

`node scripts/cross-browser.mjs --engine=chromium` (9 routes × 320/1440 = 18 runs):

- axe nodes **0**
- controls < 44 px **0**
- horizontal overflow **none**
- focus misses **0**
- console/page/request errors **0**
- 200% zoom **true**

**Limitation:** Firefox and WebKit binaries are not installed in this workspace. They were not run and are **not** claimed as passing.

## Visual suite failures

`npx playwright test tests/e2e/visual.spec.ts` — 7 passed, 5 failed. Threshold is a 0.02 pixel ratio.

| Snapshot | Diff | Why |
| --- | --- | --- |
| `home-390-chromium-linux.png` | 27,105 px / **0.09** | baseline embeds `SAT 7 NOV`; the run renders `SUN 8 NOV` |
| `library-390-chromium-linux.png` | 10,805 px / **0.04** | baseline predates main's header/tools changes |
| `settings-390-chromium-linux.png` | 11,476 px / **0.04** | same |
| `home-1280-chromium-linux.png` | 59,264 px / **0.06** | same, plus the date |
| `study-answer-390-chromium-linux.png` | 7,723 px / **0.03** | stale pre-merge baseline |

`tests/e2e/visual.spec.ts` does not freeze the clock (unlike `statistics-visual.spec.ts`, which pins `FIXED_NOW`), so the Home baseline changes with the calendar date. The five comparisons are baseline drift, not a new layout regression; actual images were inspected and are coherent. No snapshots were regenerated in this verification run. **This is the one suite that does not pass.**

## Fixes folded into Task 14

The verification found and fixed real accessibility defects that the plain route audit never rendered:

- **Statistics weekday tiles** — added `accessibilityRole="img"` to the seven labeled day cells (`aria-label` on a role-less `div`, 8 range states).
- **Folder headers** — removed the redundant `aria-label`; the inserted commas (“Travel, 1 deck · 6 due”) broke Label in Name against the visible run.
- **Profile deck rows** — removed `aria-label="Open <deck>"`, which omitted the visible card/due/progress text. The content now names the row; test ids `profile-deck` / `profile-deck-name` keep order assertions stable.
- **Settings “Apply to all decks”** — removed the label that omitted the visible subtitle; the flow test now matches the prefix.
- **Menu rows** — stopped overriding names with the label alone, so the visible description is part of the name.
- **Add-card details fields** — Example and Synonyms are 44 px tall (were 22 px), keep the field at 44 px (no layout growth), and use the existing `.composer-input:focus-visible` ring.
- **Library direction tabs** — explicit `aria-selected`.
- **Archived deck row** — removed the 75% row opacity that dropped 12–13 px tertiary text to 3.71–4.11:1; the retired state is carried by the pane wash, glyph and “Archived” chip.

## Not run / limitations

- Firefox and WebKit (binaries unavailable) — **not** passes.
- The five visual baseline comparisons above.
- The Review Focus list was covered by automated equivalents rather than a separate human walk:
  - 320 + 200% + Persian name — census HM-13, responsive 320, zoom 24 → 48
  - empty library — census HM-02
  - archived deck URL — data-truth archived/restore test
  - keyboard-only sheet/quiz/study — `keyboard` 2/2, `group-a`, `quiz-result`
  - missing `deckId` — flows “advanced settings without a deckId names the real cause”
  - corrupt storage — census SH-02
- `npm ci` reported 8 moderate dependency advisories; no upgrades were made, to preserve the lockfile.
- macOS-specific rendering was not verified.

## Evidence

- `audit/report.json` — 52-route audit
- `audit/census/report.json` and `audit/census/*.aria.yml` — surface census
- `audit/responsive/*.jsonl`, `audit/responsive/summary.json` — 672 responsive runs
- `audit/reduced-motion.json` — four reduce runs and their control
- `audit/cross-browser/` — Chromium cross-browser captures
- `test-results/visual-*` — actual/diff images for the five visual failures
- `.qa-logs/` — raw logs for the gates and every suite
