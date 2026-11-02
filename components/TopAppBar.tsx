import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { AppText } from './AppText';
import { IconButton } from './IconButton';
import { glassFillStrong, heights, iconSize } from '../theme/tokens';

type IconName = React.ComponentProps<typeof import('@expo/vector-icons').MaterialIcons>['name'];

type TopAppBarProps = {
  title?: string;
  /** Shows the back arrow top-left. */
  back?: boolean;
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
 * TopAppBar — the standard bar: 56px tall, frosted to match the panes below it,
 * 17px semibold title, 38px circular filled icon buttons.
 *
 * The bar has no bottom rule: it is a stronger frosted fill than the page, and
 * the scrolling body passes underneath it. Where a line is genuinely meaningful
 * — the study session's progress — the screen draws that one line itself.
 */
export function TopAppBar({
  title,
  back = false,
  actions = [],
  leftContent,
  rightContent,
  showBorder = true,
}: TopAppBarProps) {
  const router = useRouter();

  return (
    <View
      className="flex-row items-center pl-2 pr-3"
      style={[glassFillStrong, { height: heights.appbar }]}
    >
      {leftContent ? (
        leftContent
      ) : (
        <View className="flex-1 flex-row items-center">
          {back && (
            <IconButton
              icon="arrow-back"
              onPress={() => router.back()}
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
              className="ml-2 flex-1"
              numberOfLines={1}
              headingLevel={1}
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
  );
}
