import { Animated, Pressable, useWindowDimensions, View } from 'react-native';
import { AppText } from '../AppText';
import { MaterialIcons } from '../Icon';
import { usePressFeedback } from '../../motion';
import {
  colors,
  fills,
  glassFill,
  iconSize,
  radii,
  rims,
  stateColors,
} from '../../theme/tokens';
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
 *   rounded-[24px] p-5 gap-5, inset top rim the rim and inset
 *   bottom rule in the accent line; eyebrow 12/600 uppercase accent; status
 *   chip on the control fill with a 6px learning dot; figure 40/44 (56 on wide) and its
 *   unit at 20/600 outline; context 13 outline; "Next up" row 13 + 12 tabular;
 *   rail 6px, 320 cap, 2px gaps between segments; legend dots 8px; CTA 52px
 *   pill in the accent fill with a 20px arrow.
 *
 * Order follows the mockup: the rail belongs to the next deck, so it sits above
 * the action rather than under it.
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
  const press = usePressFeedback({ scale: 0.975 });
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
  const ink = disabled ? colors.outline : colors.onPrimaryContainer;

  return (
    <View
      testID="today-panel"
      style={[
        glassFill,
        {
          borderRadius: v3.radii.pane,
          borderTopWidth: 1,
          borderTopColor: rims.soft,
          borderBottomWidth: 1,
          borderBottomColor: colors.accentLine,
          overflow: 'hidden',
        },
      ]}
    >
      <View
        testID="today-panel-body"
        style={{ padding: v3.spacing.panel, gap: v3.spacing.panel }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <AppText
            variant="label"
            weight="semibold"
            tone="accent"
            headingLevel={1}
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
              {segments.map((segment, index) => (
                <View
                  key={segment.label}
                  style={{
                    flex: segment.value,
                    backgroundColor: segment.color,
                    borderTopStartRadius: index === 0 ? radii.pill : 0,
                    borderBottomStartRadius: index === 0 ? radii.pill : 0,
                    borderTopEndRadius: index === segments.length - 1 ? radii.pill : 0,
                    borderBottomEndRadius: index === segments.length - 1 ? radii.pill : 0,
                  }}
                />
              ))}
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

        <Animated.View style={press.style}>
          <Pressable
            onPress={disabled ? undefined : onStart}
            onPressIn={disabled ? undefined : press.onPressIn}
            onPressOut={disabled ? undefined : press.onPressOut}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityLabel={label}
            accessibilityState={{ disabled }}
            style={{
              minHeight: 52,
              borderRadius: radii.pill,
              paddingHorizontal: 20,
              paddingVertical: 10,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              backgroundColor: disabled ? fills.control : colors.primaryContainer,
            }}
          >
            <AppText variant="body" weight="semibold" style={{ color: ink }}>
              {label}
            </AppText>
            {!disabled && (
              <MaterialIcons name="arrow-forward" size={iconSize.lg} color={ink} />
            )}
          </Pressable>
        </Animated.View>
      </View>
    </View>
  );
}
