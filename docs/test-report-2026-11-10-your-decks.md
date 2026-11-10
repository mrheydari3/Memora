# Your Decks — debug pass, tasks 2–7 (measured)

**Date:** 2026-11-10
**Tree:** uncommitted shelf redesign + the 2026-11-10 Explore-row removal (9 modified files, 1 new `ShelfStatusPill.tsx`).
**Plan:** `docs/superpowers/plans/2026-11-10-your-decks-debug-plan.md`.
**Environment:** Expo dev server in CI mode (`CI=1 npx expo start --web --port 3001 --host lan`, Metro `Web Bundled`, HTTP 200), Chromium through the Freebuff cloud preview (416 × 826 CSS px panel), measurement harness = same-origin **iframe probes** injected with `preview_evaluate` (no Playwright; see Limitations).

## Verdict

| Task | Result | Headline evidence |
| --- | --- | --- |
| 1. Baseline | **pass** | folder 76 px; decks 118 / 98 / 121; truncation list empty; 3 desktop tiles |
| 2. 390 sweep | **pass** | 0 clipped leaves, 0 spills, 0 nested interactives, 0 pill overlaps, archive `false → true → false` |
| 3. 320 + 200 % text | **partial** | no horizontal overflow, but 16 leaves clip and 9 text nodes collapse to 0 width |
| 4. 1280 board | **pass** | tile 94 px in a 128 px shell with `% studied`; tapping it opens the folder level (header `Travel`, 1 flat row) |
| 5. Keyboard / SR | **pass** | Playwright: Enter and Space toggle the folder header; Escape closes the options sheet and restores focus to its trigger |
| 6. Hover / reduce | **pass** | hover changes no geometry; chevron has `0s` transition and no animation; reduce path present in `motion/` |
| 7. Data truth | **pass** | shelf 40 due = 6 + 30 + 4; deck screen and shelf agree on `6 cards · 6 due`; caught-up deck says `clear` / `All clear` |

---

## Task 2 — 390 sweep

Probe: 390 × 844 iframe at `/home`, shelf scrolled to the top of its scroller, dev library.

| Measure | Value |
| --- | --- |
| Shelf header | `Your decks` · `5 decks · 4 folders · 40 due` |
| Bands | `FOLDERS (3)` + `Hierarchical` · `UNFILED DECKS (2)` + `Root level` · `ARCHIVED · 1 deck` |
| Nodes | 3 `folder-group`, 1 `folder-subitem`, 3 `deck-row`, 0 `folder-card` (phone) |
| Folder heights | 76 / **81** / 76 (Languages: its counts wrap to two lines) |
| Deck heights | **118** / 98 / **121** (long names wrap: `Due today (review)`, `فارسی — کارت‌های راست‌به‌چپ`) |
| Clipped leaves (`scrollWidth > clientWidth`) | **0** |
| Elements spilling outside the shelf | **0** |
| `shelf-panel` horizontal overflow | **0** |
| Nested interactive elements | **0** |
| Status pill vs text overlap | **0** (six pills checked) |
| Hints in the accessibility tree | `New folder`, `Edit layout`, `Collapse folder`, `Open deck`, `Open folder`, `Expand archived decks` |
| `aria-expanded` | folder headers `true`; archive `false` |
| Archive | `false → true` (body: `ARCHIVED | 1 deck | Archived deck | 3 cards`) `→ false` on re-press |
| Deck accessible names | `Due today (review), 6 cards, FSRS-6, 100% studied, 6 due, pinned` · `Empty deck, 0 cards, FSRS-6, not studied yet, All clear` |

The 118 / 121 px rows are the known content-driven case, not a layout bug: the name is real content and the design law forbids mid-word truncation.

## Task 3 — 320 + 200 % text

Two emulations were run, because RN Web sizes everything in px:

1. **Leaf font doubling (the meaningful one).** 320-wide iframe, every text leaf's `font-size` and `line-height` doubled (110 leaves).
2. **CSS `zoom: 2` on a 320 frame.** Recorded for transparency only — RN Web lays out from `window.innerWidth`, so `zoom` paints 2× without re-laying out; it measured 26 px of shelf overflow and 25 spills, which is *not* a text-zoom result.

Doubled-text result:

| Measure | Value |
| --- | --- |
| Shelf overflow / page overflow | **0 / 0** |
| Text leaves clipped | **16** |
| Text nodes collapsed to 0 width | **9** |
| Folder height | 190 |
| Deck heights | 226 / 226 / 267 |
| First clipped leaves | `Folders` 116→89 · `Hierarchical` 141→118 · `6 cards · FSRS-6` 196→31 · `1 deck · 6 due` 37→31 · `Due today (review)` 47→31 |

**Reading:** the design law ("wrap or truncate without horizontal overflow") holds — nothing scrolls sideways. The plan's stricter acceptance ("names wrap rather than truncate") does **not**: at 2× text the header/well columns are squeezed to ~31 px by the 36–40 px glyph + status pill + chevron + 44 px options rail, so `numberOfLines` truncates instead of wrapping. Logged as **D-1**; the remedy is a wrapped trailing cluster (pill/chevron below the name) below ~360 px of effective text width, not a smaller glyph.

