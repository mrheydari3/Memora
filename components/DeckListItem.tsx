import { ListRow } from './ListRow';

type IconName = React.ComponentProps<typeof import('@expo/vector-icons').MaterialIcons>['name'];

type DeckListItemProps = {
  name: string;
  icon: IconName;
  color: string;
  meta?: string;
  onPress?: () => void;
  trailing?: React.ReactNode;
  divider?: boolean;
};

/**
 * DeckListItem — a deck row inside a glass group: a 44px tile in the deck's own
 * colour, a 15px semibold name, a 13px meta line. All geometry comes from
 * `ListRow`, so it matches settings and import rows.
 */
export function DeckListItem({
  name,
  icon,
  color,
  meta,
  onPress,
  trailing,
  divider = true,
}: DeckListItemProps) {
  return (
    <ListRow
      title={name}
      subtitle={meta}
      icon={icon}
      tile="lg"
      density="tall"
      iconTone="deck"
      deckColor={color}
      titleWeight="semibold"
      trailing={trailing}
      divider={divider}
      onPress={onPress}
      // No explicit label: the row's own title and meta line name it, and a
      // label that omits the visible meta text fails WCAG 2.5.3.
    />
  );
}
