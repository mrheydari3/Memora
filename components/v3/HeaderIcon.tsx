import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { MaterialIcons } from '../Icon';
import { colors, fills, iconSize } from '../../theme/tokens';

type IconName = React.ComponentProps<typeof MaterialIcons>['name'];

type HeaderIconProps = {
  icon: IconName;
  label: string;
  onPress: () => void;
};

/**
 * The mockup's bare app-bar glyph: a 22px ink on a 44px target, with a 40px
 * hover tile on web. It draws no resting fill, so the bar stays a header rather
 * than a row of buttons.
 */
export function HeaderIcon({ icon, label, onPress }: HeaderIconProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <Pressable
      onPress={onPress}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 10,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: hovered ? fills.control : 'transparent',
        }}
      >
        <MaterialIcons name={icon} size={iconSize.xl} color={colors.outline} />
      </View>
    </Pressable>
  );
}
