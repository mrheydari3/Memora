import { useEffect } from 'react';
import { Platform, Pressable, View, useWindowDimensions } from 'react-native';
import { MaterialIcons } from '../../components/Icon';
import { useSettingsStore } from '../../store/useSettingsStore';
import { useInstallStore } from '../../store/useInstallStore';
import { registerServiceWorker, unregisterServiceWorker } from '../../services/install';
import {
  AppText,
  PrimaryButton,
  RevealItem,
  Screen,
  ToggleSwitch,
  TopAppBar,
} from '../../components';
import { alpha, colors, glassFill, iconSize, rims } from '../../theme/tokens';
import { v2 } from '../../theme/v2';

type IconName = React.ComponentProps<typeof MaterialIcons>['name'];

function Stamp({
  label,
  color,
  rotate = -2,
}: {
  label: string;
  color: string;
  rotate?: number;
}) {
  return (
    <View
      style={{
        transform: [{ rotate: `${rotate}deg` }],
        borderRadius: 5,
        borderWidth: 1,
        borderStyle: 'dashed',
        borderColor: alpha(color, 0.5),
        backgroundColor: alpha(color, 0.06),
        paddingHorizontal: 8,
        paddingVertical: 4,
        alignSelf: 'flex-start',
      }}
    >
      <AppText
        variant="caption"
        weight="bold"
        style={{ color, letterSpacing: 0.9, textTransform: 'uppercase' }}
      >
        {label}
      </AppText>
    </View>
  );
}

/** The round shelf stamp in the masthead, decorative and hidden from AT. */
function ReserveSeal() {
  return (
    <View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={{
        width: 88,
        height: 88,
        borderRadius: 44,
        borderWidth: 1,
        borderStyle: 'dashed',
        borderColor: alpha(colors.success, 0.5),
        backgroundColor: alpha(colors.success, 0.05),
        alignItems: 'center',
        justifyContent: 'center',
        transform: [{ rotate: '-7deg' }],
        flexShrink: 0,
      }}
    >
      <MaterialIcons name="cloud-done" size={iconSize.sm} color={colors.success} />
      <AppText
        variant="caption"
        weight="bold"
        style={{ color: colors.success, letterSpacing: 1.2, marginTop: 2 }}
      >
        KEPT
      </AppText>
      <AppText variant="caption" tone="muted" style={{ letterSpacing: 0.8 }}>
        LOCAL
      </AppText>
    </View>
  );
}

type SettingsControlProps = {
  icon: IconName;
  title: string;
  subtitle?: string;
  onPress?: () => void;
  trailing?: React.ReactNode;
  isLast?: boolean;
  accent: string;
};

/**
 * The same growing settings row the Settings screen uses: a tinted tile, a
 * wrapping title, and the switch or status mark on the right.
 */
function SettingsControl({
  icon,
  title,
  subtitle,
  onPress,
  trailing,
  isLast = false,
  accent,
}: SettingsControlProps) {
  const row = (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        minHeight: 58,
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: isLast ? 0 : 1,
        borderBottomColor: alpha(colors.onSurface, 0.07),
      }}
    >
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 11,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: alpha(accent, 0.12),
          flexShrink: 0,
          alignSelf: 'flex-start',
        }}
      >
        <MaterialIcons name={icon} size={iconSize.md} color={accent} />
      </View>

      <View style={{ flex: 1, minWidth: 0 }}>
        <AppText variant="body" weight="medium">
          {title}
        </AppText>
        {subtitle ? (
          <AppText variant="bodySm" tone="muted" style={{ marginTop: 3 }}>
            {subtitle}
          </AppText>
        ) : null}
      </View>

      {trailing ??
        (onPress ? (
          <MaterialIcons name="chevron-right" size={iconSize.md} color={colors.outline} />
        ) : null)}
    </View>
  );

  if (!onPress) return row;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => ({
        backgroundColor: pressed ? alpha(accent, 0.05) : 'transparent',
      })}
    >
      {row}
    </Pressable>
  );
}

