import { View } from 'react-native';
import { MaterialIcons } from '../Icon';
import { AppText } from '../AppText';
import { HintPressable } from '../HintPressable';
import { alpha, colors, iconSize } from '../../theme/tokens';
import { RowOptions } from './RowOptions';
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

/**
 * ArchivedRow — a retired deck, exactly as the mockup draws it:
 *
 *   pane at 60% with a 30% outline border, p-4; glyph tile 38 on
 *   surface-control at 70%; name 15/500 in the muted ink; meta 13 outline.
 *   There is no due figure: an archived deck cannot ask for anything, and a
 *   permanent zero would only take width away from the name at 320px.
 *
 * The section heading and the archive glyph already say "archived", so the row
 * carries no second badge: a retired deck reads quieter than an active one and
 * its name keeps the room the badge used to take.
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
            width: 38,
            height: 38,
            borderRadius: v3.radii.tile,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: alpha(colors.surfaceControl, 0.7),
            flexShrink: 0,
          }}
        >
          <MaterialIcons name="archive" size={iconSize.lg} color={colors.outline} />
        </View>

        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <AppText
              weight="medium"
              tone="muted"
              numberOfLines={1}
              style={[v3.type.deckTitle, { flexShrink: 1 }]}
            >
              {name}
            </AppText>
          </View>
          <AppText variant="bodySm" tone="tertiary" numberOfLines={1} style={{ marginTop: 2 }}>
            {cardCount.toLocaleString('en-US')} {cardCount === 1 ? 'card' : 'cards'}
          </AppText>
        </View>
      </HintPressable>

      {optionsMenu ??
        (onOptions && <RowOptions label={`Options for deck ${name}`} onPress={onOptions} />)}
    </Surface>
  );
}
