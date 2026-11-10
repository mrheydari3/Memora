# Your Decks — Debug & Verification Plan

**Status:** active (opened 2026-11-10, after the shelf redesign landed).
**Scope:** the Home shelf only — `app/(tabs)/home.tsx` and the four v3 primitives it
drives (`ShelfHeader`, `ShelfBand`, `Foldergroup`, `DeckShelfRow`, `ArchivedRow`,
`FolderCard`). The Today pane, the deck screen and the sheets are out of scope;
they may *read* the same numbers, but a defect found there is triaged against that
surface, not this one.
**Spec:** `docs/design-language.md` (the law), `theme/v3.ts` (the only step source),
the 2026-11-10 shelf mockup (the visual reference for bands, folder pane and card
lines).

> **For the debugger:** every task ends with a measured line, not an opinion.
> Run the probe, paste the JSON, compare it with §2. If a number is off, the
> triage table in §4 names the file before you open it.

---

## 1. Why the shelf needs its own debug plan

The redesign changed the failure profile of the screen in three ways:

1. **Heights became content-driven.** The folder header is `minHeight: 76` and the
   deck card `minHeight: 96`; a wrapping name or meta silently grows the row
   (measured: 118 for `Due today (review)` inside a folder). Nothing overflows, so
   no existing check fails — the shelf just stops feeling like a shelf.
2. **The trailing cluster competes for width.** A due pill, a chevron and a 44px
   options rail now share one line with the folder name and its counts. At 390 the
   counts wrap at the space before `due`; at 320 they truncate.
3. **One pane became collapsible.** The archive section is a pane with
   `aria-expanded` and a body that mounts only when open, so its rows are absent
   from the accessibility tree until someone opens it — and its count must still
   be announced.

None of the three is caught by `tsc`, `check:design`, the data tests or the axe
sweep. They are caught by the probe in §3.

---

## 2. Ground truth (measured 2026-11-10, do not regress)

| Contract | Value | Where |
| --- | --- | --- |
| Section bands | uppercase label + `(count)` + quiet hint (`Hierarchical` / `Root level` / `In this folder`); no tick, no count pill, no hairline | `ShelfBand` |
| Shelf has no *Explore your decks* row | the shelf starts with the breadcrumb and then the first band (row removed 2026-11-10) | `home.tsx` |
| Folder pane | header banner (glyph 40, name, pin, `N deck(s) · M due` or `N direct · M nested · X due`, due pill, chevron) over a recessed well | `FolderGroup` |
| Folder height | 76 collapsed header, no rail, no guide line | measured 390 |
| Deck card | identity line (glyph 36, name, pin, due pill, options rail) + one rail line | `DeckShelfRow` |
| Deck height | 96 min; 98–101 at 1280; 118 only when the name wraps | measured |
| Loose deck with work today | segmented rail `n new / n learn / n review` + studied `%` or `—` | `composition` |
| Loose deck with nothing due | studied rail + `%` + `mastered` / `not studied yet` | `DeckShelfRow` |
| Folder deck (nested) | `flat` row inside the well, studied rail, no composition | `renderDeck({flat: true})` |
| Archive | pane header `ARCHIVED · 1 deck`, `aria-expanded="false"` by default, rows on open | `home.tsx` |
| Desktop board | `FolderCard` grid, 3 tiles for the dev library, `% studied` on the tile, untouched by the redesign | `FolderCard` |
| Strings | `Your decks`, `Folders`, `Unfiled decks`, `Folders here`, `Decks here`, `N cards · FSRS-6`, `N direct · M nested · X due`, `N deck(s) · M due`, `%`, `—`, `clear` | pinned by `tests/e2e/data-truth.spec.ts` |
| Semantics | `shelf-panel`, `folder-group`, `folder-subitem`, `deck-row`, `folder-card`; hints `Open deck`, `Collapse folder`/`Expand folder`; **zero nested interactive elements** | all specs |

---

## 3. The instrument (repeatable, no Playwright needed)

