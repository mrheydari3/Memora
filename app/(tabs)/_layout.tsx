import { useEffect, useRef } from 'react';
import { Animated, View, StyleSheet, useWindowDimensions } from 'react-native';
import type { ColorValue } from 'react-native';
import { Tabs } from 'expo-router';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, glass, iconSize, tabBar } from '../../theme/tokens';
import { springTo, USE_NATIVE_DRIVER } from '../../motion';

type TabIconName = React.ComponentProps<typeof MaterialIcons>['name'];

/** Fixed item width keeps the capsule compact instead of stretching full width. */
const BAR_WIDTH = tabBar.itemWidth * 3;
/** Half the height: the ends are true semicircles, not rounded corners. */
const BAR_RADIUS = tabBar.height / 2;

/**
 * One tab glyph with its selected pill. The pill and the glyph settle in with a
 * spring when the tab becomes active, so switching tabs reads as a press rather
 * than a repaint. Only `transform` and `opacity` animate.
 */
function TabIcon({
  icon,
  color,
  focused,
}: {
  icon: TabIconName;
  /** Navigation hands back a ColorValue; the glyph takes the resolved string. */
  color?: ColorValue;
  focused: boolean;
}) {
  const selected = useRef(new Animated.Value(focused ? 1 : 0)).current;

  useEffect(() => {
    springTo(selected, focused ? 1 : 0);
  }, [focused, selected]);

  return (
    <View className="items-center justify-center" style={{ width: tabBar.pill, height: tabBar.pill }}>
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          {
            borderRadius: tabBar.pill / 2,
            backgroundColor: colors.accentActive,
            opacity: selected,
            transform: [
              { scale: selected.interpolate({ inputRange: [0, 1], outputRange: [0.72, 1] }) },
            ],
          },
        ]}
      />
      <Animated.View
        style={{
          transform: [
            { scale: selected.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] }) },
          ],
        }}
      >
        <MaterialIcons
          name={icon}
          size={iconSize.lg}
          color={typeof color === 'number' ? undefined : (color as string | undefined)}
        />
      </Animated.View>
    </View>
  );
}

/**
 * Root tabs — one compact floating glass capsule, centred at the bottom:
 * icons only, an iOS-style blurred pane that content scrolls underneath.
 * expo-blur does the frosting (native material on iOS, backdrop-filter on web);
 * the hairline keeps it inside the same border language as the other frosted
 * panes. All geometry comes from `theme/palette.js`.
 */
export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  // Float above the home indicator rather than sitting on it.
  const barBottom = Math.max(insets.bottom, tabBar.gutter);
  const barLeft = Math.max(tabBar.gutter, Math.round((screenWidth - BAR_WIDTH) / 2));

  const tabs = [
    { name: 'home', title: 'Home', icon: 'home' as TabIconName },
    { name: 'library', title: 'Library', icon: 'library-books' as TabIconName },
    { name: 'settings', title: 'Settings', icon: 'settings' as TabIconName },
  ];

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        // Icons only: the capsule is too short for labels, and each tab keeps
        // its accessible name via tabBarAccessibilityLabel.
        tabBarShowLabel: false,
        tabBarHideOnKeyboard: true,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.outline,
        // Tabs cross-fade instead of switching abruptly; the Screen shell adds
        // the body's fade/rise on focus inside each of them.
        animation: 'fade',
        tabBarStyle: {
          position: 'absolute',
          left: barLeft,
          width: BAR_WIDTH,
          bottom: barBottom,
          height: tabBar.height,
          borderRadius: BAR_RADIUS,
          borderTopWidth: 0,
          backgroundColor: 'transparent',
          paddingTop: 0,
          paddingBottom: 0,
          elevation: 0,
        },
        tabBarItemStyle: { paddingVertical: 0, justifyContent: 'center' },
        // Without a label, React Navigation still reserves label space and parks
        // the icon high in the item; flexing the icon container re-centres it.
        tabBarIconStyle: { flex: 1, alignItems: 'center', justifyContent: 'center' },
        tabBarBackground: () => (
          <View
            style={{
              flex: 1,
              borderRadius: BAR_RADIUS,
              overflow: 'hidden',
              borderWidth: 1,
              borderColor: colors.hairline,
              // Carries the pane on Android, where a blur needs a BlurTargetView
              // that a tab bar cannot own; elsewhere it just deepens the tint.
              backgroundColor: glass.tab,
            }}
          >
            <BlurView intensity={glass.blurTab} tint="dark" style={StyleSheet.absoluteFill} />
            {/* Pulls expo-blur's neutral gray tint back to the app's ink navy. */}
            <View
              style={[
                StyleSheet.absoluteFill,
                { backgroundColor: glass.tabOverlay, pointerEvents: 'none' as const },
              ]}
            />
          </View>
        ),
      }}
    >
      {tabs.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.title,
            tabBarIcon: ({ color, focused }) => (
              <TabIcon icon={tab.icon} color={color} focused={focused} />
            ),
            tabBarAccessibilityLabel: tab.title,
          }}
        />
      ))}
    </Tabs>
  );
}

// `USE_NATIVE_DRIVER` is re-exported here only to document that the tab spring
// runs on the native driver on native platforms.
void USE_NATIVE_DRIVER;
