import { useEffect, useRef, useState } from 'react';
import { Animated, Platform, View, TextInput } from 'react-native';
import type { TextStyle } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { IconButton } from './IconButton';
import { colors, fills, glassFill, heights, iconSize, motion, radii } from '../theme/tokens';
import { timingTo } from '../motion';

/** Browser focus rings are the OS accent; the wrapper border is the real cue. */
const NO_BROWSER_OUTLINE =
  Platform.OS === 'web' ? ({ outlineStyle: 'none' } as unknown as TextStyle) : undefined;

type SearchBarProps = {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
};

/**
 * SearchBar — the standard input: glass fill, hairline border, 44px tall,
 * 18px leading icon, clear affordance once there is a query.
 *
 * Focus fades an accent ring in over the hairline instead of flipping the border
 * colour, so the field never jumps; the clear button is the standard icon
 * control and answers a touch like every other one.
 */
export function SearchBar({ value, onChangeText, placeholder = 'Search…' }: SearchBarProps) {
  const [focused, setFocused] = useState(false);
  const focus = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    timingTo(focus, focused ? 1 : 0, { duration: motion.fast });
  }, [focused, focus]);

  return (
    <View
      className="flex-row items-center rounded-md border border-hairline pl-3 pr-1.5"
      style={[glassFill, { backgroundColor: fills.control, height: heights.field }]}
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
        style={NO_BROWSER_OUTLINE}
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
