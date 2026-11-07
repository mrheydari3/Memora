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

- [x] Widths 320/375/390/431/768/1024/1280/1440; no document overflow >1 px; no element past the viewport; no clipped text. *(672 measurements = 84 targets × 8 widths, **0 findings**. 28,374 text nodes inspected; 74 ellipsized labels are designed truncation, and the only horizontal rails are the Profile badge belt.)*
- [x] Fixed chrome: app bar, tab capsule and sheet footers never cover content; `tabClearance` holds at 320. *(Tab capsule measured with the main body at max scroll using leaf text: 0 overlaps at every width; no sheet control sits outside the viewport without a scroll path.)*
- [x] Screenshots at 320 and 390 for all 83 states, plus 768/1280/1440 for the 20 routes. *(84 targets → 168 state captures; 20 routes × 3 widths = 60; plus 20 zoom captures. 0 failures.)*
- [ ] Review each capture against the design language: allowed borders only, token spacing/radii, type scale, fills not outlines. *(Sampled: 7 contact sheets / ~40 captures across Home, Deck, Study, Quiz, Settings, Profile and wide routes; all consistent. Remaining captures carry automated verdicts only.)*
- [x] 200% zoom on all 20 routes: no overflow, no clipped deck/folder names, type roughly doubles. *(20/20 clean; heading box scaled 2× on 19 routes and 4× on Deck from extra wrapping.)*

**Acceptance:** 0 overflow, 0 clipped, every capture has a verdict.

**Status:** **measurements and zoom accepted on 2026-11-07**; visual review is sampled, so the “every capture” clause is not yet met. 672/672 responsive measurements and 20/20 zoom routes pass with 0 findings; 248 captures exist under `audit/responsive/shots/` (gitignored).

### Phase 7 — Data truth and persistence (1 day)