function RoomSection({
  index,
  label,
  hint,
  color,
  first = false,
  children,
}: {
  index: string;
  label: string;
  hint: string;
  color: string;
  first?: boolean;
  children: React.ReactNode;
}) {
  return (
    <View style={{ marginTop: first ? 0 : 28 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
        <View
          style={{
            minWidth: 30,
            minHeight: 30,
            borderRadius: 9,
            borderWidth: 1,
            borderStyle: 'dashed',
            borderColor: alpha(color, 0.55),
            backgroundColor: alpha(color, 0.08),
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: 4,
          }}
        >
          <AppText
            variant="caption"
            weight="bold"
            style={{ color, fontVariant: ['tabular-nums'] }}
          >
            {index}
          </AppText>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <AppText
            variant="label"
            weight="semibold"
            headingLevel={2}
            style={{ color, letterSpacing: 1.2 }}
          >
            {label}
          </AppText>
          <AppText variant="caption" tone="muted" style={{ marginTop: 1 }}>
            {hint}
          </AppText>
        </View>
      </View>

      <View
        style={{
          height: 1,
          backgroundColor: alpha(color, 0.18),
          marginTop: 10,
          marginBottom: 10,
        }}
      />

      <View
        style={[
          glassFill,
          {
            borderRadius: 24,
            borderTopWidth: 1,
            borderTopColor: rims.soft,
            borderBottomWidth: 1,
            borderBottomColor: colors.outlineVariant,
            overflow: 'hidden',
          },
        ]}
      >
        <View
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: 3,
            backgroundColor: alpha(color, 0.55),
          }}
        />
        {children}
      </View>
    </View>
  );
}

/** One step of the reserve lane inside the pass. */
function ReserveStep({
  index,
  icon,
  title,
  body,
  active,
}: {
  index: string;
  icon: IconName;
  title: string;
  body: string;
  active: boolean;
}) {
  const tone = active ? colors.success : colors.onSurfaceVariant;

  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
      <View
        style={{
          minWidth: 30,
          minHeight: 30,
          borderRadius: 9,
          borderWidth: 1,
          borderStyle: 'dashed',
          borderColor: alpha(tone, 0.45),
          backgroundColor: alpha(tone, 0.06),
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 4,
          flexShrink: 0,
        }}
      >
        <AppText
          variant="caption"
          weight="bold"
          style={{ color: tone, fontVariant: ['tabular-nums'] }}
        >
          {index}
        </AppText>
      </View>

      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
          <MaterialIcons
            name={icon}
            size={iconSize.sm}
            color={tone}
            style={{ marginTop: 3 }}
          />
          <AppText variant="body" weight="medium" style={{ flexShrink: 1 }}>
            {title}
          </AppText>
        </View>
        <AppText variant="bodySm" tone="muted" style={{ marginTop: 2 }}>
          {body}
        </AppText>
      </View>
    </View>
  );
}

function ReserveConnector() {
  return (
    <View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={{
        width: 1,
        height: 14,
        marginLeft: 14,
        marginVertical: 4,
        borderLeftWidth: 1,
        borderStyle: 'dashed',
        borderLeftColor: alpha(colors.onSurface, 0.18),
      }}
    />
  );
}

function ManualStep({ index, text }: { index: string; text: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <View
        style={{
          minWidth: 30,
          minHeight: 30,
          borderRadius: 9,
          borderWidth: 1,
          borderStyle: 'dashed',
          borderColor: alpha(colors.success, 0.45),
          backgroundColor: alpha(colors.success, 0.06),
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 4,
          flexShrink: 0,
        }}
      >
        <AppText
          variant="caption"
          weight="bold"
          style={{ color: colors.success, fontVariant: ['tabular-nums'] }}
        >
          {index}
        </AppText>
      </View>
      <AppText variant="bodySm" style={{ flex: 1, minWidth: 0 }}>
        {text}
      </AppText>
    </View>
  );
}

function ReserveNote() {
  return (
    <View
      style={{
        marginTop: 24,
        padding: 16,
        borderRadius: 16,
        borderWidth: 1,
        borderStyle: 'dashed',
        borderColor: alpha(colors.success, 0.24),
        backgroundColor: alpha(colors.success, 0.04),
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 12,
        transform: [{ rotate: '-0.6deg' }],
      }}
    >
      <View
        style={{
          width: 30,
          height: 30,
          borderRadius: 9,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: alpha(colors.success, 0.12),
          flexShrink: 0,
        }}
      >
        <MaterialIcons name="cloud-off" size={iconSize.sm} color={colors.success} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <AppText
          variant="caption"
          weight="bold"
          style={{ color: colors.success, letterSpacing: 1 }}
        >
          Reserve note
        </AppText>
        <AppText variant="bodySm" tone="muted" style={{ marginTop: 3 }}>
          Offline study is in beta: cards are cached as you open them, so a first visit still
          needs a connection. After that, the shelf is yours.
        </AppText>
      </View>
    </View>
  );
}

