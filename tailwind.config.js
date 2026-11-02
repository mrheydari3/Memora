const p = require('./theme/palette.js');

/** onSurfaceVariant → on-surface-variant, so palette keys become utility names. */
const kebab = (key) => key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);

/** Palette colours + the neutral fill roles, all available as utilities. */
const colors = {
  ...Object.fromEntries(Object.entries(p.colors).map(([key, value]) => [kebab(key), value])),
  ...Object.fromEntries(Object.entries(p.fills).map(([key, value]) => [`fill-${key}`, value])),
};

/**
 * The eight-step type scale; each step carries its own line-height and tracking.
 *
 * Sizes are emitted in `rem`, not `px`: a browser text zoom of 200% then really
 * doubles the type (WCAG 1.4.4) instead of leaving a 15px label at 15px. Native
 * is unaffected — `metro.config.js` sets NativeWind's `inlineRem` to 16, so
 * 0.9375rem resolves to exactly 15dp on a phone.
 */
const rem = (value) => `${Number((value / 16).toFixed(4))}rem`;

const fontSize = Object.fromEntries(
  Object.entries(p.typography).map(([key, value]) => [
    kebab(key),
    [
      rem(value.fontSize),
      { lineHeight: rem(value.lineHeight), letterSpacing: `${value.letterSpacing}px` },
    ],
  ])
);

/** @type {import('tailwindcss').Config} */
module.exports = {
  // 'class' (not the default 'media'): react-native-css-interop throws
  // "Cannot manually set color scheme" whenever the media strategy is active
  // and anything mutates <head>. app/+html.tsx adds the `dark` class at boot.
  darkMode: 'class',
  content: ['./app/**/*.{js,jsx,ts,tsx}', './components/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      // One canvas, one accent, one set of semantic status colours, five fill
      // roles. Every value comes from theme/palette.js.
      colors,
      // Radii by role: controls 14, panes 24, sheets 28, pills full.
      borderRadius: {
        micro: `${p.radii.micro}px`,
        DEFAULT: `${p.radii.micro}px`,
        sm: `${p.radii.sm}px`,
        md: `${p.radii.control}px`,
        lg: '18px',
        xl: `${p.radii.pane}px`,
        '2xl': `${p.radii.sheet}px`,
        full: '9999px',
      },
      fontSize,
      spacing: {
        screen: `${p.spacing.screen}px`,
        gutter: `${p.spacing.gutter}px`,
        section: `${p.spacing.section}px`,
        tab: `${p.spacing.tabClearance}px`,
      },
      // A 44px minimum press box, addressable from a utility instead of a
      // literal. `hit` is what WCAG 2.5.8 and a thumb both ask for.
      minHeight: { hit: `${p.heights.hit}px` },
      minWidth: { hit: `${p.heights.hit}px` },
      fontFamily: {
        sans: ['Inter_400Regular'],
        'inter-regular': ['Inter_400Regular'],
        'inter-medium': ['Inter_500Medium'],
        'inter-semibold': ['Inter_600SemiBold'],
        'inter-bold': ['Inter_700Bold'],
      },
    },
  },
  plugins: [],
};
