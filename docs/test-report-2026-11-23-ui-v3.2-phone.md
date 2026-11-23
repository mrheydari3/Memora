# Memora 3.2.0 — phone-first UI verification

**Date:** 23 November 2026  
**Scope:** phone web/PWA at 320, 360, 375, 390 and 430 CSS px. 390×844 reference; 320×700 stress. Tablet/desktop (768+) is frozen for this release and received only a boot/no-overflow smoke.  
**Browser:** packaged Chromium (Playwright). Firefox and WebKit were not available.

## 1. What shipped

- **3.2.0** in `package.json`, `package-lock.json` and `app.json`; PWA cache `memory-v7`.
- The shell fixes from P0-1/P0-2: fluid dock, large-text icon-only tabs, hidden wordmark with a hidden `h1`, and the compact 320 hero.
- The P1 screen fixes: labelled Home sort, one-deck folder CTA rule, equal-height achievements with a full-width fifth badge, one `ListDivider` primitive, tuned field edges, one-primary Add-deck footer, and the phone heading/spacing rhythm.
- Large-text reflows across Home, Review, Profile, Settings, Deck, Study-answer, Quiz, Statistics, Streak and Add-deck.
- **87 surfaces / 88 census targets.** No data migration, no backend, no native project, no tablet/desktop redesign.

## 2. P0/P1 closure evidence

| # | Problem | Before | After / measurement |
| --- | --- | --- | --- |
| P0-1 | 200% dock, brand and hero collisions | [`tab-390-zoom200.png`](../screenshots/audit/tab-390-zoom200.png) | [`home-390-zoom200.png`](assets/v3.2-phone/current/home-390-zoom200.png): hidden wordmark, 42px mark, icon-only 87px dock tabs, no overlap |
| P0-2 | 320 dock covered the All/Due/sort row | [`tab-320-top.png`](../screenshots/audit/tab-320-top.png) | [`home-320.png`](assets/v3.2-phone/current/home-320.png): toolbar bottom **601px**, dock top **618px** |
| P0-3 | Stale version, surface count and cache | 3.0.0 in app/package/lock/boot, 84 docs, `memory-v6` | **3.2.0** everywhere, **87** surfaces, **`memory-v7`** |
| P1-4 | Unlabelled Home sort | icon-only chip | The same `Select` pattern as Deck names the active order; measured in HM-01/HM-02 at all three widths |
| P1-5 | One-deck folder repeated “Review folder” | old `plan-home-390.png` row | `LibraryBoard` now emits the row only when `shelfDeckCount > 1`; HM-08–HM-11 pass at 320/390/430 |
| P1-6 | Ragged achievements | [`profile-bottom.png`](../audit/mobile-390/profile-bottom.png) | [`profile-bottom-390.png`](assets/v3.2-phone/current/profile-bottom-390.png); row heights measured equal (168/168, 181/181) and the fifth spotlight is 118px full width |
| P1-7 | 34/68/74px and raw dividers | three local rules | One `ListDivider` with `tile` 68, `dot` 34, `card` 16 insets; documented in `docs/design-language.md` |
| P1-8 | Form edges dominated; two cancels | [`add-deck-field.png`](../screenshots/audit-add-deck-field.png) | [`add-deck-320.png`](assets/v3.2-phone/current/add-deck-320.png): field edge **0.48** (3.0:1 card / 3.15:1 pane), one primary + text cancel |
| P1-9 | Heading and spacing drift | local 8/12/14/20 margins | Phone contract, app-bar matrix and heading hierarchy documented; compact hero tokens replace local margins |
| P1-10 | Unverified phone stress states | stale 20 Nov captures | [`deck-320.png`](assets/v3.2-phone/current/deck-320.png), [`deck-long-320.png`](assets/v3.2-phone/current/deck-long-320.png), [`review-320.png`](assets/v3.2-phone/current/review-320.png), [`study-320.png`](assets/v3.2-phone/current/study-320.png), [`quiz-320.png`](assets/v3.2-phone/current/quiz-320.png), [`streak-320.png`](assets/v3.2-phone/current/streak-320.png) |

## 3. Responsive census

Command:

```bash
npm run responsive -- --mode=measure --widths=320,390,430 --base=http://127.0.0.1:8081
npm run responsive -- --mode=summary
```

| Width | Viewport | Runs | Flagged | Failed |
| --- | --- | --- | --- | --- |
| 320 | 320×700 | 88 | 0 | 0 |
| 390 | 390×844 | 88 | 0 | 0 |
| 430 | 430×932 | 88 | 0 | 0 |
| **Total** | | **264** | **0** | **0** |

