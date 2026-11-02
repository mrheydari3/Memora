// Root layout: global CSS, dark background, splash hand-off, store initialization
import '../global.css';

import { useEffect, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { Stack, usePathname } from 'expo-router';
import Head from 'expo-router/head';
import { StatusBar } from 'expo-status-bar';
import { useFonts, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { useDeckStore } from '../store/useDeckStore';
import { useReviewStore } from '../store/useReviewStore';
import { useSettingsStore } from '../store/useSettingsStore';
import { useGameStore } from '../store/useGameStore';
import { initInstallPromptListener } from '../services/install';
import { noteActivePath } from '../services/navigation';
import { colors, motion } from '../theme/tokens';
import { AppSplash } from '../components/AppSplash';

/** The longest the splash may wait for hydration before handing over anyway. */
const SPLASH_TIMEOUT_MS = 1200;

const styles = StyleSheet.create({
  // `overflow: hidden` clips the decorative ambient fields and the tab capsule's
  // negative insets: at 320px they pushed the document 3px wide (a horizontal
  // scrollbar on a page that has nothing to scroll). Nothing here is content.
  shell: { flex: 1, overflow: 'hidden' },
});

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  // A push is only collapsed while its destination is still the active route,
  // so returning to a screen you just left is never swallowed.
  const pathname = usePathname();
  useEffect(() => {
    noteActivePath(pathname);
  }, [pathname]);

  const deckLoaded = useDeckStore((s) => s.loaded);
  const reviewLoaded = useReviewStore((s) => s.loaded);
  const settingsLoaded = useSettingsStore((s) => s.loaded);
  const gameLoaded = useGameStore((s) => s.loaded);

  // Initialize stores and PWA install listener on boot
  useEffect(() => {
    useDeckStore.getState().load();
    useReviewStore.getState().load();
    useSettingsStore.getState().load();
    useGameStore.getState().load();

    if (Platform.OS === 'web') {
      initInstallPromptListener();
    }
  }, []);

  // A slow disk must never trap the splash: after the cap the app renders with
  // whatever hydrated, instead of holding a promise the user cannot see.
  const [timedOut, setTimedOut] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setTimedOut(true), SPLASH_TIMEOUT_MS);
    return () => clearTimeout(id);
  }, []);

  const fontsReady = fontsLoaded || !!fontError;
  const storesReady = deckLoaded && reviewLoaded && settingsLoaded && gameLoaded;
  const ready = (fontsReady || timedOut) && (storesReady || timedOut);

  const [splashDone, setSplashDone] = useState(false);

  return (
    <>
      <Head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
      </Head>
      <StatusBar style="light" />
      {/*
        One main landmark for the whole app. It wraps the navigator rather than
        each screen, because the router renders the floating tab capsule outside
        the screen tree — inside a per-screen <main> that bar counted as content
        outside a landmark on every route (axe `region`).
      */}
      <View style={styles.shell} role="main">
        {ready && (
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: colors.background },
              animation: 'slide_from_right',
              animationDuration: motion.base,
              gestureEnabled: true,
            }}
          >
            {/* Add Deck presents as a bottom sheet per the spec (6.4) */}
            <Stack.Screen name="add-deck" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
          </Stack>
        )}
      </View>
      {!splashDone && <AppSplash ready={ready} onDone={() => setSplashDone(true)} />}
    </>
  );
}
