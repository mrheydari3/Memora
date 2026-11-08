import type { ReactNode } from 'react';
import type { MaterialIcons } from '../Icon';

export type IconName = React.ComponentProps<typeof MaterialIcons>['name'];

/** A trigger's viewport rectangle, used to anchor a floating panel. */
export type AnchorRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

/** Anchored on a wide canvas, a sheet on a narrow one. */
export type MenuPresentation = 'anchored' | 'sheet';

/**
 * One declarative menu entry.
 *
 * `selected` turns an item into a single-choice option (`menuitemradio` when
 * anchored). `submenu` makes it a parent item with a nested level. Action menus
 * leave `selected` undefined, so they keep plain `menuitem` semantics.
 */
export type MenuAction = {
  key: string;
  /** A separator or a group label instead of a pressable row. */
  kind?: 'item' | 'separator' | 'label';
  label: string;
  description?: string;
  icon?: IconName;
  destructive?: boolean;
  disabled?: boolean;
  selected?: boolean;
  submenu?: MenuAction[];
  submenuTitle?: string;
  /** Keep the menu open after this action, for repeatable rows like pin/move. */
  keepOpen?: boolean;
  onPress?: () => void;
  testID?: string;
  accessibilityLabel?: string;
};

/** A focusable DOM element, typed narrowly so no file needs the DOM lib. */
export type WebFocusable = {
  focus: () => void;
};

/** One open nested level. */
export type SubmenuLevel = {
  id: string;
  title: string;
  content: ReactNode;
  anchor: AnchorRect;
  trigger: WebFocusable | null;
};
