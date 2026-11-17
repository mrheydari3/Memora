/**
 * Memora Design v4 — "Library Desk".
 *
 * The direction is a printed index rather than a card board: an editorial
 * serif masthead, a flat single-column list, warm hairlines, a 3px deck spine,
 * and one saffron due figure per row. Your decks is the only region on v4;
 * the Today hero, the app bar and the tab dock keep their v3 chrome.
 *
 * Colours live in `theme/palette.js`. Only measurements and the serif stack are
 * here, and display type is emitted in rem on web so 200% browser text really
 * doubles it.
 */

import { Platform } from 'react-native';

const size = (px: number): number =>
  Platform.OS === 'web' ? ((`${px / 16}rem` as unknown) as number) : px;

/**
 * The edge serif. Instrument Serif is served as a static web face from
 * `public/fonts`; native has no bundled serif, so it falls back to the
 * platform's old-style book face.
 */
export const serifFamily =
  Platform.OS === 'web'
    ? "'InstrumentSerif', 'Iowan Old Style', Georgia, serif"
    : Platform.OS === 'ios'
      ? 'Georgia'
      : 'serif';

export const v4 = {
  font: {
    serif: serifFamily,
  },

  type: {
    /** The page masthead: 40 on a phone, 56 from 760px up. */
    masthead: { fontSize: size(40), lineHeight: size(39), letterSpacing: -0.72 },
    mastheadWide: { fontSize: size(56), lineHeight: size(55), letterSpacing: -1 },
    /** A section title, e.g. "Folders". */
    section: { fontSize: size(25), lineHeight: size(28), letterSpacing: -0.25 },
    /** A root folder's name. */
    folderName: { fontSize: size(15.5), lineHeight: size(20), letterSpacing: -0.08 },
    folderMeta: { fontSize: size(12), lineHeight: size(17), letterSpacing: 0 },
    /** A deck name: 16 on a phone, 17 from 760px up. */
    deckName: { fontSize: size(16), lineHeight: size(21), letterSpacing: -0.11 },
    deckNameWide: { fontSize: size(17), lineHeight: size(22), letterSpacing: -0.12 },
    /** Card and scheduler meta, path lines and legends. */
    deckMeta: { fontSize: size(12), lineHeight: size(17), letterSpacing: 0 },
    legend: { fontSize: size(12), lineHeight: size(17), letterSpacing: 0 },
    /** The masthead summary line. */
    summary: { fontSize: size(12.5), lineHeight: size(18), letterSpacing: 0 },
    summaryWide: { fontSize: size(13), lineHeight: size(19), letterSpacing: 0 },
    /** The due numeral: a deck 34→38, a folder 24, a subfolder 20. */
    dueDeck: { fontSize: size(34), lineHeight: size(29), letterSpacing: -0.68 },
    dueDeckWide: { fontSize: size(38), lineHeight: size(33), letterSpacing: -0.76 },
    dueFolder: { fontSize: size(24), lineHeight: size(21), letterSpacing: -0.48 },
    dueSubfolder: { fontSize: size(20), lineHeight: size(17), letterSpacing: -0.4 },
    dueLabel: { fontSize: size(12), lineHeight: size(14), letterSpacing: 0.24 },
    /** Utility copy: filters, archive, empty folder, vault note. */
    control: { fontSize: size(13), lineHeight: size(18), letterSpacing: 0 },
    meta: { fontSize: size(12.5), lineHeight: size(18), letterSpacing: 0 },
  },

  layout: {
    /** Space between the tools row and the first section. */
    sectionGap: 38,
    sectionGapWide: 44,
    /** Space between the masthead and its tools. */
    toolsGap: 24,
    toolsGapWide: 28,
    /** The folder body's guide line and indent. */
    folderIndent: 34,
    folderGuideInset: 9,
    folderIndentWide: 46,
    folderGuideInsetWide: 11,
    /** Row copy stops here, even on a wide canvas. */
    deckBodyMax: 640,
    /** The mastery rail's ceiling. */
    railMax: 250,
    /** The quiet trailing zone that keeps the menu clear of the due figure. */
    optionsZone: 30,
    /** The due column's own inset from the row's right edge. */
    dueInset: 14,
    /** The archive's top rule. */
    archiveGap: 44,
    /** The vault note's breathing room. */
    vaultGap: 26,
    /** Wide canvas: the masthead and summary share one baseline row. */
    mastheadGrid: 980,
    /** Wide canvas: type and row measurements step up. */
    wide: 760,
  },

  due: {
    deckMinWidth: 52,
    deckMinWidthWide: 64,
    folderMinWidth: 52,
    subfolderMinWidth: 42,
    /** Keeps the numeral clear of the options target. */
    labelGap: 4,
    folderLabelGap: 3,
    subfolderLabelGap: 2,
  },

  rail: {
    height: 3,
    gap: 2,
    radius: 2,
    marginTop: 11,
    dot: 5,
    legendGap: 8,
  },

  spine: {
    width: 3,
    minHeight: 42,
    radius: 2,
    marginTop: 2,
    gap: 14,
    gapWide: 18,
  },

  row: {
    paddingTop: 15,
    paddingBottom: 16,
    paddingTopWide: 17,
    paddingBottomWide: 18,
    folderPadding: 15,
    folderPaddingWide: 17,
    subfolderPadding: 13,
  },

  control: {
    /** The visual height of the search field and filters. */
    field: 44,
    filter: 38,
    filterRadius: 9,
    filterPad: 13,
    filterGap: 2,
    searchRadius: 12,
    searchPad: 13,
    searchIconGap: 10,
    actionGap: 8,
    actionGapWide: 10,
    sectionHeadGap: 10,
    sectionHeadPad: 9,
  },

  archive: {
    icon: 15,
    gap: 10,
    padding: 16,
    chevron: 15,
  },

  /** The list skeleton's geometry. */
  skeleton: {
    mastheadHeight: 46,
    summaryHeight: 14,
    fieldHeight: 44,
    sectionHeight: 30,
    folderHeight: 54,
    deckHeight: 76,
    indent: 34,
  },
} as const;
