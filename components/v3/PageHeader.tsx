import { Image, View } from 'react-native';
import { useRouter } from 'expo-router';
import { goBackOr } from '../../services/navigation';
import { AppText } from '../AppText';
import { FloatingHeader } from './FloatingHeader';
import { HeaderIcon } from './HeaderIcon';
import { v3 } from '../../theme/v3';
import { useTextScale } from '../../hooks/useTextScale';

type PageHeaderProps = {
  /** The route's name. Omit on a brand page. */
  title?: string;
  /** The tab-page identity: the mark, "Memora" and the h1. */
  brand?: boolean;
  /** Show the 44px back control. */
  back?: boolean;
  /** A custom 44px leading control (for example a session's Close) instead of the back arrow. */
  leading?: React.ReactNode;
  /** Where back goes; defaults to the Home tab. */
  onBack?: () => void;
  /** A streak or status chip that sits beside the title. */
  meta?: React.ReactNode;
  /** HeaderIcon siblings or another 44px control. */
  actions?: React.ReactNode;
  /** Defaults to the 760px large-layout column; the composer passes its 420px column. */
  maxWidth?: number;
  testID?: string;
};

/**
 * PageHeader — the one 64px glass app bar, welded to the top edge.
 *
 * On a tab page it carries the brand (the mark and "Memora" are the h1); on a
 * stack page it carries the 44px back control and the route name as the h1.
 * `FloatingHeader` owns the top-edge crop, rounding and blur; the content still lands
 * on the page's 760px column, so the app bar and the body share one left edge.
 *
 * At 200% text on a 320px phone, a leading control and two trailing actions can
 * leave less than one word of title width. The title moves below that control
 * row there, so a route name never breaks mid-word or clips against the rim.
 */
export function PageHeader({
  title,
  brand = false,
  back = false,
  leading,
  onBack,
  meta,
  actions,
  maxWidth,
  testID,
}: PageHeaderProps) {
  const router = useRouter();
  const handleBack = onBack ?? (() => goBackOr(router, '/(tabs)/home'));
  const { largeText } = useTextScale();
  // Give the title its own full-width row whenever scaled text has controls
  // beside it. The old single row left so little width at 320 that even
  // "Statistics" split mid-word, and the long deck title clipped at 390.
  const stacked = Boolean(title && !brand && largeText && (leading || back || meta || actions));

  const leadingNode =
    leading ?? (back ? <HeaderIcon icon="arrow-back" label="Go back" onPress={handleBack} /> : null);
  const titleNode = title ? (
    <AppText
      variant="headline"
      weight="semibold"
      headingLevel={1}
      numberOfLines={2}
      style={{ letterSpacing: -0.4, flexShrink: 1, minWidth: 0, marginStart: stacked ? 0 : 4 }}
    >
      {title}
    </AppText>
  ) : null;
  const metaNode = meta ? <View style={{ flexShrink: 0 }}>{meta}</View> : null;
  const actionsNode = actions ? (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: v3.appBar.actionGap,
        flexShrink: 0,
      }}
    >
      {actions}
    </View>
  ) : null;

  return (
    <FloatingHeader maxWidth={maxWidth} testID={testID} barTestID="page-header-bar">
      {stacked ? (
        <View style={{ flex: 1, minWidth: 0, width: '100%', gap: 4 }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              minHeight: 44,
              gap: v3.appBar.contentGap,
            }}
          >
            {leadingNode}
            <View style={{ flex: 1 }} />
            {metaNode}
            {actionsNode}
          </View>
          {titleNode}
        </View>
      ) : (
        <>
          {leadingNode}

          <View
            style={{
              flex: 1,
              minWidth: 0,
              flexDirection: 'row',
              alignItems: 'center',
              gap: v3.appBar.contentGap,
            }}
          >
            {brand ? (
              <>
                {/* The light-on-dark rendition: same geometry as the supplied
                    mark, fills lifted so it holds on the ink canvas with no plate. */}
                <Image
                  source={require('../../assets/brand-mark-dark.png')}
                  style={{
                    width: v3.appBar.brandTile,
                    height: v3.appBar.brandTile,
                    flexShrink: 0,
                  }}
                  resizeMode="contain"
                  accessible={false}
                  alt=""
                  testID="brand-mark"
                />
                {largeText ? (
                  // The wordmark cannot share the 320px bar with a 200% streak chip
                  // and two actions. The mark stays as the visual identity; this
                  // hidden h1 keeps the page outline intact for assistive tech.
                  <AppText
                    variant="headline"
                    weight="semibold"
                    headingLevel={1}
                    style={{ position: 'absolute', width: 1, height: 1, opacity: 0 }}
                  >
                    Memora
                  </AppText>
                ) : (
                  <AppText
                    variant="headline"
                    weight="semibold"
                    headingLevel={1}
                    numberOfLines={1}
                    style={{ letterSpacing: -0.4, flexShrink: 1 }}
                  >
                    Memora
                  </AppText>
                )}
              </>
            ) : (
              titleNode
            )}

            {meta ? <View style={{ flexShrink: 0, marginLeft: 'auto' }}>{meta}</View> : null}
          </View>

          {actionsNode}
        </>
      )}
    </FloatingHeader>
  );
}
