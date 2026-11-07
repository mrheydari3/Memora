/**
 * AppSplash — the app's first paint.
 *
 * It used to be a brand moment: mark, wordmark, rail. That read as a second
 * logo screen on every refresh. Now it draws the page the user is about to get:
 * the same app-bar, content column and tab dock, with the existing skeleton
 * grammar inside. When the stores hydrate and the first route body has painted
 * real text, the whole layer dissolves and the real page is already in the same
 * place.
 *
 * Only opacity is animated on exit, and reduce-motion resolves it on the same
 * tick. The skeleton's own shimmer is owned by the `Skeleton` components.
 */
import { useEffect, useRef, useState } from 'react';
import { Animated, Platform } from 'react-native';
import { colors, motion } from '../theme/tokens';
import { timingTo, USE_NATIVE_DRIVER } from '../motion';
import { LaunchSkeleton } from './LaunchSkeleton';

type AppSplashProps = {
  /** Stores (and native bundled fonts) are ready: the body may now be checked. */
  ready: boolean;
  /** The route that is about to render, so the skeleton can match its shape. */
  pathname?: string;
  /** The route body has real text; the caller may reveal it under the splash. */
  onContentReady?: () => void;
  /** The exit finished; the caller unmounts the splash. */
  onDone: () => void;
};

/** The shortest the skeleton may stay up, so a warm start never blinks. */
const MIN_VISIBLE_MS = 420;

/**
 * How long the revealed body gets to paint before the splash starts leaving.
 *
 * The body is already the page when this starts, so it only needs the frames
 * between the reveal and the dissolve.
 */
const PAINT_GRACE_MS = 400;

/**
 * The hard limit on waiting for a route body at all.
 *
 * The hand-off must never depend on a measurement that may not arrive: a
 * suspended or missing route, a font that never reports metrics, or a body
 * that is skipped by the renderer would otherwise leave the splash on screen
 * forever. Once this elapses the splash dissolves and the app owns the canvas,
 * with its own skeleton if the route is still coming.
 */
const BODY_TIMEOUT_MS = 4000;

/** How often the body is checked for structural text while the splash is up. */
const POLL_MS = 50;

/**
 * Slack on top of the dissolve before the layer is removed without waiting for
 * the animation callback. The fade is frame-driven; a starved renderer (busy
 * main thread, no paint) can delay that callback well past its duration, and
 * the splash must still come down.
 */
const FADE_GUARD_MS = 600;

export function AppSplash({ ready, pathname = '/', onContentReady, onDone }: AppSplashProps) {
  const exit = useRef(new Animated.Value(0)).current;
  const mountedAt = useRef(Date.now());
  const exiting = useRef(false);
  const handedOver = useRef(false);
  const revealed = useRef(false);
  // Timestamps, not timers: the watcher effect can be torn down and rebuilt by
  // a parent render, and a timer cleared in that cleanup would never re-arm.
  // The grace and the deadline are derived from these, so a re-run continues
  // the countdown instead of restarting or losing it.
  const settledAt = useRef(0);
  const readyAt = useRef(0);
  const lastText = useRef('');
  // Web only: the route is laid out behind the splash but stays transparent
  // until this flips. It flips on a schedule, never on a measurement: the body
  // is revealed as soon as it has structural text, then handed over after a
  // short paint grace, and handed over regardless once BODY_TIMEOUT_MS passes.
  // `innerText` used to gate this, but it stays empty whenever the renderer
  // skips the body (no font metrics, deferred layout), which held the splash
  // over a mounted app forever.
  const [contentReady, setContentReady] = useState(Platform.OS !== 'web');

  useEffect(() => {
    if (Platform.OS !== 'web' || contentReady || !ready) return;
    if (readyAt.current === 0) readyAt.current = Date.now();
    let poll: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;

    const handOver = () => {
      if (cancelled) return;
      onContentReady?.();
      setContentReady(true);
    };

    // A timer, not `requestAnimationFrame`: this runs on a page whose main
    // thread is already saturated by the boot bundle, where frames can be
    // starved for seconds. The check is one attribute lookup, so polling costs
    // nothing and cannot be paused by the renderer.
    const check = () => {
      if (cancelled) return;
      const body = document.querySelector('[data-testid="screen-body"]');
      const text = (body?.textContent ?? '').trim();
      if (text.length > 0) {
        if (!revealed.current) {
          revealed.current = true;
          onContentReady?.();
        }
        // The body is the page now, but it may still be assembling (a chart, a
        // list that fills in after hydration). Hold the splash while its text
        // is still changing, so the dissolve cannot expose a late reflow, and
        // leave once it has been still for the grace. The deadline caps a body
        // that never settles.
        if (text !== lastText.current) {
          lastText.current = text;
          settledAt.current = Date.now();
        } else if (Date.now() - settledAt.current >= PAINT_GRACE_MS) {
          setContentReady(true);
          return;
        }
      }
      poll = setTimeout(check, POLL_MS);
    };
    poll = setTimeout(check, POLL_MS);

    // The backstop, measured from the moment the splash could first hand over:
    // a route that never produces a body must not pin the splash.
    const elapsed = Date.now() - readyAt.current;
    const deadline = setTimeout(handOver, Math.max(0, BODY_TIMEOUT_MS - elapsed));

    return () => {
      cancelled = true;
      if (poll) clearTimeout(poll);
      clearTimeout(deadline);
    };
  }, [ready, contentReady, onContentReady]);

  const canExit = ready && contentReady;

  // Exit: hold until the minimum has elapsed, then dissolve. There is no
  // entrance animation — the skeleton is already the page, so moving it in
  // would only delay the moment the learner can read the layout.
  useEffect(() => {
    if (!canExit || exiting.current) return;
    exiting.current = true;
    const wait = Math.max(0, MIN_VISIBLE_MS - (Date.now() - mountedAt.current));
    const finish = () => {
      if (handedOver.current) return;
      handedOver.current = true;
      onDone();
    };
    // The dissolve is the frame-driven path; the timer is the guarantee that
    // the layer is removed even when the renderer is not producing frames.
    const guard = setTimeout(finish, wait + motion.slow + FADE_GUARD_MS);
    void (async () => {
      await timingTo(exit, 1, {
        duration: motion.slow,
        delay: wait,
        nativeDriver: USE_NATIVE_DRIVER,
      });
      clearTimeout(guard);
      finish();
    })();
    return () => clearTimeout(guard);
  }, [canExit, exit, onDone]);

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
