import { useState } from 'react';
import { useWindowDimensions, View } from 'react-native';
import { MaterialIcons } from '../Icon';
import { AppText } from '../AppText';
import { HintPressable } from '../HintPressable';
import { QuietOptions } from './QuietOptions';
import { DueFigure } from './DueFigure';
import type { MenuAction } from '../menu/types';
import { colors, stateColors } from '../../theme/tokens';
import { v4 } from '../../theme/v4';

type IconName = React.ComponentProps<typeof MaterialIcons>['name'];

type DeckComposition = {
  /** Cards the queue will show as new. */
  newCount: number;
  /** Cards still in the learning or relearning steps. */
  learningCount: number;
  /** Cards back for a scheduled review. */
  reviewCount: number;
};

type DeckRowProps = {
  name: string;
  /** The deck's own colour, worn as the 3px spine. */
  color: string;
  cardCount: number;
  /** The deck's persisted scheduler, resolved by the screen. */
  schedulerLabel: string;
  due: number;
  /** Studied share, 0–1. */
  progress: number;
  /** Today's queue split; present only when the deck asks for something. */
  composition?: DeckComposition;
  pinned?: boolean;
  /** Where the deck lives, printed under the meta line in search results. */
  context?: string;
  /** Home owns the menu actions; the row owns the quiet trigger. */
  actions: MenuAction[];
  /** Drop the bottom hairline when the row closes a group. */
  last?: boolean;
  onPress: () => void;
};

const NUMERIC = { fontVariant: ['tabular-nums'] as const };

const plural = (count: number, one: string, many: string) =>
  `${count} ${count === 1 ? one : many}`;

/**
 * DeckRow — one deck in the printed index.
 *
 * A 3px spine carries the deck's colour; the body states name, size and
 * scheduler, then a 3px rail with its new / learn / review legend. The due
 * numeral is a separate serif figure at the trailing edge, and the overflow
 * trigger hides in the reserved 30px beside it. Nothing is a pane: the row is
 * separated by a warm hairline, and hover only deepens the paper.
 */
