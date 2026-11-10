import { View } from 'react-native';
import type { ViewStyle } from 'react-native';

type ShelfPanelProps = {
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
  testID?: string;
};

/**
 * ShelfPanel — the section frame around Home's library index.
 *
 * The shelf used to be a bordered glass tray, which boxed the library in a
 * second surface directly under the hero and broke the fill-only depth rule.
 * The redesign opens it: the masthead, bands and cards now sit on the canvas,
 * and the cards' own fills carry the depth. The frame remains as the section's
 * semantic and test hook, not as another pane.
 */
export function ShelfPanel({
  children,
  style,
  testID = 'shelf-panel',
}: ShelfPanelProps) {
  return (
    <View testID={testID} style={style}>
      {children}
    </View>
  );
}
