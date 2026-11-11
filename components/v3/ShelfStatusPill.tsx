import { StyleSheet, View } from 'react-native';
import { MaterialIcons } from '../Icon';
import { AppText } from '../AppText';
import { alpha, colors, fills, iconSize, radii } from '../../theme/tokens';

type ShelfStatusPillProps = {
  /** Cards waiting in this deck or folder subtree. */
  due: number;
  /** Nothing inside at all: a folder with no decks, a deck with no cards. */
  empty?: boolean;
  /**
   * The word for that state. A folder says "empty"; a deck with no cards says
   * "no cards". Both are neutral, and neither borrows the success mark of a
   * deck that has actually been finished.
   */
  emptyLabel?: string;
  /**
   * Render the figure and its label as separate text nodes. The shelf's deck
   * cards key their due figure separately from the word "due", so a reader can
   * ask for the number on its own.
   */
  split?: boolean;
};

const NUMERIC = { fontVariant: ['tabular-nums'] as const };

/**
 * ShelfStatusPill — the shelf's one status mark.
 *
 * A deck card and a folder tile both answer "what is waiting here?" with the
 * same 24px pill: accent for work waiting, success for clear, and a neutral
 * label for something that holds nothing. Empty is not clear: a deck with no
 * cards has never been studied and has nothing to finish.
 *
 * It is deliberately a pill and not a second tile: the name and the studied
 * rail are the card, the status only annotates it.
 */
export function ShelfStatusPill({
  due,
  empty = false,
  emptyLabel = 'empty',
  split = false,
}: ShelfStatusPillProps) {
  if (empty) {
    return (
      <View style={[styles.pill, { backgroundColor: fills.inset }]}>
        <AppText variant="caption" weight="semibold" tone="tertiary">
          {emptyLabel}
        </AppText>
      </View>
    );
  }

  if (due <= 0) {
    return (
      <View style={[styles.pill, { backgroundColor: alpha(colors.success, 0.12) }]}>
        <MaterialIcons name="check" size={iconSize.xs} color={colors.success} />
        <AppText variant="caption" weight="semibold" tone="success">
          clear
        </AppText>
      </View>
    );
  }

  return (
    <View style={[styles.pill, { backgroundColor: alpha(colors.primary, 0.12) }]}>
      {split ? (
        <>
          <AppText variant="caption" weight="semibold" tone="accent" style={NUMERIC}>
            {due}
          </AppText>
          <AppText variant="caption" weight="semibold" tone="accent">
            due
          </AppText>
        </>
      ) : (
        <AppText variant="caption" weight="semibold" tone="accent" style={NUMERIC}>
          {`${due} due`}
        </AppText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    minHeight: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 9,
    borderRadius: radii.pill,
    flexShrink: 0,
  },
});
