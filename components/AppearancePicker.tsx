import { Pressable, View } from 'react-native';
import { MaterialIcons } from './Icon';
import { AppText } from './AppText';
import { alpha, colors, fills, heights, iconSize } from '../theme/tokens';
import { ICON_CHOICES } from '../data/appearance';

/**
 * The tints a deck or a folder may wear. All of them are palette tokens: a
 * folder's colour is user data, not a new design colour, so it is always one of
 * the semantic steps the rest of the app already knows.
 */
export const COLOR_CHOICES = [
  colors.primary,
  colors.warning,
  colors.error,
  colors.success,
  colors.secondary,
];

type AppearancePickerProps = {
  icon: string;
  color: string;
  onIconChange: (icon: string) => void;
  onColorChange: (color: string) => void;
};

/**
 * AppearancePicker — the icon grid and colour dots shared by a deck and a
 * folder, so the two never grow two different choosers.
 *
 * The grid is ordered with the language glyphs first (the common case here) and
 * wraps to as many columns as the sheet is wide; every tile is a 44px target.
 * The selection is a fill step plus the accent glyph, never an outline.
 */
export function AppearancePicker({
  icon,
  color,
  onIconChange,
  onColorChange,
}: AppearancePickerProps) {
  return (
    <View>
      <AppText variant="label" tone="muted" className="mb-2 uppercase">
        Icon
      </AppText>
      <View className="flex-row flex-wrap" style={{ gap: 8 }}>
        {ICON_CHOICES.map((choice) => {
          const active = icon === choice;
          return (
            <Pressable
              key={choice}
              className="items-center justify-center rounded-md"
              style={{
                width: heights.tileLg,
                height: heights.tileLg,
                backgroundColor: active ? colors.accentActive : fills.tile,
              }}
              onPress={() => onIconChange(choice)}
              accessibilityRole="radio"
              // A radio announces its state through `checked`, not `selected`:
              // role=radio requires aria-checked, and react-native-web does not
              // derive it from accessibilityState, so it is set explicitly too.
              accessibilityState={{ checked: active }}
              aria-checked={active}
              accessibilityLabel={`Icon ${choice}`}
            >
              <MaterialIcons
                name={choice}
                size={iconSize.lg}
                color={active ? colors.primary : colors.onSurfaceVariant}
              />
            </Pressable>
          );
        })}
      </View>

      <AppText variant="label" tone="muted" className="mb-2 mt-5 uppercase">
        Colour
      </AppText>
      <View className="flex-row flex-wrap" style={{ gap: 12 }}>
        {COLOR_CHOICES.map((choice) => {
          const active = color === choice;
          return (
            <Pressable
              key={choice}
              className="items-center justify-center rounded-full"
              style={{
                width: heights.tileLg,
                height: heights.tileLg,
                backgroundColor: alpha(choice, active ? 0.28 : 0.12),
              }}
              onPress={() => onColorChange(choice)}
              accessibilityRole="radio"
              accessibilityState={{ checked: active }}
              aria-checked={active}
              accessibilityLabel={`Colour ${choice}`}
            >
              <View className="h-6 w-6 rounded-full" style={{ backgroundColor: choice }} />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
