import { View, TextInput } from 'react-native';
import { MaterialIcons } from './Icon';
import { AppText } from './AppText';
import { colors, fills, glassFill, iconSize, radii } from '../theme/tokens';

type RichTextFieldProps = {
  placeholder: string;
  value: string;
  onChangeText: (text: string) => void;
};

/**
 * RichTextField — the card editor input: glass pane with an inset toolbar strip
 * on top, a 96px writing area, and an actions strip at the bottom. Toolbar
 * actions are placeholders for now, so they stay quiet (muted icons, no accent).
 * The strips are separated by their fill, not by rules.
 */
export function RichTextField({ placeholder, value, onChangeText }: RichTextFieldProps) {
  return (
    <View
      className="overflow-hidden rounded-xl"
      style={[glassFill, { borderRadius: radii.pane }]}
    >
      <View
        className="h-10 flex-row items-center gap-1 px-2"
        style={{ backgroundColor: fills.inset }}
      >
        <ToolbarButton icon="format-bold" />
        <ToolbarButton icon="format-italic" />
        <ToolbarButton icon="format-underlined" />
        <ToolbarButton icon="format-list-bulleted" />
      </View>

      <TextInput
        className="px-4 py-3 text-body-lg font-inter-regular text-on-surface"
        style={{ minHeight: 96 }}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.outline}
        multiline
        textAlignVertical="top"
        accessibilityLabel={placeholder}
      />

      <View
        className="h-11 flex-row items-center justify-between px-3"
        style={{ backgroundColor: fills.inset }}
      >
        <View className="flex-row items-center gap-1.5 rounded-full px-2.5 py-1" style={{ backgroundColor: fills.tile }}>
          <MaterialIcons name="image" size={iconSize.xs} color={colors.outline} />
          <AppText variant="caption" weight="medium" tone="muted">
            Add image
          </AppText>
        </View>
        <View className="h-7 w-7 items-center justify-center rounded-full" style={{ backgroundColor: fills.tile }}>
          <MaterialIcons name="mic" size={iconSize.sm} color={colors.outline} />
        </View>
      </View>
    </View>
  );
}

function ToolbarButton({ icon }: { icon: React.ComponentProps<typeof MaterialIcons>['name'] }) {
  return (
    <View className="h-7 w-7 items-center justify-center rounded">
      <MaterialIcons name={icon} size={iconSize.sm} color={colors.outline} />
    </View>
  );
}
