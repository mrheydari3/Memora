import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { MaterialIcons } from '../Icon';
import { alpha, colors, iconSize } from '../../theme/tokens';
import { HapticsEngine } from '../../services/haptics';

type RowOptionsProps = {
  label: string;
  onPress: () => void;
};

/** The mockup's options tile: a 40px transparent square on a 44px target. */
export function RowOptions({ label, onPress }: RowOptionsProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <Pressable
      onPress={() => {
        HapticsEngine.selection();
        onPress();
      }}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 8,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: hovered ? alpha(colors.surfaceTile, 0.9) : 'transparent',
        }}
      >
        <MaterialIcons name="more-vert" size={iconSize.lg} color={colors.outline} />
      </View>
    </Pressable>
  );
}
