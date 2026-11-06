import { Animated, Pressable, View } from 'react-native';
import { MaterialIcons } from '../Icon';
import { AppText } from '../AppText';
import { GlassCard } from '../GlassCard';
import { IconButton } from '../IconButton';
import {
  alpha,
  colors,
  fills,
  heights,
  iconSize,
  radii,
  stateColors,
} from '../../theme/tokens';
import { usePressFeedback } from '../../motion';
import { v2 } from '../../theme/v2';
import { HintPressable } from '../HintPressable';

type IconName = React.ComponentProps<typeof MaterialIcons>['name'];

type DeckRowProps = {
  name: string;
  icon: IconName;
  /** The deck's own colour — user data, washed into its tile. */
  color: string;
  cardCount: number;
  due: number;
  /** Folder name, printed as the row's context. */
  folder?: string;
  /** Studied share, 0–1. */
  progress: number;
  /** Pinned decks keep the pin glyph beside their name. */
  pinned?: boolean;
  /** Opens the row's own action sheet (pin, move) without leaving the shelf. */
  onOptions?: () => void;
  onPress?: () => void;
};

/**
 * DeckRow — one deck in the library, built for a collection that grows.
 *
 * The row answers the three questions a long-lived library raises, in reading
 * order: *which* deck (name, glyph, colour), *what is in it and where* (folder,
 * card count, studied share as a rail), and *what it wants now* (the due count,
 * which stays the loud number on the right).
 *
 * The rail is decoration for assistive tech — the caption beside it carries the
 * same number — and it only claims mastery colour once something has actually
 * been studied. Nothing is outlined: the glass pane, the tile fill and the rail
 * track do the separating.
 *
 * The options control is a sibling of the row button, never a button inside it:
 * a focusable control nested in another button is ambiguous to a screen reader
 * (and axe's `nested-interactive`). The sibling is also why a menu press never
 * opens the deck by accident.
 */
export function DeckRow({
  name,
  icon,
  color,
  cardCount,
  due,
  folder,
  progress,
  pinned = false,
  onOptions,
  onPress,
}: DeckRowProps) {
  const press = usePressFeedback({ scale: 0.99 });
  const clamped = Math.max(0, Math.min(1, progress));
  const percent = Math.round(clamped * 100);
  const percentLabel = percent === 0 && clamped > 0 ? '<1%' : `${percent}%`;
  const started = clamped > 0;
  const cardLabel = cardCount === 1 ? 'card' : 'cards';
  const count = cardCount.toLocaleString('en-US');
  const context = folder ? `${folder} · ${count} ${cardLabel}` : `${count} ${cardLabel}`;

  return (
    <Animated.View style={[press.style, { width: '100%' }]}>
      <GlassCard padding="sm" style={{ width: '100%', borderRadius: v2.radii.card }}>
        <View className="flex-row items-center" style={{ gap: 6 }}>
          <HintPressable
            hint="Open deck"
            testID="deck-row"
            onPress={onPress}
            onPressIn={press.onPressIn}
            onPressOut={press.onPressOut}
            accessibilityRole="button"
            // Named by its content, like the shelf card: name, context, studied
            // share and due line are already the whole label.
            style={{ flex: 1, minWidth: 0 }}
          >
            <View className="flex-row items-center" style={{ gap: 12 }}>
              <View
                style={{
                  width: heights.tileLg,
                  height: heights.tileLg,
                  borderRadius: radii.micro,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: alpha(color, 0.18),
                  flexShrink: 0,
                }}
              >
                <MaterialIcons name={icon} size={iconSize.lg} color={color} />
              </View>

              <View style={{ flex: 1, minWidth: 0 }}>
                <View className="flex-row items-center" style={{ gap: 6 }}>
                  <AppText
                    variant="bodyLg"
                    weight="semibold"
                    numberOfLines={2}
                    className="break-words"
                    style={{ flexShrink: 1 }}
                  >
                    {name}
                  </AppText>
                  {pinned && (
                    <MaterialIcons name="push-pin" size={iconSize.sm} color={colors.primary} />
                  )}
                </View>

                <AppText variant="caption" tone="muted" className="mt-1" numberOfLines={2}>
                  {context}
                </AppText>

                {/*
                  Capped: a rail that spans a 960px column would push its caption
                  under the due block, where it reads as part of that number.
                */}
                <View
                  className="flex-row items-center"
                  style={{ gap: 8, marginTop: 7, maxWidth: 280 }}
                >
                  <View
                    accessibilityElementsHidden
                    importantForAccessibility="no-hide-descendants"
                    style={{
                      flex: 1,
                      height: 4,
                      borderRadius: radii.pill,
                      backgroundColor: fills.track,
                      overflow: 'hidden',
                    }}
                  >
                    <View
                      style={{
                        width: `${percent}%`,
                        height: '100%',
                        backgroundColor: started ? stateColors.Review : 'transparent',
                      }}
                    />
                  </View>
                  <AppText variant="caption" tone={started ? 'muted' : 'tertiary'}>
                    {started ? `${percentLabel} studied` : 'Not started'}
                  </AppText>
                </View>
              </View>

              <View style={{ minWidth: 48, alignItems: 'flex-end', flexShrink: 0 }}>
                <AppText variant="title" tone={due > 0 ? 'default' : 'muted'} style={v2.type.stat}>
                  {due}
                </AppText>
                <AppText variant="caption" weight="semibold" tone={due > 0 ? 'accent' : 'muted'}>
                  {due > 0 ? 'due' : 'clear'}
                </AppText>
              </View>
            </View>
          </HintPressable>

          {onOptions && (
            <IconButton
              icon="more-vert"
              size="sm"
              accessibilityLabel={`Options for deck ${name}`}
              onPress={onOptions}
            />
          )}
        </View>
      </GlassCard>
    </Animated.View>
  );
}
