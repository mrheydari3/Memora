import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import type { ViewStyle } from 'react-native';
import { BottomSheetModal } from '../BottomSheetModal';
import { MenuContext } from './MenuContext';
import type { MenuContextValue } from './MenuContext';
import { MenuActionList } from './MenuActionList';
import { MenuItem } from './MenuItem';
import type { AnchorRect, MenuAction, MenuPresentation, SubmenuLevel, WebFocusable } from './types';
import { alpha, colors, menu, motion, radii } from '../../theme/tokens';
import { usePresence } from '../../motion';

export type MenuProps = {
  open: boolean;
  onClose: () => void;
  /** The menu's accessible name, e.g. "Sort cards". */
  label: string;
  /** The sheet fallback's title; defaults to `label`. */
  title?: string;
  subtitle?: string;
  /** Declarative actions, or compose MenuItem children directly. */
  actions?: MenuAction[];
  children?: React.ReactNode;
  /** The trigger wrapper, measured when the menu opens. */
  anchorRef?: React.RefObject<React.ComponentRef<typeof View> | null>;
  /** An explicit anchor, used by context menus at a pointer position. */
  anchorRect?: AnchorRect | null;
  /** auto = anchored above 640px, sheet below it. */
  presentation?: 'auto' | MenuPresentation;
  width?: number;
  maxHeight?: number;
  placement?: 'auto' | 'bottom' | 'top';
  testID?: string;
};

const SHEET_BREAKPOINT = 640;

type WebElement = {
  focus: () => void;
  contains?: (node: WebElement | null) => boolean;
  querySelectorAll?: (selector: string) => ArrayLike<WebElement>;
  getAttribute?: (name: string) => string | null;
  click?: () => void;
  getBoundingClientRect?: () => { left: number; top: number; width: number; height: number };
};

type WebEvent = {
  key?: string;
  shiftKey?: boolean;
  metaKey?: boolean;
  ctrlKey?: boolean;
  altKey?: boolean;
  preventDefault?: () => void;
  stopPropagation?: () => void;
  target?: unknown;
};

type WebDocument = {
  activeElement: WebElement | null;
  addEventListener: (type: string, listener: (event: WebEvent) => void, capture?: boolean) => void;
  removeEventListener: (type: string, listener: (event: WebEvent) => void, capture?: boolean) => void;
};

type MeasurableNode = {
  measureInWindow?: (
    callback: (x: number, y: number, width: number, height: number) => void
  ) => void;
  getBoundingClientRect?: () => { left: number; top: number; width: number; height: number };
};

function webDocument(): WebDocument | null {
  return (globalThis as { document?: WebDocument }).document ?? null;
}

