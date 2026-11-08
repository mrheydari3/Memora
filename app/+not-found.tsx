import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '../components/Icon';
import { AppText, Screen } from '../components';
import { ActionButton, PageHeader, Surface } from '../components/v3';
import { colors, iconSize, spacing } from '../theme/tokens';
import { v3 } from '../theme/v3';

/**
 * +not-found — the app's own 404.
 *
 * Expo Router's development fallback prints a raw sitemap of every route (the
 * audit caught `/discover`, which has no index route, rendering a link list with
 * 23px targets). In production that page must look like the rest of the app and
 * offer one way back, so every unmatched path lands here instead.
 *
 * v3 keeps it to one scene pane on the normal 960px page column. The pane is
 * the composer's 420px reading width, not a full-width card, and the 52px
 * action is the only control besides the header's 44px back target.
 */
export default function NotFoundScreen() {
  const router = useRouter();

  return (
    <Screen
      edges={['top', 'bottom']}
      contentMaxWidth={v3.layout.contentMaxWidth}
      header={
        <PageHeader
          title="Not found"
          back
          onBack={() => router.replace('/(tabs)/library')}
        />
      }
    >
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: spacing.screen,
          paddingVertical: v3.spacing.page,
        }}
      >
        <Surface
          tone="scene"
          radius="pane"
          padding="md"
          style={{
            width: '100%',
            maxWidth: v3.layout.composerMaxWidth,
            alignItems: 'center',
            gap: 16,
          }}
        >
          <View
            aria-hidden
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={{
              width: 52,
              height: 52,
              borderRadius: v3.radii.control,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: colors.surfaceControl,
            }}
          >
            <MaterialIcons name="map" size={iconSize.display} color={colors.primary} />
          </View>

          <AppText
            variant="headline"
            weight="bold"
            headingLevel={2}
            align="center"
            style={{ letterSpacing: -0.4 }}
          >
            This page moved on
          </AppText>

          <AppText variant="bodySm" tone="muted" align="center">
            The screen you asked for is not part of Memora. Your decks and reviews are
            untouched.
          </AppText>

          <View style={{ width: '100%', marginTop: 2 }}>
            <ActionButton
              label="Back to Game"
              onPress={() => router.replace('/(tabs)/library')}
            />
          </View>

          <AppText variant="caption" tone="tertiary" align="center">
            Nothing was lost — everything is stored on this device.
          </AppText>
        </Surface>
      </View>
    </Screen>
  );
}
