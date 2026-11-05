# Check taxonomy

What each check looks for, and how Memora's design system encodes it. Read the
project you are auditing: the token names and file paths below are this
project's; the *idea* of each check transfers.

## 1. Values that bypass the tokens

| Check | Looks like | Memora's law |
| --- | --- | --- |
| Off-grid spacing | `padding: 14`, `gap: 10`, `marginTop: 18` | `spacing.*` (screen 20, gutter/row 16, section 28, cardPad 24, screenBottom 40, tabClearance 112) and `v2.spacing` (panel 20, section 32, block 16, card 12); 4px grid |
| Invented radius | `borderRadius: 18` where that role is 22 | `radii.micro 10`, `control 14`, `pane 24` (v2 28), `card 22`, `sheet 28`, `pill` |
| Literal type | `fontSize: 15` / `lineHeight: 21` | `typography.*` steps (11→34, each with line-height and tracking); `AppText variant` |
| Raw colour | `#1C2230`, `rgba(…)` outside `theme/` | only `theme/palette.js`; `npm run check:design` enforces it |
| Manual height / icon | `height: 44` on a control, `<MaterialIcons size={18}>` | `heights.*`, `iconSize.*` (xs 13 → display 28) |
| Manual width | `max-w-[980px]`, `maxWidth: 980` | `layout.contentMaxWidth` (v2: 960), `v2.layout.heroMeasure` |

A value that matches a step is still drift when it is written as a literal —
the next designer will not know the step exists. Report it as **low**; report an
off-scale value as **medium**.

## 2. Components re-implemented

The catalogue is the contract. Memora:

| Role | Owner | What duplication looks like |
| --- | --- | --- |
| Panel / surface | `GlassCard` (`tone`, `padding`, `rim`, `radius`) | a `View` with `backgroundColor: glassFill` + radius + shadow |
| Row | `ListRow` (`title`, `subtitle`, `icon`, `value`, `tile`, `density`, `trailing`, `chevron`) | `<Pressable>` + three `<AppText>` |
| Text | `AppText` (`variant`, `tone`, `headingLevel`) | `<Text>` from react-native |
| Primary action | `Button` / `PrimaryButton` | a Pressable styled per screen |
| Chip / segment | `Chip`, `SegmentedControl` | hand-made pills with conditional colours |
| Empty state | `EmptyState` inside `GlassCard` | a dashed frame drawn in place |
| Settings block | `SettingsSection` + `SettingsRow` | rows with hand-set 28px top margins |
| Sheet | `BottomSheetModal` + `SheetPanel` | `Animated.View` with a hand-computed height |
| Motion | `motion/` helpers | `Animated.timing` / `Animated.spring` directly |

A duplicate is **high**, not medium: it diverges further with every edit and
defeats the reason the primitive exists. The fix replaces markup, not just
values.

## 3. Surface and border discipline

- One canvas (`bg-background`), frosted panes, nested fills one step lighter:
  `subtle 0.03 → inset 0.05 → tile 0.06 → control 0.075 → track 0.09`.
- A pane is `glassFill` + a 1px top rim (`rimColor`) + `shadow.pane`. Nothing
  else.
- **No element carries border + rim + shadow at once.** Borders are reserved for:
  focus ring, selected state, dashed empty frame, glass rim, sheet handle.
- One accent pane (`tone="accent"`) per screen, maximum.

If a screen invents a fourth separation device (full border, heavy shadow,
alternating fills), that is the finding — even if each individual value is a
token.

## 4. Screen shell

Every screen composes the shell rather than the frame:

```
<Screen scroll gutter [tabClearance] header={<TopAppBar title/>} footer={…}>
```

- Tab screens use `tabClearance`; stacked screens use `scroll gutter`.
- Screens never set `paddingHorizontal` themselves; `className` is for the
  exception (`pt-0`), not for re-doing the gutter.
- `TopAppBar` for the bar, `SectionHeader` for sections, `EmptyState` for nothing
  to show.

A screen that lays out its own margins is why one screen sits 20px from the edge
and another 24px. That is a visible **medium**.

## 5. Cross-screen parity (the matrix)

Pick the roles that recur on four or more screens and read them line by line.
The classic divergences:

- section gap 28 on Home, 24 on Statistics, 32 on Library
- panel padding 16 here, 20 there for the same kind of content
- the primary action under the heading on one screen, pinned to the footer on
  another, floating on a third
- headings that are `headingLevel={1}` on one screen and plain text on the next
- the same meta line muted on one screen and tertiary on another

Report the matrix, then the diff. Do not "fix" a screen in isolation before
checking whether the majority already agrees.

## 6. Typography roles

- One display number per page (the answer to the page's question), then title,
  then headline. Two `display` elements on one screen is a finding.
- `tone` carries meaning: `muted` / `tertiary` for secondary, `accent` for the
  one action, `danger`/`success`/`warning` for feedback only.
- All-caps is a label trait, not a decoration; letter-spacing belongs to the
  step, not to a local override.

## 7. Layout that doesn't close

Measured, never guessed:

- **Column balance** — panes arranged side by side should end within ~1 spacing
  step of each other. A delta of 150px at 1280 means the pairing is wrong, not
  that the content is short.
- **Tail gap** — if a page does not scroll and its last element ends 300px above
  the viewport, the page reads unfinished at desktop width.
- **Overlap** — floating tab bars and pinned footers must not sit on the last
  row; either the content pads (`tabClearance`) or the bar is not floating.
- **Reading width** — body copy wider than ~75 characters at 1440 is a finding
  even when it fits.
- **Repetition at width** — a two-up grid that stays stacked at 1280 wastes half
  the viewport.

When you propose a fix, say what it does to the other widths. The narrow layout
is the one users hold; a desktop fix that reorders the phone is a regression.

## 8. Motion and feedback

- Durations from `motion.*` (160/260/420/480), not local numbers.
- Every entrance has a reduced-motion path (value applied instantly).
- Press feedback exists on every pressable, and it is the same feedback: a
  screen where some rows scale and others fade is drift.
- Nothing decorative animates. Motion marks entry, state change, and card exit.

## 9. Empty, loading and error states

- Empty → `EmptyState` (icon, title, description, action) inside one `GlassCard`.
- Loading → `Skeleton` / `LaunchSkeleton`, matching the real layout's boxes so
  the page does not jump.
- Error → the same surface treatment as an empty state, with `danger` tone; not a
  bare red line of text.

A screen that handles only the happy path is a **medium** consistency finding,
because the user meets the other two states first.
