import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { MaterialIcons } from '../Icon';
import { colors, fills, iconSize } from '../../theme/tokens';
import { v3 } from '../../theme/v3';

type IconName = React.ComponentProps<typeof MaterialIcons>['name'];

type HeaderIconProps = {
  icon: IconName;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  /** Disclosure state for a bar control that opens a menu. */
  ariaExpanded?: boolean;
  ariaHasPopup?: 'menu' | 'dialog';
  /** A soft-accent tile for the page's one create action. */
  emphasized?: boolean;
  /** A neutral raised tile for a secondary action that must read next to the accent action. */
  raised?: boolean;
};

/**
 * The app-bar control: a matching 36px soft tile on a 44px target, with a 20px
 * glyph. Every bar control uses the same size and 12px radius, so a row of
 * controls reads as one set; `emphasized` gives the one create action the
 * accent, while `raised` lifts a secondary action with a neutral fill and a
 * brighter glyph, so the pair reads at one level without competing.
 */
export function HeaderIcon({
  icon,
  label,
  onPress,
  disabled = false,
  ariaExpanded,
  ariaHasPopup,
  emphasized = false,
  raised = false,
}: HeaderIconProps) {
  const [hovered, setHovered] = useState(false);
  const iconColor = disabled
    ? colors.outlineVariant
    : emphasized
      ? colors.primary
      : raised
        ? colors.onSurface
        : colors.onSurfaceVariant;

  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      onHoverIn={() => !disabled && setHovered(true)}
      onHoverOut={() => setHovered(false)}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled, ...(ariaExpanded === undefined ? {} : { expanded: ariaExpanded }) }}
      {...(ariaExpanded === undefined ? {} : { 'aria-expanded': ariaExpanded })}
      {...(ariaHasPopup ? { 'aria-haspopup': ariaHasPopup } : {})}
      style={{
        width: v3.appBar.actionHit,
        height: v3.appBar.actionHit,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <View
        style={{
          width: v3.appBar.actionTile,
          height: v3.appBar.actionTile,
          borderRadius: v3.appBar.actionRadius,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: emphasized
            ? hovered && !disabled
              ? colors.accentActive
              : colors.accentSoft
            : hovered && !disabled
              ? raised
                ? colors.surfaceControl
                : fills.control
              : raised
                ? fills.control
                : fills.tile,
        }}
      >
        <MaterialIcons name={icon} size={iconSize.lg} color={iconColor} />
      </View>
    </Pressable>
  );
}
