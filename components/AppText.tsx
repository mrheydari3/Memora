import { Text } from 'react-native';
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
  ...rest
}: AppTextProps) {
  const resolvedWeight = weight ?? DEFAULT_WEIGHT[variant];

  return (
    <Text
      className={`${FAMILY[resolvedWeight]} ${SIZE[variant]} ${TONE[tone]} ${className}`}
      style={align ? [{ textAlign: align }, style] : style}
      {...rest}
    />
  );
}
