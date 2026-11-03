import { useRef, useState } from 'react';
import { Animated, Pressable } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { AppText } from '../AppText';
import { colors, fills } from '../../theme/tokens';
import { usePressFeedback } from '../../motion';

type StartButtonProps = {
  label: string;
  disabled?: boolean;
  onPress?: () => void;
};

/**
 * StartButton — the Uiverse "perfect-panda-77" pill, adapted to React Native.
 *
 * The Uiverse pill's shape and motion in the app's own azure: bold ink label
 * and a long arrow that slides 5px on hover; the press springs to 0.95 like the
 * original. Every colour is a theme token.
 */
export function StartButton({ label, disabled = false, onPress }: StartButtonProps) {
  const press = usePressFeedback({ scale: 0.95 });
  const [hovered, setHovered] = useState(false);
  const arrow = useRef(new Animated.Value(0)).current;

  const slideTo = (to: number) => {
    Animated.timing(arrow, {
      toValue: to,
      duration: 180,
      useNativeDriver: true,
    }).start();
  };

  const enter = () => {
    if (disabled) return;
    setHovered(true);
    slideTo(1);
  };

  const leave = () => {
    setHovered(false);
    slideTo(0);
  };

  const ink = disabled ? colors.outline : colors.onPrimaryContainer;

  return (
    <Animated.View style={[press.style, { width: '100%' }]}>
      <Pressable
        onPress={onPress}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        onHoverIn={enter}
        onHoverOut={leave}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled }}
        style={{
          width: '100%',
          minHeight: 52,
          borderRadius: 100,
          paddingHorizontal: 20,
          paddingVertical: 10,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
          backgroundColor: disabled ? fills.control : hovered ? colors.primary : colors.primaryContainer,
        }}
      >
        <AppText variant="body" weight="bold" style={{ color: ink }}>
          {label}
        </AppText>

        {!disabled && (
          <Animated.View
            style={{
              transform: [
                {
                  translateX: arrow.interpolate({ inputRange: [0, 1], outputRange: [0, 5] }),
                },
              ],
            }}
          >
            <Svg width={34} height={24} viewBox="0 0 34 24">
              <Path
                d="M3 12h27M22 5l7 7-7 7"
                stroke={ink}
                strokeWidth={2.4}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            </Svg>
          </Animated.View>
        )}
      </Pressable>
    </Animated.View>
  );
}
