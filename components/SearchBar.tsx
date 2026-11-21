import { useState } from 'react';
import { Platform, View, TextInput } from 'react-native';
import type { TextStyle } from 'react-native';
import { MaterialIcons } from './Icon';
import { IconButton } from './IconButton';
import { colors, fills, heights, iconSize, radii } from '../theme/tokens';

type SearchBarProps = {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  /** Contextual name for the input, e.g. "Search icons". */
  accessibilityLabel?: string;
  /** The resting field fill; defaults to the system control fill. */
  fillColor?: string;
};

/** Web only: a pointer user already has the caret, so the ring would read as a selection box. */
const NO_OUTLINE = { outlineStyle: 'none' } as unknown as TextStyle;

/**
 * SearchBar — the standard input: control fill, 44px tall, 18px leading icon,
 * clear affordance once there is a query.
 *
 * No resting outline: the field is one fill step above its pane. The input
 * spans the whole field, so its one focus ring follows the field's rounded
 * edge instead of drawing a second, smaller rectangle inside it.
 *
 * A browser treats a text input as keyboard-focusable even when it was clicked,
 * so `:focus-visible` paints the ring on a mouse click too. A pointer-down on
 * this field marks the resulting focus as pointer-acquired and hides the ring;
 * blur clears the mark, so tabbing back in, or focusing the field after
 * clicking elsewhere, restores the keyboard ring.
 */
export function SearchBar({
  value,
  onChangeText,
  placeholder = 'Search…',
  accessibilityLabel = 'Search',
  fillColor = fills.control,
}: SearchBarProps) {
  const [pointerFocus, setPointerFocus] = useState(false);

  return (
    <View
      className="flex-row items-center rounded-md"
      onPointerDown={() => setPointerFocus(true)}
      style={{
        backgroundColor: fillColor,
        height: heights.field,
        minWidth: 0,
        position: 'relative',
      }}
    >
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: 12,
          top: 0,
          bottom: 0,
          justifyContent: 'center',
        }}
      >
        <MaterialIcons name="search" size={iconSize.md} color={colors.outline} />
      </View>
      <TextInput
        className="flex-1 text-body font-inter-regular text-on-surface"
        // The web input keeps an intrinsic minimum width unless it is told it
        // may shrink; without this a long query pushes the clear control out
        // from under the field and beneath the toolbar chips.
        style={[
          {
            height: heights.field,
            minWidth: 0,
            paddingLeft: 38,
            paddingRight: value.length > 0 ? 44 : 12,
            paddingTop: 0,
            paddingBottom: 0,
            borderRadius: radii.control,
            backgroundColor: 'transparent',
          },
          Platform.OS === 'web' && pointerFocus ? NO_OUTLINE : null,
        ]}
        value={value}
        onChangeText={onChangeText}
        onBlur={() => setPointerFocus(false)}
        placeholder={placeholder}
        placeholderTextColor={colors.outline}
        accessibilityLabel={accessibilityLabel}
      />
      {value.length > 0 && (
        <View
          style={{
            position: 'absolute',
            right: 6,
            top: 0,
            bottom: 0,
            justifyContent: 'center',
          }}
        >
          <IconButton
            icon="close"
            size="sm"
            glyphSize={iconSize.sm}
            onPress={() => onChangeText('')}
            accessibilityLabel="Clear search"
          />
        </View>
      )}
    </View>
  );
}
