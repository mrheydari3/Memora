import { useWindowDimensions, View } from 'react-native';
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
  onNewFolder: () => void;
  onToggleLayout: () => void;
  editingLayout: boolean;
};

/**
 * ShelfHeader — the Home shelf's specialized section header.
 *
 * The label, count chip and folder actions come from `SectionHeading`; the
 * shelf adds the meta line and closes with the same 20% rule. On a narrow
 * canvas the layout action is icon-only so the "New folder" affordance keeps
 * its readable label; below 360px the count chip steps aside (the meta line
 * carries the same totals) so the section title never truncates.
 */
export function ShelfHeader({
  title = 'Your decks',
  countLabel,
  meta,
  statusLabel,
  onNewFolder,
  onToggleLayout,
  editingLayout,
}: ShelfHeaderProps) {
  const { width } = useWindowDimensions();
  const compact = width < 480;
  const narrow = width < 360;
  const actionFill = alpha(colors.surfaceControl, 0.4);

  return (
    <View>
      <SectionHeading
        label={title}
        count={narrow ? undefined : countLabel}
        rule={false}
        className="mb-2"
        action={
          editingLayout ? (
            <HintPressable
              hint="Done editing layout"
              onPress={onToggleLayout}
              accessibilityRole="button"
              accessibilityLabel="Done editing layout"
              style={{
                minHeight: 44,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                paddingHorizontal: 10,
                borderRadius: 8,
                backgroundColor: alpha(colors.primary, 0.14),
              }}
            >
              <MaterialIcons name="check" size={iconSize.sm} color={colors.primary} />
              <AppText variant="caption" weight="semibold" tone="accent">
                Done
              </AppText>
            </HintPressable>
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <HintPressable
                hint="New folder"
                onPress={onNewFolder}
                accessibilityRole="button"
                accessibilityLabel="New folder"
                style={{
                  minHeight: 44,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  paddingHorizontal: 8,
                  borderRadius: 8,
                  backgroundColor: actionFill,
                }}
              >
                <MaterialIcons
                  name="create-new-folder"
                  size={iconSize.sm}
                  color={colors.primary}
                />
                <AppText variant="caption" weight="semibold" tone="accent">
                  New folder
                </AppText>
              </HintPressable>

              <HintPressable
                hint="Edit layout"
                onPress={onToggleLayout}
                accessibilityRole="button"
                accessibilityLabel="Edit layout"
                accessibilityState={{ expanded: editingLayout }}
                style={{
                  minHeight: 44,
                  width: compact ? 44 : undefined,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  paddingHorizontal: compact ? 0 : 8,
                  borderRadius: 8,
                  backgroundColor: actionFill,
                }}
              >
                <MaterialIcons name="drag-indicator" size={iconSize.sm} color={colors.outline} />
                {!compact && (
                  <AppText variant="caption" weight="semibold" tone="muted">
                    Edit layout
                  </AppText>
                )}
              </HintPressable>
            </View>
          )
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
