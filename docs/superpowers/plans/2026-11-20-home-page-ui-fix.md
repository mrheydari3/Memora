# Home page UI fix — 390×780 verification (re-scoped)

**Status:** **CLOSED 2026-11-20** — no source change required at 390×780.
The 320px wordmark defect is tracked separately in
`2026-11-20-home-wordmark-320.md`.
**Base:** `f9a1407` on `main`; only plan docs changed — no app code.
**Scope:** the Home tab at **390 CSS px wide × 780 CSS px tall**, 1× text.
**Dropped by this re-scope:** the 320px regression test, the `TodayPane`
streak-shortcut move, `PageHeader` edits and all visual-baseline updates.

---

## 1. Verdict first

**Nothing needs changing at 390×780.** Measured on the live app, the Home
screen has no clipped text, no horizontal overflow, no control under 44px and
no header crowding. The wordmark is full (`77 / 77`), and the app bar keeps
61px of slack before the streak chip — enough for a three-digit streak without
touching the title.

The original 320px defect (`Memora` ellipsized to `Me…`) is real and now has
its own open item: `2026-11-20-home-wordmark-320.md`. It does not reproduce at
390 and is out of scope for this 390×780 verification.

## 2. How this was measured

- Dev server: `http://127.0.0.1:8081/home` (Expo web, `node` PID 57157).
- Browser: Playwright Chromium, seeded F2/F3 library (5 decks, 44 cards,
  40 due, 4 folders, 13-day streak), dark theme, 1× text, desktop 1× DPR.
- Viewport set through the live preview to **390 × 780**, page at scroll 0
  after hydration (a first capture taken mid-hydration showed an empty app bar;
  it was a paint timing artifact, not the layout).
- Measured: heading `clientWidth`/`scrollWidth`, document overflow, every leaf
  text node with hidden/clamped overflow, every button/tab box against 44px,
  the app-bar control boxes, the toolbar row, and the floating tab bar against
  the list's maximum scroll.
- The purple “Freebuff” bubble in the captures is the browser overlay, not app
  UI.

## 3. Measurements at 390×780

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
| Floating tab bar | 302 × 70 at y 698–768 (12px bottom inset) | — |
| List clearance at max scroll | last row bottom ≈ 582 vs bar top 698 | ≈ 116px clear |
| Safe areas | `Screen` insets the top; tab bar owns the bottom | handled in code |

The hero card, library heading, search/toolbar and folder rows all sit on the
page's 20px gutters with no overlap. The tab bar is a deliberate floating glass
bar; list content passing under it while scrolling is the designed behavior
(`Screen` + `spacing.tabClearance`), not a defect.

## 4. What would need changing at 390×780

Nothing in the Home UI. The only measurable issue on the screen — the header's
width budget at 320px — does not exist at 390 because the app bar is 70px wider
and the wordmark needs no extra room.

Consequences:

- Do **not** move the streak shortcut; it belongs in the app bar at this size.
- Do **not** add the 320 regression test; it would assert an out-of-scope width.
- Do **not** regenerate the Home baselines; nothing changes.
- No route, data, storage, streak, review or backup changes.

## 5. Optional regression guard (not proposed, not implemented)

If a guard is wanted later, the smallest honest one is a single test at
390×780 asserting the h1 is not truncated and the document has no horizontal
overflow (roughly six lines, no placement change). That would be a new test,
not a fix. This plan does not include it; say so explicitly if you want it.

## 6. What this verification does not cover

- Native iOS/Android safe-area behavior and system font scaling: this was the
  web preview only (insets are 0 on desktop).
- 200% text zoom: at 390 CSS px, 200% zoom paints a 195px layout, below the
  app's documented 320px minimum.
- Firefox/WebKit rendering.
- Visual snapshots: the Home baseline is `home-390` at **390×844**, so
  390×780 has no screenshot coverage. No update is needed while nothing
  changes.

## 7. Out of scope after the re-scope

- The `TodayPane` move and the 320px fix (dropped here; the 320 defect is
  tracked separately in `2026-11-20-home-wordmark-320.md`).
- `PageHeader`, `status bar`, tab bar, hero, shelf, toolbar or sheet redesign.
- Visual baselines, `CHANGELOG.md`, and any commit other than this plan file.

## 8. Close-out

**Closed 2026-11-20:** no change required at 390×780. No source, test, snapshot
or baseline change was made for this verification. The 320px truncation was
subsequently fixed **below 375px only** (`2026-11-20-home-wordmark-320.md`), so
the 390 app bar still carries the streak chip and this verification’s
composition and baseline are unchanged.
