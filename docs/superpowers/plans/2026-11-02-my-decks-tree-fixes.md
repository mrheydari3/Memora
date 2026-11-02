# My Decks Tree Review and Fix Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore the folder button’s accessible name and make the library trunk continuous with a clean terminal at the final leaf.

**Architecture:** Keep the single `GlassCard` library box. Represent each folder group as a node with an optional connector above it, a line to its children, and a terminal flag only for the final visible leaf. Pass `connectAbove`/`terminal` into the folder and deck row primitives; no per-deck cards or new colors.

**Tech Stack:** Expo 58, React Native 0.88, TypeScript, Playwright + axe smoke test.

**Spec:** `docs/design-language.md` and the My decks tree design brief in this thread.

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

**Interfaces:**
- Consumes: `folder.name`
- Produces: a folder button whose accessible name starts with `Folder ${folder.name}`; `aria-expanded` and the collapse hint stay.

- [ ] **Step 1: Reproduce the failure**

Run: `node scripts/smoke-folders.mjs`

Expected: FAIL at `folder appears as a header in the My decks box` because the button has no `Folder German A2` name. Current run also times out waiting for that role/name.

- [ ] **Step 2: Add the accessible name**

In `FolderHeader`, add:

```tsx
accessibilityLabel={`Folder ${folder.name}`}
```

Keep `accessibilityRole="button"`, `aria-expanded={open}`, and the `accessibilityHint`.

- [ ] **Step 3: Re-run the browser test**

Run: `node scripts/smoke-folders.mjs`

Expected: the folder-header check passes, the height check is at least 44px, collapse/expand passes, axe stays clean, and the 320px overflow check passes.

### Task 2: Make the trunk continuous with a terminal at the final leaf

**Files:**
- Modify: `components/DeckLibrary.tsx` (`DeckLibrary`, `FolderHeader`, `RootHeader`, `UnfiledHeader`, `EmptyFolder`, `DeckRow`)

**Interfaces:**
- Consumes: `groups` from `groupDecksByFolder`, `collapsed` state
- Produces: `connectAbove: boolean` and `terminal: boolean` on header primitives; `terminal: boolean` on `EmptyFolder` and `DeckRow`.

- [ ] **Step 1: Compute the final visible leaf**

For each group, derive:

```tsx
const isLastGroup = groupIndex === groups.length - 1;
const finalLeaf = !open
  ? 'header'
  : group.decks.length > 0
    ? 'deck'
    : folder
      ? 'empty'
      : 'header';
```

Use `finalLeaf` only for the last group; all earlier groups must let their trunk continue to the next sibling.

- [ ] **Step 2: Connect headers above, and terminate only when required**

Add `connectAbove={groupIndex > 0}` and `terminal={isLastGroup && finalLeaf === 'header'}` to the folder/root/unfiled header.

In each header:
- If `connectAbove`, draw a 1px line from `top: 0` to `top: heights.row / 2`.
- If not `terminal`, draw the existing line from `top: heights.row / 2` to `bottom: 0`.
- The `TreeNode` remains centered at the junction.

- [ ] **Step 3: Stop the last leaf at its branch**

Pass `terminal={isLastGroup && finalLeaf === 'deck' && deckIndex === group.decks.length - 1}` to `DeckRow`.

In `DeckRow`, set the vertical line to:

```tsx
bottom: terminal ? undefined : 0,
height: terminal ? 34 : undefined,
```

so only the final leaf stops at the horizontal branch (`top: 34`). All earlier deck rows keep a full-height line.

- [ ] **Step 4: Handle a final empty folder**

Pass `terminal={isLastGroup && finalLeaf === 'empty'}` to `EmptyFolder`. A terminal empty note uses a 10px connector to its branch; a non-terminal one keeps the vertical line through the note to connect the next sibling.

- [ ] **Step 5: Verify the tree geometry**

Use the preview DOM check (or a screenshot) and confirm:

- the vertical segments meet between adjacent groups;
- the final deck line ends at its branch;
- collapsed final folders have no bottom line;
- no line extends below the last visible leaf;
- there is still one shadowed library box and zero nested shadows.

### Task 3: Final verification

- [ ] **Step 1: Typecheck and design tokens**

Run: `npx tsc --noEmit && npm run check:design`

Expected: `TSC_EXIT=0`, `Design tokens: clean`.

- [ ] **Step 2: Run the folder smoke test**

Run: `node scripts/smoke-folders.mjs`

Expected: all checks pass, including `Folder German A2`, 44px height, collapse/expand, axe, and 320px overflow.

- [ ] **Step 3: Review the rendered tree**

Confirm: one Library box, no nested shadows, folder nodes aligned at 20px, deck branches at 36px, due count 26px, no console errors, and no dangling trunk.
