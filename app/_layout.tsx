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
import { ensureWebFonts } from '../services/webFonts';
import { noteActivePath } from '../services/navigation';
import { colors, motion } from '../theme/tokens';
import { AppSplash } from '../components/AppSplash';
import { AppText, PrimaryButton } from '../components';

const styles = StyleSheet.create({
  // `overflow: hidden` clips the tab capsule's negative insets: at 320px they
  // pushed the document 3px wide (a horizontal scrollbar on a page that has
  // nothing to scroll). Nothing here is content.
  shell: { flex: 1, overflow: 'hidden' },
  loadError: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
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
  const deckError = useDeckStore((s) => s.loadError);
  const reviewError = useReviewStore((s) => s.loadError);
  const settingsError = useSettingsStore((s) => s.loadError);
  const gameError = useGameStore((s) => s.loadError);

  // Initialize stores and PWA install listener on boot
  useEffect(() => {
    // The web build re-registers the two Inter weights expo-font drops; see
    // services/webFonts.ts. It is a no-op on native.
    ensureWebFonts();
    useDeckStore.getState().load();
    useReviewStore.getState().load();
    useSettingsStore.getState().load();
    useGameStore.getState().load();

    if (Platform.OS === 'web') {
      initInstallPromptListener();
    }
  }, []);

  const fontsReady = fontsLoaded || !!fontError;
  const storesReady = deckLoaded && reviewLoaded && settingsLoaded && gameLoaded;
  // The app may only mount once every store has hydrated. A timeout must never
  // hand over an empty store: the first write would replace real data.
  const ready = fontsReady && storesReady;

  const [splashDone, setSplashDone] = useState(false);

  const loadFailed = Boolean(deckError || reviewError || settingsError || gameError);
  useEffect(() => {
    if (loadFailed) setSplashDone(true);
  }, [loadFailed]);

  const retryLoad = () => {
    setSplashDone(false);
    if (deckError) void useDeckStore.getState().load();
    if (reviewError) void useReviewStore.getState().load();
    if (settingsError) void useSettingsStore.getState().load();
    if (gameError) void useGameStore.getState().load();
  };

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
            {/* Add Deck presents as a bottom sheet per the spec (6.4). The
                route itself is transparent so its own scrim can dim the
                canvas behind it. */}
            <Stack.Screen
              name="add-deck"
              options={{
                // `transparentModal` keeps the previous screen mounted and
                // visible behind the route; `modal` unmounts it and leaves the
                // scrim over black, which is not a sheet over the app.
                presentation: 'transparentModal',
                animation: 'slide_from_bottom',
                contentStyle: { backgroundColor: 'transparent' },
              }}
            />
          </Stack>
        )}
        {loadFailed && (
          <View style={styles.loadError}>
            <AppText variant="title" headingLevel={1} align="center">
              Couldn’t open your library
            </AppText>
            <AppText variant="body" tone="muted" align="center" className="mt-2">
              Your saved decks are still on this device. Nothing was overwritten.
            </AppText>
            <View style={{ marginTop: 20, width: 200 }}>
              <PrimaryButton label="Try again" icon="refresh" onPress={retryLoad} />
            </View>
          </View>
        )}
      </View>
      {!splashDone && !loadFailed && (
        <AppSplash ready={ready} onDone={() => setSplashDone(true)} />
      )}
    </>
  );
}
