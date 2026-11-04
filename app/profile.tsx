import { useEffect, useMemo } from 'react';
import { View, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { pushOnce } from '../services/navigation';
import { MaterialIcons } from '../components/Icon';
import { useDeckStore } from '../store/useDeckStore';
import { useReviewStore } from '../store/useReviewStore';
import { computeStreak, startOfLocalDay } from '../data/streak';
import {
  AppText,
  Screen,
  TopAppBar,
  GlassCard,
  SectionHeader,
  AchievementBadge,
  ListRow,
  RevealItem,
  HeroSkeleton,
  SettingsGroupSkeleton,
} from '../components';
import { colors, fills, heights, iconSize } from '../theme/tokens';

type Achievement = {
  id: string;
  name: string;
  icon: React.ComponentProps<typeof MaterialIcons>['name'];
  color: string;
  earned: boolean;
};

/**
 * The badges the app can actually verify from the review log. Card-count
 * badges once lit "First Card" and "100 Cards" for an imported library with
 * zero reviews, while the same screen said "Never studied" and 0 XP. Both now
 * key off reviews, so the rack agrees with XP, the streak and Statistics.
 */
function buildAchievements(reviewCount: number, streak: number): Achievement[] {
  return [
    { id: '1', name: 'First Review', icon: 'style', color: colors.success, earned: reviewCount >= 1 },
    {
      id: '2',
      name: '7-Day Streak',
      icon: 'local-fire-department',
      color: colors.warning,
      earned: streak >= 7,
    },
    {
      id: '3',
      name: '100 Reviews',
      icon: 'emoji-events',
      color: colors.warning,
      earned: reviewCount >= 100,
    },
    // Nothing in the log records time of day or answer speed yet, so these two
    // stay locked rather than claiming an achievement nobody tracked.
    { id: '4', name: 'Night Owl', icon: 'bedtime', color: colors.primary, earned: false },
    { id: '5', name: 'Speed Demon', icon: 'bolt', color: colors.error, earned: false },
  ];
}

const XP_PER_REVIEW = 10;
const XP_PER_LEVEL = 1000;

export default function ProfileScreen() {
  const router = useRouter();
  const decks = useDeckStore((s) => s.decks);
  // Subscribe to the card map so per-deck counts update live.
  const cardsByDeck = useDeckStore((s) => s.cardsByDeck);
  const loaded = useDeckStore((s) => s.loaded);
  const getLogsForDeck = useReviewStore((s) => s.getLogsForDeck);
  const reviewLog = useReviewStore((s) => s.reviewLog);

  useEffect(() => {
    useDeckStore.getState().load();
    useReviewStore.getState().load();
  }, []);

  // XP is what the log can prove: ten points per review. Archived decks are
  // excluded so the profile agrees with the rest of the app's totals.
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

  const streak = useMemo(() => computeStreak(activeLog.map((e) => e.reviewedAt)), [activeLog]);
  const achievements = buildAchievements(activeLog.length, streak);

  const lastStudiedLabel = (deckId: string) => {
    const logs = getLogsForDeck(deckId);
    if (logs.length === 0) return 'Never studied';
    const last = Math.max(...logs.map((l) => l.reviewedAt));
    // Calendar-day difference, not elapsed 24h blocks: a review last night
    // must not read as "today" this morning, or as "1 day ago" two days on.
    const days = Math.round(
      (startOfLocalDay(Date.now()) - startOfLocalDay(last)) / 86400000
    );
    if (days <= 0) return 'Last studied today';
    return `Last studied ${days} ${days === 1 ? 'day' : 'days'} ago`;
  };

  return (
    <Screen scroll gutter header={<TopAppBar title="Profile" back />}>
      {!loaded ? (
        <>
          <HeroSkeleton height={190} />
          <View className="mt-7">
            <SettingsGroupSkeleton rows={3} />
          </View>
        </>
      ) : (
      <>
      <RevealItem index={0}>
      {/* Identity */}
      <GlassCard tone="accent">
        <View className="flex-row items-center">
          <View
            className="items-center justify-center rounded-full"
            style={{
              width: heights.avatarLg,
              height: heights.avatarLg,
              backgroundColor: colors.accentFaint,
            }}
          >
            <MaterialIcons name="person" size={iconSize.display} color={colors.primary} />
          </View>
          <View className="ml-4 flex-1">
            <AppText variant="headline" headingLevel={2}>
              User
            </AppText>
            <View className="mt-1 flex-row items-center gap-1.5">
              <MaterialIcons name="arrow-upward" size={iconSize.xs} color={colors.success} />
              <AppText variant="bodySm" weight="medium" tone="muted">
                Level {level}
              </AppText>
            </View>
          </View>
        </View>

        <View className="mt-5">
          <View className="h-2 overflow-hidden rounded-full" style={{ backgroundColor: fills.track }}>
            <View
              className="h-full rounded-full bg-primary"
              style={{ width: `${xpProgress * 100}%` }}
            />
          </View>
          <View className="mt-2 flex-row justify-between">
            <AppText variant="caption" weight="medium" tone="muted" className="uppercase">
              Experience
            </AppText>
            <AppText variant="caption" weight="medium" tone="muted">
              {xpIntoLevel} / {XP_PER_LEVEL} XP
            </AppText>
          </View>
        </View>
      </GlassCard>

      </RevealItem>

      <RevealItem index={1}>
      {/* Achievements */}
      <SectionHeader
        className="mt-7"
        label="Achievements"
        hint={`${achievements.filter((a) => a.earned).length} of ${achievements.length}`}
      />
      <GlassCard className="mt-3" padding="sm">
        <View className="-mx-2">
          {/* `focusable`: a horizontal scroller must be reachable and scrollable
              from the keyboard, otherwise the badges are mouse/touch only
              (axe: "scrollable-region-focusable"). */}
          <ScrollView
            horizontal
            focusable
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 4, paddingHorizontal: 8 }}
          >
            {achievements.map((a, index) => (
              <AchievementBadge
                key={a.id}
                index={index}
                icon={a.icon}
                name={a.name}
                color={a.color}
                earned={a.earned}
              />
            ))}
          </ScrollView>
        </View>
      </GlassCard>
      </RevealItem>

      <RevealItem index={2}>
      {/* Decks */}
      <SectionHeader className="mt-7" label="My decks" />
      <GlassCard className="mt-3" padding="none">
        {decks.length === 0 && (
          <View className="px-4 py-5">
            <AppText variant="bodySm" tone="muted">
              No decks yet.
            </AppText>
          </View>
        )}
        {decks.slice(0, 5).map((deck, i) => (
          <ListRow
            key={deck.id}
            title={deck.name}
            subtitle={`${(cardsByDeck[deck.id] ?? []).length} cards · ${lastStudiedLabel(deck.id)}`}
            icon={deck.icon as React.ComponentProps<typeof MaterialIcons>['name']}
            iconTone="deck"
            deckColor={deck.color}
            tile="lg"
            density="tall"
            titleWeight="semibold"
            divider={i < Math.min(decks.length, 5) - 1}
            onPress={() => pushOnce(router, `/deck/${deck.id}`)}
          />
        ))}
      </GlassCard>
      </RevealItem>
      </>
      )}
    </Screen>
  );
}
