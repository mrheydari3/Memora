import { useEffect, useRef } from 'react';
import type { ReactNode, RefObject } from 'react';
import {
  View,
  Pressable,
  Platform,
  Animated,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import type { ScrollViewInstance, TextStyle, ViewStyle } from 'react-native';
import { MaterialIcons } from './Icon';
import type { Flashcard as FlashcardType } from '../data/types';
import { AppText } from './AppText';
import { EASE, REVEAL_OPACITY_FLOOR, timingTo } from '../motion';
import {
  colors,
  fills,
  glass,
  glassFill,
  heights,
  iconSize,
  layout,
  motion,
  radii,
  shadow,
  spacing,
  typography,
} from '../theme/tokens';

type FlashcardViewProps = {
  card: FlashcardType;
  showAnswer: boolean;
  /** Study sessions stretch the card to fill the space between header and controls. */
  full?: boolean;
  /** Reads the visible side aloud. When provided, a speaker control sits on the card. */
  onSpeak?: () => void;
  speakLabel?: string;
};

const IS_WEB = Platform.OS === 'web';

/** A new card rises into place rather than appearing between two frames. */
const ENTER_MS = motion.slow;
/** Long enough to read as a physical turn, short enough not to delay the answer. */
const FLIP_MS = motion.flip;

/**
 * Past this length a side is a paragraph, not a word: it aligns to the reading
 * edge and scrolls, instead of being a poster centered in the pane.
 */
const LONG_FRONT = 90;
const LONG_BACK = 110;

/** Paragraphs hang off the reading edge; short copy stays on the center axis. */
function readingAlignment(
  long: boolean,
  align: 'left' | 'right' | 'center'
): ViewStyle['alignItems'] {
  if (!long) return 'center';
  return align === 'right' ? 'flex-end' : 'flex-start';
}

/**
 * The prompt is the hero of the card. Word-sized prompts get one step above the
 * app's display scale; longer prompts fall back to the shared display and title
 * sizes so the card never has to shrink its padding to fit.
 */
const FRONT_SIZES = {
  hero: { fontSize: 42, lineHeight: 48, letterSpacing: -1.2 },
  display: { fontSize: 34, lineHeight: 40, letterSpacing: -1 },
  title: { fontSize: 26, lineHeight: 32, letterSpacing: -0.5 },
} satisfies Record<'hero' | 'display' | 'title', TextStyle>;

/**
 * Leading for the answer face. The answer sits at the title/headline step but
 * needs a looser line than the scale gives it, because it is read as a block.
 */
const FACE_LINE = { headline: 30, title: 36 } as const;

/**
 * The browser will not break a long unbroken token the way native text does,
 * so the copy opts in explicitly. React Native has no such style property.
 */
const WEB_BREAK: TextStyle = IS_WEB ? ({ wordBreak: 'break-word' } as unknown as TextStyle) : {};

/** A thin, dim scrollbar reads as paper stock rather than browser chrome. */
const WEB_SCROLL: ViewStyle | undefined = IS_WEB
  ? ({
      scrollbarWidth: 'thin',
      scrollbarColor: `${colors.hairlineStrong} transparent`,
    } as unknown as ViewStyle)
  : undefined;

function FaceScroll({
  scrollRef,
  children,
}: {
  scrollRef: RefObject<ScrollViewInstance | null>;
  children: ReactNode;
}) {
  return (
    <ScrollView
      ref={scrollRef}
      style={[styles.scroll, WEB_SCROLL]}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator
      indicatorStyle="white"
      bounces={false}
      overScrollMode="never"
    >
      {children}
    </ScrollView>
  );
}

/**
 * Flashcard — smoked-glass pane that turns in 3D to reveal the answer.
 *
 * The pane itself carries the chrome (side label, read-aloud control) while the
 * two faces sit on top and rotate in opposite phases. A new card eases up into
 * the pane, and the answer face settles a beat after the turn passes 90°, so
 * the reveal feels layered instead of instantaneous.
 *
 * Each face is a reading surface: short copy centers like a poster, long copy
 * starts at the top and scrolls, so the pane can keep one height for every card.
 * Only the card carries a rim; the two layers behind it are pure fills, and the
 * card itself has no outline at all.
 */
export function FlashcardView({
  card,
  showAnswer,
  full = false,
  onSpeak,
  speakLabel = 'Read card aloud',
}: FlashcardViewProps) {
  const flip = useRef(new Animated.Value(0)).current;
  const enter = useRef(new Animated.Value(0)).current;
  const frontScroll = useRef<ScrollViewInstance>(null);
  const backScroll = useRef<ScrollViewInstance>(null);
  const { width: windowWidth } = useWindowDimensions();

  // A new card always starts face-up: snap the faces and both reading
  // positions, then rise into place.
  useEffect(() => {
    flip.setValue(0);
    enter.setValue(0);
    frontScroll.current?.scrollTo({ y: 0, animated: false });
    backScroll.current?.scrollTo({ y: 0, animated: false });
    timingTo(enter, 1, { duration: ENTER_MS, easing: EASE.standard });
  }, [card.id, enter, flip]);

  useEffect(() => {
    // The face that is about to become visible starts at the top; resetting
    // while it is edge-on keeps the jump out of sight.
    if (showAnswer) {
      backScroll.current?.scrollTo({ y: 0, animated: false });
    } else {
      frontScroll.current?.scrollTo({ y: 0, animated: false });
    }
    timingTo(flip, showAnswer ? 1 : 0, { duration: FLIP_MS, easing: EASE.flip });
  }, [showAnswer, flip]);

  // The prompt steps from hero to display to title as it grows; the answer is
  // one step below the front so the question always leads.
  const frontLength = card.front.text.length;
  // A 42px hero needs the 375px content column; narrow phones keep the display
  // size so a long single word cannot run into the card's padding.
  const heroSize = windowWidth < 365 ? FRONT_SIZES.display : FRONT_SIZES.hero;
  const frontSize =
    frontLength > 36 ? FRONT_SIZES.title : frontLength > 22 ? FRONT_SIZES.display : heroSize;
  const backVariant: 'headline' | 'title' = card.back.text.length > 110 ? 'headline' : 'title';
  const frontLong = card.front.text.length > LONG_FRONT;
  const backLong = card.back.text.length > LONG_BACK;
  const frontAlign: 'left' | 'right' | 'center' = frontLong
    ? card.front.direction === 'rtl'
      ? 'right'
      : 'left'
    : 'center';
  const backAlign: 'left' | 'right' | 'center' = backLong
    ? card.back.direction === 'rtl'
      ? 'right'
      : 'left'
    : 'center';

  // Entrance: rise + settle. The card also dips a hair mid-turn for weight.
  const cardTranslateY = enter.interpolate({ inputRange: [0, 1], outputRange: [20, 0] });
  const enterScale = enter.interpolate({ inputRange: [0, 1], outputRange: [0.965, 1] });
  const turnScale = flip.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 0.982, 1] });

  // The answer content fades up only after the pane has passed the edge-on view.
  const backReveal = flip.interpolate({
    inputRange: [0.5, 0.84],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });
  const backLift = flip.interpolate({
    inputRange: [0.5, 1],
    outputRange: [12, 0],
    extrapolate: 'clamp',
  });

  const frontStyle = {
    transform: [
      { perspective: 1200 },
      { rotateY: flip.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] }) },
    ],
  };

  const backStyle = {
    transform: [
      { perspective: 1200 },
      { rotateY: flip.interpolate({ inputRange: [0, 1], outputRange: ['180deg', '360deg'] }) },
    ],
  };

  const questionLabelOpacity = flip.interpolate({
    inputRange: [0, 0.3],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });
  const answerLabelOpacity = flip.interpolate({
    inputRange: [0.55, 0.82],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  return (
    <View
      style={[
        styles.wrapper,
        { marginHorizontal: spacing.screen, marginVertical: spacing.row },
        // The study card owns the whole column between the app bar and the
        // rating row; only its content is centred inside that height.
        full && { flex: 1 },
      ]}
    >
      {/* Two panes peeking out below the card read as the rest of the deck. */}
      <Animated.View
        style={[
          styles.stackLayer,
          styles.stackFar,
          styles.nonInteractive,
          { opacity: enter.interpolate({ inputRange: [0, 1], outputRange: [0, 1] }) },
        ]}
      />
      <View style={[styles.stackLayer, styles.stackNear, styles.nonInteractive]} />

      <Animated.View
        style={[
          styles.card,
          // No height cap in a session: the card reaches the top and bottom of
          // the stage instead of floating with empty bands above and below it.
          full && { flex: 1 },
          {
            // Never enters from invisible: the card is the only content on the
            // study screen, so a 0-opacity start is a blank screen for a beat.
            opacity: enter.interpolate({
              inputRange: [0, 1],
              outputRange: [REVEAL_OPACITY_FLOOR, 1],
            }),
            transform: [{ translateY: cardTranslateY }, { scale: enterScale }, { scale: turnScale }],
          },
        ]}
      >
        {/* Card chrome — stays put while the faces turn underneath it. */}
        <View style={styles.header}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={styles.sideDot} />
            <View style={styles.sideLabelBox}>
              <Animated.Text
                style={[styles.sideLabel, { opacity: questionLabelOpacity }]}
                aria-hidden={showAnswer}
                accessibilityElementsHidden={showAnswer}
                importantForAccessibility={showAnswer ? 'no-hide-descendants' : 'auto'}
              >
                Question
              </Animated.Text>
              <Animated.Text
                style={[styles.sideLabel, { opacity: answerLabelOpacity }]}
                aria-hidden={!showAnswer}
                accessibilityElementsHidden={!showAnswer}
                importantForAccessibility={showAnswer ? 'auto' : 'no-hide-descendants'}
              >
                Answer
              </Animated.Text>
            </View>
          </View>

          {onSpeak && (
            <Pressable
              style={({ pressed }) => [styles.speak, pressed && styles.speakPressed]}
              onPress={onSpeak}
              accessibilityRole="button"
              accessibilityLabel={speakLabel}
              hitSlop={10}
            >
              <MaterialIcons name="volume-up" size={iconSize.md} color={colors.primary} />
            </Pressable>
          )}
        </View>

        <View style={styles.flipStage}>
          {/* Front face. Both faces stay mounted for the rotation, so the one
              facing away is hidden from screen readers as well as from view. */}
          <Animated.View
            style={[
              styles.face,
              frontStyle,
              { pointerEvents: showAnswer ? 'none' : 'auto' },
            ]}
            aria-hidden={showAnswer}
            accessibilityElementsHidden={showAnswer}
            importantForAccessibility={showAnswer ? 'no-hide-descendants' : 'auto'}
          >
            <FaceScroll scrollRef={frontScroll}>
              <View style={[styles.copy, { alignItems: readingAlignment(frontLong, frontAlign) }]}>
                <AppText
                  variant="display"
                  weight="bold"
                  language={card.front.direction === 'rtl' ? 'fa' : undefined}
                  style={[
                    styles.frontText,
                    WEB_BREAK,
                    frontSize,
                    {
                      textAlign: frontAlign,
                      writingDirection: card.front.direction === 'rtl' ? 'rtl' : 'ltr',
                      ...(card.front.direction === 'rtl' ? { letterSpacing: 0 } : {}),
                    },
                  ]}
                >
                  {card.front.text}
                </AppText>
              </View>
            </FaceScroll>
          </Animated.View>

          {/* Back face */}
          <Animated.View
            style={[
              styles.face,
              backStyle,
              { pointerEvents: showAnswer ? 'auto' : 'none' },
            ]}
            aria-hidden={!showAnswer}
            accessibilityElementsHidden={!showAnswer}
            importantForAccessibility={showAnswer ? 'auto' : 'no-hide-descendants'}
          >
            <Animated.View
              style={[
                styles.faceFill,
                { opacity: backReveal, transform: [{ translateY: backLift }] },
              ]}
            >
              <FaceScroll scrollRef={backScroll}>
                <View
                  style={[
                    styles.copy,
                    styles.answerCopy,
                    { alignItems: readingAlignment(backLong, backAlign) },
                  ]}
                >
                  {/* The answer face keeps the prompt in view: a learner who
                      flipped early can still see what was asked without
                      flipping back and losing their place. */}
                  <AppText
                    variant="caption"
                    tone="muted"
                    language={card.front.direction === 'rtl' ? 'fa' : undefined}
                    numberOfLines={2}
                    className="mb-2 w-full"
                    style={{ textAlign: backAlign }}
                  >
                    {card.front.text}
                  </AppText>

                  <AppText
                    variant={backVariant}
                    language={card.back.direction === 'rtl' ? 'fa' : undefined}
                    style={[
                      styles.backText,
                      WEB_BREAK,
                      {
                        textAlign: backAlign,
                        writingDirection: card.back.direction === 'rtl' ? 'rtl' : 'ltr',
                        // A big answer needs a looser leading than the scale's headline step.
                        lineHeight: FACE_LINE[backVariant],
                        ...(card.back.direction === 'rtl' ? { letterSpacing: 0 } : {}),
                      },
                    ]}
                  >
                    {card.back.text}
                  </AppText>

                  {card.example && (
                    <>
                      <View
                        style={[
                          styles.answerRule,
                          backLong && {
                            alignSelf: backAlign === 'right' ? 'flex-end' : 'flex-start',
                          },
                        ]}
                      />
                      <View style={styles.example}>
                        {/* The example is a usage sentence in the target language,
                            so it keeps its own LTR flow even on RTL answer cards. */}
                        <AppText
                          variant="body"
                          tone="muted"
                          className="italic"
                          style={{
                            textAlign:
                              backLong && card.back.direction === 'ltr' ? 'left' : 'center',
                          }}
                        >
                          {card.example}
                        </AppText>
                      </View>
                    </>
                  )}
                </View>
              </FaceScroll>
            </Animated.View>
          </Animated.View>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'relative',
  },
  stackLayer: {
    position: 'absolute',
    borderRadius: radii.pane,
  },
  nonInteractive: {
    pointerEvents: 'none',
  },
  stackNear: {
    left: spacing.gutter / 2 - 4,
    right: spacing.gutter / 2 - 4,
    top: spacing.row - 2,
    bottom: -9,
    backgroundColor: glass.stackNear,
  },
  stackFar: {
    left: spacing.gutter / 2 + 4,
    right: spacing.gutter / 2 + 4,
    top: spacing.section - 2,
    bottom: -17,
    backgroundColor: glass.stackFar,
  },
  card: {
    position: 'relative',
    borderRadius: radii.pane,
    padding: spacing.cardPad,
    minHeight: layout.cardMinHeight,
    ...glassFill,
    // A touch more luminance than the shared pane: this card is the only thing
    // on screen, so it has to read as a surface rather than as the background.
    backgroundColor: glass.cardFace,
    boxShadow: shadow.card,
  },
  header: {
    zIndex: 3,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 38,
  },
  sideDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.primary,
    opacity: 0.9,
  },
  sideLabelBox: {
    height: 16,
    width: 74,
    justifyContent: 'center',
  },
  sideLabel: {
    position: 'absolute',
    top: 0,
    left: 0,
    fontSize: typography.caption.fontSize,
    lineHeight: typography.caption.lineHeight,
    fontWeight: '600',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: colors.primary,
  },
  speak: {
    // 44 rather than 38: this is the one control a thumb aims at while holding
    // a phone in one hand, and the audit measured it under the 44px minimum.
    width: heights.iconLg,
    height: heights.iconLg,
    borderRadius: heights.iconLg / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: fills.control,
  },
  speakPressed: {
    opacity: 0.55,
    transform: [{ scale: 0.94 }],
  },
  flipStage: {
    flex: 1,
    position: 'relative',
    marginTop: 8,
    // Without this the browser refuses to render a 3D rotated child.
    ...(IS_WEB ? ({ transformStyle: 'preserve-3d' } as object) : {}),
  },
  scroll: {
    flex: 1,
    width: '100%',
  },
  scrollContent: {
    flexGrow: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  faceFill: {
    flex: 1,
    width: '100%',
  },
  face: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backfaceVisibility: 'hidden',
  },
  copy: {
    width: '100%',
    maxWidth: layout.cardMeasure,
  },
  // The answer reads on a slightly narrower measure than the prompt, and the
  // column itself stays centered in the pane.
  answerCopy: {
    maxWidth: layout.answerMeasure,
  },
  frontText: {
    width: '100%',
    maxWidth: layout.cardMeasure,
  },
  backText: {
    width: '100%',
    maxWidth: layout.answerMeasure,
  },
  answerRule: {
    width: 36,
    height: 1,
    marginTop: 24,
    marginBottom: 16,
    borderRadius: 1,
    backgroundColor: colors.accentLine,
  },
  example: {
    width: '100%',
    maxWidth: layout.answerMeasure,
    paddingVertical: 13,
    paddingHorizontal: spacing.gutter,
    borderRadius: radii.control,
    backgroundColor: fills.inset,
  },
});
