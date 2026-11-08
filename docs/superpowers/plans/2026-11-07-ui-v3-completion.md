# UI v3 "Nocturne Focus" Completion — Implementation Plan

> **For agentic workers:** execute this plan phase by phase, in order. Steps use checkbox (`- [ ]`) syntax for tracking. A task is not done until its acceptance line has been measured and recorded here or in the final report. Do not "finish" a screen by eye: every task ends with `tsc`, `check:design`, and the listed browser check.

**Goal:** Finish the v3 redesign of Memora's web UI so every route — not only Home, Game, Settings, Deck, the composer and the settings sub-pages — speaks one Nocturne Focus language, with one primitive set, no v1/v2 leftovers, and the existing accessibility/data-truth guarantees still measured green.

**Architecture:** v3 is already defined by `theme/v3.ts` (type steps, spacing, radii, rails, widths) plus sixteen components in `components/v3/`. The work is a **systematic rollout**, not a new design: extract the repeated grammar (scene pane, page header, section label, action pill, metric grid, rating keys) into primitives, then finish the remaining surfaces (Study, Quiz, Statistics, Profile, Discover, Add deck) plus the settings stragglers (Advanced, Import) and the shell (404, splash, skeletons, dock). Every conversion consumes tokens; no screen invents a value.

**Tech Stack:** Expo SDK 58 (`expo ~58.0.22`), React Native 0.88, React 19.3, TypeScript, Expo Router, react-native-web, NativeWind, Zustand, `ts-fsrs`. Tests: `node:test` for data, Playwright + axe-core for UI. Web only (`app.json` → `platforms: ["web"]`).

**Spec:** `docs/design-language.md` (the law), `theme/v3.ts` and `components/v3/` (the implemented reference), `docs/test-report-2026-11-06.md` (known defects), `AGENTS.md` (Expo SDK 58 versioned docs). There are no external mockups in the repository; **the shipped v3 screens are the visual reference**.

---

## Global Constraints

- **Expo SDK 58 only.** Read `https://docs.expo.dev/versions/v58.0.0/` before touching Expo APIs. SDK 57 references do not describe this app.
- **Web only.** No native project, no iOS/Android verification claimed, no store build.
- **No new dependencies.** Everything needed is already in `package.json`.
- **One token source.** Raw `hex`/`rgba` is forbidden outside `theme/`; `npm run check:design` must stay clean (currently 97 files).
- **One text primitive.** All text is `AppText`; no raw `Text` from `react-native`.
- **Tokens, not literals.** Spacing, radii, heights, icon sizes and type steps come from `theme/` or `theme/v3.ts`. New steps are added to `theme/v3.ts`, never inlined.
- **Touch targets ≥ 44×44 CSS px**, including icon-only controls. Colour is never the only signal.
- **Semantics.** Accessible name contains the visible label; no nested interactive elements; icon glyphs stay `aria-hidden` via `components/Icon`; sheets trap and restore focus.
- **One scene pane per screen.** At most one `tone="scene"` hero. Everything else is pane/inset/control fill.
- **Borders are exceptions.** Allowed: scene-pane 1px rim (`alpha(colors.outlineSoft, 0.3)`), the shelf rule (`colors.hairlineRule`), the folder guide (`colors.outlineVariant`), focus rings, radio dot, dashed empty frame, sheet handle. No new border just to separate content.
- **Widths.** Tab pages and stack pages use `v3.layout.contentMaxWidth` (960); the composer uses `composerMaxWidth` (420); the study stage uses `v3.layout.studyMeasure` (760).
- **Motion.** Only `motion/` helpers; every animation has a reduce-motion path.
- **Data is frozen.** No change to `data/repository.ts` keys, FSRS scheduling, review logging or stored shapes. The only data-layer change permitted is the pure folder-subtree count helper (Task 12) and correcting starter-deck sample counts (Task 9).
- **Existing harness stays green.** `tests/ui/surfaces.ts` (83 surfaces), route parity, axe, 44px targets, overflow, keyboard, reduced motion. Visual baselines change only when a task intentionally changes a layout, and are regenerated in that task.

---

## Review Focus

These are the inputs the design pass is most likely to break; each is pinned by a task so it cannot be lost between screens:

1. **320px + 200% text zoom + a 40-character or Persian/RTL deck name** — headers, hero figures, folder headers and rating keys must wrap or truncate without horizontal overflow.
2. **Fresh or emptied library** (0 decks, 0 cards, 0 reviews) — every new screen must show a real empty state with one action, never "All done" or an empty pane.
3. **Archived deck reached by direct URL** (`/deck/deck-archived`, `/study/deck-archived`, `/quiz/deck-archived`) — must explain the archive instead of offering a normal session.
4. **Keyboard-only + `prefers-reduced-motion`** in the add-deck sheet, the quiz arena and the study session — focus trap, Escape, visible ring, no motion-only state change.
5. **Missing route parameter or corrupt storage** (`/settings/algorithm-advanced` with no `deckId`, invalid JSON in `memory:decks`) — the failure copy must name the real cause and offer recovery.

---

## 1. Where v3 stands (measured 2026-11-07)

### Already in v3

| Surface | Evidence |
| --- | --- |
| Home (`app/(tabs)/home.tsx`) | `TodayPane`, `ShelfHeader`, `DeckShelfRow`, `FolderGroup`, `ArchivedRow`, `HeaderIcon` |
| Game (`app/(tabs)/library.tsx`) | v3 hero, session/streak tokens, `HeaderIcon`, 960 column |
| Settings index (`app/(tabs)/settings.tsx`) | `SettingsPane` grammar (`SettingsChapter`, `SettingsLine`) |
| Deck details (`app/deck/[id].tsx`) | v3 hero + ledger + ledger rows + options sheet |
| Card composer (`app/deck/[id]/add-card.tsx`) | card-face pane, 420 column, 30/36 prompt |
| Settings sub-pages (`algorithm`, `tts`, `offline`) | `SettingsBackHeader`, `SettingsHero`, chapters |
| Study session (`app/study/[deckId].tsx`) | `PageHeader`, `StudyCard`, `StudyTray`, `RatingKeys`, `SessionSummary`; archived and empty states |
| Study summary (`components/v3/SessionSummary.tsx`) | hero, metric grid, rating rail |

`components/v3/` is now 16 files / 2,984 lines; `components/v2/` is four files / 466 lines. `theme/v3.ts` owns hero/stat/deck-name/headline/composer type, panel/section/group/row spacing, 12/14/22/24 radii, 6/4 rails, 960/420/220 widths, plus the Task 3 `score`, `result`, `page`, `studyMeasure`, `ratingKey`, and `answer` steps.

### Partially converted

None. Tasks 7–10 completed Profile, the Advanced/Import/Dev settings surfaces, Discover and Add deck; every remaining surface is listed below.

### Still on v1/v2 grammar

| Surface | Size | Current imports | Specific gap |
| --- | --- | --- | --- |
| Quiz (`app/quiz/[deckId].tsx`) | 1,311 lines | `v2`, `GlassCard` | 156px timer ring, glass scoreboard, v2 result type; answer pads and Play again converted |
| 404 (`app/+not-found.tsx`) | 37 lines | base `EmptyState` | no v3 scene pane/action pill |
| Shell | — | `AppSplash`, `Skeleton.tsx`, `LiquidTabBar` | splash/skeletons still sized to v2 surfaces; dock needs a v3 audit |

