import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { MaterialIcons } from '../Icon';
import { AppText } from '../AppText';
import { Surface } from './Surface';
import { alpha, colors, fills, iconSize, radii, stateColors } from '../../theme/tokens';
import { v3 } from '../../theme/v3';
import { textDirection } from '../../data/text';
import type { Flashcard } from '../../data/types';

type MemoryState = {
  stability: string;
  difficulty: string;
  retrievability: string;
};

type StudyCardProps = {
  card: Flashcard;
  showAnswer: boolean;
  stateLabel: string;
  stepLabel: string | null;
  language: string;
  languageCode: string;
  targetRetention: number;
  dueLabel: string;
  addedLabel: string;
  memoryState: MemoryState | null;
  /** The learner's own note; shown with the answer, never before it. */
  note?: string;
  /** The stage height; Study shortens it when the tray needs the room. */
  height?: number;
  onSpeak?: () => void;
  speakLabel?: string;
};

const LONG_ANSWER = 90;

/**
 * StudyCard — the session's one reading surface.
 *
 * The reference puts the scheduler state in the card, not in a page header: a
 * learning pill, the retention target, the due line and the S/D/R memory chip.
 * The prompt stays visible after reveal, while the answer and the card's real
 * example take the reading column. Nothing here invents a hint or a grammar
 * note; when the card has no example or synonym, that row is simply absent.
 */
export function StudyCard({
  card,
  showAnswer,
  stateLabel,
  stepLabel,
  language,
  languageCode,
  targetRetention,
  dueLabel,
  addedLabel,
  memoryState,
  note,
  height,
  onSpeak,
  speakLabel = 'Read card aloud',
}: StudyCardProps) {
  const stateColor =
    card.fsrs.state === 'New' ? colors.onSurfaceVariant : stateColors[card.fsrs.state];
  const answerStyle =
    card.back.text.length > LONG_ANSWER
      ? { fontSize: 26, lineHeight: 32, letterSpacing: -0.5 }
      : v3.type.composerFront;
  // A note carries the learner's own language: a Persian note stays RTL even
  // when the card's answer is German.
  const noteDirection = note ? textDirection(note) : 'ltr';
  const directionStyle = {
    textAlign: card.back.direction === 'rtl' ? ('right' as const) : ('left' as const),
    writingDirection: card.back.direction === 'rtl' ? ('rtl' as const) : ('ltr' as const),
    ...(card.back.direction === 'rtl' ? { letterSpacing: 0 } : {}),
  };

  return (
    <View style={[styles.stage, height ? { height } : null]}>
      <View style={[styles.stack, styles.stackFar]} />
      <View style={[styles.stack, styles.stackNear]} />

      <Surface testID="study-card" tone="scene" radius="card" padding="none" style={styles.card}>
        <View style={styles.inner}>
          <View style={styles.topRow}>
            <View
              style={[
                styles.statePill,
                {
                  backgroundColor: alpha(stateColor, 0.12),
                  borderColor: alpha(stateColor, 0.22),
                },
              ]}
            >
              <View style={[styles.stateDot, { backgroundColor: stateColor }]} />
              <AppText
                variant="label"
                weight="semibold"
                numberOfLines={1}
                style={{ color: stateColor, letterSpacing: 0.7, flexShrink: 1 }}
              >
                {stateLabel.toUpperCase()}
                {stepLabel ? ` · ${stepLabel.toUpperCase()}` : ''}
              </AppText>
            </View>

            {onSpeak ? (
              <Pressable
                onPress={onSpeak}
                accessibilityRole="button"
                accessibilityLabel={`${speakLabel} ${languageCode}`}
                hitSlop={6}
                style={({ pressed }) => [
                  styles.speak,
                  { opacity: pressed ? 0.68 : 1 },
                ]}
              >
                <MaterialIcons name="volume-up" size={iconSize.md} color={colors.primary} />
                <AppText variant="label" weight="semibold" tone="accent">
                  {languageCode}
                </AppText>
              </Pressable>
            ) : null}
          </View>

          <View style={styles.metaRow}>
            <AppText variant="caption" tone="muted">
              Target {targetRetention}%
            </AppText>
            <AppText variant="caption" tone="tertiary">
              ·
            </AppText>
            <AppText variant="caption" tone="muted">
              {dueLabel}
            </AppText>
            {memoryState ? (
              <View style={styles.memoryChip}>
                <MaterialIcons name="memory" size={iconSize.xs} color={colors.outline} />
                <AppText
                  variant="caption"
                  tone="muted"
                  numberOfLines={1}
                  style={{ fontVariant: ['tabular-nums'] }}
                >
                  S {memoryState.stability} · D {memoryState.difficulty} · R{' '}
                  {memoryState.retrievability}
                </AppText>
              </View>
            ) : null}
          </View>

          <ScrollView
            style={styles.bodyScroll}
            contentContainerStyle={styles.bodyContent}
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            <View style={[styles.body, showAnswer ? styles.bodyAnswer : null]}>
              <AppText
                variant="label"
                weight="semibold"
                tone="muted"
                className="uppercase"
                style={{ letterSpacing: 1.1 }}
              >
                {language}
              </AppText>

              {showAnswer ? (
                <>
                  <AppText
                    variant="bodyLg"
                    tone="muted"
                    style={[
                      styles.promptReference,
                      {
                        textAlign:
                          card.front.direction === 'rtl' ? ('right' as const) : ('left' as const),
                        writingDirection:
                          card.front.direction === 'rtl' ? ('rtl' as const) : ('ltr' as const),
                      },
                    ]}
                  >
                    {card.front.text}
                  </AppText>

                  <AppText
                    variant="title"
                    weight="bold"
                    tone="accent"
                    language={card.back.direction === 'rtl' ? 'fa' : undefined}
                    style={[styles.answer, answerStyle, directionStyle]}
                  >
                    {card.back.text}
                  </AppText>

                  {note ? (
                    <Surface
                      tone="inset"
                      radius="control"
                      padding="sm"
                      style={styles.note}
                    >
                      <View style={styles.noteLabel}>
                        <MaterialIcons
                          name="sticky-note-2"
                          size={iconSize.sm}
                          color={colors.primary}
                        />
                        <AppText
                          variant="label"
                          weight="semibold"
                          tone="muted"
                          className="uppercase"
                        >
                          Note
                        </AppText>
                      </View>
                      <AppText
                        variant="bodySm"
                        style={[
                          styles.noteText,
                          {
                            textAlign: noteDirection === 'rtl' ? 'right' : 'left',
                            writingDirection: noteDirection,
                          },
                        ]}
                      >
                        {note}
                      </AppText>
                    </Surface>
                  ) : null}

                  {card.synonyms ? (
                    <AppText variant="bodySm" tone="muted" style={{ marginTop: 8 }}>
                      Also: {card.synonyms}
                    </AppText>
                  ) : null}

                  {card.example ? (
                    <Surface
                      tone="inset"
                      radius="control"
                      padding="sm"
                      style={styles.example}
                    >
                      <View style={styles.exampleRow}>
                        <MaterialIcons
                          name="format-quote"
                          size={iconSize.md}
                          color={colors.primary}
                        />
                        <AppText
                          variant="body"
                          tone="muted"
                          className="italic"
                          style={styles.exampleText}
                        >
                          {card.example}
                        </AppText>
                      </View>
                    </Surface>
                  ) : null}
                </>
              ) : (
                <AppText
                  variant="title"
                  weight="bold"
                  language={card.front.direction === 'rtl' ? 'fa' : undefined}
                  style={[
                    styles.answer,
                    v3.type.composerFront,
                    {
                      textAlign:
                        card.front.direction === 'rtl' ? ('right' as const) : ('left' as const),
                      writingDirection:
                        card.front.direction === 'rtl' ? ('rtl' as const) : ('ltr' as const),
                    },
                  ]}
                >
                  {card.front.text}
                </AppText>
              )}
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <View style={styles.footerMeta}>
              <MaterialIcons name="schedule" size={iconSize.xs} color={colors.outline} />
              <AppText variant="caption" tone="muted">
                {addedLabel}
              </AppText>
            </View>
            <AppText variant="caption" tone="tertiary">
              {showAnswer ? 'Rate below' : 'Reveal to rate'}
            </AppText>
          </View>
        </View>
      </Surface>
    </View>
  );
}

