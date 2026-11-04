import { View, Pressable } from 'react-native';
import { MaterialIcons } from './Icon';
import { AppText } from './AppText';
import { Pill } from './Pill';
import { colors, fills, iconSize, radii } from '../theme/tokens';

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
 * RadioOptionCard — a selectable option row.
 *
 * Selection is one accent wash plus one filled check, nothing else: no outline,
 * no border and no second shape competing with the icon. The unselected state is
 * a quiet inset fill, so a list of options reads as one column of text with a
 * single answer highlighted.
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
      accessibilityState={{ checked: selected }}
      aria-checked={selected}
      accessibilityLabel={title}
      className="rounded-xl"
    >
      <View
        className="rounded-xl px-4 py-3.5"
        style={{
          borderRadius: radii.control,
          backgroundColor: selected ? colors.accentActive : fills.inset,
        }}
      >
        <View className="flex-row items-center gap-3">
          <MaterialIcons
            name={icon}
            size={iconSize.lg}
            color={selected ? colors.primary : colors.onSurfaceVariant}
          />
          <AppText variant="body" weight="semibold" className="flex-1" numberOfLines={1}>
            {title}
          </AppText>
          {badge && <Pill label={badge} tone="accent" />}
          <MaterialIcons
            name={selected ? 'check-circle' : 'radio-button-unchecked'}
            size={iconSize.md}
            color={selected ? colors.primary : colors.outlineSoft}
          />
        </View>
        <AppText variant="bodySm" tone="muted" className="mt-1.5">
          {description}
        </AppText>
      </View>
    </Pressable>
  );
}
