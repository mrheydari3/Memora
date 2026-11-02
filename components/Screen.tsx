import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, ScrollView, StyleSheet, View, Platform } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Edge } from 'react-native-safe-area-context';
import { useIsFocused } from 'expo-router';
import { ambient, motion, spacing } from '../theme/tokens';
import { USE_NATIVE_DRIVER, useReducedMotion, useReveal } from '../motion';

/**
 * AmbientBackdrop — three deep colour fields behind the whole screen. Every
 * frosted pane in the app refracts these, which is what makes the glass read as
 * glass rather than as a flat translucent rectangle. Rendered first so all later
 * siblings stack above it, and never interactive.
 *
 * The fields drift and breathe very slowly (one shared 52s clock), so the dark
 * canvas has a little living colour behind the glass. Web blurs the fields with
 * CSS; native draws the same fields at very low alpha (React Native cannot blur
 * a view without an extra dependency). Reduce-motion freezes them in place.
 */
const isWeb = Platform.OS === 'web';

const field = (colour: { web: string; native: string }) => (isWeb ? colour.web : colour.native);

/** One slow round-trip for every ambient field. Kept long so it is subliminal. */
const AMBIENT_LOOP_MS = 52_000;

let ambientClock: Animated.Value | null = null;
let ambientUsers = 0;
let ambientLoop: Animated.CompositeAnimation | null = null;

/**
 * One shared drift clock. Every mounted screen has an AmbientBackdrop and the
 * tabs keep their screens mounted, so a loop per screen would run the same
 * motion several times over. Reference counting keeps a single loop alive while
 * at least one backdrop wants it.
 */
function useAmbientDrift(enabled: boolean) {
  const value = useMemo(() => {
    if (!ambientClock) ambientClock = new Animated.Value(0);
    return ambientClock;
  }, []);

  useEffect(() => {
    if (!enabled) return;

    ambientUsers += 1;
    if (!ambientLoop) {
      ambientLoop = Animated.loop(
        Animated.timing(value, {
          toValue: 1,
          duration: AMBIENT_LOOP_MS,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: USE_NATIVE_DRIVER,
          isInteraction: false,
        })
      );
      ambientLoop.start();
    }

    return () => {
      ambientUsers -= 1;
      if (ambientUsers > 0) return;
      ambientLoop?.stop();
      ambientLoop = null;
      ambientUsers = 0;
      value.setValue(0);
    };
  }, [enabled, value]);

  return value;
}

/** A there-and-back wave that starts and ends at zero, so the loop is seamless. */
function wave(value: Animated.Value, peakAt: number, peak: number) {
  return value.interpolate({ inputRange: [0, peakAt, 1], outputRange: [0, peak, 0] });
}

type DriftFieldProps = {
  drift: Animated.Value;
  reduced: boolean;
  style: StyleProp<ViewStyle>;
  /** Peak horizontal/vertical travel in px. */
  dx: number;
  dy: number;
  /** Peak scale at the top of this field's wave. */
  grow: number;
  /** Opacity at the top of the wave, so the fields blend at different times. */
  fade: number;
  /** Where in the 52s loop this field peaks (0–1). */
  peakAt: number;
};

function DriftField({ drift, reduced, style, dx, dy, grow, fade, peakAt }: DriftFieldProps) {
  const driftStyle = reduced
    ? null
    : {
        transform: [
          { translateX: wave(drift, peakAt, dx) },
          { translateY: wave(drift, peakAt, dy) },
          {
            scale: drift.interpolate({
              inputRange: [0, peakAt, 1],
              outputRange: [1, grow, 1],
            }),
          },
        ],
        opacity: drift.interpolate({
          inputRange: [0, peakAt, 1],
          outputRange: [1, fade, 1],
        }),
      };

  return <Animated.View style={[style, driftStyle]} />;
}

