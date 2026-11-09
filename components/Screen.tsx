import { useEffect, useRef, useState } from 'react';
import { Animated, Platform, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Edge } from 'react-native-safe-area-context';
import { useIsFocused } from 'expo-router';
import { heights, motion, spacing } from '../theme/tokens';
import { useReveal } from '../motion';

type ScreenProps = {
  children: React.ReactNode;
  /** Safe-area edges to inset. Defaults to the top only; the tab bar handles the bottom. */
  edges?: readonly Edge[];
  className?: string;
  /** The floating app bar; its measured height is reserved at the top of the body. */
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
  /**
   * A route-owned dialog covers this screen. On web the shell becomes inert so
   * neither the keyboard nor assistive technology can reach the covered content.
   */
  backgroundInert?: boolean;
};

/**
 * Screen — the standard route shell: flat ink canvas, safe area, a floating app
 * bar and an optional fixed footer around one scrolling body.
 *
 * The bar is painted above the body and its measured height pads the body, so
 * the content starts below it and scrolls up beneath its glass on the way back.
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
  backgroundInert = false,
}: ScreenProps) {
  const focused = useIsFocused();
  // A pass counter, not the boolean: returning to a tab must replay the entrance.
  const [pass, setPass] = useState(0);
  // Seed with the standard PageHeader height so the first paint is already
  // below the bar; a custom header corrects this on its first layout.
  const [headerHeight, setHeaderHeight] = useState(header ? heights.pageHeader : 0);
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
  const screenRef = useRef<React.ComponentRef<typeof SafeAreaView>>(null);

  // The attribute, not just aria-hidden, is what removes the shell from the web
  // tab order. Cleanup restores it when the dialog closes or the route changes.
  useEffect(() => {
    if (!backgroundInert || Platform.OS !== 'web') return;
    const node = screenRef.current as unknown as {
      setAttribute: (name: string, value: string) => void;
      removeAttribute: (name: string) => void;
    } | null;
    if (!node) return;
    node.setAttribute('inert', '');
    return () => node.removeAttribute('inert');
  }, [backgroundInert]);

  return (
    // The main landmark lives in the root layout, around the navigator: the
    // floating tab capsule is rendered by the router outside any screen, so a
    // per-screen <main> left it as content outside a landmark.
    <SafeAreaView
      ref={screenRef}
      className={`flex-1 bg-background ${className}`}
      edges={edges}
      aria-hidden={backgroundInert || undefined}
      accessibilityElementsHidden={backgroundInert || undefined}
      importantForAccessibility={backgroundInert ? 'no-hide-descendants' : undefined}
    >
      {/* Absolute children ignore the SafeAreaView's padding; this inner box is
          the safe-area content, so the floating bar starts below the status bar
          on native and at y=0 on web. */}
      <View style={{ flex: 1 }}>
        {header ? (
          <View
            pointerEvents="box-none"
            onLayout={(event) => {
              const next = Math.round(event.nativeEvent.layout.height);
              setHeaderHeight((current) => (Math.abs(current - next) > 1 ? next : current));
            }}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 20 }}
          >
            {header}
          </View>
        ) : null}
        <Animated.View
          testID="screen-body"
          style={{
            flex: 1,
            ...(animate ? reveal.style : null),
            ...(header && !scroll ? { paddingTop: headerHeight } : null),
          }}
        >
          {scroll ? (
            <ScrollView
              className={`flex-1 ${contentClassName}`}
              // `focusable`: the screen's own scroll region must be reachable and
              // scrollable from the keyboard, otherwise content that overflows a
              // short viewport (e.g. Statistics at 320×700) is touch-only
              // (axe: "scrollable-region-focusable").
              focusable
              contentContainerStyle={{
                paddingTop: headerHeight + spacing.screen,
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
      </View>
    </SafeAreaView>
  );
}
