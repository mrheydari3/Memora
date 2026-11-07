import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialIcons } from '../../components/Icon';
import { fetchFeaturedDecks, importDeck, type FeaturedDeck } from '../../services/discovery';
import { goBackOr } from '../../services/navigation';
import { textDirection } from '../../data/text';
import {
  AppText,
  Screen,
  TopAppBar,
  GlassCard,
  PrimaryButton,
  GhostButton,
  EmptyState,
  RevealItem,
  Skeleton,
  SkeletonText,
} from '../../components';
import { SectionHeading } from '../../components/v3';
import { colors, iconSize, radii } from '../../theme/tokens';
import { v2 } from '../../theme/v2';

export default function DiscoverDeckPreviewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [deck, setDeck] = useState<FeaturedDeck | null>(null);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetchFeaturedDecks()
      .then((decks) => {
        if (!active) return;
        setDeck(decks.find((d) => d.id === id) ?? null);
      })
      .catch((e) => {
        if (!active) return;
        console.error('Failed to load Discover deck:', e);
        setError('Could not load Discover right now.');
        setDeck(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id]);

  const handleAdd = async () => {
    if (!deck || importing) return;
    setImporting(true);
    setError(null);
    try {
      const importedId = await importDeck(deck);
      router.replace(`/deck/${importedId}`);
    } catch (e) {
      console.error('Failed to import deck:', e);
      setError('Could not add this deck. Please try again.');
    } finally {
      setImporting(false);
    }
  };

  return (
    <Screen
      scroll
      gutter
      contentMaxWidth={v2.layout.contentMaxWidth}
      header={<TopAppBar title="Discover" back backFallback="/discover" />}
    >
      {/* The deck name is the page title below; the bar stays contextual. */}
      {loading ? (
        <View>
          <Skeleton height={26} width="64%" radius={9} />
          <View className="mt-4 flex-row" style={{ gap: 16 }}>
            <Skeleton width={96} height={11} radius={5} />
            <Skeleton width={54} height={11} radius={5} />
          </View>
          <SkeletonText lines={3} style={{ marginTop: 18 }} />
          <Skeleton height={52} radius={radii.control} style={{ marginTop: 22 }} />
          <Skeleton height={10} width={112} radius={5} style={{ marginTop: 30 }} />
          <View className="mt-4 flex-row flex-wrap" style={{ gap: 12 }}>
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} height={104} radius={radii.pane} style={{ width: '47%' }} />
            ))}
          </View>
        </View>
      ) : !deck ? (
        <View className="mt-10">
          <EmptyState
            icon="search-off"
            title="Deck not found"
            titleVariant="headline"
            description={error ?? 'This deck is no longer in Discover.'}
            action={
              <GhostButton
                label="Back"
                className="px-6"
                onPress={() => goBackOr(router, '/discover')}
              />
            }
          />
        </View>
      ) : (
        <>
          <RevealItem index={0}>
          <AppText variant="title">{deck.name}</AppText>
          <View className="mt-3 flex-row items-center gap-4">
            <View className="flex-row items-center gap-1.5">
              <MaterialIcons name="style" size={iconSize.sm} color={colors.outline} />
              {/* Only the bundled preview cards are imported, so show that
                  number rather than the catalogue's advertised deck size. */}
              <AppText variant="bodySm" weight="medium" tone="muted">
                {deck.sampleCards.length} preview cards
              </AppText>
            </View>
          </View>

          <AppText variant="body" tone="muted" className="mt-4">
            {deck.description}
          </AppText>

          <PrimaryButton
            className="mt-6"
            label={importing ? 'Adding…' : 'Add deck'}
            icon={importing ? undefined : 'add'}
            loading={importing}
            onPress={handleAdd}
          />
          {error && (
            <AppText variant="bodySm" tone="danger" className="mt-3">
              {error}
            </AppText>
          )}
          </RevealItem>

          <RevealItem index={1}>
          <SectionHeading
            className="mt-7"
            label="Sample cards"
            count={`${deck.sampleCards.length}`}
          />
          </RevealItem>
          <View className="mt-3 flex-row flex-wrap gap-3">
            {deck.sampleCards.map((card, i) => (
              <RevealItem key={i} index={i + 1} style={{ width: '47%' }}>
              <GlassCard className="w-full" padding="sm">
                <AppText
                  variant="bodyLg"
                  weight="semibold"
                  style={{ writingDirection: textDirection(card.front) }}
                  numberOfLines={3}
                >
                  {card.front}
                </AppText>
                <View className="h-2.5" />
                <AppText
                  variant="bodySm"
                  tone="muted"
                  style={{ writingDirection: textDirection(card.back) }}
                  numberOfLines={3}
                >
                  {card.back}
                </AppText>
              </GlassCard>
              </RevealItem>
            ))}
          </View>
        </>
      )}
    </Screen>
  );
}
