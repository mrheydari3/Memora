---
name: design-drift-audit
description: Audit a UI for design problems and inconsistencies — screens that disagree with each other, values that bypass the design tokens, hand-rolled components that duplicate existing primitives, and layouts that leave a column ending in empty space. Use this whenever the user says the design looks "off", "inconsistent", "random", "not matching", "cheap", or asks for a design review, a visual consistency pass, UI polish, or why two screens that should look alike don't. Also use it before calling a redesign finished, and after adding a new screen, component or section to a design system.
---

# Design drift audit

A design review has to produce **evidence**, not taste. "This feels off" is not a
finding; "this screen uses 24px between sections while the other seven use 32px,
and its desktop column ends 212px before its neighbour" is.

Keep three failure kinds apart, because they have different fixes:

1. **Drift from the law** — the project has tokens and the value ignores them: a
   14px gap, a 20px radius nobody defined, a literal colour.
2. **Disagreement between screens** — each screen is internally fine, but the
   same role is rendered differently: section heading 20px here and 22px there,
   primary action under the title here and pinned to the footer there.
3. **Layout that doesn't close** — the page works but wastes or hides space: a
   tall pane paired with a short one so one column stops a third of the way
   down, a floating tab bar sitting on the last row, dead space at 1280px.

## Phase 0 — read the law before judging anything

Open the design system first; every finding needs to cite it.

- **Token sources**: `theme/palette.js`, `theme/*.ts`, a Tailwind/NativeWind
  config, a `tokens` module. These define spacing steps, radii roles, type
  steps, heights, icon sizes, motion durations.
- **The written law**: `docs/design-language.md` or equivalent. It states what
  tokens can't: borders are exceptions, one accent pane per screen, screens do
  not set their own gutters, which component owns which role.
- **The component catalogue** (`components/`, `components/v2/`, the barrel
  export): what "a row", "a panel", "an empty state" already look like.
- **The existing guards** (`npm run check:design`, `scripts/audit.mjs`). Run
  them first: their output is free evidence, and re-implementing them wastes the
  audit.

Write down the vocabulary you will judge against: spacing steps, radius roles,
type steps, surface roles, allowed borders, screen-shell contract, motion rules.
If you cannot name the step a value should have used, you cannot report it.

Two rules that keep this honest:

- If the law explicitly allows a value, it is not a finding, even if you would
  have chosen differently.
- If the law is silent and only one screen does something, that is **low** at
  most. If two screens disagree, the disagreement itself is the finding.

## Phase 1 — static pass

Run the bundled scanner (from the project root, or pass `--root`):

```bash
node skills/design-drift-audit/scripts/scan-design-drift.mjs
node skills/design-drift-audit/scripts/scan-design-drift.mjs --json     # machine-readable
node skills/design-drift-audit/scripts/scan-design-drift.mjs --rule spacing-off-grid
node skills/design-drift-audit/scripts/scan-design-drift.mjs --strict   # exit 1 on high/critical
```

It reads the project's own token files to learn what "on spec" means, then
reports off-grid spacing, invented radii, literal font sizes, raw `Text`,
`TouchableOpacity`, direct `Animated` calls, manual `max-width`, hand-set screen
gutters, borders outside the allowed meanings, and screens missing the standard
shell switches. It exits 0 by default: an audit, not a gate.

The scanner is the cheap half. It cannot see the two things users notice most,
so do those by hand.

**Component reuse.** For each recurring role — panel, row, chip, pill, empty
state, stat, segmented control, sheet, section heading — find the component that
owns it, then hunt for parallel implementations:

```bash
rg -n "borderRadius:\s*(v2\.)?radii|radius=\{" app components
rg -n "borderStyle:\s*'dashed'" app components
rg -n "<Pressable" app
```

A hand-rolled pressable row that re-implements the row primitive, or a new
dashed frame where the empty-state component exists, is a **high** finding: it
contradicts the catalogue and will drift further with the next change.

**Cross-screen parity.** Build a matrix of the roles that appear on many screens
and read one line per screen. Any row that doesn't read the same is a finding,
and the matrix itself is the evidence — no static rule can produce it.

| Role | Home | Library | Deck | Settings | Statistics |
| --- | --- | --- | --- | --- | --- |
| section gap | | | | | |
| panel radius / padding | | | | | |
| primary action placement | | | | | |
| screen shell (gutter, tab clearance) | | | | | |
| empty state | | | | | |

## Phase 2 — measured pass

Static reading cannot see balance, clipping or overlap. Start the app and drive
it at three widths: **320** (smallest real phone), **768** (tablet), **1280+**
(desktop). Probe every route, not only the screen the user complained about —
the complaint is usually one instance of a pattern.

`references/measured-checks.md` has copy-paste probes for the checks that
actually catch things:

- horizontal overflow (`scrollWidth` vs `innerWidth`)
- **column balance** — bottom of each pane in a side-by-side row
- **tail gap** — distance from the last content to the viewport bottom, and
  whether something sits under a floating bar
- edge/gutter alignment across sections
- scroll containers — does the page actually reach its last row

Measure the settled frame. Reading `getBoundingClientRect` right after a scroll,
resize or route change returns stale numbers; wait ~400–500ms. Sampling
mid-animation fabricates findings (half-opacity text "fails" contrast, a control
briefly measures wrong). If a number looks impossible, re-measure it before
reporting it.

Carry widths through honestly: a 1280px desktop problem is usually not a phone
problem, and the mobile order must not change when the desktop layout does.
Re-verify the narrow layout after every wide-layout edit.

## Phase 3 — report

Order by severity × reach (how many screens the defect touches). Cap at roughly
a dozen findings; a wall of forty rows gets skimmed and nothing gets fixed.

| ID | Sev | Where | Symptom | Evidence | Law | Fix |
| --- | --- | --- | --- | --- | --- | --- |

Severity means something specific:

- **critical** — unusable or broken: content unreachable, controls overlap,
  overflow that hides a column.
- **high** — contradicts the documented law, or hides/misplaces content: a
  duplicate primitive, a wrong surface level, a column that ends early.
- **medium** — visible drift: off-grid spacing, invented radius, literal type
  size, a value that differs from its siblings.
- **low** — cosmetic or single-instance: manual width, one-off class, a
  deliberate exception worth naming.

Close with a short **what is consistent** list. It tells the reader what not to
touch during the fix, and it proves the audit covered the surface instead of
only hunting faults.

Write the report in the language the user is writing in, but keep the law's
vocabulary (token names, roles) untranslated — the fix will be in code.

## Phase 4 — fix and verify

Fix the smallest thing that removes the finding: swap the value for its token,
replace hand-rolled markup with the existing component, or restructure the
layout. Do not add a token to legitimise one screen — that turns drift into
policy. Do not restyle the app because one row was off; the diff should be as
small as the finding.

Then re-run the **same** measurement and quote before → after numbers, plus the
project's guards (`tsc`, token check, tests). A fix without a re-measured number
is a guess, and earlier passing results do not cover the new edit.

## Bundled resources

Run them from the project root; paths below are inside this skill folder:

- `scripts/scan-design-drift.mjs` — static drift scanner (Phase 1).
- `references/checks.md` — the full taxonomy: what each check looks like in a
  real codebase, and how Memora's tokens encode it.
- `references/measured-checks.md` — browser probes for balance, tail gap,
  overlap, overflow and cross-route parity.
