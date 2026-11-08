import { Pressable, useWindowDimensions, View } from 'react-native';
import { MaterialIcons } from '../Icon';
import { AppText } from '../AppText';
import { alpha, colors, fills, heights, iconSize } from '../../theme/tokens';
import { v3 } from '../../theme/v3';

type IconName = React.ComponentProps<typeof MaterialIcons>['name'];

type StudyTrayProps = {
  /** The card's persisted bookmark flag, not a local toggle. */
  marked: boolean;
  onToggleMark: () => void;
  onEditNote: () => void;
  onOptions: () => void;
  /** Anchors the session options menu to the control that opens it. */
  optionsRef?: React.RefObject<React.ComponentRef<typeof View> | null>;
  disabled?: boolean;
};

type TrayActionProps = {
  icon: IconName;
  label: string;
  onPress: () => void;
  active?: boolean;
  /** Present on a toggle: rendered as `aria-pressed` on the web. */
  pressed?: boolean;
  disabled?: boolean;
  showIcon: boolean;
};

function TrayAction({
  icon,
  label,
  onPress,
  active = false,
  pressed,
  disabled = false,
  showIcon,
}: TrayActionProps) {
  // `aria-pressed` is the correct state for a toggle button, but Pressable's
  // types do not list it; it is passed straight through to the DOM.
  const toggle =
    pressed === undefined
      ? {}
      : ({ 'aria-pressed': pressed } as Record<string, unknown>);

  return (
    <Pressable
      {...toggle}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      style={{
        flex: 1,
        minWidth: 0,
        minHeight: heights.hit,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: showIcon ? 6 : 0,
        borderRadius: v3.radii.control,
        backgroundColor: active ? alpha(colors.primary, 0.14) : fills.control,
        paddingHorizontal: 8,
        opacity: disabled ? 0.45 : 1,
      }}
    >
      {showIcon ? (
        <MaterialIcons
          name={icon}
          size={iconSize.sm}
          color={active ? colors.primary : colors.outline}
        />
      ) : null}
      <AppText
        variant="label"
        weight="semibold"
        tone={active ? 'accent' : 'muted'}
        numberOfLines={1}
        style={{ flexShrink: 1 }}
      >
        {label}
      </AppText>
    </Pressable>
  );
}

/**
 * StudyTray — the session's three card utilities.
 *
 * Marked is a real bookmark: the filled glyph and the accent wash say the card
 * is flagged, and the flag itself is the card's persisted `marked` field. Edit
 * note and Options open real sheets; none of the three is decoration. Below
 * 380px the labels stand alone, because a glyph beside "Edit note" leaves the
 * pill too narrow for the words it must show.
 */
export function StudyTray({
  marked,
  onToggleMark,
  onEditNote,
  onOptions,
  optionsRef,
  disabled = false,
}: StudyTrayProps) {
  const { width } = useWindowDimensions();
  const showIcon = width >= 380;

  return (
    <View
      style={{
        flexDirection: 'row',
        gap: 8,
        width: '100%',
        maxWidth: v3.layout.studyCard,
        alignSelf: 'center',
        marginTop: 4,
      }}
    >
      <TrayAction
        icon={marked ? 'bookmark' : 'bookmark-border'}
        label="Marked"
        active={marked}
        pressed={marked}
        onPress={onToggleMark}
        disabled={disabled}
        showIcon={showIcon}
      />
      <TrayAction
        icon="edit"
        label="Edit note"
        onPress={onEditNote}
        disabled={disabled}
        showIcon={showIcon}
      />
      <View ref={optionsRef} collapsable={false} style={{ flex: 1 }}>
        <TrayAction
          icon="tune"
          label="Options"
          onPress={onOptions}
          disabled={disabled}
          showIcon={showIcon}
        />
      </View>
    </View>
  );
}
