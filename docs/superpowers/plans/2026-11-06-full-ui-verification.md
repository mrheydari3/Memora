# Full UI Verification Plan — Memora (web)

> **For agentic workers:** execute this plan phase by phase. Use checkbox (`- [ ]`) syntax for tracking. A phase is not done until its acceptance line is measured and recorded.

**Date:** 2026-11-06
**App:** Memora 2.3.0 — Expo SDK 58 (`expo ~58.0.22`), React Native 0.88, React 19.3, TypeScript, web-only (`app.json` → `platforms: ["web"]`).
**Spec / law:** `docs/design-language.md`, `AGENTS.md` (Expo SDK 58 versioned docs), `README.md`.

**Goal:** one auditable pass that proves every user-visible surface and every interactive element of the web build is correct, accessible, responsive, persistent and honest — with a PASS/FAIL row for each, backed by a measurement or a reviewed screenshot.

**Non-goals:** redesign, new features, native builds (there are none — `app.json` is web-only), backend work (there is none), load testing, real screen-reader hardware (the accessibility tree plus axe is the evidence; that limitation is recorded, not hidden).

**Tooling:** Playwright + axe-core, the repo's audit scripts, a manifest-driven surface harness.

---

## 1. What "everything" means

Four axes, multiplied. A surface is only counted as checked when a row exists for it in the report.

| Axis | Values | Count |
| --- | --- | --- |
| **Surface** | every route plus every overlay/state variant | **83** (Appendix A) |
| **Gate** | G1–G12 (section 2) | 12 |
| **Fixture** | F0–F6 (section 3) | 7 |
| **Environment** | 320/375/390/431/768/1024/1280/1440 px · Chromium/Firefox/WebKit · reduce-motion on/off · 200% zoom · touch emulation | — |

Because not every gate applies to every surface, the harness records the applicable subset — typically 9–12 per surface, so **800+ individual checks**. The harness prints the denominator (`surfaces visited / surfaces in manifest`) and treats any unvisited surface as a failure. A missing row can never be mistaken for a pass.

**Evidence rules:**

- Automated check → a JSON record with surface, gate, fixture, viewport, expected, actual, artifact path.
- Visual check → a screenshot at the stated width, reviewed, with a verdict.
- Behavioural check → a scripted interaction with a post-condition (URL, visible state, store value, reload result).
- No "looks fine" without a screenshot; no "tested" without the command that ran it.

---

## 2. Gates

| Gate | Question | Pass rule |
| --- | --- | --- |
| **G1 Loads** | Does the surface render with the intended state? | Route resolves, `[role="main"]` present, expected sentinel text visible, not Expo's dev sitemap or a blank screen |
| **G2 Console** | Is the console clean? | 0 console errors, 0 page errors, 0 failed network requests (fonts, SFX, manifest, SW) |
| **G3 Axe** | WCAG 2.2 AA? | 0 violations, tags `wcag2a/2aa/21a/21aa/22aa` |
| **G4 Semantics** | Names, roles, states, structure? | Non-empty accessible name containing the visible label; correct role/state (`aria-checked`, `aria-pressed`, `aria-expanded`); one `main`, real headings; no nested interactive; no focusable `aria-hidden`; icon glyphs hidden; `ariaSnapshot()` captured |
| **G5 Targets** | Can it be hit? | Every interactive node ≥44×44 CSS px, not clipped, not covered (checked with `elementFromPoint`) |
| **G6 Keyboard** | Can it be driven without a mouse? | Reachable in order, visible focus ring, Enter/Space activate, Escape closes overlays, focus trapped in sheets and restored to the opener, no hover-only affordance |
| **G7 Layout** | Does it fit? | Document overflow ≤1 px at every width; no element past the viewport; no clipped text (`scrollWidth > clientWidth`); no overlap with app bar, tab capsule or sheet footer |
| **G8 Visual** | Does it obey the design language? | Screenshot reviewed against `docs/design-language.md`: token spacing/radii/type, fills not borders, allowed borders only, no raw colour |
| **G9 Motion** | Is movement honest and optional? | Entrance completes; with `reduce`, 0 nodes change between 80 ms and 1.28 s; CLS ≤0.1; splash leaves no 3 px overflow |
| **G10 Data truth** | Do the numbers mean what they say? | Every displayed count recomputed independently from the fixture and matched |
| **G11 Persistence** | Does it survive? | Reload, browser back/forward and direct deep link restore the same state |
| **G12 Failure** | Is the failure state honest? | Empty / loading / corrupt / missing-param states explain the real cause and offer a recovery action; no data loss |

---

## 3. Fixtures

| ID | Fixture | Contents |
| --- | --- | --- |
| F0 | Fresh install | Seed library from `data/seed.ts` |
| F1 | Emptied library | Wipe via `/dev`; must never re-seed |
| F2 | Edge library | Nested folder, empty folder, archived deck, empty deck, 40-char folder name, RTL Persian deck, 47 cards across all four FSRS states, 33 reviews over 13 days, one game record |
| F3 | Dev fixture | `buildDevLibrary()` via `/dev` → Load test library (statistics, quiz records) |
| F4 | Heavy library | 100 decks × 50 cards (scroll, counts, perf) |
| F5 | Corrupt storage | Invalid JSON in `memory:decks` / `memory:cards:all` |
| F6 | Read/write failure | `localStorage.getItem` throws for `memory:decks`; quota exceeded on write |

Each fixture is injected through `page.addInitScript` before app code, one context per fixture, and **asserted present** before any measurement — otherwise a spec can silently pass by measuring an empty screen.

