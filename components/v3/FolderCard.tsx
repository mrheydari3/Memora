import { Animated, View } from 'react-native';
import { MaterialIcons } from '../Icon';
import { AppText } from '../AppText';
import { HintPressable } from '../HintPressable';
import { colors, iconSize } from '../../theme/tokens';
import { v3 } from '../../theme/v3';
import { usePressFeedback } from '../../motion';
import { FolderGlyph } from './FolderGlyph';
import { ShelfStatusPill } from './ShelfStatusPill';
import { Surface } from './Surface';

type FolderCardProps = {
  name: string;
  /** The folder's own glyph; the neutral folder until one is chosen. */
  icon?: string;
  /** The folder's own colour, washed into its frame. */
  color?: string;
  /** Decks filed directly in this folder. */
  deckCount: number;
  /** Cards those decks want today. */
  due: number;
  /** Studied share across those decks, 0–1. */
  progress?: number;
  pinned?: boolean;
  onPress: () => void;
};

/**
 * FolderCard — the tablet library board's folder tile.
 *
 * The folder is a place, so it keeps its illustrated glyph on Today's raised
 * card face at the same 22px card radius as a deck card: name and its deck
 * count at the top, the shared due pill at the trailing edge, and the quiet
 * "Open folder" footer.
 * It deliberately draws no studied rail: progress belongs to the decks that can
 * be studied, not to the label that groups them.
 */
export function FolderCard({
  name,
  icon,
  color,
  deckCount,
  due,
  progress = 0,
  pinned = false,
  onPress,
}: FolderCardProps) {
  const press = usePressFeedback({ scale: 0.985 });
  const tint = color ?? colors.primary;
  const empty = deckCount === 0;
  const reviewable = !empty && due > 0;
  const deckLabel = deckCount === 1 ? 'deck' : 'decks';
  const percent = Math.round(Math.max(0, Math.min(1, progress)) * 100);
  const progressLabel = deckCount > 0 ? `${percent}% studied` : null;
  // The illustration already says "folder"; the meta line only carries what
  // the tile holds, so a name and a count do not compete.
  const meta = [
    empty ? 'No decks' : `${deckCount} ${deckLabel}`,
    progressLabel,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <Animated.View style={[press.style, { width: '100%' }]}>
      <Surface
        tone="pane"
        radius="card"
        padding="none"
        style={{
          width: '100%',
          minHeight: v3.heights.folderCard,
          overflow: 'hidden',
          position: 'relative',
          backgroundColor: colors.surfaceCardFace,
        }}
      >
        <HintPressable
          hint={reviewable ? 'Open folder to review due cards' : 'Open folder'}
          testID="folder-card"
          onPress={onPress}
          onPressIn={press.onPressIn}
          onPressOut={press.onPressOut}
          accessibilityRole="button"
          accessibilityLabel={`${reviewable ? 'Review folder' : 'Open folder'} ${name}, ${
            deckCount
          } ${deckLabel}, ${empty ? 'empty' : `${due} due`}${
            progressLabel ? `, ${progressLabel}` : ''
          }`}
          style={{
            flex: 1,
            minWidth: 0,
            justifyContent: 'space-between',
            gap: 12,
            padding: 16,
            borderRadius: v3.radii.card,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
            <FolderGlyph icon={icon} color={tint} size={48} />

            <View style={{ flex: 1, minWidth: 0 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                <AppText
                  weight="semibold"
                  numberOfLines={2}
                  style={[v3.type.deckName, { flexShrink: 1 }]}
                >
                  {name}
                </AppText>
                {pinned && (
                  <MaterialIcons name="push-pin" size={iconSize.xs} color={colors.outline} />
                )}
              </View>

              <AppText
                variant="bodySm"
                tone="tertiary"
                numberOfLines={2}
                style={{ marginTop: 3 }}
              >
                {meta}
              </AppText>
            </View>

            <ShelfStatusPill due={due} empty={empty} reviewable={reviewable} />
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <MaterialIcons
              name={reviewable ? 'play-circle' : 'folder-open'}
              size={iconSize.sm}
              color={colors.primary}
            />
            <AppText variant="caption" tone="accent" weight="semibold">
              {reviewable ? 'Review folder' : 'Open folder'}
            </AppText>
            <MaterialIcons name="chevron-right" size={iconSize.sm} color={colors.outline} />
          </View>
        </HintPressable>

      </Surface>
    </Animated.View>
  );
}
