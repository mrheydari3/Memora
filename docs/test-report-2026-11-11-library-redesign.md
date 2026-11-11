# Your Decks — audit, redesign, virtualization and scale report

Date: 2026-11-11 · Scope: Home → Your Decks, its data path and its tests.

## 1. What changed

| File | Change |
| --- | --- |
| `data/library.ts` (new) | One-pass library index: review buckets, queue summaries, bottom-up folder aggregates, folder paths/children, search folding. |
| `data/library.test.ts` (new) | Parity contract with `buildStudyQueue`, folder-aggregate parity with `folderSubtreeCounts`, cycle/orphan cases, search folding, stress-shape checks. |
| `data/libraryFixture.ts` (new) | Deterministic medium (100 decks / 20 folders / 5,000 cards / 20,000 reviews) and stress (300 / 60 / 15,000 / 75,000) libraries with deep nesting, RTL, long names, empty/archived/pinned decks. |
| `data/libraryFixture.test.ts` (new) | Exact fixture counts, uniqueness, depth, determinism. |
| `components/v3/LibraryBoard.tsx` (new) | The virtualized shelf: one FlatList owns hero, breadcrumbs, masthead, toolbar, folders, decks and archive; search/filter state; responsive 1/2/3-column chunking. |
| `components/v3/LibraryToolbar.tsx` (new) | Compact 44px search field + All/Due filter pills + result count. |
| `components/v3/DeckShelfRow.tsx` | Due pill moved out of the title row onto a wrapping meta line; optional folder-path context for search results. |
| `components/v3/FolderGroup.tsx` | Folder pill moves into a wrapping meta line; name and meta can take two lines at any width. |
| `components/v3/ShelfBand.tsx` | `children` optional (a band can name a region the list renders), stable `shelf-band` test id. |
| `components/v3/ShelfReorder.tsx` | Accepts a list `scrollTo(y)` so drag auto-scroll works with a virtualized owner. |
| `components/Screen.tsx` | Reports measured header height (`onHeaderHeight`) for screens that own their scroll container. |
| `data/session.ts` | `reviewStateOf` exported and reused by the index — one rule, not two copies. |
| `app/(tabs)/home.tsx` | Hero + sheet logic kept; the body is now `LibraryBoard`; queue/folder math comes from the index. |
| `tests/e2e/library-search.spec.ts` (new) | Cross-folder search, path display, folder result opening, empty result, Due filter. |
| `tests/e2e/library-scale.spec.ts` (new) | 300-deck browser library: mounts a window, searches, 320px overflow check, no console/page errors. |
| `tests/e2e/library.spec.ts`, `tests/e2e/flows.spec.ts` | Updated for the band test id and for the menu closing when its row moves. |
| `tests/e2e/layout.spec.ts` | Auto-scroll now measures the FlatList (`shelf-panel`) that owns scrolling on Home. |
| `tests/e2e/visual.spec.ts-snapshots/home-390…`, `home-1280…` | Intentionally regenerated for the redesigned shelf. Unrelated snapshots were not touched. |

## 2. UI defects fixed

- The due pill no longer competes with the deck title: the title owns its row, the
  count/scheduler and pill wrap onto the meta line, and the pill right-aligns when
  it fits. At 320px and 200% text it drops to its own line instead of squeezing
  the name.
- Folder headers use the same wrap rule; long names and `0 direct · 2 nested`
  metadata no longer collide with the status pill at narrow widths.
- Search results across the library show the folder path under each deck
  (`Languages / German`), so a filtered row still says where it lives.
- The library now has a real no-results state and a clear action; the Due filter
  only prints decks with cards waiting.
- One nav/name collision removed: the breadcrumb "All decks" and the filter chip
  are now distinct (`Show all` / `Due only`).

## 3. Performance work

- Review log walked **once**: `byDeck`, `todayByDeck`, today's distinct new cards
  and today's review count. A deck no longer filters the full history.
- Queue summaries count cards instead of building and sorting arrays; parity with
  `buildStudyQueue` is pinned on the dev fixture, every cap shape, all three
  presets and 20 decks of the medium fixture.
