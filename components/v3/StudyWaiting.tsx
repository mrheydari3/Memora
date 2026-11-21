import { ScrollView, useWindowDimensions, View } from 'react-native';
import { AppText } from '../AppText';
import { MaterialIcons } from '../Icon';
import { textDirection } from '../../data/text';
import type { Flashcard } from '../../data/types';
import { alpha, colors, glass, iconSize, over, radii, stateColors } from '../../theme/tokens';
import { v3 } from '../../theme/v3';
import { ActionButton } from './ActionButton';
import { Surface } from './Surface';

type IconName = React.ComponentProps<typeof MaterialIcons>['name'];

type Metric = {
  label: string;
  value: string;
  unit?: string;
  note: string;
  icon: IconName;
  color: string;
  iconColor?: string;
  noteColor?: string;
};

type StudyWaitingProps = {
  card: Flashcard;
  note?: string;
  learningStep: string | null;
  /** The countdown phrase, e.g. "in 9m 56s". */
  waitLabel: string;
  targetRetention: number;
  frontLanguage: string;
  deckName: string;
  deckColor: string;
  addedLabel: string;
  reviewed: number;
  recallPct: number;
  durationMs: number;
  xpEarned: number;
  streak: number;
  maxWidth?: number;
  onStudyNow: () => void;
};

