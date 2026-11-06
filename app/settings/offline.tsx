import { useEffect } from 'react';
import { Platform } from 'react-native';
import { MaterialIcons } from '../../components/Icon';
import { useSettingsStore } from '../../store/useSettingsStore';
import { useInstallStore } from '../../store/useInstallStore';
import { registerServiceWorker, unregisterServiceWorker } from '../../services/install';
import {
  RevealItem,
  Screen,
  SettingsNote,
  SettingsPlate,
  SettingsRow,
  SettingsSection,
  ToggleSwitch,
  TopAppBar,
} from '../../components';
import { colors, iconSize } from '../../theme/tokens';
import { v2 } from '../../theme/v2';

const installedMark = (
  <MaterialIcons name="check-circle" size={iconSize.md} color={colors.success} />
);

/**
 * Offline & install — what stays on the device when the network is gone.
 *
 * The page follows the settings rhythm: one plate with the cache state and the
 * install readout, then chapters for the cache, how it behaves, and installing
 * the app. Every control is a standard setting row; there are no stamps, room
 * numbers or decorative rules.
 */
export default function OfflineScreen() {
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
    { label: 'Offline cache', value: cached ? 'On' : 'Off', accent: cached },
    {
      label: 'Install',
      value: isInstalled ? 'Installed' : Platform.OS === 'web' ? 'Not installed' : 'On this device',
    },
    { label: 'Storage', value: 'On this device' },
  ];

  const installSection = (
    <SettingsSection label="Install app" index={3}>
      {Platform.OS !== 'web' ? (
        <SettingsRow
          icon="check-circle"
          iconTone="success"
          title="On this device"
          subtitle="Everything is stored locally."
          trailing={installedMark}
          isLast
        />
      ) : isInstalled ? (
        <SettingsRow
          icon="download-done"
          iconTone="success"
          title="Installed"
          subtitle="Memora opens from your home screen; cached pages stay available offline."
          trailing={installedMark}
          isLast
        />
      ) : canPrompt ? (
        <SettingsRow
          icon="download"
          iconTone="info"
          title="Install Memora"
          subtitle="Open from your home screen; cached pages stay available offline."
          value="Install"
          onPress={handleInstall}
          isLast
        />
      ) : (
        <SettingsRow
          icon="ios-share"
          iconTone="info"
          title="Add to home screen"
          subtitle="Open the browser menu and choose “Add to Home Screen”."
          isLast
        />
      )}
    </SettingsSection>
  );

  return (
    <Screen
      scroll
      gutter
      contentMaxWidth={v2.layout.contentMaxWidth}
      header={<TopAppBar title="Offline" back backFallback="/settings" />}
    >
      <RevealItem index={0}>
        <SettingsPlate
          tone="glass"
          icon="cloud-off"
          eyebrow="Storage"
          title={cached ? 'Cached on this device' : 'Only online for now'}
          description="Your decks and review history already live on this device. The offline cache keeps the app shell available when the network is gone."
          status={{
            label: cached ? 'Cached' : 'Cache off',
            tone: cached ? 'success' : 'muted',
          }}
          ledger={ledger}
        />
      </RevealItem>

      <SettingsSection label="Cache" index={1}>
        <SettingsRow
          icon="cloud-off"
          iconTone="info"
          title="Offline cache"
          subtitle="Keep the app shell and visited pages on this device."
          iconPulseKey={cached}
          trailing={
            <ToggleSwitch
              value={settings.offlineCacheEnabled}
              onToggle={handleOfflineToggle}
              accessibilityLabel="Offline cache"
            />
          }
          isLast
        />
      </SettingsSection>

      <SettingsSection label="How it works" index={2}>
        <SettingsRow
          icon="touch-app"
          iconTone="info"
          title="Open a page"
          subtitle="The first load of a page needs a connection."
        />
        <SettingsRow
          icon="download-done"
          iconTone="info"
          title="Cached as you browse"
          subtitle="The app shell and pages you visit are stored."
        />
        <SettingsRow
          icon="cloud-off"
          iconTone="info"
          title="Reopen offline"
          subtitle="Cached pages open without a connection."
          isLast
        />
      </SettingsSection>

      {installSection}

      <SettingsNote icon="info-outline">
        Offline caching covers the app shell and pages you have opened. Your decks and reviews
        are stored locally, but the first load of a page still needs a connection.
      </SettingsNote>
    </Screen>
  );
}
