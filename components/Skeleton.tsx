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
 *
 * v3 geometry lives here too: the scene hero, the 22px deck rows with their
 * 44px glyph tiles, the 64px settings lines and the study stage's 24px face.
 * A skeleton may look quieter than the page, but it must occupy the same box.
 */
import { useState } from 'react';
import { Animated, useWindowDimensions, View } from 'react-native';
import type { DimensionValue, ViewStyle } from 'react-native';
import { colors, fills, glassFill, heights, radii, spacing } from '../theme/tokens';
import { v3 } from '../theme/v3';
import { Surface } from './v3/Surface';
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

/** A settings line: a 40px tile, a title and one meta line on a 64px row. */
export function SkeletonRow({ tall = false }: { tall?: boolean }) {
  return (
    <View
      style={{
        minHeight: tall ? heights.pageHeader : heights.row,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingHorizontal: 16,
        paddingVertical: 10,
      }}
    >
      <Skeleton width={40} height={40} radius={v3.radii.tile} />
      <View style={{ flex: 1, minWidth: 0 }}>
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
      style={[
        glassFill,
        { overflow: 'hidden', borderRadius: v3.radii.card },
      ]}
    >
      {Array.from({ length: rows }).map((_, index) => (
        <View key={index}>
          <SkeletonRow tall />
          {index < rows - 1 && (
            <View
              style={{
                height: 1,
                backgroundColor: colors.outlineVariant,
                marginStart: 68,
              }}
            />
          )}
        </View>
      ))}
    </View>
  );
}

