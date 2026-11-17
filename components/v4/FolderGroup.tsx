import { Children, useState } from 'react';
import { Platform, useWindowDimensions, View } from 'react-native';
import { MaterialIcons } from '../Icon';
import { AppText } from '../AppText';
import { HintPressable } from '../HintPressable';
import { DueFigure } from './DueFigure';
import { SubfolderRow } from './SubfolderRow';
import { colors } from '../../theme/tokens';
import { v4 } from '../../theme/v4';

type IconName = React.ComponentProps<typeof MaterialIcons>['name'];

export type FolderSubItem = {
  id: string;
  name: string;
  icon?: string;
  color?: string;
  /** Decks anywhere in the subfolder's subtree. */
  decks: number;
  due: number;
};

type FolderGroupProps = {
  name: string;
  /** The folder's own glyph; the neutral folder until one is chosen. */
  icon?: string;
  /** The folder's own colour, worn by the 20px folder mark. */
  color?: string;
  /** Decks anywhere in this folder's subtree. */
  deckCount: number;
  /** Decks filed directly in this folder, not in a child folder. */
  directDecks?: number;
  /** Cards those decks want today, rolled through the subtree. */
  due: number;
  pinned?: boolean;
  /** How many folders sit one level below, for the header split. */
  nestedFolders?: number;
  /** Those folders, listed under the group as sub-items. */
  subfolders?: FolderSubItem[];
  onOpenSubfolder?: (id: string) => void;
  expanded: boolean;
  onToggle: () => void;
  /** Opens the composer with this folder already selected. */
  onAddDeck?: () => void;
  children?: React.ReactNode;
};

/**
 * FolderGroup — a root folder opened inline on the shelf.
 *
 * The header is a printed line: folder mark, name, pin, the honest count split
 * and the due figure; the chevron is the only chrome. Its body hangs from one
 * warm guide line, holding the folder's direct decks and the child-folder doors.
 * An empty folder still opens: it says so and offers the one useful action.
 */
export function FolderGroup({
  name,
  icon,
  color,
  deckCount,
  directDecks = deckCount,
  due,
  pinned = false,
  nestedFolders = 0,
  subfolders = [],
  onOpenSubfolder,
  expanded,
  onToggle,
  onAddDeck,
  children,
}: FolderGroupProps) {
  const { width } = useWindowDimensions();
  const wide = width >= v4.layout.wide;
  const [hovered, setHovered] = useState(false);

  const webExpanded: object = Platform.OS === 'web' ? { 'aria-expanded': expanded } : {};
  const empty = deckCount === 0;
  const nestedDecks = Math.max(0, deckCount - directDecks);
  // A parent with no direct decks is not empty: name what it actually holds.
  const counts =
    nestedDecks > 0
      ? `${directDecks} direct · ${nestedDecks} nested`
      : nestedFolders > 0 && deckCount === 0
        ? `${nestedFolders} nested folder${nestedFolders === 1 ? '' : 's'}`
        : `${deckCount} ${deckCount === 1 ? 'deck' : 'decks'}`;
  const metaLabel = empty && nestedFolders === 0 ? 'Empty folder' : counts;
  // A caller may pass an empty list plus a conditional footer; only real nodes
  // make the folder non-empty, so its "No decks inside yet" state still shows.
  const hasContents = Children.toArray(children).length > 0 || subfolders.length > 0;

  return (
    <View>
      <HintPressable
        hint={expanded ? 'Collapse folder' : 'Expand folder'}
        onHoverIn={() => setHovered(true)}
        onHoverOut={() => setHovered(false)}
        testID="folder-group"
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        {...webExpanded}
        style={{
          minHeight: 44,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          paddingTop: wide ? v4.row.folderPaddingWide : v4.row.folderPadding,
          paddingBottom: wide ? v4.row.folderPaddingWide : v4.row.folderPadding,
          paddingRight: 2,
          borderBottomWidth: 1,
          borderBottomColor: colors.v4Line,
          backgroundColor: hovered ? colors.v4Wash : 'transparent',
        }}
      >
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={{ width: 22, flexShrink: 0, alignItems: 'flex-start' }}
        >
          <MaterialIcons
            name={(icon ?? 'folder') as IconName}
            size={20}
            color={color ?? colors.outline}
          />
        </View>

        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <AppText
              weight="semibold"
              numberOfLines={2}
              style={[v4.type.folderName, { flexShrink: 1 }]}
            >
              {name}
            </AppText>
            {pinned ? (
              <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                <MaterialIcons name="push-pin" size={11} color={colors.outline} />
              </View>
            ) : null}
          </View>
          <AppText
            numberOfLines={1}
            style={[v4.type.folderMeta, { marginTop: 3, color: colors.outline }]}
          >
            {metaLabel}
          </AppText>
        </View>

        <DueFigure value={due} kind="folder" testID="folder-due" clearLabel="empty" />

        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={{
            width: 16,
            flexShrink: 0,
            transform: [{ rotate: expanded ? '0deg' : '-90deg' }],
          }}
        >
          <MaterialIcons name="expand-more" size={16} color={colors.outline} />
        </View>
      </HintPressable>

      {expanded ? (
        <View
          style={{
            marginLeft: wide ? v4.layout.folderGuideInsetWide : v4.layout.folderGuideInset,
            paddingLeft: wide ? v4.layout.folderIndentWide : v4.layout.folderIndent,
            borderLeftWidth: 1,
            borderLeftColor: colors.v4LineStrong,
            marginBottom: 6,
          }}
        >
          {hasContents ? (
            <>
              {children}
              {subfolders.map((subfolder, index) => (
                <SubfolderRow
                  key={subfolder.id}
                  name={subfolder.name}
                  icon={subfolder.icon}
                  color={subfolder.color}
                  decks={subfolder.decks}
                  due={subfolder.due}
                  onPress={() => onOpenSubfolder?.(subfolder.id)}
                  last={index === subfolders.length - 1}
                />
              ))}
            </>
          ) : (
            <View
              style={{
                minHeight: 44,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 14,
                paddingVertical: 18,
                paddingRight: 2,
              }}
            >
              <AppText style={[v4.type.meta, { color: colors.onSurfaceVariant, flexShrink: 1 }]}>
                No decks inside yet.
              </AppText>
              {onAddDeck ? (
                <HintPressable
                  hint="Create a deck in this folder"
                  onPress={onAddDeck}
                  accessibilityRole="button"
                  accessibilityLabel="Add a deck"
                  style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 4 }}
                >
                  <AppText
                    style={[
                      v4.type.control,
                      { color: colors.v4Saffron, fontWeight: '600' },
                    ]}
                  >
                    Add a deck
                  </AppText>
                </HintPressable>
              ) : null}
            </View>
          )}
        </View>
      ) : null}
    </View>
  );
}
