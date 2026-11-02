import { useEffect, useRef } from 'react';
import { Animated, Pressable, View } from 'react-native';
import { colors, fills, heights } from '../theme/tokens';
import { springTo } from '../motion';

type ToggleSwitchProps = {
  value: boolean;
  onToggle?: (value: boolean) => void;
  accessibilityLabel?: string;
};

const KNOB = 20;
/** Track inset (px-0.5 each side) plus the knob: how far the knob may travel. */
const TRAVEL = heights.toggleWidth - KNOB - 4;

/**
 * ToggleSwitch — 46×26 pill. Off is a hairline-outlined glass track with a grey
 * knob; on is the accent track with an ink knob. No solid greys anywhere.
 *
 * The knob slides on the same spring as every other press, and the accent track
 * fades in behind it, so a toggle reads as one continuous motion instead of two
 * instant recolours.
 */
export function ToggleSwitch({ value, onToggle, accessibilityLabel = 'Toggle' }: ToggleSwitchProps) {
  const on = useRef(new Animated.Value(value ? 1 : 0)).current;

  useEffect(() => {
    springTo(on, value ? 1 : 0);
  }, [value, on]);

  return (
    <Pressable
      className="justify-center rounded-full border"
      style={{
        width: heights.toggleWidth,
        height: heights.toggle,
        backgroundColor: fills.track,
        borderColor: value ? colors.primary : colors.hairline,
      }}
      onPress={() => onToggle?.(!value)}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel={accessibilityLabel}
      hitSlop={10}
    >
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          borderRadius: heights.toggle / 2,
          backgroundColor: colors.primary,
          opacity: on,
        }}
      />
      <Animated.View
        style={{
          width: KNOB,
          height: KNOB,
          borderRadius: KNOB / 2,
          marginLeft: 2,
          backgroundColor: colors.onSurfaceVariant,
          transform: [
            {
              translateX: on.interpolate({ inputRange: [0, 1], outputRange: [0, TRAVEL] }),
            },
            { scale: on.interpolate({ inputRange: [0, 1], outputRange: [1, 1.04] }) },
          ],
        }}
      >
        <Animated.View
          style={{
            flex: 1,
            borderRadius: KNOB / 2,
            backgroundColor: colors.onPrimary,
            opacity: on,
          }}
        />
      </Animated.View>
    </Pressable>
  );
}