- [x] Home due counts equal `buildStudyQueue` totals per deck and library-wide. *(F2: 40 due across 4 decks, recomputed from the stored cards and log; every deck row and folder aggregate matches its own queue.)*
- [x] Deck counts, new/learning/review split, study denominator, statistics totals, streak, XP and badges all recomputed from the fixture. *(Card counts and due/clear labels on rows, hero `10 / 8 / 8`, study `1 / 26`, statistics 33 reviews / 5 decks, Profile 330 XP / level 1 / 13-day streak / 2 of 5 badges.)*
- [x] Folder counts: document the intended direct-vs-nested semantics and assert the UI matches it. *(Direct-only: root `4 folders · 2 decks · 4 cards · 4 due`; Languages reports `0 decks` while German reports `2 decks · 34 cards · 30 due`; both nested deck rows match their queues.)*
- [x] Deletion cascades: deck → cards, log, game record; card → its log; reset → deck log. *(F3 storage asserted after each action; reset also returns every card to New and keeps the deck and game record.)*
- [x] Reload/deep link/back restore the same state; archived decks stay out of due counts. *(Fixture seeds once per context, so reload and deep link read persisted state; the archived deck's 3 cards are excluded from the 40.)*

**Counting semantics (pinned):** Home's hero is library-wide: the sum of `buildStudyQueue` over every active deck, with `Across N decks` counting only decks whose total is above zero. The shelf caption and a folder row describe the level currently open and count only its *direct* children, so a parent folder whose decks live in a child folder reports `0 decks` by design; it is not a nested roll-up. Archived decks are excluded from Home, Library, Profile, Statistics and every due total.

**Acceptance:** every displayed number has an independent computation that matches; any mismatch is logged as a defect with a root cause, not just a symptom.

**Status:** **acceptance met for the enumerated surfaces on 2026-11-07** — 11/11 data-truth tests recompute the values from storage, with 0 app defects found. Limitation: Statistics is asserted at its headline totals, not every intelligence submetric; those remain covered by the analytics unit tests rather than recomputed in this suite. See the Phase 7 run log.

### Phase 8 — Motion and performance (½ day)

- [x] `node scripts/reduced-motion.mjs`: 0 node changes with `reduce`; the `no-preference` control must move. *(4 routes: `reduce` 0 changed, control 84–93 changed, media query matched, 200% zoom 20→40 px.)*
- [x] LCP ≤2.5 s local, TBT ≤200 ms, CLS ≤0.1, long tasks reported; repeat with 4× CPU throttle and Slow 3G. *(Original baseline: Home 812/828/852 ms LCP, TBT 239/220/280 ms, CLS 0.009; TBT exception for the dev bundle. Final Home local: LCP **824 ms**, TBT **252 ms**, CLS **0.0095**; Statistics local: **920 / 316 / 0.0095**. TBT still misses on the development bundle and remains the explicit exception below. Throttled Home: LCP **42.19 s**, TBT **1.903 s**, CLS **0.0903**, FCP **27.41 s**; first painted body text at 42.5 s, splash gone at 43.4 s. Production build belongs to Phase 9.)*
- [ ] Fonts: Inter, Vazirmatn and MaterialIcons loaded before first meaningful paint; no invisible text; no shift on swap. *(Implemented: web `useFonts` is empty and `services/webFonts.ts` registers the six static faces after load with `swap`; 400/700 were copied from the package. The splash no longer gates the navigator on fonts: the route chunk starts at store readiness, is laid out behind the splash, and is revealed when AppSplash sees its structural text; exit waits for painted `innerText`. Final runs show no late face-swap shift: CLS **0.0095** on local Home and Statistics, **0.0903** on throttled Home. The faces are still registered after load rather than treated as a hard font-ready gate, so “loaded before first meaningful paint” is measured here, not enforced.)*
- [ ] Splash dissolve produces no horizontal overflow or flash. *(Not rechecked in this slice. The hand-off timeline is now: throttled Home splash present at 27.2 s → first painted body text at 42.5 s → splash gone at 43.4 s; overflow/flash remain a separate check.)*

**Acceptance:** thresholds met or an explicit, justified exception recorded.

**Status:** **performance accepted on 2026-11-07** — CLS is under budget (Home and Statistics local 0.0095; throttled Home 0.0903), and the splash stays through the first painted body text, closing the 27.4–42.1 s blank frame. TBT remains over budget on the development bundle under the explicit exception; the font “loaded before first paint” wording and splash overflow remain open. See the Phase 8 run log.

### Phase 9 — Cross-browser, PWA, production build (1 day)

- [ ] Chromium/Firefox/WebKit: 20 routes × 320/1440 — axe, overflow, targets, focus, 200% zoom.
- [ ] `backdrop-filter` fallback, `:focus-visible`, `rem` scaling behave in all three.
- [ ] PWA: manifest fields and icons, theme colour, service worker registers, offline reload serves the app, cache version invalidates old bundles.
- [ ] Serve `dist/` statically and test deep links (`/deck/x`, `/study/x`); record whether the host needs a rewrite rule instead of pretending the dev server is the shipped artifact. *(Partial: the export was served with a one-route SPA fallback on 3006; `/home`, `/statistics`, `/deck/deck-german-a2b1` and `/study/deck-german-a2b1` returned 200 text/html. Production local Home/Statistics were measured; actual deck/study route rendering was not. A static host needs the same rewrite fallback.)*

**Acceptance:** 0/0/0/0/0 per engine or a documented engine-specific defect; offline and deep links verified.

**Status:** **partial on 2026-11-07** — production export/local perf verified; cross-browser, PWA/offline and actual deck/study deep-link rendering remain open. See the Phase 9 run log.

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

---

## Phase 6 run log — 2026-11-07

**Status: responsive measurements and 200% zoom accepted; visual review sampled.**

- Added `scripts/responsive.mjs` and `npm run responsive`, reusing the Phase 4 census plan (84 targets over 83 surfaces), its fixtures and its trigger actions, so a surface measured here is the surface the census walked.
- Modes: `measure` (eight widths), `shots` (320/390 per target, 768/1280/1440 per route), `zoom` (640 px viewport with `zoom: 2`, i.e. a 320 px layout painted at 2×), `summary`. Every run appends to `audit/responsive/*.jsonl`, so the pass resumes with `--skip-existing` after a timeout.
- **Measurements: 672 runs (84 targets × 8 widths), 0 flagged.** Per width: 84 runs, 0 flagged. 28,374 text nodes inspected.
- Checks: document overflow ≤1 px; elements past the viewport, excluding descendants of horizontal rails; text clipped without an ellipsis (74 ellipsized labels counted as the designed truncation); a vertical body panning sideways; tab-capsule overlap at max scroll using leaf text; sheet controls outside the viewport with no scroll path.
- 12 intentional badge-rail runs (Profile at 320/375/390/431), classified separately so a designed belt is not reported as a layout defect.
- **Screenshots: 248 captures, 0 failures** — 84 targets × 2 phone widths (168), 20 routes × 3 wide widths (60), 20 zoom captures. Evidence under `audit/responsive/shots/`, contact sheets under `audit/responsive/sheets/`, both gitignored.
- **200% zoom: 20/20 routes clean** (0 overflow, 0 clipped). Heading box scaled 2× on 19 routes; Deck scaled 4× because the title wraps onto more lines at the halved layout width.
- Visual sample reviewed: HM-320, DK-320, SD-320, QZ-320, ST-390, PR-320 and the 1440 route sheet — consistent dark tokens, no clipped labels, rails read as rails.
- Harness corrections during the pass (measurement bugs, not app defects): full-height containers were misread as tab overlap, in-sheet scrolling controls as clipped, and the Profile badge belt as a layout defect. No app source changed in Phase 6.
- Limitations: the census's eight `not-automated` rows (quiz outcomes, study completion, etc.) capture the route's start state, not the end state; visual verdicts cover 7 sheets (~40 captures) while the rest are automated-only; 200% zoom is emulated with a 640 px viewport plus CSS zoom rather than a real browser zoom setting.

---

## Phase 7 run log — 2026-11-07

**Status: Phase 7 acceptance met for the enumerated surfaces; deeper Statistics panels are outside this suite.**

- Added `tests/e2e/data-truth.spec.ts` (11 tests). Every expected value is recomputed from the fixture's stored decks, cards, review log and game records with `buildStudyQueue`, `computeStreak` and independent arithmetic; no expected number is scraped back from the UI.
- Home (F2): hero **40 due / Across 4 decks** equals the sum of every active deck queue (German 26, Long-name 4, Persian 4, Due 6; Empty 0, Archived excluded). The New/Learning/Review rail **10 / 8 / 8** is recomputed from the deck the button continues.
- Shelf semantics: root caption **4 folders · 2 decks · 4 cards · 4 due**; Languages reports **0 decks** because its decks live in the child German folder; German reports **2 decks · 34 cards · 30 due**; both nested deck rows match their own queue totals.
- Profile (F2): 33 active reviews → **330 XP**, level 1, `330 of 1000 XP`; **13-day** streak; **2 of 5** badges, with First Review and 7-Day Streak named. Statistics: **33 reviews** in the default 30-day range and **5 decks**. Study: header **1 / 26** equals the German queue.
- Archived deck: its 3 New cards would raise the hero to 43 if counted; Home and Library keep it out and the hero stays at 40.
- Cascades (F3): deleting German removes the deck, `cards[deckId]`, every log entry for it and `gameRecords[deckId]`; deleting one card removes exactly its log entries and leaves the rest; resetting German returns all 30 cards to `New` (reps 0, no last review), drops the deck log, keeps the deck and game record, and Profile then reads 0 XP / `0 of 5`.
- Persistence: reload and a direct `/deck/persian` → Back return the same hero and shelf caption.
- Harness correction (test-only, no app defect): `addInitScript` was re-seeding the fixture on every document navigation, so a post-reset reload silently restored the old log and could not detect lost state. `boot()` now wraps the fixture script in a per-context `sessionStorage` guard, so only the first load seeds; reload and deep-link assertions read what the app actually persisted. Earlier failures were also test-side: `STORAGE_KEYS` contains a function and cannot cross `page.evaluate`, `More options` needed an exact match, the deck list renders 8 cards before “Show all”, and RN Web concatenates text nodes so `toHaveText` normalisation does not apply.
- Commands: `LD_LIBRARY_PATH=.ui-verify/phase4/root/usr/lib/x86_64-linux-gnu`, `PLAYWRIGHT_BROWSERS_PATH=0`, `BASE_URL=http://127.0.0.1:3005`, `npx playwright test tests/e2e/data-truth.spec.ts --project=chromium`.
- Results: **11/11 pass (37.2 s)**; `npx tsc --noEmit` **0 errors**; `npm test` **161/161** (unit suite; the new spec is Playwright-only). No app source changed in Phase 7, so the dev server was not restarted.
- Limits: Chromium on the Expo dev server only (cross-browser is Phase 9). Statistics is asserted at its headline totals, not every intelligence submetric; those remain covered by the analytics unit tests, not recomputed from the fixture here.

---

## Phase 8 run log — 2026-11-07

**Status: reduced motion accepted; performance measured with an explicit TBT exception; fonts/splash remain open.**

- `node scripts/reduced-motion.mjs` passed unchanged: on Home, Library, Study and Quiz, `reduce` produced **0 changed nodes** (11/15/15/16 sampled), while the `no-preference` control saw **85/85/93/84** changes. The media query matched the emulated preference on every reduced run, and 200% zoom split the sample font size from 20 to 40 px. Evidence: `audit/reduced-motion.json`.
- Added `scripts/perf.mjs` and `npm run perf`. It measures three routes in fresh contexts with the F2 fixture, observers installed before app code: LCP, CLS (no recent input), every >50 ms long task and TBT, paint/navigation timings, resource count and font readiness. `local` is the budget gate; `throttled` applies CDP **4× CPU** and Chrome **Slow 3G** (400 kbps, 400 ms RTT) and is diagnostic, because the Expo dev server ships a development bundle.
- Baseline (9 runs, 390×844): Home **LCP 812 ms / TBT 239 ms / CLS 0.009**; Deck **828 / 220 / 0.009**; Statistics **852 / 280 / 0.009** (medians; worst LCP 880 ms, worst CLS 0.0095). LCP and CLS clear their budgets on all three routes. TBT misses 200 ms on all three, by 20–80 ms; the longest long task was 194–205 ms and each route recorded 11–12 long tasks across the three runs. Evidence: `audit/perf-local.json`.
- TBT exception: the gate runs against `expo start --web` in development mode, not a production bundle; development React, HMR and unminified route work inflate main-thread blocking. The production-build measurement is Phase 9's `dist/` work, and this exception is recorded rather than presenting the dev number as a pass.
- Throttled Home (one cold run): **LCP 67,160 ms, TBT 1,796 ms, CLS 0.0698**, FCP 38,928 ms, first paint 26,024 ms; 6 long tasks, longest 825 ms. This is a degradation reading, not a second budget gate.
- Font finding for the next Phase 8 item: the splash waits for `useFonts`, and at the earlier 53 s collection `fontsStatus` was still `loading`; the longer run reached LCP only at 67.16 s after the font/splash hand-off. The font checkbox is therefore recorded as open, not passed.
- Commands: `PLAYWRIGHT_BROWSERS_PATH=0`, `LD_LIBRARY_PATH=.ui-verify/phase4/root/usr/lib/x86_64-linux-gnu`, `BASE_URL=http://127.0.0.1:3005`, `npm run perf -- --scenarios=local --runs=3 --out=audit/perf-local.json` and `npm run perf -- --scenarios=throttled --routes=home --runs=1 --settle=10000 --lcp-timeout=60000 --splash-timeout=60000 --out=audit/perf-throttled.json`. The baseline command exits 1 while TBT misses its budget; that is the intended signal.
- No app source changed in this slice, so the dev server was not restarted. `scripts/perf.mjs` passes `node --check`; the existing unit suite is unaffected.

### Font decoupling run — 2026-11-07

- Changed the web boot path: `useFonts` now receives an empty map on web, while `services/webFonts.ts` registers six static faces (Inter 400/500/600/700, MaterialIcons and Vazirmatn) from `public/fonts` after each file loads. The four Inter weights and the icon face use `font-display: swap`; native keeps the packaged `useFonts` map. The splash waits only for stores on web, so fonts are no longer a boot dependency.
- Copied `Inter_400Regular.ttf` and `Inter_700Bold.ttf` from `@expo-google-fonts/inter` into `public/fonts` so all four weights have the same static path.
- Throttled Home (4× CPU, Slow 3G, cold context, 10 s settle): **LCP 42,156 ms** (was 67,160 ms; **-37.2%**), TBT 1,905 ms, CLS **0.1601** (was 0.0698), FCP 27,140 ms, first paint 26,116 ms. The LCP element is the Home shelf heading (`h2: Your decks`). The splash leaves at ~27.4 s, but the first contentful text is not present until ~42.1 s; the only large shift is **0.1506 at 42,138 ms**, when the page content arrives. Evidence: `audit/perf-throttled-fonts-final.json`.
- Local Home (3 runs, median): **LCP 808 ms, TBT 276 ms, CLS 0.159**; Statistics (1 run): LCP 856 ms, TBT 316 ms, CLS 0.337. The original local CLS was 0.009; the regression is the same late content/font hand-off, not LCP. Evidence: `audit/perf-local-fonts-home.json`, `audit/perf-local-fonts-statistics.json`.
- Local Deck could not be measured: `chrome-headless-shell` exits with `FATAL:third_party/skia/src/ports/SkFontMgr_FontConfigInterface.cpp:163 Not implemented` because this VM has no `/etc/fonts/fonts.conf`. Blocking font requests did not avoid the crash. This is an environment limitation in the headless browser, not an app result; the deck route was not used to claim a pass.
- Tried `font-display: optional`, a CSS `@font-face` stylesheet, and adding faces before load to remove the shift. The CSS and pre-load variants left every face in `error` state and the page blank in this Chromium; the stable measured state is the after-load `swap` registration above. Those experiments are recorded, not presented as fixes.
- Commands: `PLAYWRIGHT_BROWSERS_PATH=0`, `LD_LIBRARY_PATH=.ui-verify/phase4/root/usr/lib/x86_64-linux-gnu`, `BASE_URL=http://127.0.0.1:3005`, `npm run perf -- --scenarios=throttled --routes=home --runs=1 --settle=10000 --lcp-timeout=60000 --splash-timeout=60000 --out=audit/perf-throttled-fonts-final.json` and `npm run perf -- --scenarios=local --routes=home --runs=3 --out=audit/perf-local-fonts-home.json`.
- Checks: `npx tsc --noEmit` **0 errors**, `npm test` **161/161**, `node --check scripts/perf.mjs` pass, `git diff --check` clean. The app source changed, so the dev server was restarted before every measurement.

### Splash/content gate run — 2026-11-07

- The navigator now mounts as soon as the stores hydrate, so the route chunk loads in parallel with fonts. A web-only wrapper keeps the laid-out route unpainted until `AppSplash` sees structural text in `[data-testid="screen-body"]`; the splash then reveals it, waits for painted `innerText`, and only then starts its fade. The route is never removed from the splash while it is still blank.
- Throttled Home (4× CPU, Slow 3G, cold context, 10 s settle): **LCP 42,188 ms, TBT 1,903 ms, CLS 0.0903**, FCP 27,408 ms, first paint 26,132 ms. The two layout shifts are **0.0095 at 25,727 ms** and **0.0808 at 42,172 ms**; no late font swap shift follows. Timeline: splash present at 27,162 ms with no body text; still present at 42,475 ms with 431 painted characters; gone at 43,444 ms. LCP element is `h2: Your decks`. Evidence: `audit/perf-throttled-final.json`.
- Local Home (final post-cleanup run): **LCP 824 ms, TBT 252 ms, CLS 0.0095**, FCP 808 ms; the splash is still present at 1,011 ms with the full body text and gone by 2,011 ms. Local Statistics: **LCP 920 ms, TBT 316 ms, CLS 0.0095**, FCP 920 ms. Evidence: `audit/perf-local-final-check.json`, `audit/perf-local-final-statistics.json`.
- Local TBT still exceeds 200 ms on both routes (271/316 ms), so the local command exits 1; this is the recorded development-bundle exception, not a CLS regression. The command output says `local budget misses` because it aggregates all three budgets.
- Commands: `PLAYWRIGHT_BROWSERS_PATH=0`, `LD_LIBRARY_PATH=.ui-verify/phase4/root/usr/lib/x86_64-linux-gnu`, `BASE_URL=http://127.0.0.1:3005`, `npm run perf -- --scenarios=throttled --routes=home --runs=1 --settle=10000 --lcp-timeout=60000 --splash-timeout=60000 --out=audit/perf-throttled-final.json` and `npm run perf -- --scenarios=local --routes=home --runs=1 --out=audit/perf-local-final-home.json`.
- Checks: `npx tsc --noEmit` **0 errors**, `npm test` **161/161**, `node --check scripts/perf.mjs` pass, `git diff --check` clean. App source changed, so the dev server was restarted before measurement. Limitation: local Deck remains unmeasurable because this VM's `chrome-headless-shell` lacks fontconfig; splash horizontal-overflow/flash was not rechecked.

---

## Phase 9 run log — 2026-11-07

**Status: production export and local perf accepted; cross-browser, PWA/offline and actual deck/study deep-link rendering remain open.**

- `CI=1 npx expo export --platform web --output-dir dist`: exit 0, **15 MB**, 26 chunks. `index.html`, `manifest.json`, `sw.js`, the icon set, six fonts and the SFX assets are present; no route HTML files are emitted, so a static host must rewrite extensionless routes to `index.html`.
- Served `dist/` with a local SPA fallback (no-store) on port 3006. `/home`, `/statistics`, `/deck/deck-german-a2b1` and `/study/deck-german-a2b1` all returned **200 text/html**; JS, CSS, font, manifest and service worker requests returned 200. This verifies the fallback path, not the rendered deck/study content.
- Production local (fresh context, F2 fixture, 390×844, one run each): Home **LCP 864 ms / TBT 60 ms / CLS 0**; Statistics **LCP 868 ms / TBT 44 ms / CLS 0**; both PASS. This closes the development-bundle TBT exception for the production local measurement. Evidence: `audit/perf-prod-local-final.json`.
- Production CPU 4× diagnostic: the initial Home tab did not mount (`screen-body` 0, only the tab bar and splash) even after 100 s; selecting Game mounted the tabs and let the splash exit. The same happened with Slow 3G. Tried `lazy: false` and removing the tab fade; neither fixed it, and `lazy: false` raised local LCP to 2.8 s, so both experiments were reverted. This is an open slow-CPU navigation/mount defect and is not counted as a pass.
- Still open: Firefox/WebKit, PWA/offline/service worker, real deck/study deep-link rendering, and the CPU 4× initial-mount defect. Local Deck remains blocked by the VM's missing fontconfig in headless Chromium.
- Commands: `CI=1 npx expo export --platform web --output-dir dist`; `BASE_URL=http://127.0.0.1:3006 npm run perf -- --scenarios=local --routes=home,statistics --runs=1 --out=audit/perf-prod-local-final.json`; checks: `npx tsc --noEmit` **0 errors**, `npm test` **161/161**, `git diff --check` clean.

### Slow-CPU initial mount fix — 2026-11-07

**Status: fixed and measured. The initial Home tab mounts under 4× CPU; the splash hands over on a timer instead of waiting for a DOM measurement.**

- Root cause of the missing tab: SDK 58 enables **async routes** on web by default, so every route is a `React.lazy` Suspense boundary. In the production build under 4× CPU the `home` chunk *was* fetched (all 14 requests finished, no console error), but the lazy retry never committed: `BottomTabView` rendered the tab bar and the focused `MaybeScreen` existed with `activityState: 2`, while its route subtree produced no DOM at all (`screen-body` 0, no `data-testid` nodes) for 60 s. CPU 2× mounted in 1 s, so it was a committed-render race, not loading.
- Second cause, in the splash: the exit gated on `[data-testid="screen-body"]`'s `innerText`. `innerText` is empty whenever the renderer skips layout, and this VM has **no system fonts** (`fc-list` 0; a plain `Hello` span measures 0×0), so all text stayed zero-metric until a web font loaded — measured as an empty `innerText` at 26 s while `textContent` was already complete, and as a splash that could outlive a mounted app indefinitely.
- Change: `app.json` now passes `["expo-router", { "asyncRoutes": false }]`, so route modules are part of the initial bundle (1 JS file, **2.5 MB** total instead of 26 chunks; the route chunks were only ~170 KB). `components/AppSplash.tsx` no longer reads `innerText`: it polls for structural text (a timer, not `requestAnimationFrame`, which is starved on a saturated main thread), hands over once that text has been settled for 400 ms, caps the whole wait at 4 s, and removes the layer on a fade guard even if the animation callback never runs. `app/_layout.tsx` passes stable `useCallback` handlers so the watcher's countdown cannot be restarted by a parent render.
- Production, 4× CPU, no network throttle: `screen-body` **1 s**, splash gone **2 s** (before: `screen-body` 0 and splash still up after 60 s). Production, 4× CPU + Slow 3G: body **52 s**, splash gone **53 s** (a 1 s hand-off; previously the route body arrived and the splash stayed). Dev, 4× CPU: body **2 s**, splash gone **3 s**.
- Production local budgets (fresh context, F2 fixture): Home **LCP 476 ms / TBT 105 ms / CLS 0**, Statistics **452 / 110 / 0**; both PASS. Before this change the same build measured 864 / 60 / 0 and 868 / 44 / 0, so the single bundle also removed the route-chunk waterfall. Evidence: `audit/perf-prod-local-sync.json`.
- Dev local: Home **820 / 256 / 0.0095**, Statistics **876 / 304 / 0.0095**. TBT is the recorded development-bundle exception (unminified bundle + HMR); LCP and CLS are within budget and CLS returned to the 0.0095 baseline. Evidence: `audit/perf-local-sync.json`.
- The splash hand-off was tuned once more after the first measurement: it now waits for the body's text to stop changing (capped at 4 s), because handing over while a route was still assembling exposed a late reflow on Statistics in dev (CLS 0.338 → 0.0095).
- Checks: `npx tsc --noEmit` **0 errors**, `npm test` **161/161**, `CI=1 npx expo export --platform web --output-dir dist` exit 0 (15 MB directory, 1 JS file), `git diff --check` clean. The dev server was restarted with `CI=1` after every source change, and both servers were left running (`3005` dev, `3006` static `dist/`).
- Still open / limitations: the deck and study deep links remain unmeasurable here because `chrome-headless-shell` aborts with `FATAL:third_party/skia/src/ports/SkFontMgr_FontConfigInterface.cpp:163 Not implemented` when a route renders text with no available face; the six `/fonts` requests also stay `pending` under Slow 3G in this VM, so painted-text measurements (`innerText`, zero-metric text) are not usable as evidence here. Firefox/WebKit and PWA/offline remain open from Phase 9.

### Phase 10 — boot guard, deck/study/quiz budgets, offline shell (2026-11-07)

- `scripts/serve-dist.mjs` (SPA fallback, `no-store`) and `playwright.boot.config.ts` turn the production boot into something anyone can rerun: `npm run test:boot`. `tests/boot/distServer.ts` starts the server, `mount.spec.ts` throttles with CDP `Emulation.setCPUThrottlingRate: 4`, and `offline.spec.ts` drives the service worker.
- The mount spec asserts what the defect broke: `[data-testid="screen-body"]` has non-empty `textContent` within 30 s and `[aria-label="Loading Memora"]` is gone within 20 s. `textContent` rather than `innerText`, for the reason recorded above. It covers `/home` and a non-tab deep link (`/statistics`), so a build that renders the tab bar but no screen fails the run.
- Result: `npm run test:boot` -> **3/3 passed in 7.9 s** (home 2.5 s, statistics 2.6 s, offline 1.2 s).
- Offline: register `/sw.js`, wait for control, take one controlled online load so the worker caches the document and bundle, then `context.setOffline(true)` and reload. The shell renders from cache with no network — the only evidence that the network-first fallback in `public/sw.js` actually works.
- Production local budgets now cover every deep route in the harness (study/quiz added to `ALL_ROUTES` in `scripts/perf.mjs`): Home 476/105/0, Statistics 452/110/0, deck 460/96/0, study 460/99/0, quiz 428/94/0 — all PASS. Evidence: `audit/perf-prod-local-sync.json`, `audit/perf-prod-local-deck.json`, `audit/perf-prod-local-study-quiz.json`.
- The headless font crash is solved without root: `.ui-verify/fonts/fonts.conf` points fontconfig at `public/fonts` and `FONTCONFIG_FILE` selects it. `chrome-headless-shell` no longer dies with `SkFontMgr_FontConfigInterface ... Not implemented`, and the deck renders under 4x CPU (body 2 s, splash gone 3 s) — this is what made the deck/study/quiz budgets measurable at all.
- `npx tsc --noEmit` covers the new specs and config: 0 errors.

### Cross-engine pass (2026-11-07)

- Chromium (revision 1248) remains the engine behind every number in this document.
- Firefox 157.0 now runs headless here: the missing system libraries (GTK3, pango/cairo, X) were extracted from Ubuntu noble packages into a local prefix (`.ui-verify/phase4/root`) and selected through `LD_LIBRARY_PATH`, so no root or system-wide install was needed. `node scripts/cross-browser.mjs --engine=firefox` against the production build: **18 route/width combinations, 0 axe A/AA nodes, 0 targets under 44 px, no horizontal overflow, 0 focus misses, 0 console/page errors, and 200% text zoom grew the type** — exit 0 (`audit/cross-browser.json`).
- WebKit 2370 is downloaded but does not launch in this image: it needs GTK 4, GStreamer and a GLES stack that are absent and cannot be installed without root. Its verification stays open; Chromium and Firefox cover the boot, layout, a11y, focus and zoom assertions.
