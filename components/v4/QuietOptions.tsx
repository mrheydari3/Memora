import { useRef, useState } from 'react';
import { Platform, Pressable, useWindowDimensions, View } from 'react-native';
import { MaterialIcons } from '../Icon';
import { Menu } from '../menu/Menu';
import type { MenuAction } from '../menu/types';
import { colors, iconSize } from '../../theme/tokens';
import { v4 } from '../../theme/v4';
import { HapticsEngine } from '../../services/haptics';

type QuietOptionsProps = {
  /** The trigger's accessible name, e.g. "Options for deck German A2". */
  label: string;
  actions: MenuAction[];
  sheetTitle?: string;
  sheetSubtitle?: string;
  testID?: string;
};

/**
 * QuietOptions — a deck's overflow control on the V4 shelf.
 *
 * The row's trailing 30px are reserved for it, but the target itself is 44px so
 * a thumb can hit it. On desktop the tile waits at zero opacity and appears on
 * hover or keyboard focus; on touch it is always visible. The target is pinned
 * to the row's right edge and stops at the due column's 14px inset, so it never
 * sits over the saffron numeral.
 */
export function QuietOptions({
  label,
  actions,
  sheetTitle,
  sheetSubtitle,
  testID,
}: QuietOptionsProps) {
  const { width } = useWindowDimensions();
  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const anchorRef = useRef<React.ComponentRef<typeof View>>(null);
  const touch = width < 640;
  const revealed = touch || hovered || focused || open;

  // React Native Web forwards focus events even though the shared Pressable
  // types do not name them; the cast keeps this file free of DOM types.
  const focusProps =
    Platform.OS === 'web'
      ? ({
          onFocus: () => setFocused(true),
          onBlur: () => setFocused(false),
        } as Record<string, unknown>)
      : {};

  return (
    <View
      ref={anchorRef}
      collapsable={false}
      style={{
        position: 'absolute',
        top: 0,
        right: 0,
        width: 44,
        height: 44,
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2,
        opacity: revealed ? 1 : 0,
      }}
    >
      <Pressable
        testID={testID}
        onPress={() => {
          HapticsEngine.selection();
          setOpen(true);
        }}
        onHoverIn={() => setHovered(true)}
        onHoverOut={() => setHovered(false)}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ expanded: open }}
        aria-haspopup="menu"
        aria-expanded={open}
        {...focusProps}
        style={{
          width: 44,
          height: 44,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <View
          style={{
            width: 30,
            height: 30,
            borderRadius: 8,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: hovered || focused || open ? colors.v4TileHover : 'transparent',
          }}
        >
          <MaterialIcons name="more-vert" size={iconSize.lg} color={colors.outline} />
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
        width={236}
      />
    </View>
  );
}
