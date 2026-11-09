import { useWindowDimensions, View } from 'react-native';
import { MaterialIcons } from '../Icon';
import { AppText } from '../AppText';
import { HintPressable } from '../HintPressable';
import { alpha, colors, iconSize, radii } from '../../theme/tokens';
import { SectionHeading } from './SectionHeading';
import { NewFolderButton } from './NewFolderButton';

type ShelfHeaderProps = {
  /** The section's name; defaults to "Your decks". */
  title?: string;
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
 * The label and folder actions come from `SectionHeading`; the shelf adds the
 * meta line and closes with the same 20% rule. The folder action is one plus
 * icon at every width — the meta line carries the totals — and the layout
 * action keeps its label while there is room for it.
 */
export function ShelfHeader({
  title = 'Your decks',
  meta,
  statusLabel,
  onNewFolder,
  onToggleLayout,
  editingLayout,
}: ShelfHeaderProps) {
  const { width } = useWindowDimensions();
  const compact = width < 480;
  const actionFill = alpha(colors.surfaceControl, 0.6);

  return (
    <View>
      <SectionHeading
        label={title}
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
                borderRadius: radii.control,
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
              <NewFolderButton onPress={onNewFolder} />

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
                  borderRadius: radii.control,
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
