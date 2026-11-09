import { HintPressable } from '../HintPressable';
import { MaterialIcons } from '../Icon';
import { alpha, colors, iconSize, radii } from '../../theme/tokens';

type NewFolderButtonProps = {
  onPress: () => void;
  /** Accessible name; the visible control is the plus glyph alone. */
  label?: string;
};

/**
 * NewFolderButton — the one plus control for creating a folder.
 *
 * 44×44 rounded square, quiet control fill and the accent glyph: the shelf
 * header and the folder sheet both use it, so "add a folder" looks the same
 * wherever it appears.
 */
export function NewFolderButton({
  onPress,
  label = 'New folder',
}: NewFolderButtonProps) {
  return (
    <HintPressable
      hint={label}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{
        width: 44,
        height: 44,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: radii.control,
        backgroundColor: alpha(colors.surfaceControl, 0.6),
      }}
    >
      <MaterialIcons name="add" size={iconSize.lg} color={colors.primary} />
    </HintPressable>
  );
}
