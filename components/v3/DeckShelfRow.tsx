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
 * DeckShelfRow — the mockup's deck line, measured against its classes:
 *
 *   pane radius 22 p-4, row gap-3.5; glyph tile 44/radius 12 on the deck's own
 *   colour at 15%; name 17/24 semibold with a 13px pin; meta 13 outline; the
 *   study rail is 4px tall, 200px wide at most, with the share in 12px tabular;
 *   the due tile is a radius-12 accent wash (10%) with a 28px figure over an
 *   12/600 uppercase label; options is a bare 40px glyph on a 44px target.
 *
 * One explicit row holds the glyph, the text column and the due tile, because
 * `HintPressable` stacks its children in a column — the due number is part of
 * the deck button, while options stays a sibling control.
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
  const started = clamped > 0;
  const cardLabel = cardCount === 1 ? 'card' : 'cards';

  const line = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: 12,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: alpha(color, 0.15),
          flexShrink: 0,
        }}
      >
        <MaterialIcons name={icon} size={iconSize.xl} color={color} />
      </View>

      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <AppText
            weight="semibold"
            numberOfLines={2}
            style={[v3.type.deckName, { flexShrink: 1 }]}
          >
            {name}
          </AppText>
          {pinned && <MaterialIcons name="push-pin" size={13} color={colors.outline} />}
        </View>

        <AppText variant="bodySm" tone="tertiary" numberOfLines={1} style={{ marginTop: 2 }}>
          {cardCount.toLocaleString('en-US')} {cardLabel} · {schedulerLabel}
        </AppText>

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            marginTop: 6,
            maxWidth: 200,
          }}
        >
          <View
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={{
              flex: 1,
              height: 4,
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
          <AppText variant="caption" tone="tertiary" style={NUMERIC}>
            {started ? `${percent}%` : '—'}
          </AppText>
        </View>
      </View>

      <View
        style={{
          minWidth: 44,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 10,
          paddingVertical: 4,
          borderRadius: 12,
          backgroundColor: due > 0 ? alpha(colors.primary, 0.1) : alpha(colors.success, 0.1),
          flexShrink: 0,
        }}
      >
        {due > 0 ? (
          <>
            <AppText variant="title" tone="accent" style={[v3.type.stat, NUMERIC]}>
              {due}
            </AppText>
            <AppText
              variant="caption"
              weight="semibold"
              tone="accent"
              className="uppercase"
              style={{ lineHeight: 14, letterSpacing: 0.6 }}
            >
              due
            </AppText>
          </>
        ) : (
          <>
            <MaterialIcons name="done-all" size={18} color={colors.success} />
            <AppText
              variant="caption"
              weight="semibold"
              tone="success"
              className="uppercase"
              style={{ lineHeight: 14, letterSpacing: 0.6 }}
            >
              clear
            </AppText>
          </>
        )}
      </View>
    </View>
  );

  return (
    <Animated.View style={[press.style, { width: '100%' }]}>
      <Surface tone="pane" radius="card" padding="sm" style={{ width: '100%' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <HintPressable
            hint="Open deck"
            testID="deck-row"
            onPress={onPress}
            onPressIn={press.onPressIn}
            onPressOut={press.onPressOut}
            accessibilityRole="button"
            style={{ flex: 1, minWidth: 0 }}
          >
            {line}
          </HintPressable>

          {optionsMenu ??
            (onOptions && <RowOptions label={`Options for deck ${name}`} onPress={onOptions} />)}
        </View>
      </Surface>
    </Animated.View>
  );
}