### Guards and leftovers

- `node_modules` is installed in this workspace, so the planned baseline has been run: `npx tsc --noEmit` is clean, `npm test` is 161/161, `npm run test:surfaces` covers 83 surfaces, `npm run test:fixtures` is 14/14, and `npm run build:web` exports `dist/`. Playwright launches here with the browser dependencies staged under `.playwright-deps/`; the Study visual, axe and keyboard gates were measured in Task 4, and the remaining suites are run per task.
- `npm run check:design` → clean (97 files).
- The planning-time `skills/design-drift-audit` scan reported 9 off-grid spacing values, 4 literal font sizes, 4 `Screen` shells without standard switches, 1 direct `Animated.timing` in `app/(tabs)/library.tsx:44`, and 179 deliberate micro-spacings. These are Phase 0/1 clean-up, not a redesign, and this list has not been re-measured after Tasks 1–9.
- Retirement candidates are still live: `components/v2/*` (four files / 466 lines), `QuizStartCard`, `DeckCard`, `DeckLibrary`, `DeckListItem`, `DeckProgressCard`, `HeroPane`, `SectionHeader`, `SettingsPlate`, `SettingsRow`, `SettingsSection`, and `SettingsNote`. Task 13 must verify each with `rg` before deleting; do not treat the current list as an inventory of confirmed dead files.
- `theme/v2.ts` is imported by one app file — Home — plus `HeroPane`, `TopAppBar`, and `components/v2/{DeckRow,FolderRow,TodayRail}`. It retires with the last of them.

---

## 2. The v3 law this plan enforces

A v3 screen is built from four layers, in this order:

1. **Canvas** — `colors.background`, no decoration. `Screen` owns safe area, fixed header, scroll body, gutter, bottom clearance and column width.
2. **Scene pane** — at most one per screen: `colors.surfaceCardFace`, radius 24, 1px `alpha(colors.outlineSoft, 0.3)`, padding 20 (24 at ≥900). It carries the page's subject and its **one** primary action. This is the grammar already used by the Settings hero, the Game hero, the Deck hero and the composer — `TodayPane` is the one screen still using `glassFill`, and Task 1 unifies it.
3. **Panes and insets** — `glassFill` radius 22 for rows/cards; `colors.surfaceInset` radius 14 for folder headers and nested wells; `colors.surfaceControl` for chips, rails, inputs and icon tiles. No border.
4. **Type and controls** —
   - eyebrow `12/600 uppercase accent`; hero figure `40/44` (phone) → `56/58` (≥900); unit `20/600 outline`;
   - section label `12/600 uppercase outline` + count chip on `surfaceControl`;
   - deck/row name `17/24 semibold`; meta `13 outline`; tabular figures for every count;
   - primary action 52px, radius pill, `colors.primaryContainer`; quiet action `fills.control`;
   - all values tabular; all counts derived from the same helper the backend/queue uses.

**Rules that are not negotiable:** one accent pane, fills over lines, no raw numbers, no shadow, no second accent colour, no screen-level `paddingHorizontal`, no `max-w-[…]`.

**Screen order:** subject first (hero), then the one action, then the evidence/list, then secondary settings/footnotes. On stack pages, the back header is 64px and the title is the h1; on tab pages, the brand mark + "Memora" is the h1.

---

## 3. Target file structure

**New primitives**

| File | Responsibility | Used by |
| --- | --- | --- |
| `components/v3/Surface.tsx` | One pane primitive: `tone: 'scene' \| 'pane' \| 'inset' \| 'control'`, `radius: 'card' \| 'pane'`, `padding: 'none' \| 'sm' \| 'md'`. Encodes fill/border/radius in one place. | every converted screen |
| `components/v3/ActionButton.tsx` | 52px pill action, `tone: 'primary' \| 'quiet' \| 'success' \| 'danger'`, icon, disabled, full-width. Owns press feedback and accessible name. | Today hero, deck page, study footer, quiz result, empty states |
| `components/v3/PageHeader.tsx` | 64px app bar: brand or back, h1, optional meta (streak/status), `HeaderIcon` actions, content-width alignment. | all routes |
| `components/v3/SectionHeading.tsx` | Uppercase section label + count chip + optional right action + optional 1px `hairlineRule`. | Home shelf, Statistics, Profile, Discover, settings chapters |
| `components/v3/MetricGrid.tsx` | 2×2 (phone) / 4×1 (≥900) grid of inset metric tiles, value + label + note. | Study summary, Quiz result, Profile, Statistics |
| `components/v3/RatingKeys.tsx` | Four 68px rating keys with label + interval, colour wash, explicit `aria-label` with a separator. | Study session |

**New tokens in `theme/v3.ts`**

```ts
type: {
  // existing hero, heroWide, stat, deckName, headlineMd, composerFront
  score:  { fontSize: 44, lineHeight: 48, letterSpacing: -1.6 },  // replaces v2.type.score
  result: { fontSize: 64, lineHeight: 68, letterSpacing: -2.24 }, // replaces v2.type.result
},
spacing: {
  // existing panel 20, section 20, group 10, row 8
  page: 28,          // between major regions (replaces v2.spacing.section)
},
layout: {
  // existing contentMaxWidth 960, composerMaxWidth 420, deckRail 220
  studyMeasure: 760, // study stage and summary column
},
heights: {
  ratingKey: 68,     // one key; equals heights.ratingTile today
  answer: 64,        // quiz answer; equals heights.quizAnswer today
},
```

Do not duplicate the palette; these are steps the remaining screens currently borrow from `theme/v2.ts`.

---

## 4. Tasks

### Phase 0 — Baseline and law

#### Task 0: Record the baseline and make v3 the written law

**Files:**
- Modify: `docs/design-language.md` (add a v3 chapter; mark GlassCard-era rules superseded)
- Modify: `docs/superpowers/plans/2026-11-07-ui-v3-completion.md` (record numbers)

**Interfaces:** none (documentation only).

- [ ] Run `npm ci`; confirm `package-lock.json` is unchanged.
- [ ] Run and record: `npx tsc --noEmit`; `npm test`; `npm run check:design`; `npm run build:web`.
- [ ] Add to `docs/design-language.md`: the four-layer grammar from section 2, the allowed-lines table (scene rim, shelf rule, folder guide, focus ring, radio dot, dashed empty frame, sheet handle), the 64px header rule, and a "v3 page checklist" replacing the v2 checklist.
- [ ] State in the doc that `GlassCard`/`HeroPane`/`SectionHeader`/`SettingsPlate` are legacy and that new work uses `components/v3` only.
- [ ] Commit: `docs: make Nocturne Focus the written UI law`.

**Acceptance:** baseline commands and counts are written in this plan; the law describes exactly one design language and names the allowed borders. No source file changed.

---

### Phase 1 — Extract the v3 primitives

#### Task 1: `Surface` + `ActionButton`, and unify the scene pane

