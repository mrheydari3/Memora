# Home page UI check — mobile 390 and tablet/PC 780 widths

**Status:** **CLOSED 2026-11-20** — no source change required at either width.
The 320px wordmark defect was tracked and fixed separately in
`2026-11-20-home-wordmark-320.md` (below 375px only).
**Base:** `f9a1407` on `main`; only plan docs changed — no app code.
**Scope:** the Home tab at **390px wide (mobile)** and **780px wide
(tablet/PC)**, 1× text. An earlier version of this note called the check
“390×780”; that was a misreading — 390 and 780 are two viewport widths, not
one 390×780 viewport.
**Dropped by this re-scope:** the 320px regression test, the `TodayPane`
streak-shortcut move, `PageHeader` edits and all visual-baseline updates.

---

## 1. Verdict first

**Nothing needs changing at 390 or 780.** Measured on the live app, the Home
screen has no clipped text, no horizontal overflow, no control under 44px and
no header crowding at either width.

- **390 (mobile):** the wordmark is full (`77 / 77`), the streak chip sits in
  the app bar, there is no library rail, and the shelf is single-column.
- **780 (tablet/PC):** the 768px tablet breakpoint is active — hero and library
  rail side by side, two-column board. The wordmark is full and the streak
  chip stays in the app bar.

The 320px defect (`Memora` ellipsized to `Me…`) was real and is now fixed
below 375px; it does not reproduce at either 390 or 780.

## 2. How this was measured

- Dev server: `http://127.0.0.1:8081/home` (Expo web, `node` PID 57157).
- Browser: Playwright Chromium, seeded F2/F3 library (5 decks, 44 cards,
  40 due, 4 folders, 13-day streak), dark theme, 1× text, desktop 1× DPR.
- Live preview resized to **390 × 844** (mobile) and **780 × 1024**
  (tablet/PC), page at scroll 0 after hydration. (A first capture taken
  mid-hydration showed an empty app bar; it was a paint timing artifact, not
  the layout.)
- The 390-width table also keeps the measurements first taken in a
  390-wide × 780-tall capture; the height only affects the tab-bar and list
  clearance rows, which are marked accordingly.
- Measured: heading `clientWidth`/`scrollWidth`, document overflow, every leaf
  text node with hidden/clamped overflow, every button/tab box against 44px,
  the app-bar control boxes, the toolbar row, the hero/rail geometry, the
  board columns, and the floating tab bar against the list's maximum scroll.
- The purple “Freebuff” bubble in earlier captures is the browser overlay, not
  app UI.

## 3. Measurements

### 3.1 390 wide (mobile)

| Check | Measured | Verdict |
|---|---|---|
| `Memora` h1 | `clientWidth 77`, `scrollWidth 77` | full, no ellipsis |
| Document horizontal overflow | `0 px` | none |
| Ellipsized text leaves (single-line) | `0` | none |
| Line-clamped text | 1 long deck name, 2 lines (`sh 80 / ch 40`) | designed `numberOfLines`, not a layout bug |
| App bar left group | brand 20–62, wordmark 70–147 | fits |
| Streak chip | 62.1 × 44 at x 207.9–270 | 44px target |
| Discover | 44 × 44 at x 278–322 | pass |
| Create new | 44 × 44 at x 326–370 | pass; 20px right gutter |
| Header slack before chip | 61px after the wordmark | 3-digit streak still fits |
| Controls under 44px | `0` of all buttons/tabs | pass |
| Library toolbar | 134.7px search + All / Due / Sort, one row | no wrap |
| Library rail | absent | mobile composition |
| Floating tab bar | 302 × 70 at y 698–768 (12px bottom inset) | measured at the 780px-tall capture |
| List clearance at max scroll | last row bottom ≈ 582 vs bar top 698 | ≈ 116px clear at that height |
| Safe areas | `Screen` insets the top; tab bar owns the bottom | handled in code |

The hero card, library heading, search/toolbar and folder rows all sit on the
page's 20px gutters with no overlap. The tab bar is a deliberate floating glass
bar; list content passing under it while scrolling is the designed behavior
(`Screen` + `spacing.tabClearance`), not a defect.

### 3.2 780 wide (tablet/PC)

| Check | Measured | Verdict |
|---|---|---|
| `Memora` h1 | `clientWidth 77`, `scrollWidth 77` at x80 | full, no ellipsis |
| Document horizontal overflow | `0 px` | none |
| Streak chip | 62 × 44 at x588, accessible name `13-day streak…` | 44px target, app bar |
| Hero pane | 336 × 345 at x30, y96 | — |
| Library rail | 360 × 345 at x390, y96 — starts after the hero with a 24px gap | tablet composition |
| Library board | two columns: 354px folder cards at x30 and x396 (y671 and y809) | two-up as designed |
| Content column | 720px wide, centered (30px side margins at 780) | within the 760px max |
| Safe areas | same `Screen` top inset and tab-bar ownership | handled in code |

## 4. What would need changing at 390 or 780

Nothing in the Home UI. The only measurable issue on the screen — the header's
width budget at 320px — does not exist at 390 or 780:

- At 390 the app bar is 70px wider than 320 and the wordmark needs no extra
  room.
- At 780 the tablet composition has ample header width, and the hero/rail split
  and two-column board are the designed large-layout behavior.

Consequences:

- The streak shortcut stays in the app bar at both widths; the 320 fix moves
  it into the hero only below 375px, so neither width is affected.
- No Home baselines change at 390/768/1280 as a result of this check.
- No route, data, storage, streak, review or backup changes.

## 5. Optional regression guard (not proposed, not implemented)

If a guard is wanted later, the smallest honest one is a single test at 390
and 780 asserting the h1 is not truncated and the document has no horizontal
overflow (roughly six lines, no placement change). That would be a new test,
not a fix. This plan does not include it; say so explicitly if you want it.

## 6. What this verification does not cover

- Native iOS/Android safe-area behavior and system font scaling: this was the
  web preview only (insets are 0 on desktop).
- 200% text zoom: at 390 CSS px, 200% zoom paints a 195px layout, below the
  app's documented 320px minimum.
- Firefox/WebKit rendering.
- Visual snapshots: the Home baseline is `home-390` at **390×844**, covering
  the mobile width. The visual suite samples 768 and 1280, not 780, so the
  780-width result above is measurement-only.

## 7. Out of scope after the re-scope

- The `TodayPane` move and the 320px fix (the 320 defect is tracked and fixed
  separately in `2026-11-20-home-wordmark-320.md`).
- `PageHeader`, status bar, tab bar, hero, shelf, toolbar or sheet redesign.
- Visual baselines, `CHANGELOG.md`, and any commit other than this plan file.

## 8. Close-out

**Closed 2026-11-20:** no change required at either 390 or 780. No source,
test, snapshot or baseline change was made for this verification. The 320px
truncation was subsequently fixed **below 375px only**, so the app bar still
carries the streak chip at 390 and 780 and this verification's composition and
baselines are unchanged.
