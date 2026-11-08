import { useId, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import type { AccessibilityState, ViewStyle } from 'react-native';
import { MaterialIcons } from '../Icon';
import { AppText } from '../AppText';
import { useMenuContext } from './MenuContext';
import type { AnchorRect, IconName, WebFocusable } from './types';
import { colors, fills, heights, iconSize, menu, radii } from '../../theme/tokens';

/** The host node exposes these on web; text files stay free of DOM types. */
type MeasurableNode = {
  measureInWindow?: (
    callback: (x: number, y: number, width: number, height: number) => void
  ) => void;
  getBoundingClientRect?: () => { left: number; top: number; width: number; height: number };
  focus?: () => void;
};

export type MenuItemProps = {
  label: string;
  description?: string;
  icon?: IconName;
  /** A single-choice option: check mark, accent fill and radio semantics. */
  selected?: boolean;
  destructive?: boolean;
  disabled?: boolean;
  /** A nested menu's content. The item opens a submenu instead of acting. */
  submenu?: React.ReactNode;
  submenuTitle?: string;
  /** Run the action without dismissing the menu (pin, move up/down). */
  keepOpen?: boolean;
  onPress?: () => void;
  /** Replaces the default check/chevron indicator. */
  trailing?: React.ReactNode;
  testID?: string;
  accessibilityLabel?: string;
};

/**
 * MenuItem — the one option row in every menu.
 *
 * It is 44px tall when anchored and 52px inside a sheet, with one icon step
 * (18px), one label step (15px) and no icon tile: a menu is a list of choices,
 * not a second settings pane. Selection is an accent wash plus a check, hover
 * and keyboard focus share the same quiet control wash, and destructive rows
 * tint both glyph and label instead of drawing a second shape.
 *
 * Semantics follow the presentation: a real `menuitem`/`menuitemradio` inside
 * an anchored menu, and a plain `button` inside the compact sheet fallback (the
 * sheet is already a dialog, so a button is the honest role there and keeps the
 * sheet's focus trap and assistive-tech flow intact).
 */
export function MenuItem({
  label,
  description,
  icon,
  selected,
  destructive = false,
  disabled = false,
  submenu,
  submenuTitle,
  keepOpen = false,
  onPress,
  trailing,
  testID,
  accessibilityLabel,
}: MenuItemProps) {
  const menuContext = useMenuContext();
  const generatedId = useId();
  const itemId = `menu-item-${generatedId.replace(/:/g, '')}`;
  const itemRef = useRef<React.ComponentRef<typeof View>>(null);
  const pressableRef = useRef<React.ComponentRef<typeof Pressable>>(null);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [pressed, setPressed] = useState(false);

  const sheet = menuContext.presentation === 'sheet';
  const hasSubmenu = Boolean(submenu);
  const submenuOpen = hasSubmenu && menuContext.openSubmenuId === itemId;

  const state: AccessibilityState = { disabled };
  if (selected !== undefined) {
    if (sheet) state.selected = selected;
    else state.checked = selected;
  }

  const role = sheet ? 'button' : selected !== undefined ? 'menuitemradio' : 'menuitem';

  const openSubmenu = () => {
    if (!submenu) return;
    const node = itemRef.current as unknown as MeasurableNode | null;
    const finish = (anchor: AnchorRect) => {
      menuContext.openSubmenu({
        id: itemId,
        title: submenuTitle ?? label,
        content: submenu,
        anchor,
        // The measuring wrapper is not focusable; return focus to the row's
        // Pressable, which is the element the user actually activated.
        trigger: (pressableRef.current as unknown as WebFocusable | null) ?? null,
      });
    };

    if (node?.measureInWindow) {
      node.measureInWindow((x, y, width, height) => finish({ x, y, width, height }));
      return;
    }
    if (node?.getBoundingClientRect) {
      const rect = node.getBoundingClientRect();
      finish({ x: rect.left, y: rect.top, width: rect.width, height: rect.height });
      return;
    }
    finish({ x: 0, y: 0, width: 0, height: 0 });
  };

  const activate = () => {
    if (disabled) return;
    if (hasSubmenu) {
      openSubmenu();
      return;
    }
    if (!keepOpen) menuContext.closeAll();
    onPress?.();
  };

  const glyph = destructive
    ? colors.error
    : selected
      ? colors.primary
      : colors.onSurfaceVariant;

  const background = selected
    ? colors.accentFaint
    : pressed
      ? fills.track
      : hovered || focused
        ? fills.control
        : 'transparent';

  const base: ViewStyle = {
    minHeight: sheet ? 52 : heights.hit,
    paddingHorizontal: sheet ? 8 : 10,
    paddingVertical: 8,
    borderRadius: radii.micro,
    flexDirection: 'row',
    alignItems: 'center',
    gap: menu.iconGap,
    backgroundColor: background,
    opacity: disabled ? 0.45 : 1,
  };

  return (
    <View ref={itemRef} collapsable={false} style={{ width: '100%' }}>
      <Pressable
        ref={pressableRef}
        testID={testID}
        // `menuitemradio` is a valid ARIA role but is not in React Native's
        // Role union; a web spread keeps the DOM semantic without a cast in
        // every call site.
        {...({ role } as Record<string, unknown>)}
        onPress={activate}
        onPressIn={() => setPressed(true)}
        onPressOut={() => setPressed(false)}
        onHoverIn={() => {
          setHovered(true);
          if (sheet || disabled) return;
          if (hasSubmenu) {
            if (!submenuOpen) openSubmenu();
          } else if (menuContext.openSubmenuId) {
            menuContext.closeSubmenu(false);
          }
        }}
        onHoverOut={() => setHovered(false)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        disabled={disabled}
        focusable={!disabled}
        accessibilityLabel={accessibilityLabel ?? label}
        accessibilityState={state}
        {...(selected === undefined ? {} : sheet ? { 'aria-pressed': selected } : { 'aria-checked': selected })}
        {...(disabled ? { 'aria-disabled': true } : {})}
        {...(hasSubmenu ? { 'aria-haspopup': 'menu', 'aria-expanded': submenuOpen } : {})}
        style={base}
      >
        {icon && (
          <View
            aria-hidden
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={{ width: iconSize.lg, alignItems: 'center', flexShrink: 0 }}
          >
            <MaterialIcons name={icon} size={iconSize.lg} color={glyph} />
          </View>
        )}

        <View style={{ flex: 1, minWidth: 0 }}>
          <AppText
            variant="body"
            weight={selected ? 'semibold' : 'medium'}
            tone={destructive ? 'danger' : selected ? 'accent' : 'default'}
            numberOfLines={description ? 1 : 2}
          >
            {label}
          </AppText>
          {description && (
            <AppText variant="bodySm" tone="muted" numberOfLines={2} style={{ marginTop: 2 }}>
              {description}
            </AppText>
          )}
        </View>

        {trailing ??
          (selected ? (
            <MaterialIcons name="check" size={iconSize.lg} color={colors.primary} />
          ) : hasSubmenu ? (
            <MaterialIcons name="chevron-right" size={iconSize.md} color={colors.outline} />
          ) : null)}
      </Pressable>
    </View>
  );
}

/** A hairline between groups of choices. */
export function MenuSeparator() {
  return (
    <View
      role="separator"
      style={{
        height: 1,
        backgroundColor: colors.outlineVariant,
        marginVertical: 4,
        marginHorizontal: 6,
      }}
    />
  );
}

/** A quiet label above a group of related choices. */
export function MenuLabel({ label }: { label: string }) {
  return (
    <View style={{ paddingHorizontal: 10, paddingTop: 10, paddingBottom: 4 }}>
      <AppText
        variant="caption"
        weight="semibold"
        tone="tertiary"
        className="uppercase"
        style={{ letterSpacing: 0.6 }}
      >
        {label}
      </AppText>
    </View>
  );
}

/** A labelled group, so assistive tech can name a section of a long menu. */
export function MenuGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View role="group" aria-label={label} style={{ gap: menu.itemGap }}>
      <MenuLabel label={label} />
      {children}
    </View>
  );
}