export default function OfflineScreen() {
  const { width } = useWindowDimensions();
  const wide = width >= 900;
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

  const ledger: { label: string; value: string; accent?: boolean }[] = [
    { label: 'Offline cache', value: cached ? 'On' : 'Off', accent: cached },
    {
      label: 'Install',
      value: isInstalled ? 'Installed' : Platform.OS === 'web' ? 'Not installed' : 'Ready',
    },
    { label: 'Storage', value: 'On this device' },
  ];

  const masthead = (
    <View style={{ paddingBottom: 8 }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <MaterialIcons name="auto-awesome" size={iconSize.sm} color={colors.success} />
            <AppText
              variant="caption"
              weight="bold"
              style={{ color: colors.success, letterSpacing: 1.4 }}
            >
              Data room · 05.3
            </AppText>
          </View>
        </View>
        <ReserveSeal />
      </View>

      <AppText variant="title" headingLevel={2} style={{ marginTop: 8 }}>
        The reserve shelf.
      </AppText>
      <AppText variant="bodySm" tone="muted" style={{ marginTop: 6, maxWidth: 540 }}>
        The cards you open are kept on this device, so a dropped connection never ends a
        session.
      </AppText>
    </View>
  );

  const reservePass = (
    <View style={{ position: 'relative' }}>
      <View
        style={[
          glassFill,
          {
            borderRadius: v2.radii.pane,
            borderTopWidth: 1,
            borderTopColor: rims.soft,
            borderBottomWidth: 1,
            borderBottomColor: colors.outlineVariant,
            overflow: 'hidden',
          },
        ]}
      >
        <View
          style={{
            position: 'absolute',
            width: 220,
            height: 220,
            borderRadius: 110,
            backgroundColor: alpha(colors.success, 0.11),
            right: -92,
            top: -108,
          }}
        />
        <View
          style={{
            position: 'absolute',
            width: 170,
            height: 170,
            borderRadius: 85,
            backgroundColor: alpha(colors.warning, 0.06),
            left: -82,
            bottom: -108,
          }}
        />

        <View style={{ padding: v2.spacing.panel }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 10,
              flexWrap: 'wrap',
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <MaterialIcons
                name="confirmation-number"
                size={iconSize.sm}
                color={colors.success}
              />
              <AppText
                variant="caption"
                weight="bold"
                style={{ color: colors.success, letterSpacing: 1.1 }}
              >
                Reserve pass
              </AppText>
            </View>
            <Stamp
              label={cached ? 'Cached' : 'Cache off'}
              color={cached ? colors.success : colors.onSurfaceVariant}
              rotate={-2}
            />
          </View>

          <View
            style={{
              flexDirection: 'row',
              alignItems: 'flex-end',
              justifyContent: 'space-between',
              gap: 8,
              marginTop: 12,
              flexWrap: 'wrap',
            }}
          >
            <AppText variant="headline" headingLevel={3} style={{ flexShrink: 1 }}>
              Study without a connection.
            </AppText>
            <AppText
              variant="caption"
              tone="muted"
              style={{ letterSpacing: 1, fontVariant: ['tabular-nums'] }}
            >
              PASS 03
            </AppText>
          </View>

          <View style={{ marginTop: 14 }}>
            <ReserveStep
              index="01"
              icon="touch-app"
              title="Open a card"
              body="The first visit still needs a connection."
              active={cached}
            />
            <ReserveConnector />
            <ReserveStep
              index="02"
              icon="download-done"
              title="Kept on device"
              body="Cached as you open it."
              active={cached}
            />
            <ReserveConnector />
            <ReserveStep
              index="03"
              icon="cloud-off"
              title="Read offline"
              body="No connection needed."
              active={cached}
            />
          </View>

          <View
            style={{
              marginTop: 16,
              borderTopWidth: 1,
              borderStyle: 'dashed',
              borderTopColor: alpha(colors.onSurface, 0.18),
              paddingTop: 12,
              flexDirection: 'row',
              flexWrap: 'wrap',
              gap: 12,
            }}
          >
            {ledger.map((entry) => (
              <View key={entry.label} style={{ flexGrow: 1, flexBasis: 140, minWidth: 0 }}>
                <AppText variant="caption" tone="muted" style={{ letterSpacing: 0.8 }}>
                  {entry.label}
                </AppText>
                <AppText
                  variant="bodySm"
                  weight="semibold"
                  style={[
                    { marginTop: 2, fontVariant: ['tabular-nums'] },
                    entry.accent ? { color: colors.success } : null,
                  ]}
                >
                  {entry.value}
                </AppText>
              </View>
            ))}
          </View>

          <View
            style={{
              marginTop: 14,
              paddingTop: 12,
              borderTopWidth: 1,
              borderStyle: 'dashed',
              borderTopColor: alpha(colors.onSurface, 0.14),
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 10,
              flexWrap: 'wrap',
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 2 }}>
              {Array.from({ length: 14 }).map((_, index) => (
                <View
                  key={index}
                  style={{
                    width: index % 4 === 0 ? 3 : 2,
                    height: index % 3 === 0 ? 14 : 9,
                    backgroundColor: alpha(colors.onSurfaceVariant, 0.45),
                  }}
                />
              ))}
            </View>
            <AppText variant="caption" tone="muted" style={{ letterSpacing: 1 }}>
              SHELF 05.3
            </AppText>
          </View>
        </View>
      </View>
    </View>
  );

  const offlineSection = (
    <RoomSection
      index="01"
      label="Offline study"
      hint="Cached as you open"
      color={colors.success}
      first
    >
      <SettingsControl
        accent={colors.success}
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
    </RoomSection>
  );

  const installBody =
    Platform.OS !== 'web' ? (
      <SettingsControl
        accent={colors.success}
        icon="check-circle"
        title="On this device"
        subtitle="Everything is stored locally."
        trailing={
          <MaterialIcons name="check-circle" size={iconSize.md} color={colors.success} />
        }
        isLast
      />
    ) : isInstalled ? (
      <SettingsControl
        accent={colors.success}
        icon="download-done"
        title="Installed"
        subtitle="Memora opens from your home screen and works offline."
        trailing={
          <MaterialIcons name="check-circle" size={iconSize.md} color={colors.success} />
        }
        isLast
      />
    ) : canPrompt ? (
      <View style={{ padding: 16 }}>
        <AppText variant="bodySm" tone="muted">
          Install Memora to study with zero network access — everything is cached on your
          device.
        </AppText>
        <View style={{ marginTop: 16 }}>
          <PrimaryButton label="Install Memora" icon="download" onPress={handleInstall} />
        </View>
      </View>
    ) : (
      <>
        <SettingsControl
          accent={colors.success}
          icon="ios-share"
          title="Add to home screen"
          subtitle="Two taps in your browser menu."
        />
        <View style={{ paddingHorizontal: 16, paddingBottom: 16, gap: 8 }}>
          <ManualStep index="01" text="Open the browser menu" />
          <ManualStep index="02" text="Choose “Add to Home Screen”" />
        </View>
      </>
    );

  const installSection = (
    <RoomSection
      index="02"
      label="Install app"
      hint="From the home screen"
      color={colors.success}
    >
      {installBody}
    </RoomSection>
  );

  const sections = (
    <View>
      {offlineSection}
      {installSection}
    </View>
  );

  return (
    <Screen
      scroll
      gutter
      contentMaxWidth={v2.layout.contentMaxWidth}
      header={<TopAppBar title="Offline" back />}
    >
      <View style={{ paddingBottom: 48 }}>
        <RevealItem index={0}>{masthead}</RevealItem>

        <View
          style={{
            marginTop: 24,
            flexDirection: wide ? 'row' : 'column',
            alignItems: wide ? 'flex-start' : 'stretch',
            gap: wide ? 32 : 24,
          }}
        >
          <View style={{ width: wide ? 400 : undefined, flexShrink: 0 }}>
            <RevealItem index={1}>{reservePass}</RevealItem>
          </View>

          <View style={{ flex: 1, minWidth: 0 }}>
            <RevealItem index={2}>{sections}</RevealItem>
            <RevealItem index={3}>
              <ReserveNote />
            </RevealItem>
          </View>
        </View>
      </View>
    </Screen>
  );
}
