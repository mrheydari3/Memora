/**
 * AppSplash — the app's first paint.
 *
 * It used to be a brand moment: mark, wordmark, rail. That read as a second
 * logo screen on every refresh. Now it draws the page the user is about to get:
 * the same app-bar, content column and tab dock, with the existing skeleton
 * grammar inside. When the fonts and stores hydrate, the whole layer dissolves
 * and the real page is already in the same place.
 *
 * Only opacity is animated on exit, and reduce-motion resolves it on the same
 * tick. The skeleton's own shimmer is owned by the `Skeleton` components.
 */
import { useEffect, useRef } from 'react';
import { Animated } from 'react-native';
import { colors, motion } from '../theme/tokens';
import { timingTo, USE_NATIVE_DRIVER } from '../motion';
import { LaunchSkeleton } from './LaunchSkeleton';

type AppSplashProps = {
  /** Fonts + stores are ready: start the exit. */
  ready: boolean;
  /** The route that is about to render, so the skeleton can match its shape. */
  pathname?: string;
  /** The exit finished; the caller unmounts the splash. */
  onDone: () => void;
};

/** The shortest the skeleton may stay up, so a warm start never blinks. */
const MIN_VISIBLE_MS = 420;

export function AppSplash({ ready, pathname = '/', onDone }: AppSplashProps) {
  const exit = useRef(new Animated.Value(0)).current;
  const mountedAt = useRef(Date.now());
  const exiting = useRef(false);

  // Exit: hold until the minimum has elapsed, then dissolve. There is no
  // entrance animation — the skeleton is already the page, so moving it in
  // would only delay the moment the learner can read the layout.
  useEffect(() => {
    if (!ready || exiting.current) return;
    exiting.current = true;
    const wait = Math.max(0, MIN_VISIBLE_MS - (Date.now() - mountedAt.current));
    void (async () => {
      await timingTo(exit, 1, {
        duration: motion.slow,
        delay: wait,
        nativeDriver: USE_NATIVE_DRIVER,
      });
      onDone();
    })();
  }, [ready, exit, onDone]);

  return (
    <Animated.View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel="Loading Memora"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: colors.background,
        // The layer sits outside the clipped app shell; keep the moving
        // skeleton from widening the document on a narrow viewport.
        overflow: 'hidden',
        opacity: exit.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
      }}
    >
      <LaunchSkeleton pathname={pathname} />
    </Animated.View>
  );
}