---

## 4. Phases

### Phase 0 — Preflight (½ day)

- [x] Record the commit SHA and branch in the report header.
- [x] `npm ci`; confirm `package-lock.json` is unchanged.
- [ ] `npx playwright install chromium firefox webkit`; if system libs are missing, install them or record the limitation and fall back to Chromium + cloud browser — never report an engine as green without a run.
- [x] Start the server on a **pinned** port (3005 here — this chat’s reserved preview port; 8081 is the repo default) with output to a log; wait for `/` to return 200 and the bundle to compile.
- [ ] Verify every harness uses the same `BASE_URL`; the README says 8082, Playwright defaults to 8081 — pin it explicitly for every command.
- [x] `/dev` → Load test library; assert `deck-german-a2b1` and the folder fixture exist.

**Acceptance:** server up, fixtures load, `npx playwright test --list` enumerates the suites.

### Phase 1 — Static gates (1 hour)

- [x] `npx tsc --noEmit` → 0 errors.
- [x] `npm run check:design` → clean, record the file count.
- [x] `npm test` → all pass, record pass/fail counts.
- [x] `npm run build:web` → `dist/` builds; no errors hidden by warnings.

**Acceptance:** four commands exit 0; numbers recorded in the report.

### Phase 2 — Manifest and route parity (½ day)

- [x] Create `tests/ui/surfaces.ts` with all 83 entries: id, path or trigger, fixture, applicable gates.
- [x] Add a manifest spec that walks `app/**/*.tsx`, derives the route list, and **fails when a route has no manifest entry** or an entry has no fixture.
- [ ] The harness prints `surfaces visited / total`; a skipped surface is a failure, not a skip.

**Acceptance:** route diff 0; deleting one manifest row makes the suite fail. This is what keeps "everything" true when someone adds a route later.

### Phase 3 — Fixtures and isolation (½ day)

- [x] Implement F0–F6.
- [x] Reset storage between surfaces; no state leaks between checks.
- [x] Assert the fixture sentinel before measuring.

**Acceptance:** each fixture shows its expected sentinel; F5 and F6 show the intended fallback, not a blank page.

### Phase 4 — Node census: every element (1 day)

For **every interactive node on every surface**, assert:

- [x] Accessible name non-empty and contains the visible text (WCAG 2.5.3).
- [x] Valid role; no `button` inside `button` or other nested interactive.
- [ ] State attribute present where the control has state (`switch` → `aria-checked`, filter chip → `aria-pressed`, folder → `aria-expanded`, selected row → `aria-pressed`). *(Explicit-role states only: switch/checkbox/radio/tab/combobox. The disclosure row now has `aria-expanded`; filter-chip and folder states remain open.)*
- [x] ≥44×44, unobscured, inside the viewport.
- [ ] In tab order; visible focus ring; activation works; Escape where applicable. *(Tab order and focus ring are measured; activation and Escape are not automated yet.)*
- [x] No duplicate ids, no focusable `aria-hidden` node.
- [x] Icon-font glyphs are `aria-hidden` (the v2.2.1 regression).

Also store an `ariaSnapshot()` per surface as reviewed text. **84/84 snapshots written** (`audit/census/*.aria.yml`).

**Acceptance:** 100% of nodes pass, per-surface node counts recorded, 0 axe nodes.

**Status:** **node-census acceptance met on 2026-11-07** — 83/83 surfaces, 974 nodes, 0 node findings, 0 axe nodes, 84 snapshots. Activation/Escape and the filter-chip/folder state checks remain Phase 5/6 work. See the fix run log.

### Phase 5 — Behavioural flows: every control family (1½ days)

Script one flow per control family in Appendix B, each ending in a reload to prove persistence:

