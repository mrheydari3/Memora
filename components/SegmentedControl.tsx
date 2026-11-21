import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, View } from 'react-native';
import { MaterialIcons } from './Icon';
import { AppText } from './AppText';
import { alpha, colors, fills, heights, iconSize, motion, radii } from '../theme/tokens';
import { timingTo, usePressFeedback } from '../motion';
import { HapticsEngine } from '../services/haptics';

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
  /** One sliding selection pill under the segments (two-up Review control). */
  sliding?: boolean;
  /** Names the rail when it behaves as a tab list. */
  accessibilityLabel?: string;
  className?: string;
};

/** One pressable segment: a spring dip and the caller's own layout. */
function SegmentPress({
  onPress,
  accessibilityLabel,
  selected,
  style,
  tab = false,
  children,
}: {
  onPress: () => void;
  /** Optional: a segment is named by its own visible label + badge. */
  accessibilityLabel?: string;
  selected: boolean;
  style?: object;
  /** Renders the segment as a tab in the sliding rail. */
  tab?: boolean;
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
        onPress={() => {
          HapticsEngine.selection();
          onPress();
        }}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        accessibilityRole={tab ? 'tab' : 'button'}
        accessibilityState={{ selected }}
        aria-selected={tab ? selected : undefined}
        aria-pressed={tab ? undefined : selected}
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
  sliding = false,
  accessibilityLabel,
  className = '',
}: SegmentedControlProps) {
  const [railWidth, setRailWidth] = useState(0);
  const activeIndex = Math.max(
    0,
    segments.findIndex((segment) => segment.active)
  );
  const slide = useRef(new Animated.Value(activeIndex)).current;
  const pillWidth = Math.max(0, (railWidth - 8) / Math.max(segments.length, 1));

  useEffect(() => {
    if (!sliding) return;
    void timingTo(slide, activeIndex, { duration: motion.base, nativeDriver: true });
  }, [activeIndex, slide, sliding]);

  const translateX = slide.interpolate({
    inputRange: [0, Math.max(1, segments.length - 1)],
    outputRange: [0, pillWidth * Math.max(0, segments.length - 1)],
  });

  return (
    <View
      className={`flex-row overflow-hidden rounded-md ${className}`}
      role={sliding ? 'tablist' : undefined}
      aria-label={accessibilityLabel}
      onLayout={(event) => setRailWidth(event.nativeEvent.layout.width)}
      style={{
        backgroundColor: sliding ? colors.surfaceControl : fills.control,
        // §10: the rail is a form control; one resting edge in the existing
        // outline token clears 3:1 against the pane without a new colour.
        borderWidth: 1,
        borderColor: colors.outline,
        padding: sliding ? 4 : 0,
      }}
    >
      {sliding && railWidth > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 4,
            bottom: 4,
            left: 4,
            width: pillWidth,
            borderRadius: radii.micro,
            backgroundColor: colors.selectionSurface,
            borderWidth: 1, // design-ignore — §10 Review selection chrome
            borderColor: alpha(colors.primary, 0.25), // design-ignore — §10 Review selection chrome
            transform: [{ translateX }],
          }}
        />
      ) : null}
      {segments.map((segment) => {
        const active = segment.active ?? false;
        const filled = !sliding && appearance === 'fill' && active;

        return (
          <View key={segment.key} className="flex-1 flex-row">
            <SegmentPress
              onPress={segment.onPress ?? (() => {})}
              // The segment's own text (label + badge) names it. A hand-written
              // label could not match the visible run exactly — even adding the
              // badge produced "Discover Soon" against "DiscoverSoon", which
              // axe reported as label-content-name-mismatch.
              selected={active}
              tab={sliding}
              style={
                filled
                  ? { backgroundColor: colors.primary, paddingVertical: 8 }
                  : { paddingVertical: sliding || appearance === 'fill' ? 8 : 10 }
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
