import { useEffect, useRef } from 'react';
import { Animated } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { MaterialIcons } from './Icon';
import { motion } from '../theme/tokens';
import { timingTo } from '../motion';

type IconName = React.ComponentProps<typeof MaterialIcons>['name'];

type AnimatedIconProps = {
  name: IconName;
  size: number;
  color: string;
  /** Replays the pop when this changes, e.g. a switch flipping. */
  pulseKey?: string | number | boolean;
  style?: StyleProp<ViewStyle>;
};

/**
 * AnimatedIcon — the small physical cue on an icon: it settles in from 82% with
 * a slight tilt, and repeats that pop when `pulseKey` changes.
 *
 * The motion is deliberately one-shot and short (motion.fast). Nothing loops, so
 * a screen full of icons stays quiet at rest; `timingTo` applies the end state
 * immediately when the OS asks for reduced motion.
 */
export function AnimatedIcon({ name, size, color, pulseKey, style }: AnimatedIconProps) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    progress.setValue(0);
    void timingTo(progress, 1, { duration: motion.fast });
  }, [pulseKey, progress]);

  const transform = [
    {
      scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.82, 1] }),
    },
    {
      rotate: progress.interpolate({ inputRange: [0, 1], outputRange: ['-8deg', '0deg'] }),
    },
  ];

  return (
    <Animated.View pointerEvents="none" style={[style, { transform }]}>
      <MaterialIcons name={name} size={size} color={color} />
    </Animated.View>
  );
}
