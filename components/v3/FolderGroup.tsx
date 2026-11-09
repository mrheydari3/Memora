import { useState } from 'react';
import { Platform, useWindowDimensions, View } from 'react-native';
import { MaterialIcons } from '../Icon';
import { AppText } from '../AppText';
import { HintPressable } from '../HintPressable';
import { alpha, colors, fills, iconSize, radii, stateColors } from '../../theme/tokens';
import { v3 } from '../../theme/v3';
import { FolderGlass } from './FolderGlass';
import { FolderGlyph } from './FolderGlyph';

/** A folder directly inside this one, shown as a sub-item in the group. */
const NUMERIC = { fontVariant: ['tabular-nums'] as const };

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
  /** Studied share across the subtree, 0–1. */
  progress?: number;
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
 * FolderGroup — the phone's folder group.
 *
 * The header is a tall glass jacket with illustrated folder artwork, so the
 * chosen icon sits on the folder rather than replacing it. It remains an
 * accordion control, not a card: the count and chevron stay on the same line,
 * and its children sit under the quiet guide line. Child folders are listed
 * there as real sub-items, not collapsed into an "N folders inside" link.
 */
export function FolderGroup({
  name,
  icon,
  color,
  deckCount,
  directDecks = deckCount,
  due,
  progress = 0,
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
  const { width } = useWindowDimensions();
  const narrow = width < 380;

  const empty = deckCount === 0;
  const caughtUp = due === 0 && !empty;
  const percent = Math.round(Math.max(0, Math.min(1, progress)) * 100);
  const progressLabel = empty ? null : `${percent}% studied`;
  const deckLabel = deckCount === 1 ? 'deck' : 'decks';
  const nestedDecks = Math.max(0, deckCount - directDecks);
  // A parent with no direct decks is not empty: name what it actually holds.
  // Child folders are listed below, so their count never needs a spot here.
  const counts =
    nestedDecks > 0
      ? `${directDecks} direct · ${nestedDecks} nested`
      : `${deckCount} ${deckLabel}`;
  // At 320 a 48px glyph, the status tile and the chevron would leave the name
  // under 100px, so the due figure folds into the meta line instead.
  const metaLabel =
    (narrow
      ? empty
        ? 'Empty folder'
        : `${deckCount} ${deckLabel} · ${due} due`
      : counts) + (progressLabel ? ` · ${progressLabel}` : '');

  return (
    <View>
      <FolderGlass
        radius={radii.pane}
        padding={0}
        hovered={hovered}
        style={{ width: '100%' }}
      >
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
            // A folder group is a place, not a row: it stands taller than a
            // deck card and carries the same 48px folder art as the board.
            minHeight: v3.heights.folderGroup,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            paddingHorizontal: 16,
            paddingVertical: 12,
            borderRadius: radii.pane,
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',            gap: 12,
            flexShrink: 1,
            minWidth: 0,
          }}
        >
            <FolderGlyph icon={icon} color={color} size={48} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <AppText
                variant="bodyLg"
                weight="semibold"
                numberOfLines={narrow ? 2 : 1}
                style={{ letterSpacing: -0.1 }}
              >
                {name}
              </AppText>
              <AppText
                variant="caption"
                tone="tertiary"
                numberOfLines={1}
                style={{ marginTop: 2 }}
              >
                {metaLabel}
              </AppText>
            </View>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            {/* One status tile, the same one the desktop folder carries: the
                large figure answers "what is waiting here", so the meta line
                never has to repeat the due count. */}
            {!narrow && (
            <View
              style={{
                minWidth: 44,
                paddingHorizontal: 8,
                paddingVertical: 4,
                borderRadius: radii.control,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: empty
                  ? fills.inset
                  : due > 0
                    ? alpha(colors.primary, 0.1)
                    : alpha(colors.success, 0.1),
              }}
            >
              {empty ? (
                <>
                  <AppText variant="headline" weight="semibold" tone="tertiary" style={NUMERIC}>
                    —
                  </AppText>
                  <AppText
                    variant="label"
                    tone="muted"
                    className="uppercase"
                    style={{ lineHeight: 14, letterSpacing: 0.6 }}
                  >
                    empty
                  </AppText>
                </>
              ) : due > 0 ? (
                <>
                  <AppText variant="headline" weight="semibold" tone="accent" style={NUMERIC}>
                    {due}
                  </AppText>
                  <AppText
                    variant="label"
                    tone="accent"
                    className="uppercase"
                    style={{ lineHeight: 14, letterSpacing: 0.6 }}
                  >
                    due
                  </AppText>
                </>
              ) : (
                <>
                  <MaterialIcons name="done-all" size={18} color={colors.success} />
                  <AppText
                    variant="label"
                    tone="success"
                    className="uppercase"
                    style={{ lineHeight: 14, letterSpacing: 0.6 }}
                  >
                    clear
                  </AppText>
                </>
              )}
            </View>
            )}
            {pinned && <MaterialIcons name="push-pin" size={iconSize.sm} color={colors.outline} />}
            <View style={{ transform: [{ rotate: expanded ? '0deg' : '-90deg' }] }}>
              <MaterialIcons name="expand-more" size={iconSize.lg} color={colors.outline} />
            </View>
          </View>
        </HintPressable>

        {!empty && (
          <View
            pointerEvents="none"
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 0,
              height: 3,
              backgroundColor: colors.surfaceControl,
            }}
          >
            <View
              style={{
                width: `${percent}%`,
                height: '100%',
                backgroundColor: stateColors.Review,
              }}
            />
          </View>
        )}
      </FolderGlass>

      {expanded && (
        <View
          style={{
            marginTop: 10,
            marginStart: 8,
            paddingStart: 6,
            borderStartWidth: 1,
            borderStartColor: colors.outlineVariant,
            gap: 10,
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
              <FolderGlyph icon={subfolder.icon} color={subfolder.color} size={34} />
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
      )}
    </View>
  );
}
