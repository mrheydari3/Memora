import { ScrollView, View } from 'react-native';
import { MaterialIcons } from './Icon';
import { GlassCard } from './GlassCard';
import { AppText } from './AppText';
import { Button } from './Button';
import { Chip } from './Chip';
import { Pill } from './Pill';
import { colors, heights, iconSize } from '../theme/tokens';

export type QuizDeckOption = {
  id: string;
  name: string;
  due: number;
};

type QuizStartCardProps = {
  /** Only decks that can build four distinct options are passed in. */
  decks: QuizDeckOption[];
  selectedDeckId: string | null;
  onSelectDeck: (deckId: string) => void;
  onPlay: () => void;
  /** The selected deck's stored best score, when it has one. */
  bestScore?: number;
  className?: string;
};

/**
 * QuizStartCard — the game's launch pane on the Game tab.
 *
 * One accent pane, one action: pick a playable deck, then play a 60-second
 * round. The best score is the only progress it shows, because it is the only
 * number the game itself keeps.
 */
export function QuizStartCard({
  decks,
  selectedDeckId,
  onSelectDeck,
  onPlay,
  bestScore,
  className = '',
}: QuizStartCardProps) {
  const playable = decks.length > 0;

  return (
    <GlassCard tone="accent" className={className}>
      <View className="flex-row items-start justify-between">
        <View className="flex-1 pr-3">
          <AppText variant="label" weight="semibold" tone="accent" className="uppercase">
            Quiz · 60 seconds
          </AppText>
          <AppText variant="headline" className="mt-1">
            Beat the clock
          </AppText>
        </View>
        <View
          className="items-center justify-center rounded-full"
          style={{
            width: heights.tileLg,
            height: heights.tileLg,
            backgroundColor: colors.accentFaint,
          }}
        >
          <MaterialIcons name="bolt" size={iconSize.lg} color={colors.primary} />
        </View>
      </View>

      <AppText variant="bodySm" tone="muted" className="mt-2">
        Four choices per card. Right answers buy time, and a streak multiplies the score.
      </AppText>

      {bestScore !== undefined && bestScore > 0 && (
        <View className="mt-3 flex-row">
          <Pill label={`Best ${bestScore.toLocaleString('en-US')}`} tone="accent" />
        </View>
      )}

      {playable ? (
        <>
          {/* Keyboard-scrollable: the deck picker is otherwise unreachable
              without a pointer (axe: scrollable-region-focusable). */}
          <ScrollView
            horizontal
            focusable
            showsHorizontalScrollIndicator={false}
            className="mt-4"
            contentContainerStyle={{ gap: 8 }}
          >
            {decks.map((deck) => (
              <Chip
                key={deck.id}
                label={deck.name}
                variant="select"
                active={deck.id === selectedDeckId}
                onPress={() => onSelectDeck(deck.id)}
              />
            ))}
          </ScrollView>

          <Button
            className="mt-4"
            label="Play"
            icon="play-arrow"
            onPress={onPlay}
            disabled={!selectedDeckId}
          />
        </>
      ) : (
        <AppText variant="bodySm" tone="muted" className="mt-4">
          Add at least four cards with both sides filled in to unlock the quiz.
        </AppText>
      )}
    </GlassCard>
  );
}
