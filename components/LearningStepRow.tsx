import { View } from 'react-native';
import { AppText } from './AppText';
import { IconButton } from './IconButton';
import { colors, fills, iconSize } from '../theme/tokens';

type LearningStepRowProps = {
  index: number; // 0-indexed
  step: string;
  isFirst: boolean;
  onEdit: () => void;
  onRemove: () => void;
};

/**
 * LearningStepRow — a numbered step inside the learning-phase pane. Every step
 * is editable; the first one is protected from removal (a schedule needs at
 * least one step) and callers that allow "no steps" pass isFirst={false}.
 */
export function LearningStepRow({ index, step, isFirst, onEdit, onRemove }: LearningStepRowProps) {
  return (
    <View
      className="flex-row items-center border-b border-hairline px-4"
      style={{ minHeight: 52 }}
    >
      <View
        className="mr-3 h-6 w-6 items-center justify-center rounded-full border border-hairline"
        style={{ backgroundColor: fills.tile }}
      >
        <AppText variant="caption" weight="semibold" tone="muted">
          {index + 1}
        </AppText>
      </View>
      <AppText variant="body" weight="medium" className="mr-2 flex-1" numberOfLines={1}>
        {step}
      </AppText>
      <IconButton
        icon="edit"
        size="sm"
        glyphSize={iconSize.sm}
        onPress={onEdit}
        accessibilityLabel="Edit step"
      />
      {!isFirst && (
        <IconButton
          icon="close"
          size="sm"
          glyphSize={iconSize.sm}
          tone="danger"
          onPress={onRemove}
          accessibilityLabel="Remove step"
          className="ml-1"
        />
      )}
    </View>
  );
}