## Task 4 — 1280 board

| Measure | Value |
| --- | --- |
| `folder-card` tiles | 3 |
| Tile height | **94** inside a **128** shell |
| Tile text | `Travel | 1 deck · 100% studied | 6 due | Open folder` |
| Deck rows at root | 2, heights **98 / 101** |
| After tapping the tile | `folder-card` 0, `folder-group` 0, 1 `deck-row` (`Due today (review) | 6 cards · FSRS-6 | 6 due | 0 new · 0 learn · 6 review | 100%`) |
| Header after tap | `Travel` · `1 deck · 0 folders · 6 due` · band `DECKS HERE (1)` |

The breadcrumb (`ShelfBreadcrumbs`, `aria-label="Library path"`) renders **outside** `shelf-panel`, so this probe did not measure it; its code path is `trail.length === 0 → null`, and at folder level it renders `All decks` + `Current folder <name>`. Not claimed as visually verified.

## Task 5 — keyboard and screen reader

**Definitive run** — Playwright 1.64.1 / Chromium 1248, 390 × 844, F3 fixture, `reducedMotion: 'reduce'`:

```bash
BASE_URL=http://127.0.0.1:3001 npx playwright test tests/e2e/shelf-keyboard.spec.ts
# ✓ 2 passed (7.6s)
```

New spec: `tests/e2e/shelf-keyboard.spec.ts` (two cases, one per user-reported risk).

| Case | Result |
| --- | --- |
| Folder header starts `aria-expanded="true"` and is focusable | pass |
| `a` leaves the accordion untouched | pass |
| `Enter` closes, second `Enter` reopens | pass |
| `Space` closes, second `Space` reopens | pass |
| Deck options trigger focuses and opens the sheet (`role="dialog"`) | pass |
| `Escape` closes the sheet and focus returns to the options trigger | pass |

The earlier probe numbers (kept for the record) under-reported activation because untrusted `KeyboardEvent`s never start a react-native-web press: the responder opens on `keydown` and fires `onPress` from a `document` `keyup` listener (`PressResponder.js:66`, `:203`). With real keys the pattern works.

| Probe check (pre-Playwright) | Result |
| --- | --- |
| Focus ring | `outline: solid 2px` |
| `Enter` / `Space` as synthetic events | no state change (false negative, see above) |
| `Escape` via synthetic event | dialog closed; focus landed on the folder header because the opener was a programmatic click |

## Task 6 — hover and reduced motion

| Check | Result |
| --- | --- |
| Hover geometry | unchanged (118 → 118 px; width identical) |
| Chevron transition | `transition-duration: 0s`, `animation-name: none` — rotation is instant with or without the preference |
| Press animation | `DeckShelfRow` uses `usePressFeedback` → `springTo`, which short-circuits to `value.setValue(toValue)` when `prefersReducedMotion()` is true (`motion/index.ts`) |
| Press-animation probe | synthetic `pointerdown` did not start the spring in either mode (no transform change), so the reduce-motion *timing* was not measured — source-verified only |

## Task 7 — data truth

| Surface | Figures |
| --- | --- |
| Shelf header | `5 decks · 4 folders · 40 due` |
| Folder pills | `Travel · 1 deck · 6 due` = 6 · `Languages · 0 direct · 2 nested · 30 due` = 30 · `Nothing here yet · empty` = 0 |
| Subfolder | `German · 2 decks · 30 due` ⊂ Languages (0 direct + 2 nested) |
| Loose decks | `Empty deck · 0 cards · FSRS-6 · clear · — · not studied yet` · `فارسی… · 4 cards · 4 due` |
| Sum | 6 + 30 + 4 + 0 = **40**, equal to the header |
| Deck screen `/deck/deck-due` | `Due today (review)` · `TODAY'S QUEUE` · `6 cards` · `6 cards due` · `CARDS 6 cards · 6 due` |
| Shelf card for the same deck | `6 cards · FSRS-6` · `6 due` · `100% mastered` |

A caught-up deck never says `0 due`: the pill reads `clear` and a 0-card deck shows `—` with `not studied yet`. The card is named by its own contents, so its accessible name reads the same words.

## Full e2e suite (fresh harness)

`LD_LIBRARY_PATH=/tmp/pwlibs/usr/lib/x86_64-linux-gnu BASE_URL=http://127.0.0.1:3001 npx playwright test`, split into chunks for the five-minute command cap.

| Spec | Result |
| --- | --- |
| `shelf-keyboard.spec.ts` (new) | **2 / 2** |
| `data-truth.spec.ts` (synced) | **13 / 13** |
| `flows.spec.ts` | **52 / 52** |
| `a11y.spec.ts` | **24 / 24** |
| `library` · `layout` · `import` · `haptics` | **7 / 7** |
| `group-a` · `hints` · `keyboard` · `menus` · `quiz-result` | **19 / 19** |
| `visual.spec.ts` | **12 / 12** |
| `statistics-visual.spec.ts` | **0 / 3** — every `dashboard` snapshot differs at ratio 0.03 (320 / 390 / 1280) |

