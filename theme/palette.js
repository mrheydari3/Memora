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
  outline: '#77839A',
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
  /** The only borders in the system. */
  hairline: 'rgba(146, 176, 214, 0.16)',
  hairlineStrong: 'rgba(146, 176, 214, 0.28)',
  /** Stacked layers behind the flashcard, and dashed empty frames. */
  hairlineFaint: 'rgba(146, 176, 214, 0.10)',
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
 */
const fills = {
  /** Dashed empty frames, the quietest surface. */
  subtle: 'rgba(255, 255, 255, 0.02)',
  /** Content nested inside another pane. */
  inset: 'rgba(255, 255, 255, 0.035)',
  /** Icon tiles and press feedback. */
  tile: 'rgba(255, 255, 255, 0.04)',
  /** Inputs, icon buttons, segmented rails. */
  control: 'rgba(255, 255, 255, 0.05)',
  /** Progress rails and meters. */
  track: 'rgba(255, 255, 255, 0.06)',
};

/** The lit 1px rim at the top of every pane, and the hairline on filled actions. */
const rims = {
  soft: 'rgba(255, 255, 255, 0.10)',
  faint: 'rgba(255, 255, 255, 0.14)',
  tile: 'rgba(255, 255, 255, 0.16)',
  strong: 'rgba(255, 255, 255, 0.20)',
};

/** Press veils animate opacity over this. */
const veil = '#000000';

const glass = {
  fill: 'rgba(20, 26, 36, 0.62)',
  strong: 'rgba(10, 14, 20, 0.82)',
  /** The blue tint of a hero/accent pane — one value for every selected pane. */
  accent: 'rgba(28, 52, 80, 0.56)',
  /** Floating tab capsule: base tint + the layer that pulls expo-blur back to ink. */
  tab: 'rgba(10, 14, 20, 0.55)',
  tabOverlay: 'rgba(10, 14, 20, 0.38)',
  /** The flashcard face reads a touch brighter than a normal pane. */
  cardFace: 'rgba(23, 30, 41, 0.72)',
  /** The two panes peeking out under the flashcard. */
  stackNear: 'rgba(13, 18, 26, 0.62)',
  stackFar: 'rgba(9, 13, 19, 0.55)',
  blur: 22,
  blurStrong: 26,
  blurTab: 75,
  saturate: 130,
  saturateStrong: 120,
};

/** Three soft colour fields behind every screen. */
const ambient = {
  blue: { web: 'rgba(0, 132, 255, 0.20)', native: 'rgba(0, 132, 255, 0.07)' },
  amber: { web: 'rgba(255, 200, 90, 0.10)', native: 'rgba(255, 200, 90, 0.05)' },
  green: { web: 'rgba(90, 220, 170, 0.10)', native: 'rgba(90, 220, 170, 0.04)' },
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
  iconSm: 32,
  icon: 38,
  iconLg: 44,
  tile: 38,
  tileLg: 44,
  avatar: 56,
  avatarLg: 64,
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
  /** Clears the floating tab capsule (48 + 20 inset + 36 gap). */
  tabClearance: 104,
  /** Bottom padding of a screen that has no tab bar. */
  screenBottom: 40,
};

const motion = {
  fast: 160,
  base: 260,
  slow: 420,
  flip: 480,
  spring: { speed: 45, bounciness: 0 },
};

/** Floating tab capsule geometry. */
const tabBar = { height: 48, itemWidth: 64, gutter: 20, pill: 34 };

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
  motion,
  tabBar,
};
