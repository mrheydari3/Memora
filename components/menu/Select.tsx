import { useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { MaterialIcons } from '../Icon';
import { AppText } from '../AppText';
import { Menu } from './Menu';
import type { IconName, MenuAction } from './types';
import { colors, heights, iconSize, radii } from '../../theme/tokens';

export type SelectOption = {
  value: string;
  label: string;
  description?: string;
  icon?: IconName;
  disabled?: boolean;
  /** A fuller name for assistive tech, when the visible label is a shorthand. */
  accessibilityLabel?: string;
};

type SelectProps = {
  /** The field's name, e.g. "Sort". */
  label: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  /** The visible value when it differs from the option label. */
  valueLabel?: string;
  /** Leading glyph in the trigger. */
  icon?: IconName;
  width?: number;
  disabled?: boolean;
  sheetTitle?: string;
  sheetSubtitle?: string;
  testID?: string;
};

/**
 * Select — a labelled single-choice picker.
 *
 * The trigger reads "Sort: Newest" so the field and its current value are one
 * accessible name (and one unambiguous string on screen). The list is the same
 * MenuItem vocabulary as every other menu: a check on the selected option, a
 * radio role when anchored, and a compact sheet on a phone.
 */
export function Select({
  label,
  value,
  options,
  onChange,
  valueLabel,
  icon,
  width,
  disabled = false,
  sheetTitle,
  sheetSubtitle,
  testID,
}: SelectProps) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<React.ComponentRef<typeof View>>(null);
  const selected = options.find((option) => option.value === value);
  const shownValue = valueLabel ?? selected?.label ?? value;
  const text = `${label}: ${shownValue}`;

  const actions: MenuAction[] = options.map((option) => ({
    key: option.value,
    label: option.label,
    description: option.description,
    icon: option.icon,
    selected: option.value === value,
    disabled: option.disabled,
    accessibilityLabel: option.accessibilityLabel,
    onPress: () => onChange(option.value),
  }));

  return (
    <View ref={anchorRef} collapsable={false} style={{ flexShrink: 0 }}>
      <Pressable
        testID={testID}
        onPress={disabled ? undefined : () => setOpen(true)}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={text}
        accessibilityState={{ disabled, expanded: open }}
        aria-haspopup="menu"
        aria-expanded={open}
        style={{
          minHeight: heights.hit,
          paddingHorizontal: 12,
          borderRadius: radii.control,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          backgroundColor: colors.surfaceControl,
          opacity: disabled ? 0.45 : 1,
        }}
      >
        {icon && (
          <MaterialIcons name={icon} size={iconSize.sm} color={colors.outline} />
        )}
        <AppText variant="caption" weight="semibold" numberOfLines={1} style={{ flexShrink: 1 }}>
          {text}
        </AppText>
        <MaterialIcons name="expand-more" size={iconSize.sm} color={colors.outline} />
      </Pressable>

      <Menu
        open={open}
        onClose={() => setOpen(false)}
        anchorRef={anchorRef}
        label={sheetTitle ?? label}
        title={sheetTitle ?? label}
        subtitle={sheetSubtitle}
        actions={actions}
        width={width}
      />
    </View>
  );
}
