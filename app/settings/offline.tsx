import { useEffect } from 'react';
import { Platform, View } from 'react-native';
import { useRouter } from 'expo-router';
import { goBackOr } from '../../services/navigation';
import { MaterialIcons } from '../../components/Icon';
import { useSettingsStore } from '../../store/useSettingsStore';
import { useInstallStore } from '../../store/useInstallStore';
import { registerServiceWorker, unregisterServiceWorker } from '../../services/install';
import { RevealItem, Screen, ToggleSwitch } from '../../components';
import {
  SettingsBackHeader,
  SettingsChapter,
  SettingsFootnote,
  SettingsHero,
  SettingsLine,
} from '../../components/v3';
import { colors, iconSize } from '../../theme/tokens';
import { v3 } from '../../theme/v3';

const installedMark = (
  <MaterialIcons name="check-circle" size={iconSize.md} color={colors.success} />
);

/**
 * Offline & install — what stays on the device when the network is gone, in the
 * v3 "Nocturne Focus" language.
 *
 * The hero answers cache, install and storage in one pane; the chapters then
 * hold the cache switch, how caching behaves and the install action as 64px
 * lines. The service worker is still registered only while the cache is on, so
 * opening this page never opts the user in behind their back.
 */
export default function OfflineScreen() {
  const router = useRouter();
  const { settings, update } = useSettingsStore();
  const { installed, promptInstall, deferredPrompt } = useInstallStore();

  // Read straight from the store: beforeinstallprompt can fire after this
  // screen mounts, and a one-off check would never show the install button.
  const canPrompt = deferredPrompt !== null && !installed;
  const isInstalled = Platform.OS === 'web' && (installed || settings.pwaInstalled);
  const cached = settings.offlineCacheEnabled;

  // Lazy service-worker registration is an opt-in: opening this screen while
  // the cache is off must not register a worker behind the user's back.
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (settings.offlineCacheEnabled) void registerServiceWorker();
    else void unregisterServiceWorker();
  }, [settings.offlineCacheEnabled]);

  const handleOfflineToggle = async (value: boolean) => {
    await update({ offlineCacheEnabled: value });
    if (value) await registerServiceWorker();
    else await unregisterServiceWorker();
  };

  const handleInstall = async () => {
    const accepted = await promptInstall();
    if (accepted) await update({ pwaInstalled: true });
  };

  const ledger = [
    { label: 'Offline cache', value: cached ? 'On' : 'Off' },
    {
      label: 'Install',
      value: isInstalled ? 'Installed' : Platform.OS === 'web' ? 'Not installed' : 'On device',
    },
    { label: 'Storage', value: 'On this device' },
  ];

  const installSection = (
    <SettingsChapter label="Install app">
      {Platform.OS !== 'web' ? (
        <SettingsLine
          icon="check-circle"
          tone={colors.success}
          title="On this device"
          subtitle="Everything is stored locally."
          trailing={installedMark}
          last
        />
      ) : isInstalled ? (
        <SettingsLine
          icon="download-done"
          tone={colors.success}
          title="Installed"
          subtitle="Memora opens from your home screen; cached pages stay available offline."
          trailing={installedMark}
          last
        />
      ) : canPrompt ? (
        <SettingsLine
          icon="download"
          tone={colors.info}
          title="Install Memora"
          subtitle="Open from your home screen; cached pages stay available offline."
          value="Install"
          onPress={handleInstall}
          last
        />
      ) : (
        <SettingsLine
          icon="ios-share"
          tone={colors.info}
          title="Add to home screen"
          subtitle="Open the browser menu and choose “Add to Home Screen”."
          last
        />
      )}
    </SettingsChapter>
  );

  return (
    <Screen
      scroll
      gutter
      contentMaxWidth={v3.layout.contentMaxWidth}
      header={<SettingsBackHeader title="Offline" onBack={() => goBackOr(router, '/settings')} />}
    >
      <View style={{ paddingBottom: 24 }}>
        <View style={{ gap: 28 }}>
          <RevealItem index={0}>
            <SettingsHero
              testID="offline-hero"
              eyebrow="Storage"
              status={{
                label: cached ? 'Cached' : 'Cache off',
                tone: cached ? 'success' : 'muted',
              }}
              title={cached ? 'Cached on this device' : 'Only online for now'}
              description="Your decks and review history already live on this device. The offline cache keeps the app shell available when the network is gone."
              ledger={ledger}
            />
          </RevealItem>

          <RevealItem index={1}>
            <SettingsChapter label="Cache">
              <SettingsLine
                icon="cloud-off"
                tone={colors.info}
                title="Offline cache"
                subtitle="Keep the app shell and visited pages on this device."
                trailing={
                  <ToggleSwitch
                    value={settings.offlineCacheEnabled}
                    onToggle={handleOfflineToggle}
                    accessibilityLabel="Offline cache"
                  />
                }
                last
              />
            </SettingsChapter>
          </RevealItem>

          <RevealItem index={2}>
            <SettingsChapter label="How it works">
              <SettingsLine
                icon="touch-app"
                tone={colors.info}
                title="Open a page"
                subtitle="The first load of a page needs a connection."
              />
              <SettingsLine
                icon="download-done"
                tone={colors.info}
                title="Cached as you browse"
                subtitle="The app shell and pages you visit are stored."
              />
              <SettingsLine
                icon="cloud-off"
                tone={colors.info}
                title="Reopen offline"
                subtitle="Cached pages open without a connection."
                last
              />
            </SettingsChapter>
          </RevealItem>

          <RevealItem index={3}>{installSection}</RevealItem>

          <SettingsFootnote icon="info-outline">
            Offline caching covers the app shell and pages you have opened. Your decks and reviews
            are stored locally, but the first load of a page still needs a connection.
          </SettingsFootnote>
        </View>
      </View>
    </Screen>
  );
}
