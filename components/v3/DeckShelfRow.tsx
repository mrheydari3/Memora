import { useState } from 'react';
import { Animated, View } from 'react-native';
import { MaterialIcons } from '../Icon';
import { AppText } from '../AppText';
import { HintPressable } from '../HintPressable';
import { alpha, colors, fills, iconSize, radii, stateColors } from '../../theme/tokens';
import { RowOptions } from './RowOptions';
import { ShelfStatusPill } from './ShelfStatusPill';
import { Surface } from './Surface';
import { v3 } from '../../theme/v3';
import { usePressFeedback } from '../../motion';

type IconName = React.ComponentProps<typeof MaterialIcons>['name'];

type DeckComposition = {
  /** Cards the queue will show as new. */
  newCount: number;
  /** Cards still in the learning or relearning steps. */
  learningCount: number;
  /** Cards back for a scheduled review. */
  reviewCount: number;
};

type DeckShelfRowProps = {
  name: string;
  icon: IconName;
  /** The deck's own colour, washed into its tile. */
  color: string;
  cardCount: number;
  /** The deck's persisted scheduler, resolved by the screen. */
  schedulerLabel: string;
  due: number;
  /** Studied share, 0–1. */
  progress: number;
  /**
   * Today's queue split. A deck that lives loose on the shelf wears this
   * segmented rail instead of the studied one; a deck that asks for nothing
   * today keeps the studied rail, so the card always states something true.
   */
  composition?: DeckComposition;
  /** Nested in a folder's well: a flat row, not its own pane. */
  flat?: boolean;
  pinned?: boolean;
  /** Where the deck lives, printed under the meta line in search results. */
  context?: string;
  onOptions?: () => void;
  /** An ActionMenu node, rendered instead of the built-in options control. */
  optionsMenu?: React.ReactNode;
  onPress?: () => void;
};

const NUMERIC = { fontVariant: ['tabular-nums'] as const };
const GLYPH = 36;
/** The options target beside the card; the rail keeps its line above it. */
const OPTIONS_RAIL = 44;

/**
 * DeckShelfRow — the shelf's deck card.
 *
 * The design gives a deck one line of identity and one line of evidence: the
 * 36px glyph, the name and its scheduler, then the due pill at the trailing
 * edge with the options target beside it. Under them sits one rail: the queue's
 * new / learning / review split for a loose deck with work today, otherwise the
 * studied share with its percentage spelled out. Nothing draws a frame, a spine
 * or a second accent — the tile carries the deck's colour and the rail carries
 * its numbers.
 */
