import { View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { goBackOr } from '../services/navigation';
import { AppText } from './AppText';
import { IconButton } from './IconButton';
import { glassFillAppBar, heights, iconSize } from '../theme/tokens';
import { v2 } from '../theme/v2';

type IconName = React.ComponentProps<typeof import('@expo/vector-icons').MaterialIcons>['name'];

type TopAppBarProps = {
  title?: string;
  /**
   * Which heading level the bar title takes. Defaults to 1. Pass `null` when
   * the screen's subject is named below the bar (the deck page): otherwise the
   * word "Deck" is the page's h1 and the deck's own name is anonymous text.
   */
  titleHeadingLevel?: 1 | 2 | 3 | null;
  /** Shows the back arrow top-left. */
  back?: boolean;
  /** Where to land when the route has no history (deep link, refresh, PWA). */
  backFallback?: Href;
  /** Replaces the default back action; use for unsaved-change guards. */
  onBack?: () => void;
  /** Right-side icon buttons. */
  actions?: { icon: IconName; onPress?: () => void; accessibilityLabel: string; disabled?: boolean }[];
  /** Custom left content replaces back + title. */
  leftContent?: React.ReactNode;
  /** Custom right content replaces the icon actions. */
  rightContent?: React.ReactNode;
  /** Kept for call-site compatibility; the bar has no rule to draw. */
  showBorder?: boolean;
};

/**
 * TopAppBar — the standard bar: 56px tall, a fifth-weight ink wash rather than
 * a solid strip, 17px semibold title, 38px circular filled icon buttons.
 *
 * The bar has no bottom rule and casts no shadow: the body stays visible as it
 * scrolls underneath. Where a line is genuinely meaningful — the study
 * session's progress — the screen draws that one line itself.
 */
export function TopAppBar({
  title,
  titleHeadingLevel = 1,
  back = false,
  backFallback = '/(tabs)/home',
  onBack,
  actions = [],
  leftContent,
  rightContent,
  showBorder = true,
}: TopAppBarProps) {
  const router = useRouter();

  const handleBack = () => {
    if (onBack) {
      onBack();
      return;
    }
    goBackOr(router, backFallback);
  };

  return (
    <View
      className="flex-row items-center justify-center"
      style={[glassFillAppBar, { height: heights.appbar, paddingStart: 8, paddingEnd: 12 }]}
    >
      {/* The bar is full-bleed, but its controls sit on the same column as the
          page content instead of the viewport edge (the 1280px audit). */}
      <View
        className="flex-1 flex-row items-center"
        style={{ width: '100%', maxWidth: v2.layout.contentMaxWidth }}
      >
      {leftContent ? (
        leftContent
      ) : (
        <View className="flex-1 flex-row items-center">
          {back && (
            <IconButton
              icon="arrow-back"
              onPress={handleBack}
              accessibilityLabel="Go back"
              glyphSize={iconSize.md}
            />
          )}
          {title && (
            // The bar title is the page's h1: it gives every route a document
            // outline instead of one flat run of anonymous text.
            <AppText
              variant="bodyLg"
              weight="semibold"
              className="flex-1"
              style={{ marginStart: 8 }}
              numberOfLines={1}
              headingLevel={titleHeadingLevel ?? undefined}
            >
              {title}
            </AppText>
          )}
        </View>
      )}

      {rightContent}

      <View className="flex-row items-center gap-1.5">
        {actions.map((action, i) => (
          <IconButton
            key={i}
            icon={action.icon}
            onPress={action.onPress}
            accessibilityLabel={action.accessibilityLabel}
            disabled={action.disabled}
          />
        ))}
      </View>
      </View>
    </View>
  );
}
