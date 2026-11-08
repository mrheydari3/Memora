import { useEffect, useState } from 'react';
import { Animated, View } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '../../components/Icon';
import { fetchFeaturedDecks, type FeaturedDeck } from '../../services/discovery';
import { goBackOr, pushOnce } from '../../services/navigation';
import {
  AppText,
  EmptyState,
  Pill,
  RevealItem,
  Screen,
  Skeleton,
  SkeletonRow,
  SkeletonText,
} from '../../components';
import { ActionButton, PageHeader, SectionHeading, Surface } from '../../components/v3';
import { HintPressable } from '../../components/HintPressable';
import { usePressFeedback } from '../../motion';
import { alpha, colors, iconSize } from '../../theme/tokens';
import { v3 } from '../../theme/v3';

type IconName = React.ComponentProps<typeof MaterialIcons>['name'];

/**
 * Discover — the catalogue of bundled starter decks.
 *
 * A starter deck arrives with exactly the cards shown in its preview, so the
 * row counts `sampleCards.length` rather than the catalogue's advertised size.
 * The route is the only place the four decks are listed; the preview imports
 * one, then opens the deck it created.
 */
export default function DiscoverScreen() {
  const router = useRouter();
  const [decks, setDecks] = useState<FeaturedDeck[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

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
  }, [attempt]);

  const retry = () => setAttempt((value) => value + 1);

  return (
    <Screen
      scroll
      gutter
      contentMaxWidth={v3.layout.contentMaxWidth}
      header={
        <PageHeader
          title="Discover"
          back
          onBack={() => goBackOr(router, '/(tabs)/home')}
        />
      }
    >
      {loading ? (
        <DiscoverSkeleton />
      ) : error || decks.length === 0 ? (
        <Surface tone="scene" padding="md" style={{ paddingVertical: 28 }}>
          <EmptyState
            icon={error ? 'cloud-off' : 'search-off'}
            title={error ? 'Could not load Discover' : 'Nothing to discover'}
            titleVariant="headline"
            description={error ?? 'The starter library is empty right now.'}
            action={
              error ? (
                <ActionButton
                  label="Retry"
                  icon="refresh"
                  fullWidth={false}
                  onPress={retry}
                />
              ) : undefined
            }
          />
        </Surface>
      ) : (
        <View style={{ paddingBottom: 24 }}>
          <View style={{ gap: 28 }}>
            <RevealItem index={0}>
              <Surface tone="scene" padding="md" testID="discover-hero" style={{ gap: 16 }}>
                <View style={{ gap: 6 }}>
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 10,
                    }}
                  >
                    <AppText
                      variant="label"
                      weight="semibold"
                      tone="accent"
                      className="uppercase"
                      style={{ letterSpacing: 0.6 }}
                    >
                      Discover
                    </AppText>
                    <Pill label={`${decks.length} decks`} tone="accent" />
                  </View>

                  <AppText weight="bold" headingLevel={2} style={v3.type.headlineMd}>
                    Starter decks
                  </AppText>
                  <AppText variant="bodySm" tone="muted">
                    Preview-sized decks you can add in one tap, with only the cards shown in the
                    preview imported.
                  </AppText>
                </View>
              </Surface>
            </RevealItem>

            <RevealItem index={1}>
              <View style={{ gap: 10 }}>
                <SectionHeading label="Catalogue" count={`${decks.length} decks`} />
                <Surface
                  tone="pane"
                  radius="card"
                  padding="none"
                  style={{ overflow: 'hidden' }}
                >
                  {decks.map((deck, index) => (
                    <CatalogueRow
                      key={deck.id}
                      deck={deck}
                      last={index === decks.length - 1}
                      onPress={() => pushOnce(router, `/discover/${deck.id}`)}
                    />
                  ))}
                </Surface>
              </View>
            </RevealItem>
          </View>
        </View>
      )}
    </Screen>
  );
}

function CatalogueRow({
  deck,
  last,
  onPress,
}: {
  deck: FeaturedDeck;
  last: boolean;
  onPress: () => void;
}) {
  const press = usePressFeedback({ scale: 0.985 });
  const cards = deck.sampleCards.length;
  const cardLabel = cards === 1 ? 'card' : 'cards';

  return (
    <Animated.View style={press.style}>
      <HintPressable
        hint="Preview deck"
        testID="discover-deck-row"
        onPress={onPress}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        accessibilityRole="button"
        style={{
          minHeight: 76,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 14,
          paddingHorizontal: 16,
          paddingVertical: 12,
        }}
      >
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: v3.radii.tile,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: alpha(deck.color, 0.16),
            flexShrink: 0,
          }}
        >
          <MaterialIcons
            name={deck.icon as IconName}
            size={iconSize.lg}
            color={deck.color}
          />
        </View>

        <View style={{ flex: 1, minWidth: 0 }}>
          <AppText weight="semibold" numberOfLines={1} style={v3.type.deckName}>
            {deck.name}
          </AppText>
          <AppText variant="bodySm" tone="muted" numberOfLines={2} style={{ marginTop: 2 }}>
            {deck.description}
          </AppText>
          <View
            style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}
          >
            <AppText
              variant="caption"
              weight="semibold"
              tone="accent"
              style={{ fontVariant: ['tabular-nums'] }}
            >
              {cards} {cardLabel}
            </AppText>
            <AppText variant="caption" tone="tertiary">
              · preview
            </AppText>
          </View>
        </View>

        <MaterialIcons name="chevron-right" size={iconSize.md} color={colors.outline} />
      </HintPressable>

      {!last && (
        <View
          style={{
            height: 1,
            marginStart: 74,
            backgroundColor: colors.hairlineRule,
          }}
        />
      )}
    </Animated.View>
  );
}

function DiscoverSkeleton() {
  return (
    <View style={{ paddingBottom: 24 }}>
      <View style={{ gap: 28 }}>
        <Surface tone="scene" padding="md" style={{ gap: 16 }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 10,
            }}
          >
            <Skeleton width={62} height={8} radius={4} />
            <Skeleton width={54} height={18} radius={9} />
          </View>
          <Skeleton width="52%" height={28} radius={8} />
          <SkeletonText lines={2} style={{ marginTop: 4 }} />
        </Surface>

        <View>
          <Skeleton width={82} height={10} radius={5} style={{ marginBottom: 10 }} />
          <Surface tone="pane" radius="card" padding="none" style={{ overflow: 'hidden' }}>
            {[0, 1, 2, 3].map((index) => (
              <View key={index}>
                <SkeletonRow tall />
                {index < 3 && (
                  <View
                    style={{
                      height: 1,
                      marginStart: 74,
                      backgroundColor: colors.hairlineRule,
                    }}
                  />
                )}
              </View>
            ))}
          </Surface>
        </View>
      </View>
    </View>
  );
}