export function DeckShelfRow({
  name,
  icon,
  color,
  cardCount,
  schedulerLabel,
  due,
  progress,
  composition,
  flat = false,
  pinned = false,
  context,
  onOptions,
  optionsMenu,
  onPress,
}: DeckShelfRowProps) {
  const press = usePressFeedback({ scale: 0.985 });
  const [hovered, setHovered] = useState(false);
  const clamped = Math.max(0, Math.min(1, progress));
  const percent = Math.round(clamped * 100);
  const cardLabel = cardCount === 1 ? 'card' : 'cards';
  const cardCountLabel = cardCount.toLocaleString('en-US');
  // Keep scheduler names such as FSRS-6 in one piece when the meta wraps.
  const scheduler = schedulerLabel.replace(/-/g, '\u2011');

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

  // The card is named by its own contents, never by a parallel aria-label.
  // axe's label-content-name check compares the visible run — separators and
  // the non-breaking scheduler hyphen included — with the accessible name, and a
  // hand-written description drifts the moment a line changes. HintPressable
  // still supplies "Open deck" through aria-describedby.

  // The percentage stays its own text node: the shelf's data tests read the
  // exact share off the card, and screen readers benefit from a number that is
  // not glued to a word.
  const percentNode = (
    <AppText
      variant="caption"
      weight="semibold"
      tone={percent > 0 ? 'accent' : 'tertiary'}
      style={[NUMERIC, { minWidth: 26, textAlign: 'right' }]}
    >
      {percent === 0 ? '—' : `${percent}%`}
    </AppText>
  );

  const rail = composition ? (
    <View style={{ marginTop: 10, gap: 7 }}>
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{
          flexDirection: 'row',
          gap: 2,
          height: v3.rail.composition,
          borderRadius: radii.pill,
          backgroundColor: colors.surfaceControl,
          overflow: 'hidden',
        }}
      >
        {segments.map((segment) => (
          <View
            key={segment.key}
            style={{
              flex: composedTotal > 0 ? segment.value : 1,
              backgroundColor: composedTotal > 0 ? segment.color : 'transparent',
            }}
          />
        ))}
      </View>

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            flexWrap: 'wrap',
            columnGap: 10,
            rowGap: 2,
            flexShrink: 1,
            minWidth: 0,
          }}
        >
          {segments.map((segment) => (
            <View
              key={segment.key}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}
            >
              <View
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: segment.color,
                }}
              />
              <AppText variant="caption" tone="tertiary" style={NUMERIC}>
                {`${segment.value} ${segment.label}`}
              </AppText>
            </View>
          ))}
        </View>
        {percentNode}
      </View>
    </View>
  ) : (
    <View style={{ marginTop: 10, gap: 6 }}>
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{
          height: v3.rail.deck,
          borderRadius: radii.pill,
          backgroundColor: colors.surfaceControl,
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
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 5 }}>
        {percentNode}
        <AppText variant="caption" tone="tertiary">
          {percent === 0
            ? cardCount === 0
              ? 'no cards yet'
              : 'not studied yet'
            : 'mastered'}
        </AppText>
      </View>
    </View>
  );

  const content = (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
      <HintPressable
        hint="Open deck"
        testID="deck-row"
        onPress={onPress}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        onHoverIn={() => setHovered(true)}
        onHoverOut={() => setHovered(false)}
        accessibilityRole="button"
        style={{
          flex: 1,
          minWidth: 0,
          paddingLeft: 12,
          paddingRight: 2,
          paddingVertical: 11,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 11 }}>
          <View
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={{
              width: GLYPH,
              height: GLYPH,
              borderRadius: v3.radii.tile,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: alpha(color, 0.14),
              flexShrink: 0,
            }}
          >
            <MaterialIcons name={icon} size={iconSize.lg} color={color} />
          </View>

          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <AppText
                weight="semibold"
                numberOfLines={2}
                style={[v3.type.deckTitle, { flexShrink: 1 }]}
              >
                {name}
              </AppText>
              {pinned && (
                <View
                  accessibilityElementsHidden
                  importantForAccessibility="no-hide-descendants"
                >
                  <MaterialIcons name="push-pin" size={iconSize.xs} color={colors.outline} />
                </View>
              )}
            </View>

            {/* One meta line, one status mark. The due pill lives here — never
                in the title row — so at 320px or 200% text it wraps under the
                count instead of narrowing the name. */}
            <View
              style={{
                marginTop: 4,
                flexDirection: 'row',
                alignItems: 'center',
                flexWrap: 'wrap',
                columnGap: 10,
                rowGap: 4,
              }}
            >
              <AppText
                variant="caption"
                tone="tertiary"
                numberOfLines={2}
                style={{ flexShrink: 1, minWidth: 0 }}
              >
                {cardCountLabel} {cardLabel} · {scheduler}
              </AppText>
              <View style={{ marginLeft: 'auto' }}>
                <ShelfStatusPill
                  due={due}
                  empty={cardCount === 0}
                  emptyLabel="no cards"
                  split
                />
              </View>

              {context ? (
                <AppText
                  variant="caption"
                  tone="tertiary"
                  numberOfLines={1}
                  style={{ width: '100%' }}
                >
                  {context}
                </AppText>
              ) : null}
            </View>
          </View>
        </View>

        {rail}
      </HintPressable>

      <View style={{ width: OPTIONS_RAIL, paddingTop: 8, alignItems: 'center', flexShrink: 0 }}>
        {optionsMenu ??
          (onOptions && (
            <RowOptions label={`Options for deck ${name}`} onPress={onOptions} />
          ))}
      </View>
    </View>
  );

  const hoverWash = hovered ? (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
        backgroundColor: fills.subtle,
      }}
    />
  ) : null;

  return (
    <Animated.View style={[press.style, { width: '100%' }]}>
      {flat ? (
        <View
          style={{
            width: '100%',
            minHeight: v3.heights.deckRow,
            borderRadius: radii.control,
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          {hoverWash}
          {content}
        </View>
      ) : (
        <Surface
          tone="pane"
          radius="card"
          padding="none"
          style={{
            width: '100%',
            minHeight: v3.heights.deckRow,
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          {hoverWash}
          {content}
        </Surface>
      )}
    </Animated.View>
  );
}
