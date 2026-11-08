import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialIcons } from '../../components/Icon';
import { fetchFeaturedDecks, importDeck, type FeaturedDeck } from '../../services/discovery';
import { goBackOr } from '../../services/navigation';
import { textDirection } from '../../data/text';
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
import { alpha, colors, iconSize, spacing } from '../../theme/tokens';
import { v3 } from '../../theme/v3';

const NUMERIC = { fontVariant: ['tabular-nums'] as const };

export default function DiscoverDeckPreviewScreen() {
  const { id } = useLocalSearchParams<{ id?: string | string[] }>();
  const router = useRouter();
  const deckId = Array.isArray(id) ? id[0] : id;
  const [deck, setDeck] = useState<FeaturedDeck | null>(null);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setDeck(null);
    setError(null);

    fetchFeaturedDecks()
      .then((decks) => {
        if (!active) return;
        setDeck(decks.find((featured) => featured.id === deckId) ?? null);
      })
      .catch((e) => {
        if (!active) return;
        console.error('Failed to load Discover deck:', e);
        setError('Could not load Discover right now.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [deckId, attempt]);

  const retry = () => setAttempt((value) => value + 1);

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

  const footer = deck ? (
    <View
      style={{
        backgroundColor: colors.background,
        borderTopWidth: 1,
        borderTopColor: colors.hairlineRule,
        paddingHorizontal: spacing.screen,
        paddingTop: 12,
        paddingBottom: spacing.screen,
      }}
    >
      <View
        style={{
          width: '100%',
          maxWidth: v3.layout.contentMaxWidth,
          alignSelf: 'center',
          gap: 8,
        }}
      >
        {error && (
          <View accessibilityLiveRegion="polite">
            <AppText variant="bodySm" tone="danger">
              {error}
            </AppText>
          </View>
        )}
        <ActionButton
          label={importing ? 'Adding…' : 'Add to library'}
          icon="add"
          disabled={importing}
          onPress={handleAdd}
        />
      </View>
    </View>
  ) : undefined;

  return (
    <Screen
      scroll
      gutter
      edges={['top', 'bottom']}
      contentMaxWidth={v3.layout.contentMaxWidth}
      header={
        <PageHeader
          title="Discover"
          back
          onBack={() => goBackOr(router, '/discover')}
        />
      }
      footer={footer}
    >
      {loading ? (
        <PreviewSkeleton />
      ) : !deck ? (
        <Surface tone="scene" padding="md" style={{ paddingVertical: 28 }}>
          <EmptyState
            icon={error ? 'cloud-off' : 'search-off'}
            title={error ? 'Could not load this deck' : 'Deck not found'}
            titleVariant="headline"
            description={error ?? 'This deck is no longer in Discover.'}
            action={
              error ? (
                <ActionButton
                  label="Retry"
                  icon="refresh"
                  fullWidth={false}
                  onPress={retry}
                />
              ) : (
                <ActionButton
                  label="Back to Discover"
                  fullWidth={false}
                  onPress={() => goBackOr(router, '/discover')}
                />
              )
            }
          />
        </Surface>
      ) : (
        <View style={{ paddingBottom: 24 }}>
          <View style={{ gap: 28 }}>
            <RevealItem index={0}>
              <PreviewHero deck={deck} />
            </RevealItem>

            <RevealItem index={1}>
              <View style={{ gap: 10 }}>
                <SectionHeading
                  label="Sample cards"
                  count={`${deck.sampleCards.length}`}
                  hint="front → back"
                />
                <Surface tone="pane" radius="card" padding="none" style={{ overflow: 'hidden' }}>
                  {deck.sampleCards.map((card, index) => (
                    <SampleCardRow
                      key={`${card.front}-${index}`}
                      card={card}
                      index={index}
                      last={index === deck.sampleCards.length - 1}
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

function PreviewHero({ deck }: { deck: FeaturedDeck }) {
  const cards = deck.sampleCards.length;

  return (
    <Surface
      tone="scene"
      padding="md"
      testID="discover-preview-hero"
      style={{ gap: 16 }}
    >
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
            Starter deck
          </AppText>
          <Pill label={`${cards} cards`} tone="accent" />
        </View>

        <AppText weight="bold" headingLevel={2} style={v3.type.headlineMd}>
          {deck.name}
        </AppText>
        <AppText variant="bodySm" tone="muted">
          {deck.description}
        </AppText>
      </View>

      <View
        style={{
          flexDirection: 'row',
          backgroundColor: colors.surfaceInset,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: alpha(colors.outlineSoft, 0.2),
          paddingVertical: 12,
          paddingHorizontal: 12,
        }}
      >
        <LedgerCell label="Level" value="Starter" first />
        <LedgerCell label="Source" value="Bundled" />
        <LedgerCell label="Import" value="One tap" />
      </View>
    </Surface>
  );
}

function LedgerCell({
  label,
  value,
  first = false,
}: {
  label: string;
  value: string;
  first?: boolean;
}) {
  return (
    <View
      style={{
        flex: 1,
        minWidth: 0,
        paddingStart: first ? 0 : 12,
        borderStartWidth: first ? 0 : 1,
        borderStartColor: colors.outlineVariant,
      }}
    >
      <AppText variant="caption" tone="tertiary" numberOfLines={1}>
        {label}
      </AppText>
      <AppText
        variant="body"
        weight="semibold"
        numberOfLines={2}
        style={[NUMERIC, { marginTop: 2 }]}
      >
        {value}
      </AppText>
    </View>
  );
}

function SampleCardRow({
  card,
  index,
  last,
}: {
  card: FeaturedDeck['sampleCards'][number];
  index: number;
  last: boolean;
}) {
  const frontDir = card.frontDir ?? textDirection(card.front);
  const backDir = card.backDir ?? textDirection(card.back);

  return (
    <View>
      <View style={{ paddingHorizontal: 16, paddingVertical: 14, gap: 6 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
          <AppText
            variant="body"
            weight="semibold"
            style={{
              flex: 1,
              writingDirection: frontDir,
              textAlign: frontDir === 'rtl' ? 'right' : 'left',
            }}
          >
            {card.front}
          </AppText>
          <AppText variant="caption" tone="tertiary" style={NUMERIC}>
            {String(index + 1).padStart(2, '0')}
          </AppText>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6 }}>
          <View style={{ marginTop: 2 }}>
            <MaterialIcons name="arrow-forward" size={14} color={colors.outline} />
          </View>
          <AppText
            variant="bodySm"
            tone="muted"
            style={{
              flex: 1,
              writingDirection: backDir,
              textAlign: backDir === 'rtl' ? 'right' : 'left',
            }}
          >
            {card.back}
          </AppText>
        </View>
      </View>

      {!last && (
        <View
          style={{
            height: 1,
            marginHorizontal: 16,
            backgroundColor: colors.hairlineRule,
          }}
        />
      )}
    </View>
  );
}

function PreviewSkeleton() {
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
            <Skeleton width={70} height={8} radius={4} />
            <Skeleton width={56} height={18} radius={9} />
          </View>
          <Skeleton width="64%" height={28} radius={8} />
          <SkeletonText lines={2} style={{ marginTop: 4 }} />
          <Skeleton height={58} radius={16} style={{ marginTop: 8 }} />
        </Surface>

        <View>
          <Skeleton width={92} height={10} radius={5} style={{ marginBottom: 10 }} />
          <Surface tone="pane" radius="card" padding="none" style={{ overflow: 'hidden' }}>
            {[0, 1, 2, 3].map((index) => (
              <View key={index}>
                <SkeletonRow tall />
                {index < 3 && (
                  <View
                    style={{
                      height: 1,
                      marginHorizontal: 16,
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