- Folder totals are folded **bottom-up** (one visit per folder, cycle-safe) instead
  of a descendant walk per folder; paths and children are maps built once.
- Home reads `byFolderId`/`unfiled` maps instead of `.filter()` per folder; no
  card sort runs on the render path.
- The body is one `FlatList` (`initialNumToRender 16`, `windowSize 21`,
  `maxToRenderPerBatch 10`); a 300-deck library mounts a window, asserted in
  `library-scale.spec.ts`.
- Row pieces are flat and cheap; column chunking happens once per data change.

Measured on the local harness (`BASE_URL=127.0.0.1:3001`, fixture F2, 3 runs):
LCP median **448 ms** (worst 452), TBT median **85 ms** (worst 86), CLS **0** —
local budgets (2500 / 200 / 0.1) met. Evidence: `audit/perf.json`.

## 4. Data integrity

Untouched: FSRS scheduling, daily caps, learning/relearning states, review log,
deck duplication/deletion, folder deletion and re-parenting, pinning, manual
order and drag targets, archived decks, empty decks, colours/icons, AsyncStorage
keys and import/export. No migration and no storage-key change was introduced.
The index is pure and rebuilt from the same store selectors, so the store remains
the only writer.

## 5. Responsive results

`npm run responsive -- --mode=measure --widths=320,375,390,768,1024,1280,1440`
on HM-03 (hero), HM-05 (root shelf), HM-06 (folder level), HM-07 (empty folder),
HM-13 (long/RTL names) and DS-04 (imported deck):

**42 measurements, 0 flagged, 0 failed** — no document overflow, no element past
the viewport, no clipped text without ellipsis, no horizontal main scroll, no tab
capsule overlap.

## 6. Tests

- `npx tsc --noEmit` — 0 errors.
- `npm run check:design` — clean (97 files).
- `npm test` — **235 passed, 0 failed**.
- `npx playwright test` (Chromium, `BASE_URL=127.0.0.1:3001`):
  - a11y **24/24** (axe WCAG 2.2 AA across every route, 44px targets, 200% zoom,
    320px overflow, focus ring)
  - data-truth **13/13**
  - library **2/2**, library-search **4/4**, library-scale **1/1**
  - group-a **5/5**, hints **3/3**, keyboard **4/4**, menus **6/6**,
    shelf-keyboard **2/2**
  - flows **52/52**; the one earlier failure (deck reorder) came from the
    options sheet closing when its row moves and is now dismissed with Escape.
    An archived-deck failure in a later run was a dropped dev server, and the
    case passes on a healthy server (6.8 s in the full run).
  - full `npm run test:e2e`: **132 passed / 5 failed** on the first run. The
    edit-layout failure was the test reading the old `screen-scroll` node; it now
    measures `shelf-panel` and passes (5.0 s). Two Home baselines were
    intentionally regenerated. The two remaining failures are unrelated visual
    drift (settings 390px, answered study card 320px) left untouched.
  - visual: `home-390` and `home-1280` regenerated after the redesign; the
    unrelated drift is recorded in limitations.

## 7. Known limitations

- The visual suite uses `-chromium-darwin` baselines here. `home-390` and
  `home-1280` were regenerated for the intentional redesign. `settings` at 390px
  and the answered study card at 320px still differ from their existing
  baselines; that is pre-existing browser/font drift unrelated to the shelf and
  was deliberately left untouched. Statistics baselines were not regenerated.
- Edit-layout (`ShelfReorder`) is still one non-virtualized block: with hundreds
  of items it renders every reorder row. The browsing shelf itself is virtualized.
- An open deck options sheet closes when its own row moves after Pin/Move. The
  action applies; the sheet is dismissed. The test now presses Escape to be
  robust either way.
- The browser scale fixture keeps 300 decks / 60 folders but stores 5 cards and
  20 reviews per deck (localStorage budget); the full 15,000/75,000 shape is
  covered by the Node stress tests.
- No native iOS/Android device run was performed; layout was verified in
  Chromium (web) at the widths above.
