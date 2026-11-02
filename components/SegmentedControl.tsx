import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { AppText } from './AppText';
import { alpha, colors, fills, iconSize, radii } from '../theme/tokens';
import { springTo, usePressFeedback } from '../motion';

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
  /** Explicit active state for split controls that have no single value. */
  active?: boolean;
};

type SegmentedControlProps = {
  segments: Segment[];
  /** The selected key, for a single-value control. */
  value?: string;
  onChange?: (key: string) => void;
  /** fill = the selected segment carries the accent fill; plain = text only. */
  appearance?: 'fill' | 'plain';
  /** Hairline rule between segments. */
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
  accessibilityLabel: string;
  selected: boolean;
  style?: object;
  children: React.ReactNode;
}) {
  const press = usePressFeedback({ scale: 0.96 });

  return (
    <Animated.View style={[{ flex: 1 }, press.style]}>
      <Pressable
        className="flex-1 flex-row items-center justify-center gap-1.5"
        style={style}
        onPress={onPress}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        accessibilityRole="button"
        accessibilityState={{ selected }}
        accessibilityLabel={accessibilityLabel}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}

/**
 * SegmentedControl — one rail split into two or three choices. It covers both
 * the library's tab switch (one value) and the deck's sort/filter pair (each
 * segment cycles on its own), so the two never drift apart.
 *
 * In fill mode the selection is one accent indicator that slides between
 * segments (translateX on the native driver) rather than a background that
 * jumps; the split controls keep their per-segment state and no indicator.
 */
export function SegmentedControl({
  segments,
  value,
  onChange,
  appearance = 'fill',
  divider = false,
  className = '',
}: SegmentedControlProps) {
  const [width, setWidth] = useState(0);
  const activeIndex = Math.max(
    0,
    segments.findIndex((segment) => segment.active ?? segment.key === value)
  );
  const position = useRef(new Animated.Value(activeIndex)).current;

  useEffect(() => {
    springTo(position, activeIndex);
  }, [activeIndex, position]);

  const count = Math.max(1, segments.length);
  const segmentWidth = width / count;
  const sliding = appearance === 'fill' && value !== undefined && width > 0;

  return (
    <View
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      className={`flex-row overflow-hidden rounded-md border border-hairline ${className}`}
      style={{ backgroundColor: fills.tile }}
    >
      {sliding && (
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: 0,
            width: segmentWidth,
            borderRadius: radii.control - 6,
            backgroundColor: colors.primary,
            transform: [
              {
                translateX: position.interpolate({
                  inputRange: [0, Math.max(1, count - 1)],
                  outputRange: [0, segmentWidth * (count - 1)],
                }),
              },
            ],
          }}
        />
      )}

      {segments.map((segment, index) => {
        const active = segment.active ?? segment.key === value;
        const filled = appearance === 'fill' && active;

        return (
          <View key={segment.key} className="flex-1 flex-row">
            {divider && index > 0 && (
              <View className="my-2 w-px" style={{ backgroundColor: colors.hairline }} />
            )}
            <SegmentPress
              onPress={segment.onPress ?? (() => onChange?.(segment.key))}
              accessibilityLabel={segment.label}
              selected={active}
              style={
                filled && !sliding
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
                  className={`ml-1 rounded-full px-1.5 py-0.5 ${
                    filled ? '' : 'border border-hairline'
                  }`}
                  style={
                    filled
                      ? { backgroundColor: alpha(colors.onPrimaryContainer, 0.15) }
                      : { backgroundColor: fills.tile }
                  }
                >
                  <AppText
                    variant="caption"
                    weight="semibold"
                    tone={filled ? 'onAccent' : 'tertiary'}
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
