/**
 * Memora Design v2 — "Today first".
 *
 * This file holds only the geometry and type steps v2 introduces; every colour
 * still comes from `theme/palette.js` (and `theme/tokens.ts`). The v2 direction
 * is a home that answers "what do I study now?" before "what do I own?":
 *
 *   - the due number is the page's largest element, inside one glass pane
 *   - one action per screen, and it sits directly under that number
 *   - Home lists decks as full-width rows and filters them by folder
 *   - the hero and the list stack, so the list spans the whole content width
 *
 * v1 files do not import this module, so the current screens are untouched
 * until the direction is approved and rolled out.
 */

export const v2 = {
  /** Type steps that v1's 11–34px scale does not cover. */
  type: {
    display: { fontSize: 56, lineHeight: 58, letterSpacing: -2 },
    title: { fontSize: 30, lineHeight: 36, letterSpacing: -0.7 },
    headline: { fontSize: 22, lineHeight: 28, letterSpacing: -0.3 },
    stat: { fontSize: 28, lineHeight: 34, letterSpacing: -0.6 },
  },

  spacing: {
    /** Inner padding of the today pane; v1 used 20 for its hero card. */
    panel: 20,
    /** Between major regions; v1 used 28. */
    section: 32,
    /** Between a heading and the content it introduces. */
    block: 16,
    /** Deck-to-deck gap. */
    card: 12,
  },

  radii: {
    /**
     * Panes use the same 24 as `radii.pane` in v1; the 28 step belongs to the
     * bottom sheet, not to a screen panel. Today's pane, the deck queue and the
     * quiz board all read 28 here before, which made two radii for one role.
     */
    pane: 24,
    /** Deck row. */
    card: 22,
  },

  layout: {
    /** Home's reading column on desktop; v1 used 620. */
    contentMaxWidth: 960,
    /** The today column: the number, the rail and the action. */
    heroMeasure: 400,
  },

  rail: { height: 6 },
} as const;