/** 252_000 → "4m 12s"; 11_000 → "11s". */
function formatDuration(ms: number): string {
  const seconds = Math.max(0, Math.round(ms / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return rest === 0 ? `${minutes}m` : `${minutes}m ${rest}s`;
}

/**
 * StudyWaiting — the pause between a learning card's steps.
 *
 * It follows the Session Complete grammar: one deck/status row, one raised
 * hero, the session's four sourced metrics, then a detail pane. The detail pane
 * is the card the learner just rated, so the waiting interval is a recall
 * prompt rather than an empty clock screen.
 */
export function StudyWaiting({
  card,
  note,
  learningStep,
  waitLabel,
  targetRetention,
  frontLanguage,
  deckName,
  deckColor,
  addedLabel,
  reviewed,
  recallPct,
  durationMs,
  xpEarned,
  streak,
  maxWidth,
  onStudyNow,
}: StudyWaitingProps) {
  const stateColor =
    card.fsrs.state === 'New' ? colors.onSurfaceVariant : stateColors[card.fsrs.state];
  const recallColor =
    recallPct >= 80 ? colors.success : recallPct >= 50 ? colors.warning : colors.error;
  const { width } = useWindowDimensions();
  const tight = width < 360;
  const pace = reviewed > 0 ? Math.max(1, Math.round(durationMs / 1000 / reviewed)) : 0;
  // Match SessionSummary: four across once the tablet column is available,
  // two across inside the 420px phone column.
  const metricBasis = maxWidth === undefined ? '23%' : '45%';
  const frontRtl = card.front.direction === 'rtl';
  const backRtl = card.back.direction === 'rtl';
  const noteDirection = note ? textDirection(note) : 'ltr';

  const metrics: Metric[] = [
    {
      label: 'Total reviewed',
      value: String(reviewed),
      unit: reviewed === 1 ? 'card' : 'cards',
      note: 'cards rated this session',
      icon: 'done-all',
      iconColor: colors.primary,
      color: colors.onSurface,
      noteColor: colors.outline,
    },
    {
      label: 'Recall',
      value: `${recallPct}%`,
      note: 'rated Good or Easy',
      icon: 'trending-up',
      color: recallColor,
      noteColor: recallColor,
    },
    {
      label: 'Session duration',
      value: formatDuration(durationMs),
      note: `${pace}s per card`,
      icon: 'bolt',
      iconColor: colors.outline,
      color: colors.onSurface,
      noteColor: colors.outline,
    },
    {
      label: 'XP earned',
      value: `+${xpEarned}`,
      unit: 'XP',
      note: streak > 0 ? `${streak}-day streak` : 'no streak yet',
      icon: 'local-fire-department',
      iconColor: streak > 0 ? colors.warning : colors.outline,
      color: colors.primary,
      noteColor: streak > 0 ? colors.warning : colors.outline,
    },
  ];

  return (
    <ScrollView
      testID="study-waiting"
      style={{ flex: 1 }}
      contentContainerStyle={{ paddingTop: 2, paddingBottom: 8 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={{ width: '100%', maxWidth, alignSelf: 'center' }}>
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
            <AppText
              variant="bodySm"
              weight="semibold"
              numberOfLines={1}
              style={{ flexShrink: 1 }}
            >
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
              backgroundColor: over(colors.background, stateColor, 0.16),
            }}
          >
            <View
              style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: stateColor }}
            />
            <AppText
              variant="caption"
              weight="semibold"
              className="uppercase"
              style={{ color: stateColor, letterSpacing: 0.6 }}
            >
              {card.fsrs.state}
            </AppText>
          </View>
        </View>

        <Surface testID="study-waiting-hero" tone="scene" style={{ alignItems: 'center' }}>
          <View
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={{
              width: 48,
              height: 48,
              borderRadius: 24,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: over(glass.fill, stateColor, 0.16),
            }}
          >
            <MaterialIcons name="schedule" size={iconSize.nav} color={stateColor} />
          </View>

          <AppText
            variant="caption"
            weight="semibold"
            className="mt-3 uppercase"
            style={{ color: stateColor, letterSpacing: 0.6 }}
          >
            Learning step
          </AppText>
          <AppText
            variant={tight ? 'headline' : 'title'}
            weight="bold"
            headingLevel={2}
            align="center"
            className="mt-1"
          >
            Next review {waitLabel}
          </AppText>
          <AppText
            variant="body"
            tone="muted"
            align="center"
            className="mt-2"
            style={{ maxWidth: 300 }}
          >
            Take a moment to recall what you just learned. This card returns when its
            learning step is due.
          </AppText>

          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              marginTop: 16,
              borderRadius: radii.pill,
              backgroundColor: colors.surfaceInset,
              paddingHorizontal: 14,
              paddingVertical: 8,
            }}
          >
            <MaterialIcons name="schedule" size={iconSize.sm} color={stateColor} />
            <AppText variant="caption" tone="muted" style={{ flexShrink: 1 }}>
              {learningStep ?? 'Learning'} · Target {targetRetention}%
            </AppText>
          </View>
        </Surface>

        <View style={{ marginTop: 16 }}>
          <ActionButton label="Study now" onPress={onStudyNow} />
        </View>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 20 }}>
          {metrics.map((metric) => (
            <Surface
              key={metric.label}
              testID="study-waiting-metric"
              tone="pane"
              radius="control"
              padding="sm"
              style={{
                flexGrow: 1,
                flexBasis: metricBasis,
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
                      ...v3.type.answer,
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
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 10 }}>
                <MaterialIcons
                  name={metric.icon}
                  size={iconSize.sm}
                  color={metric.iconColor ?? metric.color}
                />
                <AppText
                  variant="caption"
                  style={{
                    color: metric.noteColor ?? colors.onSurfaceVariant,
                    flexShrink: 1,
                  }}
                >
                  {metric.note}
                </AppText>
              </View>
            </Surface>
          ))}
        </View>

        <Surface testID="study-waiting-learned" tone="pane" style={{ marginTop: 20 }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
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
              What you learned
            </AppText>
            <AppText variant="caption" tone="tertiary">
              {addedLabel}
            </AppText>
          </View>

          <View>
            <AppText
              variant="label"
              weight="semibold"
              tone="muted"
              className="uppercase"
              style={{ letterSpacing: 1.1 }}
            >
              {frontLanguage}
            </AppText>
            <AppText
              variant="headline"
              weight="bold"
              language={frontRtl ? 'fa' : undefined}
              style={{
                marginTop: 4,
                textAlign: frontRtl ? 'right' : 'left',
                writingDirection: frontRtl ? 'rtl' : 'ltr',
                ...(frontRtl ? { letterSpacing: 0 } : {}),
              }}
            >
              {card.front.text}
            </AppText>
          </View>

          <View style={{ marginVertical: 14 }} />

          <View>
            <AppText
              variant="label"
              weight="semibold"
              tone="muted"
              className="uppercase"
              style={{ letterSpacing: 1.1 }}
            >
              Answer
            </AppText>
            <AppText
              variant="headline"
              weight="bold"
              tone="accent"
              language={backRtl ? 'fa' : undefined}
              style={{
                marginTop: 4,
                textAlign: backRtl ? 'right' : 'left',
                writingDirection: backRtl ? 'rtl' : 'ltr',
                ...(backRtl ? { letterSpacing: 0 } : {}),
              }}
            >
              {card.back.text}
            </AppText>
          </View>

          {note ? (
            <Surface tone="inset" radius="control" padding="sm" style={{ marginTop: 14 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                <MaterialIcons name="sticky-note-2" size={iconSize.sm} color={colors.primary} />
                <AppText
                  variant="label"
                  weight="semibold"
                  tone="muted"
                  className="uppercase"
                >
                  Your note
                </AppText>
              </View>
              <AppText
                variant="bodySm"
                style={{
                  marginTop: 4,
                  textAlign: noteDirection === 'rtl' ? 'right' : 'left',
                  writingDirection: noteDirection,
                }}
              >
                {note}
              </AppText>
            </Surface>
          ) : null}

          {card.example ? (
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 10 }}>
              <MaterialIcons name="format-quote" size={iconSize.sm} color={colors.primary} />
              <AppText
                variant="bodySm"
                tone="muted"
                className="italic"
                style={{ flex: 1, minWidth: 0 }}
              >
                {card.example}
              </AppText>
            </View>
          ) : null}

          {card.synonyms ? (
            <AppText variant="bodySm" tone="muted" style={{ marginTop: 8 }}>
              Also: {card.synonyms}
            </AppText>
          ) : null}
        </Surface>
      </View>
    </ScrollView>
  );
}
