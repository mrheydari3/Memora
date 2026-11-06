import { useId } from 'react';
import type { ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, Text } from 'react-native';
import type { PressableProps } from 'react-native';

type HintPressableProps = Omit<PressableProps, 'children'> & {
  children?: ReactNode;
  hint: string;
};

/**
 * A Pressable whose hint reaches web screen readers.
 *
 * react-native-web 0.21 forwards accessibilityLabel but drops
 * accessibilityHint, so a web control otherwise never explains what pressing
 * it will do. Native keeps the platform hint; web gets a hidden description
 * node referenced by aria-describedby.
 */
export function HintPressable({ hint, children, ...props }: HintPressableProps) {
  const id = `hint-${useId().replace(/:/g, '')}`;

  return (
    <Pressable
      {...props}
      accessibilityHint={hint}
      {...(Platform.OS === 'web' ? { 'aria-describedby': id } : null)}
    >
      {children}
      {Platform.OS === 'web' ? (
        <Text nativeID={id} style={styles.hidden}>
          {hint}
        </Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hidden: { display: 'none' },
});
