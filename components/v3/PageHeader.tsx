import { Image, View } from 'react-native';
import { useRouter } from 'expo-router';
import { goBackOr } from '../../services/navigation';
import { AppText } from '../AppText';
import { FloatingHeader } from './FloatingHeader';
import { HeaderIcon } from './HeaderIcon';
import { v3 } from '../../theme/v3';

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
  /** Defaults to the 960px reading column; the composer passes its 420px column. */
  maxWidth?: number;
  testID?: string;
};

/**
 * PageHeader — the one 64px glass app bar, welded to the top edge.
 *
 * On a tab page it carries the brand (the mark and "Memora" are the h1); on a
 * stack page it carries the 44px back control and the route name as the h1.
 * `FloatingHeader` owns the top-edge crop, rounding and blur; the content still lands
 * on the page's 960px column, so the app bar and the body share one left edge.
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

  return (
    <FloatingHeader maxWidth={maxWidth} testID={testID} barTestID="page-header-bar">
      {leading ??
        (back ? <HeaderIcon icon="arrow-back" label="Go back" onPress={handleBack} /> : null)}

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
            <AppText
              variant="headline"
              weight="semibold"
              headingLevel={1}
              numberOfLines={1}
              style={{ letterSpacing: -0.4, flexShrink: 1 }}
            >
              Memora
            </AppText>
          </>
        ) : title ? (
          <AppText
            variant="headline"
            weight="semibold"
            headingLevel={1}
            numberOfLines={1}
            style={{ letterSpacing: -0.4, flexShrink: 1, minWidth: 0, marginStart: 4 }}
          >
            {title}
          </AppText>
        ) : null}

        {meta ? <View style={{ flexShrink: 0, marginLeft: 'auto' }}>{meta}</View> : null}
      </View>

      {actions ? (
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
      ) : null}
    </FloatingHeader>
  );
}
