/**
 * Memora palette — the only file in the app holding raw visual values.
 *
 * `theme/tokens.ts` (TypeScript, programmatic styles) and `tailwind.config.js`
 * (utility classes) both derive from here, so a colour can never drift between
 * the two. Nothing outside `theme/` may write a hex or rgba literal; the
 * `check:design` script enforces that.
 *
 * The language: one ink canvas, one accent, hairline strokes, frosted panes.
 */

const colors = {
  background: '#07090E',
  surface: '#0C1017',
  surfaceDim: '#090C12',
  surfaceBright: '#1A2230',
  surfaceContainerLowest: '#05070B',
  surfaceContainerLow: '#0A0E15',
  surfaceContainer: '#11161F',
  surfaceContainerHigh: '#18202B',
  surfaceContainerHighest: '#202A38',
  onSurface: '#DCE2EB',
  onSurfaceVariant: '#A2ACBC',
  inverseSurface: '#E8EDF4',
  inverseOnSurface: '#141A22',
  /**
   * Tertiary text and quiet glyphs. Raised from #77839A: at 11px a caption sat
   * at ~5.0:1 on the canvas but fell under 4.5:1 once it landed on a frosted
   * pane, which axe reported as a serious contrast failure. This step is ~6.5:1
   * on ink and still ~5:1 on the accent pane.
   */
  outline: '#8B97A9',
  /** Unlit stars and other deliberately quiet glyphs. */
  outlineSoft: '#3A4453',
  outlineVariant: 'rgba(146, 176, 214, 0.16)',
  primary: '#7CBBFF',
  onPrimary: '#04121F',
  primaryContainer: '#2F86E0',
  onPrimaryContainer: '#03121F',
  inversePrimary: '#0B5FA8',
  secondary: '#C9D3E0',
  onSecondary: '#1A2230',
  secondaryContainer: '#222C3A',
  onSecondaryContainer: '#C4CEDB',
  tertiary: '#C9D3E0',
  onTertiary: '#1A2230',
  tertiaryContainer: '#94A0B2',
  error: '#F08C8C',
  onError: '#2A0505',
  errorContainer: '#5C1A1A',
  onErrorContainer: '#FFD9D9',
  success: '#5FD39A',
  warning: '#F1C75B',
  /** Informational accent for data and storage states. */
  info: '#6FD6E5',
  surfaceVariant: '#202A38',
  /**
   * The only line colours left in the system, for the four cases that still
   * draw one: a focus ring, a dashed empty frame, the radio dot and a thin
   * decorative rule. Nothing else in the app is outlined.
   */
  hairlineStrong: 'rgba(146, 176, 214, 0.28)',
  /** Shimmer sweep and quiet fills — a wash, never a line. */
  hairlineGhost: 'rgba(146, 176, 214, 0.07)',
  /** Accent washes: faint = avatars/hero glyphs, soft = chips, active = selection. */
  accentFaint: 'rgba(124, 187, 255, 0.10)',
  accentSoft: 'rgba(124, 187, 255, 0.12)',
  accentLine: 'rgba(124, 187, 255, 0.34)',
  accentActive: 'rgba(124, 187, 255, 0.14)',
};

/**
 * Neutral white layers. Five roles only — every translucent fill in the app is
 * one of these, so a tile never reads darker on one screen than another.
 *
 * Since the app separates surfaces by fill (not by outline), these steps carry
 * the whole depth scale: each is one perceptible step lighter than its parent.
 */
const fills = {
  /** Dashed empty frames, the quietest surface. */
  subtle: 'rgba(255, 255, 255, 0.022)',
  /** Content nested inside another pane. */
  inset: 'rgba(255, 255, 255, 0.04)',
  /** Icon tiles, chips and press feedback. */
  tile: 'rgba(255, 255, 255, 0.05)',
  /** Inputs, icon buttons, segmented rails. */
  control: 'rgba(255, 255, 255, 0.06)',
  /** Progress rails and meters. */
  track: 'rgba(255, 255, 255, 0.07)',
};

/** The single lit 1px rim a pane may carry at its top edge. */
const rims = {
  soft: 'rgba(255, 255, 255, 0.08)',
  /** The same light, at tile scale (rating keys). */
  tile: 'rgba(255, 255, 255, 0.12)',
};

/** Press veils animate opacity over this. */
const veil = '#000000';

