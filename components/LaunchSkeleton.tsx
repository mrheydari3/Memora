import { useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Surface } from './v3/Surface';
import {
  DeckCardGridSkeleton,
  DeckShelfSkeleton,
  HeroSkeleton,
  QuizSkeleton,
  SettingsGroupSkeleton,
  Skeleton,
  StatisticsSkeleton,
  StudyCardSkeleton,
} from './Skeleton';
import {
  colors,
  glass,
  heights,
  iconSize,
  radii,
  spacing,
  tabBar,
} from '../theme/tokens';
import { v3 } from '../theme/v3';

/**
 * What the launch screen is allowed to show while the stores hydrate.
 *
 * The variant is chosen from the URL, not from the navigator: on a web refresh
 * the route exists before the stack mounts, so the skeleton can already have the
 * shape of the page that is about to appear.
 */
export type LaunchVariant =
  | 'home'
  | 'statistics'
  | 'profile'
  | 'settings'
  | 'library'
  | 'deck'
  | 'study'
  | 'quiz'
  | 'generic';

export function launchVariant(pathname: string): LaunchVariant {
  if (pathname === '/' || pathname === '/home') return 'home';
  if (pathname.startsWith('/statistics')) return 'statistics';
  if (pathname.startsWith('/profile')) return 'profile';
  if (pathname === '/settings') return 'settings';
  if (pathname === '/library') return 'library';
  if (pathname.startsWith('/deck/')) return 'deck';
  if (pathname.startsWith('/study/')) return 'study';
  if (pathname.startsWith('/quiz/')) return 'quiz';
  return 'generic';
}

/**
 * LaunchSkeleton — the first paint of the app, drawn as the page it will become.
 *
 * It is not a second splash: there is no wordmark moment and no progress rail.
 * The shell (64px app bar, 960px content column, tab dock) is already in place,
 * and the content is the same skeleton grammar every screen uses, so the
 * hand-off to the real page is a dissolve rather than a layout jump.
 */
export function LaunchSkeleton({ pathname = '/' }: { pathname?: string }) {
  const insets = useSafeAreaInsets();
  const variant = launchVariant(pathname);
  const tabRoute =
    variant === 'home' ||
    variant === 'library' ||
    variant === 'profile' ||
    variant === 'settings';

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, overflow: 'hidden' }}>
      <View style={{ paddingTop: insets.top, backgroundColor: colors.background }}>
        <LaunchTopBar variant={variant} />
      </View>

      <View style={{ flex: 1 }}>
        <LaunchBody variant={variant} />
      </View>

      {tabRoute && <LaunchDock bottom={Math.max(insets.bottom, tabBar.gutter)} />}
    </View>
  );
}

/**
 * The app bar without its controls. It uses the same 64px height, 960px
 * content ceiling and 20px brand / 12px stack gutters as `PageHeader`, so the
 * real bar lands on the same pixels when the skeleton leaves.
 */