- [x] Deck: create → validate → save; rename; file into folder; pin; move; archive; duplicate; reset progress; delete (with confirmation). *(All scripted and reloaded, export included: the downloaded JSON is parsed and both card faces are asserted.)*
- [x] Folder: create; duplicate-name rejection; rename; icon/colour; nest; re-parent; move up/down; pin; delete (children move up, decks survive). *(All scripted and reloaded, including a parent deletion that re-parents its child folders to the root.)*
- [x] Card: add with both faces; validate empty; colour; edit; delete; long text. *(All scripted and reloaded; long-text growth is measured in `group-a.spec.ts`, not duplicated here.)*
- [x] Study: reveal; all four ratings; requeue; stable denominator; completion; empty deck; keyboard Space/1–4; TTS. *(All scripted and reloaded; TTS runs against a stubbed Web Speech API and asserts both configured languages and the spoken front/back text. The real voice engine belongs to Phase 9.)*
- [x] Quiz: correct; wrong + reveal; combo; timer warning; round end; play again; cleared bonus; unplayable deck; result focus trap and restore. *(Six flows scripted: wrong + reveal + review log, combo, clock warning, cleared bonus + Play again, unplayable deck, and answer → clock round end → persisted record. Result focus stays in `quiz-result.spec.ts`.)*
- [x] Discover: list → detail → import → opens the deck → appears on Home. *(Scripted and reloaded.)*
- [x] Settings: each toggle persists; algorithm presets; TTS languages; offline; install prompt. *(All scripted and reloaded, including the offline cache and a dispatched `beforeinstallprompt`.)*
- [x] Navigation: every row/button/link, browser back/forward, direct deep link, unknown route. *(Settings rows, all three tabs, back fallback, close-to-Library, unknown route, browser back and forward are scripted. Deck/folder options and the remaining rows are the triggers of the flows above.)*
- [x] Sheets: open, Escape, scrim click, focus trap, focus return for every sheet. *(13 variants scripted here: 9 screen-opened sheets through one table, the Folders sheet's scrim and Escape, its in-place edit mode, and the two algorithm sheets that need a second deck. `group-a.spec.ts` owns the deck-options and discard cases, `quiz-result.spec.ts` the result dialog. Sheets whose opener unmounts are exercised by the flow that opens them; focus restore has no stable target there and is not asserted.)*

**Acceptance:** every unique control has at least one scripted action, or is documented as decorative with a reason.

**Status:** **acceptance met on 2026-11-07** — 42 flows pass in 3.8 min on the rebuilt dev bundle, each ending in a visible state or a reload read from storage. The remaining limits are recorded, not hidden: TTS is a stubbed Web Speech API, long-text growth lives in `group-a.spec.ts`, and sheets opened from another sheet do not assert focus restore. See the Phase 5 follow-up 4 run log.

### Phase 6 — Responsive and visual (1 day)

- [ ] Widths 320/375/390/431/768/1024/1280/1440; no document overflow >1 px; no element past the viewport; no clipped text.
- [ ] Fixed chrome: app bar, tab capsule and sheet footers never cover content; `tabClearance` holds at 320.
- [ ] Screenshots at 320 and 390 for all 83 states, plus 768/1280/1440 for the 20 routes.
- [ ] Review each capture against the design language: allowed borders only, token spacing/radii, type scale, fills not outlines.
- [ ] 200% zoom on all 20 routes: no overflow, no clipped deck/folder names, type roughly doubles.

**Acceptance:** 0 overflow, 0 clipped, every capture has a verdict.

### Phase 7 — Data truth and persistence (1 day)

- [ ] Home due counts equal `buildStudyQueue` totals per deck and library-wide.
- [ ] Deck counts, new/learning/review split, study denominator, statistics totals, streak, XP and badges all recomputed from the fixture.
- [ ] Folder counts: document the intended direct-vs-nested semantics and assert the UI matches it.
- [ ] Deletion cascades: deck → cards, log, game record; card → its log; reset → deck log.
- [ ] Reload/deep link/back restore the same state; archived decks stay out of due counts.

**Acceptance:** every displayed number has an independent computation that matches; any mismatch is logged as a defect with a root cause, not just a symptom.

### Phase 8 — Motion and performance (½ day)

- [ ] `node scripts/reduced-motion.mjs`: 0 node changes with `reduce`; the `no-preference` control must move.
- [ ] LCP ≤2.5 s local, TBT ≤200 ms, CLS ≤0.1, long tasks reported; repeat with 4× CPU throttle and Slow 3G.
- [ ] Fonts: Inter, Vazirmatn and MaterialIcons loaded before first meaningful paint; no invisible text; no shift on swap.
- [ ] Splash dissolve produces no horizontal overflow or flash.

**Acceptance:** thresholds met or an explicit, justified exception recorded.

### Phase 9 — Cross-browser, PWA, production build (1 day)

- [ ] Chromium/Firefox/WebKit: 20 routes × 320/1440 — axe, overflow, targets, focus, 200% zoom.
- [ ] `backdrop-filter` fallback, `:focus-visible`, `rem` scaling behave in all three.
- [ ] PWA: manifest fields and icons, theme colour, service worker registers, offline reload serves the app, cache version invalidates old bundles.
- [ ] Serve `dist/` statically and test deep links (`/deck/x`, `/study/x`); record whether the host needs a rewrite rule instead of pretending the dev server is the shipped artifact.

**Acceptance:** 0/0/0/0/0 per engine or a documented engine-specific defect; offline and deep links verified.

### Phase 10 — Edge content and failure states (½ day)

- [ ] RTL Persian front/back: `dir`, bidi isolation, Vazirmatn, no clipped glyphs.
- [ ] 40-char folder cap, 500-char card text, emoji/CJK, whitespace-only input, duplicate names, 0 cards, 0 reviews, 1000-card scroll.
- [ ] Unknown `deckId`, deleted deck mid-session, `/settings/algorithm-advanced` without `deckId`, corrupt JSON, read failure, write failure, offline mid-review.
- [ ] Each failure: honest copy, a recovery action, no blank screen, no data loss.

**Acceptance:** every failure state has a screenshot and an assertion.

### Phase 11 — Regression suite and baselines (½ day)

- [ ] Extend `tests/e2e/a11y.spec.ts` from 12 routes to all 20 (currently missing discover, discover detail, add-card, algorithm-advanced, dev, not-found, quiz, and the redirect root).
- [ ] Extend `tests/e2e/visual.spec.ts` beyond home/library/deck/settings to study, quiz, discover, profile, add-card and the settings subpages.
- [ ] Retarget or delete `scripts/verify-mydecks-box.mjs` — it measures the unmounted `DeckLibrary`, so its result is not evidence either way.
- [ ] Regenerate baselines intentionally, review every diff, commit Linux baselines only and leave the Darwin set untouched.
- [ ] Run the full set: typecheck, design tokens, unit tests, Playwright, audit, cross-browser, reduced-motion, verify scripts.

**Acceptance:** all green, with no stale script counted as a pass.

### Phase 12 — Report (½ day)

Write `docs/ui-verification-2026-11-06.md` with: commit and environment, the coverage denominator, per-gate totals, the defect table, before/after measurements, and limitations.

Defect row format, matching the changelog's existing style:

| ID | Sev | Surface | Symptom | Root cause | Evidence | Fix | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |

---

## 5. Exit criteria

- 83/83 surfaces visited; 0 unaccounted rows.
- 0 axe violations, 0 console/page errors, 0 overflow, 0 controls under 44 px across gated surfaces.
- Every defect is fixed or explicitly deferred with severity and reason.
- All 20 routes exist in the manifest **and** the a11y suite.
- Production export and PWA offline verified; all three engines measured.
- Report committed with limitations listed (no real screen reader, no native target, no physical device).

If the pass is time-boxed, ship all 20 routes plus the primary states and label the report **partial** — never "everything checked".

---

## Appendix A — Surface inventory (83)

- **Shell (5):** SH-01 boot splash · SH-02 storage-load error · SH-03 tab capsule (active lens, drag, 320) · SH-04 unknown route · SH-05 document head/PWA shell.
- **Home (13):** HM-01 loading skeleton · HM-02 empty library · HM-03 hero due>0 · HM-04 hero due=0 · HM-05 shelf root · HM-06 folder opened · HM-07 empty folder · HM-08 folders sheet list/create · HM-09 create validation error · HM-10 folder edit · HM-11 folder move · HM-12 deck options sheet · HM-13 long/RTL/40-char at 320.
- **Library (4):** LB-01 lobby · LB-02 no playable deck · LB-03 selection + best record · LB-04 deck under four cards.
- **Settings (9):** ST-01 index · ST-02 study · ST-03 game toggles · ST-04 data/offline/install · ST-05 algorithm · ST-06 algorithm advanced (with and without `deckId`) · ST-07 TTS · ST-08 offline · ST-09 direct-load child route fallback.
- **Deck (9):** DK-01 default · DK-02 no cards · DK-03 archived · DK-04 search no match · DK-05 colour filter · DK-06 card context expanded · DK-07 options sheet · DK-08 long/RTL at 320 · DK-09 long ledger scroll.
- **Composer (6):** AC-01 empty validation · AC-02 both faces · AC-03 colour · AC-04 editing existing card · AC-05 unsaved draft · AC-06 long text.
- **Study (8):** SD-01 front · SD-02 answer + ratings · SD-03 rate/requeue · SD-04 progress denominator · SD-05 complete · SD-06 empty deck copy · SD-07 keyboard · SD-08 TTS.
- **Quiz (9):** QZ-01 start · QZ-02 correct · QZ-03 wrong + reveal · QZ-04 combo · QZ-05 under 10 s · QZ-06 result overlay · QZ-07 play again · QZ-08 cleared bonus · QZ-09 unplayable/deleted deck.
- **Statistics (9):** TX-01 empty · TX-02 populated · TX-03 range switch · TX-04 top · TX-05 memory · TX-06 habits · TX-07 forecast · TX-08 insights · TX-09 reports.
- **Profile (3):** PR-01 no reviews · PR-02 populated · PR-03 badge rail at 320.
- **Discover (5):** DS-01 list · DS-02 detail · DS-03 import · DS-04 imported deck on Home · DS-05 deep link.
- **Other (3):** AD-01 new-deck sheet (form, validation, direct load) · MI-01 mass-import planned state · DV-01 dev load/restore/wipe.

---

## Appendix B — Control families and where they get exercised

Buttons (all variants, sizes, disabled, destructive) → add-deck, folder sheet, study, quiz result, discover, settings · IconButtons → app bars, sheet close, row options · Chips → library picker, deck filters · Toggles → settings · SearchBar/Field → library, deck ledger, add-deck, folder name · SegmentedControl → statistics range, algorithm presets · Stepper → algorithm settings · ListRow → settings, folder sheet, deck options, discover · RadioOptionCard → algorithm advanced · FlashcardView → study, composer preview, expanded context · RatingButtonRow → study · QuizAnswer → quiz · Pills/badges/charts → deck, statistics, profile · Skeletons/splash → loading states · Tab capsule → every tabbed route.

---

## Appendix C — Known traps that must not be counted green

1. **Port drift:** README says 8082, Playwright defaults to 8081. Pin `BASE_URL`.
2. **Specs passing on empty seed:** without an assertion that `deck-german-a2b1` exists, a whole suite can pass against an empty library.
3. **`audit.mjs` skips most routes above 500 px** — its 52 combinations are not full coverage.
4. **`a11y.spec.ts` covers 12 of 20 routes**; the missing eight are the ones most likely to break.
5. **Visual baselines cover four routes**; study, quiz, discover, profile and the settings subpages have none.
6. **`verify-mydecks-box.mjs` is stale:** it measures the unmounted `DeckLibrary`, so neither its pass nor its failure is evidence.
7. **Evidence is gitignored:** `audit/`, `screenshots/` and `/artifacts/` are ignored, yet the changelog cites `audit/REPORT.md`. The report summary must live under `docs/`.
8. **Light colour scheme is not a defect:** the app is dark-only by design; assert `color-scheme: dark`, don't fix it.
9. **`starterDecks.json` `cardCount` is fiction:** the UI must count preview cards.
10. **Playwright may lack system libraries:** record that limitation instead of claiming a run.
11. **Statistics needs F3:** without the dev fixture, forecast, insights and reports are untested.
12. **Quiz audio needs a user gesture:** silence before the first tap is expected behaviour.
13. **Sheets are also routes:** test both opened-from-UI and direct URL.
14. **Darwin vs Linux snapshots:** regenerate only the platform you measured.
15. **Open issues from the 2026-11-06 report** must appear as regression rows: P4 archived-deck study entry, P5 nested folder counts, P6 mass-import stub, P7 rating accessible names, P9 missing-`deckId` copy, P10 badge rail clipping. P1–P3 look fixed in code but still need re-measurement.


---

## Phase 0 run log — 2026-11-06

- Commit `5261900a136689dcbb3c19e143f0865dca47f83d` on `freebuff/db297ac617afc70bf8a81348`.
- Runtime: Node v26.13.0, npm 11.20.0 (Expo SDK 58 requires Node.js 22.13+).
- `npm ci`: exit 0, 643 packages, `package-lock.json` unchanged.
- Dev server: `CI=1 BROWSER=none npx expo start --web --port 3005`, HTTP 200, listener `*:3005`.
  Port 3005 is this chat’s reserved preview port; the repo default is 8081 and the README says 8082.
- Fixture (Cloud browser, Chromium, 390×844, dark): `/dev` → **Load test library**.
  6 decks (`deck-german-a2b1`, `deck-empty`, `deck-archived`, `deck-longname`, `deck-persian`, `deck-due`);
  4 folders (`fold-de` → `fold-lang`, `fold-empty`); 47 cards total; 30 in the main deck, 0 in the empty deck;
  33 review entries; `bestScore: 9`; `ttsFrontVoiceLang: de-DE`; `memory:initialized = 1`.
- Home after load: hero reads `40 cards due` / `Next up · Schritt Plus Neu A2/B1`, no empty state.
  Reload lands on `/home` with all 6 decks and the main deck still rendered.
- **Local Playwright is blocked.** Chromium is installed project-locally (`PLAYWRIGHT_BROWSERS_PATH=0`), but the host
  lacks `libnspr4`, `libnss3`, `libnssutil3`, `libatk-1.0`, `libatk-bridge-2.0`, `libatspi`, `libXcomposite`, `libXdamage`,
  `libXfixes`, `libXrandr`, `libxkbcommon`, `libasound`; there is no root/sudo and no apt package index.
  Firefox and WebKit are not installed. Phases 4–6 need an unprivileged `.deb` side-load with `LD_LIBRARY_PATH`,
  or the Cloud browser tooling; this must be resolved before claiming automated coverage.
- Console during the run: `manifest.json` → 403 on every load (preview proxy), plus Expo’s
  `apple-mobile-web-app-capable` deprecation warning. Re-check both against a real `dist/` build in Phase 9;
  neither is counted as a pass, and the 403 is not treated as an app defect while it is proxy-specific.
- Live finding, reproduced: the root shelf says `3 folders · 2 decks · 4 cards · 4 due` while the hero says
  `40 cards due · Across 4 decks`, and `Languages` (which holds `German`, 2 decks) reads `0 decks`. This is P5
  from `docs/test-report-2026-11-06.md`, still open.
- Evidence: fixture assertion script at `artifacts/phase0/fixture-check.mjs` (runs once Playwright can launch);
  no screenshots taken.


---

## Phase 1 run log — 2026-11-06

- `npx tsc --noEmit`: exit 0, **0 errors**.
- `npm run check:design`: exit 0, **clean (82 files checked)**.
  The changelog last recorded 65 files; the doc count is stale, the guard is not.
- `npm test`: exit 0, **161 pass / 0 fail / 0 skipped** in 605.7 ms.
  The changelog records 41 tests; the suite has grown, so its numbers are stale.
- `npm run build:web`: exit 0, `Exported: dist`, **15 MB**.
  Route chunks exist for `+not-found`, `add-card`, `add-deck`, `algorithm`, `algorithm-advanced`,
  `dev`, `home`, `library`, `mass-import`, `offline`, `profile`, `settings`, `statistics` and `tts`.
  `entry-*.js` is 1.1 MB uncompressed; no budget judgement yet — Phase 8 measures it.
  `dist/` contains `index.html`, `manifest.json`, `sw.js`, the icon set and all four fonts.
  This confirms the dev `/manifest.json` 403 from Phase 0 is a dev/preview-proxy artefact,
  not a missing asset in the production export.
- `git status --porcelain`: only untracked harness output (`.ui-verify/`) and the new plan file.
  No source or lockfile drift.
- Note: `npm ci` reported 8 moderate vulnerabilities; dependency audit is not a Phase 1 gate.


---

## Phase 2 run log — 2026-11-06

- Added `tests/ui/surfaces.ts`: **83 surfaces** over **20 route patterns**, 7 fixtures and 12 gates.
- Added `tests/ui/route-parity.test.ts`, run by `npm run test:surfaces` under `node:test`.
- `npm run test:surfaces`: **11/11 pass** (160.6 ms).
  - routes: **20/20 mapped**, 0 unmapped, 0 declared-but-missing.
  - fixtures: `F0=18 F1=4 F2=39 F3=20 F4=1 F5=1 F6=1` — all seven exercised.
  - gates: `G1=83 G2=83 G3=80 G4=83 G5=80 G6=81 G7=83 G8=83 G9=81 G10=77 G11=79 G12=82` — all twelve exercised.
  - overlays: 8, each naming its trigger.
- `npx tsc --noEmit`: **0 errors**.
- **Correction found by the guard:** the original 82-surface inventory had no entry for `app/add-deck.tsx`.
  `AD-01` was added, so the denominator is **83**. The surface table, Phase 2 step, Phase 6 screenshot count,
  exit criterion and Appendix A were updated; the “Other” group now holds AD-01, MI-01 and DV-01.
- The guard fails when a route file has no entry, an entry names a missing route, the declared route list drifts,
  a surface has no fixture/gate, or an overlay has no trigger. The exact-count assertion is what makes deleting
  one manifest row fail the suite.
- **Still open in Phase 2:** the “visited / total” print belongs to the execution harness (Phase 4).
  The parity guard prints the denominator (`surfaces: 83`, `routes: 20/20`), not visits.
- `package.json` gained only `test:surfaces`; `npm test` remains data-only.

---

## Phase 3 run log — 2026-11-06

- Added `data/storageKeys.ts`; `data/repository.ts` now reads those keys, so a fixture cannot seed a key the app does not read.
- Added `tests/ui/fixtures.ts`: F0–F6 builders, `fixtureInitScript()` for pre-boot injection, `installFixture()` (reset + sentinel), `assertFixtureSentinel()` and `countsFromEntries()`.
- F2 and F3 share the same 47-card / 33-review base: F2 adds the 40-character folder, F3 is exactly what `/dev` writes.
- Added `tests/ui/fixtures.test.ts` and `npm run test:fixtures`.
- `npm run test:fixtures`: **14/14 pass**.
- `npm run test:surfaces`: **11/11 pass**.
- `npx tsc --noEmit`: **0 errors**.
- Browser sentinels (Cloud browser; temporary `/__fixtures__` JSON, removed after the run):
  - F0: 1 deck, 1,817 cards, initialized; shipped deck visible.
  - F1: 0 decks, 0 cards, initialized; “No decks yet”.
  - F2: 6 decks, 47 cards, 5 folders, 33 reviews; the 40-character folder exists; deck and “Nothing here yet” visible.
  - F4: 100 decks, 5,000 cards; “Heavy deck 001” visible.
  - F5: both corrupt JSON strings survived boot; 0 decks; “No decks yet” — no blank page and no seed overwrite.
  - F6 read failure: “Couldn’t open your library” and “Try again” rendered.
  - F3: `/dev` → Load test library was verified in Phase 0 at 6 decks / 47 cards / 33 reviews / 4 folders; the Phase 3 unit test asserts the same entries.
- F6 write failure: the pre-boot script throws `QuotaExceededError` for `memory:decks` and is unit-tested; no UI fallback was exercised. Phase 4 G12 must classify it.
- The pre-boot init script is unit-tested against a Storage-like object; the F6 browser run used the equivalent late patch plus a store reload, not a full pre-boot injection.
- Observation for Phase 4: a uid pointer click on “Load test library” landed on an empty DIV and did not fire; a DOM click did. Decide whether the splash/overlay leaves a real hit-target defect.
- Still open from Phase 0: Home reads “Across 4 decks” while F2 has 6 decks (and 5 folders). G10 must pin the intended denominator.


---

## Phase 4 run log — 2026-11-06

**Status: harness built and full walk executed; acceptance not met.**

- Added `tests/ui/census-plan.ts` (surface → URL, fixture, actions, state) and `scripts/census.mjs`
  (Playwright walk, node scanner, axe, per-surface aria snapshots, JSON report).
- Added `npm run census` and `npm run census:dry`.
- `npm run census:dry`: **83 surfaces, 84 targets, 0 missing, 0 duplicate targets, PASS**.
  SH-02 has two targets (F5 read-failure path and F6 corrupt path).
- **Full run: 83/83 surfaces visited, 84/84 targets, 0 unvisited, exit 0.**
  974 interactive nodes measured. States: `base=53`, `triggered=23`, `not-automated=8`.
- The default exit fails only on unvisited rows or browser errors; `--strict` additionally fails on node/axe findings.
  A 79/83 intermediate run exited 1 with `CENSUS=FAIL_UNVISITED`, proving a missing row cannot pass silently.
- **56 node findings, collapsing to 16 unique controls:**
  - `G5-obscured` 26: long folder row/options on SH-03, four icon radios and their search field on HM-08,
    long deck row on LB-01, Profile row on ST-01. The folder-options click is also intercepted on HM-10/HM-11;
    those runs record a `pointerFallbacks` entry and use a DOM click to continue.
  - `G5-target-44` 12: `Search icons` 306×22 (HM-08) and `Search cards` 240×22 (DK-01, repeated on the deck surfaces).
  - `G4-name-contains-text` 8: algorithm radio cards (ST-05) and `Hide example and synonyms` (AC).
  - `G6-focus-ring` 10: composer textareas `Front — the prompt` / `Back — the answer` (AC).
  - No duplicate ids, no focusable `aria-hidden` nodes, no exposed icon glyphs (0/0/0).
- **Axe: 8 nodes** — `button-name` 1 and `nested-interactive` 1 on the SH-02 F6 error toast
  (dismiss button); `label-content-name-mismatch` 6 on `Hide example and synonyms` across AC-01…AC-06.
- Console: 1 error, expected from the F6 fixture (`Failed to load decks: fixture read failure: memory:decks`).
- 84/84 `ariaSnapshot()` files written. Every visited row has a per-surface node count and snapshot path.
- Eight complex states remain explicitly `not-automated`, not skipped:
  SH-01, SH-03, HM-04, DK-02, DK-03, SD-06, DS-05, AD-01.
- Not automated in this pass: activation/Enter/Space, Escape/focus trap/restore, filter-chip `aria-pressed`,
  folder `aria-expanded`. These stay open for Phase 5/6.
- **Acceptance:** per-surface counts recorded **yes**; 84 snapshots **yes**; 100% nodes pass **no** (56 findings);
  0 axe nodes **no** (8). Phase 4 is not complete; the findings above are the Phase 5 input.
- Environment: local Chromium launched with project-local libs
  (`PLAYWRIGHT_BROWSERS_PATH=0`, `PLAYWRIGHT_LIBS_DIR=.ui-verify/phase4/root/usr/lib/x86_64-linux-gnu`).
  `audit/census/report.json` and the snapshots are gitignored evidence.
- `npx tsc --noEmit` after the harness edits: **0 errors**.


---

## Phase 4 fix run — 2026-11-07

**Status: node-census acceptance met.**

- App fixes:
  - `SearchBar` now gives the actual `<input>` a 44px minimum height; the wrapper was 44px but the input measured 306×22.
  - `RadioOptionCard` no longer overrides its accessible name with the title alone. The visible title + description now supply the name, so WCAG 2.5.3 and the scanner agree; no axe mismatch was reported.
  - The “Example & synonyms” row no longer uses the stale `Hide/Show example and synonyms` label. `ListRow` now exposes `aria-expanded`, and the visible row content supplies its name.
  - Composer prompt/answer textareas use a web-only `.composer-input:focus-visible` inset ring (`box-shadow`), while keeping the card’s own focus overlay. Verified computed style: `rgb(124, 187, 255) 0px 0px 0px 2px inset`.
- Harness fixes:
  - The scanner scrolls a control into the centre before judging hit-testing. Rows under the floating tab bar and controls clipped inside a sheet scroll body were previously false `G5-obscured` findings.
  - Overlay actions are scoped to the open `[role="dialog"]`; an unscoped query selected the covered Home row behind the folder sheet and produced the two HM-10/HM-11 pointer fallbacks.
  - Axe excludes Expo’s development LogBox shadow-root `#error-toast`. It is not shipped app UI; the app’s own F6 recovery screen remains measured.
- Restarted the dev server: the old process ran with `CI=1`, which disables watch mode, so source edits were never rebuilt. The fresh server is on port 3005.
- Final full census: **83/83 surfaces, 84/84 targets, 974 interactive nodes, 0 node findings, 0 axe nodes, 0 pointer fallbacks**, 0 focusable-hidden/duplicate-id/icon-glyph findings. 84 aria snapshots written. Console: 1 expected F6 fixture error; page errors: 0.
- Regression checks after the fixes: `npm test` **161/161**, `npm run test:surfaces` **11/11**, `npx tsc --noEmit` **0 errors**, Phase 5 flows **11/11**.
- Remaining outside this acceptance: activation/Enter/Space, Escape for every overlay, cross-browser/production runs, and the Phase 5 family gaps. The node census is Chromium-only on the local Expo server, not a production-build result.

---

## Phase 5 run log — 2026-11-06

**Status: 11 behavioural flows pass; coverage is partial.**

- Added `tests/e2e/flows.spec.ts` (11 tests) and `npm run test:flows`.
- `playwright.config.ts` now skips its 8081 `webServer` when `BASE_URL` is supplied, so the suite reuses the running workspace server.
- Environment: `BASE_URL=http://127.0.0.1:3005`, project-local Chromium
  (`PLAYWRIGHT_BROWSERS_PATH=0`), side-loaded libs via
  `LD_LIBRARY_PATH=.ui-verify/phase4/root/usr/lib/x86_64-linux-gnu`.
  `npm ci` restored dependencies; `npx playwright install chromium` restored the binary removed by the fresh install.
- `npx playwright test tests/e2e/flows.spec.ts --project=chromium`: **11/11 pass** (1.0 min).
- `npx tsc --noEmit`: **0 errors**.
- Covered and reloaded: deck create/delete/rename, folder create/duplicate rejection/rename/icon/colour/pin/delete,
  deck move into a folder and deck survival after folder deletion, card add/colour/edit/delete,
  four study ratings and review-log persistence, quiz answer/round-end/game-record persistence,
  Discover list→detail→import→Home, settings sound/fuzz/TTS language persistence, tab/back navigation,
  and folder-sheet Escape/focus return.
- Not covered: deck pin/archive/duplicate/reset/export/reorder; folder nest/re-parent/reorder;
  card long-text growth in this suite; study requeue/denominator/completion/empty/TTS;
  quiz wrong path/combo/warning/play-again/cleared-bonus/unplayable; remaining settings toggles/offline/install;
  all navigation rows/links/forward/unknown route; every sheet's scrim and focus cycle.
- Existing focused specs (`group-a`, `keyboard`, `quiz-result`, `hints`) were not rerun in this pass; the new suite
  references their coverage instead of duplicating it.
- **Acceptance:** every unique control scripted? **No** — the family-level inventory above is partial. Phase 5 is not complete.
- No app source was changed; the worktree additions are the flow spec, config switch, and package script.

---

## Phase 5 follow-up — 2026-11-07

**Status: 13/13 flows pass; coverage is still partial.**

- Added two management flows to `tests/e2e/flows.spec.ts`:
  - Folder nesting and re-parenting: create a parent and child, move the child under the parent, reload and open the parent, then move the child back to the top level and assert the stored `parentId` is null.
  - Deck pin, duplicate and archive: pin from the Home row, reload, duplicate from the deck options, then archive the original and assert the copy remains while the original is stored with `archivedAt`.
- Removed the old `domClick` workaround from the folder flows now that the Phase 4 pointer fix is in place; normal pointer activation is exercised.
- Command: `LD_LIBRARY_PATH=.ui-verify/phase4/root/usr/lib/x86_64-linux-gnu`, `PLAYWRIGHT_BROWSERS_PATH=0`, `BASE_URL=http://127.0.0.1:3005`, `npx playwright test tests/e2e/flows.spec.ts --project=chromium`.
- Result: **13/13 pass**, including the two new management flows.
- Still open: deck export; card long text in this suite; study requeue/denominator/completion/empty/TTS; quiz wrong/combo/warning/play-again/cleared/unplayable; settings offline/install and remaining toggles; navigation rows; every sheet's scrim/focus cycle; nested child-folder re-parenting on delete.

---

## Phase 5 follow-up 2 — 2026-11-07

**Status: 17/17 flows pass; coverage is still partial.**

- Added four flows:
  - Folder move down, reload, move back up, reload; asserts root sibling order `A/C/B` then `A/B/C`.
  - Deck move up, reload, move back down, reload; asserts the stored order changes both ways.
  - Reset progress after one real study rating; asserts the deck's review log is empty and every card returns to `New`, including after reload.
  - Unknown route renders “This page moved on”, returns to Game, and browser back/forward restores Home then the deck detail.
- Two test-only corrections during the run: root folders may store no `parentId` (treat nullish as root), and `Move up` must be matched exactly because the delete-folder subtitle contains “move up one level”. Neither was an app defect.
- Command: `LD_LIBRARY_PATH=.ui-verify/phase4/root/usr/lib/x86_64-linux-gnu`, `PLAYWRIGHT_BROWSERS_PATH=0`, `BASE_URL=http://127.0.0.1:3005`, `npx playwright test tests/e2e/flows.spec.ts --project=chromium`.
- Result: **17/17 pass** (1.8 min); `npx tsc --noEmit` **0 errors**.
- Remaining: deck export; study TTS; quiz wrong/combo/warning/play-again/cleared/unplayable; settings offline/install; navigation rows; every sheet's scrim/focus cycle; nested child-folder re-parenting on delete.

---

## Phase 5 follow-up 3 — 2026-11-07

**Status: 19/19 flows pass; coverage is still partial.**

- Fixed a real empty-deck copy defect in `app/study/[deckId].tsx`: a deck with no cards used to say “All done / You have completed every due card”, which claims work that never existed. It now says “No cards yet”, explains how to start, and offers **Add cards**; a non-empty caught-up deck still says “All done”.
- Added two Study flows:
  - A controlled two-card deck is created through the UI. Rating `Again` re-enters the learning queue; the header stays `2 / 2` instead of growing the denominator. The session then reaches “All done”, and the review log survives reload.
  - A newly created empty deck shows the new empty state, the **Add cards** action opens the composer, and a reload still shows “No cards yet”.
- Restarted the Expo server for the source change (the server runs with `CI=1`, so it has no watch mode).
- Command: `LD_LIBRARY_PATH=.ui-verify/phase4/root/usr/lib/x86_64-linux-gnu`, `PLAYWRIGHT_BROWSERS_PATH=0`, `BASE_URL=http://127.0.0.1:3005`, `npx playwright test tests/e2e/flows.spec.ts --project=chromium`.
- Result: **19/19 pass** (2.1 min); `npx tsc --noEmit` **0 errors**; `npm test` **161/161**.
- Remaining: deck export; study TTS; quiz wrong/combo/warning/play-again/cleared/unplayable; settings offline/install; navigation rows; every sheet's scrim/focus cycle; nested child-folder re-parenting on delete.

---

## Phase 5 follow-up 4 — 2026-11-07

**Status: Phase 5 acceptance met.**

- Grew `tests/e2e/flows.spec.ts` from 19 to **42 flows**: deck export (parsed JSON download), child-folder re-parenting on parent delete, study TTS (front/answer languages and text), quiz coverage now spanning six flows, three settings batches (remaining toggles, back voice, algorithm preset, adaptive order, shuffle, offline cache, install prompt), three navigation flows (settings rows, tabs/fallback, unknown route + forward), two sheet flows (scrim, Escape) and a table that drives nine more sheets.
- Every flow ends by reading the persisted store after a reload or by asserting the visible post-condition; none asserts a click alone.
- **Defect found and fixed (G6):** switching the Folders sheet into edit mode unmounted the row options control that had focus, so focus fell to `<body>` while the dialog stayed open. `BottomSheetModal` now accepts `focusKey`; changing it while the sheet is open re-runs focus management and keeps the original trigger for the close. `app/(tabs)/home.tsx` passes the folder sheet's mode.
- Test-only corrections (no app defect): root folders may store no `parentId`, so nullish counts as root; `Move up` is matched exactly because another subtitle contains it; folder options are scoped to the open dialog because the Home shelf now renders a second options button behind the scrim.
- Commands: `LD_LIBRARY_PATH=.ui-verify/phase4/root/usr/lib/x86_64-linux-gnu`, `PLAYWRIGHT_BROWSERS_PATH=0`, `BASE_URL=http://127.0.0.1:3005`, `npx playwright test tests/e2e/flows.spec.ts --project=chromium`.
- Results: **42/42 flows pass (3.8 min)** on the restarted bundle (the server runs with `CI=1`, so it was restarted after the component edit); `npm test` **161/161**; `npx tsc --noEmit` **0 errors**; `git diff --check` clean.
- Environment limits: Chromium only on the Expo dev server (cross-browser and `dist/` are Phase 9); TTS uses a stub, not an installed voice; sheets opened from another sheet are exercised by their flow but do not assert focus restore.
