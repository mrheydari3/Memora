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

import { Platform } from 'react-native';

/**
 * Type steps inherit the browser's text size.
 *
 * AppText's scale is rem-based through Tailwind, but the v3 display figures are
 * inline styles. In px they ignored a 200% browser text zoom (the audit caught
 * the Game hero's "60" staying at 40px). On web the step is emitted in rem so
 * the user's preference really doubles it; native keeps logical pixels.
 */
const size = (px: number): number =>
  Platform.OS === 'web' ? ((`${px / 16}rem` as unknown) as number) : px;

export const v3 = {
  type: {
    /** The page's one display figure on a phone. */
    hero: { fontSize: size(40), lineHeight: size(44), letterSpacing: -1.4 },
    /** The same figure on a wide canvas (≥ 900px). */
    heroWide: { fontSize: size(56), lineHeight: size(58), letterSpacing: -2 },
    /** A deck's due count. */
    stat: { fontSize: size(28), lineHeight: size(30), letterSpacing: -0.6 },
    /** Deck names sit one step above body and one below the section title. */
    deckName: { fontSize: size(17), lineHeight: size(24), letterSpacing: 0 },
    /** A section-opening line, e.g. the Game hero's "Beat the clock.". */
    headlineMd: { fontSize: size(24), lineHeight: size(30), letterSpacing: -0.5 },
    /** The composer's prompt: the card's front, written on the card itself. */
    composerFront: { fontSize: size(30), lineHeight: size(36), letterSpacing: -0.7 },
    /** The quiz's live score. */
    score: { fontSize: size(44), lineHeight: size(48), letterSpacing: -1.6 },
    /** The quiz's final score. */
    result: { fontSize: size(64), lineHeight: size(68), letterSpacing: -2.24 },
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
    /** Between major page regions. */
    page: 28,
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
    /** A compact quiz HUD tile. */
    quizTile: 16,
  },

  rail: {
    /** The hero's New/Learning/Review rail. */
    hero: 6,
    /** A deck row's studied share. */
    deck: 4,
    /** The Statistics activity chart's tallest bar. */
    activity: 64,
    /** Its 92px plot, including the value and label rows. */
    activityPlot: 92,
    /** The shortest visible activity bar. */
    activityMin: 4,
    /** A Study habits weekday cell. */
    habit: 38,
    /** The Next 7 days chart on a phone. */
    forecast: 84,
    /** …and on a wide canvas. */
    forecastWide: 96,
  },

  heights: {
    /** One study rating key. */
    ratingKey: 80,
    /** One quiz answer pad. */
    answer: 64,
    /** The quiz arena's compact answer pad. */
    quizAnswer: 72,
    /** The quiz question stage. */
    quizQuestion: 190,
    /** The quiz's three-tile HUD. */
    quizHud: 72,
  },

  layout: {
    /** The reading column on a wide canvas. */
    contentMaxWidth: 960,
    /** The card composer is one card wide, not one page wide. */
    composerMaxWidth: 420,
    /** A deck row's studied rail stops here, so its % never sits under the due tile. */
    deckRail: 220,
    /** The study stage and summary column. */
    studyMeasure: 760,
    /** The quiz session column. */
    quizMeasure: 440,
    /** One study card; the reference stays narrower than the page column. */
    studyCard: 448,
  },
} as const;
