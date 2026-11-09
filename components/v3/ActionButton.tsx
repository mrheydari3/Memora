import { Animated, Pressable } from 'react-native';
import { AppText } from '../AppText';
import { MaterialIcons } from '../Icon';
import { usePressFeedback } from '../../motion';
import { HapticsEngine } from '../../services/haptics';
import { alpha, colors, fills, heights, iconSize, radii } from '../../theme/tokens';

type IconName = React.ComponentProps<typeof MaterialIcons>['name'];

export type ActionTone = 'primary' | 'quiet' | 'success' | 'danger';

const TONE: Record<ActionTone, { fill: string; ink: string }> = {
  primary: { fill: colors.primaryContainer, ink: colors.onPrimaryContainer },
  quiet: { fill: fills.control, ink: colors.onSurface },
  success: { fill: alpha(colors.success, 0.16), ink: colors.success },
  danger: { fill: alpha(colors.error, 0.16), ink: colors.error },
};

type ActionButtonProps = {
  label: string;
  onPress?: () => void;
  /** A trailing glyph; v3 uses the 20px step. Omit for a text-only action. */
  icon?: IconName;
  tone?: ActionTone;
  disabled?: boolean;
  /** Defaults to true: an action is one full-width pill under its pane. */
  fullWidth?: boolean;
  /** Defaults to true; set false when the action has its own semantic cue. */
  haptic?: boolean;
  testID?: string;
};

/**
 * ActionButton — the v3 action pill.
 *
 * One height (52), one radius (pill), one press spring. Primary is the lit
 * accent container; quiet is the control fill; success and danger are 16%
 * washes of their state colour. A disabled action keeps its box but drops to
 * the quiet fill and the outline ink, so it never looks tappable.
 *
 * The icon is decoration: `MaterialIcons` hides its glyph from assistive tech,
 * and the button's name is the visible label.
 */
export function ActionButton({
  label,
  onPress,
  icon,
  tone = 'primary',
  disabled = false,
  fullWidth = true,
  haptic = true,
  testID,
}: ActionButtonProps) {
  const press = usePressFeedback({ scale: 0.975 });
  const palette = disabled ? { fill: fills.control, ink: colors.outline } : TONE[tone];

  return (
    <Animated.View style={[press.style, fullWidth ? { width: '100%' } : null]}>
      <Pressable
        testID={testID}
        onPress={
          disabled
            ? undefined
            : () => {
                if (haptic) HapticsEngine.selection();
                onPress?.();
              }
        }
        onPressIn={disabled ? undefined : press.onPressIn}
        onPressOut={disabled ? undefined : press.onPressOut}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled }}
        style={{
          minHeight: heights.button,
          borderRadius: radii.pill,
          paddingHorizontal: 20,
          paddingVertical: 10,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          backgroundColor: palette.fill,
        }}
      >
        <AppText variant="body" weight="semibold" style={{ color: palette.ink }}>
          {label}
        </AppText>
        {icon && !disabled && (
          <MaterialIcons name={icon} size={iconSize.lg} color={palette.ink} />
        )}
      </Pressable>
    </Animated.View>
  );
}
