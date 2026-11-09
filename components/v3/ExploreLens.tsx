import { useState } from 'react';
import { useWindowDimensions, View } from 'react-native';
import { MaterialIcons } from '../Icon';
import { AppText } from '../AppText';
import { HintPressable } from '../HintPressable';
import { BottomSheetModal, SheetScrollView } from '../BottomSheetModal';
import { alpha, colors, fills, heights, iconSize } from '../../theme/tokens';
import { v3 } from '../../theme/v3';
import { SectionHeading } from './SectionHeading';
import type { Deck } from '../../data/types';
import type { ExploreKind, ExplorePick, ExploreRole } from '../../data/explore';

type IconName = React.ComponentProps<typeof MaterialIcons>['name'];

const KIND_LABEL: Record<ExploreKind, string> = {
  backlog: 'Backlog',
  care: 'Needs attention',
  almost: 'Almost there',
  rediscover: 'Rediscover',
  fresh: 'Fresh start',
};

const KIND_TONE = {
  backlog: 'accent',
  care: 'warning',
  almost: 'success',
  rediscover: 'tertiary',
  fresh: 'tertiary',
} as const;

const KIND_DOT: Record<ExploreKind, string> = {
  backlog: colors.primary,
  care: colors.warning,
  almost: colors.success,
  rediscover: colors.outline,
  fresh: colors.outline,
};

const SECTIONS: readonly { role: ExploreRole; label: string }[] = [
  { role: 'now', label: 'Now' },
  { role: 'keep-going', label: 'Keep going' },
  { role: 'fresh', label: 'Fresh start' },
];

const countLabel = (count: number): string => `${count} ${count === 1 ? 'pick' : 'picks'}`;

const deckName = (pick: ExplorePick, decksById: ReadonlyMap<string, Deck>): string =>
  decksById.get(pick.deckId)?.name ?? 'Deck';

const deckIcon = (pick: ExplorePick, decksById: ReadonlyMap<string, Deck>): IconName =>
  (decksById.get(pick.deckId)?.icon as IconName | undefined) ?? 'menu-book';

const deckColor = (pick: ExplorePick, decksById: ReadonlyMap<string, Deck>): string =>
  decksById.get(pick.deckId)?.color ?? colors.primary;

const dueLabel = (due: number): string => (due > 0 ? `${due} due` : 'All clear');

const dueTone = (due: number): 'accent' | 'success' => (due > 0 ? 'accent' : 'success');

type ExploreEntryProps = {
  picks: readonly ExplorePick[];
  decksById: ReadonlyMap<string, Deck>;
  onPress: () => void;
};

/**
 * ExploreEntry — one quiet door into the deck-level discovery sheet.
 *
 * It is deliberately a row, not a dashboard: the shelf is a library, and the
 * row tells the learner how many picks there are and which deck leads without
 * repeating the deck cards below. The sheet holds the reasons and groups.
 */
export function ExploreEntry({ picks, decksById, onPress }: ExploreEntryProps) {
  const [hovered, setHovered] = useState(false);
  const top = picks[0];
  if (!top) return null;

  const subtitle = `${countLabel(picks.length)} · ${KIND_LABEL[top.kind]} · ${deckName(
    top,
    decksById
  )}`;
  const label = `Explore your decks. ${countLabel(picks.length)}. Top pick: ${deckName(
    top,
    decksById
  )}, ${KIND_LABEL[top.kind]}.`;

  return (
    <View
      style={{
        borderBottomWidth: 1,
        borderBottomColor: colors.hairlineRule,
        marginBottom: 12,
      }}
    >
      <HintPressable
        hint="Open your deck picks"
        testID="explore-entry"
        onPress={onPress}
        onHoverIn={() => setHovered(true)}
        onHoverOut={() => setHovered(false)}
        accessibilityRole="button"
        accessibilityLabel={label}
        style={{
          minHeight: 60,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          paddingHorizontal: 8,
          borderRadius: v3.radii.control,
          overflow: 'hidden',
        }}
      >
        {hovered && (
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              bottom: 0,
              left: 0,
              backgroundColor: fills.subtle,
            }}
          />
        )}

        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={{
            width: 34,
            height: 34,
            borderRadius: v3.radii.tile,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.accentFaint,
            flexShrink: 0,
          }}
        >
          <MaterialIcons name="insights" size={iconSize.md} color={colors.primary} />
        </View>

        <View style={{ flex: 1, minWidth: 0 }}>
          <AppText weight="semibold" numberOfLines={1} style={v3.type.deckTitle}>
            Explore your decks
          </AppText>
          <AppText variant="caption" tone="tertiary" numberOfLines={1} style={{ marginTop: 2 }}>
            {subtitle}
          </AppText>
        </View>

        <MaterialIcons name="chevron-right" size={iconSize.sm} color={colors.outline} />
      </HintPressable>
    </View>
  );
}

