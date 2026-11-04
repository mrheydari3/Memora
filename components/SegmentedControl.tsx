import { Animated, Pressable, View } from 'react-native';
import { MaterialIcons } from './Icon';
import { AppText } from './AppText';
import { alpha, colors, fills, heights, iconSize } from '../theme/tokens';
import { usePressFeedback } from '../motion';

type IconName = React.ComponentProps<typeof MaterialIcons>['name'];

export type Segment = {
  key: string;
  label: string;
  icon?: IconName;
  /** Small chevron after the label, e.g. a cycling control. */
  trailingIcon?: IconName;
  /** Tiny capsule after the label, e.g. "Soon". */
  badge?: string;
  /** Per-segment handler; when given, the segment acts on its own. */
  onPress?: () => void;
  /** Explicit active state for a segment that acts on its own. */
  active?: boolean;
};

type SegmentedControlProps = {
  segments: Segment[];
  /** fill = the selected segment carries the accent fill; plain = text only. */
  appearance?: 'fill' | 'plain';
  /** Kept for call-site compatibility; the rail has no inner rules. */
  divider?: boolean;
  className?: string;
};

/** One pressable segment: a spring dip and the caller's own layout. */
function SegmentPress({
  onPress,
  accessibilityLabel,
  selected,
  style,
  children,
}: {
  onPress: () => void;
  /** Optional: a segment is named by its own visible label + badge. */
  accessibilityLabel?: string;
  selected: boolean;
  style?: object;
  children: React.ReactNode;
}) {
  const press = usePressFeedback({ scale: 0.96 });

  return (
    <Animated.View style={[{ flex: 1 }, press.style]}>
      <Pressable
        className="flex-1 flex-row items-center justify-center gap-1.5"
        // 44px minimum touch height (WCAG 2.5.8 / 2.2 Target Size): the rail
        // used to draw 36px segments, which a thumb misses on a phone.
        style={[style, { minHeight: heights.hit, justifyContent: 'center' }]}
        onPress={onPress}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        accessibilityRole="button"
        accessibilityState={{ selected }}
        aria-pressed={selected}
        accessibilityLabel={accessibilityLabel}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}

/**
 * SegmentedControl — one rail split into two or three choices.
 *
 * Each segment owns its action and, for split controls such as the deck's
 * sort/filter pair, its own active state. The rail carries no shared value:
 * the only call site cycles each side independently.
 */
export function SegmentedControl({
  segments,
  appearance = 'fill',
  divider = false,
  className = '',
}: SegmentedControlProps) {
  return (
    <View
      className={`flex-row overflow-hidden rounded-md ${className}`}
      style={{ backgroundColor: fills.control }}
    >
      {segments.map((segment) => {
        const active = segment.active ?? false;
        const filled = appearance === 'fill' && active;

        return (
          <View key={segment.key} className="flex-1 flex-row">
            <SegmentPress
              onPress={segment.onPress ?? (() => {})}
              // The segment's own text (label + badge) names it. A hand-written
              // label could not match the visible run exactly — even adding the
              // badge produced "Discover Soon" against "DiscoverSoon", which
              // axe reported as label-content-name-mismatch.
              selected={active}
              style={
                filled
                  ? { backgroundColor: colors.primary, paddingVertical: 8 }
                  : { paddingVertical: appearance === 'fill' ? 8 : 10 }
              }
            >
              {segment.icon && (
                <MaterialIcons
                  name={segment.icon}
                  size={iconSize.sm}
                  color={filled ? colors.onPrimary : active ? colors.primary : colors.onSurfaceVariant}
                />
              )}
              <AppText
                variant="bodySm"
                weight={appearance === 'fill' ? 'semibold' : 'medium'}
                tone={filled ? 'onAccent' : active && appearance === 'plain' ? 'accent' : 'muted'}
                numberOfLines={1}
              >
                {segment.label}
              </AppText>
              {segment.badge && (
                <View
                  className="ml-1 rounded-full px-1.5 py-0.5"
                  style={
                    filled
                      ? { backgroundColor: alpha(colors.onPrimaryContainer, 0.15) }
                      : { backgroundColor: fills.tile }
                  }
                >
                  {/*
                    `muted`, not `tertiary`: an 11px caption in the tertiary
                    tone measures 3.88:1 on a raised tile (axe, 320px), because
                    a raised tile is lighter than the flat canvas the tone was
                    chosen for. Quiet text on a raised surface uses the next
                    tone up.
                  */}
                  <AppText
                    variant="caption"
                    weight="semibold"
                    tone={filled ? 'onAccent' : 'muted'}
                    className="uppercase"
                  >
                    {segment.badge}
                  </AppText>
                </View>
              )}
              {segment.trailingIcon && (
                <MaterialIcons
                  name={segment.trailingIcon}
                  size={iconSize.xs}
                  color={filled ? colors.onPrimary : colors.outline}
                />
              )}
            </SegmentPress>
          </View>
        );
      })}
    </View>
  );
}
