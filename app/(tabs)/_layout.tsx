import { Tabs } from 'expo-router';
import { MaterialIcons } from '../../components/Icon';
import { LiquidTabBar } from '../../components/LiquidTabBar';
import { iconSize } from '../../theme/tokens';

type TabIconName = React.ComponentProps<typeof MaterialIcons>['name'];

type TabDefinition = {
  name: string;
  title: string;
  icon: TabIconName;
};

const TABS: TabDefinition[] = [
  { name: 'home', title: 'Home', icon: 'home' },
  { name: 'library', title: 'Game', icon: 'sports-esports' },
  { name: 'settings', title: 'Settings', icon: 'settings' },
];

/**
 * Root tabs — one floating liquid-glass capsule, centred at the bottom.
 *
 * The navigator owns route state and the fade transition; `LiquidTabBar` owns
 * the pane, the travelling lens and the drag gesture. Labels live in the bar
 * now that it is tall enough, so each tab carries its name visually as well as
 * through `tabBarAccessibilityLabel`.
 */
export default function TabLayout() {
  return (
    <Tabs
      tabBar={(props) => <LiquidTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        // Tabs cross-fade instead of switching abruptly; the Screen shell adds
        // the body's fade/rise on focus inside each of them.
        animation: 'fade',
      }}
    >
      {TABS.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.title,
            tabBarAccessibilityLabel: tab.title,
            // The custom bar passes a token string; resolve the navigation
            // ColorValue (which can be null/native) before handing it on.
            // v3's dock uses a 20px glyph; the token falls back for the
            // preview states that do not pass a size.
            tabBarIcon: ({ color }) => (
              <MaterialIcons
                name={tab.icon}
                size={iconSize.lg}
                color={typeof color === 'string' ? color : undefined}
              />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