function queryMenuItems(panel: WebElement | null): WebElement[] {
  if (!panel?.querySelectorAll) return [];
  return Array.from(
    panel.querySelectorAll(
      '[role="menuitem"], [role="menuitemradio"], [role="menuitemcheckbox"]'
    )
  ).filter((item) => item.getAttribute?.('aria-disabled') !== 'true');
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

type Position = {
  left: number;
  top: number;
  width: number;
  maxHeight: number;
  openAbove: boolean;
};

/**
 * Arrange a floating panel against its trigger.
 *
 * The panel prefers to open below, flips above only when the space below cannot
 * hold a useful menu while the space above can, aligns its far edge to a
 * right-hand trigger, and clamps both axes to the viewport so a menu near an
 * edge never spills off screen.
 */
function positionPanel(
  anchor: AnchorRect,
  viewportWidth: number,
  viewportHeight: number,
  requestedWidth: number,
  measuredHeight: number,
  placement: 'auto' | 'bottom' | 'top',
  heightCap: number
): Position {
  const margin = menu.viewportMargin;
  const gap = menu.anchorOffset;
  const width = Math.min(
    Math.max(Math.min(requestedWidth, menu.maxWidth), menu.minWidth),
    viewportWidth - margin * 2
  );

  const below = anchor.y + anchor.height + gap;
  const above = anchor.y - gap;
  const spaceBelow = viewportHeight - below - margin;
  const spaceAbove = above - margin;
  const estimatedHeight = measuredHeight > 0 ? measuredHeight : Math.min(heightCap, 240);
  const fitsBelow = spaceBelow >= Math.min(estimatedHeight, 240);
  const openAbove =
    placement === 'top' || (placement === 'auto' && !fitsBelow && spaceAbove > spaceBelow);

  const available = Math.max(96, openAbove ? spaceAbove : spaceBelow);
  const maxHeight = Math.max(96, Math.min(heightCap, available));
  const height = Math.min(measuredHeight > 0 ? measuredHeight : maxHeight, maxHeight);

  // A wide trigger (a settings row) reads better with its label edge; a short
  // control on the right half aligns its far edge instead of growing inward.
  const narrowTrigger = anchor.width < width * 1.2;
  const alignEnd = narrowTrigger && anchor.x + anchor.width / 2 > viewportWidth / 2;
  const left = clamp(
    alignEnd ? anchor.x + anchor.width - width : anchor.x,
    margin,
    Math.max(margin, viewportWidth - width - margin)
  );

  // Opening below never subtracts the panel height: `maxHeight` is already
  // capped to the space below the trigger, and subtracting it again would pull
  // a tall menu back over the control that opened it.
  const top = openAbove
    ? Math.max(margin, above - height)
    : Math.min(below, viewportHeight - margin);

  return { left, top, width, maxHeight, openAbove };
}

/* -------------------------------------------------------------------------- */
/* Narrow presentation: a compact, focus-trapped sheet.                       */
/* -------------------------------------------------------------------------- */

function SheetMenu({
  open,
  onClose,
  label,
  title,
  subtitle,
  actions,
  children,
  maxHeight,
}: MenuProps) {
  const { height } = useWindowDimensions();
  const [levels, setLevels] = useState<SubmenuLevel[]>([]);
  const current = levels.length > 0 ? levels[levels.length - 1] : null;
  const sheetTitle = current?.title ?? title ?? label;
  const sheetMaxHeight = Math.min(maxHeight ?? menu.maxHeight, Math.round(height * 0.62));

  const closeAll = useCallback(() => {
    setLevels([]);
    onClose();
  }, [onClose]);

  const closeSubmenu = useCallback((focusTrigger = true) => {
    setLevels((previous) => previous.slice(0, -1));
    if (!focusTrigger) return;
    // The sheet keeps focus inside its own header; no parent element exists to
    // restore to on this presentation.
  }, []);

  const openSubmenu = useCallback((level: SubmenuLevel) => {
    setLevels((previous) => [...previous, level]);
  }, []);

  const context: MenuContextValue = {
    presentation: 'sheet',
    closeAll,
    closeSubmenu,
    openSubmenu,
    openSubmenuId: current?.id ?? null,
  };

  return (
    <MenuContext.Provider value={context}>
      <BottomSheetModal
        visible={open}
        onClose={closeAll}
        title={sheetTitle}
        subtitle={current ? undefined : subtitle}
        focusKey={sheetTitle}
        onEscape={levels.length > 0 ? () => closeSubmenu(true) : undefined}
        compact
      >
        <ScrollView
          className="menu-scroll"
          style={{ maxHeight: sheetMaxHeight }}
          showsVerticalScrollIndicator
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: 2 }}
        >
          {current && (
            <MenuItem
              label="Back"
              icon="arrow-back"
              onPress={() => closeSubmenu(true)}
              accessibilityLabel={`Back to ${title ?? label}`}
            />
          )}
          {current ? current.content : actions ? <MenuActionList actions={actions} /> : children}
        </ScrollView>
      </BottomSheetModal>
    </MenuContext.Provider>
  );
}

/* -------------------------------------------------------------------------- */
/* Wide presentation: an anchored, portalled menu with nested panels.          */
/* -------------------------------------------------------------------------- */

type PanelProps = {
  panelRef: React.RefObject<React.ComponentRef<typeof View> | null>;
  roleLabel: string;
  style: ViewStyle;
  maxHeight: number;
  onHeight: (height: number) => void;
  children: React.ReactNode;
  testID?: string;
};

function Panel({
  panelRef,
  roleLabel,
  style,
  maxHeight,
  onHeight,
  children,
  testID,
}: PanelProps) {
  return (
    <View
      ref={panelRef}
      testID={testID}
      role="menu"
      aria-label={roleLabel}
      accessibilityLabel={roleLabel}
      onLayout={(event) => onHeight(event.nativeEvent.layout.height)}
      style={[styles.panel, style]}
    >
      <ScrollView
        className="menu-scroll"
        style={{ maxHeight: Math.max(0, maxHeight - 2) }}
        showsVerticalScrollIndicator
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: menu.padding }}
      >
        {children}
      </ScrollView>
    </View>
  );
}

