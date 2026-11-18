import { useEffect, useRef, useState } from 'react';
import { Animated, Platform, View } from 'react-native';
import { MaterialIcons } from '../Icon';
import { AppText } from '../AppText';
import { HintPressable } from '../HintPressable';
import { colors, iconSize, motion } from '../../theme/tokens';
import { v3 } from '../../theme/v3';
import { prefersReducedMotion, timingTo } from '../../motion';
import { FolderGlyph } from './FolderGlyph';
import { ShelfStatusPill } from './ShelfStatusPill';
import { Surface } from './Surface';

type FolderGroupProps = {
  name: string;
  /** The folder's own glyph; the neutral folder until one is chosen. */
  icon?: string;
  /** The folder's own colour, washed into the header glyph. */
  color?: string;
  /** Decks filed directly in this folder. */
  deckCount: number;
  /** Cards those decks want today. */
  due: number;
  pinned?: boolean;
  expanded: boolean;
  onToggle: () => void;
  /** False when the card has no decks to reveal, so it draws no chevron. */
  expandable?: boolean;
  /** True while the deck body is attached directly beneath the header. */
  joined?: boolean;
};

/**
 * FolderGroup — the phone's folder card.
 *
 * A folder is a place, so it keeps its illustrated glyph on Today's raised
 * card face. When closed, the card has four 22px corners. When open, the header
 * drops its bottom corners and the matching deck body closes the silhouette
 * with one 22px bottom edge. The deck rows stay separate FlatList rows so a
 * long folder remains virtualized.
 */
