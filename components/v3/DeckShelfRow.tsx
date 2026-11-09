import { Animated, View } from 'react-native';
import { MaterialIcons } from '../Icon';
import { AppText } from '../AppText';
import { HintPressable } from '../HintPressable';
import { alpha, colors, iconSize, radii, stateColors } from '../../theme/tokens';
import { RowOptions } from './RowOptions';
import { Surface } from './Surface';
import { v3 } from '../../theme/v3';
import { usePressFeedback } from '../../motion';

type IconName = React.ComponentProps<typeof MaterialIcons>['name'];

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
  pinned?: boolean;
  onOptions?: () => void;
  /** An ActionMenu node, rendered instead of the built-in options control. */
  optionsMenu?: React.ReactNode;
  onPress?: () => void;
};

const NUMERIC = { fontVariant: ['tabular-nums'] as const };

/**
 * DeckShelfRow — the shelf's quiet deck card.
 *
 * The card is one compact line: a 38px glyph, a 15/20 name, one 12px meta line
 * and a 4px studied rail. The due or clear status is a single 30px circle in
 * the top-right corner; the options target sits below it. That keeps the
 * status legible at a glance without giving the card a second block of chrome.
 */
export function DeckShelfRow({
  name,
  icon,
  color,
  cardCount,
  schedulerLabel,
  due,
  progress,
  pinned = false,
  onOptions,
  optionsMenu,
  onPress,
}: DeckShelfRowProps) {
  const press = usePressFeedback({ scale: 0.985 });
  const clamped = Math.max(0, Math.min(1, progress));
  const percent = Math.round(clamped * 100);
  const cardLabel = cardCount === 1 ? 'card' : 'cards';
  const cardCountLabel = cardCount.toLocaleString('en-US');
  // Keep scheduler names such as FSRS-6 in one piece when the meta wraps.
  const scheduler = schedulerLabel.replace(/-/g, '\u2011');
  const statusLabel = due > 0 ? `${due} due` : 'all clear';
  const progressLabel = percent > 0 ? `${percent}% studied` : 'not studied yet';

  return (
    <Animated.View style={[press.style, { width: '100%' }]}>
      <Surface
        tone="pane"
        radius="card"
        padding="sm"
        style={{ width: '100%', minHeight: 92, position: 'relative' }}
      >
        <HintPressable
          hint="Open deck"
          testID="deck-row"
          onPress={onPress}
          onPressIn={press.onPressIn}
          onPressOut={press.onPressOut}
          accessibilityRole="button"
          style={{ flex: 1, minWidth: 0, paddingRight: 56 }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
            <View
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: alpha(color, 0.12),
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

              <AppText variant="caption" tone="tertiary" numberOfLines={2} style={{ marginTop: 2 }}>
                {cardCountLabel} {cardLabel} · {scheduler}
              </AppText>

              <View
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
                style={{
                  height: v3.rail.deck,
                  marginTop: 8,
                  maxWidth: 200,
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
            </View>
          </View>

          <AppText
            variant="caption"
            style={{ position: 'absolute', width: 1, height: 1, opacity: 0 }}
          >
            {progressLabel}. {statusLabel}.{pinned ? ' Pinned.' : ''}
          </AppText>
        </HintPressable>

        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 10,
            right: 10,
            width: 30,
            height: 30,
            borderRadius: radii.pill,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: due > 0 ? alpha(colors.primary, 0.14) : alpha(colors.success, 0.14),
          }}
        >

          {due > 0 ? (
            <AppText variant="caption" weight="semibold" tone="accent" style={NUMERIC}>
              {due}
            </AppText>
          ) : (
            <MaterialIcons name="check" size={iconSize.sm} color={colors.success} />
          )}
        </View>

        <View style={{ position: 'absolute', top: 42, right: 8 }}>
          {optionsMenu ??
            (onOptions && <RowOptions label={`Options for deck ${name}`} onPress={onOptions} />)}
        </View>
      </Surface>
    </Animated.View>
  );
}