The measurements cover document and body overflow, elements past the viewport, clipped labels, horizontal main scrolling, dock occlusion, open-sheet clipping and sheet-control clipping. The initial folder overlay runs failed to find “Manage folders” through `getByRole('button')`; the harness now falls back from button to `menuitem` to the visible label, and the four folder surfaces pass at all three widths.

The 768px smoke (`home-768.png`, `settings-768.png`, `deck-768.png`) has no horizontal overflow. The 768 tablet-boundary and 1280 tablet-layout visual baselines also pass unchanged after the fluid dock was restricted to phones; this is not a 3.2 design gate.

## 4. 200% text checks

Root font size was set to 32px (200% of 16px) and the page was re-measured after resize.

| Surface | Width(s) | Result | Evidence |
| --- | --- | --- | --- |
| Home | 320, 390 | no overlap; wordmark hidden; hero CTA wraps; dock icon-only | [`home-320-zoom200.png`](assets/v3.2-phone/current/home-320-zoom200.png), [`home-390-zoom200.png`](assets/v3.2-phone/current/home-390-zoom200.png) |
| Review | 390 | labels and two-line meta fit | [`review-390-zoom200.png`](assets/v3.2-phone/current/review-390-zoom200.png) |
| Profile | 390 | achievements one column; stats and activity reflow | [`profile-bottom-390-zoom200.png`](assets/v3.2-phone/current/profile-bottom-390-zoom200.png) |
| Settings | 390 | status and ledger rows wrap | [`settings-390-zoom200.png`](assets/v3.2-phone/current/settings-390-zoom200.png) |
| Deck | 390 | title, chip and ledger reflow | [`deck-390-zoom200.png`](assets/v3.2-phone/current/deck-390-zoom200.png) |
| Deck, 90-character name | 320, 390 | app bar ellipsizes, but the unclamped full name is repeated in the hero; 0 overflow and 0 clipped labels at 100% and 200% | [`deck-long-320.png`](assets/v3.2-phone/current/deck-long-320.png), [`deck-long-390.png`](assets/v3.2-phone/current/deck-long-390.png) |
| Study answer | 320, 390 | 2×2 rating keys; title two lines on compact; counter in body; no clipped labels | [`study-answer-320-zoom200.png`](assets/v3.2-phone/current/study-answer-320-zoom200.png), [`study-answer-390-zoom200.png`](assets/v3.2-phone/current/study-answer-390-zoom200.png) |
| Quiz | 390 | TIME/COMBO labels and prompt wrap | [`quiz-390-zoom200.png`](assets/v3.2-phone/current/quiz-390-zoom200.png) |
| Statistics | 390 | recall tiles full width, median labels and memory rows reflow | [`statistics-rating-390-zoom200.png`](assets/v3.2-phone/current/statistics-rating-390-zoom200.png), [`statistics-deep-390-zoom200-1.png`](assets/v3.2-phone/current/statistics-deep-390-zoom200-1.png) |
| Streak | 390 | calendar and legend fit | [`streak-390-zoom200.png`](assets/v3.2-phone/current/streak-390-zoom200.png) |
| Add deck | 390 | field labels and footer fit; one cancel | [`add-deck-390-zoom200.png`](assets/v3.2-phone/current/add-deck-390-zoom200.png) |

At 320/200% the Study card keeps its scrollable body; the rating keys, hint and tray remain reachable. The visible card region is intentionally short at that extreme so the four ratings stay on screen.

## 5. Checks run

| Gate | Command | Result |
| --- | --- | --- |
| Types | `npx tsc --noEmit` | **0 errors** |
| Design guard | `npm run check:design` | **clean, 108 files** |
| Unit tests | `npm test` | **265 / 265** |
| Surface parity | `npm run test:surfaces` | **11 / 11; 87 surfaces** |
| Fixtures | `npm run test:fixtures` | **14 / 14** |
| Browser suite | `BASE_URL=http://127.0.0.1:8081 npm run test:e2e` | **191 / 191** (11.0m) |
| Production export | `npm run build:web` | `dist/` exported |

