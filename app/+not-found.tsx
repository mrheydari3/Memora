import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { AppText, Button, EmptyState, Screen, TopAppBar } from '../components';

/**
 * +not-found — the app's own 404.
 *
 * Expo Router's development fallback prints a raw sitemap of every route (the
 * audit caught `/discover`, which has no index route, rendering a link list with
 * 23px targets). In production that page must look like the rest of the app and
 * offer one way back, so every unmatched path lands here instead.
 */
export default function NotFoundScreen() {
  const router = useRouter();

  return (
    <Screen
      edges={['top', 'bottom']}
      header={<TopAppBar title="Not found" back backFallback="/(tabs)/library" />}
    >
      <View className="flex-1 items-center justify-center px-6">
        <EmptyState
          icon="map"
          title="This page moved on"
          titleVariant="headline"
          description="The screen you asked for is not part of Memora. Your decks and reviews are untouched."
          action={
            <Button label="Back to Game" onPress={() => router.replace('/(tabs)/library')} />
          }
        />
        <AppText variant="caption" tone="muted" align="center" className="mt-4">
          Nothing was lost — everything is stored on this device.
        </AppText>
      </View>
    </Screen>
  );
}
