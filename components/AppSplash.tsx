/**
 * AppSplash — the app's first second.
 *
 * A single identity moment: the accent mark settles in, the wordmark rises under
 * it, and a hairline rail fills. Nothing else moves, nothing waits on a network
 * call, and the whole overlay cross-fades away as soon as fonts and the stores
 * are hydrated — so the hand-off to Home is a dissolve, not a flash.
 *
 * Everything is transform/opacity except the rail's width, which is one 2px view
 * animating once. Reduce-motion renders the finished composition and simply
 * fades it out.
 */
import { useEffect, useRef } from 'react';
import { Animated, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { AppText } from './AppText';
import { colors, fills, iconSize, motion, radii, spacing } from '../theme/tokens';
import { timingTo, USE_NATIVE_DRIVER } from '../motion';

type AppSplashProps = {
  /** Fonts + stores are ready: start the exit. */
  ready: boolean;
  /** The exit finished; the caller unmounts the splash. */
  onDone: () => void;
};

/** The shortest the mark may stay up, so a warm start never blinks. */
const MIN_VISIBLE_MS = 620;
const MARK_SIZE = 76;
const RAIL_WIDTH = 132;

export function AppSplash({ ready, onDone }: AppSplashProps) {
  const mark = useRef(new Animated.Value(0)).current;
  const word = useRef(new Animated.Value(0)).current;
  const rail = useRef(new Animated.Value(0)).current;
  const exit = useRef(new Animated.Value(0)).current;
  const mountedAt = useRef(Date.now());
  const exiting = useRef(false);

  // Entrance: mark → wordmark → rail, each starting where the last one landed.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await timingTo(mark, 1, { duration: motion.slow, delay: 40, nativeDriver: USE_NATIVE_DRIVER });
      if (cancelled) return;
      await timingTo(word, 1, { duration: motion.base, nativeDriver: USE_NATIVE_DRIVER });
      if (cancelled) return;
      await timingTo(rail, 1, { duration: 680, nativeDriver: false });
    })();
    return () => {
      cancelled = true;
    };
  }, [mark, word, rail]);

  // Exit: hold until the minimum has elapsed, then dissolve.
  useEffect(() => {
    if (!ready || exiting.current) return;
    exiting.current = true;
    const wait = Math.max(0, MIN_VISIBLE_MS - (Date.now() - mountedAt.current));
    void (async () => {
      await timingTo(exit, 1, { duration: motion.slow, delay: wait, nativeDriver: USE_NATIVE_DRIVER });
      onDone();
    })();
  }, [ready, exit, onDone]);

  return (
    <Animated.View
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: colors.background,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: exit.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
        transform: [{ scale: exit.interpolate({ inputRange: [0, 1], outputRange: [1, 1.02] }) }],
      }}
    >
      <Animated.View
        style={{
          width: MARK_SIZE,
          height: MARK_SIZE,
          borderRadius: radii.pane,
          borderWidth: 1,
          borderColor: colors.accentLine,
          backgroundColor: colors.accentSoft,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: mark,
          transform: [{ scale: mark.interpolate({ inputRange: [0, 1], outputRange: [0.82, 1] }) }],
        }}
      >
        <MaterialIcons name="blur-on" size={iconSize.display} color={colors.primary} />
      </Animated.View>

      <Animated.View
        style={{
          alignItems: 'center',
          opacity: word,
          transform: [{ translateY: word.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }],
        }}
      >
        <AppText variant="title" weight="semibold" className="mt-5">
          Memora
        </AppText>
        <AppText variant="caption" weight="medium" tone="muted" className="mt-1 uppercase">
          Memory, kept
        </AppText>
      </Animated.View>

      <View
        style={{
          marginTop: spacing.section,
          width: RAIL_WIDTH,
          height: 2,
          borderRadius: 1,
          backgroundColor: fills.track,
          overflow: 'hidden',
        }}
      >
        <Animated.View
          style={{
            height: '100%',
            borderRadius: 1,
            backgroundColor: colors.primary,
            width: rail.interpolate({ inputRange: [0, 1], outputRange: [0, RAIL_WIDTH] }),
          }}
        />
      </View>
    </Animated.View>
  );
}
