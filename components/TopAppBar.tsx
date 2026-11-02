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
  showBorder?: boolean;
};

/**
 * TopAppBar — the standard bar: 56px tall, frosted to match the panes below it,
 * 17px semibold title, 38px circular glass icon buttons, hairline bottom edge.
 *
 * The bar names the route; a page's own subject heading (the deck name, the
 * home greeting) belongs to the body.
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
      className={`flex-row items-center pl-2 pr-3 ${showBorder ? 'border-b border-hairline' : ''}`}
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
            <AppText variant="bodyLg" weight="semibold" className="ml-2 flex-1" numberOfLines={1}>
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
