import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { Menu } from './Menu';
import type { AnchorRect, MenuAction } from './types';

type WebContextEvent = {
  clientX?: number;
  clientY?: number;
  preventDefault?: () => void;
};

type WebContextNode = {
  addEventListener: (type: 'contextmenu', listener: (event: WebContextEvent) => void) => void;
  removeEventListener: (type: 'contextmenu', listener: (event: WebContextEvent) => void) => void;
};

type ContextMenuProps = {
  /** The context menu's accessible name. */
  label: string;
  actions: MenuAction[];
  children: React.ReactNode;
  width?: number;
};

/**
 * ContextMenu — the desktop right-click equivalent of an ActionMenu.
 *
 * The wrapper listens for the browser's native `contextmenu` event on its own
 * node (no DOM library is needed), suppresses the browser menu, and opens the
 * unified Menu at the pointer. It is deliberately additive: the visible
 * overflow control remains the accessible, touch-friendly path, while a mouse
 * user gets the same actions where they already expect them.
 */
export function ContextMenu({ label, actions, children, width }: ContextMenuProps) {
  const wrapperRef = useRef<React.ComponentRef<typeof View>>(null);
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<AnchorRect | null>(null);

  useEffect(() => {
    const node = wrapperRef.current as unknown as WebContextNode | null;
    if (!node?.addEventListener) return;

    const onContextMenu = (event: WebContextEvent) => {
      event.preventDefault?.();
      setAnchor({
        x: Math.round(event.clientX ?? 0),
        y: Math.round(event.clientY ?? 0),
        width: 0,
        height: 0,
      });
      setOpen(true);
    };

    node.addEventListener('contextmenu', onContextMenu);
    return () => node.removeEventListener('contextmenu', onContextMenu);
  }, []);

  return (
    <View ref={wrapperRef} collapsable={false} style={{ width: '100%' }}>
      {children}
      <Menu
        open={open}
        onClose={() => setOpen(false)}
        anchorRect={anchor}
        label={label}
        title={label}
        actions={actions}
        width={width}
      />
    </View>
  );
}