Start the dev server in CI mode (Metro does not hot-reload; restart after edits):

```bash
CI=1 nohup npx expo start --web --port 3001 --host lan > /tmp/expo-web.log 2>&1 &
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3001/   # expect 200
```

### 3.1 Phone probe (390×844, cache-busted)

Run in the browser tab that already holds the preview origin, via `preview_evaluate`:

```js
const wrap = document.createElement('div');
wrap.style.cssText = 'position:fixed;inset:0;z-index:2147483647;background:#07090E';
const f = document.createElement('iframe');
f.style.cssText = 'width:390px;height:844px;border:0;display:block';
wrap.appendChild(f); document.body.appendChild(wrap);
await new Promise((r) => { f.onload = r; f.src = '/home?t=' + Date.now(); });
const d = f.contentDocument;
// wait for [data-testid="folder-group"], then scroll the shelf to the top of its scroller
```

Report: `folderHeight`, `deckHeight`, `folderText`, `deckText`, and every leaf whose
`scrollWidth > clientWidth` (the truncation list). Expected for the dev library:
`folderHeight 76`, `deckHeight 118` (long fixture name), truncation list empty.

### 3.2 Desktop probe (1280 wide)

Same frame with `width:1280px;height:1200px`, wait for `[data-testid="folder-card"]`.
Report: tile count, first tile text (must contain `% studied`), row heights,
`archiveBefore`/`archiveAfter` `aria-expanded`, and the text of the first row whose
text matches `/new|learn|review/` (the composition rail).

**This environment cannot screenshot 1280:** the preview viewport is 416 CSS px, so a
1280 frame is clipped. Measure here; capture the visual on a host with a wider panel.

### 3.3 Playwright e2e (runs with extracted libs)

`npx playwright test` fails on a bare sandbox with
`chrome-headless-shell: error while loading shared libraries: libnspr4.so`. There
is no apt index and `sudo` is blocked, so extract the noble packages into
`/tmp/pwlibs` and point the loader at them:

```bash
mkdir -p /tmp/debs /tmp/pwlibs && cd /tmp/debs
curl -sS -o main.gz http://archive.ubuntu.com/ubuntu/dists/noble/main/binary-amd64/Packages.gz
curl -sS -o universe.gz http://archive.ubuntu.com/ubuntu/dists/noble/universe/binary-amd64/Packages.gz
gunzip -kf main.gz universe.gz && cat main universe > all
for p in libnspr4 libnss3 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libxkbcommon0 \
         libasound2t64 libatk1.0-0t64 libatk-bridge2.0-0t64 libatspi2.0-0t64 libxi6 libxrender1; do
  f=$(awk -v p="$p" '$0 == "Package: " p {found=1} found && /^Filename: / {print $2; exit}' all)
  b=$(basename "$f"); curl -sS -o "$b" "http://archive.ubuntu.com/ubuntu/$f"; dpkg-deb -x "$b" /tmp/pwlibs
done
export LD_LIBRARY_PATH=/tmp/pwlibs/usr/lib/x86_64-linux-gnu
BASE_URL=http://127.0.0.1:3001 npx playwright test tests/e2e/shelf-keyboard.spec.ts
```

`/tmp` is disposable: re-run the block after a restore. Never report e2e as
passing without the command output.

`tests/e2e/data-truth.spec.ts` is also stale: it expects the old shelf caption
`5 decks · 40 due` and a `1 folder inside` button that the header no longer renders.
Repair that spec (Task 8) before using e2e as an oracle.

---

## 4. Triage table — symptom to file, before you read code

