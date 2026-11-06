import type { ComponentProps } from 'react';
import { MaterialIcons as BaseMaterialIcons } from '@expo/vector-icons';
import { AppText } from './AppText';

/**
 * Icon — MaterialIcons, drawn through the project's text primitive.
 *
 * Two things differ from the stock component:
 *
 * 1. **Invisible to assistive tech.** An icon font renders its glyph as a text
 *    node in a private-use code point, so Chromium includes it in the
 *    accessible name of whatever surrounds it: a deck card announced itself as
 *    "\uE794 Schritt Plus Neu A2/B1 … 0%\uE5CC". The glyph is decoration — the
 *    label next to it, or the control's `accessibilityLabel`, already says what
 *    it means — so it is hidden once here instead of at 40 call sites.
 *
 * 2. **Not gated on expo-font.** `@expo/vector-icons` renders *nothing* while
 *    its `Font.loadAsync()` is pending, and on the web dev server that load can
 *    fail (the asset request returns 200 but never finishes). The component
 *    then stays empty for the life of the page: a route opened by URL showed
 *    blank header buttons and empty deck tiles. The font is registered from a
 *    static URL in `services/webFonts.ts`; this draws the same glyph with
 *    `font-family: material`, so it appears as soon as that face is available
 *    instead of waiting on a load that will not happen.
 */
export function MaterialIcons({
  name,
  size = 24,
  color,
  style,
  ...rest
}: ComponentProps<typeof BaseMaterialIcons>) {
  // The generated glyph map is typed loosely (string | number), so coerce to
  // the code point the font actually draws.
  const codePoint = Number(BaseMaterialIcons.glyphMap[name] ?? 0);

  return (
    <AppText
      {...rest}
      accessible={false}
      aria-hidden
      selectable={false}
      // A glyph is the one text role that is not Inter: the type scale still
      // supplies the fallback line-height, and the family comes from the icon
      // font that webFonts.ts registers.
      style={[{ fontFamily: 'material', fontSize: size, color }, style]}
    >
      {codePoint ? String.fromCodePoint(codePoint) : ''}
    </AppText>
  );
}
