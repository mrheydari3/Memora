/**
 * Memora Design v3 — "Nocturne Focus".
 *
 * Only the steps v3 introduces live here; colours still come from
 * `theme/palette.js`. The direction keeps v2's "today first" order but makes the
 * page read as one quiet desk: a single hero pane that states the day and its
 * one action, then a shelf where folders are collapsible groups and a deck row
 * answers name, studied share and due count in one line.
 *
 *   - the due figure is 40px on a phone and 56px from 900px up
 *   - the hero pane carries a live scheduler status and the next deck's rail
 *   - deck rows are 22px panes with a 44px glyph tile
 *   - folder headers are 14px inset controls, not panes
 *
 * v1/v2 screens do not import this module, so they are untouched.
 */

export const v3 = {
  type: {
    /** The page's one display figure on a phone. */
    hero: { fontSize: 40, lineHeight: 44, letterSpacing: -1.4 },
    /** The same figure on a wide canvas (≥ 900px). */
    heroWide: { fontSize: 56, lineHeight: 58, letterSpacing: -2 },
    /** A deck's due count. */
    stat: { fontSize: 28, lineHeight: 30, letterSpacing: -0.6 },
    /** Deck names sit one step above body and one below the section title. */
    deckName: { fontSize: 17, lineHeight: 24, letterSpacing: 0 },
    /** A section-opening line, e.g. the Game hero's "Beat the clock.". */
    headlineMd: { fontSize: 24, lineHeight: 30, letterSpacing: -0.5 },
  },

  spacing: {
    /** Inner padding of the today pane. */
    panel: 20,
    /** Between the hero and the shelf, and between shelf groups. */
    section: 20,
    /** Between a group header and the rows it holds. */
    group: 10,
    /** Between two deck rows. */
    row: 8,
  },

  radii: {
    /** A deck's glyph tile. */
    tile: 12,
    /** Folder headers and the due tile. */
    control: 14,
    /** Deck rows and folder containment. */
    card: 22,
    /** The hero pane. */
    pane: 24,
  },

  rail: {
    /** The hero's New/Learning/Review rail. */
    hero: 6,
    /** A deck row's studied share. */
    deck: 4,
  },

  layout: {
    /** The reading column on a wide canvas. */
    contentMaxWidth: 960,
    /** A deck row's studied rail stops here, so its % never sits under the due tile. */
    deckRail: 220,
  },
} as const;
