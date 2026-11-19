import { Animated, Pressable, View } from 'react-native';
import { AppText } from '../AppText';
import { BottomSheetModal, SheetScrollView } from '../BottomSheetModal';
import { MaterialIcons } from '../Icon';
import { alpha, colors, fills, heights, iconSize, radii, stateColors } from '../../theme/tokens';
import { v3 } from '../../theme/v3';
import { usePressFeedback } from '../../motion';
import { HapticsEngine } from '../../services/haptics';
import type { DeckSummary } from '../../data/library';

type IconName = React.ComponentProps<typeof MaterialIcons>['name'];

const NUMERIC = { fontVariant: ['tabular-nums'] as const };

const SPLITS = [
  { field: 'newCount', label: 'new', color: stateColors.New },
  { field: 'learningCount', label: 'learning', color: stateColors.Learning },
  { field: 'reviewCount', label: 'review', color: stateColors.Review },
] as const;

type DeckPlanRowProps = {
  entry: DeckSummary;
  selected: boolean;
  onSelect: () => void;
};

/**
 * One due deck in the plan: identity, its own queue split, and one radio.
 * The row is the control; there is no separate tap target inside it.
 */
function DeckPlanRow({ entry, selected, onSelect }: DeckPlanRowProps) {
  const press = usePressFeedback({ scale: 0.985 });
  const deckColor = entry.deck.color || colors.primary;

  return (
    <Animated.View style={press.style}>
      <Pressable
        onPress={() => {
          HapticsEngine.selection();
          onSelect();
        }}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        accessibilityRole="radio"
        accessibilityState={{ checked: selected }}
        aria-checked={selected}
        style={{
          minHeight: 72,
          paddingHorizontal: 14,
          paddingVertical: 12,
          borderRadius: radii.control,
          backgroundColor: selected ? colors.accentActive : fills.inset,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <View
          accessible={false}
          importantForAccessibility="no-hide-descendants"
          style={{
            width: 40,
            height: 40,
            borderRadius: v3.radii.tile,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: alpha(deckColor, 0.16),
            flexShrink: 0,
          }}
        >
          <MaterialIcons name={entry.deck.icon as IconName} size={iconSize.lg} color={deckColor} />
        </View>

        <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
          <AppText variant="body" weight="semibold" numberOfLines={2}>
            {entry.deck.name}
          </AppText>
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              alignItems: 'center',
              columnGap: 10,
              rowGap: 3,
            }}
          >
            {SPLITS.map((segment) => (
              <View
                key={segment.field}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}
              >
                <View
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: segment.color,
                    opacity: entry[segment.field] === 0 ? v3.state.zeroDotOpacity : 1,
                  }}
                />
                <AppText variant="caption" tone="tertiary" style={NUMERIC}>
                  {entry[segment.field]} {segment.label}
                </AppText>
              </View>
            ))}
          </View>
        </View>

        <View
          accessible={false}
          importantForAccessibility="no-hide-descendants"
          style={{ flexShrink: 0 }}
        >
          <MaterialIcons
            name={selected ? 'check-circle' : 'radio-button-unchecked'}
            size={iconSize.md}
            color={selected ? colors.primary : colors.outlineSoft}
          />
        </View>
      </Pressable>
    </Animated.View>
  );
}

type TodayPlanSheetProps = {
  visible: boolean;
  onClose: () => void;
  /** Due decks only, in the library's existing order. */
  entries: readonly DeckSummary[];
  selectedDeckId: string | null;
  onSelectDeck: (deckId: string) => void;
  desktop?: boolean;
};

/**
 * Today's plan — the deck chooser behind the hero's next-deck block.
 *
 * The list is built from the same `DeckSummary` values as the hero and the
 * shelf, so a row's total and split cannot disagree with the queue it opens.
 * Choosing a row only changes which existing deck the CTA points at; no review,
 * schedule or daily-cap state is written here.
 */
export function TodayPlanSheet({
  visible,
  onClose,
  entries,
  selectedDeckId,
  onSelectDeck,
  desktop = false,
}: TodayPlanSheetProps) {
  const totalCards = entries.reduce((sum, entry) => sum + entry.total, 0);
  const dueLabel = `${entries.length} due ${entries.length === 1 ? 'deck' : 'decks'}`;
  const subtitle = `${dueLabel} · ${totalCards} ${
    totalCards === 1 ? 'card' : 'cards'
  }. Choose the deck to start with.`;

  return (
    <BottomSheetModal
      visible={visible}
      onClose={onClose}
      title="Today's plan"
      subtitle={subtitle}
      compact
      desktopLayout={desktop}
    >
      <SheetScrollView
        style={{ maxHeight: heights.sheetTall }}
        showsVerticalScrollIndicator={false}
      >
        {entries.length > 0 ? (
          <View role="radiogroup" aria-label="Due decks" style={{ gap: 8 }}>
            {entries.map((entry) => (
              <DeckPlanRow
                key={entry.deck.id}
                entry={entry}
                selected={entry.deck.id === selectedDeckId}
                onSelect={() => onSelectDeck(entry.deck.id)}
              />
            ))}
          </View>
        ) : (
          <AppText variant="bodySm" tone="muted">
            Nothing is due right now.
          </AppText>
        )}
      </SheetScrollView>
    </BottomSheetModal>
  );
}
