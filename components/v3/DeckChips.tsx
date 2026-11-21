import { View } from 'react-native';
import { AppText } from '../AppText';
import { Chip } from '../Chip';
import { alpha, colors, radii } from '../../theme/tokens';

/** The deck hero's live status chip: due, caught up, or filed away. */
export function StatusChip({
  label,
  tone,
}: {
  label: string;
  tone: 'accent' | 'success' | 'muted';
}) {
  const ink =
    tone === 'accent' ? colors.primary : tone === 'success' ? colors.success : colors.outline;
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: radii.pill,
        backgroundColor: tone === 'muted' ? colors.surfaceControl : alpha(ink, 0.12),
        flexShrink: 0,
      }}
    >
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: ink }} />
      <AppText variant="caption" tone={tone === 'muted' ? 'muted' : tone}>
        {label}
      </AppText>
    </View>
  );
}

/** One deck filter choice: selection is the tint behind the label, never an outline. */
export function FilterPill({
  label,
  active,
  dot,
  accessibilityLabel,
  onPress,
}: {
  label: string;
  active: boolean;
  dot?: string;
  accessibilityLabel: string;
  onPress: () => void;
}) {
  return (
    <Chip
      label={label}
      dot={dot}
      active={active}
      onPress={onPress}
      accessibilityLabel={accessibilityLabel}
      variant="select"
    />
  );
}
