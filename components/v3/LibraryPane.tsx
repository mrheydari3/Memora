import { View } from 'react-native';
import { AppText } from '../AppText';
import { MaterialIcons } from '../Icon';
import { Surface } from './Surface';
import { colors, fills, iconSize, radii } from '../../theme/tokens';

type IconName = React.ComponentProps<typeof MaterialIcons>['name'];

type LibraryPaneProps = {
  /** Active decks in the library; archived decks are not included. */
  decks: number;
  /** Cards across those active decks. */
  cards: number;
  /** Folders at every level. */
  folders: number;
  /** Cards that already carry at least one review. */
  studied: number;
  /** Studied share of the library, 0–1. */
  progress: number;
  /** Decks that hold cards and have nothing due today. */
  caughtUpDecks: number;
  /** Retired decks, kept out of today but still part of the library. */
  archived: number;
};

const NUMERIC = { fontVariant: ['tabular-nums'] as const };

function Meta({
  icon,
  color,
  label,
}: {
  icon: IconName;
  color: string;
  label: string;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
      <MaterialIcons name={icon} size={iconSize.sm} color={color} />
      <AppText variant="caption" tone="tertiary" numberOfLines={1}>
        {label}
      </AppText>
    </View>
  );
}

/**
 * LibraryPane — Home's desktop companion to the today hero.
 *
 * The hero answers "what do I study now?"; this rail answers "what do I own?"
 * without repeating the hero's due figure. Every value comes from the same
 * `deckQueues` the shelf renders: active decks, their cards, how many of those
 * cards have a review, and which decks are already caught up. Archived decks
 * are counted separately and stay out of the studied share, matching every
 * other due total in the app.
 *
 * It is a `pane`, not a second `scene`: Home has one raised card face and this
 * is its supporting rail.
 */
export function LibraryPane({
  decks,
  cards,
  folders,
  studied,
  progress,
  caughtUpDecks,
  archived,
}: LibraryPaneProps) {
  const clamped = Math.max(0, Math.min(1, progress));
  const percent = Math.round(clamped * 100);
  const tiles = [
    { label: 'Decks', value: decks },
    { label: 'Cards', value: cards },
    { label: 'Folders', value: folders },
  ];

  return (
    <Surface
      tone="pane"
      radius="pane"
      padding="md"
      testID="home-library-pane"
      style={{ flex: 1 }}
    >
      <View style={{ flex: 1, justifyContent: 'space-between', gap: 16 }}>
        <View style={{ gap: 10 }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 10,
            }}
          >
            <AppText
              variant="label"
              weight="semibold"
              tone="tertiary"
              headingLevel={2}
              className="uppercase"
              style={{ letterSpacing: 0.6 }}
            >
              Your library
            </AppText>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View
                style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.success }}
              />
              <AppText variant="caption" tone="muted">
                On this device
              </AppText>
            </View>
          </View>

          <View style={{ flexDirection: 'row', gap: 8 }}>
            {tiles.map((tile) => (
              <View
                key={tile.label}
                style={{
                  flex: 1,
                  minWidth: 0,
                  paddingHorizontal: 10,
                  paddingVertical: 10,
                  borderRadius: radii.control,
                  backgroundColor: fills.inset,
                }}
              >
                <AppText variant="caption" tone="tertiary" numberOfLines={1}>
                  {tile.label}
                </AppText>
                <AppText
                  variant="headline"
                  weight="semibold"
                  numberOfLines={1}
                  style={[NUMERIC, { marginTop: 2 }]}
                >
                  {tile.value.toLocaleString('en-US')}
                </AppText>
              </View>
            ))}
          </View>
        </View>

        <View
          style={{
            padding: 14,
            borderRadius: radii.control,
            backgroundColor: fills.inset,
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 10,
            }}
          >
            <AppText
              variant="caption"
              weight="semibold"
              tone="tertiary"
              className="uppercase"
              style={{ letterSpacing: 0.6 }}
            >
              Studied
            </AppText>
            <AppText variant="bodySm" weight="semibold" style={NUMERIC}>
              {percent}%
            </AppText>
          </View>

          <View
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={{
              height: 4,
              marginTop: 10,
              borderRadius: radii.pill,
              backgroundColor: colors.surfaceControl,
              overflow: 'hidden',
            }}
          >
            <View
              style={{
                width: `${percent}%`,
                height: '100%',
                backgroundColor: colors.primaryContainer,
              }}
            />
          </View>

          <AppText
            variant="caption"
            tone="muted"
            numberOfLines={2}
            style={{ marginTop: 8, fontVariant: ['tabular-nums'] }}
          >
            {`${studied.toLocaleString('en-US')} of ${cards.toLocaleString(
              'en-US'
            )} cards have a review`}
          </AppText>
        </View>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 14, rowGap: 6 }}>
          <Meta
            icon="done-all"
            color={colors.success}
            label={`${caughtUpDecks} ${caughtUpDecks === 1 ? 'deck' : 'decks'} caught up`}
          />
          <Meta icon="inventory-2" color={colors.outline} label={`${archived} archived`} />
        </View>
      </View>
    </Surface>
  );
}
