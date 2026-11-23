# Memora design language

This document is the law. If something does not match it, fix the code first and then update the document; the document and the code must not tell two stories.

> Summary: **one ink canvas, one accent, separation by fill and depth (not by border), frosted glass — and no visual value that comes from outside `theme/`.**
>
> **A border is not the rule; it is the exception** (§10). Every surface separates from the surface beneath it with a `fill`, spacing and one light edge.

---

## 1. Single source of truth

```
theme/palette.js        ← the only place a hex / rgba is written
   ├── tailwind.config.js   → Tailwind classes (bg-surface, text-on-surface…)
   └── theme/tokens.ts      → colours and base numbers for JS (SVG, StyleSheet, icons)

theme/v3.ts             ← v3 roles: type, appBar, radii, heights, layout
```

- `tailwind.config.js` converts the `colors` keys to kebab-case: `onSurfaceVariant` → `text-on-surface-variant`.
- `fills` come with a prefix: `bg-fill-tile`, `bg-fill-control`, `bg-fill-track`…
- `theme/v3.ts` holds the role-based v3 geometry: `radii.tile` 12, `radii.control` 14, `radii.card` 22, `radii.pane` 24, `radii.quizTile` 16, `appBar.actionTile` 36 and `type.hero`.
- No file outside `theme/` may write a hex or `rgba(…)` — `npm run check:design` catches it.

### Why?

Every screen used to have its own shadow/glass/spacing; the same screen behaved two different ways a week later. Now one change in `palette.js` applies everywhere.

---

## 2. Surface levels

| Role | Class / token | Use |
| --- | --- | --- |
| Canvas | `bg-background` | background of every screen (`Screen` provides it) |
| Scene pane | `Surface tone="scene"` | Today hero, study scene, quiz arena |
| Pane | `Surface tone="pane"` | rows, cards, sheets |
| Inset | `Surface tone="inset"` | content inside a pane (preview, collapsible body) |
| Icon tile | `v3.radii.tile` 12 + `iconSize.lg` 20 / `xl` 22 | 36px in Home/Review deck rows and app-bar actions; 44px for the selected Review deck; fill from the deck colour wash, `fills.tile`/`accentSoft`, or `surfaceControl`/`accentFaint` |
| Control | `bg-fill-control` | input, icon button, segmented rail |
| Progress rail | `bg-fill-track` | progress bar, meter |