type ExplorePickRowProps = {
  pick: ExplorePick;
  decksById: ReadonlyMap<string, Deck>;
  onPress: () => void;
};

function ExplorePickRow({ pick, decksById, onPress }: ExplorePickRowProps) {
  const name = deckName(pick, decksById);
  const color = deckColor(pick, decksById);
  const status = dueLabel(pick.due);

  return (
    <HintPressable
      hint="Open deck"
      testID="explore-pick"
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${KIND_LABEL[pick.kind]}: ${name}. ${pick.reason}. ${status}.`}
      style={{
        minHeight: 76,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: colors.hairlineRule,
      }}
    >
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{
          width: 38,
          height: 38,
          borderRadius: v3.radii.tile,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: alpha(color, 0.14),
          flexShrink: 0,
        }}
      >
        <MaterialIcons
          name={deckIcon(pick, decksById)}
          size={iconSize.lg}
          color={color}
        />
      </View>

      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          <View
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={{
              width: 5,
              height: 5,
              borderRadius: 3,
              backgroundColor: KIND_DOT[pick.kind],
            }}
          />
          <AppText
            variant="caption"
            weight="semibold"
            tone={KIND_TONE[pick.kind]}
            className="uppercase"
            numberOfLines={1}
            style={{ fontSize: 10, lineHeight: 14, letterSpacing: 0.7 }}
          >
            {KIND_LABEL[pick.kind]}
          </AppText>
        </View>

        <AppText
          weight="semibold"
          numberOfLines={1}
          style={[v3.type.deckTitle, { marginTop: 1 }]}
        >
          {name}
        </AppText>
        <AppText variant="caption" tone="tertiary" numberOfLines={1} style={{ marginTop: 1 }}>
          {pick.reason}
        </AppText>
      </View>

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          flexShrink: 0,
        }}
      >
        <AppText
          variant="caption"
          weight="semibold"
          tone={dueTone(pick.due)}
          numberOfLines={1}
        >
          {status}
        </AppText>
        <MaterialIcons name="chevron-right" size={iconSize.sm} color={colors.outline} />
      </View>
    </HintPressable>
  );
}

type ExploreSheetProps = {
  visible: boolean;
  onClose: () => void;
  picks: readonly ExplorePick[];
  decksById: ReadonlyMap<string, Deck>;
  /** The folder currently open on the shelf, if any. */
  scopeName?: string | null;
  desktopLayout?: boolean;
  onOpenDeck: (deckId: string) => void;
};

/**
 * ExploreSheet — the ranked pick list, grouped by the work it asks for.
 *
 * Groups are action-shaped (Now / Keep going / Fresh start), not another deck
 * grid. Every row names its signal and the real numbers behind it; opening one
 * closes the sheet and leaves all scheduling untouched.
 */
export function ExploreSheet({
  visible,
  onClose,
  picks,
  decksById,
  scopeName,
  desktopLayout = false,
  onOpenDeck,
}: ExploreSheetProps) {
  const { height } = useWindowDimensions();
  const maxHeight = desktopLayout
    ? Math.max(320, Math.min(620, height - 260))
    : heights.sheetTall;

  const groups = SECTIONS.map((section) => ({
    ...section,
    items: picks.filter((pick) => pick.role === section.role),
  })).filter((group) => group.items.length > 0);

  return (
    <BottomSheetModal
      visible={visible}
      onClose={onClose}
      title="Explore your decks"
      subtitle="Picked from your library. Nothing is rescheduled."
      desktopLayout={desktopLayout}
      desktopMaxWidth={560}
      focusKey={`explore-${picks.map((pick) => pick.deckId).join('-')}`}
    >
      <SheetScrollView
        style={{ maxHeight }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {scopeName ? (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              marginBottom: 14,
            }}
          >
            <MaterialIcons name="folder-open" size={iconSize.sm} color={colors.outline} />
            <AppText variant="caption" tone="tertiary" numberOfLines={1}>
              Inside {scopeName}
            </AppText>
          </View>
        ) : null}

        {groups.length === 0 ? (
          <AppText variant="bodySm" tone="tertiary">
            Nothing to explore yet.
          </AppText>
        ) : (
          groups.map((group, index) => (
            <View key={group.role} style={{ marginTop: index === 0 ? 0 : 22 }}>
              <SectionHeading label={group.label} rule={false} />
              <View style={{ marginTop: 2 }}>
                {group.items.map((pick) => (
                  <ExplorePickRow
                    key={pick.deckId}
                    pick={pick}
                    decksById={decksById}
                    onPress={() => onOpenDeck(pick.deckId)}
                  />
                ))}
              </View>
            </View>
          ))
        )}

        <AppText
          variant="caption"
          tone="tertiary"
          style={{ marginTop: 18, textAlign: 'center' }}
        >
          Ranked from your own reviews. Due dates are unchanged.
        </AppText>
      </SheetScrollView>
    </BottomSheetModal>
  );
}
