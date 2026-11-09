import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import type { ViewStyle } from 'react-native';
import { MaterialIcons } from './Icon';
import type { Flashcard } from '../data/types';
import { AppText } from './AppText';
import { IconButton } from './IconButton';
import { HintPressable } from './HintPressable';
import { EASE, springTo, springToAsync, timingTo, useReducedMotion } from '../motion';
import { HapticsEngine } from '../services/haptics';
import {
  colors,
  fills,
  glass,
  heights,
  iconSize,
  layout,
  motion,
  over,
  radii,
  shadow,
  spacing,
  stateColors,
} from '../theme/tokens';

type CardStackProps = {
  card: Flashcard;
  /** The card behind this one — rendered as a quiet peeking layer. */
  previous?: Flashcard;
  next?: Flashcard;
  /** 1-based position in the filtered deck. */
  position: number;
  total: number;
  onPrevious: () => void;
  onNext: () => void;
  /** Opens the card's existing actions sheet. */
  onMenu: (card: Flashcard) => void;
};

/** The card never grows past the page's reading measure, however wide it gets. */
const MAX_CARD_WIDTH = layout.cardMeasure;
/** Card proportions; taller than a bank card so two languages fit comfortably. */
const CARD_RATIO = layout.cardRatio;
const MIN_CARD_HEIGHT = layout.cardMinHeight;
const MAX_CARD_HEIGHT = layout.cardMaxHeight;
/** How far the card must travel before the gesture counts as a page turn. */
const COMMIT_FRACTION = 0.22;
const COMMIT_VELOCITY = 0.55;
/** The peek height of each stacked layer behind the active card. */
const STACK_PEEK = 26;

/** Dragging across the card must never start a text selection on the web. */
const WEB_DRAG_SURFACE: ViewStyle =
  Platform.OS === 'web' ? ({ userSelect: 'none' } as unknown as ViewStyle) : {};

/**
 * CardStack — the gallery view of a deck: one card at a time on a 3D stack.
 *
 * The layers behind the card are pure fills (nearer = lighter), so the stack
 * reads as depth rather than as three outlined rectangles.
 *
 * Drag it with a mouse or a finger in either direction, use the arrows, or press
 * the arrow keys on the web. The card that leaves keeps its momentum and the
 * arriving card settles in from the far side, with the next/previous layers
 * rising as it moves. Everything animates through the shared motion layer, so
 * reduce-motion turns the turn into an instant swap. A completed transition
 * gives one short haptic tap; a rejected drag springs back with none.
 *
 * The card itself flips on tap in 3D to show its example and scheduling meta,
 * while the three-dot menu in the corner still opens the existing card actions.
 */