**Files:**
- Create: `components/v3/Surface.tsx`, `components/v3/ActionButton.tsx`
- Modify: `components/v3/index.ts`, `TodayPane.tsx`, `DeckShelfRow.tsx`, `ArchivedRow.tsx`, `SessionSummary.tsx`, `app/(tabs)/library.tsx` (hero/empty panes), `app/deck/[id].tsx` (scene pane + CTA), `app/(tabs)/settings.tsx` (hero), `app/settings/*.tsx` (hero)
- Test: `tests/e2e/visual.spec.ts` (same screenshots; intentional diff only where the border is unified)

**Interfaces:**
```tsx
type SurfaceTone = 'scene' | 'pane' | 'inset' | 'control';
export function Surface(props: {
  tone?: SurfaceTone;               // default 'pane'
  radius?: 'control' | 'card' | 'pane'; // 14 | 22 | 24, default 'pane'
  padding?: 'none' | 'sm' | 'md';   // 0 | 16 | 20
  style?: ViewStyle | ViewStyle[];
  testID?: string;
  children: React.ReactNode;
}): JSX.Element;

export function ActionButton(props: {
  label: string;
  onPress?: () => void;
  icon?: IconName;
  tone?: 'primary' | 'quiet' | 'success' | 'danger'; // default 'primary'
  disabled?: boolean;
  fullWidth?: boolean;                               // default true
  testID?: string;
}): JSX.Element;
```
`Surface` mapping: `scene` = `colors.surfaceCardFace` + 1px `alpha(colors.outlineSoft, 0.3)`; `pane` = `glassFill`; `inset` = `colors.surfaceInset`; `control` = `colors.surfaceControl`. `ActionButton` = 52px min height, `radii.pill`, `primaryContainer` for primary and `fills.control` for quiet, `accessibilityState={{ disabled }}`, icon `aria-hidden`.

- [x] Create the two components and export them.
- [x] Refactor `TodayPane` from `glassFill + top rim + accentLine` to `Surface tone="scene"`, keeping its rail, status chip and CTA (CTA becomes `ActionButton`).
- [x] Refactor `DeckShelfRow`/`ArchivedRow`/`SessionSummary`/library/deck/settings panes to `Surface`; delete the repeated `borderColor: alpha(colors.outlineSoft, 0.3)` literals.
- [x] Replace the deck page's inline 52px pill and `SessionSummary`'s `StartButton` with `ActionButton`.
- [x] Run `npx tsc --noEmit`, `npm run check:design`, `npm test`, `npm run build:web`; all pass.
- [ ] Visual regression baseline run — **blocked in this workspace**: Playwright's Chromium cannot launch (`libnspr4.so` missing, no root to install system libs). The four converted routes were inspected in the cloud browser instead.
- [ ] Commit: `refactor(ui): one v3 surface and one v3 action` (left uncommitted for review).

**Acceptance:** the scene-pane border literal lives only in `Surface.tsx`; the one other `outlineSoft, 0.3` ring (`app/deck/[id]/add-card.tsx:646`) marks the composer's selected colour swatch, which is a state indicator, not a pane. All converted screens keep their geometry; the four routes were visually inspected with zero horizontal overflow.

**Result (2026-11-07):** `npx tsc --noEmit` **0** · `npm run check:design` **clean (93 files)** · `npm test` **161/161** · `npm run build:web` exported `dist/`. Inspected `/home`, `/library`, `/deck/deck-german-a2b1` and `/settings` on the exported build: scene panes, deck rows, summary panes and action pills render the v3 geometry; document width equals viewport (432px) on all four. `Surface` gained a `control` radius (14) so the session-summary metric tiles keep their existing radius instead of drifting to a card radius. Playwright screenshot diffs remain open because the launcher cannot run here; screenshots are in `artifacts/v3-*.png`.

#### Task 2: `PageHeader` + `SectionHeading` + `MetricGrid`

**Files:**
- Create: `components/v3/PageHeader.tsx`, `SectionHeading.tsx`, `MetricGrid.tsx`
- Modify: `components/v3/index.ts`, `app/(tabs)/home.tsx`, `library.tsx`, `settings.tsx`, `app/deck/[id].tsx`, `app/deck/[id]/add-card.tsx`, `app/statistics.tsx`, `app/profile.tsx`, `app/discover/index.tsx`, `app/settings/*.tsx`

**Interfaces:**
```tsx
export function PageHeader(props: {
  title?: string;                  // omit on brand pages
  brand?: boolean;                 // mark + "Memora" + h1
  back?: boolean;                  // 44px back, label "Go back"
  onBack?: () => void;
  meta?: React.ReactNode;          // streak / status chip
  actions?: React.ReactNode;       // HeaderIcon siblings
  maxWidth?: number;               // default v3.layout.contentMaxWidth
}): JSX.Element;

export function SectionHeading(props: {
  label: string;
  count?: string;
  hint?: string;
  action?: React.ReactNode;
  rule?: boolean;                  // default true outside panes
}): JSX.Element;

export type Metric = { label: string; value: string; unit?: string; note?: string; icon?: IconName; color?: string };
export function MetricGrid(props: { items: Metric[]; columns?: 2 | 4 }): JSX.Element;
```

- [x] Create the components. Header height is **64** (`heights.pageHeader`); title is `AppText variant="headline" headingLevel={1}`; back is `HeaderIcon icon="arrow-back"` with a 44px target. `PageHeader` also exports `HeaderProfileButton` for the shared 32px avatar on a 44px target.
- [x] Convert Home, Game, Settings, Deck, Advanced/TTS/Offline headers **and the composer's 56px bar** to `PageHeader` (brand on Home, title on the other tabs, back on stack pages). Duplicated header markup and the 56/64 mix are gone from the converted routes.
- [x] Convert Home's `ShelfHeader` body and every screen `SectionHeader` call site to `SectionHeading`; the shelf keeps its count chip, right-side Folders action and 20% rule. The legacy `SettingsSection` still uses `SectionHeader` until Task 13.
- [x] Convert Statistics' repeated metric pairs to `MetricGrid`; Profile has no metric ledger to convert, and the Quiz result ledger moves in Task 5 with the rest of that result screen.
- [x] Run `npx tsc --noEmit`, `npm run check:design`, `npm test`, `npm run test:surfaces`, `npm run test:fixtures`, `npm run build:web`; all pass. Playwright a11y/keyboard are **blocked** by the missing Chromium system library.
- [x] Commit: `feat(ui): one v3 header, section and metric grammar`.

**Acceptance:** every converted route renders exactly one `h1` in a 64px header; `TopAppBar` remains only on the not-yet-converted screens until Task 11; no horizontal overflow in the inspected routes; axe/keyboard verification is still blocked by the Playwright launcher.

**Result (2026-11-07):** `npx tsc --noEmit` **0** · `npm run check:design` **clean (96 files)** · `npm test` **161/161** · `npm run test:surfaces` **11/11** · `npm run test:fixtures` **14/14** · `npm run build:web` exported `dist/`. Loaded the `/dev` fixture (6 decks, 47 cards, 33 reviews) and inspected `/home`, `/library`, `/deck/deck-german-a2b1`, `/deck/deck-german-a2b1/add-card`, `/settings`, `/settings/tts` and `/statistics` at 432px: the brand/title/back bars are 64px, the profile avatar is a 44px target, Statistics renders the new section rules and metric tiles, and every route reports one `h1` with `scrollWidth === innerWidth`. Home exposed a pre-existing second `h1` in `TodayPane`; the date eyebrow is now level 2. The Statistics inner scroller would not move for a second capture, so the grid was verified from the first row plus rendered text. Playwright visual/a11y/keyboard suites still cannot launch (`libnspr4.so` missing), so the axe/keyboard gates are not run.

