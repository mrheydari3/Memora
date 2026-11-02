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
  onSurface: '#F2F5F9',
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
  subtle: 'rgba(255, 255, 255, 0.03)',
  /** Content nested inside another pane. */
  inset: 'rgba(255, 255, 255, 0.05)',
  /** Icon tiles, chips and press feedback. */
  tile: 'rgba(255, 255, 255, 0.06)',
  /** Inputs, icon buttons, segmented rails. */
  control: 'rgba(255, 255, 255, 0.075)',
  /** Progress rails and meters. */
  track: 'rgba(255, 255, 255, 0.09)',
};

/** The single lit 1px rim a pane may carry at its top edge. */
const rims = {
  soft: 'rgba(255, 255, 255, 0.10)',
  /** The same light, at tile scale (rating keys). */
  tile: 'rgba(255, 255, 255, 0.16)',
};

/** Press veils animate opacity over this. */
const veil = '#000000';

const glass = {
  fill: 'rgba(20, 26, 36, 0.62)',
  strong: 'rgba(10, 14, 20, 0.82)',
  /** The blue tint of a hero/accent pane — one value for every selected pane. */
  accent: 'rgba(28, 52, 80, 0.56)',
  /**
   * Floating icon-only tab capsule: a near-black ink tint plus the layer that
   * pulls expo-blur back to the app's navy. Opaque enough to stay fully dark
   * over bright content, while the strong blur still softens the edge.
   */
  tab: 'rgba(3, 6, 10, 0.84)',
  tabOverlay: 'rgba(0, 0, 0, 0.28)',
  /** The flashcard face reads a touch brighter than a normal pane. */
  cardFace: 'rgba(23, 30, 41, 0.72)',
  /** The two panes peeking out under the flashcard. */
  stackNear: 'rgba(13, 18, 26, 0.62)',
  stackFar: 'rgba(9, 13, 19, 0.55)',
  blur: 22,
  blurStrong: 26,
  blurTab: 100,
  saturate: 130,
  saturateStrong: 120,
};

/**
 * Three soft colour fields behind every screen. Deep and low-alpha so the
 * canvas stays dark; the motion layer drifts and breathes them slowly.
 */
const ambient = {
  blue: { web: 'rgba(0, 132, 255, 0.18)', native: 'rgba(0, 132, 255, 0.06)' },
  amber: { web: 'rgba(255, 200, 90, 0.09)', native: 'rgba(255, 200, 90, 0.045)' },
  green: { web: 'rgba(90, 220, 170, 0.09)', native: 'rgba(90, 220, 170, 0.035)' },
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
  rowCompact: 52,
  row: 58,
  rowTall: 66,
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
  caption: { fontSize: 11, lineHeight: 15, letterSpacing: 0.4 },
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
  pane: '0 10px 28px rgba(0, 0, 0, 0.24)',
  /** A neutral lift: the primary action is separated by its rim, not a halo. */
  action: '0 8px 18px rgba(0, 0, 0, 0.34)',
  tile: '0 8px 18px rgba(0, 0, 0, 0.30)',
  floating: '0 10px 24px rgba(0, 0, 0, 0.40)',
  card: '0 24px 56px rgba(0, 0, 0, 0.50)',
  /**
   * The borderless liquid-glass capsule: one far ambient shadow, one tighter
   * contact shadow and a hairline grounding shadow, so the edge is defined by
   * light and depth rather than a stroke.
   */
  liquidTab:
    '0 18px 44px rgba(0, 0, 0, 0.42), 0 6px 16px rgba(0, 0, 0, 0.26), 0 1px 3px rgba(0, 0, 0, 0.18)',
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

const motion = {
  fast: 160,
  base: 260,
  slow: 420,
  flip: 480,
  spring: { speed: 45, bounciness: 0 },
  /** The bouncy settle the liquid-glass tab lens uses (the HTML spring). */
  liquidSpring: { speed: 20, bounciness: 9 },
};

/** Floating liquid-glass tab capsule geometry. */
const tabBar = {
  height: 60,
  maxWidth: 300,
  gutter: 16,
  padding: 6,
  pill: 48,
};

module.exports = {
  colors,
  fills,
  rims,
  veil,
  glass,
  ambient,
  radii,
  heights,
  iconSize,
  typography,
  weights,
  shadows,
  stateColors,
  spacing,
  layout,
  motion,
  tabBar,
};
