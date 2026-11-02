import { useState } from 'react';
import { Animated, Pressable, View } from 'react-native';
import { MaterialIcons } from './Icon';
import { AppText } from './AppText';
import { GlassCard } from './GlassCard';
import { ProgressRail } from './DeckProgressCard';
import { groupDecksByFolder } from '../data/folders';
import type { Deck, DeckFolder } from '../data/types';
import { alpha, colors, fills, heights, iconSize, radii, spacing } from '../theme/tokens';
import { usePressFeedback } from '../motion';

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

/**
 * DeckLibrary — the Library box as a tree.
 *
 * One glass pane holds the whole library. A quiet vertical trunk runs through
 * it: folders are nodes on the trunk, decks are leaves joined by a short branch
 * in the deck's own colour. The due count remains the one loud number; the
 * studied meter stays quiet beneath the title. The trunk is structural, not
 * decoration — it is how the folder/deck relationship stays visible without
 * indenting every row into a separate card.
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

  return (
    <GlassCard padding="none">
      {groups.map((group, groupIndex) => {
        const folder = group.folder;
        const open = folder ? !collapsed[folder.id] : true;
        const isLastGroup = groupIndex === groups.length - 1;
        const finalLeaf = !open
          ? 'header'
          : group.decks.length > 0
            ? 'deck'
            : folder
              ? 'empty'
              : 'header';
        const terminalHeader = isLastGroup && finalLeaf === 'header';

        return (
          <View key={folder?.id ?? 'unfiled'}>
            {folder ? (
              <FolderHeader
                folder={folder}
                count={group.decks.length}
                open={open}
                connectAbove={groupIndex > 0}
                terminal={terminalHeader}
                onToggle={() =>
                  setCollapsed((current) => ({ ...current, [folder.id]: open }))
                }
              />
            ) : folders.length > 0 ? (
              <UnfiledHeader
                count={group.decks.length}
                connectAbove={groupIndex > 0}
                terminal={terminalHeader}
              />
            ) : (
              <RootHeader
                count={group.decks.length}
                connectAbove={groupIndex > 0}
                terminal={terminalHeader}
              />
            )}

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

/** The small node that sits on the trunk. */
function TreeNode({ muted = false }: { muted?: boolean }) {
  return (
    <View
      style={{
        width: 8,
        height: 8,
        borderRadius: 4,
        marginRight: 12,
        backgroundColor: muted ? colors.outline : colors.primary,
      }}
    />
  );
}

/** The two halves of the trunk that meet at a node. */
function HeaderLines({ connectAbove, terminal }: { connectAbove: boolean; terminal: boolean }) {
  return (
    <>
      {connectAbove && (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: spacing.gutter + 4,
            top: 0,
            height: heights.row / 2,
            width: 1,
            backgroundColor: fills.track,
          }}
        />
      )}
      {!terminal && (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: spacing.gutter + 4,
            top: heights.row / 2,
            bottom: 0,
            width: 1,
            backgroundColor: fills.track,
          }}
        />
      )}
    </>
  );
}

/** A folder node on the trunk: name, count and a collapse control. */
function FolderHeader({
  folder,
  count,
  open,
  connectAbove,
  terminal,
  onToggle,
}: {
  folder: DeckFolder;
  count: number;
  open: boolean;
  connectAbove: boolean;
  terminal: boolean;
  onToggle: () => void;
}) {
  const countLabel = `${count} ${count === 1 ? 'deck' : 'decks'}`;

  return (
    <Pressable
      onPress={onToggle}
      accessibilityRole="button"
      accessibilityLabel={`Folder ${folder.name}, ${countLabel}`}
      aria-expanded={open}
      accessibilityHint={open ? 'Collapse folder' : 'Expand folder'}
      style={{
        position: 'relative',
        minHeight: heights.row,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.gutter,
      }}
    >
      <HeaderLines connectAbove={connectAbove} terminal={terminal} />
      <TreeNode />
      <AppText variant="body" weight="semibold" className="flex-1" numberOfLines={1}>
        {folder.name}
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
    </Pressable>
  );
}

