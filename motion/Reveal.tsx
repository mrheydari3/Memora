/**
 * Reveal primitives — the components screens and lists compose.
 *
 * `RevealItem` is the one way an element enters a page: fade plus a short rise,
 * with an optional stagger index so a list cascades instead of snapping in as a
 * wall. `FadeSwap` cross-fades between the states of a region (loading, empty,
 * error, content) without ever blanking it.
 *
 * Both delegate to `useReveal`, so the curve, the native-driver decision and the
 * OS reduce-motion switch stay in one place.
 */
import { Animated } from 'react-native';
import type { ViewStyle } from 'react-native';
import { motion } from '../theme/tokens';
import { staggerDelay, useReveal } from './index';

type RevealItemProps = {
  children: React.ReactNode;
  /** Position in the group; drives the stagger delay. */
  index?: number;
  /** Delay added to every member of the group (a hero entering first). */
  delay?: number;
  /** Gap between siblings, in ms. */
  step?: number;
  /** The stagger stops growing past this index, so long lists stay quick. */
  cap?: number;
  /** Vertical rise in px; 0 fades in place. */
  distance?: number;
  duration?: number;
  style?: ViewStyle | ViewStyle[];
};

/**
 * One element of a page's entrance. Layout stays on the caller's `style`; the
 * animated node only ever owns opacity and transform.
 */
export function RevealItem({
  children,
  index = 0,
  delay = 0,
  step = 40,
  cap = 8,
  distance = 10,
  duration = motion.slow,
  style,
}: RevealItemProps) {
  const reveal = useReveal(`reveal:${index}`, {
    delay: delay + staggerDelay(index, step, cap),
    distance,
    duration,
  });

  return <Animated.View style={[style, reveal.style]}>{children}</Animated.View>;
}

type FadeSwapProps = {
  /** Changing this replays the cross-fade (e.g. 'loading' → 'ready'). */
  stateKey: string | number | boolean | null;
  children: React.ReactNode;
  duration?: number;
  style?: ViewStyle | ViewStyle[];
};

/**
 * State cross-fade. The outgoing content is replaced on the same tick the new
 * state renders, and the incoming block fades up from the reveal floor — so a
 * region never shows a blank frame between "loading" and "ready".
 */
export function FadeSwap({ stateKey, children, duration = motion.base, style }: FadeSwapProps) {
  const reveal = useReveal(stateKey, { duration, distance: 0 });
  return <Animated.View style={[style, reveal.style]}>{children}</Animated.View>;
}