const glass = {
  // Opaque by design: with the blur gone there is no frosted layer to hide
  // behind, so a pane must not let the page read through it.
  fill: '#141a24',
  strong: '#0a0e14',
  /**
   * The top app bar. One fifth of the pane ink, so the page scrolls visibly
   * underneath it instead of disappearing behind a solid strip.
   */
  appBar: 'rgba(10, 14, 20, 0.20)',
  /** The blue tint of a hero/accent pane — one value for every selected pane. */
  accent: '#1c3450',
  /**
   * Floating icon-only tab capsule: a near-black ink tint plus the layer that
   * pulls expo-blur back to the app's navy. Opaque enough to stay fully dark
   * over bright content, while the strong blur still softens the edge.
   */
  tab: 'rgba(6, 9, 15, 0.55)',
  tabOverlay: 'rgba(0, 0, 0, 0.22)',
  /** The flashcard face reads a touch brighter than a normal pane. */
  cardFace: '#171e29',
  /**
   * The sheet face. Nearly opaque on purpose: a sheet carries text over a live
   * page, and 0.82 let a large heading behind it read through the rows.
   */
  sheet: '#090d13',
  /** The two panes peeking out under the flashcard. */
  stackNear: '#0d121a',
  stackFar: '#090d13',
  // The dock is the one surface that keeps its blur: iOS reads it as material
  // behind the interface rather than as a painted strip.
  blur: 0,
  blurStrong: 0,
  blurTab: 80,
  /** The selection lens: a denser blur than the rail around it. */
  blurLens: 40,
  /**
   * The lens wash. It is the lens's opacity: an accent tint laid over the blur,
   * not a white highlight, so the active tile reads solid without a sheen.
   */
  lensWash: 'rgba(124, 187, 255, 0.20)',
  saturate: 100,
  saturateStrong: 100,
};

/** Radii by role: controls 14, panes 24, sheets 28, pills full. */
const radii = {
  /** The inner track of a 14px control. */
  micro: 10,
  sm: 6,
  control: 14,
  pane: 24,
  sheet: 28,
  pill: 9999,
};

/** Control and row heights. Nothing measures itself with a magic number. */
const heights = {
  appbar: 56,
  rowCompact: 56,
  row: 60,
  rowTall: 68,
  field: 44,
  fieldTall: 48,
  buttonSm: 48,
  button: 52,
  /** Minimum interactive area for any control, however small it draws. */
  hit: 44,
  iconSm: 32,
  icon: 38,
  iconLg: 44,
  /** Quiz answer option and the study screen's rating tiles. */
  quizAnswer: 64,
  ratingTile: 68,
  tile: 38,
  tileLg: 44,
  avatar: 56,
  avatarLg: 64,
  /** Minimum height of a My decks tree row. */
  deckSlab: 96,
  toggle: 26,
  toggleWidth: 46,
  studyFooter: 108,
  sheetList: 360,
  sheetTall: 500,
  sheetCompact: 320,
};

/** Six icon steps. MaterialIcons sizes come from here, never a raw number. */
const iconSize = {
  xs: 13,
  sm: 16,
  md: 18,
  lg: 20,
  xl: 22,
  /** The bottom dock's glyphs: one step up from xl, sized for a taller capsule. */
  nav: 24,
  display: 28,
};

/** size / line-height / tracking. Weight lives in the Inter family class. */
const typography = {
  display: { fontSize: 34, lineHeight: 40, letterSpacing: -1 },
  title: { fontSize: 26, lineHeight: 32, letterSpacing: -0.5 },
  headline: { fontSize: 20, lineHeight: 27, letterSpacing: -0.2 },
  bodyLg: { fontSize: 17, lineHeight: 25, letterSpacing: 0 },
  body: { fontSize: 15, lineHeight: 22, letterSpacing: 0 },
  bodySm: { fontSize: 13, lineHeight: 20, letterSpacing: 0 },
  label: { fontSize: 12, lineHeight: 16, letterSpacing: 0.6 },
  // 12px is the floor for any text that carries meaning. The old 11px caption
  // was below the legibility floor on every screen that used it for meta.
  caption: { fontSize: 12, lineHeight: 17, letterSpacing: 0.3 },
};

const weights = {
  display: '700',
  title: '700',
  headline: '600',
  bodyLg: '400',
  body: '400',
  bodySm: '400',
  label: '600',
  caption: '500',
};

/** Depth by role: a pane sits, an action lifts, the flashcard floats. */
const shadows = {
  // Flat UI: nothing in the app casts a shadow. Every role stays declared so a
  // caller keeps its token name, but each one resolves to no shadow at all.
  pane: 'none',
  action: 'none',
  tile: 'none',
  floating: 'none',
  card: 'none',
  liquidTab: 'none',
};

/**
 * One meaning, one colour. The deck rail, the card ledger, the statistics donut
 * and every legend read from this map — a state never changes hue per screen.
 */
