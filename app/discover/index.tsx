import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '../../components/Icon';
import { fetchFeaturedDecks, type FeaturedDeck } from '../../services/discovery';
import { goBackOr, pushOnce } from '../../services/navigation';
import {
  AppText,
  Screen,
  TopAppBar,
  GlassCard,
  ListRow,
  SectionHeader,
  EmptyState,
  GhostButton,
  RevealItem,
  SkeletonRow,
} from '../../components';
import { v2 } from '../../theme/v2';

type IconName = React.ComponentProps<typeof MaterialIcons>['name'];

/**
 * Discover — the catalogue of bundled starter decks.
 *
 * The preview route (`discover/[id]`) already existed and could import a deck,
 * but nothing linked to it: `/discover` had no index route, so the catalogue was
 * reachable only by typing a URL. This is the missing index. One row per deck,
 * and the row opens the preview that adds it to the library.
 *
 * The row counts the preview cards, not `cardCount` from the catalogue: only the
 * sample cards are imported, so showing the advertised deck size would promise
 * more than `importDeck` writes.
 */
export default function DiscoverScreen() {
  const router = useRouter();
  const [decks, setDecks] = useState<FeaturedDeck[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetchFeaturedDecks()
      .then((featured) => {
        if (active) setDecks(featured);
      })
      .catch((e) => {
        if (!active) return;
        console.error('Failed to load Discover:', e);
        setError('Could not load Discover right now.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <Screen
      scroll
      gutter
      contentMaxWidth={v2.layout.contentMaxWidth}
      header={<TopAppBar title="Discover" back backFallback="/(tabs)/home" />}
    >
      {loading ? (
        <GlassCard padding="sm">
          {[0, 1, 2, 3].map((i) => (
            <SkeletonRow key={i} />
          ))}
        </GlassCard>
      ) : error || decks.length === 0 ? (
        <View className="mt-10">
          <EmptyState
            icon="search-off"
            title="Nothing to discover"
            titleVariant="headline"
            description={error ?? 'The starter library is empty right now.'}
            action={
              <GhostButton
                label="Back"
                className="px-6"
                onPress={() => goBackOr(router, '/(tabs)/home')}
              />
            }
          />
        </View>
      ) : (
        <>
          <RevealItem index={0}>
            <AppText variant="body" tone="muted">
              Starter decks you can add to your library. A deck arrives with its preview cards;
              the rest of the deck is yours to write.
            </AppText>
          </RevealItem>

          <RevealItem index={1}>
            <SectionHeader className="mt-6" label="Starter decks" hint={`${decks.length}`} />
          </RevealItem>

          <RevealItem index={2}>
            <GlassCard padding="sm" className="mt-3">
              {decks.map((deck) => (
                <ListRow
                  key={deck.id}
                  title={deck.name}
                  subtitle={deck.description}
                  icon={deck.icon as IconName}
                  iconTone="deck"
                  deckColor={deck.color}
                  gutter={0}
                  value={`${deck.sampleCards.length} cards`}
                  onPress={() => pushOnce(router, `/discover/${deck.id}`)}
                />
              ))}
            </GlassCard>
          </RevealItem>
        </>
      )}
    </Screen>
  );
}
