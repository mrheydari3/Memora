import { useId } from 'react';
import type { ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, Text } from 'react-native';
import type { PressableProps } from 'react-native';
import { HapticsEngine } from '../services/haptics';

type HintPressableProps = Omit<PressableProps, 'children'> & {
  children?: ReactNode;
  hint: string;
  /** Defaults to true; set false when the press has its own semantic cue. */
  haptic?: boolean;
};

/**
 * A Pressable whose hint reaches web screen readers.
 *
 * react-native-web 0.21 forwards accessibilityLabel but drops
 * accessibilityHint, so a web control otherwise never explains what pressing
 * it will do. Native keeps the platform hint; web gets a hidden description
 * node referenced by aria-describedby.
 */
export function HintPressable({
  hint,
  children,
  haptic = true,
  onPress,
  ...props
}: HintPressableProps) {
  const id = `hint-${useId().replace(/:/g, '')}`;

  return (
    <>
      <Pressable
        {...props}
        onPress={
          onPress
            ? (event) => {
                if (haptic) HapticsEngine.selection();
                onPress(event);
              }
            : undefined
        }
        accessibilityHint={hint}
        {...(Platform.OS === 'web' ? { 'aria-describedby': id } : null)}
      >
        {children}
      </Pressable>
      {Platform.OS === 'web' ? (
        <Text nativeID={id} style={styles.hidden}>
          {hint}
        </Text>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  hidden: { display: 'none' },
});