| Symptom | First suspect | Open |
| --- | --- | --- |
| Folder counts wrap to two lines / end in an ellipsis | trailing cluster width (pill + chevron + `paddingRight`) at ≤390; the options button was removed for this reason | `FolderGroup.tsx` header row |
| Deck name wraps and the row grows past 96 | pill inline plus the 44px options rail leaving ≈155px for the name inside a well | `DeckShelfRow.tsx` header |
| Row taller than expected but text is one line | glyph size vs two text lines (name 20 + meta 17 + 2), or a `gap` added at the wrong level | `DeckShelfRow.tsx`, `theme/v3.ts` |
| Loose deck shows no segmented rail | `composition` is only passed when the level is root and `total > 0` | `home.tsx` `renderDeck` |
| `%` or `—` missing | studied rail needs `progress`; a 0-card deck must render `—`, not `0%` | `DeckShelfRow.tsx` |
| Archive always open / never opens | `archiveOpen` state and `aria-expanded` on the pane header | `home.tsx` archive block |
| Accessibility tree reports a nested button | the options menu must stay a *sibling* of the pressable, never inside it | `FolderGroup.tsx`, `DeckShelfRow.tsx` |
| Desktop tile lost `% studied` or grew a rail | desktop board is `FolderCard`, deliberately not `DeckShelfRow` | `FolderCard.tsx`, `home.tsx` `visibleFolders` branch |
| Shelf numbers disagree with the deck screen | the shelf reads the capped queues (`deckQueues`), not the raw counts | `home.tsx` `shelfMeta`/`deckQueues` |
| Horizontal overflow at 320 | a text column without `minWidth: 0` or a fixed-width trailing cluster | `FolderGroup.tsx`, `DeckShelfRow.tsx` |
| A row is announced as "Open deck" but does not open one | the hint lives on the row, the chevron is decorative | `DeckShelfRow.tsx` |

---

## 5. Tasks

> **Run 2026-11-10:** tasks 1–7 executed; every number is recorded in
> `docs/test-report-2026-11-10-your-decks.md`. Tasks 2, 4, 5, 6 and 7 pass; task 3
> is **partial** (no overflow, but 16 leaves truncate at 2× text). Task 5 was
> settled with Playwright (`tests/e2e/shelf-keyboard.spec.ts`, 2/2). Task 8: the
> harness runs (§3.3), `data-truth.spec.ts` is synced (13/13) and the full suite is
> green except three `statistics-visual` snapshots (browser-build drift).

- [x] **1. Baseline.** Run §3.1 and §3.2 against the current tree; record both JSON
  blobs here. Acceptance: `folderHeight 76`, `deckHeight ≤ 118`, truncation list
  empty, 3 desktop tiles, archive `false → true`.
  *Measured:* folder 76; decks 118 / 98 / 121; truncation list empty; 3 tiles (94
  in a 128 shell); archive `false → true → false`.
- [x] **2. 390 sweep.** Check every band, the folder pane, one flat row, one loose
  row with composition, one without, the empty folder and the archive pane.
  Acceptance: no clipped leaf, no nested interactive, due pill and chevron never
  overlap the name.
  *Measured:* 0 clipped, 0 spills, 0 nested interactives, 0 pill overlaps; six
  hints present; folder 76/81/76, decks 118/98/121.
- [ ] **3. 320 + 200 % text.** Same frame at 320 wide with the browser zoom at 2×.
  Acceptance: no horizontal scroll inside `shelf-panel`; names wrap (2 lines max)
  rather than truncate mid-word.
  **PARTIAL.** With leaf fonts doubled at 320: shelf overflow 0, page overflow 0,
  but 16 leaves clip and 9 text nodes collapse to 0 width (folders 190, decks
  226–267). The design law (wrap *or* truncate, no overflow) holds; the stricter
  “wrap, not truncate” line does not. Defect **D-1**, remedy in the report.
- [x] **4. 1280 board.** Measure tile height and text; open a folder from the tile
  and confirm the phone pane is what renders inside it. Acceptance: tiles keep
  `% studied`, tapping a tile sets `openFolderId`, and the shelf header becomes the
  folder name with a breadcrumb capsule.
  *Measured:* 3 tiles, `1 deck · 100% studied`; tap → 0 tiles, 1 flat row, header
  `Travel`, band `DECKS HERE (1)`. Breadcrumb sits outside `shelf-panel` and was
  code-checked, not visually captured.
