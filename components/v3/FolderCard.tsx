import { Animated, View } from 'react-native';
import { MaterialIcons } from '../Icon';
import { AppText } from '../AppText';
import { HintPressable } from '../HintPressable';
import { alpha, colors, fills, iconSize, radii } from '../../theme/tokens';
import { v3 } from '../../theme/v3';
import { usePressFeedback } from '../../motion';
import { Surface } from './Surface';

type IconName = React.ComponentProps<typeof MaterialIcons>['name'];

type FolderCardProps = {
  name: string;
  /** The folder's own glyph; the neutral folder until one is chosen. */
  icon?: string;
  /** The folder's own colour, washed into its tile. */
  color?: string;
  /** Decks anywhere in this folder's subtree. */
  deckCount: number;
  /** Cards those decks want today, rolled through the subtree. */
  due: number;
  /** Folders nested below this one. */
  nestedFolders?: number;
  pinned?: boolean;
  onPress: () => void;
};

const NUMERIC = { fontVariant: ['tabular-nums'] as const };

/**
 * FolderCard — the desktop library board's folder tile.
 *
 * A folder is a place, not a deck, so it keeps the deck row's geometry (44px
 * glyph, 17/24 name, one quiet line) but trades the studied rail for an
 * "Open folder" affordance. The due tile mirrors the deck row's, so a folder
 * with cards waiting still reads at a glance. The mobile shelf keeps the
 * accordion; this card is only composed at desktop widths.
 */
export function FolderCard({
  name,
  icon,
  color,
  deckCount,
  due,
  nestedFolders = 0,
  pinned = false,
  onPress,
}: FolderCardProps) {
  const press = usePressFeedback({ scale: 0.985 });
  const tint = color ?? colors.primary;
  const empty = deckCount === 0;
  const caughtUp = !empty && due === 0;
  const deckLabel = deckCount === 1 ? 'deck' : 'decks';
  const folderLabel = nestedFolders === 1 ? 'folder' : 'folders';
  const meta = empty
    ? 'Empty folder'
    : nestedFolders > 0
      ? `${deckCount} ${deckLabel} · ${nestedFolders} ${folderLabel}`
      : `${deckCount} ${deckLabel}`;

  return (
    <Animated.View style={[press.style, { width: '100%' }]}>
      <Surface tone="pane" radius="card" padding="sm" style={{ width: '100%' }}>
        <HintPressable
          hint="Open folder"
          testID="folder-card"
          onPress={onPress}
          onPressIn={press.onPressIn}
          onPressOut={press.onPressOut}
          accessibilityRole="button"
          accessibilityLabel={`Open folder ${name}, ${deckCount} ${deckLabel}, ${due} due`}
          style={{ flex: 1, minWidth: 0 }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: alpha(tint, 0.15),
                flexShrink: 0,
              }}
            >
              <MaterialIcons
                name={(icon ?? 'folder') as IconName}
                size={iconSize.xl}
                color={tint}
              />
            </View>

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
                  gap: 4,
                  marginTop: 8,
                }}
              >
                <AppText variant="caption" tone="tertiary">
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
      </Surface>
    </Animated.View>
  );
}
