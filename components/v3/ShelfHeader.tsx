import { View } from 'react-native';
import { MaterialIcons } from '../Icon';
import { AppText } from '../AppText';
import { HintPressable } from '../HintPressable';
import { alpha, colors, iconSize, radii } from '../../theme/tokens';

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
 * ShelfHeader — the mockup's section header:
 *
 *   title row pb-2, label 12/600 uppercase tracking-wider outline + a
 *   surface-control count chip; the way in is a 12/600 accent "Folders" chip
 *   on a 40% surface-control fill; the meta line pb-3 carries counts in tabular
 *   figures and, when it applies, "1 caught up" in the review green; the rule
 *   under it is the token at 20% and the shelf starts 16px below that.
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
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          paddingBottom: 8,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 }}>
          <AppText
            variant="label"
            weight="semibold"
            tone="tertiary"
            headingLevel={2}
            className="uppercase"
            numberOfLines={1}
            style={{ flexShrink: 1, letterSpacing: 0.6 }}
          >
            {title}
          </AppText>
          <View
            style={{
              paddingHorizontal: 8,
              paddingVertical: 2,
              borderRadius: radii.pill,
              backgroundColor: colors.surfaceControl,
            }}
          >
            <AppText variant="caption" weight="medium" tone="muted">
              {countLabel}
            </AppText>
          </View>
        </View>

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
      </View>

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