const styles = StyleSheet.create({
  stage: {
    width: '100%',
    maxWidth: v3.layout.studyCard,
    height: 460,
    alignSelf: 'center',
    position: 'relative',
    justifyContent: 'flex-end',
    paddingBottom: 8,
  },
  stack: {
    position: 'absolute',
    borderRadius: v3.radii.card,
  },
  stackNear: {
    left: 8,
    right: 8,
    bottom: 2,
    height: 24,
    backgroundColor: colors.surfaceContainerLow,
  },
  stackFar: {
    left: 16,
    right: 16,
    bottom: -4,
    height: 20,
    backgroundColor: colors.surfaceContainerLowest,
    opacity: 0.8,
  },
  card: {
    flex: 1,
    minHeight: 420,
    overflow: 'hidden',
  },
  inner: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 14,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  statePill: {
    minHeight: 28,
    maxWidth: '75%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: radii.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  stateDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  speak: {
    minHeight: 44,
    minWidth: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    borderRadius: radii.pill,
    backgroundColor: fills.control,
    paddingHorizontal: 10,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
    marginTop: 14,
  },
  memoryChip: {
    minHeight: 24,
    maxWidth: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: 'auto',
    borderRadius: radii.micro,
    backgroundColor: fills.control,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  bodyScroll: {
    flex: 1,
    marginTop: 14,
  },
  bodyContent: {
    flexGrow: 1,
    paddingBottom: 8,
  },
  body: {
    flex: 1,
    justifyContent: 'center',
  },
  bodyAnswer: {
    justifyContent: 'flex-start',
    paddingTop: 6,
  },
  promptReference: {
    marginTop: 8,
  },
  answer: {
    marginTop: 8,
    width: '100%',
  },
  note: {
    marginTop: 14,
  },
  noteLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  noteText: {
    marginTop: 4,
  },
  example: {
    marginTop: 18,
  },
  exampleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  exampleText: {
    flex: 1,
    minWidth: 0,
  },
  footer: {
    minHeight: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingTop: 8,
  },
  footerMeta: {
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
});