#### Task 3: `RatingKeys` and the study/quiz control vocabulary

**Files:**
- Create: `components/v3/RatingKeys.tsx`
- Modify: `components/v3/index.ts`, `app/study/[deckId].tsx`, `app/quiz/[deckId].tsx`, `components/QuizAnswer.tsx`, `theme/v3.ts`
- Delete (at end of task): `components/v2/StudyRatings.tsx`, `components/v2/StartButton.tsx`
- Test: `tests/e2e/flows.spec.ts`, `tests/e2e/quiz-result.spec.ts`

**Interfaces:**
```tsx
export type RatingKey = {
  rating: 1 | 2 | 3 | 4;
  label: string;                   // Again / Hard / Good / Easy
  interval: string;                // "1m", "6m", "10m", "9d"
};
export function RatingKeys(props: {
  keys: readonly RatingKey[];
  onRate: (rating: 1 | 2 | 3 | 4) => void;
  disabled?: boolean;
}): JSX.Element;
```
Each key is one `Pressable` ≥68px tall, `accessibilityRole="button"`, `accessibilityLabel={`${label} — ${interval}`}`, colour wash + text so colour is never the only signal.

- [x] Add `score`/`result`/`page`/`studyMeasure`/`ratingKey`/`answer` to `theme/v3.ts`.
- [x] Implement `RatingKeys` and use it in Study in place of `StudyRatings`.
- [x] Restyle `QuizAnswer` to `Surface tone="control"`, radius 14, 64px, letter chip A–D, success/error washes and check/cross; keep the current state machine.
- [x] Replace every `StartButton` with `ActionButton`.
- [x] Run `npx tsc --noEmit`, `npm run check:design`, `npm test`, and `npm run build:web`; all pass.
- [ ] Run `npx playwright test tests/e2e/flows.spec.ts tests/e2e/quiz-result.spec.ts`; blocked by the missing Chromium system library.
- [ ] Commit: `feat(ui): v3 rating keys and answer tiles`.

**Result (2026-11-07):** `npx tsc --noEmit` **0** · `npm run check:design` **clean (95 files)** · `npm test` **161/161** · `npm run build:web` exported `dist/`. Added the Task 3 tokens, the 14px/68px `RatingKeys` with names like `Again — 1m`, v3 action pills in Study and Quiz, and the v3 control answer pad (64px, A–D chip, state wash and glyph). `StartButton` and `StudyRatings` were deleted; `TodayHero` now uses `ActionButton`. Playwright flows/quiz-result remain blocked (`libnspr4.so` missing). Study still imports `TodayRail` from v2; Task 4 removes it.

**Acceptance:** rating buttons expose names like `Again — 1m`; study and quiz flows still log one review per answer; no `StartButton`/`StudyRatings` import remains in these two screens. The four-key 320px geometry and axe checks remain unmeasured because Playwright cannot launch; `TodayRail` remains in Study until Task 4.

---

### Phase 2 — Core loops

#### Task 4: Study session in v3

**Files:**
- Modify: `app/study/[deckId].tsx` (997 lines), `components/v3/SessionSummary.tsx`, `components/Flashcard.tsx` (only if the stage needs a v3 `full` frame)
- Test: `tests/e2e/flows.spec.ts`, `tests/e2e/visual.spec.ts`, `tests/e2e/data-truth.spec.ts`

**Interfaces:**
- Consumes `PageHeader`, `Surface`, `ActionButton`, `RatingKeys`, `SessionSummary`.
- Produces no new exports; session state (`queue`, `index`, `sessionTotal`, `lastUndo`, `waiting`) stays as-is.

- [x] Replace the `TopAppBar` header with `PageHeader`: close (44), deck name, session counter, undo (44), and a 4px progress rail directly under the bar. The scheduler state stays the card's pill, where the Study card already shows it; progress text uses the fixed `sessionTotal` set when the queue is built — verify it never grows mid-session (P3).
- [x] Put the card in one `Surface tone="scene"` stage, radius 24, no padding on the frame; the flashcard keeps its own 24px inner padding and `textDirection`. Keep the answer reveal, speak control and S/R/D pill.
- [x] Put `RatingKeys` in the fixed footer (`Screen footer`), with Show answer as `ActionButton` before reveal.
- [x] Empty deck (P8): if `deckCards.length === 0`, render a scene empty state — "No cards in this deck" + `ActionButton label="Add cards"` — never "All done" / "0 / 0".
- [x] Archived deck (P4): if `deck.archivedAt`, block the session with "This deck is archived" and an `ActionButton label="Restore deck"` that clears `archivedAt`; the deck page must not offer Start session while archived.
- [x] Session summary: `StartButton` → `ActionButton`, ledger → `MetricGrid`; keep the four real metrics and the undo/back actions.
- [x] Run `npx tsc --noEmit`, `npm run check:design`, `npm test`, `npx playwright test tests/e2e/flows.spec.ts tests/e2e/data-truth.spec.ts`, and capture 320/390/1280 screenshots (question, answer, waiting, summary, empty, archived).
- [ ] Commit: `feat(study): v3 session stage, keys and honest empty states`.

**Acceptance:** a 5-card session shows a constant denominator from first to last card; the empty and archived states never claim completion; rating names include a separator; axe 0 on the four states; no horizontal overflow at 320 with a 40-char deck name.

**Result (2026-11-08):** `npx tsc --noEmit` **0** · `npm run check:design` **clean (97 files)** · `npm test` **161/161** · `npm run build:web` exported `dist/`. Study flows **6/6**, including the new archive → restore → reload test; keyboard **1/1**; axe **0** on the session (question), answered, empty and archived states; `study-answer-{320,390}` baselines regenerated and green. The session and completion bars are `PageHeader` (which gained a custom `leading` slot for Close, and `HeaderIcon` gained a disabled state for Undo): the session h1 is the deck name, the fixed counter is meta and Undo is the action. At 320/390/1280 the session has **0** controls under 44px and **0** horizontal overflow; a 40-character deck name and a Persian name at 320 also overflow **0**. Archiving a deck and opening `/study/deck-german-a2b1` explains the archive, restores into the session and survives reload; the deck page's primary action reads "Deck archived" and is disabled. `data-truth.spec.ts` is **7/11**: the four failures are the known Home/folder/deck-row totals owned by Task 12, not this surface. The waiting state was not separately axe-scanned. Commit left uncommitted for review.

#### Task 5: Quiz arena and result in v3

**Files:**
- Modify: `app/quiz/[deckId].tsx` (1,311 lines), `components/QuizAnswer.tsx`
- Test: `tests/e2e/quiz-result.spec.ts`, `tests/e2e/flows.spec.ts`, `tests/e2e/visual.spec.ts`

**Interfaces:**
- Consumes `PageHeader`, `Surface`, `ActionButton`, `MetricGrid`, `SectionHeading`, `v3.type.score/result`.
- Keeps `data/quiz.ts` untouched: `applyAnswer`, `tick`, `finishCleared`, review logging and the +3s/−2s rules.

