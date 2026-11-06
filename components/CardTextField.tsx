import { View, TextInput } from 'react-native';
import { AppText } from './AppText';
import { colors, glassFill, radii } from '../theme/tokens';

type CardTextFieldProps = {
  /** Uppercase field name: "Front", "Back". */
  label: string;
  placeholder: string;
  value: string;
  onChangeText: (text: string) => void;
  /** Screen-reader name. Defaults to the label. */
  accessibilityLabel?: string;
  /** Shown under the field, e.g. what the field is for. */
  hint?: string;
};

/**
 * CardTextField — one writable side of a card.
 *
 * This used to be a "rich" field: a formatting toolbar, an image chip and a
 * microphone, none of which did anything. Controls that look pressable and are
 * not are worse than no controls, so the field is now exactly what works — a
 * label, a 112px writing area and an optional hint — and the counter appears
 * only once there is something to count.
 */
export function CardTextField({
  label,
  placeholder,
  value,
  onChangeText,
  accessibilityLabel,
  hint,
}: CardTextFieldProps) {
  return (
    <View>
      <View className="mb-2 flex-row items-baseline justify-between">
        <AppText variant="label" tone="muted" className="uppercase">
          {label}
        </AppText>
        {value.trim().length > 0 && (
          <AppText variant="caption" tone="tertiary">
            {value.trim().length}
          </AppText>
        )}
      </View>

      <View
        className="overflow-hidden rounded-xl"
        style={[glassFill, { borderRadius: radii.pane }]}
      >
        <TextInput
          className="px-4 py-3 text-body-lg font-inter-regular text-on-surface"
          // Tall enough to write a sentence without scrolling, short enough that
          // both sides still fit one screen at 320×700.
          style={{ minHeight: 112 }}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.outline}
          multiline
          textAlignVertical="top"
          accessibilityLabel={accessibilityLabel ?? label}
        />
      </View>

      {hint ? (
        <AppText variant="caption" tone="tertiary" className="mt-1.5">
          {hint}
        </AppText>
      ) : null}
    </View>
  );
}
