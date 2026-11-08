import { MenuItem, MenuLabel, MenuSeparator } from './MenuItem';
import type { MenuAction } from './types';

/**
 * MenuActionList — turns a declarative action array into the same MenuItem
 * primitives a hand-composed menu uses, so a caller never grows a second menu
 * vocabulary for a simple list.
 */
export function MenuActionList({ actions }: { actions: MenuAction[] }) {
  return (
    <>
      {actions.map((action) => {
        if (action.kind === 'separator') return <MenuSeparator key={action.key} />;
        if (action.kind === 'label') return <MenuLabel key={action.key} label={action.label} />;

        return (
          <MenuItem
            key={action.key}
            label={action.label}
            description={action.description}
            icon={action.icon}
            selected={action.selected}
            destructive={action.destructive}
            disabled={action.disabled}
            submenu={
              action.submenu && action.submenu.length > 0 ? (
                <MenuActionList actions={action.submenu} />
              ) : undefined
            }
            submenuTitle={action.submenuTitle}
            keepOpen={action.keepOpen}
            onPress={action.onPress}
            testID={action.testID}
            accessibilityLabel={action.accessibilityLabel}
          />
        );
      })}
    </>
  );
}
