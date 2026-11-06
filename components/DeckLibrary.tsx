import { useState } from 'react';
import { Animated, Pressable, View } from 'react-native';
import { MaterialIcons } from './Icon';
import { AppText } from './AppText';
import { GlassCard } from './GlassCard';
import { ProgressRail } from './DeckProgressCard';
import { groupDecksByFolder } from '../data/folders';
import type { Deck, DeckFolder } from '../data/types';
import { alpha, colors, fills, heights, iconSize, radii, spacing, veil } from '../theme/tokens';
import { usePressFeedback } from '../motion';
import { useRtl } from '../services/direction';
import { HintPressable } from './HintPressable';

export type DeckLibraryEntry = {
  deck: Deck;
  cardCount: number;
  /** Cards waiting today, from the same queue the session uses. */
  due: number;
  /** Studied share, 0–1. */
  progress: number;
};

type DeckLibraryProps = {
  folders: DeckFolder[];
  entries: DeckLibraryEntry[];
  onOpenDeck: (deckId: string) => void;
};

/** Width of the trunk column, from the pane's gutter to the content inset. */
const RAIL = 20;
/** The trunk line's centre inside that column. */
const TRUNK = 4;
/** Diameter of a header node. */
const NODE = 8;
/** Collapse state key for the group of decks that has no folder. */
const KNOWN_KEY = 'known';

/**
 * DeckLibrary — the Library box as a tree.
 *
 * One glass pane holds the whole library. A quiet vertical trunk runs through
 * it: folders are nodes on the trunk, decks are leaves joined by a short branch
 * in the deck's own colour. The due count remains the one loud number; the
 * studied meter stays quiet beneath the title. The trunk is structural, not
 * decoration — it is how the folder/deck relationship stays visible without
 * indenting every row into a separate card.
 *
 * Decks with no folder collect under **Known** at the end. It is a folder-shaped
 * group, not a second kind of heading: it collapses, prints its own count and
 * keeps its chevron, so the tree never ends in a row that looks tappable but
 * does nothing.
 *
 * With no folders there is nothing to branch, so the trunk, its root node and
 * the Known group are all dropped: a tree of one leaf is just a list.
 */
export function DeckLibrary({ folders, entries, onOpenDeck }: DeckLibraryProps) {
  // Absent = open. Storing only the collapsed ids keeps a newly created folder
  // open without an effect that has to sync state with props.
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const groups = groupDecksByFolder(
    entries.map((entry) => entry.deck),
    folders
  );
  const byDeckId = new Map(entries.map((entry) => [entry.deck.id, entry]));
  const tree = folders.length > 0;

  const toggle = (key: string, open: boolean) =>
    setCollapsed((current) => ({ ...current, [key]: open }));

  return (
    <GlassCard padding="none">
      {groups.map((group, groupIndex) => {
        const folder = group.folder;
        const key = folder?.id ?? KNOWN_KEY;
        const open = !collapsed[key];
        const isLastGroup = groupIndex === groups.length - 1;
        const connectAbove = groupIndex > 0;
        const finalLeaf = !open
          ? 'header'
          : group.decks.length > 0
            ? 'deck'
            : folder
              ? 'empty'
              : 'header';
        const terminalHeader = isLastGroup && finalLeaf === 'header';

        return (
          <View key={key}>
            {folder ? (
              <TreeHeader
                name={folder.name}
                count={group.decks.length}
                open={open}
                node="folder"
                label={`Folder ${folder.name}`}
                connectAbove={connectAbove}
                terminal={terminalHeader}
                onToggle={() => toggle(key, open)}
              />
            ) : tree ? (
              <TreeHeader
                name="Known"
                count={group.decks.length}
                open={open}
                node="known"
                label="Known, decks without a folder"
                connectAbove={connectAbove}
                terminal={terminalHeader}
                onToggle={() => toggle(key, open)}
              />
            ) : null}

            {open && group.decks.length === 0 && folder && (
              <EmptyFolder terminal={isLastGroup && finalLeaf === 'empty'} />
            )}

            {open &&
              group.decks.map((deck, index) => {
                const entry = byDeckId.get(deck.id);
                if (!entry) return null;
                return (
                  <DeckRow
                    key={deck.id}
                    entry={entry}
                    tree={tree}
                    terminal={
                      isLastGroup &&
                      finalLeaf === 'deck' &&
                      index === group.decks.length - 1
                    }
                    onPress={() => onOpenDeck(deck.id)}
                  />
                );
              })}
          </View>
        );
      })}
    </GlassCard>
  );
}