- [ ] Header: close, deck name, mode pill (`Forward`/`Reverse`), question counter; 64px, no glass card.
- [ ] Scoreboard: `Surface tone="scene"` with eyebrow "Round", the **timer as a 6px rail + a 40/44 tabular seconds figure** (replace the 156px ring), a 40/44 score figure, combo pill `×n`, and a polite live region for score/time changes. Remove the second `v2.type.score` step.
- [ ] Question pane: `Surface tone="pane"`, prompt at `v3.type.composerFront` (30/36) or `headlineMd`, direction from the card.
- [ ] Answers: 2×2 grid of restyled `QuizAnswer`s (64px, radius 14, letter chip). Keep the 320/320 wrong/correct reveal timings and the dimmed state.
- [ ] Result: one `Surface tone="scene"` with the result figure at `v3.type.result` (64/68), "New best" pill, accuracy/correct/wrong/combo in `MetricGrid`, and `ActionButton`s for Play again / Back to Game. Reuse the `SessionSummary` grammar rather than a one-off overlay.
- [ ] Loading / deck-not-found / not-playable states use the v3 scene + `ActionButton`; keep the existing copy fixes.
- [ ] Run `npx tsc --noEmit`, `npm run check:design`, `npx playwright test tests/e2e/quiz-result.spec.ts tests/e2e/flows.spec.ts`, and screenshot the arena at 320/390/1280 plus the result.
- [ ] Commit: `feat(quiz): v3 arena, timer rail and result`.

**Acceptance:** a played round still writes one FSRS review per answer and updates Home's due count; correct answers add 3s and wrong answers subtract 2s; score and timer are readable at 320 and with 200% zoom; axe 0; no `v2.` reference in the file.

---

### Phase 3 — Data screens

#### Task 6: Statistics in v3

**Files:**
- Modify: `app/statistics.tsx` (1,744 lines)
- Test: `tests/e2e/statistics-visual.spec.ts` (6 baselines × 3 widths), `tests/e2e/data-truth.spec.ts`

**Interfaces:**
- Consumes `PageHeader`, `Surface`, `SectionHeading`, `ActionButton`, `EmptyState`, `DonutChart`, `TrendChart`, `MiniBarChart`, `MetricGrid`.
- Preserves every `data/intelligence.ts` computation and the range selector values (`RANGE_OPTIONS`).

**Status (2026-11-08):** complete — one scene hero, `SectionHeading` sections, a scene empty state with the start action, and the Playwright gate. Committed as `94cb70d`.

- [x] Replace `HeroPane` with one `Surface tone="scene"`: eyebrow "Intelligence", status pill (`FSRS-6` / `Not enough data`), the page's one hero figure (recall % when `MIN_RECALL_SAMPLE` is met, otherwise the review count — label it explicitly), the range `SegmentedControl`, and a 3-cell ledger (reviews, streak, due). Remove the two stacked `GlassCard` fallbacks.
- [x] Replace every `SectionHeader` with `SectionHeading` (uppercase 12/600, count chip, no `mt-7` classes).
- [x] Convert every `GlassCard` to `Surface` (`pane` for chart cards, `inset` for nested tables/notes); delete `className="mt-3"` in favour of `v3.spacing.page`.
- [x] Keep all numbers tabular; ensure forecast/habits bars use `v3.rail` or token heights, not literals.
- [x] Empty state (`0` reviews): one scene pane explaining which sample is missing, with `ActionButton label="Start a session"`.
- [x] Run `npx tsc --noEmit`, `npm run check:design`, `npm test`, `npx playwright test tests/e2e/statistics-visual.spec.ts --update-snapshots`, then `tests/e2e/data-truth.spec.ts`.
- [x] Commit: `feat(statistics): v3 intelligence desk` (`94cb70d`).

**Result (2026-11-08):** `app/statistics.tsx` is **1,744 lines** and no longer imports `theme/v2`. One `Surface tone="scene"` hero carries the range eyebrow, FSRS-6 / Not-enough-data pill, the page's one figure (recall when the sample clears `MIN_RECALL_SAMPLE`, otherwise the review count), the `SegmentedControl` ranges, a Reviews/Streak/Due ledger and the activity bars. Every section is `SectionHeading` through a thin `StatsSection`; the zero-review range is one scene pane explaining the missing sample, with `Start a session`. New `v3.rail` tokens own the activity, habit and forecast heights. `npx tsc --noEmit` **0** · `npm run check:design` **clean (97 files)** · `npm test` **161/161** · `npm run build:web` exported `dist/` · 18 `statistics-visual` baselines regenerated and verified · the 320/390 empty-state baselines regenerated · axe **0** · statistics data-truth **1/1** · 0 document overflow and 0 controls under 44px at 320/390/1280. The section baselines now align each heading to the top of the scroller, and the 320px habit/memory labels were shortened to fit. The macOS `visual.spec` baselines were not refreshed in this Linux workspace; the obsolete second empty-state snapshot was removed and Linux empty-state baselines were added.

**Acceptance:** 18 statistics baselines regenerated and reviewed; every displayed number still matches the recomputed fixture; 320px has 0 document overflow; one scene pane; axe 0.

#### Task 7: Profile in v3

**Files:**
- Modify: `app/profile.tsx` (692 lines)
- Test: `tests/e2e/a11y.spec.ts`, `tests/e2e/data-truth.spec.ts`, `tests/e2e/visual.spec.ts`

**Interfaces:**
- Consumes `PageHeader`, `Surface`, `SectionHeading`, `ActionButton`, `EmptyState`; the three-cell Reviews/XP/Streak ledger is a scene inset row rather than `MetricGrid`, whose phone shape is 2-up.
- Preserves the review-log-derived XP/streak/achievement logic.

**Status (2026-11-08):** complete — one scene hero, a 3-at-320/4-at-900 badge grid, inset deck lines, the no-reviews and no-decks actions, and the Profile axe gate are measured. Left uncommitted for review.

- [x] Replace `HeroPane` with one `Surface tone="scene"`: level figure, XP rail, streak status, and a ledger (reviews, XP, streak). Active days remain a quiet caption under the ledger.
- [x] Replace the horizontal achievement rail with a responsive grid: **3 columns at 320 / 4 at ≥900**. Locked badges keep a visible lock glyph and a `Locked` state label; earned badges use `Earned`.
- [x] Replace the deck `GlassCard` list with inset lines (name, card count, due) using `SectionHeading`; no `SectionHeader`. Archived decks keep `Archived` instead of a due count.
- [x] Empty state: no reviews yet → "Your record starts with one card" + `ActionButton` to study; an empty library → "No decks yet" + `Browse starter decks`.
- [x] Run `npx tsc --noEmit`, `npm run check:design`, `npx playwright test tests/e2e/a11y.spec.ts`, `tests/e2e/data-truth.spec.ts`; screenshot 320/390/1280 populated, no-reviews and no-decks. Profile axe **1/1**; the full a11y suite is **15/18** with three failures on the untouched `/library` surface and the global zoom check (see Result).
- [ ] Commit: `feat(profile): v3 record and badge grid` — left uncommitted for review.

