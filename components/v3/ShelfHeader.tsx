import { useWindowDimensions, View } from 'react-native';
import { MaterialIcons } from '../Icon';
import { AppText } from '../AppText';
import { HintPressable } from '../HintPressable';
import { alpha, colors, iconSize, radii } from '../../theme/tokens';
import { v3 } from '../../theme/v3';
import { NewFolderButton } from './NewFolderButton';

type ShelfHeaderProps = {
  /** The section's name; defaults to "Your decks". */
  title?: string;
  /** The quiet line under the title, e.g. "6 decks · 4 folders · 18 due". */
  meta: string;
  /** Right-aligned status, e.g. "1 caught up". */
  statusLabel?: string;
  onNewFolder: () => void;
  onToggleLayout: () => void;
  editingLayout: boolean;
};

/**
 * ShelfHeader — the library's masthead.
 *
 * The shelf used to open with the same 12px uppercase label as every other
 * section, which made the largest thing on the page — a whole library — read
 * like a footnote. The masthead now has three tiers: a quiet eyebrow that also
 * carries the shelf's actions, the section title at page scale, and the honest
 * caption with the caught-up mark. The rule below it is the only line the shelf
 * draws, so the cards beneath it are the page's content, not a boxed-in list.
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
  // The layout action keeps its label while the eyebrow has room for it; below
  // that it stays a 44px tile with its accessible name.
  const compact = width < 480;
  const actionFill = alpha(colors.surfaceControl, 0.6);

  return (
    <View>
      <View style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={{
            width: 14,
            height: 2,
            borderRadius: 1,
            backgroundColor: colors.primary,
          }}
        />
        <AppText
          variant="label"
          weight="semibold"
          tone="tertiary"
          className="uppercase"
          numberOfLines={1}
          style={{ letterSpacing: 1.1 }}
        >
          Library
        </AppText>
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={{ flex: 1, height: 1, backgroundColor: colors.hairlineRule }}
        />

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 0 }}>
          {editingLayout ? (
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
            <>
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
            </>
          )}
        </View>
      </View>

      <AppText
        headingLevel={2}
        weight="semibold"
        numberOfLines={2}
        style={[v3.type.shelfTitle, { marginTop: 6 }]}
      >
        {title}
      </AppText>

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          marginTop: 6,
          paddingBottom: 4,
        }}
      >
        <AppText
          variant="caption"
          tone="tertiary"
          numberOfLines={2}
          style={{ flexShrink: 1, minWidth: 0 }}
        >
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
    </View>
  );
}