/**
 * The trunk column of one row: the segments above and below the row's centre,
 * plus whatever sits on that centre — a header node or a deck's branch.
 *
 * Laid out as two flexible halves around a fixed middle instead of absolute
 * offsets, so the node and the branch stay on the row's midline however tall
 * the row grows (a deck name that wraps to two lines used to leave its branch
 * 20px above the icon it points at).
 */
function Rail({
  connectAbove,
  connectBelow,
  node,
  branchColor,
}: {
  connectAbove: boolean;
  connectBelow: boolean;
  /** A folder node, the muted Known node, or nothing for a deck leaf. */
  node?: 'folder' | 'known';
  /** Deck colour for the leaf's branch; only deck rows pass it. */
  branchColor?: string;
}) {
  const rtl = useRtl();

  // A flexible half of the trunk. The two halves meeting at the middle is what
  // keeps the node and the branch on the row's midline at any row height. The
  // line sits on the reading edge, so it mirrors in a right-to-left page.
  const half = (draw: boolean) => (
    <View
      style={{
        flex: 1,
        ...(rtl
          ? {
              marginRight: TRUNK,
              borderRightWidth: draw ? 1 : 0,
              borderRightColor: fills.track,
            }
          : {
              marginLeft: TRUNK,
              borderLeftWidth: draw ? 1 : 0,
              borderLeftColor: fills.track,
            }),
      }}
    />
  );

  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        ...(rtl ? { right: spacing.gutter } : { left: spacing.gutter }),
        top: 0,
        bottom: 0,
        width: RAIL,
      }}
    >
      {half(connectAbove)}
      {node ? (
        <View
          style={{
            width: NODE,
            height: NODE,
            borderRadius: NODE / 2,
            alignSelf: rtl ? 'flex-end' : 'flex-start',
            backgroundColor: node === 'folder' ? colors.primary : colors.outline,
          }}
        />
      ) : (
        <View
          style={{
            width: RAIL - TRUNK,
            height: 1,
            ...(rtl ? { marginRight: TRUNK } : { marginLeft: TRUNK }),
            ...(rtl
              ? { borderRightWidth: 1, borderRightColor: fills.track }
              : { borderLeftWidth: 1, borderLeftColor: fills.track }),
          }}
        >
          {branchColor ? (
            <View
              style={{
                position: 'absolute',
                ...(rtl ? { right: 1, left: 0 } : { left: 1, right: 0 }),
                top: 0,
                height: 1,
                backgroundColor: branchColor,
              }}
            />
          ) : null}
        </View>
      )}
      {half(connectBelow)}
    </View>
  );
}

/** The press veil every row in the app answers a touch with. */
function PressVeil({ value }: { value: Animated.Value }) {
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: veil,
        opacity: value.interpolate({ inputRange: [0, 1], outputRange: [0, 0.05] }),
      }}
    />
  );
}

/**
 * A header row on the trunk: name, count and the collapse control. Folders and
 * the Known group are the same row, so they collapse the same way.
 */
function TreeHeader({
  name,
  count,
  open,
  node,
  label,
  connectAbove,
  terminal,
  onToggle,
}: {
  name: string;
  count: number;
  open: boolean;
  node: 'folder' | 'known';
  /** Leading label, e.g. "Folder German A2" — the name alone is ambiguous to a screen reader. */
  label: string;
  connectAbove: boolean;
  terminal: boolean;
  onToggle: () => void;
}) {
  const press = usePressFeedback({ scale: 0.995 });
  const rtl = useRtl();
  const countLabel = `${count} ${count === 1 ? 'deck' : 'decks'}`;

  return (
    <Animated.View style={press.style}>
      <HintPressable
        hint={open ? 'Hide decks' : 'Show decks'}
        onPress={onToggle}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        accessibilityRole="button"
        accessibilityLabel={`${label}, ${countLabel}`}
        aria-expanded={open}
        style={{
          position: 'relative',
          minHeight: heights.row,
          flexDirection: 'row',
          alignItems: 'center',
          paddingLeft: rtl ? spacing.gutter : spacing.gutter + RAIL,
          paddingRight: rtl ? spacing.gutter + RAIL : spacing.gutter,
        }}
      >
        <PressVeil value={press.value} />
        <Rail connectAbove={connectAbove} connectBelow={!terminal} node={node} />
        <AppText variant="body" weight="semibold" className="flex-1" numberOfLines={1}>
          {name}
        </AppText>
        <AppText variant="caption" weight="medium" tone="muted">
          {countLabel}
        </AppText>
        <MaterialIcons
          name={open ? 'expand-more' : 'chevron-right'}
          size={iconSize.md}
          color={colors.outline}
          style={{ marginLeft: 6 }}
        />
      </HintPressable>
    </Animated.View>
  );
}

