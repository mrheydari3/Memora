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
  /** Decks directly inside this folder. */
  deckCount: number;
  /** Cards those decks want today. */
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
 *   rotates rather than swapping glyphs. Children sit ml-2 pl-1.5 inside a 15%
 *   the token guide line, 10px apart.
 *
 * The header is a control, not a pane, so containment reads as structure rather
 * than as another deck.
 */
export function FolderGroup({
  name,
  icon,
  color,
  deckCount,
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
  const countLabel = `${deckCount} ${deckLabel} · ${due} due`;

  return (
    <View>
      <HintPressable
        hint={expanded ? 'Collapse folder' : 'Expand folder'}
        testID="folder-group"
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        {...webExpanded}
        accessibilityLabel={`${name}, ${countLabel}`}
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
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 }}>
          <MaterialIcons
            name={(icon ?? 'folder') as IconName}
            size={iconSize.lg}
            color={color ?? colors.primary}
          />
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
              style={{ letterSpacing: 0.5 }}
            >
              {countLabel}
            </AppText>
          </View>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 0 }}>
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
