/**
 * Memora Design System — theme tokens.
 *
 * Every value here comes from `theme/palette.js`, which is also what
 * `tailwind.config.js` reads, so classes and programmatic styles cannot drift.
 * Prefer Tailwind classes in JSX; use these constants only where Tailwind
 * cannot reach (SVG, Animated, StyleSheet, icon colours, measured geometry).
 *
 * The standard is one ink canvas, one accent, hairline strokes, frosted panes.
 * Nothing in the app should introduce a colour that is not listed here.
 */

import { Platform } from 'react-native';
import type { ViewStyle } from 'react-native';

type Palette = {
  colors: Record<
    | 'background'
    | 'surface'
    | 'surfaceDim'
    | 'surfaceBright'
    | 'surfaceContainerLowest'
    | 'surfaceContainerLow'
    | 'surfaceContainer'
    | 'surfaceContainerHigh'
    | 'surfaceContainerHighest'
    | 'onSurface'
    | 'onSurfaceVariant'
    | 'inverseSurface'
    | 'inverseOnSurface'
    | 'outline'
    | 'outlineSoft'
    | 'outlineVariant'
    | 'primary'
    | 'onPrimary'
    | 'primaryContainer'
    | 'onPrimaryContainer'
    | 'inversePrimary'
    | 'secondary'
    | 'onSecondary'
    | 'secondaryContainer'
    | 'onSecondaryContainer'
    | 'tertiary'
    | 'onTertiary'
    | 'tertiaryContainer'
    | 'error'
    | 'onError'
    | 'errorContainer'
    | 'onErrorContainer'
    | 'success'
    | 'warning'
    | 'surfaceVariant'
    | 'hairlineStrong'
    | 'hairlineGhost'
    | 'accentFaint'
    | 'accentSoft'
    | 'accentLine'
    | 'accentActive',
    string
  >;
  fills: Record<'subtle' | 'inset' | 'tile' | 'control' | 'track', string>;
  rims: Record<'soft' | 'tile', string>;
  veil: string;
  glass: {
    fill: string;
    strong: string;
    appBar: string;
    accent: string;
    tab: string;
    tabOverlay: string;
    cardFace: string;
    sheet: string;
    stackNear: string;
    stackFar: string;
    blur: number;
    blurStrong: number;
    blurTab: number;
    blurLens: number;
    lensWash: string;
    saturate: number;
    saturateStrong: number;
  };
  radii: Record<'micro' | 'sm' | 'control' | 'pane' | 'sheet' | 'pill', number>;
  heights: Record<
    | 'appbar'
    | 'rowCompact'
    | 'row'
    | 'rowTall'
    | 'field'
    | 'fieldTall'
    | 'buttonSm'
    | 'button'
    | 'iconSm'
    | 'icon'
    | 'iconLg'
    | 'quizAnswer'
    | 'ratingTile'
    | 'hit'
    | 'tile'
    | 'tileLg'
    | 'avatar'
    | 'avatarLg'
    | 'deckSlab'
    | 'toggle'
    | 'toggleWidth'
    | 'studyFooter'
    | 'sheetList'
    | 'sheetTall'
    | 'sheetCompact',
    number
  >;
  iconSize: Record<'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'nav' | 'display', number>;
  typography: Record<
    'display' | 'title' | 'headline' | 'bodyLg' | 'body' | 'bodySm' | 'label' | 'caption',
    { fontSize: number; lineHeight: number; letterSpacing: number }
  >;
  weights: Record<
    'display' | 'title' | 'headline' | 'bodyLg' | 'body' | 'bodySm' | 'label' | 'caption',
    string
  >;
  shadows: Record<'pane' | 'action' | 'tile' | 'floating' | 'card' | 'liquidTab', string>;
  stateColors: Record<'New' | 'Learning' | 'Relearning' | 'Review', string>;
  spacing: Record<
    | 'screen'
    | 'gutter'
    | 'row'
    | 'section'
    | 'tabClearance'
    | 'screenBottom'
    | 'legendIndent'
    | 'cardPad',
    number
  >;
  layout: {
    contentMaxWidth: number;
    resultMaxWidth: number;
    cardMeasure: number;
    answerMeasure: number;
    cardRatio: number;
    cardMinHeight: number;
    cardMaxHeight: number;
    donut: number;
    badgeColumn: number;
    splashMark: number;
    splashRail: number;
  };
  motion: {
    fast: number;
    base: number;
    slow: number;
    flip: number;
    spring: { speed: number; bounciness: number };
    liquidSpring: { speed: number; bounciness: number };
  };
  sheet: {
    scrimBlur: number;
    scrimDim: number;
    maxHeightRatio: number;
    minHeightRatio: number;
    closeOverscroll: number;
    minShrink: number;
    minDragHeight: number;
    minBody: number;
    fallbackViewport: number;
    handleWidth: number;
    handleActiveWidth: number;
    handleHeight: number;
  };
  tabBar: {
    cell: number;
    height: number;
    maxWidth: number;
    gutter: number;
    padding: number;
    pill: number;
    tileRadius: number;
  };
};