export function AmbientBackdrop() {
  const reduced = useReducedMotion();
  const drift = useAmbientDrift(!reduced);

  return (
    <View
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        overflow: 'hidden',
        ...(isWeb ? { filter: 'blur(90px)' } : {}),
        pointerEvents: 'none',
      }}
    >
      <DriftField
        drift={drift}
        reduced={reduced}
        style={styles.blueField}
        dx={26}
        dy={-18}
        grow={1.08}
        fade={0.8}
        peakAt={0.4}
      />
      <DriftField
        drift={drift}
        reduced={reduced}
        style={styles.amberField}
        dx={-30}
        dy={22}
        grow={1.06}
        fade={0.66}
        peakAt={0.58}
      />
      <DriftField
        drift={drift}
        reduced={reduced}
        style={styles.greenField}
        dx={18}
        dy={-24}
        grow={1.1}
        fade={0.72}
        peakAt={0.72}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  blueField: {
    position: 'absolute',
    width: 340,
    height: 340,
    borderRadius: 170,
    top: -120,
    left: -120,
    backgroundColor: field(ambient.blue),
  },
  amberField: {
    position: 'absolute',
    width: 320,
    height: 320,
    borderRadius: 160,
    top: '38%',
    right: -150,
    backgroundColor: field(ambient.amber),
  },
  greenField: {
    position: 'absolute',
    width: 360,
    height: 360,
    borderRadius: 180,
    bottom: -160,
    left: -100,
    backgroundColor: field(ambient.green),
  },
});

type ScreenProps = {
  children: React.ReactNode;
  /** Safe-area edges to inset. Defaults to the top only; the tab bar handles the bottom. */
  edges?: readonly Edge[];
  className?: string;
  /** The fixed app bar, rendered above the scrolling body. */
  header?: React.ReactNode;
  /** A fixed footer (primary action, rating row) rendered below the body. */
  footer?: React.ReactNode;
  /** Put the children in a scrolling body with the standard gutters. */
  scroll?: boolean;
  /** Apply the 20px content gutter (only meaningful with `scroll`). */
  gutter?: boolean;
  /** Reserve room for the floating tab capsule. */
  tabClearance?: boolean;
  contentClassName?: string;
  /**
   * Fade/rise the body every time the screen takes focus. On by default: every
   * route then enters with the same motion, including a tab you come back to.
   * Turn it off for a screen that owns its own entrance (a live session).
   */
  animate?: boolean;
};

/**
 * Screen — the standard route shell: ink canvas, safe area, ambient backdrop,
 * a fixed app bar and an optional fixed footer around one scrolling body.
 *
 * It owns the three numbers every screen used to re-declare inline: the top
 * gap, the side gutter and the bottom clearance (104 under the tab capsule, 40
 * otherwise). It also owns the page entrance, so navigation motion is a property
 * of the shell rather than a line each screen has to remember.
 */
export function Screen({
  children,
  edges = ['top'],
  className = '',
  header,
  footer,
  scroll = false,
  gutter = false,
  tabClearance = false,
  contentClassName = '',
  animate = true,
}: ScreenProps) {
  const focused = useIsFocused();
  // A pass counter, not the boolean: returning to a tab must replay the entrance.
  const [pass, setPass] = useState(0);
  const seenFocus = useRef(false);

  useEffect(() => {
    if (!focused) return;
    // The first focus is the mount itself, whose reveal already runs.
    if (!seenFocus.current) {
      seenFocus.current = true;
      return;
    }
    setPass((value) => value + 1);
  }, [focused]);

  const reveal = useReveal(pass, { distance: 8, duration: motion.base });

  return (
    // The main landmark lives in the root layout, around the navigator: the
    // floating tab capsule is rendered by the router outside any screen, so a
    // per-screen <main> left it as content outside a landmark.
    <SafeAreaView className={`flex-1 bg-background ${className}`} edges={edges}>
      <AmbientBackdrop />
      {header}
      <Animated.View style={{ flex: 1, ...(animate ? reveal.style : null) }}>
        {scroll ? (
          <ScrollView
            className={`flex-1 ${contentClassName}`}
            contentContainerStyle={{
              paddingTop: spacing.screen,
              paddingBottom: tabClearance ? spacing.tabClearance : spacing.screenBottom,
              ...(gutter ? { paddingHorizontal: spacing.screen } : {}),
            }}
            showsVerticalScrollIndicator={false}
          >
            {children}
          </ScrollView>
        ) : (
          children
        )}
      </Animated.View>
      {footer}
    </SafeAreaView>
  );
}