**Result (complete, 2026-11-08):** `app/profile.tsx` is **692 lines** and no longer imports `theme/v2`. One scene hero carries LEVEL, the XP rail, the 13-day streak status, a Reviews/XP/Streak ledger and `13 active days`; the badge grid is 3-up at 320/390 and 4-up at 1280, with lock glyphs and state labels. Decks are inset lines with name, card count and due: `30 cards · 26 due`, `6 cards · 6 due`, `4 cards · 4 due` ×2, and `3 cards · Archived`. The no-reviews state is the record prompt with `Start studying`; the no-decks state has `Browse starter decks`. `npx tsc --noEmit` **0** · `npm run check:design` **clean (97 files)** · `npm test` **161/161** · `npm run build:web` exported `dist/`. Profile axe **1/1**; Profile data-truth **1/1** (330 XP, level 1, 13-day streak, 2 of 5 badges, deck order). 0 document overflow and 0 controls under 44px at 320/390/1280; screenshots: `qa/profile-v3-{320,390,1280}.png`, `qa/profile-empty-record-v3-{320,390}.png`, `qa/profile-no-decks-v3-390.png`. The full `a11y.spec.ts` run is **15/18**: `/library` still has `aria-required-attr`/`aria-required-parent` violations and two 38px mode controls, and the 200% text-zoom test fails there; the Profile test itself is green and those files were not touched.

**Acceptance:** 0 horizontal overflow at 320 (the P10 badge rail is gone); badge names include state; one scene pane; axe 0.

#### Task 8: Advanced, Import and Dev on the v3 settings grammar

**Files:**
- Modify: `app/settings/algorithm-advanced.tsx` (518), `app/mass-import.tsx` (131), `app/dev.tsx` (216)
- Test: `tests/e2e/a11y.spec.ts`, `tests/e2e/flows.spec.ts`

**Interfaces:**
- Consumes `PageHeader`, `SettingsBackHeader`, `SettingsHero`, `SettingsChapter`, `SettingsLine`, `SettingsFootnote`, `Surface`, `ActionButton`.
- No scheduler behaviour changes.

**Status (2026-11-08):** complete — all three pages use the v3 settings grammar, the missing-`deckId` state names the real cause, and the checks below pass. Left uncommitted for review.

- [x] `algorithm-advanced`: replace `SettingsPlate`/`SettingsSection` with the v3 settings components; keep every slider/step/row. Missing `deckId` (P9) shows "No deck chosen — open this page from a deck's algorithm settings" plus a Back action, not "It may have been deleted".
- [x] `mass-import`: convert to the v3 settings rhythm; keep the honest "Planned / parser not wired" status; remove the old plate/ledger and dashed frames. It must not pretend to accept a file.
- [x] `dev`: convert to the same rhythm (it is a developer surface, but it still ships in the bundle and shows up in coverage).
- [x] Remove the last `SettingsPlate`/`SettingsRow`/`SettingsSection`/`SettingsNote` imports after this task.
- [x] Run `npx tsc --noEmit`, `npm run check:design`, `npx playwright test tests/e2e/a11y.spec.ts`.
- [ ] Commit: `feat(settings): finish the v3 chapter grammar` — left uncommitted for review.

**Result (complete, 2026-11-08):** `algorithm-advanced` is **518 lines**, `mass-import` **131**, and `dev` **216**. Advanced keeps every step row, toggle and the edit sheet behind `SettingsBackHeader` + one `SettingsHero` + chaptered `SettingsLine`s; a missing `deckId` shows "No deck chosen", the cause and a Back action. Import is one `Planned` hero, three `On hold` source lines, a `Pending` parser line, the planned route and a footnote — with no file control. Dev keeps load / restore / two-tap wipe on three `ActionButton`s, with the device counts in the hero and a destructive-action footnote. No `SettingsPlate`/`SettingsRow`/`SettingsSection`/`SettingsNote` import remains in `app/`; the app's `theme/v2` importers drop from six to three (Home and Discover ×2). The legacy components still exist and are exported for Task 13 to retire. `npx tsc --noEmit` **0** · `npm run check:design` **clean (97 files)** · `npm test` **161/161** · `npm run build:web` exported `dist/` · missing-deck flow **1/1** · Advanced/Import/Dev axe **3/3** · full `a11y.spec.ts` **17/20**, with the three failures confined to untouched `/library` (axe, two 38px controls) and its 200% zoom check. 0 document overflow and 0 controls under 44px at 320/390/1280; screenshots: `qa/{advanced,import,dev}-v3-{320,390,1280}.png` and `qa/advanced-missing-v3-390.png`.

**Acceptance:** all settings routes share one header/hero/line rhythm; the missing-parameter copy names the real cause; axe 0; no `SettingsPlate` import remains in `app/`.

---

### Phase 4 — Library surfaces

#### Task 9: Discover index and preview in v3

**Files:**
- Modify: `app/discover/index.tsx` (294), `app/discover/[id].tsx` (385), `data/starterDecks.json` (the four false `cardCount` values)
- Test: `tests/e2e/flows.spec.ts` (import flow), `tests/e2e/a11y.spec.ts`

**Interfaces:**
- Consumes `PageHeader`, `Surface`, `SectionHeading`, `ActionButton`, v3 inset catalogue rows, `EmptyState`.
- Keeps `services/discovery.ts` (`fetchFeaturedDecks`, `importDeck`) untouched.

**Status (2026-11-08):** complete — both Discover routes use the v3 hero/row grammar, every visible count is the four-card import, and the import flow persists exactly four cards. Left uncommitted for review.

- [x] Index: 64px back header "Discover", one scene hero ("Starter decks" + count + one sentence), then one pane of catalogue rows: name, level/language, and **the number of cards that will actually import** (`sampleCards.length`), never the advertised `cardCount` (P11).
- [x] Preview: scene hero with the deck name, description, sample count and level; a pane of sample cards (front → back, inset rows, RTL respected); a fixed footer `ActionButton label="Add to library"` with importing/disabled state and an inline error.
- [x] Correct or remove `cardCount` in `data/starterDecks.json` so no surface can show a number that the import does not create.
- [x] Loading: `SkeletonRow`/`Skeleton` matched to the new row/hero dimensions; error: scene pane with Retry.
- [x] Run `npx tsc --noEmit`, `npm run check:design`, `npx playwright test tests/e2e/flows.spec.ts`, screenshot index + preview at 320/1280.
- [ ] Commit: `feat(discover): v3 catalogue and honest sample counts` — left uncommitted for review.

**Result (complete, 2026-11-08):** `app/discover/index.tsx` is **294 lines** and `app/discover/[id].tsx` **385**. The index opens with one `Discover` scene hero (`4 decks`, one sentence) above a catalogue pane; each row carries the deck colour/icon, its description and `4 cards · preview` under the copy, so names stay readable at 320. The preview has a scene hero with `4 cards`, Level/Source/Import, four front → back sample rows with `textDirection`, and a fixed `Add to library` footer; loading uses the new row/hero dimensions and both routes have scene-pane Retry/Back states. `data/starterDecks.json` now says `cardCount: 4` on all four decks, matching `sampleCards.length`; a real import persisted a French Basics deck with exactly **4 cards**. `npx tsc --noEmit` **0** · `npm run check:design` **clean (97 files)** · `npm run build:web` exported `dist/` · Discover import flow **1/1** · Discover index/preview axe **2/2** · 0 document overflow and 0 controls under 44px at 320/390/1280; the fixed footer kept the same viewport position after scrolling. Screenshots: `qa/discover-v3-{320,390,1280}.png` and `qa/discover-preview-v3-{320,390,1280}.png`. The full flow file timed out after **29/45** tests (24 passed, 5 unrelated folder/navigation failures, 16 not run); the Discover test in that run passed. App `theme/v2` importers are down from three to one (Home).

