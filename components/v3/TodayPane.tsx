import { useEffect, useRef, useState } from 'react';
import { Animated, View } from 'react-native';
import { AppText } from '../AppText';
import { HintPressable } from '../HintPressable';
import { MaterialIcons } from '../Icon';
import { ActionButton } from './ActionButton';
import { StreakChip } from './StreakChip';
import { Surface } from './Surface';
import { colors, iconSize, motion, radii, stateColors } from '../../theme/tokens';
import { v3 } from '../../theme/v3';
import { timingTo, useAnimatedNumber, usePressFeedback, useReveal } from '../../motion';
import { useLaunchReveal } from '../../motion/LaunchReveal';

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
  /** How many other decks still have cards due today. */
  otherDueDecks: number;
  /** Study this deck or Continue this deck; the caught-up state has no action. */
  label: string;
  onStart: () => void;
  /** Opens the due-deck chooser. */
  onOpenPlan: () => void;
  /** Whether the plan sheet is open, announced on the trigger. */
  planOpen: boolean;
  /** The local clock used for the date; Home owns it so midnight is real. */
  now?: number;
  /** Current study-day streak; omit when the app bar owns the shortcut. */
  streak?: number;
  /** Opens the streak calendar; Home owns routing and haptics. */
  onOpenStreak?: () => void;
};

const NUMERIC = { fontVariant: ['tabular-nums'] as const };

const makeSegments = (newCount: number, learningCount: number, reviewCount: number): Segment[] => [
  { label: 'new', value: newCount, color: stateColors.New },
  { label: 'learning', value: learningCount, color: stateColors.Learning },
  { label: 'review', value: reviewCount, color: stateColors.Review },
];

