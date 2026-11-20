# Tracked defect — Home wordmark truncated at 320px

**Status:** **FIXED** — implemented 2026-11-20 on `fix/home-wordmark-320`;
awaiting review. The regression test and Home baselines are updated.
**Opened:** 2026-11-20.
**Area:** Home app bar (`app/(tabs)/home.tsx`, `components/v3/PageHeader.tsx`).
**Related:** `2026-11-20-home-page-ui-fix.md` — the mobile 390 / tablet-PC 780
width check, closed as “no change required”. This item is separate from that
question.

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

## 3. Resolution (implemented 2026-11-20, revised after review)

The shortcut is now one shared `StreakChip` (`components/v3/StreakChip.tsx`)
with the 44×44 target, accessible name/hint, warning ink and press spring.
Home renders it in `PageHeader`'s `meta` at 375px and wider, and hands it to
the Today hero's date row below 375px (`STREAK_IN_HEADER_MIN_WIDTH`), where
the app bar cannot hold both the chip and the full wordmark. `TodayPane` takes
optional `streak` / `onOpenStreak` props, so no markup is duplicated and only
one control is mounted at a time.

The first implementation moved the chip into the hero at **every** width;
review rejected that. The app bar is sticky and the hero scrolls, so a global
move removed the shortcut from reach while browsing at 375–1280 and changed
three baselines for a 320-only defect. Restricting the move to sub-375 widths
keeps the app-bar placement, and the pre-fix visuals, at every supported width
above 320.

At 320 the app bar is brand + wordmark + Discover + Create:
42 + 8 + 77 + 8 + 44 + 4 + 44 = 227px inside 280px, so the wordmark is full
with room for a three-digit streak.

**Checks run:** 320 test RED (`77 vs 60 + 1`) then GREEN; new 390 test pins the
app-bar placement, 44×44 target and accessible name; Home + streak Playwright
22/22; `tsc --noEmit` 0; visual `home-390` byte-identical to pre-fix,
`home-768` / `home-1280` refreshed, 3/3 green; responsive sweep 320–1280
18 measured / 0 flagged / 0 failed; `npm test` 265/265; `check:design` clean
(102 files).

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
- [x] 390 / 768 / 1280 keep the app-bar placement; their baselines were
      refreshed and the 390 image is byte-identical to pre-fix.
- [x] No data, storage, route or backup changes.

## 7. Follow-up

- 390 and 1280 keep the app-bar placement, so the pre-fix Linux baselines are
  back in step; still run the visual suite on Linux to confirm rendering there.
- No push: the fix sits on `fix/home-wordmark-320` for review.