export function CardStack({
  card,
  previous,
  next,
  position,
  total,
  onPrevious,
  onNext,
  onMenu,
}: CardStackProps) {
  const { width: windowWidth } = useWindowDimensions();
  const reduced = useReducedMotion();

  const [measured, setMeasured] = useState(0);
  const containerWidth = measured > 0 ? measured : Math.min(windowWidth - 40, MAX_CARD_WIDTH);
  const cardWidth = Math.max(220, Math.min(containerWidth, MAX_CARD_WIDTH));
  const cardHeight = Math.round(
    Math.max(MIN_CARD_HEIGHT, Math.min(MAX_CARD_HEIGHT, cardWidth * CARD_RATIO))
  );

  const drag = useRef(new Animated.Value(0)).current;
  const flip = useRef(new Animated.Value(0)).current;
  const progress = useRef(new Animated.Value(0)).current;
  const [flipped, setFlipped] = useState(false);
  /** True while a committed turn is animating, so a second turn cannot overlap. */
  const turning = useRef(false);
  /**
   * Bumped whenever the visible card changes. A turn that started on the old
   * card must not page the gallery after the card underneath it changed.
   */
  const turnGeneration = useRef(0);

  // PanResponder is created once; its callbacks read the current props through
  // this ref, so a new card or a resized window never rebuilds the responder.
  const live = useRef({ onNext, onPrevious, cardWidth, hasNext: !!next, hasPrev: !!previous });
  live.current = { onNext, onPrevious, cardWidth, hasNext: !!next, hasPrev: !!previous };

  // A new card always lands face-up and ready to drag.
  useEffect(() => {
    turnGeneration.current += 1;
    setFlipped(false);
    flip.setValue(0);
    drag.setValue(0);
    turning.current = false;
  }, [card.id, flip, drag]);

  // The position rail fills card by card instead of jumping between stops.
  useEffect(() => {
    const target = total > 1 ? position / total : total === 1 ? 1 : 0;
    timingTo(progress, target, { duration: motion.base, nativeDriver: false });
  }, [position, total, progress]);

  const go = useCallback(
    (direction: -1 | 1) => {
      if (turning.current) return;
      const { onNext, onPrevious, cardWidth: width, hasNext, hasPrev } = live.current;
      if (direction < 0 && !hasNext) return;
      if (direction > 0 && !hasPrev) return;

      turning.current = true;
      const generation = turnGeneration.current;
      // Next = the card leaves to the left, previous = to the right. A spring
      // carries the card off, so the turn keeps its momentum instead of
      // stopping on a clock; the swap happens only once it has really left.
      springToAsync(drag, direction * width * 1.14).then(() => {
        if (turnGeneration.current !== generation) return;
        if (direction < 0) onNext();
        else onPrevious();
        // Only after the turn actually committed does the device tick.
        HapticsEngine.cardTransition();
        // The arriving card enters from the far edge and settles on the spring.
        drag.setValue(-direction * width * 0.16);
        springToAsync(drag, 0);
        turning.current = false;
      });
    },
    [drag]
  );

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_event, gesture) =>
          Math.abs(gesture.dx) > 8 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.2,
        onPanResponderGrant: () => {
          HapticsEngine.dragStart();
        },
        onPanResponderMove: (_event, gesture) => {
          if (turning.current) return;
          drag.setValue(gesture.dx);
        },
        onPanResponderRelease: (_event, gesture) => {
          if (turning.current) return;
          const { cardWidth: width, hasNext, hasPrev } = live.current;
          const threshold = width * COMMIT_FRACTION;
          const wantedNext = gesture.dx < -threshold || gesture.vx < -COMMIT_VELOCITY;
          const wantedPrev = gesture.dx > threshold || gesture.vx > COMMIT_VELOCITY;

          if (wantedNext && hasNext) go(-1);
          else if (wantedPrev && hasPrev) go(1);
          else springTo(drag, 0);
        },
        // A canceled swipe settles silently; the next committed turn is the
        // only event that earns feedback.
        onPanResponderTerminate: () => springTo(drag, 0),
      }),
    [drag, go]
  );

  const toggleFlip = useCallback(() => {
    HapticsEngine.cardFlip();
    const nextFlipped = !flipped;
    setFlipped(nextFlipped);
    timingTo(flip, nextFlipped ? 1 : 0, { duration: motion.flip, easing: EASE.flip });
  }, [flip, flipped]);

  // Web convenience: the arrow keys page the gallery, like every card viewer.
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      // Never steal the caret keys from a text field or a sheet's controls.
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable ||
          target.closest('[role="dialog"], [aria-modal="true"]'))
      ) {
        return;
      }
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        go(1);
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        go(-1);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [go]);

  const rotate = drag.interpolate({
    inputRange: [-cardWidth, 0, cardWidth],
    outputRange: ['-7deg', '0deg', '7deg'],
    extrapolate: 'clamp',
  });
  const settleScale = drag.interpolate({
    inputRange: [-cardWidth, 0, cardWidth],
    outputRange: [0.975, 1, 0.975],
    extrapolate: 'clamp',
  });

  const nextLift = drag.interpolate({
    inputRange: [-cardWidth, 0],
    outputRange: [1, 0.945],
    extrapolate: 'clamp',
  });
  const nextFade = drag.interpolate({
    inputRange: [-cardWidth, 0],
    outputRange: [1, 0.7],
    extrapolate: 'clamp',
  });
  const prevLift = drag.interpolate({
    inputRange: [0, cardWidth],
    outputRange: [0.945, 1],
    extrapolate: 'clamp',
  });
  const prevFade = drag.interpolate({
    inputRange: [0, cardWidth],
    outputRange: [0.7, 1],
    extrapolate: 'clamp',
  });

  const frontTurn = flip.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] });
  const backTurn = flip.interpolate({ inputRange: [0, 1], outputRange: ['180deg', '360deg'] });
  const progressWidth = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  // A word is a poster; a phrase steps down to the title size to keep its lines.
  const frontType = card.front.text.length > 26 ? 'title' : 'display';

  return (
    <View style={styles.wrapper} onLayout={(event) => setMeasured(event.nativeEvent.layout.width)}>
      <View style={{ height: cardHeight + STACK_PEEK, alignItems: 'center' }}>
        {previous && (
          <Animated.View
            style={[
              styles.stackLayer,
              {
                pointerEvents: 'none',
                width: cardWidth - 52,
                height: cardHeight,
                top: 24,
                backgroundColor: glass.fill,
                opacity: prevFade,
                transform: [{ scale: prevLift }],
              },
            ]}
          />
        )}
        {next && (
          <Animated.View
            style={[
              styles.stackLayer,
              {
                pointerEvents: 'none',
                width: cardWidth - 26,
                height: cardHeight,
                top: 12,
                backgroundColor: glass.cardFace,
                opacity: nextFade,
                transform: [{ scale: nextLift }],
              },
            ]}
          />
        )}

        <Animated.View
          style={[
            styles.card,
            // The card's own tint, mixed into its face so both sides read as the
            // same card in the gallery.
            card.color ? { backgroundColor: over(glass.cardFace, card.color, 0.16) } : null,
            WEB_DRAG_SURFACE,
            {
              width: cardWidth,
              height: cardHeight,
              transform: [
                { perspective: 1200 },
                { translateX: drag },
                ...(reduced ? [] : [{ rotate }]),
                { scale: settleScale },
              ],
            },
          ]}
          {...panResponder.panHandlers}
        >
          <View style={styles.flipStage}>
            <Animated.View
              style={[
                styles.face,
                card.color ? { backgroundColor: over(glass.cardFace, card.color, 0.16) } : null,
                {
                  transform: [{ perspective: 1200 }, { rotateY: frontTurn }],
                  pointerEvents: flipped ? 'none' : 'auto',
                },
              ]}
              accessibilityElementsHidden={flipped}
              importantForAccessibility={flipped ? 'no-hide-descendants' : 'auto'}
            >
              {/* The flip target and the menu are siblings: a pressable inside a
                  pressable is invalid HTML on web, and the menu must not flip. */}
              <HintPressable
                hint="Tap for the card details"
                haptic={false}
                className="flex-1"
                onPress={toggleFlip}
                accessibilityRole="button"
                // Named by its content (word, translation, example). The old
                // label repeated front+back but still omitted the visible
                // example and state text, so axe flagged the mismatch.
              >
                <View style={styles.faceBody}>
                  <View style={styles.topRow}>
                    <View style={styles.label}>
                      <View style={styles.dot} />
                      <AppText variant="caption" weight="semibold" tone="accent" className="uppercase">
                        Word
                      </AppText>
                    </View>
                    <View style={styles.menuSpacer} />
                  </View>

                  <View style={styles.center}>
                    <AppText
                      variant={frontType}
                      weight="bold"
                      align="center"
                      numberOfLines={3}
                      style={[styles.frontText, { writingDirection: card.front.direction }]}
                    >
                      {card.front.text}
                    </AppText>
                    <View style={styles.translationRule} />
                    <AppText
                      variant="headline"
                      weight="medium"
                      tone="muted"
                      align="center"
                      numberOfLines={3}
                      style={{ writingDirection: card.back.direction }}
                    >
                      {card.back.text}
                    </AppText>
                  </View>

                  <View style={styles.bottomRow}>
                    <StateTick state={card.fsrs.state} />
                    <View style={styles.hint}>
                      <MaterialIcons name="flip" size={iconSize.xs} color={colors.outline} />
                      <AppText variant="caption" weight="medium" tone="tertiary" className="ml-1">
                        Tap for details
                      </AppText>
                    </View>
                  </View>
                </View>
              </HintPressable>

              <View style={[styles.menuSlot, { pointerEvents: 'box-none' }]}>
                <IconButton
                  icon="more-horiz"
                  size="sm"
                  onPress={() => onMenu(card)}
                  accessibilityLabel={`Options for ${card.front.text}`}
                />
              </View>
            </Animated.View>

            <Animated.View
              style={[
                styles.face,
                card.color ? { backgroundColor: over(glass.cardFace, card.color, 0.16) } : null,
                {
                  transform: [{ perspective: 1200 }, { rotateY: backTurn }],
                  pointerEvents: flipped ? 'auto' : 'none',
                },
              ]}
              accessibilityElementsHidden={!flipped}
              importantForAccessibility={flipped ? 'auto' : 'no-hide-descendants'}
            >
              {/*
                No aria-label: the face contains the word, the translation and
                the example, and a label of "Details for …" contradicted all of
                it (axe label-content-name-mismatch). The hint is enough.
              */}
              <HintPressable
                hint="Tap to return to the word"
                haptic={false}
                className="flex-1"
                onPress={toggleFlip}
                accessibilityRole="button"
              >
                <View style={styles.faceBody}>
                  <View style={styles.topRow}>
                    <View style={styles.label}>
                      <View style={styles.dot} />
                      <AppText variant="caption" weight="semibold" tone="accent" className="uppercase">
                        Details
                      </AppText>
                    </View>
                    <View style={styles.menuSpacer} />
                  </View>

                  <View style={styles.center}>
                    <AppText
                      variant="title"
                      weight="bold"
                      align="center"
                      numberOfLines={2}
                      style={{ writingDirection: card.back.direction }}
                    >
                      {card.back.text}
                    </AppText>
                    {card.example ? (
                      <View style={styles.example}>
                        <AppText variant="caption" weight="semibold" tone="tertiary" className="uppercase">
                          Example
                        </AppText>
                        <AppText
                          variant="bodySm"
                          tone="muted"
                          align="center"
                          className="mt-1.5"
                          numberOfLines={3}
                          style={{ writingDirection: card.front.direction }}
                        >
                          {card.example}
                        </AppText>
                      </View>
                    ) : null}
                  </View>

                  <View style={styles.meta}>
                    <MetaCell label="State" value={card.fsrs.state} />
                    <MetaCell label="Due" value={formatDue(card.fsrs.due)} />
                    <MetaCell label="Reviews" value={String(card.fsrs.reps)} />
                  </View>
                </View>
              </HintPressable>

              <View style={[styles.menuSlot, { pointerEvents: 'box-none' }]}>
                <IconButton
                  icon="more-horiz"
                  size="sm"
                  onPress={() => onMenu(card)}
                  accessibilityLabel={`Options for ${card.front.text}`}
                />
              </View>
            </Animated.View>
          </View>
        </Animated.View>
      </View>

      <View style={[styles.controls, { width: cardWidth }]}>
        <IconButton
          icon="chevron-left"
          onPress={() => go(1)}
          disabled={!previous}
          accessibilityLabel="Previous card"
        />
        <View style={styles.position}>
          <AppText variant="bodySm" weight="semibold">
            {total > 0 ? `${position} / ${total}` : '0 / 0'}
          </AppText>
          <View style={styles.track}>
            <Animated.View style={[styles.fill, { width: progressWidth }]} />
          </View>
        </View>
        <IconButton
          icon="chevron-right"
          onPress={() => go(-1)}
          disabled={!next}
          accessibilityLabel="Next card"
        />
      </View>
    </View>
  );
}

