import { createContext, useContext } from 'react';
import type { MenuPresentation, SubmenuLevel } from './types';

export type MenuContextValue = {
  presentation: MenuPresentation;
  closeAll: () => void;
  /**
   * Close the current nested level. `focusTrigger` is false for hover-driven
   * changes (the pointer is already choosing another row) and true for Escape
   * or ArrowLeft, where focus must return to the parent item.
   */
  closeSubmenu: (focusTrigger?: boolean) => void;
  openSubmenu: (level: SubmenuLevel) => void;
  openSubmenuId: string | null;
};

export const MenuContext = createContext<MenuContextValue | null>(null);

export function useMenuContext(): MenuContextValue {
  const value = useContext(MenuContext);
  if (!value) throw new Error('Menu components must be used inside <Menu>.');
  return value;
}
