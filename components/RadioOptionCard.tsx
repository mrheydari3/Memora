import { View, Pressable } from 'react-native';
import { MaterialIcons } from './Icon';
import { GlassCard } from './GlassCard';
import { AppText } from './AppText';
import { Pill } from './Pill';
import { colors, iconSize } from '../theme/tokens';

type IconName = React.ComponentProps<typeof MaterialIcons>['name'];

type RadioOptionCardProps = {
  icon: IconName;
  title: string;
  description: string;
  selected: boolean;
  onSelect: () => void;
  badge?: string;
};

/**
 * RadioOptionCard — a selectable glass pane. Selection is expressed by the
 * accent tone + accent hairline + a filled check, never by a solid border.
 */
export function RadioOptionCard({
  icon,
  title,
  description,
  selected,
  onSelect,
  badge,
}: RadioOptionCardProps) {
  return (
    <Pressable
      onPress={onSelect}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={title}
      className="active:scale-[0.99] rounded-xl"
    >
      <GlassCard tone={selected ? 'accent' : 'glass'}>
        <View className="flex-row items-center gap-2">
          <MaterialIcons
            name={icon}
            size={iconSize.lg}
            color={selected ? colors.primary : colors.onSurfaceVariant}
          />
          <AppText variant="bodyLg" weight="semibold" className="flex-1">
            {title}
          </AppText>
          {badge && <Pill label={badge} tone="accent" />}
          <View
            className={`h-5 w-5 items-center justify-center rounded-full border ${
              selected ? 'border-primary bg-primary' : 'border-hairline-strong'
            }`}
          >
            {selected && (
              <MaterialIcons name="check" size={iconSize.xs} color={colors.onPrimaryContainer} />
            )}
          </View>
        </View>
        <AppText variant="bodySm" tone="muted" className="mt-2">
          {description}
        </AppText>
      </GlassCard>
    </Pressable>
  );
}
