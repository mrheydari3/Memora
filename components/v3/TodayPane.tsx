import { useWindowDimensions, View } from 'react-native';
import { AppText } from '../AppText';
import { ActionButton } from './ActionButton';
import { Surface } from './Surface';
import { colors, radii, stateColors } from '../../theme/tokens';
import { v3 } from '../../theme/v3';

type Segment = { label: string; value: number; color: string };

type TodayPaneProps = {
  /** Cards waiting today across the whole library. */
  due: number;
  /** How many decks those cards belong to. */
  deckCount: number;
  /** Rough session length, in minutes. */
  minutes: number;
  /** The deck the session will open first. */
  nextDeck: string;
  /** That deck's own new / learning / review split. */
  newCount: number;
  learningCount: number;
  reviewCount: number;
  /** Start session, Continue, or Nothing due today. */
  label: string;
  disabled?: boolean;
  onStart: () => void;
};

const NUMERIC = { fontVariant: ['tabular-nums'] as const };

/**
 * TodayPane — the mockup's hero, measured against its own classes:
 *
 *   rounded-[24px] p-5 gap-5, the one raised scene pane, an inset top rim;
 *   eyebrow 12/600 uppercase accent; status chip on the control fill with a
 *   6px learning dot; figure 40/44 (56 on wide) and its unit at 20/600 outline;
 *   context 13 outline; "Next up" row 13 + 12 tabular; rail 6px, 320 cap, 2px
 *   gaps between segments; legend dots 8px; CTA 52px pill in the accent fill
 *   with a 20px arrow.
 *
 * Order follows the mockup: the rail belongs to the next deck, so it sits above
 * the action rather than under it. The scene pane and the pill are the shared
 * v3 primitives; this file only composes them.
 */
export function TodayPane({
  due,
  deckCount,
  minutes,
  nextDeck,
  newCount,
  learningCount,
  reviewCount,
  label,
  disabled = false,
  onStart,
}: TodayPaneProps) {
  const { width } = useWindowDimensions();
  const wide = width >= 900;
  const date = new Date().toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });

  const segments: Segment[] = [
    { label: 'new', value: newCount, color: stateColors.New },
    { label: 'learning', value: learningCount, color: stateColors.Learning },
    { label: 'review', value: reviewCount, color: stateColors.Review },
  ];
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);

  return (
    <Surface tone="scene" padding="none" testID="today-panel" style={{ overflow: 'hidden' }}>
      <View
        testID="today-panel-body"
        style={{ padding: v3.spacing.panel, gap: v3.spacing.panel }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <AppText
            variant="label"
            weight="semibold"
            tone="accent"
            headingLevel={2}
            className="uppercase"
            numberOfLines={2}
            style={{ flexShrink: 1 }}
          >
            Today · {date}
          </AppText>

          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              paddingHorizontal: 10,
              paddingVertical: 4,
              borderRadius: radii.pill,
              backgroundColor: colors.surfaceControl,
            }}
          >
            <View
              style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: stateColors.Learning }}
            />
            <AppText variant="caption" tone="muted">
              FSRS-6 Active
            </AppText>
          </View>
        </View>

        <View>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 10 }}>
            <AppText
              variant="display"
              style={[wide ? v3.type.heroWide : v3.type.hero, NUMERIC]}
              accessibilityLabel={`${due} cards due today`}
            >
              {due}
            </AppText>
            <AppText variant="headline" weight="semibold" tone="tertiary" numberOfLines={1}>
              cards due
            </AppText>
          </View>
          <AppText variant="bodySm" tone="tertiary" style={{ marginTop: 2 }}>
            {due > 0
              ? `${deckCount} ${deckCount === 1 ? 'deck' : 'decks'} · estimated ${minutes} minutes`
              : 'Nothing waiting — you are all caught up'}
          </AppText>
        </View>

        {total > 0 && (
          <View style={{ gap: 8, paddingTop: 4 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
              <AppText variant="bodySm" weight="medium" numberOfLines={1} style={{ flexShrink: 1 }}>
                Next up · {nextDeck}
              </AppText>
              <AppText variant="caption" tone="tertiary" style={NUMERIC}>
                {total} total
              </AppText>
            </View>

            <View
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              style={{
                flexDirection: 'row',
                gap: 2,
                height: v3.rail.hero,
                maxWidth: 320,
                borderRadius: radii.pill,
                backgroundColor: colors.surfaceControl,
                overflow: 'hidden',
              }}
            >
              {segments.map((segment, index) => {
                // Destructured on purpose: `.value` inside a JSX style object
                // trips Reanimated's babel heuristic, which cannot tell data
                // from a shared value.
                const { value, color } = segment;
                return (
                  <View
                    key={segment.label}
                    style={{
                      flex: value,
                      backgroundColor: color,
                      borderTopStartRadius: index === 0 ? radii.pill : 0,
                      borderBottomStartRadius: index === 0 ? radii.pill : 0,
                      borderTopEndRadius: index === segments.length - 1 ? radii.pill : 0,
                      borderBottomEndRadius: index === segments.length - 1 ? radii.pill : 0,
                    }}
                  />
                );
              })}
            </View>

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 12, rowGap: 4 }}>
              {segments.map((segment) => (
                <View
                  key={segment.label}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
                >
                  <View
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 4,
                      backgroundColor: segment.color,
                    }}
                  />
                  <AppText variant="caption" tone="tertiary" style={NUMERIC}>
                    {segment.value} {segment.label}
                  </AppText>
                </View>
              ))}
            </View>
          </View>
        )}

        <ActionButton
          label={label}
          onPress={onStart}
          disabled={disabled}
          icon="arrow-forward"
        />
      </View>
    </Surface>
  );
}
