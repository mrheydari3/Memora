# CHANGELOG

## v3.0.0 — Nocturne Focus on every surface

### Public launch

- The static web build is live at
  [site-4cf1794985694a0fbdbfb3b24dec3e09.freebuff.page](https://site-4cf1794985694a0fbdbfb3b24dec3e09.freebuff.page).
- Production is the same Expo web export, served by `worker.mjs`; there is no
  application server and no change to the local-first data model.
- The installable surface now has a branded icon set, a maskable icon, an
  Apple touch icon, manifest metadata, canonical/Open Graph/Twitter tags and a
  1280×640 social preview.
- `npm run deploy:prepare` writes the 4.69 MiB upload bundle and rejects
  dependency paths, source maps, hidden files and over-budget uploads.

The v3 design language is now the only language. Every one of the 83 audited
surfaces renders the same canvas → scene pane → fill → type grammar; the v2
glass vocabulary is deleted, not kept behind a compatibility export.

### What changed, screen by screen

| Surface | Before | v3.0.0 |
| --- | --- | --- |
| Home | one glass card per deck; a folder holding two decks could read `0 decks` | one `TodayPane`, compact shelf rows, subtree folder counts (`0 direct · 2 nested`) and archived rows |
| Game / Library | v2 hero and segment controls | v3 hero, 44px mode tabs with `aria-selected`, session and streak figures |
| Study | the denominator grew mid-session (`1 / 26` → `2 / 27`); an empty deck said "All done" | fixed `sessionTotal`, v3 stage and rating keys, distinct empty and archived states with a restore action |
| Quiz | 156px timer ring and a glass scoreboard | v3 arena — 6px timer rail, 40/44 score, 64px answer tiles, and a v3 result ledger |
| Statistics | two stacked glass fallbacks; headings repeated per card | one scene hero, ranged metrics and chart panes; every range still recomputes from the review log |
| Profile | a horizontal badge rail that clipped at 320/390 | scene hero, Reviews/XP/Streak ledger, 3-up/4-up badge grid and inset deck lines |
| Settings | mixed v2 plates and rows across the index and sub-pages | one 64px header, hero and chapter/line grammar on the index, Algorithm, TTS, Offline, Advanced, Import and Dev |
| Deck + composer | v2 hero and 56px bar; the example/synonym fields were 22px tall | v3 hero and ledger, 420px composer column, 44px detail fields with the shared focus ring |
| Discover | the rollout was pending and advertised counts did not match the four-card import | v3 catalogue and preview; every visible count is `sampleCards.length` (4) |
| Add deck | a two-step sheet with a nested modal | one v3 sheet: 28px face, sticky footer, live validation, focus trap intact |
| Shell | the 404 and skeletons were still sized to v2 | v3 404, opacity-only splash exit, skeletons matched to the final surfaces, 64px dock with 44px tabs |

### Data-truth and accessibility fixes folded in

P3–P11 from the 2026-11-06 report are closed or made honest:

- **P3** — study progress keeps the denominator it started the session with.
- **P4** — an archived deck cannot start a session; the deck page offers restore instead.
- **P5** — folder headers count the whole subtree and say `0 direct · 2 nested` when both are true; Home's totals reconcile.
- **P6** — Import still says *Planned* and accepts no file; it does not pretend to work.
- **P7** — rating names end in a separated `Again|Hard|Good|Easy` plus interval.
- **P8** — an empty deck says so and offers Add cards, never "All done" or `0 / 0`.
- **P9** — Advanced without `deckId` names the missing parameter instead of suggesting deletion.
- **P10** — the profile badge rail no longer exceeds the viewport.
- **P11** — starter decks advertise the four cards the import actually creates.

The release run also fixed defects the route audit never rendered: statistics
weekday tiles carried labels on role-less `div`s, several rows omitted their
visible subtitle from the accessible name, the library direction tabs lacked
`aria-selected`, the add-card detail fields were 22px tall, and the archived
row's 75% opacity held its 12–13px text at 3.71–4.11:1. The browser suites now
pin each of these.

### Measured

| Metric | Before v3 | v3.0.0 |
| --- | --- | --- |
| Surfaces in one vocabulary | Quiz, 404 and the shell still outside it (planning snapshot) | **83/83** |
| Superseded surface files | 27 files / 2,959 lines to delete | **0** imports of `theme/v2` or `components/v2`; removed in `318d8f2` |
| axe violations | v2.1 closed **22** | **0** across 83 surfaces and 52 route×viewport runs |
| Controls under 44px | v2.1 closed **276** | **0** of 84 measured targets |
| Document overflow | v2.1 fixed a 3px splash overflow | **0** from 320 to 1440; 672 responsive runs, 0 flagged |
| Focus rings / tab states | not measured per surface | **0** missing rings, **0** missing tab states |
| Text zoom | 20 → 40px | **24 → 48px** |
| Reduced motion | 4 routes | **0** node changes; the control observes 40–83 |
| Unit tests | 161 | **164/164** |
| Functional + boot Playwright | — | **104/104** |

Cross-browser: Chromium **18/18** clean (axe, targets, overflow, focus, console).
Firefox and WebKit binaries are unavailable in this workspace; neither is
claimed as passing.

### Verification

`npm ci` (lockfile unchanged) · `npx tsc --noEmit` **0** · `npm test`
**164/164** · `npm run check:design` **clean (82 files)** · `npm run build:web`
exported `dist/`.

Playwright: **104/104** functional and boot tests. The visual suite is the one
failure: **7 passed / 5 failed**, all stale baselines rather than regressions —
`home-390` 0.09, `library-390` 0.04, `settings-390` 0.04, `home-1280` 0.06 and
`study-answer-390` 0.03 against a 0.02 threshold. Home embeds a calendar date
and the visual spec has no fixed clock; the other four predate main's header and
tools changes. No snapshot was regenerated.

Census **83/83**, 84 targets, 1,168 nodes, **0 axe**, **0 small targets**, **0
focus misses**; responsive **672 runs / 0 flagged**; reduced motion **0 changes**;
audit **52 runs / 0 axe, 0 small, 0 overflow, 0 errors**. One expected console
error remains from the corrupt-storage fixture (SH-02).

Limitations are recorded, not waived: Firefox/WebKit unavailable, five stale
visual baselines, and the Review Focus walk covered by automated equivalents
rather than a separate human pass. Full evidence:
`docs/test-report-2026-11-08-ui-v3.md`.

## v2.3 — My decks, rebuilt as one boxed tree

Before: folders were a chip row above a stack of full-width deck cards. With a
few decks the page grew a card per deck, folders and decks looked like the same
kind of object, and nothing showed which decks lived in which folder.

| ID | Sev | Location | Symptom | Root cause | Fix |
| --- | --- | --- | --- | --- | --- |
| R1 | high | `components/DeckLibrary.tsx` (new) | folders and decks were visually indistinguishable, and a folder's contents were only reachable by filtering | the section rendered a flat list plus filter chips, so hierarchy existed in the data but never on screen | one glass box: a folder is a header row, its decks are indented rows nested underneath |
| R2 | high | `app/(tabs)/home.tsx` | the page grew one large card per deck | every deck was its own `GlassCard` | five rows now share one pane, with 58px rows instead of 100px cards |
| R3 | med | `components/DeckLibrary.tsx` | a folder's contents could not be hidden, and an empty folder showed nothing | no expand/collapse state, no empty state | folders are expandable (`aria-expanded`) and keep their decks visible by default; an empty folder says how to fill it |
| R4 | med | `components/DeckLibrary.tsx` | decks with no folder had no home in the new tree | grouping only knew folders | an “Unfiled” group collects them, so no deck is ever hidden |
| R5 | low | `app/(tabs)/home.tsx` | the section was called “Decks” while the sheet was called “Folders” | two names for one concept | both read **My decks** / **Folders** |

Measured after the rebuild: home at 390 and 1280 px renders the tree inside a
single pane, folder headers are **58px** tall, the accessibility tree reads
`button "Folder German A2" [expanded]` → `group "Decks in German A2"` → deck,
and the folder sheet still creates, counts and deletes folders.

Verified: `npx tsc --noEmit` 0 · `npm run check:design` clean (65 files) ·
`npm test` 41/41 · `node scripts/smoke-folders.mjs` **15/15** ·
`npx playwright test` **16 passed** (visual baselines regenerated for the new
layout) · `node scripts/audit.mjs --quick` **0 axe, 0 small targets, 0 overflow,
0 console errors, type 20 → 40 px**.

## v2.2.1 — What a screen reader actually reads on Home

Reported symptom: the accessibility tree of Home read a stray `+` before the
deck name, `--------` runs between rows, three bare words (`Bio`, `Chimi`,
`English`) with no context, no way to tell which filter was on, and `Decks 1`
merged into one anonymous line.

| ID | Sev | Location | Symptom | Root cause | Fix |
| --- | --- | --- | --- | --- | --- |
| S1 | high | every icon call site (34 files) | glyph characters inside accessible names: `"\uE794 Schritt Plus Neu A2/B1 …"`, `"\uE08C Memora"`, `"+ Schritt …"` | an icon font renders its glyph as a text node in a private-use code point, so it joins the surrounding name and breaks WCAG 2.5.3 | `components/Icon.tsx` wraps `MaterialIcons` with `aria-hidden`; all 34 imports point at it |
| S2 | high | `components/Chip.tsx` | `button "Bio"` — no idea it is a folder, and no indication of which chip is active | the chip's own name was the bare label, and react-native-web does not expose `accessibilityState.selected` on a button | `aria-pressed={active}` + an `accessibilityLabel` that contains the visible text (`Folder Bio`, `All decks`) |
| S3 | med | `app/(tabs)/home.tsx` | five unrelated buttons where one filter set belongs | chips were not grouped | `role="group"` + `aria-label="Filter decks by folder"` |
| S4 | med | `components/SectionHeader.tsx` | `text: Decks 1` — the section label and its count collapsed into one anonymous run, with nothing to navigate by | the label was a styled div | `headingLevel={2}`, so it is `heading "Decks"` and the count reads separately |

Verified on a rebuilt bundle: `npx tsc --noEmit` 0 · `npm run check:design` clean
(64 files) · `npm test` 41/41 · Home aria snapshot now reads
`heading "Decks"`, `group "Filter decks by folder"`, `button "Folder Bio"`,
`button "All decks" [pressed]` · axe **none** on Home with folders present.

## v2.2 — Deck folders

A folder groups decks for browsing. It is a *label*, not a container: filing a
deck changes only `Deck.folderId`, so no card, schedule, streak or review is
touched, and deleting a folder only unfiles its decks.

### Added

- `data/folders.ts` — pure helpers (normalise, create, rename, remove, detach,
  group) so the store and the screens agree on what a valid folder is.
- `data/folders.test.ts` — 9 unit tests: whitespace/trimming and the 40-char cap,
  empty names, case-insensitive duplicates, rename clashes vs. no-ops, unfiling
  without touching unrelated decks, archived decks excluded from counts, folder
  order preserved with unfiled decks last, empty folders still visible.
- `data/repository.ts` — `loadFolders` / `saveFolders` (`memory:folders`), so a
  folder survives a reload even while it is empty.
- Store: `folders`, `addFolder`, `renameFolder`, `deleteFolder`, `setDeckFolder`.
- Home: a **Folders** action in the Decks header opens a sheet to create a folder
  (live duplicate/empty validation), see how many decks each holds and delete
  one; a chip row (All + one per folder) filters the list, with an empty-folder
  state that points at the deck’s own sheet.
- Deck screen: **Move to folder** in the options sheet, including “No folder”.
- `scripts/smoke-folders.mjs` — 13 browser checks covering create, duplicate
  rejection, filing, filtering, chip height, folder deletion, deck survival,
  axe on the sheet, 390/320px overflow and console errors.

### Fixed while building it

- `BottomSheetModal`: the dimmed backdrop was a plain `div` carrying
  `aria-label`, so axe reported `aria-prohibited-attr` on every open sheet and
  keyboard users had no way to dismiss one. The backdrop is now decoration and
  the panel header owns a 44px **Close sheet** button.

### Verified

`npx tsc --noEmit` 0 · `npm run check:design` clean (63 files) · `npm test`
**41 pass / 0 fail** · `node scripts/smoke-folders.mjs` **13/13** ·
`npx playwright test` **16 passed** (axe + visual baselines regenerated for the
new chip row) · `node scripts/audit.mjs --quick` **0 axe, 0 small targets, 0
overflow, 0 console errors** across all nine routes.

## v2.1 — Accessibility, rendering and interaction audit

A measured pass over the running app (Playwright + axe-core + PerformanceObserver,
52 page×viewport combinations at 320/375/768/1024/1440 px in light and dark
preference, reduced-motion on/off, 200% text zoom, keyboard tab-through).
The full issue table, root causes and before/after metrics are in
`audit/REPORT.md`; the raw machine output is `audit/report.json`.

### Fixed

- **Toggles announced nothing.** `role="switch"` was rendered without
  `aria-checked` (react-native-web drops `accessibilityState.checked`), which axe
  rated critical on both settings switches. The state is now an explicit
  `aria-checked` attribute as well.
- **276 controls were smaller than 44×44.** `hitSlop` is ignored on the web, so
  icon buttons (38), deck options (32), chips and segments (36), inline links
  (20) and the card speaker (38) were all under the WCAG 2.5.8 minimum. Every
  control now lays out a 44px press box (`heights.hit`) while keeping its drawn
  size.
- **Tertiary captions failed contrast** (axe, 22 nodes; 3.88:1 on a raised tile).
  `outline` was raised to `#8B97A9` (≈6.5:1 on ink) and small text on raised
  tiles uses the `muted` tone.
- **Keyboard focus was invisible.** There was no `:focus-visible` rule and the
  search field removed its outline. Focus now draws a 2px accent ring (colour
  resolved from the palette via Tailwind `theme()`), inside the box so a clipped
  pane cannot hide it.
- **200% text zoom did nothing.** The type scale was in `px`. It is now `rem`
  (`tailwind.config.js`) with NativeWind `inlineRem: 16`, so the web scales and
  native sizes are unchanged.
- **A button inside a button.** `DeckCard` wrapped its save `IconButton`, which
  Chrome reported as invalid HTML and axe as `nested-interactive`. The pane is a
  plain view with an overlay "open" button and the save control as its sibling.
- **Accessible names contradicted the screen.** Hand-written labels that omitted
  the visible subtitle, meta line or badge produced 72
  `label-content-name-mismatch` nodes; controls are now named by their content.
- **No landmark and no headings.** One `role="main"` on the app shell (the tab
  capsule renders outside every screen) removed 316 `region` nodes and the
  missing-main failures; `AppText` gained `headingLevel` for real headings.
- **Horizontal rails were unreachable by keyboard** (profile badges, library
  chips, deck picker): `focusable` added.
- **Unknown routes** rendered Expo Router's raw dev sitemap; `app/+not-found.tsx`
  now serves a branded screen inside the app shell.
- **A 3px horizontal overflow during the splash dissolve**: the exit scaled a
  full-screen layer to `1.02`; the exit is now opacity-only, and the shell clips
  decoration.
- **`color-scheme: dark`** is declared, so UA scrollbars, controls and the
  overscroll area match the ink canvas instead of flashing white.
- **`tsc --noEmit` is clean** (4 pre-existing errors in the tab bar and one
  `ColorValue` narrowing).

### Added

- `scripts/audit.mjs` — reproducible audit harness (axe, overflow, touch targets,
  focus visibility, LCP/CLS/long tasks, text zoom) writing `audit/report.json` and
  per-viewport screenshots.
- `tests/e2e/a11y.spec.ts` — axe (WCAG 2.2 AA) per route, 44px targets, focus
  ring, text zoom, 320px overflow, dark/English/landmark shell.
- `tests/e2e/visual.spec.ts` — committed screenshot baselines at 390px and 1280px.
- Scripts: `npm run audit`, `npm run test:e2e`.

### Cross-browser (Firefox 157, WebKit 27.2, Chromium 156)

- **`-webkit-backdrop-filter` fallback added.** The frosted panes only emitted the
  unprefixed property, so Safari before 18 rendered them flat. `theme/tokens.ts`
  now writes both, standard last. No polyfill.
- New harness `scripts/cross-browser.mjs` runs axe (WCAG 2.2 AA), 320/1440 px
  overflow, the 44px target check, keyboard focus and a 200% zoom pass in all
  three engines: **18 measurements per engine** — 0 axe nodes, 0 small targets,
  0 overflow, 0 focus misses, 0 console errors, type 20 → 40 px on each.
- Measured feature support (via `CSS.supports` in-engine) recorded in
  `audit/REPORT.md`: `:focus-visible`, `color-scheme`, `backdrop-filter`, `rem`,
  `text-size-adjust`; container queries, `:has()`, `oklch()`, `light-dark()`, `dvh`,
  popover/`<dialog>` and view transitions are **not adopted**, and
  `scheduler.yield()` is unused (WebKit lacks it; measured TBT is 23–30 ms).
- The cross-browser pass now measures the **settled** UI (`reducedMotion:
  reduce`), not a frame of the entrance: one run sampled the deck's staggered
  reveal mid-flight and reported phantom contrast/target failures (4 + 2) in
  Chromium at 1440px, which re-measured as 0/0 once the transition finished. No
  style changed; the harness pins the state it evaluates.
- `scripts/reduced-motion.mjs` measures the preference instead of asserting it:
  with `reduce`, 0 nodes change between 80 ms and 1.28 s on all four animated
  routes; the `no-preference` control observes 9/6/16/7 nodes in motion.

### Verified

Cold start (server killed, restarted with `--clear`, bundle warmed):
`npx tsc --noEmit` **0** · `npm run check:design` **clean (62 files)** ·
`npm test` **32 pass / 0 fail** · `npx playwright test` **16 passed / 0 failed** ·
`node scripts/audit.mjs` **52 route×viewport: 0 axe, 0 small targets, 0 overflow,
0 focus misses, 0 console errors, zoom 20 → 40 px** ·
`node scripts/cross-browser.mjs` **Chromium + Firefox + WebKit: 0/0/0/0/0**.

### Not changed

`data/`, `store/` and `services/` logic; the dark-only identity (a light theme is
a design decision, not a defect); Lighthouse was not installed, so the same
signals were measured directly through the browser instead.

## v2 — Proportion + border reduction

Scope: refine the existing design language (no redesign). Two goals: every
element's size comes from a token and reads at the right proportion, and surfaces
are separated by fill and depth instead of outlines.

### Before (measured)

| Metric | Before | After |
| --- | --- | --- |
| Border references in `app/` + `components/` | **160** | **18** (−89%) |
| — `hairline*` colours | 100 | 7 |
| — `border-*` classes | 30 | 1 |
| — `borderWidth` | 14 | 1 |
| — `accentLine` | 6 | 2 |
| — rims | 10 | 7 |
| Arbitrary widths (`max-w-[…]`) | 8 | 0 |
| Raw icon sizes (`size={13/18/30}`) | 4 | 0 |

### Root causes → fixes

1. **Every surface drew its own outline.** `GlassCard` set `border-hairline`, then
   `IconButton`/`Chip`/`Pill`/tiles drew another inside it — border-in-border.
   → Fills now carry the depth scale, one perceptible step per level:
   `subtle .03 → inset .05 → tile .06 → control .075 → track .09`. Panes keep a
   single lit top rim and their shadow.
2. **Two borders per screen chrome.** The app bar had a bottom hairline and the
   study header had a hairline *plus* the progress rail.
   → App bar: fill only. Study: the progress rail is the only line under it.
3. **Page width was a literal in six places.** `max-w-[620px]` ×6 and
   `max-w-[420px]` were re-typed per screen.
   → `layout.contentMaxWidth` (620) and `layout.resultMaxWidth` (420) in
   `theme/palette.js`; every screen uses them, so desktop aligns by token.
4. **The study card stretched to fill the viewport**, leaving a large dead area.
   → `layout.cardMinHeight` / `cardMaxHeight` cap the card and the study screen
   centres it; the content determines the visual weight, not the window.
5. **Decorative numbers were inline.** Skeleton shimmer, chart size, badge column,
   splash mark, rating tile and quiz answer heights were magic numbers.
   → Promoted: `heights.ratingTile`, `heights.quizAnswer`, `heights.hit`,
   `layout.donut`, `layout.badgeColumn`, `layout.splashMark`, `layout.splashRail`,
   `layout.cardMeasure`, `layout.answerMeasure`, `spacing.legendIndent`,
   `spacing.cardPad`.

### Allowed borders that remain (18)

| Case | Where |
| --- | --- |
| Focus ring | `SearchBar` (1 `borderWidth`) |
| Radio dot | `RadioOptionCard` (selected/unselected ring) |
| Dashed frame | "Add learning step" and empty-state frames |
| Lit top rim | `GlassCard`, `Flashcard`, `CardStack`, `RatingButtonRow` (7 total) |
| Non-border lines | 1px decorative rules, the sheet grab handle, a scrollbar colour |

Unused tokens were deleted after the sweep: `colors.hairline`,
`colors.hairlineFaint`, `rims.faint`, `rims.strong`.

### Component changes (primitives first, screens inherit)

- **GlassCard**: no border; accent tone is a fill. Rim stays, default on.
- **Button**: variants are fills + shadow; `outline` = accent wash, no ring.
- **IconButton**: filled circle, 44px guaranteed hit target via `heights.hit`.
- **Chip / Pill / StatPill / AchievementBadge / DeckCard tile**: fills only.
- **SegmentedControl**: control-fill rail, no inner dividers, raised selection.
- **SearchBar / Field / RichTextField**: no resting outline (focus ring kept).
- **TopAppBar / SectionHeader / SettingsPlate ledger / LearningStepRow /
  SettingsNote / ListRow dividers**: rules removed; spacing and fills group.
- **BottomSheetModal**: no top edge line; glass + shadow + handle.
- **Tab capsule**: no ring; `shadow.floating`.
- **Flashcard / CardStack**: card has no border and one rim; the layers behind it
  are pure fills; the answer-state accent ring (a border) is gone.
- **QuizAnswer / RatingButtonRow**: resolution and rating read from tint + glyph,
  with the check/cross kept so colour is never the only signal.
- **Skeletons**: borderless and matched to the real components' dimensions.

### Verification

- `npm run check:design` → clean (60 files).
- `npx tsc --noEmit` → 0 errors.
- `npm test` → 32 passing, 0 failing.
- Re-counted border references: 160 → 18 (all in the allowed table).

### Assumptions

- The task's "KNOWN ISSUES TO FIX FIRST" section was left empty, so the audit's
  own findings (dead area in the study card, border-in-border, six page widths)
  were treated as the priority list.
- Native-only rendering (iOS/Android shadows, blur) was verified through tokens
  and types, not on a device; screenshots are web (react-native-web).
- `expo-audio` haptics/sound behaviour is untouched (out of scope: no
  `data/`, `store/` or `services/` logic was edited).
