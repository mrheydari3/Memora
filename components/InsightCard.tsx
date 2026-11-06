import { View } from 'react-native';
import { MaterialIcons } from './Icon';
import { AppText } from './AppText';
import { GlassCard } from './GlassCard';
import { Pill } from './Pill';
import { alpha, colors, fills, iconSize } from '../theme/tokens';
import type { Insight, Recommendation } from '../data/intelligence';

const CONFIDENCE_LABEL: Record<string, string> = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
  insufficient: 'Limited',
};

const TONE = {
  positive: { icon: 'trending-up' as const, color: colors.success },
  attention: { icon: 'warning' as const, color: colors.warning },
  neutral: { icon: 'insights' as const, color: colors.primary },
};

/**
 * InsightCard — one finding, the numbers behind it, and how much to trust it.
 *
 * The evidence lines are not decoration: an insight that cannot name its sample
 * is not rendered at all, because the engine refuses to generate one.
 */
export function InsightCard({ insight }: { insight: Insight }) {
  const tone = TONE[insight.tone];

  return (
    <GlassCard padding="sm" className="mt-3">
      <View className="flex-row">
        <View
          className="mt-0.5 h-7 w-7 items-center justify-center rounded-full"
          style={{ backgroundColor: alpha(tone.color, 0.12) }}
        >
          <MaterialIcons name={tone.icon} size={iconSize.sm} color={tone.color} />
        </View>
        <View className="ml-3 flex-1">
          <View className="flex-row items-start">
            <AppText variant="bodySm" weight="semibold" className="flex-1">
              {insight.title}
            </AppText>
            <Pill
              label={CONFIDENCE_LABEL[insight.confidence.level] ?? 'Limited'}
              tone={insight.confidence.level === 'low' ? 'warning' : 'accent'}
              className="ml-2"
            />
          </View>
          <AppText variant="bodySm" tone="muted" className="mt-1">
            {insight.detail}
          </AppText>
          <View className="mt-2 gap-1">
            {insight.evidence.map((line, index) => (
              <AppText key={index} variant="caption" tone="tertiary">
                · {line}
              </AppText>
            ))}
          </View>
          <AppText variant="caption" tone="tertiary" className="mt-1.5">
            {insight.period} · {insight.confidence.rationale}
          </AppText>
        </View>
      </View>
    </GlassCard>
  );
}

/**
 * RecommendationCard — one action, why it is suggested, and the measurements
 * that triggered it. Priority changes the label, never the material.
 */
export function RecommendationCard({
  recommendation,
}: {
  recommendation: Recommendation;
}) {
  return (
    <GlassCard padding="sm" className="mt-3">
      <View className="flex-row items-center">
        <View
          className="h-7 w-7 items-center justify-center rounded-full"
          style={{ backgroundColor: alpha(colors.primary, 0.12) }}
        >
          <MaterialIcons
            name="arrow-forward"
            size={iconSize.sm}
            color={colors.primary}
          />
        </View>
        <AppText
          variant="caption"
          weight="semibold"
          tone="accent"
          className="ml-3 flex-1 uppercase"
        >
          Do next
        </AppText>
        <Pill
          label={recommendation.priority}
          tone={recommendation.priority === 'high' ? 'warning' : 'accent'}
        />
      </View>

      <AppText variant="body" weight="semibold" className="mt-2">
        {recommendation.action}
      </AppText>
      <AppText variant="bodySm" tone="muted" className="mt-1">
        {recommendation.reason}
      </AppText>

      <View className="mt-2 flex-row flex-wrap" style={{ gap: 6 }}>
        {recommendation.metrics.map((metric) => (
          <View
            key={metric}
            className="rounded-full px-2 py-1"
            style={{ backgroundColor: fills.tile }}
          >
            <AppText variant="caption" tone="muted">
              {metric}
            </AppText>
          </View>
        ))}
      </View>

      <AppText variant="caption" tone="tertiary" className="mt-2">
        {recommendation.period} · {recommendation.confidence.rationale}
      </AppText>
    </GlassCard>
  );
}
