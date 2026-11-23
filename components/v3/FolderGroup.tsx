import { useEffect, useRef, useState } from 'react';
import { Animated, Platform, View } from 'react-native';
import { MaterialIcons } from '../Icon';
import { AppText } from '../AppText';
import { HintPressable } from '../HintPressable';
import { colors, glass, iconSize, motion, shadow } from '../../theme/tokens';
import { v3 } from '../../theme/v3';
import { prefersReducedMotion, timingTo } from '../../motion';
import { FolderGlyph } from './FolderGlyph';
import { ShelfStatusPill } from './ShelfStatusPill';
import { Surface } from './Surface';

/**
 * Clip a row's shadow to the outside edges of the assembled card.
 *
 * The folder header and its decks are separate virtualized list rows, so each
 * row paints its own pane shadow. Without a clip, the blurred top/bottom of
 * one row's shadow would cross the seam onto the neighbouring row. Horizontal
 * padding gives the left/right edges room to breathe; the negative margins
 * keep that room out of the card's layout. Top and bottom bleed are opened
 * only at the card's real outer edges.
 */
const SHADOW_BLEED = 12;

function ShadowFrame({
  top = false,
  bottom = false,
  children,
}: {
  top?: boolean;
  bottom?: boolean;
  children: React.ReactNode;
}) {
  return (
    <View
      style={{
        overflow: 'hidden',
        marginHorizontal: -SHADOW_BLEED,
        paddingHorizontal: SHADOW_BLEED,
        marginTop: top ? -SHADOW_BLEED : 0,
        paddingTop: top ? SHADOW_BLEED : 0,
        marginBottom: bottom ? -SHADOW_BLEED : 0,
        paddingBottom: bottom ? SHADOW_BLEED : 0,
      }}
    >
      {children}
    </View>
  );
}

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
  const reviewable = !empty && due > 0;
  const deckLabel = deckCount === 1 ? 'deck' : 'decks';
  // The due pill is the folder's one status mark; the meta line states what
  // the folder holds, so the number is never printed twice in one header.
  const metaLabel = empty ? 'Empty folder' : `${deckCount} ${deckLabel}`;
  const header = (
    <>
      <FolderGlyph icon={icon} color={color} size={40} />

      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          {pinned && (
            <MaterialIcons name="push-pin" size={iconSize.xs} color={colors.outline} />
          )}
          <AppText
            variant="bodyLg"
            weight="semibold"
            numberOfLines={2}
            style={{ letterSpacing: -0.1, flexShrink: 1 }}
          >
            {name}
          </AppText>
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
            <ShelfStatusPill due={due} empty={empty} reviewable={reviewable} />
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
    <ShadowFrame top bottom={!joined}>
      <Surface
        tone="pane"
        radius="card"
        padding="none"
        style={{
          width: '100%',
          overflow: 'hidden',
          position: 'relative',
          backgroundColor: glass.cardFace,
          // One card, one shadow: the frame keeps the top/side edge here and
          // lets every deck row continue the side edge below it.
          boxShadow: shadow.pane,
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
    </ShadowFrame>
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
  const [heightConstrained, setHeightConstrained] = useState(false);
  const wasClosing = useRef(false);

  useEffect(() => {
    if (prefersReducedMotion()) {
      presence.setValue(closing ? 0 : 1);
      collapse.setValue(closing ? 0 : 1);
      setHeightConstrained(false);
      wasClosing.current = false;
      return;
    }

    if (closing) {
      wasClosing.current = true;
      setHeightConstrained(true);
      // An interrupted reopen may be part-way back up; continue from that
      // height instead of resetting to full and producing a snap.
      void timingTo(collapse, 0, { duration: motion.base, nativeDriver: false });
      void timingTo(presence, 0, { duration: motion.base });
      return () => {
        collapse.stopAnimation();
        presence.stopAnimation();
      };
    }

    if (entering) {
      if (wasClosing.current) {
        // A second tap during the close keeps the measured height attached
        // until the row has grown back, so it cannot jump to natural height.
        wasClosing.current = false;
        setHeightConstrained(true);
        let active = true;
        void timingTo(collapse, 1, {
          duration: motion.base,
          nativeDriver: false,
        }).then(() => {
          if (active) setHeightConstrained(false);
        });
        void timingTo(presence, 1, { duration: motion.base });
        return () => {
          active = false;
          collapse.stopAnimation();
          presence.stopAnimation();
        };
      }

      setHeightConstrained(false);
      collapse.setValue(1);
      presence.setValue(0);
      void timingTo(presence, 1, {
        duration: motion.base,
        delay: Math.min(index, 4) * 18,
      });
      return () => presence.stopAnimation();
    }

    wasClosing.current = false;
    setHeightConstrained(false);
    presence.setValue(1);
    collapse.setValue(1);
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
        ...((closing || heightConstrained) && measuredHeight != null
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
      <ShadowFrame bottom={last}>
        <Surface
          tone="inset"
          radius="card"
          padding="none"
          style={{
            backgroundColor: glass.cardFace,
            boxShadow: shadow.pane,
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
      </ShadowFrame>
    </Animated.View>
  );
}
