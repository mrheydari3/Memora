import { useEffect, useRef, useState } from 'react';
import { Animated, ScrollView, View, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Edge } from 'react-native-safe-area-context';
import { useIsFocused } from 'expo-router';
import { ambient, motion, spacing } from '../theme/tokens';
import { useReveal } from '../motion';

/**
 * AmbientBackdrop — three soft colour fields behind the whole screen. Every
 * frosted pane in the app refracts these, which is what makes the glass read as
 * glass rather than as a flat translucent rectangle. Rendered first so all later
 * siblings stack above it, and never interactive.
 *
 * Web blurs the fields with CSS; native draws the same fields at very low alpha
 * (React Native cannot blur a view without an extra dependency).
 */
const isWeb = Platform.OS === 'web';

const field = (colour: { web: string; native: string }) => (isWeb ? colour.web : colour.native);

export function AmbientBackdrop() {
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
      <View
        style={{
          position: 'absolute',
          width: 320,
          height: 320,
          borderRadius: 160,
          top: -110,
          left: -120,
          backgroundColor: field(ambient.blue),
        }}
      />
      <View
        style={{
          position: 'absolute',
          width: 300,
          height: 300,
          borderRadius: 150,
          top: '38%',
          right: -140,
          backgroundColor: field(ambient.amber),
        }}
      />
      <View
        style={{
          position: 'absolute',
          width: 340,
          height: 340,
          borderRadius: 170,
          bottom: -150,
          left: -80,
          backgroundColor: field(ambient.green),
        }}
      />
    </View>
  );
}

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
