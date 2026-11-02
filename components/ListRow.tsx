import { Animated, View, Pressable } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { AppText } from './AppText';
import { alpha, colors, fills, heights, iconSize, veil } from '../theme/tokens';
import { usePressFeedback } from '../motion';

type IconName = React.ComponentProps<typeof MaterialIcons>['name'];

type ListRowProps = {
  title: string;
  subtitle?: string;
  icon?: IconName;
  /** sm = 38, lg = 44, none = bare glyph (sheet rows). */
  tile?: 'sm' | 'lg' | 'none';
  /** compact = 52 (sheets), default = 58 (lists), tall = 66 (deck rows). */
  density?: 'compact' | 'default' | 'tall';
  iconTone?: 'neutral' | 'accent' | 'deck' | 'destructive';
  /** Deck colour, required when iconTone is "deck". */
  deckColor?: string;
  /** Explicit glyph colour, overrides iconTone's colour. */
  iconColor?: string;
  /** Row title weight. Lists use semibold; settings groups stay medium. */
  titleWeight?: 'medium' | 'semibold';
  /** Horizontal inset of the row content. */
  gutter?: number;
  /** Quiet right-aligned value, followed by the chevron on pressable rows. */
  value?: string;
  /**
   * center = the value and chevron sit on the row's midline (lists);
   * title = they align with the title line, leaving a two-line subtitle its
   * full width (settings).
   */
  valueAlign?: 'center' | 'title';
  trailing?: React.ReactNode;
  /** Chevron on a pressable row. Off for sheet actions, which are already a menu. */
  showChevron?: boolean;
  /** Hairline divider under the row; omit on the last row of a group. */
  divider?: boolean;
  /** Tints the row with the accent wash, e.g. the selected option in a picker. */
  highlighted?: boolean;
  onPress?: () => void;
  disabled?: boolean;
  destructive?: boolean;
  className?: string;
  accessibilityLabel?: string;
};

const DENSITY = {
  compact: heights.rowCompact,
  default: heights.row,
  tall: heights.rowTall,
} as const;

const TILE = { sm: heights.tile, lg: heights.tileLg } as const;

function tileBackground(
  tone: NonNullable<ListRowProps['iconTone']>,
  deckColor?: string
): string {
  switch (tone) {
    case 'accent':
      return colors.accentFaint;
    case 'deck':
      return alpha(deckColor ?? colors.primary, 0.12);
    case 'destructive':
      return alpha(colors.error, 0.12);
    default:
      return fills.tile;
  }
}

function tileBorder(tone: NonNullable<ListRowProps['iconTone']>, deckColor?: string): string {
  switch (tone) {
    case 'accent':
      return colors.accentLine;
    case 'deck':
      return alpha(deckColor ?? colors.primary, 0.2);
    default:
      return colors.hairline;
  }
}

function glyphColor(tone: NonNullable<ListRowProps['iconTone']>, deckColor?: string): string {
  switch (tone) {
    case 'accent':
      return colors.primary;
    case 'deck':
      return deckColor ?? colors.primary;
    case 'destructive':
      return colors.error;
    default:
      return colors.onSurfaceVariant;
  }
}

/**
 * ListRow — the one row shape in the app: a tinted icon tile, a 15px title with
 * an optional 13px secondary line, and a trailing chevron or custom element.
 *
 * Deck lists, settings groups, import sources and sheets all render this, so
 * row heights, tile sizes and hit targets cannot drift between screens.
 */
