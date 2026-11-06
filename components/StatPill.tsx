import { View } from 'react-native';
import { MaterialIcons } from './Icon';
import { AppText } from './AppText';
import { colors, iconSize } from '../theme/tokens';

type IconName = React.ComponentProps<typeof MaterialIcons>['name'];

type StatPillProps = {
  icon?: IconName;
  value: string;
  label: string;
  color?: string;
};

/**
 * StatPill — one number with its label. The number owns the headline scale, the
 * label stays caption. Used by the deck hero and the statistics panes.
 */
export function StatPill({ icon, value, label, color = colors.onSurfaceVariant }: StatPillProps) {
  return (
    <View className="flex-1 items-center">
      {icon && <MaterialIcons name={icon} size={iconSize.sm} color={color} />}
      <AppText variant="headline" weight="semibold" className="mt-1">
        {value}
      </AppText>
      <AppText variant="caption" tone="muted" align="center" className="uppercase">
        {label}
      </AppText>
    </View>
  );
}
