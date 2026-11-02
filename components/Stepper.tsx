import { View } from 'react-native';
import { IconButton } from './IconButton';
import { iconSize } from '../theme/tokens';

type StepperProps = {
  /** The big value in the middle; callers pass AppText or a Pill. */
  value: React.ReactNode;
  onDecrease: () => void;
  onIncrease: () => void;
  decrementLabel: string;
  incrementLabel: string;
  disabled?: boolean;
  className?: string;
};

/**
 * Stepper — the decrement / value / increment row used by the algorithm
 * settings. One implementation replaces the three hand-rolled copies, so the
 * circles, glyphs and hit targets are identical in every sheet.
 */
export function Stepper({
  value,
  onDecrease,
  onIncrease,
  decrementLabel,
  incrementLabel,
  disabled = false,
  className = '',
}: StepperProps) {
  return (
    <View className={`flex-row items-center justify-between ${className}`}>
      <IconButton
        icon="remove"
        size="lg"
        glyphSize={iconSize.xl}
        onPress={onDecrease}
        disabled={disabled}
        accessibilityLabel={decrementLabel}
      />
      <View className="items-center">{value}</View>
      <IconButton
        icon="add"
        size="lg"
        glyphSize={iconSize.xl}
        onPress={onIncrease}
        disabled={disabled}
        accessibilityLabel={incrementLabel}
      />
    </View>
  );
}
