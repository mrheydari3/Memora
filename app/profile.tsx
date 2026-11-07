import { useEffect, useMemo } from 'react';
import type { ComponentProps } from 'react';
import { Pressable, useWindowDimensions, View } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '../components/Icon';
import { useDeckStore } from '../store/useDeckStore';
import { useReviewStore } from '../store/useReviewStore';
import { computeStreak, startOfLocalDay } from '../data/streak';
import type { Deck } from '../data/types';
import {
  AppText,
  EmptyState,
  HeroSkeleton,
  RevealItem,
  Screen,
  SettingsGroupSkeleton,
} from '../components';
import {
  HeaderIcon,
  HeaderProfileButton,
  PageHeader,
  SectionHeading,
  Surface,
} from '../components/v3';
import {
  alpha,
  colors,
  fills,
  heights,
  iconSize,
  radii,
  rims,
} from '../theme/tokens';
import { v2 } from '../theme/v2';
import { goBackOr, pushOnce } from '../services/navigation';

const CONTENT_MAX = 760;
const XP_PER_REVIEW = 10;
const XP_PER_LEVEL = 1000;
const MAX_DECKS = 5;

type IconName = ComponentProps<typeof MaterialIcons>['name'];

type Achievement = {
  id: string;
  name: string;
  description: string;
  icon: IconName;
  color: string;
  earned: boolean;
};

type DeckStat = {
  deck: Deck;
  cardCount: number;
  studiedCount: number;
  progress: number;
  lastStudiedAt: number | null;
  archived: boolean;
};

/**
 * The badges the app can actually verify from the review log. Card-count
 * badges key off reviews, not imported cards, so the rack always agrees with
 * XP and the Statistics screen. Night Owl and Speed Demon stay locked because
 * the review log does not record time-of-day or answer speed yet.
 */
function buildAchievements(reviewCount: number, streak: number): Achievement[] {
  return [
    {
      id: '1',
      name: 'First Review',
      description: 'Completed your first session',
      icon: 'auto-awesome',
      color: colors.success,
      earned: reviewCount >= 1,
    },
    {
      id: '2',
      name: '7-Day Streak',
      description: 'Studied 7 consecutive days',
      icon: 'local-fire-department',
      color: colors.warning,
      earned: streak >= 7,
    },
    {
      id: '3',
      name: '100 Reviews',
      description: 'Reached 100 card evaluations',
      icon: 'psychology',
      color: colors.primary,
      earned: reviewCount >= 100,
    },
    {
      id: '4',
      name: 'Night Owl',
      description: 'Review 20 cards past 23:00',
      icon: 'dark-mode',
      color: colors.outline,
      earned: false,
    },
    {
      id: '5',
      name: 'Speed Demon',
      description: 'Clear a 60s quiz >90% acc',
      icon: 'bolt',
      color: colors.outline,
      earned: false,
    },
  ];
}

const formatCount = (value: number) => value.toLocaleString('en-US');

const pluralCards = (count: number) => `${count} ${count === 1 ? 'card' : 'cards'}`;

function lastStudiedLabel(at: number | null): string {
  if (at === null) return 'Never studied';
  const now = Date.now();
  const elapsed = Math.max(0, now - at);
  const days = Math.round((startOfLocalDay(now) - startOfLocalDay(at)) / 86_400_000);
  if (days <= 0) {
    const hours = Math.max(1, Math.round(elapsed / 3_600_000));
    return `Last studied ${hours}h ago`;
  }
  if (days === 1) return 'Last studied yesterday';
  return `Last studied ${days}d ago`;
}