### What the sync changed in `data-truth.spec.ts`

- The two old caption helpers became one `shelfMeta(decks, folders, due)`, because the shipped header prints `5 decks · 4 folders · 40 due`; at the root the folder count is **every** folder in the store (`home.tsx` `scopeFolderCount` uses `folders.length`), inside a folder it is the child folders printed at that level.
- Folder navigation now goes through the `folder-subitem` row (`German · 2 decks · 30 due`), not the removed `1 folder inside` button; the old `folder-group` assertion for German moved to that row, and the level's meta is checked as `2 decks · 0 folders · 30 due`.
- Removed the Explore-row assertions with the feature itself.

### One accessibility regression found and fixed

`a11y` failed on Home with `label-content-name-mismatch`
(`button[aria-describedby="hint-_r_3_"][data-testid="deck-row"]`): the deck card
carried a hand-written `aria-label` saying `…, 6 due, 100% studied` while the card
prints `…, 6 due, 100%`, `mastered` (or the composition rail and its `—`). The label
now comes from the card's own contents — no parallel description to drift — and
`a11y` is 24/24. `HintPressable` still supplies "Open deck" through
`aria-describedby`.

### The three failing snapshots

`statistics-visual` compares the populated Statistics dashboard at 320/390/1280 and
diffs ~3 % of pixels in all three. The Statistics page is untouched by this change
and consumes none of the tokens that moved (`rail.composition`, `heights.deckRow`),
while the 2026-11-08 baselines were captured with Chromium 156.0.8078.4 and this
sandbox ships the Chromium 1248 build. Recorded as baseline drift; **not
regenerated**, because new committed images are a product decision.

---

## Open defects

- **D-1 (task 3):** at 200 % text on a 320 px layout, 16 text leaves truncate and 9 collapse to 0 width. No overflow. Remedy: wrap the trailing cluster under the identity line below ~360 px effective width, and let the folder counts take the full header width.
- **D-2 (resolved, task 5):** keyboard activation and Escape focus restore are confirmed by `tests/e2e/shelf-keyboard.spec.ts` (2/2); the earlier "unverified" status came from synthetic key events.
- **D-3 (task 4):** the desktop visual is still not captured here (preview viewport 416 px); the numbers above are structural, not a screenshot review.

## Limitations

- Playwright does not launch on a bare sandbox (`chrome-headless-shell: error while loading shared libraries: libnspr4.so`). This pass fetched the thirteen missing noble libraries into `/tmp/pwlibs` and ran with `LD_LIBRARY_PATH=/tmp/pwlibs/usr/lib/x86_64-linux-gnu`; the exact block is at the end of this file. It is a workspace workaround, not a repo baseline.
- 1280 visuals are measured, never seen: the preview panel is 416 CSS px wide.
- `tests/e2e/data-truth.spec.ts` is synced in this pass (13/13); the only e2e failures left are the three `statistics-visual` baselines described above.

## How to reproduce

```bash
CI=1 nohup npx expo start --web --port 3001 --host lan > /tmp/expo-web.log 2>&1 &
# then, in the preview origin, inject a 390×844 (or 1280×1200) same-origin iframe
# at /home?t=<now>, wait for [data-testid="shelf-panel"], scroll it to the top and
# read the measurements above; the archive pane is [aria-label^="Archived decks"].
```

### Local Playwright dependencies (no root)

The sandbox has no apt index and `sudo` is blocked, so the missing browser libraries
are extracted from the noble pool into `/tmp/pwlibs`:

```bash
mkdir -p /tmp/debs /tmp/pwlibs && cd /tmp/debs
curl -sS -o main.gz http://archive.ubuntu.com/ubuntu/dists/noble/main/binary-amd64/Packages.gz
curl -sS -o universe.gz http://archive.ubuntu.com/ubuntu/dists/noble/universe/binary-amd64/Packages.gz
gunzip -kf main.gz universe.gz && cat main universe > all
for p in libnspr4 libnss3 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libxkbcommon0 \
         libasound2t64 libatk1.0-0t64 libatk-bridge2.0-0t64 libatspi2.0-0t64 libxi6 libxrender1; do
  f=$(awk -v p="$p" '$0 == "Package: " p {found=1} found && /^Filename: / {print $2; exit}' all)
  b=$(basename "$f")
  curl -sS -o "$b" "http://archive.ubuntu.com/ubuntu/$f"
  dpkg-deb -x "$b" /tmp/pwlibs
done
export LD_LIBRARY_PATH=/tmp/pwlibs/usr/lib/x86_64-linux-gnu
BASE_URL=http://127.0.0.1:3001 npx playwright test tests/e2e/shelf-keyboard.spec.ts
```

`/tmp` is disposable — re-run the block after a workspace restore.
