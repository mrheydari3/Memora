import { ScrollView, View } from 'react-native';
import { MaterialIcons } from '../Icon';
import { AppText } from '../AppText';
import { HintPressable } from '../HintPressable';
import { colors, iconSize } from '../../theme/tokens';
import { v4 } from '../../theme/v4';

type BreadcrumbsProps = {
  /** Every folder from the top level down to the open folder, inclusive. */
  trail: { id: string; name: string }[];
  /** `null` returns to the top level. */
  onNavigate: (folderId: string | null) => void;
};

const CRUMB_HIT = 44;

/**
 * Breadcrumbs — the shelf's address line.
 *
 * The path is a row of ink and hairlines, not a capsule: every ancestor keeps a
 * 44px target, the current folder is plain text, and a long name scrolls
 * sideways instead of squeezing the trail. The root crumb stays named "All
 * decks" so the way back is also the way UP in every language.
 */
export function Breadcrumbs({ trail, onNavigate }: BreadcrumbsProps) {
  if (trail.length === 0) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      accessibilityLabel="Library path"
      testID="library-breadcrumbs"
      style={{ marginTop: 6, marginBottom: 2, flexGrow: 0 }}
      contentContainerStyle={{ alignItems: 'center', minHeight: CRUMB_HIT }}
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
          paddingRight: 2,
        }}
      >
        <MaterialIcons name="library-books" size={iconSize.sm} color={colors.v4Saffron} />
        <AppText
          numberOfLines={1}
          style={[v4.type.control, { color: colors.v4Saffron, fontWeight: '600' }]}
        >
          All decks
        </AppText>
      </HintPressable>

      {trail.map((folder, index) => {
        const current = index === trail.length - 1;
        return (
          <View key={folder.id} style={{ flexDirection: 'row', alignItems: 'center' }}>
            <MaterialIcons name="chevron-right" size={iconSize.sm} color={colors.outlineSoft} />
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
                <AppText
                  numberOfLines={1}
                  style={[v4.type.control, { color: colors.onSurface, fontWeight: '600' }]}
                >
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
                }}
              >
                <AppText
                  numberOfLines={1}
                  style={[v4.type.control, { color: colors.onSurfaceVariant, fontWeight: '600' }]}
                >
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
