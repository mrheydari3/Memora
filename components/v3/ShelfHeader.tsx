import { View } from 'react-native';
import { MaterialIcons } from '../Icon';
import { AppText } from '../AppText';
import { HintPressable } from '../HintPressable';
import { alpha, colors, iconSize } from '../../theme/tokens';
import { SectionHeading } from './SectionHeading';

type ShelfHeaderProps = {
  /** The section's name; defaults to "Your decks". */
  title?: string;
  /** The count chip beside the title, e.g. "6 decks". */
  countLabel: string;
  /** The quiet line under the title, e.g. "6 decks · 18 due". */
  meta: string;
  /** Right-aligned status, e.g. "1 caught up". */
  statusLabel?: string;
  onManageFolders: () => void;
};

/**
 * ShelfHeader — the Home shelf's specialized section header.
 *
 * The label, count chip and Folders action come from `SectionHeading`; the
 * shelf adds the meta line and closes with the same 20% rule.
 */
export function ShelfHeader({
  title = 'Your decks',
  countLabel,
  meta,
  statusLabel,
  onManageFolders,
}: ShelfHeaderProps) {
  return (
    <View>
      <SectionHeading
        label={title}
        count={countLabel}
        rule={false}
        className="mb-2"
        action={
          <HintPressable
            hint="Manage folders"
            onPress={onManageFolders}
            accessibilityRole="button"
            accessibilityLabel="Manage folders"
            style={{
              minHeight: 44,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              paddingHorizontal: 10,
              borderRadius: 8,
              backgroundColor: alpha(colors.surfaceControl, 0.4),
            }}
          >
            <MaterialIcons name="folder-open" size={iconSize.sm} color={colors.primary} />
            <AppText variant="caption" weight="semibold" tone="accent">
              Folders
            </AppText>
          </HintPressable>
        }
      />

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          paddingBottom: 12,
        }}
      >
        <AppText variant="caption" tone="tertiary" numberOfLines={1} style={{ flexShrink: 1 }}>
          {meta}
        </AppText>
        {statusLabel && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, flexShrink: 0 }}>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.success }} />
            <AppText variant="caption" tone="success" weight="medium">
              {statusLabel}
            </AppText>
          </View>
        )}
      </View>

      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{
          height: 1,
          backgroundColor: colors.hairlineRule,
          marginBottom: 16,
        }}
      />
    </View>
  );
}