/** Stacked deck cards with a glyph, title and two supporting lines. */
export function DeckCardGridSkeleton({ count = 3 }: { count?: number }) {
  return (
    <View style={{ gap: spacing.row }}>
      {Array.from({ length: count }).map((_, index) => (
        <Surface key={index} tone="pane" radius="card" padding="sm">
          <Skeleton width={44} height={44} radius={v3.radii.tile} />
          <Skeleton height={14} width="62%" radius={7} style={{ marginTop: 14 }} />
          <SkeletonText lines={2} style={{ marginTop: 10 }} />
          <View
            style={{
              marginTop: 16,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Skeleton width={72} height={10} radius={5} />
            <Skeleton width={40} height={10} radius={5} />
          </View>
        </Surface>
      ))}
    </View>
  );
}

/**
 * The Home shelf: the section header, then one 22px pane per deck. Each row
 * reserves the final surface's 76px height (44px tile + 16px padding), with a
 * 44px tile, a two-line name block and the due tile.
 */
export function DeckShelfSkeleton({ count = 2 }: { count?: number }) {
  return (
    <View style={{ gap: 12 }}>
      <View
        style={{
          minHeight: heights.hit,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          paddingHorizontal: 4,
        }}
      >
        <Skeleton width={110} height={18} radius={7} />
        <View style={{ flex: 1 }} />
        <Skeleton width={74} height={10} radius={5} />
      </View>

      {/* The shelf's meta line, rule and group label. The real shelf puts the
          count above the rule and the group name below it; without them the
          loading rows sit a full group higher than the deck they become. */}
      <View style={{ gap: 12, paddingHorizontal: 4 }}>
        <Skeleton width={84} height={9} radius={4} />
        <View style={{ height: 1, backgroundColor: colors.hairlineRule }} />
        <Skeleton width={102} height={9} radius={4} />
      </View>

      <View style={{ gap: v3.spacing.row, marginTop: 12 }}>
        {Array.from({ length: count }).map((_, index) => (
          <Surface key={index} tone="pane" radius="card" padding="sm">
            <View style={{ minHeight: 93, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              <Skeleton width={44} height={44} radius={v3.radii.tile} />

              <View style={{ flex: 1, minWidth: 0 }}>
                <Skeleton height={15} width="62%" radius={7} />
                <Skeleton height={15} width="44%" radius={7} style={{ marginTop: 4 }} />
                <Skeleton height={10} width="36%" radius={5} style={{ marginTop: 6 }} />
                <Skeleton height={v3.rail.deck} width="72%" radius={2} style={{ marginTop: 8 }} />
              </View>

              <Skeleton width={48} height={48} radius={v3.radii.tile} />
            </View>
          </Surface>
        ))}
      </View>
    </View>
  );
}

/**
 * The scene hero shared by profile, settings, Game and deck loading. `height`
 * is a minimum, not a fixed box: the content keeps the real pane's padding and
 * ledger even when a route passes the compact 150px step.
 */
export function HeroSkeleton({ height = 196 }: { height?: number }) {
  const { width } = useWindowDimensions();
  return (
    <Surface
      tone="scene"
      radius="pane"
      padding="md"
      style={{ minHeight: height, gap: 16 }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <Skeleton width={82} height={10} radius={5} />
        <Skeleton width={92} height={22} radius={radii.pill} />
      </View>

      <View>
        <Skeleton width={94} height={30} radius={9} />
        <Skeleton height={10} width="76%" radius={5} style={{ marginTop: 9 }} />
        {width < 360 && (
          <Skeleton height={10} width="52%" radius={5} style={{ marginTop: 6 }} />
        )}
      </View>

      <View
        style={{
          flexDirection: 'row',
          borderRadius: 16,
          backgroundColor: colors.surfaceInset,
          paddingHorizontal: 12,
          paddingVertical: 12,
        }}
      >
        {[0, 1, 2].map((cell) => (
          <View key={cell} style={{ flex: 1, minWidth: 0, paddingHorizontal: 8 }}>
            <Skeleton width="52%" height={8} radius={4} />
            <Skeleton width="74%" height={16} radius={6} style={{ marginTop: 7 }} />
          </View>
        ))}
      </View>
    </Surface>
  );
}

/**
 * Statistics: the raised overview hero with its range control, ledger and
 * activity plot, followed by the section/chart panes that carry recall and
 * memory. The shapes are intentionally taller than the old glass cards — the
 * v3 hero owns the whole first viewport on a phone.
 */
export function StatisticsSkeleton() {
  return (
    <View style={{ gap: v3.spacing.page }}>
      <Surface tone="scene" radius="pane" padding="md" style={{ gap: 16 }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
          }}
        >
          <Skeleton width={112} height={10} radius={5} />
          <Skeleton width={86} height={22} radius={radii.pill} />
        </View>

        <View>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
            <Skeleton width={104} height={44} radius={v3.radii.tile} />
            <Skeleton width={92} height={16} radius={6} style={{ marginBottom: 8 }} />
          </View>
          <Skeleton height={10} width="88%" radius={5} style={{ marginTop: 9 }} />
        </View>

        <Skeleton height={heights.field} radius={v3.radii.control} />

        <View
          style={{
            flexDirection: 'row',
            borderRadius: 16,
            backgroundColor: fills.inset,
            paddingVertical: 12,
            paddingHorizontal: 8,
          }}
        >
          {[0, 1, 2].map((cell) => (
            <View key={cell} style={{ flex: 1, minWidth: 0, paddingHorizontal: 8 }}>
              <Skeleton width="54%" height={8} radius={4} />
              <Skeleton width="70%" height={16} radius={6} style={{ marginTop: 7 }} />
            </View>
          ))}
        </View>

        <View
          style={{
            borderRadius: v3.radii.control,
            backgroundColor: fills.inset,
            padding: 12,
          }}
        >
          <View style={{ height: v3.rail.activityPlot, flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
            {[32, 48, 40, 58, 44, 52, 36].map((bar, index) => (
              <Skeleton key={index} width="100%" height={bar} radius={4} style={{ flex: 1 }} />
            ))}
          </View>
        </View>
      </Surface>

      <View style={{ gap: 10 }}>
        <Skeleton width={128} height={11} radius={5} />
        <Surface tone="pane" radius="card" padding="md" style={{ gap: 16 }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 10,
            }}
          >
            <Skeleton width={82} height={10} radius={5} />
            <Skeleton width={54} height={10} radius={5} />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
            <Skeleton width={96} height={96} radius={48} />
            <View style={{ flex: 1, gap: 12 }}>
              <Skeleton height={9} width="84%" radius={5} />
              <Skeleton height={9} width="62%" radius={5} />
              <Skeleton height={9} width="72%" radius={5} />
              <Skeleton height={9} width="54%" radius={5} />
            </View>
          </View>
        </Surface>
      </View>

      <View style={{ gap: 10 }}>
        <Skeleton width={94} height={11} radius={5} />
        <Surface tone="pane" radius="card" padding="md" style={{ gap: 14 }}>
          <Skeleton width="62%" height={10} radius={5} />
          <Skeleton width="80%" height={8} radius={4} />
          <Skeleton width="52%" height={8} radius={4} />
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 2 }}>
            <Skeleton height={60} radius={v3.radii.control} style={{ flex: 1 }} />
            <Skeleton height={60} radius={v3.radii.control} style={{ flex: 1 }} />
          </View>
        </Surface>
      </View>
    </View>
  );
}

/**
 * A settings chapter: the 12px label above one pane of 64px lines. The group
 * includes its own label so a loading Settings page does not have to invent a
 * second skeleton primitive for the chapter heading.
 */
export function SettingsGroupSkeleton({ rows = 2 }: { rows?: number }) {
  const { width } = useWindowDimensions();
  // The real settings line is 64px when its subtitle fits on one line. At
  // 320px the two-line subtitles make it taller, so the chapter reserves that
  // height instead of landing 40px above the content it becomes.
  const rowHeight = width < 360 ? 88 : 79;

  return (
    <View style={{ gap: 10 }}>
      <Skeleton width={56} height={9} radius={4} style={{ marginStart: 4 }} />
      <View
        style={[
          glassFill,
          { overflow: 'hidden', borderRadius: v3.radii.card },
        ]}
      >
        {Array.from({ length: rows }).map((_, index) => (
          <View key={index}>
            <View
              style={{
                minHeight: rowHeight,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                paddingHorizontal: 16,
                paddingVertical: 12,
              }}
            >
              <Skeleton width={40} height={40} radius={v3.radii.tile} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Skeleton height={12} width="58%" radius={6} />
                <Skeleton height={9} width="36%" radius={5} style={{ marginTop: 8 }} />
                {rowHeight >= 88 && (
                  <Skeleton height={9} width="72%" radius={5} style={{ marginTop: 6 }} />
                )}
              </View>
            </View>
            {index < rows - 1 && (
              <View
                style={{
                  height: 1,
                  backgroundColor: colors.outlineVariant,
                  marginStart: 68,
                }}
              />
            )}
          </View>
        ))}
      </View>
    </View>
  );
}

/**
 * The quiz board: the three-tile HUD, the progress rail, the question stage and
 * two rows of two answer pads. The column is 440px wide, matching the arena.
 */
export function QuizSkeleton() {
  const { width } = useWindowDimensions();
  const compact = width < 360;

  return (
    <View
      style={{
        flex: 1,
        width: '100%',
        maxWidth: v3.layout.quizMeasure,
        alignSelf: 'center',
        paddingHorizontal: 20,
        paddingTop: 16,
        paddingBottom: 12,
      }}
    >
      <View style={{ flexDirection: 'row', gap: 10 }}>
        {[0, 1, 2].map((tile) => (
          <View
            key={tile}
            style={{
              flex: 1,
              minWidth: 0,
              height: v3.heights.quizHud,
              justifyContent: 'center',
              borderRadius: v3.radii.quizTile,
              backgroundColor: glassFill.backgroundColor,
              paddingHorizontal: 12,
              paddingVertical: 8,
            }}
          >
            <Skeleton width={30} height={8} radius={4} />
            <Skeleton width={42} height={16} radius={6} style={{ marginTop: 8 }} />
          </View>
        ))}
      </View>

      <View
        style={{
          minHeight: 17,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          marginTop: 20,
        }}
      >
        <Skeleton width={104} height={9} radius={4} />
        <Skeleton height={4} radius={2} style={{ flex: 1 }} />
      </View>

      {/* The arena centres the stage in the space left above the answers; the
          skeleton needs the same wrapper or it pulls the pads up by ~30px. */}
      <View style={{ flex: 1, minHeight: 0, justifyContent: 'center', marginTop: 18 }}>
        <View
          style={{
            flex: 1,
            width: '100%',
            minHeight: v3.heights.quizQuestion,
            maxHeight: 320,
            justifyContent: 'center',
            alignItems: 'center',
            borderRadius: v3.radii.card,
            backgroundColor: glassFill.backgroundColor,
            paddingHorizontal: 20,
            paddingVertical: 24,
          }}
        >
          <Skeleton width={96} height={10} radius={5} />
          <Skeleton height={30} width="82%" radius={10} style={{ marginTop: 18 }} />
          <Skeleton height={30} width="62%" radius={10} style={{ marginTop: 10 }} />
        </View>
      </View>

      <View style={{ gap: 10, marginTop: 14 }}>
        {[0, 1].map((row) => (
          <View key={row} style={{ flexDirection: 'row', gap: 10 }}>
            <Skeleton
              height={compact && row === 1 ? 88 : 74}
              radius={v3.radii.quizTile}
              style={{ flex: 1 }}
            />
            <Skeleton
              height={compact && row === 1 ? 88 : 74}
              radius={v3.radii.quizTile}
              style={{ flex: 1 }}
            />
          </View>
        ))}
      </View>

      <View
        style={{
          minHeight: compact ? 58 : 33,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: 14,
          paddingTop: 10,
          borderTopWidth: 1,
          borderTopColor: fills.track,
        }}
      >
        <Skeleton width={136} height={8} radius={4} />
        <Skeleton width={84} height={8} radius={4} />
      </View>
    </View>
  );
}

/**
 * Study: the progress rail, the 20px-padded 760px column, one 460px/428px
 * stage with its 24px scene face and the stacked cards behind it, the 44px
 * utility tray and the four rating keys.
 */
export function StudyCardSkeleton() {
  const { height } = useWindowDimensions();
  const stageHeight = height < 760 ? 428 : 460;

  return (
    <View style={{ flex: 1 }}>
      <View style={{ height: 4, backgroundColor: fills.track }} />

      <View
        style={{
          flex: 1,
          width: '100%',
          maxWidth: v3.layout.studyMeasure,
          alignSelf: 'center',
          paddingHorizontal: 20,
          paddingTop: 12,
          paddingBottom: 16,
        }}
      >
        <View
          style={{
            width: '100%',
            maxWidth: v3.layout.studyCard,
            height: stageHeight,
            alignSelf: 'center',
            position: 'relative',
            justifyContent: 'flex-end',
            paddingBottom: 8,
          }}
        >
          <View
            style={{
              position: 'absolute',
              left: 16,
              right: 16,
              bottom: -4,
              height: 20,
              borderRadius: v3.radii.card,
              backgroundColor: colors.surfaceContainerLowest,
              opacity: 0.8,
            }}
          />
          <View
            style={{
              position: 'absolute',
              left: 8,
              right: 8,
              bottom: 2,
              height: 24,
              borderRadius: v3.radii.card,
              backgroundColor: colors.surfaceContainerLow,
            }}
          />

          <Surface
            tone="scene"
            radius="card"
            padding="none"
            style={{ flex: 1, minHeight: 420, overflow: 'hidden' }}
          >
            <View
              style={{
                flex: 1,
                paddingHorizontal: 20,
                paddingTop: 20,
                paddingBottom: 14,
              }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8,
                }}
              >
                <Skeleton width={92} height={28} radius={radii.pill} />
                <Skeleton width={58} height={44} radius={radii.pill} />
              </View>

              <View style={{ flexDirection: 'row', gap: 6, marginTop: 14 }}>
                <Skeleton width={88} height={9} radius={4} />
                <Skeleton width={112} height={9} radius={4} />
              </View>

              <View style={{ flex: 1, justifyContent: 'center' }}>
                <Skeleton width={54} height={9} radius={4} />
                <Skeleton height={30} width="74%" radius={9} style={{ marginTop: 14 }} />
                <Skeleton height={30} width="52%" radius={9} style={{ marginTop: 10 }} />
              </View>

              <View
                style={{
                  minHeight: 28,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8,
                  paddingTop: 8,
                }}
              >
                <Skeleton width={76} height={8} radius={4} />
                <Skeleton width={66} height={8} radius={4} />
              </View>
            </View>
          </Surface>
        </View>

        <View
          style={{
            flexDirection: 'row',
            gap: 8,
            width: '100%',
            maxWidth: v3.layout.studyCard,
            alignSelf: 'center',
            marginTop: 4,
          }}
        >
          {[0, 1, 2].map((action) => (
            <Skeleton
              key={action}
              height={heights.hit}
              radius={v3.radii.control}
              style={{ flex: 1 }}
            />
          ))}
        </View>

        <View
          style={{
            width: '100%',
            maxWidth: v3.layout.studyCard,
            minHeight: heights.studyFooter,
            alignSelf: 'center',
            justifyContent: 'center',
          }}
        >
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {[0, 1, 2, 3].map((key) => (
              <Skeleton
                key={key}
                height={v3.heights.ratingKey}
                radius={v3.radii.control}
                style={{ flex: 1, flexBasis: 0, minWidth: 44 }}
              />
            ))}
          </View>
        </View>
      </View>
    </View>
  );
}