export function DeckRow({
  name,
  color,
  cardCount,
  schedulerLabel,
  due,
  progress,
  composition,
  pinned = false,
  context,
  actions,
  last = false,
  onPress,
}: DeckRowProps) {
  const { width } = useWindowDimensions();
  const wide = width >= v4.layout.wide;
  const [hovered, setHovered] = useState(false);
  const clamped = Math.max(0, Math.min(1, progress));
  const percent = Math.round(clamped * 100);
  const scheduler = schedulerLabel.replace(/-/g, '\u2011');
  const cardCountLabel = cardCount.toLocaleString('en-US');
  const cardLabel = `${cardCountLabel} ${cardCount === 1 ? 'card' : 'cards'}`;
  const hasCards = cardCount > 0;

  const segments = composition
    ? [
        { key: 'new', label: 'new', value: composition.newCount, color: stateColors.New },
        {
          key: 'learning',
          label: 'learn',
          value: composition.learningCount,
          color: stateColors.Learning,
        },
        { key: 'review', label: 'review', value: composition.reviewCount, color: stateColors.Review },
      ]
    : [];
  const composedTotal = segments.reduce((sum, segment) => sum + segment.value, 0);

  const segmentNodes = composition
    ? segments.map((segment) => (
        <View key={segment.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          <View
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={{
              width: v4.rail.dot,
              height: v4.rail.dot,
              borderRadius: v4.rail.dot / 2,
              backgroundColor: segment.color,
            }}
          />
          <AppText style={[v4.type.legend, NUMERIC, { color: colors.outline }]}>
            {`${segment.value} ${segment.label}`}
          </AppText>
        </View>
      ))
    : null;

  const percentNode = hasCards ? (
    <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
      <AppText
        testID="deck-percent"
        style={[v4.type.legend, NUMERIC, { color: colors.onSurfaceVariant, fontWeight: '600' }]}
      >
        {`${percent}%`}
      </AppText>
      <AppText testID="deck-progress-label" style={[v4.type.legend, { color: colors.outline }]}>
        studied
      </AppText>
    </View>
  ) : (
    <AppText testID="deck-progress-label" style={[v4.type.legend, { color: colors.outline }]}>
      Not studied yet
    </AppText>
  );

  return (
    <View
      style={{
        position: 'relative',
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: colors.v4Line,
        backgroundColor: hovered ? colors.v4Wash : 'transparent',
      }}
    >
      <HintPressable
        hint="Open deck"
        testID="deck-row"
        onPress={onPress}
        onHoverIn={() => setHovered(true)}
        onHoverOut={() => setHovered(false)}
        accessibilityRole="button"
        style={{
          flexDirection: 'row',
          alignItems: 'flex-start',
          gap: v4.spine.gap,
          paddingTop: v4.row.paddingTop,
          paddingBottom: v4.row.paddingBottom,
          // The quiet options target lives in this gutter; the due column adds
          // its own 14px inset so the target stops at the numeral's edge.
          paddingRight: v4.layout.optionsZone,
        }}
      >
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={{
            width: v4.spine.width,
            minHeight: v4.spine.minHeight,
            marginTop: v4.spine.marginTop,
            borderRadius: v4.spine.radius,
            backgroundColor: color,
            opacity: 0.9,
            flexShrink: 0,
          }}
        />

        <View style={{ flex: 1, minWidth: 0, maxWidth: v4.layout.deckBodyMax }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <AppText
              weight="semibold"
              numberOfLines={2}
              style={[v4.type.deckName, { flexShrink: 1 }]}
            >
              {name}
            </AppText>
            {pinned ? (
              <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                <MaterialIcons name="push-pin" size={11} color={colors.outline} />
              </View>
            ) : null}
          </View>

          <AppText
            numberOfLines={2}
            style={[v4.type.deckMeta, NUMERIC, { marginTop: 3, color: colors.outline }]}
          >
            {cardLabel} · {scheduler}
          </AppText>

          {context ? (
            <AppText
              numberOfLines={1}
              style={[v4.type.deckMeta, { marginTop: 2, color: colors.onSurfaceVariant }]}
            >
              {context}
            </AppText>
          ) : null}

          {composition && composedTotal > 0 ? (
            <View
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              style={{
                flexDirection: 'row',
                gap: v4.rail.gap,
                height: v4.rail.height,
                maxWidth: v4.layout.railMax,
                width: '100%',
                marginTop: v4.rail.marginTop,
                borderRadius: v4.rail.radius,
                backgroundColor: colors.v4Line,
                overflow: 'hidden',
              }}
            >
              {segments.map((segment) => (
                <View
                  key={segment.key}
                  style={{
                    flexGrow: segment.value,
                    flexBasis: 0,
                    backgroundColor: segment.color,
                  }}
                />
              ))}
            </View>
          ) : hasCards ? (
            <View
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              style={{
                height: v4.rail.height,
                maxWidth: v4.layout.railMax,
                width: '100%',
                marginTop: v4.rail.marginTop,
                borderRadius: v4.rail.radius,
                backgroundColor: colors.v4Line,
                overflow: 'hidden',
              }}
            >
              <View
                style={{
                  width: `${percent}%`,
                  height: '100%',
                  backgroundColor: stateColors.Review,
                }}
              />
            </View>
          ) : null}

          <View
            style={{
              marginTop: hasCards ? v4.rail.legendGap : 5,
              flexDirection: wide ? 'row' : 'column',
              alignItems: wide ? 'baseline' : 'stretch',
              flexWrap: wide ? 'wrap' : undefined,
              columnGap: 12,
              rowGap: 3,
            }}
          >
            {segmentNodes ? (
              <View
                style={{
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  alignItems: 'baseline',
                  columnGap: 12,
                  rowGap: 3,
                }}
              >
                {segmentNodes}
              </View>
            ) : null}
            <View
              style={
                wide
                  ? { marginLeft: 'auto' }
                  : hasCards
                    ? { alignSelf: 'flex-end' }
                    : undefined
              }
            >
              {percentNode}
            </View>
          </View>
        </View>

        <View style={{ marginLeft: 'auto', paddingRight: v4.layout.dueInset, flexShrink: 0 }}>
          <DueFigure
            value={due}
            kind="deck"
            testID="deck-due"
            // A deck with no cards is empty, not finished: it states that and
            // does not borrow the success wording of a caught-up deck.
            clearLabel={cardCount === 0 ? 'no cards' : 'clear'}
            labelTone={cardCount === 0 ? 'muted' : 'success'}
          />
        </View>
      </HintPressable>

      <QuietOptions
        label={`Options for deck ${name}`}
        sheetTitle={name}
        sheetSubtitle="Pinned decks stay above the others in their folder."
        actions={actions}
        testID={`deck-options-${name}`}
      />
    </View>
  );
}
