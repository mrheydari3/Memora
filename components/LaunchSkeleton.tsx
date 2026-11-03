import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GlassCard } from './GlassCard';
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
  glassFillAppBar,
  heights,
  iconSize,
  layout,
  radii,
  spacing,
  tabBar,
} from '../theme/tokens';

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
 * The shell (app bar, content column, tab dock) is already in place, and the
 * content is the same skeleton grammar every screen uses, so the hand-off to
 * the real page is a dissolve rather than a layout jump.
 */
export function LaunchSkeleton({ pathname = '/' }: { pathname?: string }) {
  const insets = useSafeAreaInsets();
  const variant = launchVariant(pathname);
  const tabRoute = variant === 'home' || variant === 'library' || variant === 'settings';

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
 * The app bar without its controls. Sized and padded exactly like `TopAppBar`,
 * so the real bar lands on the same pixels when the skeleton leaves.
 */
function LaunchTopBar({ variant }: { variant: LaunchVariant }) {
  const home = variant === 'home';
  const tab = home || variant === 'library' || variant === 'settings';
  const actionCount = home ? 1 : variant === 'library' ? 2 : 0;
  const titleWidth =
    variant === 'settings' ? 76 : variant === 'library' ? 54 : variant === 'generic' ? 104 : 112;

  return (
    <View
      style={{
        height: heights.appbar,
        paddingStart: 8,
        paddingEnd: 12,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: glassFillAppBar.backgroundColor,
      }}
    >
      {!tab && (
        <Skeleton
          width={heights.icon}
          height={heights.icon}
          radius={heights.icon / 2}
          style={{ marginEnd: 8 }}
        />
      )}

      {home ? (
        <>
          <Skeleton width={heights.icon} height={heights.icon} radius={radii.micro} />
          <Skeleton width={76} height={12} radius={6} style={{ marginStart: 8 }} />
        </>
      ) : (
        <Skeleton width={titleWidth} height={14} radius={7} style={{ marginStart: tab ? 8 : 0 }} />
      )}

      <View style={{ flex: 1 }} />

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        {Array.from({ length: actionCount }).map((_, index) => (
          <Skeleton
            key={index}
            width={heights.icon}
            height={heights.icon}
            radius={heights.icon / 2}
          />
        ))}
      </View>
    </View>
  );
}

function LaunchBody({ variant }: { variant: LaunchVariant }) {
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
        maxWidth: layout.contentMaxWidth,
        alignSelf: 'center',
        paddingHorizontal: spacing.screen,
        paddingTop: spacing.screen,
        overflow: 'hidden',
      }}
    >
      {variant === 'home' ? (
        <HomeLaunchSkeleton />
      ) : variant === 'statistics' ? (
        <StatisticsSkeleton />
      ) : variant === 'profile' ? (
        <>
          <HeroSkeleton height={190} />
          <View style={{ marginTop: spacing.section }}>
            <SettingsGroupSkeleton rows={3} />
          </View>
        </>
      ) : variant === 'settings' ? (
        <>
          <HeroSkeleton height={230} />
          <View style={{ marginTop: spacing.section }}>
            <SettingsGroupSkeleton rows={4} />
          </View>
          <View style={{ marginTop: spacing.section }}>
            <SettingsGroupSkeleton rows={3} />
          </View>
        </>
      ) : variant === 'library' ? (
        <HeroSkeleton height={260} />
      ) : variant === 'deck' ? (
        <>
          <HeroSkeleton height={150} />
          <View style={{ marginTop: 24 }}>
            <DeckCardGridSkeleton count={1} />
          </View>
        </>
      ) : (
        <>
          <HeroSkeleton />
          <View style={{ marginTop: spacing.section }}>
            <SectionHeaderSkeleton />
            <View style={{ marginTop: 12 }}>
              <DeckShelfSkeleton count={1} />
            </View>
          </View>
        </>
      )}
    </View>
  );
}

function HomeLaunchSkeleton() {
  return (
    <>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 8,
        }}
      >
        <View style={{ flex: 1, paddingEnd: 12 }}>
          <Skeleton width={84} height={9} radius={5} />
          <Skeleton width="82%" height={26} radius={8} style={{ marginTop: 7 }} />
        </View>
        <Skeleton width={76} height={28} radius={radii.pill} />
      </View>

      <GlassCard tone="accent" className="mt-6">
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Skeleton width={heights.tileLg} height={heights.tileLg} radius={radii.micro} />
          <Skeleton width={64} height={9} radius={5} />
        </View>

        <Skeleton width="64%" height={26} radius={8} style={{ marginTop: 10 }} />
        <Skeleton width={132} height={10} radius={5} style={{ marginTop: 13 }} />

        <View style={{ marginTop: 16 }}>
          <View
            style={{
              marginBottom: 8,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Skeleton width={74} height={8} radius={4} />
            <Skeleton width={64} height={8} radius={4} />
          </View>
          <Skeleton height={6} radius={radii.pill} />
        </View>

        <Skeleton
          height={heights.button}
          radius={radii.control}
          style={{ marginTop: 20 }}
        />
      </GlassCard>

      <View style={{ marginTop: spacing.section }}>
        <SectionHeaderSkeleton />
        <View style={{ marginTop: 12 }}>
          <DeckShelfSkeleton count={2} />
        </View>
      </View>
    </>
  );
}

function SectionHeaderSkeleton() {
  return (
    <View style={{ height: heights.hit, flexDirection: 'row', alignItems: 'center' }}>
      <Skeleton width={70} height={9} radius={5} />
      <Skeleton width={102} height={9} radius={5} style={{ marginStart: 8 }} />
      <View
        style={{
          marginStart: 'auto',
          flexDirection: 'row',
          alignItems: 'center',
          gap: 4,
        }}
      >
        <Skeleton width={iconSize.xs} height={iconSize.xs} radius={3} />
        <Skeleton width={48} height={9} radius={5} />
      </View>
    </View>
  );
}

/**
 * The floating dock in its pre-tab state: the same capsule geometry, with the
 * glyphs and captions still loading. It is a static skeleton, not a second
 * navigator — nothing here is focusable.
 */
function LaunchDock({ bottom }: { bottom: number }) {
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
        {[0, 1, 2].map((index) => (
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
