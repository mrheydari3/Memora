# Your Decks v4 — "Library Desk" design spec

Date: 2026-11-12 · Scope: Home → Your decks only · Status: proposed, awaiting approval

## 1. Scope

**In scope:** the shelf region of `/home` — masthead, search/filter/sort, folder and deck
browsing, archive, empty states, arrange mode, and the components that render them.

**Out of scope:** the Today hero, the app bar, the tab capsule, deck detail, study, quiz,
statistics, settings screens, and any change to FSRS scheduling or the review log.

**Not a rewrite.** `data/library.ts` (the one-pass index), the virtualized `FlatList`
owner, and the existing store contracts stay. This is a new presentation and a new
browsing model on top of the same data.

## 2. What is wrong today

Evidence from the current tree, not taste:

| Problem | Where | Why it matters |
| --- | --- | --- |
| Folders are two different objects | `FolderGroup` (phone accordion) vs `FolderCard` (desktop drill-down) | The same library behaves differently at 390px and 1280px. Users learn one model and lose it on resize. |
| Archive is a bottom pane | `LibraryBoard.renderArchive` | Archived decks are a *scope*, not a footer. Today they sit below every deck and need a second tap to reveal. |
| Search is a separate row that scrolls away | `LibraryToolbar` | On a 300-deck library the search field leaves the viewport exactly when it is needed. |
| "Unfiled decks" is filing-cabinet language | `LibraryBoard` band label | It describes storage, not learning. A learner thinks "my decks", not "unfiled". |
| Folder cards carry a redundant footer | `FolderCard` "Open folder ›" | The whole card is already the target; the footer costs ~28px per card and repeats the affordance. |
| Three chrome tiers before content | eyebrow + rule + title + meta + toolbar + band | On a phone the first deck starts ~330px down. |
| No sort | — | Pinned-first is the only order. "Recently studied" is the order most learners actually want. |
| Arrange mode is a different surface | `ShelfReorder` | It replaces the board with a non-virtualized list, so the library changes shape to be edited. |

## 3. Direction

**One shelf, one grammar, two lenses.**

The shelf becomes a *desk*: a fixed command bar you can always reach, one card anatomy
shared by folders and decks, and a single browsing model — **you are always at a level**.
Root is a level. A folder is a level. Search is a level. Archived is a level. Every level
has the same masthead, the same bands, the same cards, and the same way back.

Visually this stays inside Nocturne Focus: one ink canvas, one accent, separation by fill
and depth, no new borders, no decorative colour. "Pro" here means **precision and
density**, not ornament:

- one card height and one internal rhythm across folders and decks;
- numbers in tabular figures, aligned to a shared right edge;
- one status mark, one rail, one trailing action column;
- type doing the hierarchy work instead of rules and boxes.

## 4. Information architecture

```
Your decks (root)
├── command bar        search · All | Due | Archived · sort
├── Folders            (n)
├── Decks              (n)   ← decks not inside a folder
└── [Arrange]          manual order only

Folder level
├── breadcrumb         All decks / Languages / German
├── command bar        search · All | Due · sort
├── Folders            (n)
└── Decks              (n)

Search level          results across the whole library, each deck showing its folder path
Archived level        archived decks, each with Restore in its options
```

Rules:

1. **A folder always opens a level.** The accordion (`FolderGroup`) is removed. This is
   the single biggest structural change and it makes phone and desktop identical.
2. **Bands are always "Folders" and "Decks".** "Unfiled" disappears. At root, "Decks"
   means decks with no folder; inside a folder it means decks filed directly there.
3. **Archive becomes a scope chip**, not a pane. `Archived (3)` sits beside `All` and
   `Due`. The bottom archive pane and its expand state are deleted.
4. **Search is a level, not a filter.** Typing replaces the level body with results and
   shows a "Clear" affordance; the breadcrumb reads `All decks / Search`.
5. **Sort is explicit and persisted.** `Manual` (default, drag order + pins), `Due first`,
   `Recently studied`, `Name A–Z`. `Arrange` is only enabled under `Manual`.

## 5. Visual system

### 5.1 Masthead (compact)

Three tiers collapse to two:

```
Your decks                                    [New folder] [Arrange]
5 decks · 4 folders · 40 due
```

- Title: `v3.type.shelfTitle` (22/28, −0.5 tracking), `headingLevel={2}`.
- Meta: one caption line, tertiary, tabular figures.
- Actions: two 44px targets. `Arrange` keeps its label ≥480px, icon-only below.
- The eyebrow ("Library" + rule) is removed. The title is the section marker.
- The caught-up mark stays, but moves onto the meta line as a trailing success dot +
  count, so it never competes with the actions.

### 5.2 Command bar

One row, 44px, sticky under the app bar while the shelf scrolls:

```
[ ⌕ Search decks and folders        ]  [All] [Due 40] [Archived 3]  [⇅]
```

- Search field grows; chips and sort are fixed-width 44px targets.
- Below 480px the sort control moves to the masthead action row and the chips scroll
  horizontally in a single line (no wrap, no second row).