export function ListRow({
  title,
  subtitle,
  icon,
  tile = 'sm',
  density = 'default',
  iconTone = 'neutral',
  deckColor,
  iconColor,
  titleWeight = 'medium',
  gutter = 16,
  value,
  valueAlign = 'center',
  trailing,
  showChevron = true,
  divider = false,
  highlighted = false,
  onPress,
  disabled = false,
  destructive = false,
  className = '',
  accessibilityLabel,
}: ListRowProps) {
  // Every pressable row answers a touch the same way: a spring dip and a faint
  // veil, both on the native driver (the old `active:` class only worked on web).
  const press = usePressFeedback({ scale: 0.985 });

  // A settings row with a value reads as title + value on one line, so a
  // two-line subtitle never squeezes the value into a narrow column.
  const inlineValue = !trailing && valueAlign === 'title' && value !== undefined;
  const showTrailingValue = !inlineValue && (value || (onPress && !disabled && showChevron));

  const content = (
    <>
      {icon &&
        (tile === 'none' ? (
          <MaterialIcons
            name={icon}
            size={iconSize.lg}
            color={iconColor ?? glyphColor(iconTone, deckColor)}
          />
        ) : (
          <View
            className="items-center justify-center rounded-md"
            style={{
              width: TILE[tile],
              height: TILE[tile],
              borderWidth: 1,
              borderColor: tileBorder(iconTone, deckColor),
              backgroundColor: tileBackground(iconTone, deckColor),
            }}
          >
            <MaterialIcons
              name={icon}
              size={iconSize.lg}
              color={iconColor ?? glyphColor(iconTone, deckColor)}
            />
          </View>
        ))}

      <View className={`flex-1 ${icon ? 'ml-3' : ''}`}>
        <View className="flex-row items-center">
          <AppText
            variant="body"
            weight={titleWeight}
            tone={destructive ? 'danger' : 'default'}
            numberOfLines={1}
            className="flex-1"
          >
            {title}
          </AppText>
          {inlineValue && (
            <View className="ml-3 flex-row items-center gap-1" style={{ maxWidth: '55%' }}>
              <AppText
                variant="bodySm"
                weight="medium"
                tone="muted"
                numberOfLines={1}
                style={{ flexShrink: 1, fontVariant: ['tabular-nums'] }}
              >
                {value}
              </AppText>
              {onPress && !disabled && showChevron && (
                <MaterialIcons
                  name={destructive ? 'delete-outline' : 'chevron-right'}
                  size={iconSize.md}
                  color={destructive ? colors.error : colors.outline}
                />
              )}
            </View>
          )}
        </View>
        {subtitle && (
          <AppText variant="bodySm" tone="muted" className="mt-0.5" numberOfLines={2}>
            {subtitle}
          </AppText>
        )}
      </View>

      {trailing ??
        (showTrailingValue ? (
          <View className="ml-3 flex-row items-center gap-1" style={{ maxWidth: '55%' }}>
            {value && (
              <AppText
                variant="bodySm"
                weight="medium"
                tone="muted"
                numberOfLines={1}
                style={{ flexShrink: 1, fontVariant: ['tabular-nums'] }}
              >
                {value}
              </AppText>
            )}
            {onPress && !disabled && showChevron && (
              <MaterialIcons
                name={destructive ? 'delete-outline' : 'chevron-right'}
                size={iconSize.md}
                color={destructive ? colors.error : colors.outline}
              />
            )}
          </View>
        ) : null)}
    </>
  );

  const base = `flex-row items-center ${divider ? 'border-b border-hairline' : ''} ${
    disabled ? 'opacity-45' : ''
  } ${className}`;
  const geometry = {
    minHeight: DENSITY[density],
    paddingHorizontal: gutter,
    ...(highlighted ? { backgroundColor: colors.accentFaint } : {}),
  };

  if (!onPress || disabled) {
    return (
      <View className={base} style={geometry} accessibilityLabel={accessibilityLabel ?? title}>
        {content}
      </View>
    );
  }

  return (
    <Animated.View style={press.style}>
      <Pressable
        className={`${base} overflow-hidden`}
        style={geometry}
        onPress={onPress}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? title}
      >
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: veil,
            },
            {
              opacity: press.value.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 0.05],
              }),
            },
          ]}
        />
        {content}
      </Pressable>
    </Animated.View>
  );
}
