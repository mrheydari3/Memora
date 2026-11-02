import { Animated, View, Pressable } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { AppText } from './AppText';
import { colors, iconSize } from '../theme/tokens';
import { usePressFeedback } from '../motion';

type SectionHeaderProps = {
  label: string;
  /** Small right-aligned hint, e.g. a count or "Today". */
  hint?: string;
  action?: { label: string; onPress: () => void; icon?: React.ComponentProps<typeof MaterialIcons>['name'] };
  /** Hairline rule from the label to the hint. Settings chapters use it. */
  rule?: boolean;
  className?: string;
};

/**
 * SectionHeader — uppercase 12px label with 0.6 letter-spacing. The only
 * section marker in the app: no mixed-case headings above lists.
 *
 * `rule` draws a hairline from the label to the right edge, which turns a
 * chapter heading into a divider in settings; lists stay rule-free.
 */
export function SectionHeader({
  label,
  hint,
  action,
  rule = false,
  className = '',
}: SectionHeaderProps) {
  return (
    <View className={`flex-row items-center ${className}`}>
      <AppText variant="label" tone="muted" className="uppercase">
        {label}
      </AppText>
      {rule ? (
        <View className="mx-3 h-px flex-1" style={{ backgroundColor: colors.hairline }} />
      ) : null}
      {hint && (
        <AppText
          variant="label"
          weight="medium"
          tone="tertiary"
          className={rule ? '' : 'ml-2'}
        >
          {hint}
        </AppText>
      )}
      {action && (
        <HeaderAction
          label={action.label}
          icon={action.icon}
          onPress={action.onPress}
        />
      )}
    </View>
  );
}

/**
 * The section's inline action ("New deck", "View all"): a spring dip on press,
 * since the old opacity class only applied to a web hover.
 */
function HeaderAction({
  label,
  icon,
  onPress,
}: {
  label: string;
  icon?: React.ComponentProps<typeof MaterialIcons>['name'];
  onPress: () => void;
}) {
  const press = usePressFeedback({ scale: 0.94 });

  return (
    <Animated.View style={[{ marginLeft: 'auto' }, press.style]}>
      <Pressable
        className="flex-row items-center gap-1"
        onPress={onPress}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        accessibilityRole="button"
        accessibilityLabel={label}
        hitSlop={8}
      >
        {icon && <MaterialIcons name={icon} size={iconSize.xs} color={colors.primary} />}
        <AppText variant="bodySm" weight="semibold" tone="accent">
          {label}
        </AppText>
      </Pressable>
    </Animated.View>
  );
}
