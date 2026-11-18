import { View } from 'react-native';
import { MaterialIcons } from '../Icon';
import { AppText } from '../AppText';
import { HintPressable } from '../HintPressable';
import { colors, fills, iconSize, radii } from '../../theme/tokens';

type ShelfBreadcrumbsProps = {
  /** The folder the shelf is inside; null at the top level. */
  folder: { id: string; name: string } | null;
  /** Returns to the flat folder list. */
  onBack: () => void;
};

const CRUMB_HIT = 44;

/**
 * ShelfBreadcrumbs — the shelf's address while a folder is open.
 *
 * Folders are one flat level, so the path can only ever be "All decks" plus
 * the folder itself: there is no parent to walk back through. The trail sits
 * in a quiet capsule so it reads as the shelf's address, not as a row of links.
 */
export function ShelfBreadcrumbs({ folder, onBack }: ShelfBreadcrumbsProps) {
  if (!folder) return null;

  return (
    <View
      accessibilityLabel="Library path"
      style={{
        marginBottom: 14,
        alignSelf: 'flex-start',
        flexDirection: 'row',
        alignItems: 'center',
        minHeight: CRUMB_HIT,
        paddingHorizontal: 6,
        borderRadius: radii.pill,
        backgroundColor: fills.subtle,
      }}
    >
      <HintPressable
        hint="Go to all decks"
        onPress={onBack}
        accessibilityRole="button"
        accessibilityLabel="All decks"
        style={{
          minHeight: CRUMB_HIT,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 5,
          paddingHorizontal: 6,
          borderRadius: radii.control,
        }}
      >
        <MaterialIcons name="library-books" size={iconSize.sm} color={colors.primary} />
        <AppText variant="bodySm" weight="semibold" tone="accent">
          All decks
        </AppText>
      </HintPressable>

      <MaterialIcons name="chevron-right" size={iconSize.sm} color={colors.outline} />
      <View
        accessible
        accessibilityLabel={`Current folder ${folder.name}`}
        style={{
          minHeight: CRUMB_HIT,
          justifyContent: 'center',
          paddingHorizontal: 6,
          maxWidth: 220,
        }}
      >
        <AppText variant="bodySm" weight="semibold" numberOfLines={1}>
          {folder.name}
        </AppText>
      </View>
    </View>
  );
}
