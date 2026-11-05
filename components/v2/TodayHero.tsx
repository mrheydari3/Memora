import { View } from 'react-native';
import { AppText } from '../AppText';
import { StartButton } from './StartButton';
import { TodayRail } from './TodayRail';
import { alpha, colors, glassFill, rims, stateColors } from '../../theme/tokens';
import { v2 } from '../../theme/v2';

type TodayHeroProps = {
  /** Cards waiting today across the whole library. */
  due: number;
  /** How many decks those cards belong to. */
  deckCount: number;
  /** Rough session length, in minutes. */
  minutes: number;
  /** The queue's new / learning / review split. */
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
 * The pane is the app's ink fill with a 6% accent wash and a lit rim at its top
 * and bottom edges, so it reads as glass over the canvas without becoming the
 * saturated blue card v1 used. Inside it the day label is the page's h1 and the
 * due count is the only display-sized element; the action sits under the number,
 * next deck is one quiet caption, and the day's split closes the pane.
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
    <View
      testID="today-panel"
      style={[
        glassFill,
        {
          borderRadius: v2.radii.pane,
          borderTopWidth: 1,
          borderTopColor: rims.soft,
          borderBottomWidth: 1,
          borderBottomColor: colors.outlineVariant,
          overflow: 'hidden',
        },
      ]}
    >
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: alpha(colors.primary, 0.06),
        }}
      />

      <View testID="today-panel-body" style={{ padding: v2.spacing.panel }}>
        <AppText
          variant="caption"
          weight="semibold"
          tone="accent"
          className="uppercase"
          headingLevel={1}
        >
          Today · {date}
        </AppText>

        <View
          className="flex-row flex-wrap items-end"
          style={{ columnGap: 12, rowGap: 2, marginTop: 2 }}
        >
          <AppText
            variant="display"
            style={v2.type.display}
            accessibilityLabel={`${due} cards due today`}
          >
            {due}
          </AppText>
          <AppText variant="bodyLg" tone="muted" style={{ paddingBottom: 9 }}>
            cards due
          </AppText>
        </View>

        <AppText variant="body" tone="muted" className="mt-1">
          {due > 0
            ? `Across ${deckCount} ${deckCount === 1 ? 'deck' : 'decks'} · about ${minutes} minutes`
            : 'Nothing waiting — you are all caught up'}
        </AppText>

        <View className="mt-5" style={{ maxWidth: 360 }}>
          <StartButton label={label} disabled={disabled} onPress={onStart} />
        </View>

        <AppText variant="caption" tone="muted" className="mt-3">
          Next up · {nextDeck}
        </AppText>

        {due > 0 && (
          <View className="mt-4">
            <TodayRail
              segments={[
                { label: 'New', value: newCount, color: stateColors.New },
                { label: 'Learning', value: learningCount, color: stateColors.Learning },
                { label: 'Review', value: reviewCount, color: stateColors.Review },
              ]}
            />
          </View>
        )}
      </View>
    </View>
  );
}
