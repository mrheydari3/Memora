import { Pressable, View } from 'react-native';
import { MaterialIcons } from '../Icon';
import { AppText } from '../AppText';
import { GhostButton } from '../GhostButton';
import { ActionButton } from './ActionButton';
import { Surface } from './Surface';
import { alpha, colors, fills, over, radii, rims } from '../../theme/tokens';
import { v3 } from '../../theme/v3';

type IconName = React.ComponentProps<typeof MaterialIcons>['name'];

export type SessionSummaryProps = {
  deckName: string;
  deckColor: string;
  deckIcon: IconName;
  emptyDeck: boolean;
  /** Reviews completed in this session, in the order they happened. */
  reviewed: number;
  /** Share of those reviews rated Good or Easy. */
  recallPct: number;
  newCount: number;
  durationMs: number;
  /** Again, Hard, Good, Easy. */
  ratings: readonly [number, number, number, number];
  nextReview: string | null;
  onAddCards: () => void;
  onUndo: (() => void) | null;
  onBack: () => void;
};

/** 252_000 → "4m 12s"; 11_000 → "11s". */
function formatDuration(ms: number): string {
  const seconds = Math.max(0, Math.round(ms / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return rest === 0 ? `${minutes}m` : `${minutes}m ${rest}s`;
}

function percent(count: number, total: number): number {
  return total > 0 ? Math.round((count / total) * 100) : 0;
}

type Metric = {
  label: string;
  value: string;
  unit?: string;
  note: string;
  icon: IconName;
  color: string;
};

/**
 * SessionSummary — the close of a study session.
 *
 * The mock's XP and streak tiles have no source in this app, so the grid keeps
 * four figures the stores actually know: reviews, Good+ share, time and new
 * cards. The rating rail is built from the same review log. Nothing here is
 * sampled or invented; a session restored after a reload has no log window and
 * therefore shows the hero and actions alone.
 */
export function SessionSummary({
  deckName,
  deckColor,
  deckIcon,
  emptyDeck,
  reviewed,
  recallPct,
  newCount,
  durationMs,
  ratings,
  nextReview,
  onAddCards,
  onUndo,
  onBack,
}: SessionSummaryProps) {
  const pace = reviewed > 0 ? Math.max(1, Math.round(durationMs / 1000 / reviewed)) : 0;
  const recallColor =
    recallPct >= 80 ? colors.success : recallPct >= 50 ? colors.warning : colors.error;
  const statusColor = emptyDeck ? colors.outline : colors.success;

  const metrics: Metric[] = [
    {
      label: 'Total reviewed',
      value: String(reviewed),
      unit: reviewed === 1 ? 'card' : 'cards',
      note: 'in this session',
      icon: 'done-all',
      color: colors.primary,
    },
    {
      label: 'Recall',
      value: `${recallPct}%`,
      note: 'rated Good or Easy',
      icon: 'trending-up',
      color: recallColor,
    },
    {
      label: 'Session time',
      value: formatDuration(durationMs),
      note: `${pace}s per card`,
      icon: 'bolt',
      color: colors.primary,
    },
    {
      label: 'New cards',
      value: String(newCount),
      unit: newCount === 1 ? 'card' : 'cards',
      note: 'first seen this session',
      icon: 'fiber-new',
      color: colors.success,
    },
  ];

  const ratingRows: { label: string; count: number; color: string }[] = [
    { label: 'Easy', count: ratings[3], color: colors.primary },
    { label: 'Good', count: ratings[2], color: colors.success },
    { label: 'Hard', count: ratings[1], color: colors.warning },
    { label: 'Again', count: ratings[0], color: colors.error },
  ];

  return (
    <View>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          marginBottom: 14,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 }}>
          <View
            style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: deckColor }}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          />
          <AppText variant="bodySm" weight="semibold" numberOfLines={1} style={{ flexShrink: 1 }}>
            {deckName}
          </AppText>
        </View>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            borderRadius: radii.pill,
            paddingHorizontal: 10,
            paddingVertical: 5,
            backgroundColor: over(colors.background, statusColor, 0.16),
            borderWidth: 1,
            borderColor: alpha(statusColor, 0.3),
          }}
        >
          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: statusColor }} />
          <AppText
            variant="caption"
            weight="semibold"
            className="uppercase"
            style={{ color: statusColor, letterSpacing: 0.6 }}
          >
            {emptyDeck ? 'No cards' : 'Queue cleared'}
          </AppText>
        </View>
      </View>

      <Surface tone="scene" padding="md" style={{ alignItems: 'center' }}>
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={{
            width: 48,
            height: 48,
            borderRadius: 24,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: over(
              colors.surfacePane,
              emptyDeck ? colors.primary : colors.success,
              0.16
            ),
            borderWidth: 1,
            borderColor: alpha(emptyDeck ? colors.primary : colors.success, 0.3),
          }}
        >
          <MaterialIcons
            name={emptyDeck ? 'note-add' : 'check'}
            size={26}
            color={emptyDeck ? colors.primary : colors.success}
          />
        </View>

        <AppText
          variant="caption"
          weight="semibold"
          tone="accent"
          className="mt-3 uppercase"
          style={{ letterSpacing: 0.6 }}
        >
          {emptyDeck ? 'Empty deck' : 'Session complete'}
        </AppText>
        <AppText
          variant="title"
          weight="bold"
          headingLevel={2}
          align="center"
          className="mt-1"
        >
          {emptyDeck ? 'No cards yet' : 'All done'}
        </AppText>
        <AppText
          variant="body"
          tone="muted"
          align="center"
          className="mt-2"
          style={{ maxWidth: 300 }}
        >
          {emptyDeck
            ? 'This deck has no cards. Add one from the deck screen to start studying.'
            : 'You have completed every due card in this deck.'}
        </AppText>

        {!emptyDeck && nextReview ? (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              marginTop: 16,
              borderRadius: radii.pill,
              borderWidth: 1,
              borderColor: rims.soft,
              backgroundColor: colors.surfaceInset,
              paddingHorizontal: 14,
              paddingVertical: 8,
            }}
          >
            <MaterialIcons name="schedule" size={16} color={colors.primary} />
            <AppText variant="caption" tone="muted" style={{ flexShrink: 1 }}>
              {nextReview}
            </AppText>
          </View>
        ) : null}
      </Surface>

      {reviewed > 0 ? (
        <>
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              gap: 12,
              marginTop: v3.spacing.section,
            }}
          >
            {metrics.map((metric) => (
              <Surface
                key={metric.label}
                tone="pane"
                radius="control"
                padding="sm"
                style={{
                  flexGrow: 1,
                  flexBasis: '46%',
                  minWidth: 130,
                  minHeight: 116,
                  justifyContent: 'space-between',
                }}
              >
                <View>
                  <AppText variant="caption" tone="muted">
                    {metric.label}
                  </AppText>
                  <View
                    style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 4 }}
                  >
                    <AppText
                      weight="bold"
                      style={{
                        fontSize: 26,
                        lineHeight: 30,
                        letterSpacing: -0.6,
                        fontVariant: ['tabular-nums'],
                        color: metric.color,
                      }}
                    >
                      {metric.value}
                    </AppText>
                    {metric.unit ? (
                      <AppText variant="caption" tone="tertiary">
                        {metric.unit}
                      </AppText>
                    ) : null}
                  </View>
                </View>
                <View
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 10 }}
                >
                  <MaterialIcons name={metric.icon} size={15} color={metric.color} />
                  <AppText variant="caption" tone="muted" style={{ flexShrink: 1 }}>
                    {metric.note}
                  </AppText>
                </View>
              </Surface>
            ))}
          </View>

          <Surface tone="pane" padding="md" style={{ marginTop: v3.spacing.section }}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 12,
              }}
            >
              <AppText
                variant="caption"
                weight="semibold"
                tone="muted"
                className="uppercase"
                style={{ letterSpacing: 0.6 }}
              >
                Rating breakdown
              </AppText>
              <AppText variant="caption" tone="tertiary">
                FSRS-6
              </AppText>
            </View>

            <View
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              style={{
                flexDirection: 'row',
                height: 8,
                gap: 2,
                borderRadius: radii.pill,
                overflow: 'hidden',
                backgroundColor: fills.track,
                marginBottom: 14,
              }}
            >
              {ratingRows
                .filter((row) => row.count > 0)
                .map((row) => (
                  <View
                    key={row.label}
                    style={{
                      flex: row.count,
                      backgroundColor: row.color,
                    }}
                  />
                ))}
            </View>

            <View style={{ gap: 8 }}>
              {ratingRows.map((row) => (
                <View
                  key={row.label}
                  accessible
                  accessibilityLabel={`${row.label}, ${percent(row.count, reviewed)} percent, ${
                    row.count
                  } ${row.count === 1 ? 'card' : 'cards'}`}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 10,
                    borderRadius: radii.micro,
                    borderWidth: 1,
                    borderColor: alpha(row.color, 0.22),
                    backgroundColor: alpha(row.color, 0.08),
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
                    <View
                      style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: row.color }}
                    />
                    <AppText variant="bodySm" weight="semibold">
                      {row.label}
                    </AppText>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <AppText
                      variant="caption"
                      tone="muted"
                      style={{ fontVariant: ['tabular-nums'] }}
                    >
                      {percent(row.count, reviewed)}%
                    </AppText>
                    <AppText
                      variant="bodySm"
                      weight="semibold"
                      style={{ fontVariant: ['tabular-nums'], minWidth: 14, textAlign: 'right' }}
                    >
                      {row.count}
                    </AppText>
                  </View>
                </View>
              ))}
            </View>
          </Surface>
        </>
      ) : null}

      <View style={{ marginTop: v3.spacing.section, gap: 10 }}>
        {emptyDeck ? (
          <>
            <ActionButton label="Add cards" onPress={onAddCards} />
            <View style={{ alignItems: 'center' }}>
              <GhostButton label="Back to deck" onPress={onBack} />
            </View>
          </>
        ) : (
          <>
            <ActionButton label="Back to deck" onPress={onBack} />
            {onUndo ? (
              <Pressable
                onPress={onUndo}
                accessibilityRole="button"
                accessibilityLabel="Undo last review"
                style={{
                  minHeight: 48,
                  borderRadius: radii.control,
                  borderWidth: 1,
                  borderColor: rims.soft,
                  backgroundColor: colors.surfaceControl,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                }}
              >
                <MaterialIcons name="undo" size={18} color={colors.outline} />
                <AppText variant="body" weight="semibold">
                  Undo last review
                </AppText>
              </Pressable>
            ) : null}
          </>
        )}
      </View>
    </View>
  );
}
