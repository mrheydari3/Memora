import { View, TextInput } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { AppText } from './AppText';
import { colors, glassFill, iconSize, radii } from '../theme/tokens';

type RichTextFieldProps = {
  placeholder: string;
  value: string;
  onChangeText: (text: string) => void;
};

/**
 * RichTextField — the card editor input: glass pane, hairline toolbar strip on
 * top, a 96px writing area, and an actions strip on the bottom. Toolbar actions
 * are placeholders for now, so they stay quiet (muted icons, no accent).
 */
export function RichTextField({ placeholder, value, onChangeText }: RichTextFieldProps) {
  return (
    <View
      className="overflow-hidden rounded-xl border border-hairline"
      style={[glassFill, { borderRadius: radii.pane }]}
    >
      <View className="h-10 flex-row items-center gap-1 border-b border-hairline px-2">
        <ToolbarButton icon="format-bold" />
        <ToolbarButton icon="format-italic" />
        <ToolbarButton icon="format-underlined" />
        <View className="mx-1 h-4 w-px bg-hairline" />
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

      <View className="h-11 flex-row items-center justify-between border-t border-hairline px-3">
        <View className="flex-row items-center gap-1.5 rounded-full border border-hairline px-2.5 py-1">
          <MaterialIcons name="image" size={iconSize.xs} color={colors.outline} />
          <AppText variant="caption" weight="medium" tone="muted">
            Add image
          </AppText>
        </View>
        <View className="h-7 w-7 items-center justify-center rounded-full border border-hairline">
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
