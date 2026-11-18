import { HintPressable } from '../HintPressable';
import { MaterialIcons } from '../Icon';
import { alpha, colors, iconSize, radii } from '../../theme/tokens';

type NewFolderButtonProps = {
  onPress: () => void;
  /** Accessible name; the visible control is the folder-plus glyph alone. */
  label?: string;
};

/**
 * NewFolderButton — the one folder-plus control for creating a folder.
 *
 * 44×44 rounded square, quiet control fill and the accent glyph. The folder
 * sheet uses it for its inline "add a folder" shortcut; the folder-plus glyph
 * keeps that shortcut distinct from the header's one create action.
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
      <MaterialIcons name="create-new-folder" size={iconSize.lg} color={colors.primary} />
    </HintPressable>
  );
}
