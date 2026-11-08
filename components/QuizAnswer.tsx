import { useEffect, useRef } from 'react';
import { Animated, Pressable, View } from 'react-native';
import { MaterialIcons } from './Icon';
import { AppText } from './AppText';
import { Surface } from './v3/Surface';
import { alpha, colors, iconSize, motion } from '../theme/tokens';
import { v3 } from '../theme/v3';
import { USE_NATIVE_DRIVER, prefersReducedMotion, usePressFeedback } from '../motion';

export type QuizAnswerState = 'idle' | 'correct' | 'wrong' | 'dimmed';

type QuizAnswerProps = {
  text: string;
  state?: QuizAnswerState;
  disabled?: boolean;
  onPress: () => void;
  /** Position in the grid, used for the letter chip and accessibility label. */
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
 * The pad is a 64px v3 control with a 14px radius. Its letter chip gives the
 * option a stable A–D identity independent of colour; a resolved answer adds
 * both a state wash and a check/cross, so feedback never relies on colour alone.
 * Unresolved options dim instead of disappearing, so the grid does not jump.
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
  const letter = String.fromCharCode(64 + Math.max(1, Math.min(4, position)));
  const chipColor = tint?.glyph ?? colors.outline;

  useEffect(() => {
    if (state !== 'correct' && state !== 'wrong') return;
    if (prefersReducedMotion()) return;
    // One small settle when an option resolves: enough to confirm the press,
    // never enough to bounce the grid.
    pop.setValue(0);
    Animated.sequence([
      Animated.spring(pop, { toValue: 1, speed: 40, bounciness: 0, useNativeDriver: USE_NATIVE_DRIVER }),
      Animated.spring(pop, { toValue: 0, speed: 20, bounciness: 0, useNativeDriver: USE_NATIVE_DRIVER }),
    ]).start();
  }, [state, pop]);

  return (
    <Animated.View style={[{ flex: 1 }, press.style]}>
      <Animated.View
        style={{
          flex: 1,
          transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [1, 1.02] }) }],
        }}
      >
        <Surface
          tone="control"
          radius="control"
          padding="none"
          style={{
            flex: 1,
            minHeight: v3.heights.answer,
            overflow: 'hidden',
            opacity: dimmed ? 0.4 : 1,
            ...(tint ? { backgroundColor: tint.fill } : {}),
          }}
        >
          <Pressable
            onPress={onPress}
            onPressIn={disabled ? undefined : press.onPressIn}
            onPressOut={disabled ? undefined : press.onPressOut}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityLabel={`Answer ${position}: ${text}`}
            accessibilityState={{ disabled, selected: state === 'correct' }}
            style={{
              flex: 1,
              paddingHorizontal: 12,
              paddingVertical: 10,
              justifyContent: 'center',
            }}
          >
            <View
              style={{
                flexDirection: direction === 'rtl' ? 'row-reverse' : 'row',
                alignItems: 'flex-start',
                gap: 8,
              }}
            >
              <View
                aria-hidden
                accessible={false}
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: v3.radii.control,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: alpha(chipColor, 0.14),
                }}
              >
                <AppText variant="caption" weight="semibold" style={{ color: chipColor }}>
                  {letter}
                </AppText>
              </View>
              <AppText
                variant="body"
                weight="medium"
                numberOfLines={3}
                style={[
                  { flex: 1 },
                  direction
                    ? {
                        writingDirection: direction,
                        textAlign: direction === 'rtl' ? 'right' : 'left',
                      }
                    : null,
                ]}
              >
                {text}
              </AppText>
            </View>
            {tint && (
              <View
                style={{
                  marginTop: 8,
                  flexDirection: direction === 'rtl' ? 'row-reverse' : 'row',
                  alignItems: 'center',
                  gap: 4,
                }}
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
        </Surface>
      </Animated.View>
    </Animated.View>
  );
}

/** Grid gap shared by the screen, so rows and columns stay on the 10px rhythm. */
export const QUIZ_ANSWER_GAP = 10;
/** Minimum height of one answer, used by the skeleton while questions load. */
export const QUIZ_ANSWER_MIN_HEIGHT = v3.heights.answer;
export const QUIZ_ANSWER_RADIUS = v3.radii.control;
export const QUIZ_ANSWER_DURATION = motion.fast;
