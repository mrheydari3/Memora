import { useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { MaterialIcons } from '../Icon';
import { Menu } from './Menu';
import type { IconName, MenuAction } from './types';
import { alpha, colors, iconSize } from '../../theme/tokens';

type ActionMenuProps = {
  /** The trigger's accessible name, e.g. "Options for deck German A2". */
  label: string;
  actions: MenuAction[];
  /** Defaults to the standard overflow glyph. */
  icon?: IconName;
  /** The compact-sheet title; defaults to the trigger label. */
  sheetTitle?: string;
  sheetSubtitle?: string;
  width?: number;
  disabled?: boolean;
  testID?: string;
};

/**
 * ActionMenu — the app's overflow control.
 *
 * One 44px target with a 40px hover tile, exactly the shape a deck row already
 * used, but the menu it opens is now the shared one: anchored on a wide canvas,
 * a compact sheet on a phone. The trigger carries `aria-haspopup` and
 * `aria-expanded`, and focus returns to it when the menu closes.
 */
export function ActionMenu({
  label,
  actions,
  icon = 'more-vert',
  sheetTitle,
  sheetSubtitle,
  width,
  disabled = false,
  testID,
}: ActionMenuProps) {
  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState(false);
  const anchorRef = useRef<React.ComponentRef<typeof View>>(null);

  return (
    <View ref={anchorRef} collapsable={false} style={{ flexShrink: 0 }}>
      <Pressable
        testID={testID}
        onPress={disabled ? undefined : () => setOpen(true)}
        onHoverIn={() => !disabled && setHovered(true)}
        onHoverOut={() => setHovered(false)}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled, expanded: open }}
        aria-haspopup="menu"
        aria-expanded={open}
        style={{
          width: 44,
          height: 44,
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 8,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: hovered && !disabled ? alpha(colors.surfaceTile, 0.9) : 'transparent',
          }}
        >
          <MaterialIcons
            name={icon}
            size={iconSize.lg}
            color={disabled ? colors.outlineSoft : colors.outline}
          />
        </View>
      </Pressable>

      <Menu
        open={open}
        onClose={() => setOpen(false)}
        anchorRef={anchorRef}
        label={label}
        title={sheetTitle ?? label}
        subtitle={sheetSubtitle}
        actions={actions}
        width={width}
      />
    </View>
  );
}
