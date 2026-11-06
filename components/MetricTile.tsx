import { View } from 'react-native';
import type { ViewStyle } from 'react-native';
import { MaterialIcons } from './Icon';
import { AppText } from './AppText';
import type { TextTone } from './AppText';
import { GlassCard } from './GlassCard';
import { colors, iconSize } from '../theme/tokens';

type IconName = React.ComponentProps<typeof MaterialIcons>['name'];

type MetricTileProps = {
  label: string;
  value: string;
  /** One line of context: the denominator, the interval, the caveat. */
  detail?: string;
  icon?: IconName;
  tone?: TextTone;
  className?: string;
  style?: ViewStyle;
};

/**
 * MetricTile — a label, one figure and its denominator.
 *
 * Every tile shows the number *and* what it is out of, so a percentage cannot
 * be read without its sample. It is deliberately not tappable: these are
 * observations, not navigation.
 */
export function MetricTile({
  label,
  value,
  detail,
  icon,
  tone = 'default',
  className = '',
  style,
}: MetricTileProps) {
  return (
    <GlassCard padding="sm" className={`flex-1 ${className}`} style={style}>
      <View className="flex-row items-center">
        {icon ? (
          <MaterialIcons
            name={icon}
            size={iconSize.xs}
            color={colors.outline}
            style={{ marginEnd: 6 }}
          />
        ) : null}
        <AppText variant="caption" tone="muted" className="uppercase" numberOfLines={1}>
          {label}
        </AppText>
      </View>
      <AppText variant="title" tone={tone} className="mt-1" numberOfLines={1}>
        {value}
      </AppText>
      {detail ? (
        <AppText variant="caption" tone="muted" className="mt-0.5" numberOfLines={3}>
          {detail}
        </AppText>
      ) : null}
    </GlassCard>
  );
}
