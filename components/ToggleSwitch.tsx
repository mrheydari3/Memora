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
 * ToggleSwitch — 46×26 pill. Off is a control fill with a grey knob; on is the
 * accent track with an ink knob. No outline either way.
 *
 * Accessibility: `role="switch"` requires `aria-checked`. react-native-web
 * renders `accessibilityState.checked` for some roles but not for a switch
 * (axe reported "Required ARIA attributes must be provided"), so the state is
 * now passed as an explicit `aria-checked` attribute as well — native still
 * reads `accessibilityState`. The 26px pill sits inside a 44px press box so the
 * target size holds on touch and on the web, where hitSlop is dropped.
 */
export function ToggleSwitch({ value, onToggle, accessibilityLabel = 'Toggle' }: ToggleSwitchProps) {
  const on = useRef(new Animated.Value(value ? 1 : 0)).current;

  useEffect(() => {
    springTo(on, value ? 1 : 0);
  }, [value, on]);

  return (
    <Pressable
      style={{
        width: heights.toggleWidth,
        height: heights.hit,
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onPress={() => onToggle?.(!value)}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      aria-checked={value}
      accessibilityLabel={accessibilityLabel}
    >
      <View
        style={{
          width: heights.toggleWidth,
          height: heights.toggle,
          borderRadius: heights.toggle / 2,
          backgroundColor: fills.control,
          justifyContent: 'center',
          overflow: 'hidden',
        }}
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
      </View>
    </Pressable>
  );
}
