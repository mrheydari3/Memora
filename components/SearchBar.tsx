import { useEffect, useRef, useState } from 'react';
import { Animated, View, TextInput } from 'react-native';
import { MaterialIcons } from './Icon';
import { IconButton } from './IconButton';
import { colors, fills, heights, iconSize, motion, radii } from '../theme/tokens';
import { timingTo } from '../motion';

type SearchBarProps = {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
};

/**
 * SearchBar — the standard input: control fill, 44px tall, 18px leading icon,
 * clear affordance once there is a query.
 *
 * No resting outline: the field is one fill step above its pane. Focus fades an
 * accent ring in (the one border in the system that carries meaning), so the
 * field never jumps.
 *
 * The browser's own ring is *not* suppressed: a keyboard user needs a cue that
 * survives an interrupted animation, and the audit measured this input as the
 * one control with no visible focus at all. The animated accent border is an
 * enhancement on top of the 2px `:focus-visible` ring in global.css.
 */
export function SearchBar({ value, onChangeText, placeholder = 'Search…' }: SearchBarProps) {
  const [focused, setFocused] = useState(false);
  const focus = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    timingTo(focus, focused ? 1 : 0, { duration: motion.fast });
  }, [focused, focus]);

  return (
    <View
      className="flex-row items-center rounded-md pl-3 pr-1.5"
      style={{ backgroundColor: fills.control, height: heights.field }}
    >
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          borderWidth: 1,
          borderColor: colors.primary,
          borderRadius: radii.control,
          opacity: focus,
        }}
      />
      <MaterialIcons name="search" size={iconSize.md} color={colors.outline} />
      <TextInput
        className="ml-2 flex-1 text-body font-inter-regular text-on-surface"
        value={value}
        onChangeText={onChangeText}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={placeholder}
        placeholderTextColor={colors.outline}
        accessibilityLabel="Search"
      />
      {value.length > 0 && (
        <IconButton
          icon="close"
          size="sm"
          glyphSize={iconSize.sm}
          onPress={() => onChangeText('')}
          accessibilityLabel="Clear search"
        />
      )}
    </View>
  );
}
