import { ScrollView, View } from 'react-native';
import { MaterialIcons } from '../Icon';
import { AppText } from '../AppText';
import { HintPressable } from '../HintPressable';
import { colors, fills, iconSize, radii } from '../../theme/tokens';

type ShelfBreadcrumbsProps = {
  /** Every folder from the top level down to the open folder, inclusive. */
  trail: { id: string; name: string }[];
  /** `null` returns to the top level. */
  onNavigate: (folderId: string | null) => void;
};

const CRUMB_HIT = 44;

/**
 * ShelfBreadcrumbs — the library's path back through the folder tree.
 *
 * The old back link could only reach the parent, which made a nested folder a
 * one-way trip on a phone. This keeps every ancestor in the path, including
 * "All decks", and scrolls horizontally instead of squeezing a long name. The
 * trail sits in a quiet capsule so it reads as the shelf's address rather than
 * as a row of unrelated links.
 */
export function ShelfBreadcrumbs({ trail, onNavigate }: ShelfBreadcrumbsProps) {
  if (trail.length === 0) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      accessibilityLabel="Library path"
      style={{ marginBottom: 14, flexGrow: 0 }}
      contentContainerStyle={{
        alignItems: 'center',
        minHeight: CRUMB_HIT,
        paddingHorizontal: 6,
        borderRadius: radii.pill,
        backgroundColor: fills.subtle,
      }}
    >
      <HintPressable
        hint="Go to all decks"
        onPress={() => onNavigate(null)}
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

      {trail.map((folder, index) => {
        const current = index === trail.length - 1;
        return (
          <View key={folder.id} style={{ flexDirection: 'row', alignItems: 'center' }}>
            <MaterialIcons name="chevron-right" size={iconSize.sm} color={colors.outline} />
            {current ? (
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
            ) : (
              <HintPressable
                hint={`Go to ${folder.name}`}
                onPress={() => onNavigate(folder.id)}
                accessibilityRole="button"
                accessibilityLabel={`Go to ${folder.name}`}
                style={{
                  minHeight: CRUMB_HIT,
                  justifyContent: 'center',
                  paddingHorizontal: 6,
                  maxWidth: 220,
                  borderRadius: radii.control,
                }}
              >
                <AppText variant="bodySm" weight="semibold" tone="accent" numberOfLines={1}>
                  {folder.name}
                </AppText>
              </HintPressable>
            )}
          </View>
        );
      })}
    </ScrollView>
  );
}
