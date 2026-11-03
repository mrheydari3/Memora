import { useEffect } from 'react';
import { View, Platform } from 'react-native';
import { ToggleSwitch } from '../../components';
import { useSettingsStore } from '../../store/useSettingsStore';
import { useInstallStore } from '../../store/useInstallStore';
import { registerServiceWorker, unregisterServiceWorker } from '../../services/install';
import {
  AppText,
  Screen,
  TopAppBar,
  PrimaryButton,
  SettingsPlate,
  SettingsSection,
  SettingsRow,
  SettingsNote,
  RevealItem,
} from '../../components';
import { colors } from '../../theme/tokens';

export default function OfflineScreen() {
  const { settings, update } = useSettingsStore();
  const { installed, promptInstall, deferredPrompt } = useInstallStore();
  // Read straight from the store: beforeinstallprompt can fire after this
  // screen mounts, and a one-off check would never show the install button.
  const canPrompt = deferredPrompt !== null && !installed;

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

  const isInstalled = Platform.OS === 'web' && (installed || settings.pwaInstalled);

  return (
    <Screen scroll gutter header={<TopAppBar title="Offline & install" back />}>
      <RevealItem index={0}>
      <SettingsPlate
        icon="cloud-off"
        eyebrow="Offline"
        status={
          settings.offlineCacheEnabled
            ? { label: 'Cached', tone: 'success' }
            : { label: 'Cache off', tone: 'muted' }
        }
        title="Study without a connection"
        description="Cards you open are kept on this device, so a dropped connection never ends a session."
        ledger={[
          {
            label: 'Offline cache',
            value: settings.offlineCacheEnabled ? 'On' : 'Off',
            accent: settings.offlineCacheEnabled,
          },
          {
            label: 'Install',
            value: isInstalled ? 'Installed' : Platform.OS === 'web' ? 'Not installed' : 'Ready',
          },
          { label: 'Storage', value: 'On this device' },
        ]}
      />
      </RevealItem>

      <SettingsSection label="Offline study" hint="Beta" index={1}>
        <SettingsRow
          icon="cloud-off"
          title="Offline study"
          subtitle="Keep the cards you open on this device."
          trailing={
            <ToggleSwitch
              value={settings.offlineCacheEnabled}
              onToggle={handleOfflineToggle}
              accessibilityLabel="Offline Study"
            />
          }
          isLast
        />
      </SettingsSection>

      <SettingsSection label="Install app" index={2}>
        {Platform.OS === 'web' ? (
          isInstalled ? (
            <SettingsRow
              icon="download-done"
              iconColor={colors.success}
              title="Installed"
              subtitle="Memora opens from your home screen and works offline."
              isLast
            />
          ) : canPrompt ? (
            <View className="p-4">
              <AppText variant="bodySm" tone="muted">
                Install Memora to study with zero network access — everything is cached on your
                device.
              </AppText>
              <PrimaryButton className="mt-4" label="Install Memora" onPress={handleInstall} />
            </View>
          ) : (
            <SettingsRow
              icon="ios-share"
              title="Add to home screen"
              subtitle="Open your browser menu and choose 'Add to Home Screen'."
              isLast
            />
          )
        ) : (
          <SettingsRow
            icon="check-circle"
            iconColor={colors.success}
            title="On this device"
            subtitle="Everything is stored locally."
            isLast
          />
        )}
      </SettingsSection>

      <SettingsNote icon="cloud-off">
        Offline study is in beta: cards are cached as you open them, so a first visit still needs a
        connection.
      </SettingsNote>
    </Screen>
  );
}