- Result count appears only while a query or non-default scope is active, on its own
  caption line under the bar.
- Keyboard: `/` and `⌘K` / `Ctrl K` focus the field; `Escape` clears and returns to the
  level.

### 5.3 Card anatomy (shared)

One component, `ShelfItem`, renders both folders and decks. Height **104px** minimum.

```
┌──────────────────────────────────────────────────────────┐
│ [40]  Deck name up to two lines              ┌─────────┐ │
│ tile  evidence line · scheduler              │   18    │ │
│       ▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬ 62%              │   DUE   │ │
│                                              ├─────────┤ │
│                                              │   ⋯     │ │
└──────────────────────────────────────────────────────────┘
```

- **Tile** 40px, radius `v3.radii.tile` (12), deck/folder colour at 14% wash, glyph
  `iconSize.lg`. Folders keep `FolderGlyph`; decks keep `MaterialIcons`.
- **Name** 15/600, two lines, ellipsis.
- **Evidence** 12/17 tertiary: decks `1,817 cards · FSRS-6`; folders `3 decks · 2 folders`.
  Search results append the folder path on its own line.
- **Rail** 4px studied share, or the 6px new/learning/review composition when the deck
  has work today. Unchanged from v3 — it is honest and it works.
- **Status pill** 48×32, stacked: the figure on top, the word `due` / `clear` /
  `empty` beneath it in 8px caps. The shipped pill is a single row (`6 due`) and
  cannot fit a 48px action column, so v4 stacks it. Accent for due, success for
  clear, neutral dash for empty.
- **Trailing column** 48px wide: pill on top, 44px options target below. Two
  sibling pressables, never nested.
- **No footer.** `FolderCard`'s "Open folder ›" line is deleted.

### 5.4 Study from the shelf

On a deck with `due > 0`, the status pill **is** the study action: a 48×32 target with a
44px hit area, labelled `Study 18 due cards in <deck>`. The row body still opens the deck.
This is the one new interaction, and it removes the most common two-tap path in the app.

Folders keep a non-interactive pill — a folder is not a session.

### 5.5 Bands

`FOLDERS (4)` and `DECKS (2)` — 11px uppercase, 0.9 tracking, count in tabular figures,
right-aligned hint carrying the active sort (`Due first`) or the level's due total.
No rule, no tick, no pill.

### 5.6 Breadcrumb

`All decks / Languages / German` — ancestors are 44px targets, the current level is plain
text, the level's due count sits at the right. Wrapped in a `nav` landmark labelled
"Library path".

### 5.7 States

| State | Copy | Action |
| --- | --- | --- |
| Root empty | "No decks yet" | Create deck |
| Folder empty | "This folder is empty" | Add a deck here · New subfolder |
| No search results | "No matches for “x”" | Clear search |
| Archived empty | "Nothing archived" | Back to all decks |
| Loading | existing skeleton | — |

All use `EmptyState` inside `Surface tone="pane"`, per the design law.

### 5.8 Tokens

No new colours. New geometry only, added to `theme/v3.ts`:

```ts
heights.shelfItem: 104     // replaces deckRow 96 / folderCard 128 / folderGroup 76
heights.shelfTile: 40
heights.shelfTrail: 48
layout.shelfColumns: { two: 1024, three: 1200 }
```

Everything else comes from `spacing`, `radii`, `iconSize`, `fills`, `stateColors`.

## 6. Component plan

| File | Change |
| --- | --- |
| `components/v3/ShelfItem.tsx` | **New.** One card for folders and decks: tile, name, evidence, rail, pill, trailing column. Replaces `DeckShelfRow` + `FolderCard` + `FolderGroup` header. |
| `components/v3/ShelfCommandBar.tsx` | **New.** Search + scope chips + sort. Replaces `LibraryToolbar`. |
| `components/v3/ShelfMasthead.tsx` | **Rewrite** of `ShelfHeader`: two tiers, no eyebrow, actions row. |
| `components/v3/ShelfBreadcrumb.tsx` | **Rewrite** of `ShelfBreadcrumbs`: nav landmark, counts, 44px ancestors. |
| `components/v3/ShelfSortMenu.tsx` | **New.** `Menu`-based, four options, current one checked. |
| `components/v3/LibraryBoard.tsx` | Rework row model: levels, scopes, sort, sticky command bar. Keeps the single `FlatList` owner. |
| `components/v3/DeckShelfRow.tsx` | Deleted; superseded by `ShelfItem`. |
| `components/v3/FolderCard.tsx` | Deleted; superseded by `ShelfItem`. |
| `components/v3/FolderGroup.tsx` | Deleted; accordion removed. |
| `components/v3/ArchivedRow.tsx` | Kept, gains a `Restore` option in its menu. |
| `components/v3/ShelfReorder.tsx` | Kept; rendered inside the same card grammar, still non-virtualized (documented limitation). |
| `app/(tabs)/home.tsx` | Passes sort/scope state; hero untouched. |

## 7. Data plan

