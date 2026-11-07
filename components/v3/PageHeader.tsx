import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { goBackOr } from '../../services/navigation';
import { MaterialIcons } from '../Icon';
import { AppText } from '../AppText';
import { HeaderIcon } from './HeaderIcon';
import { colors, heights, iconSize } from '../../theme/tokens';
import { v3 } from '../../theme/v3';

type PageHeaderProps = {
  /** The route's name. Omit on a brand page. */
  title?: string;
  /** The tab-page identity: the mark, "Memora" and the h1. */
  brand?: boolean;
  /** Show the 44px back control. */
  back?: boolean;
  /** Where back goes; defaults to the Home tab. */
  onBack?: () => void;
  /** A streak or status chip that sits beside the title. */
  meta?: React.ReactNode;
  /** HeaderIcon siblings, the profile action, or another 44px control. */
  actions?: React.ReactNode;
  /** Defaults to the 960px reading column; the composer passes its 420px column. */
  maxWidth?: number;
  testID?: string;
};

/**
 * PageHeader — the one 64px app bar.
 *
 * On a tab page it carries the brand (the mark and "Memora" are the h1); on a
 * stack page it carries the 44px back control and the route name as the h1.
 * The bar is full-bleed, but its content stays on the same 960px column as the
 * page body. It writes no rule and casts no shadow: the page scrolls under it.
 */
export function PageHeader({
  title,
  brand = false,
  back = false,
  onBack,
  meta,
  actions,
  maxWidth,
  testID,
}: PageHeaderProps) {
  const router = useRouter();
  const handleBack = onBack ?? (() => goBackOr(router, '/(tabs)/home'));

  return (
    <View testID={testID} style={{ backgroundColor: colors.appBarGlass }}>
      <View
        style={{
          height: heights.pageHeader,
          width: '100%',
          maxWidth: maxWidth ?? v3.layout.contentMaxWidth,
          alignSelf: 'center',
          flexDirection: 'row',
          alignItems: 'center',
          gap: 4,
          paddingHorizontal: back ? 12 : 20,
        }}
      >
        {back && <HeaderIcon icon="arrow-back" label="Go back" onPress={handleBack} />}

        <View style={{ flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {brand ? (
            <>
              <View
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: colors.surfaceControl,
                  flexShrink: 0,
                }}
              >
                <MaterialIcons name="blur-on" size={iconSize.lg} color={colors.primary} />
              </View>
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

          {meta ? <View style={{ flexShrink: 0 }}>{meta}</View> : null}
        </View>

        {actions ? (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 2,
              flexShrink: 0,
            }}
          >
            {actions}
          </View>
        ) : null}
      </View>
    </View>
  );
}

/**
 * The filled 32px avatar on its 44px header target. It is the same action on
 * Home, Game and Settings, so it lives with the bar rather than in three files.
 */
export function HeaderProfileButton({
  onPress,
  label = 'Profile',
}: {
  onPress: () => void;
  label?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
    >
      <View
        style={{
          width: 32,
          height: 32,
          borderRadius: 16,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.primary,
        }}
      >
        <MaterialIcons name="person" size={18} color={colors.onPrimary} />
      </View>
    </Pressable>
  );
}