/** The state colour, with its name, so colour is never the only signal. */
function StateTick({ state }: { state: Flashcard['fsrs']['state'] }) {
  return (
    <View style={styles.label}>
      <View style={[styles.dot, { backgroundColor: stateColors[state] }]} />
      <AppText variant="caption" weight="medium" tone="muted" className="ml-1.5 uppercase">
        {state}
      </AppText>
    </View>
  );
}

function MetaCell({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metaCell}>
      <AppText variant="caption" weight="medium" tone="tertiary" className="uppercase">
        {label}
      </AppText>
      <AppText variant="bodySm" weight="semibold" className="mt-0.5" numberOfLines={1}>
        {value}
      </AppText>
    </View>
  );
}

/** Review dates are always soon; a short month + day is enough to place them. */
function formatDue(due: string): string {
  const date = new Date(due);
  if (Number.isNaN(date.getTime())) return '—';
  const month = date.toLocaleDateString(undefined, { month: 'short' });
  return `${month} ${date.getDate()}`;
}

const styles = StyleSheet.create({
  wrapper: { width: '100%', alignItems: 'center' },
  stackLayer: {
    position: 'absolute',
    borderRadius: radii.pane,
  },
  card: {
    borderRadius: radii.pane,
    backgroundColor: glass.cardFace,
    boxShadow: shadow.card,
    overflow: 'hidden',
  },
  flipStage: { flex: 1 },
  face: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backfaceVisibility: 'hidden',
    backgroundColor: glass.cardFace,
  },
  faceBody: {
    flex: 1,
    paddingHorizontal: 22,
    paddingVertical: 16,
    justifyContent: 'space-between',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: heights.iconSm,
  },
  label: { flexDirection: 'row', alignItems: 'center' },
  menuSpacer: { width: heights.iconSm },
  menuSlot: { position: 'absolute', top: 14, right: 16 },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.primary,
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 8 },
  frontText: { maxWidth: '100%' },
  translationRule: {
    width: 18,
    height: 1,
    backgroundColor: colors.hairlineStrong,
    marginVertical: 14,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: heights.iconSm,
  },
  hint: { flexDirection: 'row', alignItems: 'center' },
  example: { alignItems: 'center', maxWidth: '92%' },
  meta: {
    flexDirection: 'row',
    paddingTop: 10,
  },
  metaCell: { flex: 1 },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.row,
  },
  position: { alignItems: 'center' },
  track: {
    width: 96,
    height: 3,
    borderRadius: 2,
    backgroundColor: fills.track,
    overflow: 'hidden',
    marginTop: 7,
  },
  fill: {
    height: '100%',
    minWidth: 6,
    borderRadius: 2,
    backgroundColor: colors.primary,
  },
});
