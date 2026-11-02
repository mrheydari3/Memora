import { Animated, View, Pressable } from 'react-native';
import { MaterialIcons } from './Icon';
import { AppText } from './AppText';
import { colors, heights, iconSize } from '../theme/tokens';
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
 * `rule` used to draw a hairline across the row. It now only reserves the gap,
 * because chapters are separated by spacing (28px) instead of by rules.
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
      {/* A real heading: without it, "Decks" and its count ran together into one
          anonymous text node ("Decks 1") with nothing to navigate by. */}
      <AppText variant="label" tone="muted" className="uppercase" headingLevel={2}>
        {label}
      </AppText>
      {rule ? <View className="mx-3 flex-1" /> : null}
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
        // The label is 20px tall; the press box is 44. `hitSlop` does nothing
        // on the web, so the size is laid out here instead of slopped on.
        style={{ minHeight: heights.hit, justifyContent: 'center' }}
        onPress={onPress}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        accessibilityRole="button"
        accessibilityLabel={label}
      >
        {icon && <MaterialIcons name={icon} size={iconSize.xs} color={colors.primary} />}
        <AppText variant="bodySm" weight="semibold" tone="accent">
          {label}
        </AppText>
      </Pressable>
    </Animated.View>
  );
}