function IdentityCard({
  level,
  xpIntoLevel,
  xpProgress,
  xp,
  reviews,
  streak,
  activeDays,
}: {
  level: number;
  xpIntoLevel: number;
  xpProgress: number;
  xp: number;
  reviews: number;
  streak: number;
  activeDays: number;
}) {
  const stats = [
    { label: 'Total XP', value: formatCount(xp) },
    { label: 'Reviews', value: formatCount(reviews) },
    { label: 'Cadence', value: `${activeDays}d` },
  ];

  return (
    <Surface
      tone="pane"
      radius="pane"
      padding="md"
      style={{ borderWidth: 1, borderColor: rims.soft }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <AppText
          variant="label"
          weight="semibold"
          tone="tertiary"
          style={{ letterSpacing: 0.6, textTransform: 'uppercase' }}
        >
          Identity
        </AppText>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            paddingHorizontal: 10,
            paddingVertical: 4,
            borderRadius: radii.pill,
            backgroundColor: colors.surfaceInset,
          }}
        >
          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.success }} />
          <AppText variant="caption" weight="medium" tone="muted">
            On this device
          </AppText>
        </View>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 18 }}>
        <View
          style={{
            width: heights.avatar,
            height: heights.avatar,
            borderRadius: heights.avatar / 2,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.surfaceTile,
          }}
        >
          <MaterialIcons name="psychology" size={28} color={colors.primary} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <AppText variant="headline" weight="semibold" numberOfLines={1}>
            Learner
          </AppText>
          <AppText variant="bodySm" tone="muted" numberOfLines={1} style={{ marginTop: 1 }}>
            Active local study desk
          </AppText>
        </View>
      </View>

      <View
        style={{
          marginTop: 18,
          padding: 16,
          borderRadius: radii.control,
          backgroundColor: colors.surfaceInset,
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            gap: 10,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6, minWidth: 0 }}>
            <AppText
              variant="caption"
              weight="semibold"
              tone="tertiary"
              style={{ textTransform: 'uppercase', letterSpacing: 0.6, paddingBottom: 5 }}
            >
              Level
            </AppText>
            <AppText
              variant="display"
              weight="bold"
              accessibilityLabel={`Level ${level}`}
              style={[v2.type.score, { fontVariant: ['tabular-nums'], letterSpacing: -1 }]}
            >
              {level}
            </AppText>
          </View>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 5,
              paddingHorizontal: 10,
              paddingVertical: 5,
              borderRadius: radii.pill,
              backgroundColor: alpha(colors.warning, 0.13),
            }}
          >
            <MaterialIcons name="local-fire-department" size={iconSize.sm} color={colors.warning} />
            <AppText variant="caption" weight="semibold" style={{ color: colors.warning }}>
              {streak > 0 ? `${streak}-day streak` : 'No streak yet'}
            </AppText>
          </View>
        </View>

        <View style={{ marginTop: 10 }}>
          <View
            style={{
              height: 6,
              overflow: 'hidden',
              borderRadius: 3,
              backgroundColor: colors.surfaceControl,
            }}
          >
            <View
              style={{
                width: `${Math.max(0, Math.min(100, xpProgress * 100))}%`,
                height: '100%',
                borderRadius: 3,
                backgroundColor: colors.primaryContainer,
              }}
            />
          </View>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
              marginTop: 6,
            }}
          >
            <AppText
              variant="caption"
              tone="muted"
              numberOfLines={1}
              style={{ flexShrink: 1 }}
            >
              {`${xpIntoLevel} of ${XP_PER_LEVEL} XP into this level`}
            </AppText>
            <AppText
              variant="caption"
              weight="semibold"
              tone="muted"
              style={{ fontVariant: ['tabular-nums'] }}
            >
              {`${Math.round(xpProgress * 100)}%`}
            </AppText>
          </View>
        </View>
      </View>

      <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
        {stats.map((stat) => (
          <View
            key={stat.label}
            style={{
              flex: 1,
              minWidth: 0,
              paddingHorizontal: 10,
              paddingVertical: 10,
              borderRadius: radii.control,
              backgroundColor: fills.inset,
            }}
          >
            <AppText variant="caption" tone="tertiary" numberOfLines={1}>
              {stat.label}
            </AppText>
            <AppText
              variant="headline"
              weight="semibold"
              numberOfLines={1}
              style={{ marginTop: 2, fontVariant: ['tabular-nums'] }}
            >
              {stat.value}
            </AppText>
          </View>
        ))}
      </View>
    </Surface>
  );
}

function AchievementCard({
  achievement,
  basis,
}: {
  achievement: Achievement;
  basis: string;
}) {
  const statusColor = achievement.earned ? achievement.color : colors.outline;

  return (
    <Surface
      tone="pane"
      radius="card"
      padding="sm"
      style={{
        flexBasis: basis,
        minHeight: 132,
        borderWidth: 1,
        borderColor: rims.soft,
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
        }}
      >
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: radii.control,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: achievement.earned
              ? alpha(achievement.color, 0.14)
              : colors.surfaceControl,
          }}
        >
          <MaterialIcons
            name={achievement.icon}
            size={iconSize.lg}
            color={achievement.earned ? achievement.color : colors.outline}
          />
        </View>
        <AppText
          variant="caption"
          weight="semibold"
          style={{ color: statusColor, flexShrink: 0 }}
        >
          {achievement.earned ? 'Done' : 'Locked'}
        </AppText>
      </View>

      <View style={{ marginTop: 12 }}>
        <AppText variant="body" weight="semibold" numberOfLines={1}>
          {achievement.name}
        </AppText>
        <AppText
          variant="caption"
          tone="muted"
          numberOfLines={2}
          style={{ marginTop: 2 }}
        >
          {achievement.description}
        </AppText>
      </View>
    </Surface>
  );
}