export function FolderGroup({
  name,
  icon,
  color,
  deckCount,
  due,
  pinned = false,
  expanded,
  onToggle,
  expandable = true,
  joined = false,
}: FolderGroupProps) {
  // React Native Web maps DOM ARIA props, not `accessibilityState`, onto a
  // Pressable's rendered element; the accordion's open state must reach
  // assistive tech on web as `aria-expanded`.
  const webExpanded: object =
    Platform.OS === 'web' ? { 'aria-expanded': expanded } : {};
  const expansion = useRef(new Animated.Value(expanded ? 1 : 0)).current;
  useEffect(() => {
    void timingTo(expansion, expanded ? 1 : 0, { duration: motion.fast });
    return () => expansion.stopAnimation();
  }, [expanded, expansion]);
  const empty = deckCount === 0;
  const deckLabel = deckCount === 1 ? 'deck' : 'decks';
  // The due pill is the folder's one status mark; the meta line states what
  // the folder holds, so the number is never printed twice in one header.
  const metaLabel = empty ? 'Empty folder' : `${deckCount} ${deckLabel}`;
  const header = (
    <>
      <FolderGlyph icon={icon} color={color} size={40} />

      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <AppText
            variant="bodyLg"
            weight="semibold"
            numberOfLines={2}
            style={{ letterSpacing: -0.1, flexShrink: 1 }}
          >
            {name}
          </AppText>
          {pinned && (
            <MaterialIcons name="push-pin" size={iconSize.xs} color={colors.outline} />
          )}
        </View>

        <View
          style={{
            marginTop: 2,
            flexDirection: 'row',
            alignItems: 'center',
            flexWrap: 'wrap',
            columnGap: 8,
            rowGap: 4,
          }}
        >
          <AppText
            variant="caption"
            tone="tertiary"
            numberOfLines={2}
            style={{ flexShrink: 1, minWidth: 0 }}
          >
            {metaLabel}
          </AppText>
          <View style={{ marginLeft: 'auto' }}>
            <ShelfStatusPill due={due} empty={empty} />
          </View>
        </View>
      </View>

      {expandable ? (
        <Animated.View
          style={{
            transform: [
              {
                rotate: expansion.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['-90deg', '0deg'],
                }),
              },
            ],
          }}
        >
          <MaterialIcons name="expand-more" size={iconSize.lg} color={colors.outline} />
        </Animated.View>
      ) : null}
    </>
  );
  const headerStyle = {
    // A folder header is a place, not a row: it stands a little taller than a
    // deck card and carries the folder art.
    minHeight: v3.heights.folderGroup,
    flex: 1,
    minWidth: 0,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 12,
    paddingLeft: 14,
    paddingRight: expandable ? 12 : 14,
    paddingVertical: 10,
    borderTopLeftRadius: v3.radii.card,
    borderTopRightRadius: v3.radii.card,
    borderBottomLeftRadius: joined ? 0 : v3.radii.card,
    borderBottomRightRadius: joined ? 0 : v3.radii.card,
  };

  return (
    <Surface
      tone="pane"
      radius="card"
      padding="none"
      style={{
        width: '100%',
        overflow: 'hidden',
        position: 'relative',
        backgroundColor: colors.surfaceCardFace,
        ...(joined
          ? { borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }
          : null),
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        {expandable ? (
          <HintPressable
            hint={expanded ? 'Collapse folder' : 'Expand folder'}
            testID="folder-group"
            onPress={onToggle}
            accessibilityRole="button"
            accessibilityState={{ expanded }}
            {...webExpanded}
            style={headerStyle}
          >
            {header}
          </HintPressable>
        ) : (
          <View testID="folder-group" style={headerStyle}>
            {header}
          </View>
        )}
      </View>
    </Surface>
  );
}

/**
 * One slice of an open folder's deck body. A folder's decks are their own list
 * rows, so a long folder mounts a window instead of every deck. Every slice
 * carries the folder's raised card face with square top corners; only the last
 * slice rounds the bottom edge, which closes the header's silhouette.
 */
export function FolderBodySlice({
  first = false,
  last = false,
  entering = false,
  closing = false,
  index = 0,
  children,
}: {
  first?: boolean;
  last?: boolean;
  /** Start this slice at opacity 0 when its folder body is opening. */
  entering?: boolean;
  /** Fade this slice out before the collapsed row set removes it. */
  closing?: boolean;
  /** Position in the folder, used for the capped entrance stagger. */
  index?: number;
  children: React.ReactNode;
}) {
  const presence = useRef(new Animated.Value(1)).current;
  const collapse = useRef(new Animated.Value(1)).current;
  const [measuredHeight, setMeasuredHeight] = useState<number | null>(null);

  useEffect(() => {
    if (prefersReducedMotion()) {
      presence.setValue(closing ? 0 : 1);
      collapse.setValue(closing ? 0 : 1);
      return;
    }
    if (closing) {
      collapse.setValue(1);
      // Match the entrance: a quick-but-readable collapse, not a snap.
      void timingTo(collapse, 0, { duration: motion.base, nativeDriver: false });
      void timingTo(presence, 0, { duration: motion.base });
      return () => {
        collapse.stopAnimation();
        presence.stopAnimation();
      };
    }
    collapse.setValue(1);
    if (entering) {
      presence.setValue(0);
      void timingTo(presence, 1, {
        duration: motion.base,
        delay: Math.min(index, 4) * 18,
      });
      return () => presence.stopAnimation();
    }
    presence.setValue(1);
    return () => presence.stopAnimation();
  }, [closing, collapse, entering, index, presence]);

  return (
    <Animated.View
      accessibilityElementsHidden={closing || undefined}
      importantForAccessibility={closing ? 'no-hide-descendants' : undefined}
      {...(Platform.OS === 'web' ? { 'aria-hidden': closing || undefined } : {})}
      pointerEvents={closing ? 'none' : 'auto'}
      onLayout={(event) => {
        if (closing) return;
        const next = Math.round(event.nativeEvent.layout.height);
        setMeasuredHeight((current) => (Math.abs((current ?? 0) - next) > 1 ? next : current));
      }}
      style={{
        opacity: presence,
        transform: [
          {
            translateY: presence.interpolate({
              inputRange: [0, 1],
              outputRange: [6, 0],
            }),
          },
        ],
        ...(closing && measuredHeight != null
          ? {
              height: collapse.interpolate({
                inputRange: [0, 1],
                outputRange: [0, measuredHeight],
              }),
              overflow: 'hidden' as const,
            }
          : null),
      }}
    >
      <Surface
        tone="inset"
        radius="card"
        padding="none"
        style={{
          backgroundColor: colors.surfaceCardFace,
          paddingHorizontal: 10,
          paddingTop: first ? 8 : 3,
          paddingBottom: last ? 10 : 3,
          borderTopLeftRadius: 0,
          borderTopRightRadius: 0,
          borderBottomLeftRadius: last ? v3.radii.card : 0,
          borderBottomRightRadius: last ? v3.radii.card : 0,
          marginBottom: last ? 10 : 0,
        }}
      >
        {children}
      </Surface>
    </Animated.View>
  );
}
