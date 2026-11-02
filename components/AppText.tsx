import { Platform, Text } from 'react-native';
import type { TextProps, TextStyle } from 'react-native';

export type TextVariant =
  | 'display'
  | 'title'
  | 'headline'
  | 'bodyLg'
  | 'body'
  | 'bodySm'
  | 'label'
  | 'caption';

export type TextTone =
  | 'default'
  | 'muted'
  | 'tertiary'
  | 'accent'
  | 'onAccent'
  | 'danger'
  | 'success'
  | 'warning';

export type TextWeight = 'regular' | 'medium' | 'semibold' | 'bold';

/** Size + line-height come from the Tailwind scale built from palette.typography. */
const SIZE: Record<TextVariant, string> = {
  display: 'text-display',
  title: 'text-title',
  headline: 'text-headline',
  bodyLg: 'text-body-lg',
  body: 'text-body',
  bodySm: 'text-body-sm',
  label: 'text-label',
  caption: 'text-caption',
};

/** The weight each step of the scale is designed for. */
const DEFAULT_WEIGHT: Record<TextVariant, TextWeight> = {
  display: 'bold',
  title: 'bold',
  headline: 'semibold',
  bodyLg: 'regular',
  body: 'regular',
  bodySm: 'regular',
  label: 'semibold',
  caption: 'medium',
};

const FAMILY: Record<TextWeight, string> = {
  regular: 'font-inter-regular',
  medium: 'font-inter-medium',
  semibold: 'font-inter-semibold',
  bold: 'font-inter-bold',
};

/** Colour roles. A screen picks a role, never a hex value. */
const TONE: Record<TextTone, string> = {
  default: 'text-on-surface',
  muted: 'text-on-surface-variant',
  tertiary: 'text-outline',
  accent: 'text-primary',
  onAccent: 'text-on-primary-container',
  danger: 'text-error',
  success: 'text-success',
  warning: 'text-warning',
};

export type AppTextProps = TextProps & {
  variant?: TextVariant;
  tone?: TextTone;
  /** Overrides the scale's default weight; use sparingly. */
  weight?: TextWeight;
  align?: TextStyle['textAlign'];
  className?: string;
  /**
   * Renders a real heading (`role=heading` + `aria-level`) instead of a styled
   * div, so a screen reader can navigate the page by its outline instead of
   * reading one flat run of text (WCAG 1.3.1 / 2.4.6).
   */
  headingLevel?: 1 | 2 | 3;
  /**
   * BCP-47 tag for text that is not English — a Persian card back read by an
   * English voice is unintelligible, so the language travels with the string.
   */
  language?: string;
};

/**
 * AppText — the only text primitive in the app.
 *
 * `variant` owns size, line-height and the default weight; `tone` owns colour.
 * Pass layout utilities (margins, flex, uppercase) through `className`, but
 * never a colour or a size: that is how the type scale stays intact.
 */
export function AppText({
  variant = 'body',
  tone = 'default',
  weight,
  align,
  className = '',
  style,
  headingLevel,
  language,
  ...rest
}: AppTextProps) {
  const resolvedWeight = weight ?? DEFAULT_WEIGHT[variant];

  // Spread as plain objects: `aria-level` and `lang` are only meaningful on
  // web, and a platform check keeps React Native from receiving DOM attributes.
  const heading = headingLevel
    ? ({ role: 'heading', 'aria-level': headingLevel } as Record<string, unknown>)
    : undefined;
  const lang = language
    ? Platform.OS === 'web'
      ? ({ lang: language } as Record<string, unknown>)
      : ({ accessibilityLanguage: language } as Record<string, unknown>)
    : undefined;

  return (
    <Text
      className={`${FAMILY[resolvedWeight]} ${SIZE[variant]} ${TONE[tone]} ${className}`}
      style={align ? [{ textAlign: align }, style] : style}
      {...heading}
      {...lang}
      {...rest}
    />
  );
}