function DeckCard({ stat, onPress }: { stat: DeckStat; onPress: () => void }) {
  const { deck, cardCount, studiedCount, progress, lastStudiedAt, archived } = stat;
  const percent = Math.round(progress * 100);
  const complete = percent >= 100;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Open ${deck.name}`}
      style={({ pressed }) => ({ opacity: pressed ? 0.84 : 1 })}
    >
      <Surface
        tone="pane"
        radius="card"
        padding="sm"
        style={{ borderWidth: 1, borderColor: rims.soft }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: radii.control,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: colors.surfaceTile,
              flexShrink: 0,
            }}
          >
            <MaterialIcons
              name={deck.icon as IconName}
              size={iconSize.lg}
              color={archived ? colors.outline : deck.color}
            />
          </View>

          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <AppText
                variant="bodyLg"
                weight="semibold"
                numberOfLines={1}
                style={{ flexShrink: 1 }}
              >
                {deck.name}
              </AppText>
              {archived ? (
                <View
                  style={{
                    paddingHorizontal: 6,
                    paddingVertical: 2,
                    borderRadius: radii.pill,
                    backgroundColor: colors.surfaceControl,
                    flexShrink: 0,
                  }}
                >
                  <AppText variant="caption" tone="muted" style={{ fontSize: 10 }}>
                    Archived
                  </AppText>
                </View>
              ) : null}
            </View>
            <AppText variant="bodySm" tone="muted" numberOfLines={1} style={{ marginTop: 2 }}>
              {archived
                ? `${pluralCards(cardCount)} · Archived`
                : `${pluralCards(cardCount)} · ${lastStudiedLabel(lastStudiedAt)}`}
            </AppText>
          </View>

          <MaterialIcons
            name={archived ? 'inventory-2' : 'chevron-right'}
            size={iconSize.lg}
            color={colors.outline}
          />
        </View>

        {!archived ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 }}>
            <View
              accessibilityRole="progressbar"
              accessibilityValue={{ min: 0, max: 100, now: percent }}
              style={{
                flex: 1,
                height: 4,
                overflow: 'hidden',
                borderRadius: 2,
                backgroundColor: colors.surfaceControl,
              }}
            >
              <View
                style={{
                  width: `${percent}%`,
                  height: '100%',
                  borderRadius: 2,
                  backgroundColor: complete ? colors.success : colors.primaryContainer,
                }}
              />
            </View>
            <AppText
              variant="caption"
              weight={complete ? 'semibold' : 'regular'}
              style={{
                color: complete ? colors.success : colors.outline,
                fontVariant: ['tabular-nums'],
              }}
            >
              {`${percent}% studied`}
            </AppText>
          </View>
        ) : null}
      </Surface>
    </Pressable>
  );
}

export default function ProfileScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const achievementColumns = width >= 700 ? 3 : 2;
  const achievementBasis = achievementColumns === 3 ? '31.5%' : '48%';

  const decks = useDeckStore((s) => s.decks);
  const cardsByDeck = useDeckStore((s) => s.cardsByDeck);
  const loaded = useDeckStore((s) => s.loaded);
  const reviewLog = useReviewStore((s) => s.reviewLog);

  useEffect(() => {
    useDeckStore.getState().load();
    useReviewStore.getState().load();
  }, []);

  const activeDeckIds = useMemo(
    () => new Set(decks.filter((deck) => !deck.archivedAt).map((deck) => deck.id)),
    [decks]
  );
  const activeLog = useMemo(
    () => reviewLog.filter((entry) => activeDeckIds.has(entry.deckId)),
    [reviewLog, activeDeckIds]
  );

  const xp = activeLog.length * XP_PER_REVIEW;
  const level = Math.floor(xp / XP_PER_LEVEL) + 1;
  const xpIntoLevel = xp % XP_PER_LEVEL;
  const xpProgress = xpIntoLevel / XP_PER_LEVEL;
  const streak = useMemo(
    () => computeStreak(activeLog.map((entry) => entry.reviewedAt)),
    [activeLog]
  );
  const activeDays = useMemo(
    () => new Set(activeLog.map((entry) => startOfLocalDay(entry.reviewedAt))).size,
    [activeLog]
  );
  const achievements = useMemo(
    () => buildAchievements(activeLog.length, streak),
    [activeLog.length, streak]
  );
  const earned = achievements.filter((achievement) => achievement.earned).length;

  const deckStats = useMemo(() => {
    const lastLogByDeck = new Map<string, number>();
    for (const entry of reviewLog) {
      const previous = lastLogByDeck.get(entry.deckId) ?? 0;
      if (entry.reviewedAt > previous) lastLogByDeck.set(entry.deckId, entry.reviewedAt);
    }

    return decks
      .map<DeckStat>((deck) => {
        const cards = cardsByDeck[deck.id] ?? [];
        let studiedCount = 0;
        let lastStudiedAt = lastLogByDeck.get(deck.id) ?? null;

        for (const card of cards) {
          if (card.fsrs.last_review == null) continue;
          studiedCount += 1;
          const timestamp = Date.parse(card.fsrs.last_review);
          if (Number.isFinite(timestamp) && (lastStudiedAt === null || timestamp > lastStudiedAt)) {
            lastStudiedAt = timestamp;
          }
        }

        return {
          deck,
          cardCount: cards.length,
          studiedCount,
          progress: cards.length > 0 ? studiedCount / cards.length : 0,
          lastStudiedAt,
          archived: Boolean(deck.archivedAt),
        };
      })
      .sort((a, b) => {
        if (a.archived !== b.archived) return a.archived ? 1 : -1;
        const aLast = a.lastStudiedAt ?? 0;
        const bLast = b.lastStudiedAt ?? 0;
        if (aLast !== bLast) return bLast - aLast;
        if (a.progress !== b.progress) return b.progress - a.progress;
        return b.cardCount - a.cardCount || a.deck.name.localeCompare(b.deck.name, 'en');
      });
  }, [decks, cardsByDeck, reviewLog]);

  // Keep the archived record visible as the final row, as the design does,
  // while leaving the five slots for the most recently studied active decks.
  const deckRows = useMemo(() => {
    const archivedDecks = deckStats.filter((stat) => stat.archived);
    const activeDecks = deckStats.filter((stat) => !stat.archived);
    const activeLimit = archivedDecks.length > 0 ? MAX_DECKS - 1 : MAX_DECKS;
    return [...activeDecks.slice(0, activeLimit), ...archivedDecks.slice(0, 1)];
  }, [deckStats]);

  const header = (
    <PageHeader
      title="Profile"
      back
      onBack={() => goBackOr(router, '/settings')}
      maxWidth={CONTENT_MAX}
      actions={
        <>
          <HeaderIcon
            icon="more-vert"
            label="Options"
            onPress={() => pushOnce(router, '/settings')}
          />
          <HeaderProfileButton
            label="Profile settings"
            onPress={() => pushOnce(router, '/settings')}
          />
        </>
      }
    />
  );

  return (
    <Screen scroll gutter contentMaxWidth={CONTENT_MAX} header={header}>
      {!loaded ? (
        <>
          <HeroSkeleton height={310} />
          <View style={{ marginTop: v2.spacing.section }}>
            <SettingsGroupSkeleton rows={3} />
          </View>
        </>
      ) : (
        <>
          <RevealItem index={0}>
            <IdentityCard
              level={level}
              xpIntoLevel={xpIntoLevel}
              xpProgress={xpProgress}
              xp={xp}
              reviews={activeLog.length}
              streak={streak}
              activeDays={activeDays}
            />
          </RevealItem>

          <RevealItem index={1}>
            <View style={{ marginTop: v2.spacing.section }}>
              <SectionHeading
                label="Achievements"
                hint={`${earned} of ${achievements.length}`}
                rule={false}
                className="mb-3"
              />
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                {achievements.map((achievement) => (
                  <AchievementCard
                    key={achievement.id}
                    achievement={achievement}
                    basis={achievementBasis}
                  />
                ))}
              </View>
            </View>
          </RevealItem>

          <RevealItem index={2}>
            <View style={{ marginTop: v2.spacing.section }}>
              <SectionHeading
                label="My decks"
                hint="Top 5 decks by activity"
                rule={false}
                className="mb-3"
              />
              {deckRows.length === 0 ? (
                <Surface
                  tone="pane"
                  radius="card"
                  padding="md"
                  style={{ borderWidth: 1, borderColor: rims.soft }}
                >
                  <EmptyState
                    icon="library-books"
                    title="No decks yet"
                    description="Create a deck from Home to start building a memory."
                  />
                </Surface>
              ) : (
                <View style={{ gap: 10 }}>
                  {deckRows.map((stat) => (
                    <DeckCard
                      key={stat.deck.id}
                      stat={stat}
                      onPress={() => pushOnce(router, `/deck/${stat.deck.id}`)}
                    />
                  ))}
                </View>
              )}
            </View>
          </RevealItem>
        </>
      )}
    </Screen>
  );
}
