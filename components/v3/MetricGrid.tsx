import { useWindowDimensions, View } from 'react-native';
import type { ViewStyle } from 'react-native';
import { MaterialIcons } from '../Icon';
import { AppText } from '../AppText';
import { Surface } from './Surface';
import { colors, iconSize } from '../../theme/tokens';
import { v3 } from '../../theme/v3';

type IconName = React.ComponentProps<typeof MaterialIcons>['name'];

export type Metric = {
  label: string;
  value: string;
  unit?: string;
  note?: string;
  icon?: IconName;
  /** A token colour for the value, e.g. `colors.warning`. */
  color?: string;
};

type MetricGridProps = {
  items: Metric[];
  /** Force two or four across; by default 2 on phones and 4 from 900px. */
  columns?: 2 | 4;
  className?: string;
  style?: ViewStyle | ViewStyle[];
};

/**
 * MetricGrid — observations, not navigation.
 *
 * Two columns on a phone and four across a wide canvas, each tile an inset
 * control fill. Every tile keeps the figure with its label and note, so a
 * percentage never loses its sample.
 */
export function MetricGrid({ items, columns, className = '', style }: MetricGridProps) {
  const { width } = useWindowDimensions();
  const count = columns ?? (width >= 900 ? 4 : 2);

  return (
    <View
      className={className}
      style={[{ flexDirection: 'row', flexWrap: 'wrap', gap: v3.spacing.group }, style]}
    >
      {items.map((metric, index) => (
        <Surface
          key={`${metric.label}-${index}`}
          tone="inset"
          radius="control"
          padding="sm"
          style={{
            flexGrow: 1,
            flexBasis: count === 2 ? '47%' : 0,
            minWidth: 130,
            minHeight: 96,
            justifyContent: 'space-between',
          }}
        >
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              {metric.icon ? (
                <MaterialIcons name={metric.icon} size={iconSize.xs} color={colors.outline} />
              ) : null}
              <AppText
                variant="caption"
                tone="muted"
                className="uppercase"
                numberOfLines={1}
                style={{ flexShrink: 1 }}
              >
                {metric.label}
              </AppText>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4, marginTop: 4 }}>
              <AppText
                variant="title"
                numberOfLines={1}
                style={metric.color ? { color: metric.color } : undefined}
              >
                {metric.value}
              </AppText>
              {metric.unit ? (
                <AppText variant="caption" tone="muted">
                  {metric.unit}
                </AppText>
              ) : null}
            </View>
          </View>

          {metric.note ? (
            <AppText variant="caption" tone="muted" numberOfLines={3} style={{ marginTop: 4 }}>
              {metric.note}
            </AppText>
          ) : null}
        </Surface>
      ))}
    </View>
  );
}