**Acceptance:** `/discover` is reachable from Home and lists all four starter decks; preview → Add imports exactly the advertised number; 0 overflow; axe 0.

#### Task 10: Add-deck sheet in v3

**Files:**
- Modify: `app/add-deck.tsx` (332), `components/BottomSheetModal.tsx` (only the v3 sheet face/handle if needed)
- Test: `tests/e2e/keyboard.spec.ts`, `tests/e2e/flows.spec.ts`, `tests/e2e/visual.spec.ts` (`add-deck-320/390`)

**Interfaces:**
- Keeps the current focus trap, inert background, Escape handling and restore-to-opener.
- Consumes `Surface`, `ActionButton`, `Field`, `AppearancePicker`.

**Status (2026-11-08):** complete — `/add-deck` is one v3 form sheet with a sticky footer, live duplicate/empty validation and the existing focus contract. Committed as `feat(add-deck): v3 sheet`.

- [x] Restyle the panel: 28px radius, `glass.sheet` face, 44×4 handle, 64px header ("New deck", close 44), 20px padding, safe-area bottom.
- [x] Form: name field (44), description field, icon/colour picker tiles (44), inline error, primary `Create deck` (52) + quiet `Cancel`. Keep live duplicate/empty validation.
- [x] Ensure the sheet body scrolls at 320×700 with the keyboard open, and the footer action stays reachable.
- [x] Run `npx tsc --noEmit`, `npm run check:design`, `npx playwright test tests/e2e/keyboard.spec.ts tests/e2e/flows.spec.ts --update-snapshots`, review both baselines.
- [x] Commit: `feat(add-deck): v3 sheet`.

**Result (complete, 2026-11-08):** `app/add-deck.tsx` is **332 lines** and is a single form sheet; the intermediate "Add manually" hand-off and nested `BottomSheetModal` are gone. The panel is one `glass.sheet` face at 28px with a 44×4 handle, a 64px header, 20px gutters and safe-area bottom; the name/description fields sit in a `Surface` pane, and the 52px `Create deck` plus quiet `Cancel` stay pinned while the picker scrolls. Duplicate names (case-insensitive) and a cleared name show inline errors; the primary action disables for both. Runtime: 320×700 panel **658px**, body scroll **1203px / 448px**, footer unchanged after scrolling; 320×400 compact/keyboard-height panel **376px**, footer still reachable; 0 document overflow and 0 controls under 44px at 320/390. A real create persisted `V3 Sheet Deck` with its description and 0 cards. `npx tsc --noEmit` **0** · `npm run check:design` **clean (97 files)** · `npm run build:web` exported `dist/` · add-deck axe **1/1** · create/reload/delete flow **1/1** · direct-close **1/1** · keyboard focus/Escape **1/1** · visual **3/3**. Linux Chromium baselines `add-deck-320/390` were generated and reviewed; the pre-existing Darwin baselines were not regenerated in this Linux workspace. Screenshots: `qa/add-deck-v3-{320,390}.png`, `qa/add-deck-validation-v3-320.png`, `qa/add-deck-scrolled-v3-320.png`, `qa/add-deck-compact-v3-320.png`.

**Acceptance:** focus is trapped on open, Escape closes, focus returns to "Add deck"; 320px screenshot reviewed; axe 0; create/validation flow reloads with the new deck.

#### Task 11: Shell — 404, splash, skeletons, dock

**Files:**
- Modify: `app/+not-found.tsx`, `components/AppSplash.tsx`, `components/Skeleton.tsx`, `components/LiquidTabBar.tsx`, `components/LaunchSkeleton.tsx`
- Test: `tests/boot/mount.spec.ts`, `tests/boot/offline.spec.ts`, `tests/e2e/a11y.spec.ts`, `tests/e2e/keyboard.spec.ts`

**Interfaces:** no new exports; visual-only changes.

- [x] 404: one scene pane, "This page moved on", `ActionButton label="Back to Game"`; no raw centring with `px-6`.
- [x] Splash: mark/rail use `v3`/palette tokens; exit stays opacity-only (no 1.02 scale, no 3px overflow).
- [x] Skeletons: match the new dimensions — `DeckShelfSkeleton` (22px row, 44 tile), `StatisticsSkeleton` (scene hero + chart panes), `QuizSkeleton` (scoreboard + 2×2 answers), `StudyCardSkeleton` (24 stage + 80 keys), `SettingsGroupSkeleton` (64 header + hero + lines).
- [x] Dock: verify 64px height, 300px max, 3×88 cells, 52px pill, `selectionSurface` lens, no rim; labels visible; 44px targets; active tab exposed as current. Fix only what disagrees with the token values.
- [x] Run `npx tsc --noEmit`, `npm run check:design`, `npm run test:boot`, `npx playwright test tests/e2e/keyboard.spec.ts`, `npx playwright test tests/e2e/a11y.spec.ts -g "not-found"`.
- [x] Commit: `feat(shell): v3 404, splash and skeletons`.

**Result (complete, 2026-11-08):** The 404 is one `Surface tone="scene"` in a 420px composer column with `PageHeader`, a 52px `ActionButton` and a 44px back target; axe is clean and neither 320 nor 390 overflows. Splash already had the v3 contract (full-viewport overlay, opacity-only exit, `overflow: hidden`, no transform); the real hand-off fix was passing `pathname` from `app/_layout.tsx` so a deep link no longer paints the Home skeleton first. Home's skeleton now matches the final surfaces: hero **329/308px** and deck row **125px** at 320/390, with the row top within **1px**. Settings hero is **230/210px**, chapter panes **177/159px** against final **179/159px**, and chapter tops within **1–2px** after reserving one row step for the caption. The Study stage stays **452px** at top 80. Quiz uses the live geometry: **17px** progress row, **367/406px** reserved above the answers, stage top **220/250px** exactly at 320/390 (and answer rows **74/88px** at 320). Dock measures **276×64** at both widths (300px max, 6px padding, 3×88px tabs, 82×52px lens), has **0 border**, uses `selectionSurface` (`rgb(35, 49, 67)`), keeps labels visible and exposes the active tab with `aria-selected="true"`. Statistics follows the plan's populated hero + chart-pane skeleton; the seeded empty 30-day range replaces it with a shorter empty scene, so that one capture is longer than final by design. `npx tsc --noEmit` **0** · `npm run check:design` **clean (97 files)** · `npm run build:web` exported `dist/` · `npm run test:boot` **3/3** under 4× CPU · keyboard **2/2** · not-found axe **1/1** · **24** Task 11 captures in `qa/task11-*.png`. Committed as `feat(shell): v3 404, splash and skeletons`.

**Acceptance:** boot test shows no blank frame and no 3px overflow; dock measurements match `theme/palette.js`; skeleton screenshots at 320/390 match the final surfaces within one spacing step.

---

### Phase 5 — Repairs and retirement

#### Task 12: Data-truth repairs