function AnchoredMenu({
  open,
  onClose,
  label,
  title,
  subtitle,
  actions,
  children,
  anchorRef,
  anchorRect,
  width,
  maxHeight,
  placement = 'auto',
  testID,
}: MenuProps) {
  const { width: viewportWidth, height: viewportHeight } = useWindowDimensions();
  const presence = usePresence(open, { duration: motion.fast });
  const [anchor, setAnchor] = useState<AnchorRect | null>(anchorRect ?? null);
  const [panelHeight, setPanelHeight] = useState(0);
  const [submenu, setSubmenu] = useState<SubmenuLevel | null>(null);
  const [submenuHeight, setSubmenuHeight] = useState(0);
  const [submenuOpen, setSubmenuOpen] = useState(false);
  const levelPresence = usePresence(submenuOpen, { duration: motion.fast });
  const panelRef = useRef<React.ComponentRef<typeof View> | null>(null);
  const submenuRef = useRef<React.ComponentRef<typeof View> | null>(null);
  /** Set while a submenu is closing, so focus lands on its parent trigger. */
  const pendingFocusRef = useRef<{ target: WebFocusable | null } | null>(null);
  const returnFocusRef = useRef<WebFocusable | null>(null);
  const wasOpenRef = useRef(false);

  // Measure the trigger every time the menu opens; a page scroll, a filter or
  // a re-render can all move it.
  useEffect(() => {
    if (open || !anchorRef) return;
    setPanelHeight(0);
  }, [open, anchorRef]);

  useEffect(() => {
    if (!open) return;
    if (anchorRect) {
      setAnchor(anchorRect);
      return;
    }
    const node = anchorRef?.current as unknown as MeasurableNode | null;
    if (node?.measureInWindow) {
      node.measureInWindow((x, y, measuredWidth, measuredHeight) =>
        setAnchor({ x, y, width: measuredWidth, height: measuredHeight })
      );
      return;
    }
    if (node?.getBoundingClientRect) {
      const rect = node.getBoundingClientRect();
      setAnchor({ x: rect.left, y: rect.top, width: rect.width, height: rect.height });
    }
  }, [open, anchorRef, anchorRect]);

  const closeAll = useCallback(() => {
    pendingFocusRef.current = null;
    setSubmenu(null);
    setSubmenuOpen(false);
    onClose();
  }, [onClose]);

  const closeSubmenu = useCallback(
    (focusTrigger = true) => {
      pendingFocusRef.current = { target: focusTrigger ? (submenu?.trigger ?? null) : null };
      setSubmenuOpen(false);
    },
    [submenu]
  );

  const openSubmenu = useCallback((level: SubmenuLevel) => {
    setSubmenu(level);
    setSubmenuHeight(0);
    setSubmenuOpen(true);
  }, []);

  // Focus starts on the first choice, as a menu should; a nested level moves it
  // into the child panel. The timer lets the portal paint before we query it.
  useEffect(() => {
    if (!open) return;

    // A submenu that just closed wants its parent row focused. A hover-driven
    // close has no target and must not steal focus back to the first root item.
    if (!submenuOpen && pendingFocusRef.current !== null) {
      const { target } = pendingFocusRef.current;
      pendingFocusRef.current = null;
      if (!target) return;
      const timer = setTimeout(() => target.focus(), 24);
      return () => clearTimeout(timer);
    }

    const panel = submenuOpen
      ? (submenuRef.current as unknown as WebElement | null)
      : (panelRef.current as unknown as WebElement | null);
    const timer = setTimeout(() => {
      queryMenuItems(panel)[0]?.focus();
    }, 24);
    return () => clearTimeout(timer);
  }, [open, submenuOpen, submenu?.id]);

  // Focus returns to the control that opened the menu, not to the item that was
  // last highlighted when it closed.
  useEffect(() => {
    const doc = webDocument();
    if (open && !wasOpenRef.current) {
      returnFocusRef.current = doc?.activeElement ?? null;
    }
    if (!open && wasOpenRef.current) {
      const target = returnFocusRef.current;
      returnFocusRef.current = null;
      setTimeout(() => target?.focus(), 0);
    }
    wasOpenRef.current = open;
  }, [open]);

  // A menu is anchored to a spot on the page: scrolling or resizing the page
  // would leave it pointing at nothing, so it dismisses instead of drifting.
  useEffect(() => {
    if (!open) return;
    const doc = webDocument();
    if (!doc) return;
    const onViewportChange = (event: WebEvent) => {
      const target = event.target as unknown as WebElement | null;
      const panel = (submenuOpen ? submenuRef.current : panelRef.current) as unknown as WebElement | null;
      if (panel && target && panel.contains?.(target)) return;
      closeAll();
    };
    doc.addEventListener('scroll', onViewportChange, true);
    doc.addEventListener('resize', onViewportChange, true);
    return () => {
      doc.removeEventListener('scroll', onViewportChange, true);
      doc.removeEventListener('resize', onViewportChange, true);
    };
  }, [open, submenuOpen, closeAll]);

  // Keyboard contract: arrows move within the active panel, ArrowRight enters a
  // submenu, ArrowLeft (and Escape) leaves it, Escape closes the whole menu from
  // the root, Enter/Space activate, and Tab closes without trapping focus.
  useEffect(() => {
    if (!open) return;
    const doc = webDocument();
    if (!doc) return;

    const onKeyDown = (event: WebEvent) => {
      const key = event.key;
      if (!key) return;

      if (key === 'Escape') {
        event.preventDefault?.();
        event.stopPropagation?.();
        if (submenuOpen) closeSubmenu(true);
        else closeAll();
        return;
      }

      const panel = (submenuOpen ? submenuRef.current : panelRef.current) as unknown as WebElement | null;
      if (!panel) return;
      const active = doc.activeElement;
      if (!active || !panel.contains?.(active)) {
        if (key === 'Tab') return;
        queryMenuItems(panel)[0]?.focus();
        return;
      }

      if (key === 'Tab') {
        returnFocusRef.current?.focus();
        closeAll();
        return;
      }

      const items = queryMenuItems(panel);
      const index = items.indexOf(active);

      if (key === 'ArrowDown' || key === 'ArrowUp') {
        event.preventDefault?.();
        if (items.length === 0) return;
        const step = key === 'ArrowDown' ? 1 : -1;
        const next = index < 0 ? (step > 0 ? 0 : items.length - 1) : (index + step + items.length) % items.length;
        items[next]?.focus();
        return;
      }

      if (key === 'Home' || key === 'End') {
        event.preventDefault?.();
        (key === 'Home' ? items[0] : items[items.length - 1])?.focus();
        return;
      }

      if (key === 'ArrowRight') {
        if (active.getAttribute?.('aria-haspopup') === 'menu') {
          event.preventDefault?.();
          active.click?.();
        }
        return;
      }

      if (key === 'ArrowLeft' && submenuOpen) {
        event.preventDefault?.();
        closeSubmenu(true);
        return;
      }

      if (key === 'Enter' || key === ' ' || key === 'Spacebar') {
        const role = active.getAttribute?.('role');
        if (role?.startsWith('menuitem')) {
          event.preventDefault?.();
          active.click?.();
        }
        return;
      }

      // First-letter typeahead, capped to printable keys without a modifier.
      if (key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey) {
        const match = items.find((item) => {
          const text = item.getAttribute?.('aria-label') ?? '';
          return text.toLowerCase().startsWith(key.toLowerCase());
        });
        if (match) match.focus();
      }
    };

    doc.addEventListener('keydown', onKeyDown);
    return () => doc.removeEventListener('keydown', onKeyDown);
  }, [open, submenuOpen, closeAll, closeSubmenu]);

  if (!open && !presence.mounted) return null;

  // A menu with no measured trigger opens in the middle rather than at 0,0.
  const resolvedAnchor: AnchorRect = anchor ?? {
    x: Math.round(viewportWidth / 2),
    y: Math.round(viewportHeight / 2),
    width: 0,
    height: 0,
  };

  const position = positionPanel(
    resolvedAnchor,
    viewportWidth,
    viewportHeight,
    width ?? menu.width,
    panelHeight,
    placement,
    maxHeight ?? menu.maxHeight
  );

  const translateY = presence.value.interpolate({
    inputRange: [0, 1],
    outputRange: [position.openAbove ? 6 : -6, 0],
  });
  // Aliased out of the style object: Reanimated's babel heuristic treats any
  // `.value` it sees inline as a shared value, and warns even for Animated.Value.
  const presenceOpacity = presence.value;
  const levelOpacity = levelPresence.value;

  const context: MenuContextValue = {
    presentation: 'anchored',
    closeAll,
    closeSubmenu,
    openSubmenu,
    openSubmenuId: submenuOpen ? (submenu?.id ?? null) : null,
  };

  const submenuWidth = Math.min(menu.submenuWidth, viewportWidth - menu.viewportMargin * 2);
  const submenuRight = submenu ? submenu.anchor.x + submenu.anchor.width + menu.submenuOffset : 0;
  const submenuFitsRight = submenu
    ? submenuRight + submenuWidth <= viewportWidth - menu.viewportMargin
    : true;
  const submenuLeft = submenu
    ? clamp(
        submenuFitsRight
          ? submenuRight
          : submenu.anchor.x - submenuWidth - menu.submenuOffset,
        menu.viewportMargin,
        Math.max(menu.viewportMargin, viewportWidth - submenuWidth - menu.viewportMargin)
      )
    : menu.viewportMargin;
  const submenuMaxHeight = Math.max(
    96,
    Math.min(maxHeight ?? menu.maxHeight, viewportHeight - menu.viewportMargin * 2)
  );
  const submenuTop = submenu
    ? clamp(
        submenu.anchor.y - menu.padding,
        menu.viewportMargin,
        Math.max(
          menu.viewportMargin,
          viewportHeight -
            menu.viewportMargin -
            Math.min(submenuHeight > 0 ? submenuHeight : submenuMaxHeight, submenuMaxHeight)
        )
      )
    : menu.viewportMargin;

  const submenuTranslateX = levelPresence.value.interpolate({
    inputRange: [0, 1],
    outputRange: [submenuFitsRight ? -6 : 6, 0],
  });

  return (
    <Modal
      transparent
      visible
      animationType="none"
      // React Native Web turns Escape into a keyup dismissal before a nested
      // level can handle it; the menu's own keydown handler steps back one
      // level first. Native keeps the hardware back button.
      onRequestClose={Platform.OS === 'web' ? undefined : closeAll}
      statusBarTranslucent
      accessibilityLabel={label}
    >
      <View style={{ flex: 1 }}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={closeAll}
          accessible={false}
          focusable={false}
          importantForAccessibility="no"
        />

        <MenuContext.Provider value={context}>
          <Animated.View
            style={{
              opacity: presenceOpacity,
              transform: [{ translateY }],
              position: 'absolute',
              left: position.left,
              top: position.top,
              width: position.width,
              maxHeight: position.maxHeight,
              zIndex: 2,
            }}
          >
            <Panel
              panelRef={panelRef}
              roleLabel={label}
              testID={testID}
              maxHeight={position.maxHeight}
              onHeight={(height) => {
                if (Math.abs(height - panelHeight) > 0.5) setPanelHeight(height);
              }}
              style={{}}
            >
              {actions ? <MenuActionList actions={actions} /> : children}
            </Panel>
          </Animated.View>

          {levelPresence.mounted && submenu && (
            <Animated.View
              style={{
                opacity: levelOpacity,
                transform: [{ translateX: submenuTranslateX }],
                position: 'absolute',
                left: submenuLeft,
                top: submenuTop,
                width: submenuWidth,
                maxHeight: submenuMaxHeight,
                zIndex: 3,
              }}
            >
              <Panel
                panelRef={submenuRef}
                roleLabel={submenu.title ?? title ?? label}
                maxHeight={submenuMaxHeight}
                onHeight={(height) => {
                  if (Math.abs(height - submenuHeight) > 0.5) setSubmenuHeight(height);
                }}
                style={{}}
              >
                {submenu.content}
              </Panel>
            </Animated.View>
          )}
        </MenuContext.Provider>
      </View>
    </Modal>
  );
}

