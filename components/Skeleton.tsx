/**
 * Skeletons — the loading state of every region that has a known shape.
 *
 * A shimmer, not a spinner: the placeholder draws the layout that is about to
 * arrive, so the page never shifts when the data lands. All blocks share one
 * clock (`useSharedShimmer`) and animate only `translateX` and `opacity`, so a
 * screen full of them still runs on the native driver.
 *
 * With reduce-motion on, the blocks render flat: the shape still communicates
 * "content is coming" without any sweep.
 */
import { useState } from 'react';
import { Animated, View } from 'react-native';
import type { DimensionValue, ViewStyle } from 'react-native';
import { colors, fills, glassFill, heights, layout, radii, spacing } from '../theme/tokens';
import { useReducedMotion, useSharedShimmer } from '../motion';

type SkeletonProps = {
  width?: DimensionValue;
  height?: number;
  radius?: number;
  /** Inner margin, when the block is placed in a padded pane. */
  style?: ViewStyle | ViewStyle[];
};

/**
 * The base block: a soft fill with a highlight sweeping across it. The sweep is
 * measured once with `onLayout`; before that it simply does not paint.
 */
export function Skeleton({ width = '100%', height = 14, radius = 6, style }: SkeletonProps) {
  const shimmer = useSharedShimmer();
  const reduced = useReducedMotion();
  const [boxWidth, setBoxWidth] = useState(0);

  const sweepWidth = Math.max(48, boxWidth * 0.6);
  const translateX = shimmer.interpolate({
    inputRange: [0, 1],
    outputRange: [-sweepWidth, boxWidth + sweepWidth],
  });

  return (
    <View
      onLayout={(event) => setBoxWidth(event.nativeEvent.layout.width)}
      style={[
        {
          width,
          height,
          borderRadius: radius,
          backgroundColor: fills.tile,
          overflow: 'hidden',
        },
        style,
      ]}
    >
      {!reduced && boxWidth > 0 && (
        <Animated.View
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            width: sweepWidth,
            backgroundColor: colors.hairlineGhost,
            transform: [{ translateX }],
          }}
        />
      )}
    </View>
  );
}

type SkeletonTextProps = {
  lines?: number;
  lineHeight?: number;
  gap?: number;
  /** Width of the last line, so the block reads as a paragraph, not a box. */
  lastLineWidth?: DimensionValue;
  style?: ViewStyle | ViewStyle[];
};

export function SkeletonText({
  lines = 2,
  lineHeight = 11,
  gap = 8,
  lastLineWidth = '62%',
  style,
}: SkeletonTextProps) {
  return (
    <View style={[{ gap }, style]}>
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton
          key={index}
          height={lineHeight}
          radius={lineHeight / 2}
          width={index === lines - 1 && lines > 1 ? lastLineWidth : '100%'}
        />
      ))}
    </View>
  );
}

export function SkeletonCircle({ size = 44 }: { size?: number }) {
  return <Skeleton width={size} height={size} radius={size / 2} />;
}

/** A row in a glass group: icon tile + title + one meta line. */
export function SkeletonRow({ tall = false }: { tall?: boolean }) {
  return (
    <View
      className="flex-row items-center"
      style={{ minHeight: tall ? heights.rowTall : heights.row, paddingHorizontal: 16 }}
    >
      <Skeleton width={heights.tileLg} height={heights.tileLg} radius={radii.control} />
      <View className="ml-3 flex-1">
        <Skeleton height={12} width="58%" radius={6} />
        <Skeleton height={9} width="34%" radius={5} style={{ marginTop: 8 }} />
      </View>
    </View>
  );
}

/** The deck list on Home: a pane of rows. */
export function DeckListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <View
      className="overflow-hidden rounded-xl"
      style={glassFill}
    >
      {Array.from({ length: rows }).map((_, index) => (
        <View key={index}>
          <SkeletonRow tall />
          {index < rows - 1 && <View className="h-1" />}
        </View>
      ))}
    </View>
  );
}

/** The library's deck cards: stacked panes with a tile, title and two lines. */
export function DeckCardGridSkeleton({ count = 3 }: { count?: number }) {
  return (
    <View style={{ gap: spacing.row }}>
      {Array.from({ length: count }).map((_, index) => (
        <View
          key={index}
          className="rounded-xl p-5"
          style={glassFill}
        >
          <Skeleton width={heights.tileLg} height={heights.tileLg} radius={radii.control} />
          <Skeleton height={14} width="62%" radius={7} style={{ marginTop: 14 }} />
          <SkeletonText lines={2} style={{ marginTop: 10 }} />
          <View className="mt-4 flex-row items-center justify-between">
            <Skeleton width={72} height={10} radius={5} />
            <Skeleton width={40} height={10} radius={5} />
          </View>
        </View>
      ))}
    </View>
  );
}

