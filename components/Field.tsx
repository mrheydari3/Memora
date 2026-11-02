import { TextInput, View } from 'react-native';
import { AppText } from './AppText';
import { colors, fills, heights, radii } from '../theme/tokens';

type FieldProps = {
  label?: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  multiline?: boolean;
  /** Long-form entry gets a 64px writing area instead of a single 44px line. */
  tall?: boolean;
  maxLength?: number;
  autoFocus?: boolean;
  accessibilityLabel?: string;
  className?: string;
};

/**
 * Field — the standard form input: optional uppercase label, hairline control
 * on the control fill, 44px single line or a 64px writing area.
 */
export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  multiline = false,
  tall = false,
  maxLength,
  autoFocus = false,
  accessibilityLabel,
  className = '',
}: FieldProps) {
  return (
    <View className={className}>
      {label && (
        <AppText variant="label" tone="muted" className="mb-1.5 uppercase">
          {label}
        </AppText>
      )}
      <TextInput
        className="rounded-md border border-hairline px-4 text-body font-inter-regular text-on-surface"
        style={{
          backgroundColor: fills.control,
          borderRadius: radii.control,
          minHeight: tall ? 64 : heights.field,
          paddingVertical: multiline ? 12 : undefined,
          textAlignVertical: multiline ? 'top' : 'center',
        }}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.outline}
        multiline={multiline}
        maxLength={maxLength}
        autoFocus={autoFocus}
        accessibilityLabel={accessibilityLabel ?? label ?? placeholder}
      />
    </View>
  );
}
