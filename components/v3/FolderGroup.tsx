import { useState } from 'react';
import { Platform, View } from 'react-native';
import { MaterialIcons } from '../Icon';
import { AppText } from '../AppText';
import { HintPressable } from '../HintPressable';
import { colors, fills, iconSize, radii } from '../../theme/tokens';
import { v3 } from '../../theme/v3';
import { FolderGlass } from './FolderGlass';
import { FolderGlyph } from './FolderGlyph';
import { ShelfStatusPill } from './ShelfStatusPill';

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
  /** The folder's own colour, washed into the header glyph. */
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
  children?: React.ReactNode;
};

/**
 * FolderGroup — the phone's folder panel.
 *
 * A folder is a place, so it keeps its illustrated jacket, but the design now
 * draws it as one pane: a header banner that names the subtree (glyph, name,
 * pin, counts, due pill) with the expand chevron at the trailing edge, then a
 * recessed well holding the decks and child folders that live inside it. The
 * header and the well are both fills — no rail, no guide line, no frame — so
 * the level reads as one object with two depths.
 */
export function FolderGroup({
  name,
  icon,
  color,
  deckCount,
  directDecks = deckCount,
  due,
  pinned = false,
  subfolders = [],
  onOpenSubfolder,
  expanded,
  onToggle,
  children,
}: FolderGroupProps) {
  // React Native Web maps DOM ARIA props, not `accessibilityState`, onto a
  // Pressable's rendered element; the accordion's open state must reach
  // assistive tech on web as `aria-expanded`.
  const webExpanded: object =
    Platform.OS === 'web' ? { 'aria-expanded': expanded } : {};
  const [hovered, setHovered] = useState(false);

  const empty = deckCount === 0;
  const deckLabel = deckCount === 1 ? 'deck' : 'decks';
  const nestedDecks = Math.max(0, deckCount - directDecks);
  // A parent with no direct decks is not empty: name what it actually holds.
  // Child folders are listed below, so their count never needs a spot here.
  const counts =
    nestedDecks > 0
      ? `${directDecks} direct · ${nestedDecks} nested`
      : `${deckCount} ${deckLabel}`;
  // The due pill is the folder's one status mark; the meta line states what
  // the folder holds, so the number is never printed twice in one header.
  const metaLabel = empty ? 'Empty folder' : counts;
  const hasContents = Boolean(children) || subfolders.length > 0;

  return (
    <FolderGlass radius={radii.pane} padding={0} hovered={hovered} style={{ width: '100%' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingRight: 8 }}>
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
            // A folder header is a place, not a row: it stands a little taller
            // than a deck card and carries the folder art.
            minHeight: v3.heights.folderGroup,
            flex: 1,
            minWidth: 0,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            paddingLeft: 14,
            paddingRight: 4,
            paddingVertical: 10,
          }}
        >
          <FolderGlyph icon={icon} color={color} size={40} />

          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <AppText
                variant="bodyLg"
                weight="semibold"
                numberOfLines={2}
                style={{ letterSpacing: -0.1, flexShrink: 1 }}
              >
                {name}
              </AppText>
              {pinned && (
                <MaterialIcons name="push-pin" size={iconSize.xs} color={colors.outline} />
              )}
            </View>

            <View
              style={{
                marginTop: 2,
                flexDirection: 'row',
                alignItems: 'center',
                flexWrap: 'wrap',
                columnGap: 8,
                rowGap: 4,
              }}
            >
              <AppText
                variant="caption"
                tone="tertiary"
                numberOfLines={2}
                style={{ flexShrink: 1, minWidth: 0 }}
              >
                {metaLabel}
              </AppText>
              <View style={{ marginLeft: 'auto' }}>
                <ShelfStatusPill due={due} empty={empty} />
              </View>
            </View>
          </View>

          <View style={{ transform: [{ rotate: expanded ? '0deg' : '-90deg' }] }}>
            <MaterialIcons name="expand-more" size={iconSize.lg} color={colors.outline} />
          </View>
        </HintPressable>

      </View>

      {expanded && hasContents ? (
        <View style={{ paddingHorizontal: 8, paddingBottom: 8 }}>
          <View
            style={{
              gap: 6,
              padding: 6,
              borderRadius: v3.radii.control,
              backgroundColor: fills.inset,
            }}
          >
            {children}

            {subfolders.map((subfolder) => (
              <HintPressable
                key={subfolder.id}
                hint="Open folder"
                testID="folder-subitem"
                onPress={() => onOpenSubfolder?.(subfolder.id)}
                accessibilityRole="button"
                accessibilityLabel={`Open folder ${subfolder.name}, ${subfolder.decks} ${
                  subfolder.decks === 1 ? 'deck' : 'decks'
                }, ${subfolder.due} due`}
                style={{
                  minHeight: v3.heights.subfolderRow,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 10,
                  paddingHorizontal: 6,
                  paddingVertical: 6,
                  borderRadius: radii.control,
                }}
              >
                <FolderGlyph icon={subfolder.icon} color={subfolder.color} size={32} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <AppText variant="bodySm" weight="semibold" numberOfLines={1}>
                    {subfolder.name}
                  </AppText>
                  <AppText
                    variant="caption"
                    tone="tertiary"
                    numberOfLines={1}
                    style={{ marginTop: 1 }}
                  >
                    {subfolder.decks} {subfolder.decks === 1 ? 'deck' : 'decks'} ·{' '}
                    {subfolder.due} due
                  </AppText>
                </View>
                <MaterialIcons name="chevron-right" size={iconSize.sm} color={colors.outline} />
              </HintPressable>
            ))}
          </View>
        </View>
      ) : null}
    </FolderGlass>
  );
}
