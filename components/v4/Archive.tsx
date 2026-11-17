import { useState } from 'react';
import { Platform, View } from 'react-native';
import { MaterialIcons } from '../Icon';
import { AppText } from '../AppText';
import { HintPressable } from '../HintPressable';
import { QuietOptions } from './QuietOptions';
import type { MenuAction } from '../menu/types';
import type { Deck } from '../../data/types';
import { colors } from '../../theme/tokens';
import { v4 } from '../../theme/v4';

type ArchiveProps = {
  entries: { deck: Deck; cards: number }[];
  /** Home owns the menu actions; the archived row owns the quiet trigger. */
  actions: (deck: Deck) => MenuAction[];
  onOpenDeck: (id: string) => void;
};

const plural = (count: number, one: string, many: string) =>
  `${count} ${count === 1 ? one : many}`;

/**
 * Archive — the retired-deck drawer.
 *
 * At the root only, under one strong hairline: a quiet line that opens a flat
 * list of archived decks. A retired deck draws its spine at half strength, keeps
 * its name and card count, and carries the same quiet overflow control as a
 * live row. It never prints a due figure; it cannot ask for anything.
 */
export function Archive({ entries, actions, onOpenDeck }: ArchiveProps) {
  const [open, setOpen] = useState(false);
  const webExpanded: object = Platform.OS === 'web' ? { 'aria-expanded': open } : {};

  return (
    <View style={{ marginTop: v4.layout.archiveGap }}>
      <HintPressable
        hint={open ? 'Collapse archived decks' : 'Expand archived decks'}
        onPress={() => setOpen((next) => !next)}
        testID="archive-toggle"
        accessibilityRole="button"
        accessibilityLabel={`Archived decks, ${entries.length}`}
        accessibilityState={{ expanded: open }}
        {...webExpanded}
        style={{
          minHeight: 44,
          flexDirection: 'row',
          alignItems: 'center',
          gap: v4.archive.gap,
          paddingVertical: v4.archive.padding,
          paddingRight: 2,
          borderTopWidth: 1,
          borderTopColor: colors.v4LineStrong,
        }}
      >
        <MaterialIcons name="inventory-2" size={15} color={colors.outline} />
        <AppText
          numberOfLines={1}
          style={[v4.type.control, { color: colors.onSurfaceVariant, fontWeight: '500' }]}
        >
          Archived
        </AppText>
        <AppText
          numberOfLines={1}
          style={[v4.type.folderMeta, { color: colors.outline, fontVariant: ['tabular-nums'] }]}
        >
          {plural(entries.length, 'deck', 'decks')}
        </AppText>
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={{
            marginLeft: 'auto',
            transform: [{ rotate: open ? '0deg' : '-90deg' }],
          }}
        >
          <MaterialIcons name="expand-more" size={15} color={colors.outline} />
        </View>
      </HintPressable>

      {open ? (
        <View testID="archive-list">
          {entries.map(({ deck, cards }, index) => (
            <View
              key={deck.id}
              testID="archived-deck-row"
              style={{
                position: 'relative',
                borderBottomWidth: index === entries.length - 1 ? 0 : 1,
                borderBottomColor: colors.v4Line,
              }}
            >
              <HintPressable
                hint="Open deck"
                onPress={() => onOpenDeck(deck.id)}
                accessibilityRole="button"
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: v4.spine.gap,
                  paddingVertical: 14,
                  paddingRight: v4.layout.optionsZone,
                }}
              >
                <View
                  accessibilityElementsHidden
                  importantForAccessibility="no-hide-descendants"
                  style={{
                    width: v4.spine.width,
                    minHeight: 34,
                    borderRadius: v4.spine.radius,
                    backgroundColor: deck.color,
                    opacity: 0.45,
                    flexShrink: 0,
                  }}
                />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <AppText
                    weight="medium"
                    tone="muted"
                    numberOfLines={1}
                    style={{ fontSize: 15, lineHeight: 20 }}
                  >
                    {deck.name}
                  </AppText>
                  <AppText
                    numberOfLines={1}
                    style={[v4.type.folderMeta, { marginTop: 2, color: colors.outline }]}
                  >
                    {plural(cards, 'card', 'cards')}
                  </AppText>
                </View>
              </HintPressable>

              <QuietOptions
                label={`Options for deck ${deck.name}`}
                sheetTitle={deck.name}
                sheetSubtitle="Pinned decks stay above the others in their folder."
                actions={actions(deck)}
                testID={`archive-options-${deck.name}`}
              />
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}
