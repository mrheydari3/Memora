import { AppText } from '../AppText';
import { HeroPane } from '../HeroPane';
import { ActionButton } from '../v3/ActionButton';
import { TodayRail } from './TodayRail';
import { stateColors } from '../../theme/tokens';

type TodayHeroProps = {
  /** Cards waiting today across the whole library. */
  due: number;
  /** How many decks those cards belong to. */
  deckCount: number;
  /** Rough session length, in minutes. */
  minutes: number;
  /** The next deck's own new / learning / review split. */
  newCount: number;
  learningCount: number;
  reviewCount: number;
  /** The deck the session will open first. */
  nextDeck: string;
  /** The real action: Start session, Continue, or Nothing due today. */
  label: string;
  disabled?: boolean;
  onStart: () => void;
};

/**
 * TodayHero — the day and its one action, in a single glass pane.
 *
 * The content is `HeroPane`'s shared anatomy, so the day label is the page's h1
 * and the due count is the only display-sized element. What stays here is what
 * today is about: the session length in the context line, the action, the next
 * deck as one quiet note and the day's New/Learning/Review rail.
 */
export function TodayHero({
  due,
  deckCount,
  minutes,
  newCount,
  learningCount,
  reviewCount,
  nextDeck,
  label,
  disabled = false,
  onStart,
}: TodayHeroProps) {
  const date = new Date().toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });

  return (
    <HeroPane
      stage
      testID="today-panel"
      bodyTestID="today-panel-body"
      headingLevel={1}
      eyebrow={`Today · ${date}`}
      value={due}
      unit="cards due"
      valueLabel={`${due} cards due today`}
      context={
        due > 0
          ? `Across ${deckCount} ${deckCount === 1 ? 'deck' : 'decks'} · about ${minutes} minutes`
          : 'Nothing waiting — you are all caught up'
      }
      action={<ActionButton label={label} disabled={disabled} onPress={onStart} />}
      actionMaxWidth={360}
      note={
        <AppText variant="caption" tone="muted">
          Next up · {nextDeck}
        </AppText>
      }
      rail={
        due > 0 ? (
          <TodayRail
            segments={[
              { label: 'New', value: newCount, color: stateColors.New },
              { label: 'Learning', value: learningCount, color: stateColors.Learning },
              { label: 'Review', value: reviewCount, color: stateColors.Review },
            ]}
          />
        ) : undefined
      }
    />
  );
}
