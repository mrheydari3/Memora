import { useMemo } from 'react';
import { Pressable, View, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { pushOnce } from '../../services/navigation';
import { useDeckStore } from '../../store/useDeckStore';
import { useReviewStore } from '../../store/useReviewStore';
import { useSettingsStore } from '../../store/useSettingsStore';
import { buildStudyQueue } from '../../data/session';
import { computeStreak } from '../../data/streak';
import { exportJson } from '../../services/export';
import { AppText, RevealItem, Screen, ToggleSwitch, TopAppBar } from '../../components';
import { MaterialIcons } from '../../components/Icon';
import { alpha, colors, fills, glassFill, iconSize, rims } from '../../theme/tokens';
import { v2 } from '../../theme/v2';
import type { Deck } from '../../data/types';

const APP_VERSION = '1.0.0';
const XP_PER_REVIEW = 10;
const XP_PER_LEVEL = 1000;
const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

const PRESET_LABELS: Record<Deck['algorithmPreset'], string> = {
  fsrs: 'FSRS-6',
  fast: 'Fast repetition',
  general: 'Regular repetition',
};

const MASTHEAD_DOTS = [
  { left: '58%', top: '4%', size: 3, opacity: 0.32, color: colors.primary },
  { left: '64%', top: '16%', size: 2, opacity: 0.22, color: colors.primary },
  { left: '48%', top: '22%', size: 2, opacity: 0.18, color: colors.warning },
  { left: '70%', top: '30%', size: 3, opacity: 0.26, color: colors.warning },
  { left: '76%', top: '12%', size: 2, opacity: 0.2, color: colors.primary },
  { left: '40%', top: '8%', size: 2, opacity: 0.16, color: colors.primary },
  { left: '82%', top: '36%', size: 2, opacity: 0.2, color: colors.primary },
  { left: '30%', top: '30%', size: 2, opacity: 0.12, color: colors.warning },
] as const;

const formatCount = (value: number) => value.toLocaleString('en-US');

type IconName = React.ComponentProps<typeof MaterialIcons>['name'];

function Barcode({
  color,
  width = 76,
  height = 20,
}: {
  color: string;
  width?: number;
  height?: number;
}) {
  const bars = [1, 2, 1, 1, 3, 1, 2, 1, 2, 3, 1, 1];
  return (
    <View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={{
        width,
        height,
        flexDirection: 'row',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
      }}
    >
      {bars.map((bar, index) => (
        <View
          key={index}
          style={{
            width: bar,
            height: index % 3 === 0 ? height : height * 0.65,
            backgroundColor: alpha(color, 0.55),
          }}
        />
      ))}
    </View>
  );
}

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
        className="uppercase"
        style={{ color, letterSpacing: 0.9 }}
      >
        {label}
      </AppText>
    </View>
  );
}

function Seal() {
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
        borderColor: alpha(colors.warning, 0.5),
        backgroundColor: alpha(colors.warning, 0.05),
        alignItems: 'center',
        justifyContent: 'center',
        transform: [{ rotate: '-7deg' }],
        flexShrink: 0,
      }}
    >
      <MaterialIcons name="lock-outline" size={iconSize.sm} color={colors.warning} />
      <AppText
        variant="caption"
        weight="bold"
        tone="warning"
        style={{ letterSpacing: 1.2, marginTop: 2 }}
      >
        LOCAL
      </AppText>
      <AppText variant="caption" tone="muted" style={{ letterSpacing: 0.8 }}>
        ONLY
      </AppText>
    </View>
  );
}

function DotField() {
  return (
    <View
      pointerEvents="none"
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        top: -6,
        bottom: -6,
        overflow: 'hidden',
      }}
    >
      {MASTHEAD_DOTS.map((dot, index) => (
        <View
          key={index}
          style={{
            position: 'absolute',
            left: dot.left,
            top: dot.top,
            width: dot.size,
            height: dot.size,
            borderRadius: dot.size / 2,
            backgroundColor: alpha(dot.color, dot.opacity),
          }}
        />
      ))}
    </View>
  );
}

type SettingsControlProps = {
  icon: IconName;
  title: string;
  subtitle?: string;
  value?: string;
  onPress?: () => void;
  trailing?: React.ReactNode;
  isLast?: boolean;
  accent: string;
};