The browser suite includes the axe WCAG 2.2 AA scans (17 routes plus the archived study state), the 44px target sweep, the 320px overflow sweep, keyboard focus, the 200% type-scale check, flows and data-truth checks. The earlier release run logged 188/191: two failures were stale expectations that the release deliberately changed (the one-deck folder CTA and the clearer “Sort by …” option names), and the third was an `ENOENT` trace artifact caused by a targeted folder test overlapping the long run. After those specs were updated and the review edits landed, the complete suite was rerun: **191/191 passed in 11.0 minutes**. The unit suite also passed **265/265**. Logs: `audit/e2e-3.2-review-full.log`, `audit/unit-3.2-review-full.log` and the earlier focused output; visual baselines were not regenerated because every visual test passed.

**Review follow-up (23 Nov):** the review first reran only the affected gates, then the complete suites. Types **0**, design guard **clean (108 files)**, fixtures **14/14**, tab-bar/folder/sort flows **9/9**, axe **25/25**, tablet visual baselines **2/2**, and the final full run **191/191** (11.0m) plus **265/265** unit tests. The phone dock measured 296px at 320 and 360px at 390/430, returned to 300px at 768/1280, and the 90-character deck hero had **0 clipped text and 0 overflow at 200%** on 320/390. This pass also removed the dock's unnecessary 280px floor, kept the desktop Review best score in the row's accessible name, and stopped the odd fifth achievement from becoming a short spotlight at large text.

## 6. Release build and deployment

- `npm run build:web` → `dist/`; `npm run deploy:prepare` → `dist-deploy/`.
- The prepared bundle is checked for dependency paths (`node_modules`), source maps, hidden files and the upload budget.
- `npm run serve:dist` serves the export at `http://127.0.0.1:3107`; deep-link and refresh smoke uses a real route.
- **Metro cache defect found during preview verification:** the first export baked the old `3.0.0` manifest into the JS bundle even though `app.json` was 3.2.0, so Settings still read “Memora 3.0.0”. `npx expo export --platform web --clear` rebuilt with `"version":"3.2.0"`; `deploy:prepare` then produced a 4.98 MiB / 36-file bundle with no `node_modules` or source maps.
- **Preview deployed and published:** <https://site-7fa0d39eb9ad40d6a19f0b5997d4d6ac.freebuff.page> (final deployment 14:06 UTC, after the dock, Review, deck-name and achievement cleanups). Verified at 390 and 320 with a real browser: the dock is 360px at 390 and 296px at 320, Home’s toolbar is labelled (`Sort: Manual`), document overflow is 0, Settings shows **Memora 3.2.0**, and the canonical/`og:url` are both `https://memora.freebuff.page`.
- **Production deployed and verified:** <https://memora.freebuff.page> (deployment succeeded 14:24 UTC, published). A clean Chromium context at **320×700** measured the dock at **296px**, the All/Due/sort toolbar ending at **576px** with the dock starting at **618px** (42px clear), and **0 horizontal overflow**. At **390×844** the dock is **360px**, the toolbar ends at **583px** with the dock at **762px** (179px clear), and overflow is **0**. Settings shows **Memora 3.2.0**.
- **Local data and deep links:** the live origin retained **1 deck, 1,817 cards and 20 due** across reloads. `/settings`, `/settings/offline` and `/deck/deck-german-a2b1` all loaded directly and survived reload; the deck page still showed its 1,817 cards and 20 due.
- **PWA cache:** in an isolated verification profile, enabling the offline cache registered the service worker at scope `/`, populated **`memory-v7`** (8 shell entries) and **`memory-runtime`** (13 entries, including the deployed `entry-a178a728fea26985921b24a7f1adbd91.js`), and remained controlled across reloads. Canonical and `og:url` resolve to `https://memora.freebuff.page`; the live console showed only service-worker registration logs.
- **PWA update:** opened Offline, enabled the cache, confirmed `memory-v7` plus `memory-runtime`, and reloaded twice while controlled by the worker. The page still rendered and kept 3.2.0; the console showed only the expected SW registration logs.
- Deep links `/settings`, `/settings/offline`, `/home` and `/deck/deck-german-a2b1` survive reloads on the preview origin.
- Production is published at `https://memora.freebuff.page`; the deployment completed at 14:24 UTC on 23 November 2026.

## 7. Limitations

- Chromium is the only verified engine. Firefox and WebKit are not claimed.
- Viewport emulation is not a real-device test: physical notches, PWA safe areas and touch latency are not verified.
- Tablet/desktop is frozen; 768 boot/no-overflow and the existing 768/1280 visual baselines were checked, but its design was not reviewed in this release.
- The 320/200% Study card scrolls internally; all four rating keys remain visible, but the prompt requires a scroll at that extreme.
- The release does not migrate data, add a backend, create a native project, or push/tag the repository.