function LaunchTopBar({ variant }: { variant: LaunchVariant }) {
  const { width } = useWindowDimensions();
  const home = variant === 'home';
  const tab =
    home || variant === 'library' || variant === 'profile' || variant === 'settings';
  const actionCount =
    home || variant === 'library'
      ? 3
      : variant === 'settings'
        ? 1
        : variant === 'statistics'
          ? 2
          : variant === 'quiz'
            ? 1
            : 0;
  const titleWidth =
    variant === 'settings'
      ? 76
      : variant === 'library'
        ? 48
        : variant === 'generic'
          ? 104
          : variant === 'statistics'
            ? 88
            : variant === 'quiz'
              ? 96
              : 84;

  return (
    <View style={{ backgroundColor: colors.appBarGlass }}>
      <View
        style={{
          height: heights.pageHeader,
          width: '100%',
          maxWidth: v3.layout.contentMaxWidth,
          alignSelf: 'center',
          flexDirection: 'row',
          alignItems: 'center',
          gap: 4,
          paddingHorizontal: tab ? 20 : 12,
        }}
      >
        {!tab && (
          <View
            style={{
              width: heights.hit,
              height: heights.hit,
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Skeleton width={38} height={38} radius={19} />
          </View>
        )}

        {home ? (
          <>
            <Skeleton width={32} height={32} radius={8} />
            <Skeleton width={76} height={18} radius={7} style={{ marginStart: 8 }} />
            {width >= 360 && (
              <Skeleton width={44} height={22} radius={radii.pill} style={{ marginStart: 8 }} />
            )}
          </>
        ) : (
          <Skeleton
            width={titleWidth}
            height={18}
            radius={7}
            style={{ marginStart: tab ? 0 : 4 }}
          />
        )}

        <View style={{ flex: 1 }} />

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
          {Array.from({ length: actionCount }).map((_, index) => (
            <View
              key={index}
              style={{
                width: heights.hit,
                height: heights.hit,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Skeleton width={38} height={38} radius={19} />
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

function LaunchBody({ variant }: { variant: LaunchVariant }) {
  const { width } = useWindowDimensions();
  // The 9px chapter label placeholder is a row step shorter than the real
  // caption, so reserve that step to land each chapter pane on its final top.
  const settingsGroupOffset = v3.spacing.page + v3.spacing.row;

  if (variant === 'study') {
    return (
      <View style={{ flex: 1 }}>
        <StudyCardSkeleton />
      </View>
    );
  }

  if (variant === 'quiz') {
    return (
      <View style={{ flex: 1 }}>
        <QuizSkeleton />
      </View>
    );
  }

  return (
    <View
      style={{
        flex: 1,
        width: '100%',
        maxWidth: v3.layout.contentMaxWidth,
        alignSelf: 'center',
        paddingHorizontal: spacing.screen,
        // Home's first child sits just below the Screen body's 20px top gap.
        paddingTop: variant === 'home' ? spacing.screen + v3.spacing.group : spacing.screen,
        overflow: 'hidden',
      }}
    >
      {variant === 'home' ? (
        <HomeLaunchSkeleton />
      ) : variant === 'statistics' ? (
        <StatisticsSkeleton />
      ) : variant === 'profile' ? (
        <>
          <HeroSkeleton height={310} />
          <View style={{ marginTop: v3.spacing.page }}>
            <SettingsGroupSkeleton rows={3} />
          </View>
        </>
      ) : variant === 'settings' ? (
        <>
          <HeroSkeleton height={width < 360 ? 230 : 210} />
          <View style={{ marginTop: settingsGroupOffset }}>
            <SettingsGroupSkeleton rows={2} />
          </View>
          <View style={{ marginTop: settingsGroupOffset }}>
            <SettingsGroupSkeleton rows={2} />
          </View>
        </>
      ) : variant === 'library' ? (
        <>
          <HeroSkeleton height={300} />
          <View style={{ marginTop: v3.spacing.page }}>
            <DeckShelfSkeleton count={2} />
          </View>
        </>
      ) : variant === 'deck' ? (
        <>
          <HeroSkeleton height={190} />
          <View style={{ marginTop: v3.spacing.page }}>
            <DeckCardGridSkeleton count={1} />
          </View>
        </>
      ) : (
        <>
          <HeroSkeleton />
          <View style={{ marginTop: v3.spacing.page }}>
            <DeckShelfSkeleton count={1} />
          </View>
        </>
      )}
    </View>
  );
}

/**
 * The Home hero's placeholder, measured against `TodayPane`: one scene pane at
 * 24px with 20px padding and 20px gaps, an eyebrow/status row, a 44px figure,
 * the next-deck rail and the 52px action.
 */
function HomeLaunchSkeleton() {
  const { width } = useWindowDimensions();
  const tight = width < 360;

  return (
    <>
      <Surface tone="scene" radius="pane" padding="md" style={{ gap: v3.spacing.panel }}>
        <View
          style={{
            minHeight: tight ? 32 : 25,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
          }}
        >
          <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
            <Skeleton width={tight ? 96 : 112} height={10} radius={5} />
            {tight && <Skeleton width={78} height={10} radius={5} />}
          </View>
          <Skeleton width={96} height={22} radius={radii.pill} />
        </View>

        <View style={{ minHeight: 66 }}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 10 }}>
            <Skeleton width={84} height={44} radius={v3.radii.tile} />
            <Skeleton width={76} height={18} radius={6} />
          </View>
          <Skeleton width={168} height={10} radius={5} style={{ marginTop: 8 }} />
        </View>

        <View
          style={{
            minHeight: tight ? 77 : 63,
            justifyContent: 'space-between',
            gap: 8,
            paddingTop: 4,
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
            <Skeleton width={132} height={10} radius={5} />
            <Skeleton width={48} height={9} radius={4} />
          </View>
          <Skeleton height={v3.rail.hero} radius={radii.pill} />
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <Skeleton width={58} height={8} radius={4} />
            <Skeleton width={72} height={8} radius={4} />
            <Skeleton width={62} height={8} radius={4} />
          </View>
        </View>

        <Skeleton height={heights.button} radius={radii.pill} />
      </Surface>

      <View style={{ marginTop: v3.spacing.page }}>
        <DeckShelfSkeleton count={2} />
      </View>
    </>
  );
}

/**
 * The floating dock in its pre-tab state: the same 64px capsule, 292px
 * content width (four 70px cells plus 6px padding), 52px pill and selected
 * lens. It is a static skeleton, not a second navigator — nothing is focusable.
 */
function LaunchDock({ bottom }: { bottom: number }) {
  const lensInset = 3;

  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom,
        alignItems: 'center',
      }}
    >
      <View
        style={{
          maxWidth: tabBar.maxWidth,
          height: tabBar.height,
          padding: tabBar.padding,
          flexDirection: 'row',
          alignItems: 'center',
          borderRadius: tabBar.height / 2,
          backgroundColor: glass.tab,
        }}
      >
        <View
          style={{
            position: 'absolute',
            left: tabBar.padding + lensInset,
            top: tabBar.padding,
            width: tabBar.cell - lensInset * 2,
            height: tabBar.pill,
            borderRadius: tabBar.tileRadius,
            backgroundColor: colors.selectionSurface,
          }}
        />

        {[0, 1, 2, 3].map((index) => (
          <View
            key={index}
            style={{
              minWidth: tabBar.cell,
              height: tabBar.pill,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Skeleton width={iconSize.nav} height={iconSize.nav} radius={iconSize.nav / 2} />
            <Skeleton width={34} height={7} radius={4} style={{ marginTop: 4 }} />
          </View>
        ))}
      </View>
    </View>
  );
}