/**
 * A settings row that grows instead of ellipsizing. The value becomes a small
 * stamped ticket, and the title/value/subtitle reflow at 320px and at 200% text.
 */
function SettingsControl({
  icon,
  title,
  subtitle,
  value,
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
        }}
      >
        <MaterialIcons name={icon} size={iconSize.md} color={accent} />
      </View>

      <View style={{ flex: 1, minWidth: 0 }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            flexWrap: 'wrap',
            columnGap: 8,
            rowGap: 3,
          }}
        >
          <AppText variant="body" weight="medium" style={{ flexShrink: 1 }}>
            {title}
          </AppText>
          {value ? (
            <View
              style={{
                borderWidth: 1,
                borderColor: alpha(accent, 0.24),
                backgroundColor: alpha(accent, 0.06),
                borderRadius: 5,
                paddingHorizontal: 6,
                paddingVertical: 2,
              }}
            >
              <AppText
                variant="caption"
                weight="semibold"
                style={{ color: accent, letterSpacing: 0.4 }}
              >
                {value}
              </AppText>
            </View>
          ) : null}
        </View>
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
            className="uppercase"
            style={{ color, letterSpacing: 1.3 }}
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

function Colophon() {
  return (
    <View style={{ padding: 20 }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <View style={{ flex: 1, minWidth: 0 }}>
          <AppText variant="headline">Memora</AppText>
          <AppText variant="bodySm" tone="muted" style={{ marginTop: 4 }}>
            A quiet room for what you want to remember.
          </AppText>
        </View>
        <Barcode color={colors.outline} width={78} height={22} />
      </View>

      <View
        style={{
          marginTop: 16,
          borderTopWidth: 1,
          borderStyle: 'dashed',
          borderTopColor: alpha(colors.onSurface, 0.14),
          paddingTop: 12,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          flexWrap: 'wrap',
        }}
      >
        <AppText
          variant="caption"
          tone="muted"
          className="uppercase"
          style={{ letterSpacing: 1 }}
        >
          Version
        </AppText>
        <AppText
          variant="bodySm"
          weight="semibold"
          style={{ fontVariant: ['tabular-nums'] }}
        >
          {APP_VERSION}
        </AppText>
      </View>

      <View
        style={{
          marginTop: 10,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          flexWrap: 'wrap',
        }}
      >
        <Stamp label="Local by default" color={colors.success} rotate={-1} />
        <AppText variant="caption" tone="muted" style={{ flex: 1, minWidth: 0 }}>
          Made for your memory. Not for a feed.
        </AppText>
      </View>
    </View>
  );
}

function ArchiveNote() {
  return (
    <View
      style={{
        marginTop: 24,
        padding: 16,
        borderRadius: 16,
        borderWidth: 1,
        borderStyle: 'dashed',
        borderColor: alpha(colors.warning, 0.3),
        backgroundColor: alpha(colors.warning, 0.05),
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 12,
      }}
    >
      <View
        style={{
          width: 30,
          height: 30,
          borderRadius: 9,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: alpha(colors.warning, 0.12),
          flexShrink: 0,
        }}
      >
        <MaterialIcons name="lock-outline" size={iconSize.sm} color={colors.warning} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <AppText
          variant="caption"
          weight="bold"
          tone="warning"
          className="uppercase"
          style={{ letterSpacing: 1 }}
        >
          Your archive
        </AppText>
        <AppText variant="bodySm" tone="muted" style={{ marginTop: 3 }}>
          Exports are plain JSON: decks, cards and review history. Keep a copy somewhere safe — this
          room only has one key.
        </AppText>
      </View>
    </View>
  );
}

export default function SettingsScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const wide = width >= 900;

  const decks = useDeckStore((s) => s.decks);
  const cardsByDeck = useDeckStore((s) => s.cardsByDeck);
  const reviewLog = useReviewStore((s) => s.reviewLog);
  const settings = useSettingsStore((s) => s.settings);
  const updateSettings = useSettingsStore((s) => s.update);

  const activeDecks = useMemo(() => decks.filter((deck) => !deck.archivedAt), [decks]);

  const totalCards = useMemo(
    () => activeDecks.reduce((sum, deck) => sum + (cardsByDeck[deck.id]?.length ?? 0), 0),
    [activeDecks, cardsByDeck]
  );

  const dueToday = useMemo(
    () =>
      activeDecks.reduce(
        (sum, deck) => sum + buildStudyQueue(deck, cardsByDeck[deck.id] ?? [], reviewLog).total,
        0
      ),
    [activeDecks, cardsByDeck, reviewLog]
  );

  const presetLabel = useMemo(() => {
    if (activeDecks.length === 0) return undefined;
    const [first] = activeDecks;
    const shared = activeDecks.every((deck) => deck.algorithmPreset === first.algorithmPreset);
    return shared ? PRESET_LABELS[first.algorithmPreset] : 'Per deck';
  }, [activeDecks]);

  const activeDeckIds = useMemo(
    () => new Set(activeDecks.map((deck) => deck.id)),
    [activeDecks]
  );
  const activeLog = useMemo(
    () => reviewLog.filter((entry) => activeDeckIds.has(entry.deckId)),
    [reviewLog, activeDeckIds]
  );

  const xp = activeLog.length * XP_PER_REVIEW;
  const level = Math.floor(xp / XP_PER_LEVEL) + 1;
  const xpIntoLevel = xp % XP_PER_LEVEL;
  const xpProgress = xpIntoLevel / XP_PER_LEVEL;
  const streak = useMemo(() => computeStreak(activeLog.map((entry) => entry.reviewedAt)), [activeLog]);

  const week = useMemo(() => {
    const reviewedDays = new Set(
      activeLog.map((entry) => new Date(entry.reviewedAt).toDateString())
    );
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date();
      date.setDate(date.getDate() - (6 - index));
      return {
        key: date.toISOString(),
        label: DAY_LABELS[date.getDay()],
        active: reviewedDays.has(date.toDateString()),
        today: index === 6,
      };
    });
  }, [activeLog]);
  const weekCount = week.filter((day) => day.active).length;

  const handleExportAll = async () => {
    try {
      await exportJson('Memora export', {
        exportedAt: new Date().toISOString(),
        decks,
        cardsByDeck,
        reviewLog,
        settings,
      });
    } catch {
      // The user dismissed the share sheet.
    }
  };

  const masthead = (
    <View style={{ position: 'relative', paddingBottom: 8 }}>
      <DotField />
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 16,
        }}
      >
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <MaterialIcons name="auto-awesome" size={iconSize.sm} color={colors.warning} />
            <AppText
              variant="caption"
              weight="bold"
              tone="warning"
              className="uppercase"
              style={{ letterSpacing: 1.4 }}
            >
              Study room · 05
            </AppText>
          </View>
          <AppText variant="title" headingLevel={2} style={{ marginTop: 8 }}>
            Make it yours.
          </AppText>
          <AppText variant="bodySm" tone="muted" style={{ marginTop: 6, maxWidth: 500 }}>
            A quiet room for your memory. Tune the engine, keep it local, and leave the noise
            outside.
          </AppText>
        </View>
        <Seal />
      </View>
    </View>
  );

  const libraryPass = (
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
            width: 230,
            height: 230,
            borderRadius: 115,
            backgroundColor: alpha(colors.primary, 0.12),
            right: -88,
            top: -104,
          }}
        />
        <View
          style={{
            position: 'absolute',
            width: 180,
            height: 180,
            borderRadius: 90,
            backgroundColor: alpha(colors.warning, 0.07),
            left: -76,
            bottom: -104,
          }}
        />

        <View style={{ padding: v2.spacing.panel }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: 10,
              flexWrap: 'wrap',
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <MaterialIcons name="menu-book" size={iconSize.sm} color={colors.primary} />
              <AppText
                variant="caption"
                weight="bold"
                className="uppercase"
                style={{ letterSpacing: 1.1 }}
              >
                Memora · library pass
              </AppText>
            </View>
            <Stamp label="On this device" color={colors.success} rotate={-2} />
          </View>

          <View
            style={{
              flexDirection: 'row',
              alignItems: 'flex-end',
              justifyContent: 'space-between',
              gap: 8,
              marginTop: 12,
            }}
          >
            <View style={{ flex: 1, minWidth: 0 }}>
              <AppText variant="headline">Your library</AppText>
              <AppText variant="bodySm" tone="muted" style={{ marginTop: 3 }}>
                No account. No sync. Just your cards.
              </AppText>
            </View>
            <AppText variant="caption" tone="muted" style={{ letterSpacing: 1 }}>
              NO. 01
            </AppText>
          </View>

          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 16,
              flexWrap: 'wrap',
              marginTop: 14,
            }}
          >
            <View
              style={{
                width: 148,
                height: 148,
                borderRadius: 74,
                borderWidth: 1,
                borderStyle: 'dashed',
                borderColor: alpha(colors.primary, 0.4),
                backgroundColor: alpha(colors.primary, 0.04),
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <View
                style={{
                  position: 'absolute',
                  top: -4,
                  left: 70,
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: colors.warning,
                }}
              />
              <AppText
                variant="display"
                numberOfLines={1}
                style={[
                  v2.type.display,
                  { color: dueToday > 0 ? colors.primary : colors.onSurface },
                ]}
              >
                {formatCount(dueToday)}
              </AppText>
              <AppText
                variant="caption"
                tone="muted"
                style={{ letterSpacing: 1.3, marginTop: -2 }}
              >
                DUE
              </AppText>
            </View>

            <View style={{ flex: 1, minWidth: 0 }}>
              <AppText variant="headline">
                {dueToday > 0 ? 'cards are waiting.' : 'The room is clear.'}
              </AppText>
              <AppText variant="bodySm" tone="muted" style={{ marginTop: 4 }}>
                Small reviews, every day. The queue stays lighter when you start here.
              </AppText>
              <View style={{ marginTop: 8, alignSelf: 'flex-start' }}>
                <Stamp label="Today" color={colors.warning} rotate={-1.5} />
              </View>
            </View>
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
              justifyContent: 'space-between',
              gap: 10,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 5 }}>
              <AppText
                variant="caption"
                tone="muted"
                className="uppercase"
                style={{ letterSpacing: 0.8 }}
              >
                Cards
              </AppText>
              <AppText
                variant="bodySm"
                weight="semibold"
                style={{ fontVariant: ['tabular-nums'] }}
              >
                {formatCount(totalCards)}
              </AppText>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 5 }}>
              <AppText
                variant="caption"
                tone="muted"
                className="uppercase"
                style={{ letterSpacing: 0.8 }}
              >
                Decks
              </AppText>
              <AppText
                variant="bodySm"
                weight="semibold"
                style={{ fontVariant: ['tabular-nums'] }}
              >
                {formatCount(activeDecks.length)}
              </AppText>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 5 }}>
              <AppText
                variant="caption"
                tone="muted"
                className="uppercase"
                style={{ letterSpacing: 0.8 }}
              >
                Algorithm
              </AppText>
              <AppText variant="bodySm" weight="semibold">
                {presetLabel ?? '—'}
              </AppText>
            </View>
          </View>

          <View
            style={{
              marginTop: 14,
              flexDirection: 'row',
              alignItems: 'flex-end',
              justifyContent: 'space-between',
              gap: 10,
            }}
          >
            <Barcode color={colors.onSurfaceVariant} width={92} height={20} />
            <AppText variant="caption" tone="muted" style={{ letterSpacing: 1 }}>
              SHELF 01
            </AppText>
          </View>
        </View>
      </View>

      <View
        style={{
          position: 'absolute',
          left: -7,
          top: '50%',
          width: 14,
          height: 14,
          borderRadius: 7,
          backgroundColor: colors.background,
        }}
      />
      <View
        style={{
          position: 'absolute',
          right: -7,
          top: '50%',
          width: 14,
          height: 14,
          borderRadius: 7,
          backgroundColor: colors.background,
        }}
      />
    </View>
  );

  const learnerCard = (
    <Pressable
      onPress={() => pushOnce(router, '/profile')}
      accessibilityRole="button"
      accessibilityHint="Opens your full profile"
      style={{ marginTop: 16, borderRadius: v2.radii.pane }}
    >
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
            left: 0,
            top: 0,
            bottom: 0,
            width: 3,
            backgroundColor: alpha(colors.tertiary, 0.55),
          }}
        />
        <View style={{ padding: v2.spacing.panel }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ position: 'relative' }}>
              <View
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 28,
                  borderWidth: 1,
                  borderColor: alpha(colors.tertiary, 0.5),
                  backgroundColor: alpha(colors.tertiary, 0.12),
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <MaterialIcons name="person" size={iconSize.lg} color={colors.tertiary} />
              </View>
              <View
                style={{
                  position: 'absolute',
                  right: -3,
                  bottom: -3,
                  minWidth: 22,
                  minHeight: 22,
                  borderRadius: 11,
                  backgroundColor: colors.tertiary,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 2,
                  borderColor: colors.background,
                  paddingHorizontal: 4,
                }}
              >
                <AppText
                  variant="caption"
                  weight="bold"
                  style={{ color: colors.onTertiary }}
                >
                  {level}
                </AppText>
              </View>
            </View>

            <View style={{ flex: 1, minWidth: 0 }}>
              <AppText
                variant="caption"
                tone="muted"
                className="uppercase"
                style={{ letterSpacing: 1 }}
              >
                Room member
              </AppText>
              <AppText variant="headline">You</AppText>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 4,
                  marginTop: 1,
                }}
              >
                <MaterialIcons
                  name="local-fire-department"
                  size={iconSize.sm}
                  color={colors.warning}
                />
                <AppText
                  variant="caption"
                  tone={streak > 0 ? 'warning' : 'muted'}
                >
                  {streak > 0 ? `${streak}-day streak` : 'New streak'}
                </AppText>
              </View>
            </View>

            <MaterialIcons
              name="chevron-right"
              size={iconSize.md}
              color={colors.outline}
            />
          </View>

          <View
            style={{
              marginTop: 14,
              flexDirection: 'row',
              alignItems: 'flex-end',
              justifyContent: 'space-between',
              gap: 8,
              flexWrap: 'wrap',
            }}
          >
            <View style={{ flex: 1, minWidth: 0 }}>
              <AppText
                variant="caption"
                tone="muted"
                className="uppercase"
                style={{ letterSpacing: 1 }}
              >
                This week
              </AppText>
              <AppText variant="bodySm" tone="muted" style={{ marginTop: 2 }}>
                {streak > 0
                  ? 'Keep the rhythm warm.'
                  : 'One card is all it takes to start.'}
              </AppText>
            </View>
            <AppText
              variant="caption"
              tone="muted"
              style={{ fontVariant: ['tabular-nums'] }}
            >
              {weekCount}/7
            </AppText>
          </View>

          <View style={{ flexDirection: 'row', gap: 4, marginTop: 8 }}>
            {week.map((day) => (
              <View key={day.key} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
                <AppText variant="caption" tone="muted">
                  {day.label}
                </AppText>
                <View
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: day.active
                      ? colors.warning
                      : alpha(colors.onSurface, 0.12),
                    borderWidth: day.today ? 1 : 0,
                    borderColor: day.today ? colors.primary : 'transparent',
                  }}
                />
              </View>
            ))}
          </View>

          <View style={{ marginTop: 14 }}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
                flexWrap: 'wrap',
              }}
            >
              <AppText
                variant="caption"
                tone="muted"
                className="uppercase"
                style={{ letterSpacing: 1 }}
              >
                Experience
              </AppText>
              <AppText
                variant="caption"
                tone="muted"
                style={{ fontVariant: ['tabular-nums'] }}
              >
                {formatCount(xpIntoLevel)} / {formatCount(XP_PER_LEVEL)} XP
              </AppText>
            </View>
            <View
              style={{
                height: 5,
                borderRadius: 3,
                backgroundColor: fills.track,
                overflow: 'hidden',
                marginTop: 5,
              }}
            >
              <View
                style={{
                  width: `${xpProgress * 100}%`,
                  height: '100%',
                  backgroundColor: colors.tertiary,
                }}
              />
            </View>
          </View>

          <View
            style={{
              marginTop: 14,
              borderTopWidth: 1,
              borderStyle: 'dashed',
              borderTopColor: alpha(colors.onSurface, 0.14),
              paddingTop: 10,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <AppText variant="caption" tone="muted" style={{ flex: 1, minWidth: 0 }}>
              Badges, level and every deck you have opened.
            </AppText>
            <AppText
              variant="caption"
              weight="bold"
              tone="accent"
              style={{ letterSpacing: 0.7 }}
            >
              OPEN FILE
            </AppText>
            <MaterialIcons
              name="arrow-forward"
              size={iconSize.sm}
              color={colors.primary}
            />
          </View>
        </View>
      </View>
    </Pressable>
  );

  const roomNote = (
    <View
      style={{
        marginTop: 16,
        padding: 16,
        borderRadius: 16,
        borderWidth: 1,
        borderStyle: 'dashed',
        borderColor: alpha(colors.primary, 0.2),
        backgroundColor: alpha(colors.primary, 0.04),
        transform: [{ rotate: '-0.7deg' }],
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <MaterialIcons name="auto-awesome" size={iconSize.sm} color={colors.primary} />
        <AppText
          variant="caption"
          weight="bold"
          tone="accent"
          className="uppercase"
          style={{ letterSpacing: 1.2 }}
        >
          Room note
        </AppText>
      </View>
      <AppText variant="bodySm" style={{ marginTop: 6 }}>
        “A little every day is still a library.”
      </AppText>
    </View>
  );

  const sections = (
    <View>
      <RoomSection
        index="01"
        label="Study"
        hint="How your memory moves"
        color={colors.primary}
        first
      >
        <SettingsControl
          accent={colors.primary}
          icon="tune"
          title="Algorithm"
          subtitle="How reviews are scheduled"
          value={presetLabel}
          onPress={() => pushOnce(router, '/settings/algorithm')}
        />
        <SettingsControl
          accent={colors.primary}
          icon="volume-up"
          title="Text-to-Speech"
          subtitle="Read cards aloud in two voices"
          value={settings.ttsEnabled ? 'On' : 'Off'}
          onPress={() => pushOnce(router, '/settings/tts')}
          isLast
        />
      </RoomSection>

      <RoomSection index="02" label="Game" hint="Make it play" color={colors.warning}>
        <SettingsControl
          accent={colors.warning}
          icon="volume-up"
          title="Sound effects"
          subtitle="Cues for correct and wrong answers"
          trailing={
            <ToggleSwitch
              value={settings.soundEnabled !== false}
              onToggle={(value) => updateSettings({ soundEnabled: value })}
              accessibilityLabel="Quiz sound effects"
            />
          }
        />
        <SettingsControl
          accent={colors.warning}
          icon="vibration"
          title="Haptics"
          subtitle="A tap for answers, combos and the final score"
          trailing={
            <ToggleSwitch
              value={settings.hapticsEnabled !== false}
              onToggle={(value) => updateSettings({ hapticsEnabled: value })}
              accessibilityLabel="Quiz haptics"
            />
          }
          isLast
        />
      </RoomSection>

      <RoomSection index="03" label="Data" hint="Keep it yours" color={colors.success}>
        <SettingsControl
          accent={colors.success}
          icon="cloud-off"
          title="Offline & install"
          subtitle="Study without a connection"
          value={settings.offlineCacheEnabled ? 'Cache on' : 'Cache off'}
          onPress={() => pushOnce(router, '/settings/offline')}
        />
        <SettingsControl
          accent={colors.success}
          icon="download"
          title="Import cards"
          subtitle="Anki, Quizlet, CSV"
          onPress={() => pushOnce(router, '/mass-import')}
        />
        <SettingsControl
          accent={colors.success}
          icon="upload"
          title="Export all data"
          subtitle="Decks, cards and review history"
          onPress={handleExportAll}
          isLast
        />
      </RoomSection>

      <RoomSection
        index="04"
        label="Your progress"
        hint="Look back"
        color={colors.tertiary}
      >
        <SettingsControl
          accent={colors.tertiary}
          icon="person-outline"
          title="Profile"
          subtitle="Level, achievements and decks"
          onPress={() => pushOnce(router, '/profile')}
        />
        <SettingsControl
          accent={colors.tertiary}
          icon="insights"
          title="Statistics"
          subtitle="Streak, knowledge and forecast"
          onPress={() => pushOnce(router, '/statistics')}
          isLast
        />
      </RoomSection>

      <RoomSection
        index="05"
        label="About"
        hint="The fine print"
        color={colors.onSurfaceVariant}
      >
        <Colophon />
      </RoomSection>

      <ArchiveNote />
    </View>
  );

  return (
    <Screen
      scroll
      gutter
      tabClearance
      contentMaxWidth={v2.layout.contentMaxWidth}
      header={<TopAppBar title="Settings" />}
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
          <View style={{ width: wide ? 340 : undefined, flexShrink: 0 }}>
            <RevealItem index={1}>{libraryPass}</RevealItem>
            <RevealItem index={2}>{learnerCard}</RevealItem>
            <RevealItem index={3}>{roomNote}</RevealItem>
          </View>

          <View style={{ flex: 1, minWidth: 0 }}>
            <RevealItem index={4}>{sections}</RevealItem>
          </View>
        </View>
      </View>
    </Screen>
  );
}
