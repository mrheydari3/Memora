import { useState } from 'react';
import { Animated, View } from 'react-native';
import { MaterialIcons } from '../Icon';
import { AppText } from '../AppText';
import { HintPressable } from '../HintPressable';
import { alpha, colors, fills, iconSize, stateColors } from '../../theme/tokens';
import { v3 } from '../../theme/v3';
import { usePressFeedback } from '../../motion';
import { FolderGlass } from './FolderGlass';
import { FolderGlyph } from './FolderGlyph';

const NUMERIC = { fontVariant: ['tabular-nums'] as const };

type FolderCardProps = {
  name: string;
  /** The folder's own glyph; the neutral folder until one is chosen. */
  icon?: string;
  /** The folder's own colour, washed into its frame. */
  color?: string;
  /** Decks anywhere in this folder's subtree. */
  deckCount: number;
  /** Cards those decks want today, rolled through the subtree. */
  due: number;
  /** Studied share across the subtree, 0–1. */
  progress?: number;
  /** Folders nested below this one. */
  nestedFolders?: number;
  pinned?: boolean;
  onPress: () => void;
};

/**
 * FolderCard — the desktop library board's folder tile.
 *
 * A folder is a place, not a deck, so it trades the studied rail for an "Open
 * folder" affordance. Its glass jacket and folder-shaped glyph frame make it
 * read as a folder beside the darker deck panes, while the due tile keeps the
 * folder's waiting cards legible. The mobile shelf keeps the accordion; this
 * card is only composed at desktop widths.
 */
export function FolderCard({
  name,
  icon,
  color,
  deckCount,
  due,
  progress = 0,
  nestedFolders = 0,
  pinned = false,
  onPress,
}: FolderCardProps) {
  const press = usePressFeedback({ scale: 0.985 });
  const [hovered, setHovered] = useState(false);
  const tint = color ?? colors.primary;
  const empty = deckCount === 0;
  const deckLabel = deckCount === 1 ? 'deck' : 'decks';
  const folderLabel = nestedFolders === 1 ? 'folder' : 'folders';
  const percent = Math.round(Math.max(0, Math.min(1, progress)) * 100);
  const progressLabel = deckCount > 0 ? `${percent}% studied` : null;
  // The illustration already says "folder"; the meta line only carries what
  // the tile holds, so a name and a count do not compete.
  const meta = [
    empty ? 'No decks' : `${deckCount} ${deckLabel}`,
    nestedFolders > 0 ? `${nestedFolders} ${folderLabel}` : null,
    progressLabel,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <Animated.View style={[press.style, { width: '100%' }]}>
      <FolderGlass
        hovered={hovered}
        style={{ width: '100%', minHeight: v3.heights.folderCard }}
      >
        <HintPressable
          hint="Open folder"
          testID="folder-card"
          onPress={onPress}
          onPressIn={press.onPressIn}
          onPressOut={press.onPressOut}
          onHoverIn={() => setHovered(true)}
          onHoverOut={() => setHovered(false)}
          accessibilityRole="button"
          accessibilityLabel={`Open folder ${name}, ${deckCount} ${deckLabel}, ${due} due${progressLabel ? `, ${progressLabel}` : ''}`}
          style={{ flex: 1, minWidth: 0, justifyContent: 'center' }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <FolderGlyph icon={icon} color={tint} size={48} />

            <View style={{ flex: 1, minWidth: 0 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <AppText
                  weight="semibold"
                  numberOfLines={2}
                  style={[v3.type.deckName, { flexShrink: 1 }]}
                >
                  {name}
                </AppText>
                {pinned && <MaterialIcons name="push-pin" size={13} color={colors.outline} />}
              </View>

              <AppText variant="bodySm" tone="tertiary" numberOfLines={1} style={{ marginTop: 2 }}>
                {meta}
              </AppText>

              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 5,
                  marginTop: 8,
                }}
              >
                <MaterialIcons
                  name="folder-open"
                  size={iconSize.sm}
                  color={colors.primary}
                />
                <AppText variant="caption" tone="accent" weight="semibold">
                  Open folder
                </AppText>
                <MaterialIcons name="chevron-right" size={iconSize.sm} color={colors.outline} />
              </View>
            </View>

            <View
              style={{
                minWidth: 44,
                alignItems: 'center',
                justifyContent: 'center',
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderRadius: 12,
                backgroundColor: empty
                  ? fills.inset
                  : due > 0
                    ? alpha(colors.primary, 0.1)
                    : alpha(colors.success, 0.1),
                flexShrink: 0,
              }}
            >
              {empty ? (
                <>
                  <AppText
                    variant="title"
                    tone="tertiary"
                    style={[v3.type.stat, NUMERIC]}
                  >
                    —
                  </AppText>
                  <AppText
                    variant="caption"
                    weight="semibold"
                    tone="muted"
                    className="uppercase"
                    style={{ lineHeight: 14, letterSpacing: 0.6 }}
                  >
                    empty
                  </AppText>
                </>
              ) : due > 0 ? (
                <>
                  <AppText variant="title" tone="accent" style={[v3.type.stat, NUMERIC]}>
                    {due}
                  </AppText>
                  <AppText
                    variant="caption"
                    weight="semibold"
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
                    variant="caption"
                    weight="semibold"
                    tone="success"
                    className="uppercase"
                    style={{ lineHeight: 14, letterSpacing: 0.6 }}
                  >
                    clear
                  </AppText>
                </>
              )}
            </View>
          </View>
        </HintPressable>

        {/* A folder is a place with a completion state too: the same quiet
            studied rail as its decks, summed through the subtree. */}
        {deckCount > 0 && (
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
    </Animated.View>
  );
}