/**
 * A folder with nothing in it yet. The trunk runs through to the next group, or
 * ends here in a short stub when this is the last thing in the box, so an empty
 * folder reads as a dead end instead of a cut line.
 */
function EmptyFolder({ terminal }: { terminal: boolean }) {
  const rtl = useRtl();
  return (
    <View
      style={{
        position: 'relative',
        paddingLeft: rtl ? spacing.gutter : spacing.gutter + RAIL,
        paddingRight: rtl ? spacing.gutter + RAIL : spacing.gutter,
        paddingTop: 22,
        paddingBottom: 16,
      }}
    >
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          ...(rtl
            ? { right: spacing.gutter + TRUNK }
            : { left: spacing.gutter + TRUNK }),
          top: 0,
          bottom: terminal ? undefined : 0,
          height: terminal ? 22 : undefined,
          width: 1,
          backgroundColor: fills.track,
        }}
      />
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          ...(rtl
            ? { right: spacing.gutter + TRUNK }
            : { left: spacing.gutter + TRUNK }),
          top: 22,
          width: 12,
          height: 1,
          backgroundColor: fills.track,
        }}
      />
      <AppText variant="bodySm" tone="muted">
        No decks here yet. Move one in from the deck's options.
      </AppText>
    </View>
  );
}

/**
 * A deck leaf: a branch in the deck's colour leads to its icon tile, title,
 * studied meter and the large due count.
 */
function DeckRow({
  entry,
  tree,
  terminal,
  onPress,
}: {
  entry: DeckLibraryEntry;
  /** Draw the trunk and this row's branch. Off when the library has no folders. */
  tree: boolean;
  terminal: boolean;
  onPress: () => void;
}) {
  const press = usePressFeedback({ scale: 0.995 });
  const rtl = useRtl();
  const { deck, cardCount, due, progress } = entry;
  const percent = Math.round(Math.max(0, Math.min(1, progress)) * 100);
  const percentLabel = percent === 0 && progress > 0 ? '<1%' : `${percent}%`;
  const cardLabel = cardCount === 1 ? 'card' : 'cards';

  return (
    <Animated.View style={press.style}>
      <HintPressable
        hint="Open deck"
        onPress={onPress}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        accessibilityRole="button"
        // The visible row is four separate numbers; naming it after them keeps
        // the label and the content in the same words (WCAG 2.5.3).
        accessibilityLabel={`${deck.name}, ${cardCount} ${cardLabel}, ${percentLabel} studied, ${due} due`}
      >
        <View
          style={{
            position: 'relative',
            minHeight: heights.deckSlab,
            flexDirection: 'row',
            alignItems: 'center',
            paddingLeft: tree && !rtl ? spacing.gutter + RAIL : spacing.gutter,
            paddingRight: tree && rtl ? spacing.gutter + RAIL : spacing.gutter,
            paddingVertical: 12,
          }}
        >
          {tree && (
            <Rail
              connectAbove
              connectBelow={!terminal}
              branchColor={alpha(deck.color, 0.55)}
            />
          )}

          <PressVeil value={press.value} />

          <View
            style={{
              width: heights.tileLg,
              height: heights.tileLg,
              borderRadius: radii.micro,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: alpha(deck.color, 0.16),
            }}
          >
            <MaterialIcons
              name={deck.icon as React.ComponentProps<typeof MaterialIcons>['name']}
              size={iconSize.lg}
              color={deck.color}
            />
          </View>

          <View className="ml-3 flex-1">
            {/* No line clamp: at 200% text size a two-line cap cut the deck
                name off mid-word. The row (and the tree's branch with it) grows
                instead, so the whole name stays readable. */}
            <AppText variant="bodyLg" weight="semibold">
              {deck.name}
            </AppText>
            <AppText variant="caption" weight="medium" tone="muted" className="mt-0.5">
              {cardCount} {cardLabel} · {percentLabel} studied
            </AppText>

            <View className="mt-2">
              <ProgressRail value={progress} color={deck.color} height={4} />
            </View>
          </View>

          <View style={{ alignItems: 'flex-end', marginLeft: 12 }}>
            <AppText variant="title" tone={due > 0 ? 'default' : 'muted'}>
              {due}
            </AppText>
            <AppText variant="caption" weight="semibold" tone={due > 0 ? 'accent' : 'muted'}>
              due
            </AppText>
          </View>
        </View>
      </HintPressable>
    </Animated.View>
  );
}