// palette.js is plain CommonJS so tailwind.config.js can require it too.
const palette = require('./palette.js') as Palette;

export const colors = palette.colors;
export const fills = palette.fills;
export const rims = palette.rims;
export const veil = palette.veil;
export const glass = palette.glass;
export const radii = palette.radii;
export const heights = palette.heights;
export const iconSize = palette.iconSize;
export const typography = palette.typography;
export const weights = palette.weights;
export const stateColors = palette.stateColors;
export const spacing = palette.spacing;
export const layout = palette.layout;
export const motion = palette.motion;
export const sheet = palette.sheet;
export const tabBar = palette.tabBar;

/** Depth by role. */
export const shadow = palette.shadows;

/** The blue tint of a hero/accent pane. */
export const paneAccent = glass.accent;

/**
 * The frosted pane fill, shared by every pane, the app bar, the tab bar and the
 * rating tiles so every surface reads the same. The fill is opaque — there is no
 * to the DOM; React Native's style types don't include it, hence the cast.
 */
const isWeb = Platform.OS === 'web';

/**
 * The frosted-pane filter, with the vendor prefix Safari needed before 18.
 *
 * Measured in the audit engines: Chromium 156 and Firefox 157 support the
 * unprefixed property and ignore the prefix; WebKit 27 supports both, and older
 * Safari only the prefix — so writing both is the fallback, with the standard
 * property last so it wins where it is understood.
 */
const backdrop = (_blur: number, _saturate: number) => ({}) as ViewStyle;

export const glassFill: ViewStyle = {
  backgroundColor: glass.fill,
  ...(isWeb ? backdrop(glass.blur, glass.saturate) : {}),
};

export const glassFillStrong: ViewStyle = {
  backgroundColor: glass.strong,
  ...(isWeb ? backdrop(glass.blurStrong, glass.saturateStrong) : {}),
};

/**
 * The top app bar: the pane ink at a fifth of its weight, so the body scrolls
 * visibly underneath the bar instead of vanishing behind a solid strip.
 */
export const glassFillAppBar: ViewStyle = {
  backgroundColor: glass.appBar,
};

/** The lit 1px rim used at the top of every pane. */
export const rimColor = rims.soft;

/** Helper: apply alpha to a hex color. */
export function alpha(hex: string, a: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
}

/** Helper: lighten a hex color toward white. */
export function tint(hex: string, ratio: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const nr = Math.round(r + (255 - r) * ratio);
  const ng = Math.round(g + (255 - g) * ratio);
  const nb = Math.round(b + (255 - b) * ratio);
  return `#${nr.toString(16).padStart(2, '0')}${ng.toString(16).padStart(2, '0')}${nb
    .toString(16)
    .padStart(2, '0')}`;
}
