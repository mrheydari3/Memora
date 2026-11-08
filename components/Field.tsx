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
  /** Overrides the writing area's height; only meaningful for multiline entry. */
  minHeight?: number;
  maxLength?: number;
  autoFocus?: boolean;
  accessibilityLabel?: string;
  className?: string;
};

/**
 * Field — the standard form input: optional uppercase label, a control fill at
 * 44px (or a 64px writing area when multiline and tall). No outline at rest.
 */
export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  multiline = false,
  tall = false,
  minHeight,
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
        className="rounded-md px-4 text-body font-inter-regular text-on-surface"
        style={{
          backgroundColor: fills.control,
          borderRadius: radii.control,
          minHeight: minHeight ?? (tall ? 64 : heights.field),
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