const stateColors = {
  New: 'rgba(146, 176, 214, 0.38)',
  Learning: colors.warning,
  Relearning: colors.warning,
  Review: colors.success,
};

const spacing = {
  screen: 20,
  gutter: 16,
  row: 16,
  section: 28,
  /** Legend text aligns under its dot (10px dot + 8px gap). */
  legendIndent: 18,
  /** Inner padding of the flashcard, one step wider than a pane's 20. */
  cardPad: 24,
  /** Clears the floating tab capsule (64 + 16 inset + 32 gap). */
  tabClearance: 112,
  /** Bottom padding of a screen that has no tab bar. */
  screenBottom: 40,
};

/**
 * Page geometry that used to be a raw number per screen: one content column,
 * one card proportion, one chart size. Wide screens cap themselves with these.
 */
const layout = {
  /** The reading column on wide screens; phones are narrower than this. */
  contentMaxWidth: 620,
  /** The quiz result panel: a short column, not a page. */
  resultMaxWidth: 420,
  /** The flashcard's prompt and its narrower answer measure. */
  cardMeasure: 520,
  answerMeasure: 480,
  /** Deck gallery card proportions. */
  cardRatio: 0.8,
  cardMinHeight: 300,
  cardMaxHeight: 460,
  /** Statistics donut. */
  donut: 124,
  /** Achievement badge column. */
  badgeColumn: 72,
  /** Splash mark and its loading rail. */
  splashMark: 76,
  splashRail: 132,
};

/**
 * Bottom-sheet geometry and scrim.
 *
 * A sheet lifts over a blurred canvas instead of a flat dim: the scrim is a
 * frosted layer, so the page behind reads as depth rather than as competing
 * content. The panel itself can be pulled down to `minHeightRatio` of the
 * viewport, and a release past that floor dismisses it.
 */
const sheet = {
  /** No blur behind a sheet; the scrim is a flat ink wash. */
  scrimBlur: 0,
  /** Ink wash behind a sheet: deep enough that the page reads as background. */
  scrimDim: 0.78,
  /** Share of the viewport a sheet may grow to. */
  maxHeightRatio: 0.94,
  /** Share of the viewport a short sheet still occupies: sheets read tall. */
  minHeightRatio: 0.46,
  /** How far past the floor a release must travel to close instead of snap. */
  closeOverscroll: 40,
  /** A sheet always keeps at least this much travel to shrink, in px. */
  minShrink: 72,
  /** No floor may go below this, so the grab handle and title stay usable. */
  minDragHeight: 120,
  /**
   * The body keeps at least one row of room. The floor is derived from the
   * panel's own chrome, so a short sheet stops while its content is readable.
   */
  minBody: 56,
  /**
   * A height to measure against when the browser reports none (a PWA restored
   * in the background, an embedded webview before its first layout). Roughly a
   * small phone, so a sheet still opens at a usable size.
   */
  fallbackViewport: 640,
  /** The grab handle: quiet at rest, wider while held. */
  handleWidth: 44,
  handleActiveWidth: 58,
  handleHeight: 4,
};

const motion = {
  fast: 160,
  base: 260,
  slow: 420,
  flip: 480,
  spring: { speed: 45, bounciness: 0 },
  /** The bouncy settle the liquid-glass tab lens uses (the HTML spring). */
  liquidSpring: { speed: 20, bounciness: 9 },
};

/**
 * Floating tab capsule geometry.
 *
 * Deliberately narrow and tall: a compact dock (300px ceiling) that is 64px
 * high, so the glyphs sit in a 52px pill instead of being squeezed by a wide,
 * shallow bar.
 */
const tabBar = {
  /**
   * The dock is sized by its content, not by the viewport: three fixed cells
   * plus the rail's padding. A percentage width made the same dock look narrow
   * on phones and stretched on tablets, and it forced the selection tile to
   * float inside a slot wider than itself.
   */
  cell: 88,
  height: 64,
  /**
   * The dock's ceiling. Three full cells plus padding is 276; the extra room is
   * for a label that grows (200% text size) so the tab widens instead of
   * truncating its caption.
   */
  maxWidth: 300,
  gutter: 12,
  padding: 6,
  /** The tappable tile that holds one glyph and its caption. */
  pill: 52,
  /** Half a tile's height (52 / 2): the selection tile is a pill, fully round. */
  tileRadius: 26,
};

module.exports = {
  colors,
  fills,
  rims,
  veil,
  glass,
  radii,
  heights,
  iconSize,
  typography,
  weights,
  shadows,
  stateColors,
  spacing,
  layout,
  sheet,
  motion,
  tabBar,
};
