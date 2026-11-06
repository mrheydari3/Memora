import { View } from 'react-native';
import { AppText } from './AppText';
import { IconButton } from './IconButton';
import { colors, fills, heights, iconSize } from '../theme/tokens';

type LearningStepRowProps = {
  index: number; // 0-indexed
  step: string;
  /** Distinguishes repeated rows across the FSRS/SM-2 sections. */
  label?: string;
  isFirst: boolean;
  onEdit: () => void;
  onRemove: () => void;
};

/**
 * LearningStepRow — a numbered step inside the learning-phase pane. Every step
 * is editable; the first one is protected from removal (a schedule needs at
 * least one step) and callers that allow "no steps" pass isFirst={false}.
 * Steps are separated by height, not by a rule under each one.
 */
export function LearningStepRow({
  index,
  step,
  label,
  isFirst,
  onEdit,
  onRemove,
}: LearningStepRowProps) {
  const target = label ?? `step ${index + 1}`;

  return (
    <View
      className="flex-row items-center px-4"
      style={{ minHeight: heights.rowCompact }}
    >
      <View
        className="mr-3 h-6 w-6 items-center justify-center rounded-full"
        style={{ backgroundColor: fills.inset }}
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
        accessibilityLabel={`Edit ${target}`}
      />
      {!isFirst && (
        <IconButton
          icon="close"
          size="sm"
          glyphSize={iconSize.sm}
          tone="danger"
          onPress={onRemove}
          accessibilityLabel={`Remove ${target}`}
          className="ml-1"
        />
      )}
    </View>
  );
}