/** The Library tree box: a node, connected leaf rows, title, meter and due count. */
export function DeckShelfSkeleton({ count = 2 }: { count?: number }) {
  return (
    <View className="overflow-hidden rounded-xl" style={glassFill}>
      <View
        style={{
          position: 'relative',
          minHeight: heights.row,
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: spacing.gutter,
        }}
      >
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
        <Skeleton width={8} height={8} radius={4} />
        <Skeleton width={92} height={11} radius={5} style={{ marginLeft: 12 }} />
      </View>
      {Array.from({ length: count }).map((_, index) => (
        <View
          key={index}
          style={{
            position: 'relative',
            flexDirection: 'row',
            alignItems: 'center',
            minHeight: heights.deckSlab,
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
              bottom: index < count - 1 ? 0 : undefined,
              height: index < count - 1 ? undefined : 34,
              width: 1,
              backgroundColor: fills.track,
            }}
          />
          <Skeleton
            width={16}
            height={1}
            radius={0}
            style={{ position: 'absolute', left: spacing.gutter + 4, top: 34 }}
          />
          <Skeleton width={heights.tileLg} height={heights.tileLg} radius={radii.micro} />
          <View className="ml-3 flex-1">
            <Skeleton height={13} width="58%" radius={6} />
            <Skeleton height={9} width="28%" radius={5} style={{ marginTop: 8 }} />
            <Skeleton height={4} width="100%" radius={2} style={{ marginTop: 10 }} />
          </View>
          <View className="ml-3 items-end">
            <Skeleton width={28} height={22} radius={5} />
            <Skeleton width={18} height={8} radius={4} style={{ marginTop: 6 }} />
          </View>
        </View>
      ))}
    </View>
  );
}

/** The accent hero panes (today's queue, streak, profile identity). */
export function HeroSkeleton({ height = 196 }: { height?: number }) {
  return (
    <View
      className="rounded-xl p-5"
      style={[glassFill, { minHeight: height }]}
    >
      <Skeleton width={64} height={9} radius={5} />
      <Skeleton width={92} height={40} radius={12} style={{ marginTop: 12 }} />
      <Skeleton height={10} width="72%" radius={5} style={{ marginTop: 12 }} />
      <Skeleton height={44} radius={radii.control} style={{ marginTop: 22 }} />
    </View>
  );
}

/** Statistics: a hero, a donut row and two tiles. */
export function StatisticsSkeleton() {
  return (
    <View style={{ gap: spacing.row }}>
      <HeroSkeleton height={186} />
      <View className="rounded-xl p-5" style={glassFill}>
        <View className="flex-row items-center">
          <Skeleton width={124} height={124} radius={62} />
          <View className="ml-5 flex-1" style={{ gap: 14 }}>
            <Skeleton height={10} width="80%" radius={5} />
            <Skeleton height={10} width="64%" radius={5} />
            <Skeleton height={10} width="72%" radius={5} />
          </View>
        </View>
      </View>
      <View className="flex-row" style={{ gap: spacing.row }}>
        <View className="flex-1 rounded-xl p-4" style={glassFill}>
          <Skeleton width={18} height={18} radius={6} />
          <Skeleton height={18} width="52%" radius={7} style={{ marginTop: 12 }} />
          <Skeleton height={8} width="38%" radius={4} style={{ marginTop: 8 }} />
        </View>
        <View className="flex-1 rounded-xl p-4" style={glassFill}>
          <Skeleton width={18} height={18} radius={6} />
          <Skeleton height={18} width="52%" radius={7} style={{ marginTop: 12 }} />
          <Skeleton height={8} width="38%" radius={4} style={{ marginTop: 8 }} />
        </View>
      </View>
    </View>
  );
}

/** A settings group: a few rows inside one pane. */
export function SettingsGroupSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <View className="overflow-hidden rounded-xl" style={glassFill}>
      {Array.from({ length: rows }).map((_, index) => (
        <View key={index}>
          <SkeletonRow />
          {index < rows - 1 && <View className="h-1" />}
        </View>
      ))}
    </View>
  );
}

/** The quiz board: a question pane over the 2×2 answer grid. */
export function QuizSkeleton() {
  return (
    <View
      className="w-full flex-1 self-center px-5 pb-6"
      style={{ maxWidth: layout.contentMaxWidth }}
    >
      <View className="mt-4 flex-row items-center justify-between">
        <Skeleton width={54} height={11} radius={5} />
        <Skeleton width={38} height={18} radius={9} />
      </View>
      <View className="flex-1 justify-center py-4">
        <View className="rounded-xl p-5" style={glassFill}>
          <Skeleton width={86} height={9} radius={5} />
          <Skeleton height={30} radius={10} style={{ marginTop: 18 }} />
          <Skeleton height={30} width="72%" radius={10} style={{ marginTop: 10, alignSelf: 'center' }} />
        </View>
      </View>
      <View style={{ gap: 10 }}>
        {[0, 1].map((row) => (
          <View key={row} className="flex-row" style={{ gap: 10 }}>
            <Skeleton height={64} radius={radii.pane} style={{ flex: 1 }} />
            <Skeleton height={64} radius={radii.pane} style={{ flex: 1 }} />
          </View>
        ))}
      </View>
    </View>
  );
}

/** One study card and its footer action. */
export function StudyCardSkeleton() {
  return (
    <View
      className="w-full flex-1 self-center px-5"
      style={{ maxWidth: layout.contentMaxWidth }}
    >
      <View
        className="flex-1 items-center justify-center rounded-2xl p-6"
        style={glassFill}
      >
        <Skeleton height={26} width="76%" radius={9} />
        <Skeleton height={16} width="48%" radius={7} style={{ marginTop: 16 }} />
      </View>
      <Skeleton height={52} radius={radii.control} style={{ marginBottom: 24 }} />
    </View>
  );
}
