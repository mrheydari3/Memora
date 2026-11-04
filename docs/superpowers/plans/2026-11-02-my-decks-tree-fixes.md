# My Decks Tree Review and Fix Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore the folder button’s accessible name and make the library trunk continuous with a clean terminal at the final leaf.

**Architecture:** Keep the single `GlassCard` library box. Represent each folder group as a node with an optional connector above it, a line to its children, and a terminal flag only for the final visible leaf. Pass `connectAbove`/`terminal` into the folder and deck row primitives; no per-deck cards or new colors.

**Tech Stack:** Expo 58, React Native 0.88, TypeScript, Playwright + axe smoke test.

**Spec:** `docs/design-language.md` and the My decks tree design brief in this thread.

## Status — run on 2026-11-04

Both code changes were already committed when this plan was executed:

- `9fa6100 Flatten the canvas and rebuild the My decks tree` — the trunk, its
  nodes and the `connectAbove`/`terminal` flags.
- `8418093 Keep the deck name whole at 200% text` — the flexible `Rail` halves
  that pin a node or branch to the row’s midline at any row height.
- `a6cf550` / `bb5abb4` then replaced the tree on Home with the v2 deck shelf, so
  `DeckLibrary` is still exported but no longer mounted.

Result: **Task 1 is verified on the shipped UI** (a folder is a filter chip named
`Folder <name>`), **Task 2 is superseded** — there is no trunk on screen to
terminate — and **Task 3 passes** with the numbers recorded below. The plan’s own
verification script was stale: it looked for a `Folders` button and a collapsible
tree header, both of which v2 removed, and it matched nine `More options` controls.
It now drives the shipped UI and reports 18/18.

| Check | Result |
| --- | --- |
| `npx tsc --noEmit` | 0 errors |
| `npm run check:design` | clean (72 files) |
| `node scripts/smoke-folders.mjs` | 18/18 |
| axe (WCAG 2.2 AA), sheet / home / after delete | 0 violations |
| Folder chip height | 44px |
| Horizontal overflow, 390px and 320px | 0px / 0px |

> **Still stale:** `scripts/verify-mydecks-box.mjs` asserts the tree (`Known`
> group, trunk branch at the row centre). The component it measures is no longer
> rendered, so that script fails by design until it is either retargeted at the
> shelf or retired with `DeckLibrary`.

## Global Constraints

- Keep one library box; no nested card shadows.
- Use existing theme tokens only; no raw hex/rgba.
- Preserve folders, `Unfiled`, empty-folder guidance, collapse/expand, counts, and deck navigation.
- Do not change deck data or folder semantics.
- Keep the 320px layout free of horizontal overflow.

## Review Focus

- A screen reader must hear “Folder <name>” for a folder button; the smoke test uses this exact name.
- The trunk must not leave a dangling segment below the final branch.
- A collapsed final folder must end at its node, not with an orphan line.
- A final empty folder must stop at its empty-leaf branch.
- The folder label must not trigger axe `label-content-name-mismatch`; keep the accessible name containing the visible folder name.

---

### Task 1: Restore the folder accessible name

**Files:**
- Modify: `components/DeckLibrary.tsx` (`FolderHeader`)
- Modify: `app/(tabs)/home.tsx` (folder filter chip, after v2)

**Interfaces:**
- Consumes: `folder.name`
- Produces: a folder control whose accessible name starts with `Folder ${folder.name}`; `aria-expanded` (tree) or `aria-pressed` (chip) stays.

- [x] **Step 1: Reproduce the failure**

Run: `node scripts/smoke-folders.mjs`

Observed on 2026-11-04: the run timed out at `getByRole('button', { name: 'Folders', exact: true })`. Root cause was not the missing folder label — the tree implementation already carried `Folder ${folder.name}` — but Home v2 renaming that action to **Manage folders**.

- [x] **Step 2: Add the accessible name**

`components/DeckLibrary.tsx` renders `accessibilityLabel={`${label}, ${countLabel}`}` with `label = `Folder ${folder.name}``; `app/(tabs)/home.tsx` renders the chip with `accessibilityLabel={`Folder ${folder.name}`}`. Both keep the visible folder name inside the accessible name, and both keep their state attribute (`aria-expanded` / `aria-pressed`).

- [x] **Step 3: Re-run the browser test**

Run: `BASE_URL=http://localhost:8090 node scripts/smoke-folders.mjs`

Result: **18/18**, including `folder appears as a chip named "Folder German A2"`, `chip is not pressed while All decks is active`, `folder chip is pressed once selected`, `folder chip is 44px tall — 44px`, and axe clean on the sheet, on home with a folder chip, and after deleting the folder.

### Task 2: Make the trunk continuous with a terminal at the final leaf

**Status: superseded.** The code is committed and typechecks, but `bb5abb4 Build Home v2 with full-width deck rows and the pill Start CTA` replaced the tree on Home with a deck shelf, so no trunk is rendered and no leaf can dangle. The steps are kept for the record; tick them only if `DeckLibrary` is mounted again.

**Files:**
- Modify: `components/DeckLibrary.tsx` (`DeckLibrary`, `FolderHeader`, `RootHeader`, `UnfiledHeader`, `EmptyFolder`, `DeckRow`)

**Interfaces:**
- Consumes: `groups` from `groupDecksByFolder`, `collapsed` state
- Produces: `connectAbove: boolean` and `terminal: boolean` on header primitives; `terminal: boolean` on `EmptyFolder` and `DeckRow`.

- [x] **Step 1: Compute the final visible leaf**

`DeckLibrary` derives `finalLeaf` (`header` when collapsed, else `deck`, `empty` or `header`) and uses it only for `isLastGroup`.

- [x] **Step 2: Connect headers above, and terminate only when required**

Headers receive `connectAbove={groupIndex > 0}` and `terminal={isLastGroup && finalLeaf === 'header'}`; `Rail` draws the upper half only when connected and the lower half only when not terminal.

- [x] **Step 3: Stop the last leaf at its branch**

`DeckRow` receives `terminal={isLastGroup && finalLeaf === 'deck' && index === group.decks.length - 1}`, which drops the lower trunk half.

- [x] **Step 4: Handle a final empty folder**

`EmptyFolder` receives `terminal={isLastGroup && finalLeaf === 'empty'}` and shortens its connector to 22px instead of running to the next group.

- [ ] **Step 5: Verify the tree geometry**

Not applicable on the shipped app: Home renders the v2 shelf, so there is no trunk to measure. `scripts/verify-mydecks-box.mjs`, which measured it, now fails against the shelf and needs retargeting or retirement.

### Task 3: Final verification

- [x] **Step 1: Typecheck and design tokens**

Run: `npx tsc --noEmit && npm run check:design`

Expected: `TSC_EXIT=0`, `Design tokens: clean`.

Result: `TSC_EXIT=0`, `Design tokens: clean (72 files checked)`.

- [x] **Step 2: Run the folder smoke test**

Run: `node scripts/smoke-folders.mjs`

Expected: all checks pass, including `Folder German A2`, 44px height, collapse/expand, axe, and 320px overflow.

Result: **18/18**, with the checks updated to the shipped UI (folder chip instead of tree header, `Manage folders` instead of `Folders`, exact match for the deck header’s `More options`). Collapse/expand has no equivalent on the shelf, so filtering replaced it: `filed deck shows under its folder filter` and `All decks clears the filter`.

- [x] **Step 3: Review the rendered tree**

Not applicable as written (no tree). What the run confirms on the shipped Home: one deck shelf, folder chip at 44px, folder name printed on the filed deck’s row, no console errors, and no horizontal overflow at 390px or 320px.