- [x] **5. Keyboard and screen reader.** Tab order: breadcrumbs → header actions →
  folder header → its rows → band links. Acceptance: focus ring visible on every
  target, Escape closes the folder options sheet and returns focus, `aria-expanded`
  flips on Enter/Space only.
  *Measured with Playwright* (`tests/e2e/shelf-keyboard.spec.ts`, **2/2 pass**):
  Enter and Space open and close the folder header, `a` is a no-op, and Escape
  closes the deck options sheet and returns focus to its trigger.
- [x] **6. Hover and reduced motion.** Acceptance: hover only tints (no layout
  shift), and with `prefers-reduced-motion` the chevron rotation is instant.
  *Measured:* hover keeps 118→118 px; chevron `transition-duration: 0s`,
  `animation-name: none`; the press spring short-circuits through
  `prefersReducedMotion()` in `motion/index.ts`.
- [x] **7. Data truth.** Compare the shelf's `N cards · FSRS-6`, due pills and `%`
  against the deck screen for the same deck. Acceptance: identical figures; a
  caught-up deck says `All clear`, never `0 due`.
  *Measured:* 6 + 30 + 4 = 40 due, equal to the header; `/deck/deck-due` reports
  `6 cards · 6 due` against the shelf's `6 cards · 6 due · 100% studied`; the
  caught-up deck reads `clear` / `All clear`.
- [ ] **8. Repair e2e.** Install Chromium system deps, then rewrite
  `tests/e2e/data-truth.spec.ts` to the shipped header (no caption row, no
  `folder inside` button) and delete assertions for the removed Explore row.
  Acceptance: `npm run test:e2e` green locally, captured in the report.
  **Done except three baselines:** harness runs (§3.3); `data-truth` synced and
  **13/13**, `flows` **52/52**, `a11y` **24/24** (after fixing a real
  `label-content-name-mismatch` on the deck row), `library/layout/import/haptics`
  **7/7**, `group-a/hints/keyboard/menus/quiz-result` **19/19**, `visual`
  **12/12**. `statistics-visual` fails 3/3 at ratio 0.03: the sandbox Chromium
  build differs from the one that captured those baselines, and Statistics is not
  touched by this work. Baselines were **not** regenerated.
- [x] **9. Record.** Append the measured evidence to
  `docs/test-report-2026-11-08-ui-v3.md` (or a new dated report) with the probe
  JSON and the commands used.
  *Done:* `docs/test-report-2026-11-10-your-decks.md` (verdict, per-task numbers,
  defects D-1…D-3, limitations, reproduction).

---

## 6. Exit criteria

The shelf is "debugged" when, in one pass on the same commit:

1. `npx tsc --noEmit` → 0 errors.
2. `npm run check:design` → clean (file count matches the tree).
3. `npm test` → all pass (219 at baseline).
4. §3.1 and §3.2 return the §2 values, truncation list empty.
5. Tasks 2–7 are checked with their acceptance line measured, not eyeballed.
6. Task 8 is either green or explicitly recorded as blocked with the exact
   `libnspr4` error — never "probably fine".

---

## 7. Known open defects from the 2026-11-10 pass

- **Folder meta wraps at 390** for long counts (`0 direct · 2 nested · 30 due`).
  Accepted for now: the alternative was dropping the due pill or the chevron.
  Revisit if a folder name also has to wrap in the same header.
- **Long deck names grow the card to 118.** Accepted: the name is real content and
  the design language forbids mid-word truncation. If density matters more, move
  the pill onto the rail line and give the name the full width.
- **Desktop visual not captured here** (416px preview viewport). Structure was
  measured, not seen; a human screenshot at 1280 is still owed.
- **e2e unrun** in this sandbox (missing `libnspr4`), and `data-truth.spec.ts` is
  out of sync with the shipped header.

---

## 8. Commands

```bash
npx tsc --noEmit                  # 0
npm run check:design              # clean
npm test                          # 219/219 at baseline
npm run test:e2e                  # blocked here: libnspr4.so
```
