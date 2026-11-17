import { View } from 'react-native';
import { MaterialIcons } from '../Icon';
import { AppText } from '../AppText';
import { HintPressable } from '../HintPressable';
import { DueFigure } from './DueFigure';
import { colors } from '../../theme/tokens';
import { v4 } from '../../theme/v4';

type IconName = React.ComponentProps<typeof MaterialIcons>['name'];

type SubfolderRowProps = {
  name: string;
  icon?: string;
  color?: string;
  /** Decks anywhere in the subfolder's subtree. */
  decks: number;
  due: number;
  onPress: () => void;
  /** Defaults to the inline child-folder row; search hits pass `folder-result`. */
  testID?: string;
  /** Drop the bottom hairline when the row closes a group. */
  last?: boolean;
};

const plural = (count: number, one: string, many: string) =>
  `${count} ${count === 1 ? one : many}`;

/**
 * SubfolderRow — a folder that is a door, not an accordion.
 *
 * At a nested level a child folder opens its own level, so it keeps the
 * subfolder grammar: an 18px folder mark, the name, just its deck count, the
 * due figure and a chevron. The count is only the number of decks, because the
 * due figure beside it already owns the second number.
 */
export function SubfolderRow({
  name,
  icon,
  color,
  decks,
  due,
  onPress,
  testID = 'folder-subitem',
  last = false,
}: SubfolderRowProps) {
  return (
    <HintPressable
      hint="Open folder"
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Open folder ${name}, ${plural(decks, 'deck', 'decks')}, ${
        due > 0 ? `${due} due` : 'nothing due'
      }`}
      style={{
        minHeight: 44,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 11,
        paddingTop: v4.row.subfolderPadding,
        paddingBottom: v4.row.subfolderPadding,
        paddingRight: 2,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: colors.v4Line,
      }}
    >
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{ width: 22, alignItems: 'flex-start', flexShrink: 0 }}
      >
        <MaterialIcons
          name={(icon ?? 'folder') as IconName}
          size={18}
          color={color ?? colors.outline}
        />
      </View>

      <View style={{ flex: 1, minWidth: 0 }}>
        <AppText
          weight="medium"
          numberOfLines={1}
          style={{ fontSize: 14, lineHeight: 19, letterSpacing: -0.05 }}
        >
          {name}
        </AppText>
        <AppText
          numberOfLines={1}
          style={[v4.type.folderMeta, { marginTop: 2, color: colors.outline }]}
        >
          {plural(decks, 'deck', 'decks')}
        </AppText>
      </View>

      <DueFigure value={due} kind="subfolder" testID="subfolder-due" clearLabel="empty" />

      <MaterialIcons name="chevron-right" size={14} color={colors.outline} />
    </HintPressable>
  );
}