**Files:**
- Modify: `data/folders.ts`, `data/folders.test.ts`, `app/(tabs)/home.tsx`, `app/deck/[id].tsx`, `app/study/[deckId].tsx`
- Test: `data/folders.test.ts`, `tests/e2e/data-truth.spec.ts`

**Interfaces:**
```ts
export type FolderSubtreeCount = { decks: number; due: number; nestedFolders: number };
export function folderSubtreeCounts(
  folders: readonly DeckFolder[],
  decks: readonly Deck[],
  dueByDeck: Readonly<Record<string, number>>
): Map<string, FolderSubtreeCount>;
```
Pure, no storage, no store dependency.

- [ ] Add `folderSubtreeCounts` and unit tests: a folder with 0 direct decks but 2 nested decks reports `{ decks: 2, nestedFolders: 1 }`; due sums through the subtree; a cycle cannot recurse forever; archived decks stay excluded.
- [ ] Home folder headers use the subtree count and say `0 direct · 2 nested` when both are true; the shelf meta and the hero total must agree with each other (P5).
- [ ] Deck page: while `archivedAt` is set, replace Start session with "Archived — restore to study" and hide the due figure (P4).
- [ ] Verify P7 (rating names) and P8 (empty deck) in the browser, not only in code.
- [ ] Run `npm test`, `npx tsc --noEmit`, `npx playwright test tests/e2e/data-truth.spec.ts`.
- [ ] Commit: `fix(ui): honest folder counts and archived decks`.

**Acceptance:** the fixture's Languages → German tree shows 2 decks at the parent; Home's two totals reconcile; `/study/deck-archived` explains the archive; the new unit tests fail before the helper and pass after.

#### Task 13: Retire the v1/v2 surface components

**Files:**
- Delete: `components/v2/*`, `components/QuizStartCard.tsx`, `components/DeckCard.tsx`, `components/DeckLibrary.tsx`, `components/DeckListItem.tsx`, `components/DeckProgressCard.tsx`, `components/HeroPane.tsx`, `components/SectionHeader.tsx`, `components/SettingsPlate.tsx`, `components/SettingsRow.tsx`, `components/SettingsNote.tsx`, `theme/v2.ts`
- Modify: `components/index.ts`
- Test: `npx tsc --noEmit`, `npm run check:design`, `npm test`

- [ ] For each candidate, run `rg "\b<Name>\b" app components --glob '!components/<Name>.tsx'`; delete only when the result is empty.
- [ ] Remove the exports from `components/index.ts`; delete `theme/v2.ts` once `rg "theme/v2"` is empty.
- [ ] Fix any leftover import the compiler finds; do not keep a compatibility re-export.
- [ ] Run `npx tsc --noEmit && npm run check:design && npm test`.
- [ ] Commit: `chore(ui): remove the superseded v1/v2 surfaces`.

**Acceptance:** no file imports `theme/v2` or `components/v2`; `components/index.ts` exposes no deleted component; the three checks pass; the lines of duplicated surface code drop by roughly the size of the deleted files (record the number).

---

### Phase 6 — Verification and release

#### Task 14: Full measured verification

**Files:**
- Modify: `docs/superpowers/plans/2026-11-07-ui-v3-completion.md` (results)
- Add: `docs/test-report-2026-11-07-ui-v3.md` (or the date of the run)
- Modify: `tests/e2e/visual.spec.ts-snapshots/*` only for intentional layout changes

**Interfaces:** none.

- [ ] `npm ci` (lockfile unchanged), `npx tsc --noEmit`, `npm test`, `npm run check:design`, `npm run build:web`.
- [ ] Start the dev server on the pinned port with output logged; wait for a 200 and a compiled bundle. Do not rely on a startup banner.
- [ ] `npx playwright test` — all suites, including axe, targets, keyboard, flows, data truth, statistics visual, quiz result, hints, boot.
- [ ] `node scripts/audit.mjs` (or `--quick` for iteration) across every route at 320/375/390/768/1024/1280/1440; record axe nodes, targets <44, overflow, focus misses, console errors, zoom.
- [ ] `node scripts/responsive.mjs`, `node scripts/census.mjs`, `node scripts/reduced-motion.mjs`, `node scripts/cross-browser.mjs` (if the engine libs are available; otherwise record the limitation, never a pass).
- [ ] Walk the Review Focus list by hand in the browser: 320 + 200% + Persian name; empty library; archived deck URL; keyboard-only sheet/quiz/study; missing `deckId`; corrupt storage.
- [ ] Record every number in the test report, including failures and checks that could not run.

**Acceptance:** 83/83 surfaces visited; 0 axe violations; 0 controls <44px; 0 document overflow at 320; 0 console errors; reduced-motion run shows 0 node changes; all suites pass or a limitation is named. A skipped surface is a failure, not a pass.

#### Task 15: Release v3.0.0

**Files:**
- Modify: `package.json`, `app.json` (version `3.0.0`), `CHANGELOG.md`, `README.md` (only if commands changed)

- [ ] Write the CHANGELOG v3.0.0 entry: what changed per screen, the before/after measurements (surfaces converted, v1/v2 components deleted, axe/targets/overflow counts), and the fixes folded in (P3–P11).
- [ ] Bump `version` in `package.json` and `app.json` to `3.0.0` (they must match).
- [ ] Update the README's check list if the command set changed; keep the run instructions accurate.
- [ ] Run the complete gate once more after the version bump; `git status` clean apart from the intended commit.
- [ ] Commit: `release: Memora UI v3 Nocturne Focus`.
- [ ] Do **not** deploy or publish without an explicit request.

**Acceptance:** version strings agree; CHANGELOG quotes measured numbers; the final gate was run on the final tree, not an earlier commit.

---

## Appendix A — Route ownership

| Route | Current | Owner task |
| --- | --- | --- |
| `/` → `/home` | v3 | 1–2, 12 |
| `/library` (Game) | v3 | 1–2, 11 |
| `/settings` | v3 | 2 |
| `/deck/[id]` | v3 | 1–2, 4, 12 |
| `/deck/[id]/add-card` | v3 | 1–2 |
| `/study/[deckId]` | v3 | 3–4, 12 |
| `/quiz/[deckId]` | v1/v2 | 3, 5 |
| `/statistics` | v3 | 2, 6 |
| `/profile` | v3 | 2, 7 |
| `/discover`, `/discover/[id]` | v2 + v3 section | 2, 9 |
| `/add-deck` | v1 sheet | 10 |
| `/settings/algorithm`, `/tts`, `/offline` | v3 | 1–2, 8 |
| `/settings/algorithm-advanced` | v3 header + v1 plate | 2, 8 |
| `/mass-import` | v1 plate | 8 |
| `/dev` | v1 plate | 8 |
| `+not-found`, splash, skeletons, dock | mixed | 11 |

## Appendix B — Acceptance recording template

Copy this into the test report for each phase:

```
Phase:            N — <name>
Commit:           <sha>
tsc:              <errors>
check:design:     clean (<n> files) | <findings>
npm test:         <pass>/<fail>
Playwright:       <pass>/<fail> (suites: ...)
axe:              <nodes> across <n> route×viewport
targets <44px:    <n>
overflow @320:    <n> px
overflow @1280:   <n> px
console errors:   <n>
reduced motion:   <n> node changes 80ms–1.28s
screenshots:      <paths reviewed>
limitations:      <what could not run and why>
```