/** The root node used when the library has no folders yet. */
function RootHeader({
  count,
  connectAbove,
  terminal,
}: {
  count: number;
  connectAbove: boolean;
  terminal: boolean;
}) {
  const countLabel = `${count} ${count === 1 ? 'deck' : 'decks'}`;

  return (
    <View
      style={{
        position: 'relative',
        minHeight: heights.row,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.gutter,
      }}
    >
      <HeaderLines connectAbove={connectAbove} terminal={terminal} />
      <TreeNode muted />
      <AppText variant="body" weight="semibold" className="flex-1">
        All decks
      </AppText>
      <AppText variant="caption" weight="medium" tone="muted">
        {countLabel}
      </AppText>
    </View>
  );
}

/** The node that keeps decks without a folder visible when folders exist. */
function UnfiledHeader({
  count,
  connectAbove,
  terminal,
}: {
  count: number;
  connectAbove: boolean;
  terminal: boolean;
}) {
  const countLabel = `${count} ${count === 1 ? 'deck' : 'decks'}`;

  return (
    <View
      style={{
        position: 'relative',
        minHeight: heights.row,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.gutter,
      }}
    >
      <HeaderLines connectAbove={connectAbove} terminal={terminal} />
      <TreeNode muted />
      <AppText variant="body" weight="semibold" className="flex-1">
        Unfiled
      </AppText>
      <AppText variant="caption" weight="medium" tone="muted">
        {countLabel}
      </AppText>
    </View>
  );
}

function EmptyFolder({ terminal }: { terminal: boolean }) {
  return (
    <View
      style={{
        position: 'relative',
        paddingLeft: spacing.gutter + 20,
        paddingRight: spacing.gutter,
        paddingTop: 2,
        paddingBottom: spacing.gutter,
      }}
    >
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: spacing.gutter + 4,
          top: 0,
          bottom: terminal ? undefined : 0,
          width: 1,
          height: terminal ? 10 : undefined,
          backgroundColor: fills.track,
        }}
      />
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: spacing.gutter + 4,
          top: 10,
          width: 16,
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
  terminal,
  onPress,
}: {
  entry: DeckLibraryEntry;
  terminal: boolean;
  onPress: () => void;
}) {
  const press = usePressFeedback({ scale: 0.995 });
  const { deck, cardCount, due, progress } = entry;
  const percent = Math.round(Math.max(0, Math.min(1, progress)) * 100);
  const percentLabel = percent === 0 && progress > 0 ? '<1%' : `${percent}%`;
  const cardLabel = cardCount === 1 ? 'card' : 'cards';

  return (
    <Animated.View style={press.style}>
      <Pressable
        onPress={onPress}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        accessibilityRole="button"
        accessibilityHint="Open deck"
      >
        <View
          style={{
            position: 'relative',
            minHeight: heights.deckSlab,
            flexDirection: 'row',
            alignItems: 'center',
            paddingLeft: spacing.gutter + 20,
            paddingRight: spacing.gutter,
            paddingVertical: 12,
          }}
        >
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: spacing.gutter + 4,
              top: 0,
              bottom: terminal ? undefined : 0,
              height: terminal ? 34 : undefined,
              width: 1,
              backgroundColor: fills.track,
            }}
          />

          {/* The leaf branch: from the trunk to the deck's icon tile. */}
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: spacing.gutter + 4,
              top: 34,
              width: 16,
              height: 1,
              backgroundColor: alpha(deck.color, 0.55),
            }}
          />

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
            <AppText variant="bodyLg" weight="semibold" numberOfLines={2}>
              {deck.name}
            </AppText>
            <AppText variant="caption" weight="medium" tone="muted" className="mt-0.5">
              {cardCount} {cardLabel}
            </AppText>

            <View className="mt-2 flex-row items-center">
              <View className="flex-1">
                <ProgressRail value={progress} color={deck.color} height={4} />
              </View>
              <AppText variant="caption" weight="semibold" tone="muted" className="ml-2.5">
                {percentLabel}
              </AppText>
            </View>
          </View>

          <View style={{ alignItems: 'flex-end', marginLeft: 12 }}>
            <AppText variant="title" tone={due > 0 ? 'default' : 'muted'}>
              {due}
            </AppText>
            <AppText
              variant="caption"
              weight="semibold"
              tone={due > 0 ? 'accent' : 'muted'}
            >
              due
            </AppText>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}
