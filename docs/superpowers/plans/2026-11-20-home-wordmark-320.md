# Tracked defect — Home wordmark truncated at 320px

**Status:** **FIXED** — implemented 2026-11-20 on `fix/home-wordmark-320`;
awaiting review. The regression test and Home baselines are updated.
**Opened:** 2026-11-20.
**Area:** Home app bar (`app/(tabs)/home.tsx`, `components/v3/PageHeader.tsx`).
**Related:** `2026-11-20-home-page-ui-fix.md` — the 390×780 verification,
closed as “no change required”. This item is separate from that question.

---

## 1. Symptom

At a **320px-wide viewport** the Home app bar renders the `Memora` h1 as
`Me…`. 320px is a supported width in the app contract
(320/375/390/430/768/1280), so this is a defect, not accepted truncation.

## 2. Measured evidence (2026-11-20)

Live Home, seeded library (5 decks, 44 cards, 40 due, 4 folders, 13-day
streak), Chromium, **320 × 760**, 1× text, dark:

```
h1 clientWidth   60 px
h1 scrollWidth   77 px      (17 px short)
computed         white-space: nowrap; overflow: hidden;
                 text-overflow: ellipsis
innerText        "Memora"   (the text node is intact)
document overflow-x 0
all controls     44 × 44
```

### Width budget at 320 (content row = 280px: 320 − 2 × 20px gutters)

| Block | Width | Position |
|---|---:|---|
| brand mark | 42 | 20–62 |
| gap | 8 | 62–70 |
| **h1, allocated** | **60** | 70–130 |
| gap | 8 | 130–138 |
| streak chip (44px target) | 62.1 | 138–200 |
| gap | 8 | 200–208 |
| Discover (44px) | 44 | 208–252 |
| gap | 4 | 252–256 |
| Create new (44px) | 44 | 256–300 |
| right gutter | 20 | 300–320 |

The h1 is the row's only flexible block. 280 − 220.1 = **59.9px**, so the
wordmark gets 60px where the 20px semibold face needs **77px**.

At 390 the same row allocates the full 77px and the slack before the streak
chip is ≈61px; the truncation is specific to 320.

## 3. Resolution (implemented 2026-11-20)

The streak shortcut moved from `PageHeader`'s `meta` into the Today hero's
date row (`components/v3/TodayPane.tsx`). Home passes `streak` and
`onOpenStreak` to the pane instead of building the header chip. The app bar is
now brand + two actions: at 320 its brand row has 180px, and the 42px mark +
8px gap + 77px wordmark need 127px. The hero keeps the 44×44 target, label,
hint, warning ink, haptics and the `/streak` route; 390/768/1280 show the chip
beside the date.

**Checks run:** new 320 test RED (`77 vs 60 + 1`) then GREEN; Home + streak
Playwright 21/21; `tsc --noEmit` 0; visual `home-390`, `home-768`,
`home-1280` regenerated (darwin) and green; responsive sweep 320–1280
18 measured / 0 flagged / 0 failed; `npm test` 265/265; `check:design` clean
(101 files).

## 4. Impact

- Visual only: the product name is clipped at a supported width.
- Accessible name still reads “Memora”; no control shrinks; the page has no
  horizontal overflow.
- No data, storage, streak, review or route behavior is affected.

## 5. Options considered

**Chosen: option 1.**

1. **Move the streak shortcut into the Today hero** — frees the chip's 62px
   plus its 8px gap, but changes the Home composition at every width.
2. **Compact app bar at ≤320 only** — smaller brand tile/gaps; risks breaking
   again for a three-digit streak.
3. **Merge or hide `Discover` at 320** — frees 44px + 4px, but removes a route
   shortcut at the smallest width.
4. **Smaller headline variant at 320** — typography deviation, not preferred.

A fix must keep every control ≥ 44 × 44, keep `Memora` as the h1, keep the row
inside 280px, and leave 390/768/1280 unchanged unless the change is
intentional and reviewed.

## 6. Acceptance criteria

- [x] At 320 × 760: `h1.scrollWidth ≤ h1.clientWidth + 1` (77 / 77).
- [x] Document horizontal overflow ≤ 1px (0).
- [x] Every app-bar control remains ≥ 44 × 44 with its accessible name.
- [x] 390 / 768 / 1280 reviewed deliberately; Home baselines updated.
- [x] No data, storage, route or backup changes.

## 7. Follow-up

- Linux `home-390` and `home-1280` baselines are still the pre-fix images; they
  cannot be regenerated on this macOS host. Re-run with `--update-snapshots` on
  Linux before claiming the visual suite green there.
- No push: the fix sits on `fix/home-wordmark-320` for review.