/**
 * TodayPane — the mockup's hero, measured against its own classes:
 *
 *   rounded-[24px] p-5 gap-5, the one raised scene pane, now frosted glass so
 *   the day reads as a live surface rather than an opaque slab; an inset top
 *   rim; eyebrow 12/600 uppercase accent; figure 40/44 (56 on wide) and its
 *   unit at 20/600 outline;
 *   context 13 outline; next-deck label/count 12, deck name 13, rail 6px,
 *   320 cap, 2px gaps between segments; legend dots 8px; CTA 52px pill in the
 *   accent fill with a 20px arrow. The rail is scoped under "Start with" so it
 *   cannot be mistaken for the library-wide figure above it.
 *
 * The hero is one column on every layout: the day's figure, the deck it will
 * open and the action stack in reading order. It measures its own pane for the
 * display-size step because the tablet board shares that row with the library
 * rail. The next-deck summary is itself the control that opens Today's plan.
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
  otherDueDecks,
  label,
  onStart,
  onOpenPlan,
  planOpen,
  now: nowProp,
  streak,
  onOpenStreak,
}: TodayPaneProps) {
  // The hero adapts to the width Home gives it, not the window: the tablet
  // board places the library rail beside it, so the pane can be narrower than
  // the page even on a large canvas.
  const [paneWidth, setPaneWidth] = useState(0);
  const wide = paneWidth >= 560;
  const now = nowProp ?? Date.now();
  const date = new Date(now).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });

  const segments = makeSegments(newCount, learningCount, reviewCount);
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);
  // The hero's plan, rail and action exist only when the selected deck has work.
  const hasWork = total > 0;
  const displayedDue = useAnimatedNumber(due);
  const launched = useLaunchReveal();
  const planPress = usePressFeedback({ scale: 0.99 });

  // The hero enters as one composed block, but its parts settle in a short
  // sequence. It waits for the launch layer to leave, so the reveal is visible
  // rather than finishing behind the splash. Keys stay stable afterwards, so a
  // due-count refresh or an unrelated store render does not replay it.
  const dueReveal = useReveal(launched ? 'today-due' : 'today-due-pending', {
    delay: 40,
    duration: motion.base,
    distance: 10,
    enabled: launched,
  });
  const nextReveal = useReveal(launched ? 'today-next' : 'today-next-pending', {
    delay: 120,
    duration: motion.base,
    distance: 8,
    enabled: launched,
  });
  const actionReveal = useReveal(launched ? 'today-action' : 'today-action-pending', {
    delay: 180,
    duration: motion.base,
    distance: 8,
    enabled: launched,
    // Keep the pill fully opaque while it rises: an entrance sampled at the
    // 0.92 floor drops its label below the AA contrast threshold.
    opacityFloor: 1,
  });

  // Rails are proportional, so changing them in place would make the segments
  // snap. Hold the previous composition for one fast fade, swap the values,
  // then settle the new rail back in. The final values are the store's values.
  const [railSegments, setRailSegments] = useState<Segment[]>(() =>
    makeSegments(newCount, learningCount, reviewCount)
  );
  const railOpacity = useRef(new Animated.Value(1)).current;
  const railSignature = `${newCount}:${learningCount}:${reviewCount}`;
  const lastRailSignature = useRef(railSignature);

  useEffect(() => {
    if (lastRailSignature.current === railSignature) return;
    lastRailSignature.current = railSignature;
    const nextSegments = makeSegments(newCount, learningCount, reviewCount);
    let cancelled = false;
    void (async () => {
      await timingTo(railOpacity, 0, { duration: motion.fast });
      if (cancelled) return;
      setRailSegments(nextSegments);
      await timingTo(railOpacity, 1, { duration: motion.base });
    })();
    return () => {
      cancelled = true;
      railOpacity.stopAnimation();
    };
  }, [learningCount, newCount, railOpacity, railSignature, reviewCount]);

  const displayedSegments =
    railSegments.reduce((sum, segment) => sum + segment.value, 0) > 0
      ? railSegments
      : segments;

  // The estimate only describes real work: a caught-up library says so without
  // inventing minutes, and one minute is not "1 minutes".
  const estimate =
    minutes > 0 ? `estimated ${minutes} ${minutes === 1 ? 'minute' : 'minutes'}` : null;
  const otherDueLabel =
    otherDueDecks > 0
      ? otherDueDecks === 1
        ? '1 other deck is due today'
        : `${otherDueDecks} other decks are due today`
      : null;
  const context =
    due > 0
      ? `${deckCount} ${deckCount === 1 ? 'deck' : 'decks'}${estimate ? ` · ${estimate}` : ''}`
      : "You're all caught up.";

  const dueBlock = (
    <Animated.View style={dueReveal.style}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 10 }}>
        <AppText
          variant="display"
          style={[wide ? v3.type.heroWide : v3.type.hero, NUMERIC]}
          accessibilityLabel={`${due} cards due today`}
        >
          {displayedDue}
        </AppText>
        <AppText variant="headline" weight="semibold" tone="tertiary" numberOfLines={1}>
          cards due
        </AppText>
      </View>
      <AppText variant="bodySm" tone="tertiary" style={{ marginTop: 2 }}>
        {context}
      </AppText>
    </Animated.View>
  );

  const nextBlock = hasWork ? (
    <Animated.View style={nextReveal.style}>
      <View style={{ gap: 8 }}>
        <HintPressable
          testID="today-plan-trigger"
          hint="Choose which due deck to study first"
          onPress={onOpenPlan}
          onPressIn={planPress.onPressIn}
          onPressOut={planPress.onPressOut}
          accessibilityRole="button"
          accessibilityState={{ expanded: planOpen }}
          aria-expanded={planOpen}
          aria-haspopup="dialog"
          style={{ minHeight: 44, justifyContent: 'center', borderRadius: radii.control }}
        >
          <Animated.View style={planPress.style}>
            <View style={{ gap: 3 }}>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'baseline',
                  justifyContent: 'space-between',
                  gap: 10,
                }}
              >
                <View
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 1 }}
                >
                  <AppText
                    variant="label"
                    weight="semibold"
                    tone="tertiary"
                    className="uppercase"
                    numberOfLines={1}
                    style={{ letterSpacing: 0.8 }}
                  >
                    Start with
                  </AppText>
                  <View accessible={false} importantForAccessibility="no-hide-descendants">
                    <MaterialIcons name="expand-more" size={iconSize.xs} color={colors.outline} />
                  </View>
                </View>
                <AppText
                  variant="caption"
                  tone="tertiary"
                  numberOfLines={1}
                  style={[NUMERIC, { flexShrink: 0 }]}
                >
                  {total} in queue
                </AppText>
              </View>
              <AppText variant="bodySm" weight="semibold" numberOfLines={2}>
                {nextDeck}
              </AppText>
            </View>
          </Animated.View>
        </HintPressable>

        <Animated.View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={{
            opacity: railOpacity,
            flexDirection: 'row',
            gap: 2,
            height: v3.rail.hero,
            maxWidth: 320,
            borderRadius: radii.pill,
            backgroundColor: colors.surfaceControl,
            overflow: 'hidden',
          }}
        >
          {displayedSegments.map((segment, index) => {
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
                  borderTopEndRadius: index === displayedSegments.length - 1 ? radii.pill : 0,
                  borderBottomEndRadius: index === displayedSegments.length - 1 ? radii.pill : 0,
                }}
              />
            );
          })}
        </Animated.View>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 12, rowGap: 4 }}>
          {displayedSegments.map((segment) => (
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
                  opacity: segment.value === 0 ? v3.state.zeroDotOpacity : 1,
                }}
              />
              <AppText variant="caption" tone="tertiary" style={NUMERIC}>
                {segment.value} {segment.label}
              </AppText>
            </View>
          ))}
        </View>
      </View>
    </Animated.View>
  ) : null;

  const action = hasWork ? (
    <Animated.View style={actionReveal.style}>
      <ActionButton label={label} onPress={onStart} icon="arrow-forward" />
      {otherDueLabel ? (
        <AppText
          variant="caption"
          tone="tertiary"
          align="center"
          style={{ marginTop: 8 }}
        >
          {otherDueLabel}
        </AppText>
      ) : null}
    </Animated.View>
  ) : null;

  return (
    <Surface
      tone="scene"
      frosted
      padding="none"
      testID="today-panel"
      style={{ overflow: 'hidden', flexGrow: 1 }}
    >
      <View
        testID="today-panel-body"
        onLayout={(event) => setPaneWidth(Math.round(event.nativeEvent.layout.width))}
        style={{
          padding: v3.spacing.panel,
          gap: v3.spacing.panel,
          flexGrow: 1,
          // The caught-up hero has no action row, so center its short content
          // in the pane instead of leaving the card top-heavy.
          justifyContent: hasWork ? 'flex-start' : 'center',
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            columnGap: 8,
            rowGap: 8,
          }}
        >
          <AppText
            variant="label"
            weight="semibold"
            tone="accent"
            headingLevel={2}
            className="uppercase"
            numberOfLines={2}
            style={{ flexShrink: 1, minWidth: 0 }}
          >
            Today · {date}
          </AppText>

          {streak !== undefined && onOpenStreak ? (
            <StreakChip streak={streak} onPress={onOpenStreak} />
          ) : null}
        </View>

        {dueBlock}
        {nextBlock}
        {action}
      </View>
    </Surface>
  );
}