Two pure additions, no schema migration:

1. **`DeckSummary.lastStudiedAt: number | null`** — the max `reviewedAt` per deck, taken
   from the review walk `data/library.ts` already performs. Enables "Recently studied".
2. **`Settings.librarySort?: 'manual' | 'due' | 'recent' | 'name'`** — optional, so
   existing saved settings keep working; a missing value means `manual`.

New pure helper `sortLibrary(entries, sort)` in `data/library.ts`, with tests covering
pins-first under `manual`, tie-breaking by name under every mode, and stability.

No change to: FSRS, daily caps, review log, deck/folder CRUD, pinning, drag targets,
AsyncStorage keys, import/export.

## 8. Interaction and motion

- Level change (open folder, back, scope switch): `useReveal` keyed on the level id.
- Sort/filter change: `useReveal` keyed on `sort + scope`.
- Press: existing `usePressFeedback({ scale: 0.985 })`.
- No new animation primitives. Every path has a reduced-motion branch via the existing
  helpers.
- Sticky command bar: `stickyHeaderIndices` on the board's `FlatList`, computed from the
  row model. **Verify against the Expo SDK 58 / RN 0.88 docs before implementing**; if it
  destabilizes virtualization, ship non-sticky and record it as a limitation.

## 9. Responsive

| Width | Columns | Notes |
| --- | --- | --- |
| < 1024 | 1 | chips scroll horizontally; sort moves to masthead |
| 1024–1199 | 2 | command bar on one line |
| ≥ 1200 | 3 | full command bar, sort inline |

Card height is fixed at 104px at every width so the grid keeps its rhythm. **Folders and
decks share the same column count at a given width** — a level never mixes a 2-column
folder row with a 3-column deck row. At 320px the name takes two lines and the evidence
line wraps under it; the 48px trailing column never narrows the name below two usable
lines (the v3 wrap rule is preserved).

## 10. Accessibility

- Card accessible name is its visible content (label-content-name rule); `HintPressable`
  supplies the verb.
- Study pill: `accessibilityRole="button"`, label `Study 18 due cards in <deck>`.
- Scope chips: `aria-pressed`; breadcrumb: `nav` + `aria-label="Library path"`.
- Sort menu: `Menu` with `aria-checked` on the active option.
- 44px minimum on every target, visible focus ring, 200% text zoom, no overflow at 320px.
- Sticky bar must not trap focus or cover the focused row when tabbing.

## 11. Testing and gates

**Unit** — `sortLibrary` (4 modes, pins, ties, stability); `lastStudiedAt` parity against
the review log; existing `data/library.test.ts` must stay green.

**Surfaces** (`tests/ui/surfaces.ts`) — keep HM-05/06/07/13; add:

- HM-14 search active with results
- HM-15 archived scope
- HM-16 sort menu open
- HM-17 second-level folder with breadcrumb

**E2E** — update `library-search.spec.ts` for scope chips; extend `library-scale.spec.ts`
to sort and search a 300-deck library; new `library-scope.spec.ts` for archive and sort;
extend `shelf-keyboard.spec.ts` for `/` and `Escape`.

**Visual** — regenerate `home-390` and `home-1280` intentionally; add `home-1024`.

**Gates** — `npx tsc --noEmit`, `npm test`, `npm run check:design`,
`npm run test:surfaces`, `npm run responsive -- --mode=measure` at
320/375/390/768/1024/1280/1440, axe WCAG 2.2 AA, `npm run build:web`.

## 12. Phases

1. **Data** — `lastStudiedAt`, `sortLibrary`, `librarySort` setting, tests. No UI change.
2. **Card grammar** — `ShelfItem`; delete `DeckShelfRow`, `FolderCard`, `FolderGroup`;
   folder drill-down at every width.
3. **Command bar** — `ShelfCommandBar`, `ShelfMasthead`, `ShelfBreadcrumb`, sticky.
4. **Scopes and states** — archive as scope, sort menu, four empty states.
5. **Arrange** — reorder inside the new grammar; disable under non-manual sort.
6. **Gates and evidence** — baselines, responsive measurements, report doc.

Each phase is independently shippable and leaves the suite green.

## 13. Risks

| Risk | Mitigation |
| --- | --- |
| Removing the phone accordion changes a familiar interaction | It is the point of the redesign; covered by HM-06/07/17 and the flows suite. |
| Sticky header + virtualization | Verify against SDK 58 docs; fall back to non-sticky and document. |
| Two pressables per card | Siblings, never nested; axe and keyboard tests cover it. |
| Sort persistence | Optional field, no migration; missing value means `manual`. |
| Visual baselines | Only `home-*` regenerated, with the reason recorded. |

## 14. Open decisions

1. **Study from the shelf** — make the due pill the study action? *Recommended: yes.*
2. **Archive as a scope chip** — remove the bottom pane? *Recommended: yes.*
3. **Persist sort in Settings** — *Recommended: yes.*
4. **Sticky command bar** — *Recommended: yes, phase 3, with a non-sticky fallback.*
