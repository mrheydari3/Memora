import { useEffect, useRef } from 'react';
import { Animated, Pressable, View } from 'react-native';
import { MaterialIcons } from './Icon';
import { AppText } from './AppText';
import { alpha, colors, fills, heights, iconSize, motion, radii } from '../theme/tokens';
import { USE_NATIVE_DRIVER, prefersReducedMotion, usePressFeedback } from '../motion';

export type QuizAnswerState = 'idle' | 'correct' | 'wrong' | 'dimmed';

type QuizAnswerProps = {
  text: string;
  state?: QuizAnswerState;
  disabled?: boolean;
  onPress: () => void;
  /** Position in the grid, used only for the accessibility label. */
  position: number;
  /** The option's own script direction, so Persian answers align right. */
  direction?: 'ltr' | 'rtl';
};

const TINT: Record<Exclude<QuizAnswerState, 'idle' | 'dimmed'>, { fill: string; glyph: string }> = {
  correct: { fill: alpha(colors.success, 0.16), glyph: colors.success },
  wrong: { fill: alpha(colors.error, 0.16), glyph: colors.error },
};

/**
 * QuizAnswer — one option in the 2×2 answer grid.
 *
 * Feedback never relies on colour alone: the resolved option also carries a
 * check or a cross, and its accessibility label says whether it was right.
 * Unresolved options dim instead of disappearing, so the grid does not jump.
 * Another option is never outlined: the winner is a tinted fill plus its glyph.
 *
 * The option dips when pressed and gives one small spring when it resolves, so
 * the answer you chose visibly acknowledges the choice.
 */
export function QuizAnswer({
  text,
  state = 'idle',
  disabled = false,
  onPress,
  position,
  direction,
}: QuizAnswerProps) {
  const press = usePressFeedback({ scale: 0.965 });
  const pop = useRef(new Animated.Value(0)).current;
  const tint = state === 'correct' || state === 'wrong' ? TINT[state] : null;
  const dimmed = state === 'dimmed';

  useEffect(() => {
    if (state !== 'correct' && state !== 'wrong') return;
    if (prefersReducedMotion()) return;
    pop.setValue(0);
    Animated.sequence([
      Animated.spring(pop, { toValue: 1, ...motion.spring, useNativeDriver: USE_NATIVE_DRIVER }),
      Animated.spring(pop, { toValue: 0, ...motion.spring, useNativeDriver: USE_NATIVE_DRIVER }),
    ]).start();
  }, [state, pop]);

  return (
    <Animated.View style={[{ flex: 1 }, press.style]}>
      <Animated.View
        style={{
          flex: 1,
          transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [1, 1.035] }) }],
        }}
      >
        <Pressable
          className="flex-1 justify-between rounded-xl px-4 py-3"
          style={{
            minHeight: heights.quizAnswer,
            backgroundColor: tint?.fill ?? fills.tile,
            opacity: dimmed ? 0.4 : 1,
          }}
          onPress={onPress}
          onPressIn={disabled ? undefined : press.onPressIn}
          onPressOut={disabled ? undefined : press.onPressOut}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityLabel={`Answer ${position}: ${text}`}
          accessibilityState={{ disabled, selected: state === 'correct' }}
        >
          <AppText
            variant="body"
            weight="medium"
            numberOfLines={3}
            style={
              direction
                ? {
                    writingDirection: direction,
                    textAlign: direction === 'rtl' ? 'right' : 'left',
                  }
                : undefined
            }
          >
            {text}
          </AppText>
          {tint && (
            <View
              className="mt-2 flex-row items-center gap-1"
              style={{ justifyContent: direction === 'rtl' ? 'flex-end' : 'flex-start' }}
            >
              <MaterialIcons
                name={state === 'correct' ? 'check-circle' : 'cancel'}
                size={iconSize.sm}
                color={tint.glyph}
              />
              <AppText variant="caption" tone={state === 'correct' ? 'success' : 'danger'}>
                {state === 'correct' ? 'Correct' : 'Not quite'}
              </AppText>
            </View>
          )}
        </Pressable>
      </Animated.View>
    </Animated.View>
  );
}

/** Grid gap shared by the screen, so rows and columns stay on the 10px rhythm. */
export const QUIZ_ANSWER_GAP = 10;
/** Minimum height of one answer, used by the skeleton while questions load. */
export const QUIZ_ANSWER_MIN_HEIGHT = heights.quizAnswer;
export const QUIZ_ANSWER_RADIUS = radii.pane;
export const QUIZ_ANSWER_DURATION = motion.fast;
