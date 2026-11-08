import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { MaterialIcons } from '../Icon';
import { AppText } from '../AppText';
import { HintPressable } from '../HintPressable';
import { alpha, colors, iconSize } from '../../theme/tokens';
import { Surface } from './Surface';
import { v3 } from '../../theme/v3';

type ArchivedRowProps = {
  name: string;
  cardCount: number;
  onPress?: () => void;
  onOptions?: () => void;
  /** An ActionMenu node, rendered instead of the built-in options control. */
  optionsMenu?: React.ReactNode;
};

/** A bare 40px glyph on the mockup's 44px target. */
function RowOptions({ label, onPress }: { label: string; onPress: () => void }) {
  const [hovered, setHovered] = useState(false);

  return (
    <Pressable
      onPress={onPress}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 8,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: hovered ? alpha(colors.surfaceTile, 0.9) : 'transparent',
        }}
      >
        <MaterialIcons name="more-vert" size={iconSize.lg} color={colors.outline} />
      </View>
    </Pressable>
  );
}

/**
 * ArchivedRow — a retired deck, exactly as the mockup draws it:
 *
 *   pane at 60% with a 30% outline border, p-4; glyph tile 44 on
 *   surface-control at 70%; name 17/500 in the muted ink with a 12px
 *   "Archived" chip; meta 13 outline; and a "0 due" chip on 40% surface-control
 *   instead of a live figure, because an archived deck cannot ask for anything.
 */
export function ArchivedRow({ name, cardCount, onPress, onOptions, optionsMenu }: ArchivedRowProps) {
  return (
    <Surface
      tone="scene"
      radius="card"
      padding="sm"
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        // No row-level opacity: dimming the whole pane dropped the 12–13px
        // tertiary text to 3.7–4.1:1. The retired state is carried by the
        // pane wash, the outline glyph and the Archived chip instead.
        backgroundColor: alpha(colors.surfacePane, 0.6),
      }}
    >
      <HintPressable
        hint="Open deck"
        onPress={onPress}
        accessibilityRole="button"
        style={{ flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 14 }}
      >
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: alpha(colors.surfaceControl, 0.7),
            flexShrink: 0,
          }}
        >
          <MaterialIcons name="archive" size={iconSize.xl} color={colors.outline} />
        </View>

        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <AppText
              weight="medium"
              tone="muted"
              numberOfLines={1}
              style={[v3.type.deckName, { flexShrink: 1 }]}
            >
              {name}
            </AppText>
            <View
              style={{
                paddingHorizontal: 8,
                paddingVertical: 2,
                borderRadius: 999,
                backgroundColor: colors.surfaceControl,
              }}
            >
              <AppText variant="caption" tone="tertiary">
                Archived
              </AppText>
            </View>
          </View>
          <AppText variant="bodySm" tone="tertiary" numberOfLines={1} style={{ marginTop: 2 }}>
            {cardCount.toLocaleString('en-US')} {cardCount === 1 ? 'card' : 'cards'}
          </AppText>
        </View>
      </HintPressable>

      <View
        style={{
          paddingHorizontal: 10,
          paddingVertical: 4,
          borderRadius: 12,
          backgroundColor: alpha(colors.surfaceControl, 0.4),
        }}
      >
        <AppText
          variant="caption"
          weight="semibold"
          tone="tertiary"
          className="uppercase"
          style={{ letterSpacing: 0.6 }}
        >
          0 due
        </AppText>
      </View>

      {optionsMenu ??
        (onOptions && <RowOptions label={`Options for deck ${name}`} onPress={onOptions} />)}
    </Surface>
  );
}
