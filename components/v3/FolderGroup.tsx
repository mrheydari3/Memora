import { Platform, View } from 'react-native';
import { MaterialIcons } from '../Icon';
import { AppText } from '../AppText';
import { HintPressable } from '../HintPressable';
import { colors, iconSize, radii } from '../../theme/tokens';
import { v3 } from '../../theme/v3';

type IconName = React.ComponentProps<typeof MaterialIcons>['name'];

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
  /** Folders nested one level below, still reachable by opening the folder. */
  nestedFolders?: number;
  expanded: boolean;
  onToggle: () => void;
  /** Opens the folder itself (nested folders live one level in). */
  onOpen?: () => void;
  children?: React.ReactNode;
};

/**
 * FolderGroup — the mockup's folder group, measured against its classes:
 *
 *   header px-3 py-2 rounded-xl on surface-inset, folder glyph 20 in the accent;
 *   name 15/600; the count pill is 12/600 uppercase on surface-control and turns
 *   green only when the folder has nothing due; pin 16 and a 20px chevron that
 *   rotates rather than swapping glyphs. A parent with a direct/nested split
 *   puts the count under the name and moves due into its own chip, so neither
 *   the name nor the split is clipped at 320. Children sit ml-2 pl-1.5 inside a
 *   15% the token guide line, 10px apart.
 *
 * The header is a control, not a pane, so containment reads as structure rather
 * than as another deck.
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
  expanded,
  onToggle,
  onOpen,
  children,
}: FolderGroupProps) {
  // React Native Web maps DOM ARIA props, not `accessibilityState`, onto a
  // Pressable's rendered element; the accordion's open state must reach
  // assistive tech on web as `aria-expanded`.
  const webExpanded: object =
    Platform.OS === 'web' ? { 'aria-expanded': expanded } : {};

  const caughtUp = due === 0;
  const deckLabel = deckCount === 1 ? 'deck' : 'decks';
  const nestedDecks = Math.max(0, deckCount - directDecks);
  const countLabel = `${deckCount} ${deckLabel} · ${due} due`;
  // A parent with no direct decks is not empty: name what it actually holds.
  // The due figure moves to its own line so the direct/nested split stays
  // readable at 320 without pushing the folder name out of the row.
  const splitLabel =
    nestedDecks > 0 ? `${directDecks} direct · ${nestedDecks} nested` : countLabel;

  return (
    <View>
      <HintPressable
        hint={expanded ? 'Collapse folder' : 'Expand folder'}
        testID="folder-group"
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        {...webExpanded}
        style={{
          minHeight: 48,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          paddingHorizontal: 12,
          paddingVertical: 8,
          borderRadius: 14,
          backgroundColor: colors.surfaceInset,
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            flexShrink: 1,
            minWidth: 0,
          }}
        >
          <MaterialIcons
            name={(icon ?? 'folder') as IconName}
            size={iconSize.lg}
            color={color ?? colors.primary}
          />
          {nestedDecks > 0 ? (
            <View style={{ minWidth: 0, flexShrink: 1 }}>
              <AppText
                variant="body"
                weight="semibold"
                numberOfLines={1}
                style={{ flexShrink: 1, letterSpacing: -0.1 }}
              >
                {name}
              </AppText>
              <View
                style={{
                  alignSelf: 'flex-start',
                  maxWidth: '100%',
                  marginTop: 2,
                  paddingHorizontal: 8,
                  paddingVertical: 2,
                  borderRadius: radii.pill,
                  backgroundColor: colors.surfaceControl,
                }}
              >
                <AppText
                  variant="caption"
                  weight="semibold"
                  tone={caughtUp ? 'success' : 'accent'}
                  className="uppercase"
                  numberOfLines={2}
                  style={{ letterSpacing: 0.5 }}
                >
                  {splitLabel}
                </AppText>
              </View>
            </View>
          ) : (
            <>
              <AppText
                variant="body"
                weight="semibold"
                numberOfLines={1}
                style={{ flexShrink: 1, letterSpacing: -0.1 }}
              >
                {name}
              </AppText>
              <View
                style={{
                  paddingHorizontal: 8,
                  paddingVertical: 2,
                  borderRadius: radii.pill,
                  backgroundColor: colors.surfaceControl,
                }}
              >
                <AppText
                  variant="caption"
                  weight="semibold"
                  tone={caughtUp ? 'success' : 'accent'}
                  className="uppercase"
                  numberOfLines={1}
                  style={{ letterSpacing: 0.5 }}
                >
                  {countLabel}
                </AppText>
              </View>
            </>
          )}
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 0 }}>
          {nestedDecks > 0 && (
            <View
              style={{
                minWidth: 36,
                paddingHorizontal: 6,
                paddingVertical: 2,
                borderRadius: 10,
                backgroundColor: colors.surfaceControl,
              }}
            >
              <AppText
                variant="caption"
                weight="semibold"
                tone={caughtUp ? 'success' : 'accent'}
                style={{ textAlign: 'center', lineHeight: 14, fontVariant: ['tabular-nums'] }}
              >
                {due}
                {'\n'}due
              </AppText>
            </View>
          )}
          {pinned && <MaterialIcons name="push-pin" size={iconSize.sm} color={colors.outline} />}
          <View style={{ transform: [{ rotate: expanded ? '0deg' : '-90deg' }] }}>
            <MaterialIcons name="expand-more" size={iconSize.lg} color={colors.outline} />
          </View>
        </View>
      </HintPressable>

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

          {nestedFolders > 0 && (
            <HintPressable
              hint="Open folder"
              onPress={onOpen}
              accessibilityRole="button"
              style={{
                minHeight: 44,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                paddingHorizontal: 4,
              }}
            >
              <MaterialIcons name="folder-open" size={iconSize.sm} color={colors.outline} />
              <AppText variant="caption" tone="tertiary" style={{ flexShrink: 1 }}>
                {nestedFolders} {nestedFolders === 1 ? 'folder' : 'folders'} inside
              </AppText>
              <MaterialIcons name="chevron-right" size={iconSize.sm} color={colors.outline} />
            </HintPressable>
          )}
        </View>
      )}
    </View>
  );
}