Panes read **without shadows**: `Surface` itself never draws one. Depth belongs to the objects above the pane: the scale in `palette.js` has one token per object class — `pane` (a deck/folder card resting on the page), `action` (primary button), `floating` (sheet, menu) and `card` (flashcard and its stack) — and the component that owns the object applies it. Rows, groups and insets stay flat and separate by fill alone. A shadow is a quiet contact shade under the object, never a glow, and it always follows fill — the surface still separates by its own fill first. A 1px ring on the scene pane at 30% `outlineSoft` is allowed in §10; deck/folder cards, settings groups and plates have no edge. Elements inside a pane (icon tile, row, input) are one step lighter than the pane; the v3 icon tile is 36px (except the selected Review deck at 44px) with radius 12 and an `iconSize.lg`/`xl` glyph; the `SettingsLine` tile is 40px; the "How it works" tiles in Review also carry a 1px ring (§10). For a darker/emphasis pane: `Surface tone="inset"` (fill only; a border only in §10's exceptions). The folder header on Home is the same `Surface tone="pane"` with the card radius 22 and the raised card face background (same as Today); no border, glass or second level. The body of an opened deck also uses the raised card face and separates from the header by geometry and spacing alone.

The `fills` ladder is the depth scale, and it changed so separation reads without a border:
`subtle 0.03 → inset 0.05 → tile 0.06 → control 0.075 → track 0.09`.

Five neutral roles, with the luminance ratio of each step to the one before:

| Role | Token | Value | Ratio to previous role |
| --- | --- | --- | --- |
| Canvas | `colors.background` | `#07090E` | — |
| Pane | `glass.fill` | `#141A24` | 1.14× |
| Card | `glass.cardFace` | `#1D2633` | 1.14× |
| Inset | `colors.surfaceInset` | `#252F3D` | 1.13× |
| Control | `colors.surfaceControl` | `#2E3948` | 1.16× |

The selection surface (`colors.selectionSurface`, `#35455B`) has its own semantic role and does not replace one of these five. `SearchBar` has no resting edge and separates from the pane by fill alone; its edge shows only on focus (the focus ring). `Field` has one 1px resting edge from `alpha(colors.outline, 0.48)`; it composites to **3.0:1 on the card face** and **3.15:1 on the pane** — at the 3:1 form-control floor without the near-white glare (the full-strength version was 9.38:1). The field's placeholder moved from `colors.outline` to `colors.tertiaryContainer` (5.37:1 on the field fill) so it no longer shares the edge's weight. `SegmentedControl` and the off `ToggleSwitch` rail are exceptions to this rule: their resting edge is 1px of `alpha(colors.outlineSoft, 0.72)` — the same scene-rim family, one step stronger. It composites to about `#323C4A` on the card `#1D2633` (about 1.4:1) and `#2F3846` on the pane `#141A24` (about 1.5:1), deliberately below 3:1; the bright `outline` read as a white halo on the frosted card and as a white ring on the small ToggleSwitch track. These controls are read by fill (`surfaceControl` / `selectionSurface` / track) and text labels, not by the edge; in ToggleSwitch the near-white knob (9.9:1) and its position carry the state. This is a deliberate trade-off: their edge no longer supplies the 3:1 form-control boundary. `outline` on the five panes and the selection surface is 10.70, 9.38, 8.19, 7.26, 6.28 and 5.24:1 respectively. Accent text (`#7CBBFF`) on the selection surface is 4.83:1, so the active tab label still clears AA.

---

## 3. Meaningful colour

Every colour has one meaning, and that meaning is fixed on every screen.

| Token | Meaning | Where |
| --- | --- | --- |
| `primary` | accent, primary action | primary button, active tab, selection |
| `stateColors.New` | new card | mastery rail, ledger, donut |
| `stateColors.Learning` / `Relearning` | learning | the same places |
| `stateColors.Review` | review (mastery) | the same places |
| `error` | negative feedback, delete | "Again" at the end of a session |
| `success` | positive result | "Easy", a successful save |
| `warning` | non-error attention | learning state, warning |

Result: in [statistics](app/statistics.tsx) the donut and legend colours come from `stateColors`, exactly the ones the [mastery rail](app/deck/[id].tsx) uses. There is no decorative colour in the system.

**The only exception: deck colour and card colour.** Each deck's colour is user data (not a design choice), so `deck.color` reaches `DeckCard`/`DeckListItem` and is always dimmed with `alpha(color, …)`. The card colour (`Flashcard.color`) is also chosen from the same palette and dissolved into the card surface with `over(base, color, amount)` — because React Native styles do not stack two backgrounds. No hex is written inside the components themselves.

---

## 4. Typography

`AppText` is the only way to write text. Raw `Text` from `react-native` is not used on screens (it bypasses the font and the default colour).

```tsx
<AppText variant="headline">Section title</AppText>
<AppText variant="bodySm" tone="muted">Subtitle</AppText>
<AppText variant="label" tone="primary">Label</AppText>
```

| variant | size / line height | weight | use |
| --- | --- | --- | --- |
| `display` | 34 / 40 | 700 | hero number, on a card |
| `title` | 26 / 32 | 700 | page title |
| `headline` | 20 / 27 | 600 | section title, card text |
| `bodyLg` | 17 / 25 | 400 | primary reading text |
| `body` | 15 / 22 | 400 | default text |
| `bodySm` | 13 / 20 | 400 | description, metadata |
| `label` | 12 / 16 | 600 | small label, counter |
| `caption` | 12 / 17 | 500 | smallest layer |

`tone`: `default` · `muted` · `tertiary` · `accent` · `onAccent` · `danger` · `success` · `warning`.

The `v3.type.answer` step at 26/32 is for a long answer / study title; other screens do not inline the number 26.
Do not change weight with a `font-inter-*` class unless it is genuinely needed; `variant` carries the right weight.

**Large numeric steps** live outside `variant` and are defined in `theme/v3.ts`: `v3.type.hero` 40/44 for each screen's hero number (and `heroWide` 56/58 from 900px up), `v3.type.score` 44/48 for the live quiz score, and `v3.type.result` 64/68 for the round result. No screen defines its own display number inline; if a new step is needed, it is added to this list.

These steps are written with `rem` on the web (they stay the same logical pixel natively) because `AppText` comes from Tailwind's rem scale, and 200% browser text zoom must scale both.

---

## 5. Spacing and layout

| Token | Value | Use |
| --- | --- | --- |
| `spacing.screen` | 20 | screen horizontal gutter |
| `spacing.gutter` | 16 | pane inner padding |
| `spacing.row` | 16 | gap between title and value in a row |
| `spacing.section` | 28 | gap between sections |
| `spacing.tabClearance` | 112 | bottom space on tabbed screens |
| `spacing.screenBottom` | 40 | bottom space on screens without tabs |

**Screens do not set their own horizontal padding.** `Screen` provides the flat background, the safe area, the fixed top bar, the scrolling body and the bottom space.

```tsx
<Screen
  scroll        // make the body scrollable
  gutter        // standard 20px horizontal gutter
  tabClearance  // 112px bottom space on tabbed screens
  header={<PageHeader title="Library" back />}
>
  <SectionHeading label="Categories" />
  <Surface tone="pane">…</Surface>
</Screen>
```

- `header` / `footer`: the fixed top bar and the fixed footer (primary button, score row).
- `scroll` + `gutter` + `tabClearance`: the three usual switches; do not put a manual `paddingHorizontal` on a screen.
- Tabbed screens: `tabClearance`; stack screens (back): only `scroll gutter`.
- `className`/`contentClassName` only for an exception (e.g. `pt-0`) — not to override the standard padding.

### Phone contract (v3.2)

The phone layout is measured, not a shrunken desktop. **390×844** is the reference and **320×700** is the stress case; every phone fix is checked at **320, 390 and 430** CSS px. Tablet and desktop (768+) are frozen for 3.2 and get a boot/no-overflow smoke only.

| Width | Role |
| --- | --- |
| 320 | stress: compact hero, two-line headings, wrapped toolbars |
| 360 / 375 | narrow phone: captions and meta may move into the body |
| 390 | reference phone |
| 430 | wide phone: same layout, more line length |

- `useResponsive()` exposes `phone` (≤430) and `compact` (≤359). `useTextScale()` exposes `largeText` from 1.5× native font scale or a ≥24px web root font.
- The phone dock is `min(360, viewport−24)`; tablet and desktop keep the original 300px dock so the frozen wide layout does not move.
- The 320 hero uses `v3.type.heroCompact` (36/40), `v3.spacing.panelCompact` (16) and `v3.spacing.gapCompact` (12) so the All/Due/sort toolbar clears the dock at scroll 0. Wider phones keep the 40/44 hero and 20px panel.
- At large text, data groups reflow to one column instead of clipping: section headings, settings ledgers, metric grids, memory sub-metrics, rating tiles and achievements. The dock and Study tray drop captions and keep 44px icon-only tabs with accessible names.

**App-bar matrix**

| Context | Leading | Title | Meta | Actions |
| --- | --- | --- | --- | --- |
| Home | brand mark; wordmark hidden at large text, hidden `h1` kept | `Memora` | streak chip moves into the Today hero below 375 and at large text | create + history, max two |
| Tab / stack page | back or close, 44px | route name; two lines normally, four at large, two on a compact phone at large | status chip beside the title; session counter moves into the body at large | max two 44px actions |
| Study session | close | deck name | counter in the body when large | undo |

**Heading hierarchy**

| Level | Primitive | Use |
| --- | --- | --- |
| 1 | `PageHeader` title | exactly one per route; the brand page keeps a hidden `h1` when the wordmark is hidden |
| 2 | `SectionHeading` | uppercase section label with optional count/action/rule; one grammar on every screen |
| 3 | pane title (`AppText variant="title"`/`headline`) | the object being read: deck, chapter, sheet |
| 4 | row label (`bodyLg`/`body`) + `caption` meta | the scannable line inside a pane |

Local phone margins of 8/12/14/20 are not allowed; use `Screen`'s gutter, `v3.spacing` and the compact hero tokens.

**`ListDivider`** is the only rule inside a grouped list. It draws one 20% hairline and takes a semantic inset:

| Inset | Start | Use |
| --- | --- | --- |
| `none` | 0 | a section rule that runs the pane's full width |
| `tile` | 68px | rows with a leading 40px tile; the rule starts at the title |
| `dot` | 34px | rows with a leading state dot; the rule starts after the dot column |
| `card` | 16px each side | a card-level ledger that keeps its own gutter |

No screen draws a raw 1px divider.

---

## 6. Radius, height, icon

| Token | Value | Use |
| --- | --- | --- |
| `v3.radii.tile` | 12 | icon tile (app-bar actions are also 12px via `appBar.actionRadius`) |
| `v3.radii.control` | 14 | button, input, segment, flat row |
| `v3.radii.card` | 22 | deck/folder card, Review cards |
| `v3.radii.pane` | 24 | pane/hero; the default `Surface` radius |
| `v3.radii.quizTile` | 16 | quiz HUD tile |
| `radii.bar` | 3 | progress bar / 2–4px rail |
| `radii.micro` | 10 | selection pill inside a control |
| `radii.menu` | 16 | floating menu |
| `radii.sheet` | 28 | bottom sheet |
| `radii.pill` | 9999 | chip, rail |

`v3.radii.card` 22 is for deck/folder cards and Review cards; `v3.radii.pane` 24 is the default radius for `Surface` and heroes. Do not confuse the two.

Control and row heights come from `heights`: `button` 52, `field` 44, `row` 60, `pageHeader` 64, `iconSm` 32, `icon` 38, `tile` 38, `tileLg` 44, `hit` 44…
The v3 icon tile is 36px: app-bar actions place that 36px on a 44px hit target (`v3.appBar.actionTile`/`actionHit`), the Home and Review deck rows also have 36px tiles, and the selected deck in the Review hero is 44px. `ListRow` takes its 38/44 tiles from `heights.tile`/`tileLg` and `IconButton` takes its 32/38/44 diameters from `heights.iconSm`/`icon`/`iconLg`. `SettingsLine` has a 40px tile with radius 12.
Icon size comes from `iconSize`: `xs` 13 → `display` 28; in a 36px tile the `lg` glyph is 20px and in a 44px tile the `xl` glyph is 22px. There is no manual `<MaterialIcons size={18}>`.

---

## 7. Motion

| Token | Value | Use |
| --- | --- | --- |
| `motion.fast` | 160ms | press feedback |
| `motion.base` | 260ms | sheet entrance |
| `motion.slow` | 420ms | large transition |
| `motion.flip` | 480ms | card flip |
| `motion.spring` | speed 45 · bounciness 0 | stretch/flip |

No screen calls `Animated` directly. All motion comes from [`motion/`](motion/index.ts):

| Tool | What it does |
| --- | --- |
| `useReveal(key, { delay, duration, distance, scale })` | 0→1 entrance (fade + rise). Re-runs when `key` changes — e.g. a ledger filter/sort change |
| `usePressFeedback({ scale })` | press spring; also returns the raw value so the press veil can be driven from it |
| `timingTo(value, to, { duration, delay, easing, nativeDriver })` | one timed step; returns a Promise so sequences can be written (card exit → next card) |
| `springTo(value, to)` | spring, for press/stretch |
| `prefersReducedMotion()` / `useReducedMotion()` | respects the system setting |

Rules:

- `Animated.timing` and `Animated.spring` are forbidden on screens; only `timingTo`/`springTo`.
- Every motion needs a reduce-motion path; the helpers check when it starts and set the final value immediately.
- For width/height pass `nativeDriver: false`; everything else follows the platform default.
- Motion only where it means something: section entrance, filter/order change, press, card flip, and card exit after a rating. Do not add decoration.
- The card exits before the app updates, so the next card "arrives" instead of the previous content jumping to the new layout.

---

## 8. Component catalog

Base components are imported from `@components/index`; v3 components from `@components/v3`.

**Layout and surfaces:** `Screen` · `Surface` (`scene`/`pane`/`inset`/`control`) · `PageHeader` (+ `HeaderIcon`) · `SectionHeading` · `ShelfHeader` · `ListRow` · `ListDivider` · `FolderGroup` · `DeckShelfRow` · `ArchivedRow` · `TodayPane` · `BottomSheetModal` + `SheetPanel`

**Settings:** `SettingsHero` · `SettingsChapter` · `SettingsLine` · `SettingsFootnote` · `MetricGrid`

**Controls:** `Button` (`primary` / `primaryQuiet` / `secondary` / `outline` / `text`, with the `destructive` flag and `md`/`lg` sizes) · `PrimaryButton` · `GhostButton` · `IconButton` · `ToggleSwitch` · `SearchBar` · `Chip` (`filter`/`select`) · `SegmentedControl` · `Stepper` · `Field` · `Pill` (`neutral`/`accent`/`warning`) · `Menu` / `Select` / `ActionMenu` / `ContextMenu` · `AppearancePicker`

**Content:** `StudyCard` · `FlashcardView` · `CardStack` · `SegmentedProgressBar` · `RatingKeys` · `RadioOptionCard` · `LearningStepRow` · `QuizAnswer` · `DonutChart` · `MiniBarChart` · `ActionButton` · `EmptyState`

### Component rules

1. **`ListRow` is the only standard row** — `title`, `subtitle`, `icon`, `value`, `tile` (`sm`/`lg`/`none`), `density` (`compact`/`default`/`tall`), `iconTone`, `trailing`, `showChevron`, `highlighted`, `onPress`. Do not build a new hand-made row (`<Pressable>` + three `<AppText>`). Rows have no dividers; `divider` is kept only for compatibility and draws nothing — rows separate by height and the pane's padding. When a scan list genuinely needs a rule, use `ListDivider` with the inset above.
2. **`Surface` is the only pane** — `tone` (`scene`/`pane`/`inset`/`control`), `radius` (`control`/`card`/`pane`), `padding` (`none`/`sm`/`md`). Do not put a duplicate `p-*` class on `Surface`. `Surface` never draws a shadow; a component that floats an object applies its own token (`shadow.pane` for a deck/folder card, `floating` for chrome, `card` for the flashcard) in its styles, and rows and groups inside a pane stay flat. Each screen has at most one `tone="scene"`.
3. **`SettingsHero` opens the Settings screen** — one `Surface`, one title, and the ledger of readings with aligned numbers. Then `SettingsChapter` with `SettingsLine`s; the last line of each chapter gets `last`.
4. **`Button` knows its own height, radius and colour**; `className` only for width/layout (`flex-1`, `self-stretch`).
5. **Sheets use `BottomSheetModal` + `SheetPanel`**; height from `heights.sheet*` — not a hand-rolled `Animated.View`. Menus come from `Menu`/`Select`; do not build a new hand-made menu.
6. **Empty states use `EmptyState`** (`icon`, `title`, `description`, `action`) inside a `Surface tone="pane"` — not a bespoke dashed pane.
7. **Virtualized lists** (a deck's card ledger) are the only place a pane is built from rows: each row's frame must be made only from `glassFill`, `colors.hairline`, `rimColor`, `v3.radii.card` and `spacing`, and the first/last row must draw the pane's corners and rim. The row must be a full `Pressable` with `accessibilityRole="button"`, not a small icon.

---

## 9. Guards

```bash
npm run check:design   # raw colour, icons, inset and duplicate scene → error
npx tsc --noEmit       # type contracts
npm test
```

Besides raw colour, `check:design` catches numeric icon sizes, a top-level `Surface` with `tone="inset"`, duplicate default `Surface` props (`radius="pane"` and `padding="md"`), and more than one unconditional scene per screen. The other rules in this document are checked in review; if you want them automated, add a rule to `scripts/check-design-tokens.mjs` (for example banning `TouchableOpacity` or raw `Text`).

### Exception

Only where the maths is genuinely needed (e.g. a line height tuned for Persian text in `Flashcard`) may the line be marked with `// design-ignore`. The same marker works for structural rules (icon, inset, duplicate props and scene). Colour is never an exception.

---

## 10. Border

A border appears only where it has **meaning**. Allowed cases:

| Case | Where |
| --- | --- |
| Focus ring | `SearchBar` (and any input that wants a visible focus) |
| Selected state | `RadioOptionCard` (the radio dot) |
| Review selection chrome | deck/direction rows, the selected deck, the time chip and the "How it works" tiles (1px, 20–25%) |
| Empty dashed frame | empty-state frame, the "Add step" button |
| Glass `rim` | one edge, only on `Surface tone="scene"` (`TodayPane`, the study scene, the quiz arena) and quiz answer tiles |
| Chrome ring | one 1px `rims.soft` edge at the bottom of `FloatingHeader` and around `LiquidTabBar`; glass chrome without it gets lost over scrolled content |
| Sheet handle | `SheetPanel` (a fill, not a border) |
| Form-control resting edge | `Field`; only 1px of `alpha(colors.outline, 0.48)` (3.0:1 on the card face, 3.15:1 on the pane — at the 3:1 floor). `SearchBar` is deliberately borderless. |
| Segment rail edge | `SegmentedControl`; 1px of `alpha(colors.outlineSoft, 0.72)` (about `#323C4A` on the card, about 1.4:1). Deliberately below 3:1: the boundary is read from the rail and selection pill fills, and the edge is only a quiet seam. |
| Off ToggleSwitch rail edge | `ToggleSwitch` (off state only); 1px of `alpha(colors.outlineSoft, 0.72)` (about `#2F3846` on the pane, about 1.5:1). Deliberately below 3:1; the near-white knob (9.9:1) and its position carry identification and state. |

The default rule is that everything else separates by **fill**. An element never has a border + rim + shadow at the same time.

**Folder model:** folders are a flat list and no folder sits inside another. Each folder's count is only its direct decks; there is no Location, no parent selection and no nested-indent guide. Folder card and deck card are both `Surface tone="pane"` at radius 22 and without a border; as top-level objects they carry `shadow.pane`.

The Import screen, which had dozens of dashed boxes and decorative stamps, now has no borders at all. No `GlassCard`/`TopAppBar`/`v2` remains in the code.

## 11. New-screen checklist

- [ ] `<Screen scroll gutter>` (and `tabClearance` on tabs) with `header={<PageHeader title="…" />}` — no manual gutter
- [ ] all text is `AppText` with the right `variant`; no raw `Text`
- [ ] all panes are `Surface`; no `View` with a manual `borderRadius` and `backgroundColor`, and **no new `border`**
- [ ] content column width from `v3.layout.contentMaxWidth` — no manual `max-w-[…]`
- [ ] every control's touch target ≥ 44px (`heights.hit` / `hitSlop`)
- [ ] rows are `ListRow`; buttons are `Button`/`IconButton`; chips are `Chip`
- [ ] spacing from `v3.spacing`/`spacing`/`gap-*` classes — no magic numbers
- [ ] colours only from tokens; `npm run check:design` passes
- [ ] cards/sheets/icons use `heights`, `radii`, `iconSize`
- [ ] animation via `motion`; reduced-motion path tested
- [ ] lays out at 320 and 390px (attach both screenshots), plus a wider screen when a shared primitive changed