/* -------------------------------------------------------------------------- */

/**
 * Menu — the unified dropdown, popover and picker surface.
 *
 * At 640px and wider it renders an anchored, portalled panel with full ARIA
 * menu semantics, roving arrow-key focus, viewport flipping and nested levels.
 * Below that breakpoint it renders the same content as a compact, focus-trapped
 * bottom sheet, so a phone gets a thumb-sized list instead of a scaled-down
 * desktop popover. `BottomSheetModal` remains the one sheet implementation, so
 * focus return, Escape, scrim dismissal and safe-area padding are shared rather
 * than re-implemented here.
 */
export function Menu(props: MenuProps) {
  const { width } = useWindowDimensions();
  const mode =
    props.presentation === 'anchored' || props.presentation === 'sheet'
      ? props.presentation
      : width < SHEET_BREAKPOINT
        ? 'sheet'
        : 'anchored';

  if (mode === 'sheet') return <SheetMenu {...props} />;
  return <AnchoredMenu {...props} />;
}

const styles = StyleSheet.create({
  panel: {
    overflow: 'hidden',
    borderRadius: radii.menu,
    borderWidth: 1,
    // The menu is the one surface that floats over the page, so it needs a
    // visible edge. It uses the same quiet outline the v3 panes already carry
    // rather than a drop shadow, which the flat design system does not use.
    borderColor: alpha(colors.outlineSoft, 0.32),
    backgroundColor: colors.surfaceContainerHigh,
  },
});
