import { useEffect, useRef, useState } from 'react';
import { Animated, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Edge } from 'react-native-safe-area-context';
import { useIsFocused } from 'expo-router';
import { motion, spacing } from '../theme/tokens';
import { useReveal } from '../motion';

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
   * Cap the body's reading column and centre it. A list at 768px would
   * otherwise stretch a card across the whole tablet.
   */
  contentMaxWidth?: number;
  /**
   * Fade/rise the body every time the screen takes focus. On by default: every
   * route then enters with the same motion, including a tab you come back to.
   * Turn it off for a screen that owns its own entrance (a live session).
   */
  animate?: boolean;
};

/**
 * Screen — the standard route shell: flat ink canvas, safe area, a fixed app
 * bar and an optional fixed footer around one scrolling body.
 *
 * The canvas is one opaque colour and nothing else: no colour fields, no glow,
 * no animated layer behind the content. Panes still read as glass because they
 * are translucent ink over that canvas; the depth comes from their fills and
 * shadows, so the page costs one paint and then nothing at all.
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
  contentMaxWidth,
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
      {header}
      <Animated.View style={{ flex: 1, ...(animate ? reveal.style : null) }}>
        {scroll ? (
          <ScrollView
            className={`flex-1 ${contentClassName}`}
            // `focusable`: the screen's own scroll region must be reachable and
            // scrollable from the keyboard, otherwise content that overflows a
            // short viewport (e.g. Statistics at 320×700) is touch-only
            // (axe: "scrollable-region-focusable").
            focusable
            contentContainerStyle={{
              paddingTop: spacing.screen,
              paddingBottom: tabClearance ? spacing.tabClearance : spacing.screenBottom,
              ...(gutter ? { paddingHorizontal: spacing.screen } : {}),
              ...(contentMaxWidth
                ? { width: '100%', maxWidth: contentMaxWidth, alignSelf: 'center' }
                : {}),
            }}
            showsVerticalScrollIndicator={false}
            decelerationRate="normal"
            scrollEventThrottle={16}
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
