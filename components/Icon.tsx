import type { ComponentProps } from 'react';
import { MaterialIcons as BaseMaterialIcons } from '@expo/vector-icons';

/**
 * Icon — MaterialIcons with one difference: it is invisible to assistive tech.
 *
 * An icon font renders its glyph as a *text node* in a private-use code point.
 * Chromium's accessibility tree therefore includes it in the accessible name of
 * whatever surrounds it: a deck card announced itself as
 * "\uE794 Schritt Plus Neu A2/B1 … 0%\uE5CC", and the home app bar as "\uE08C
 * Memora". A screen reader either reads a stray character or nothing at all, and
 * the name no longer matches the visible text (WCAG 2.5.3).
 *
 * The glyph is decoration — the label next to it, or the control's
 * `accessibilityLabel`, already says what it means — so it is hidden once here
 * instead of at 40 call sites.
 */
export function MaterialIcons(props: ComponentProps<typeof BaseMaterialIcons>) {
  return <BaseMaterialIcons {...props} accessible={false} aria-hidden />;
}
