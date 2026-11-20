import { View } from 'react-native';
import { MaterialIcons } from '../Icon';
import { AppText } from '../AppText';
import { HintPressable } from '../HintPressable';
import { useResponsive } from '../../hooks/useResponsive';
import { colors, iconSize, radii } from '../../theme/tokens';
import { v3 } from '../../theme/v3';

type ShelfHeaderProps = {
  /** The section's name; defaults to "Your decks". */
  title?: string;
  /** The quiet line under the title, e.g. "6 decks · 4 folders". */
  meta: string;
  /** Right-aligned status, e.g. "1 caught up". */
  statusLabel?: string;
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
 *
 * On a phone the eyebrow is gone and the redundant FOLDERS band is dropped. The
 * title and its layout action share one 44px row, the action is a bare muted
 * glyph rather than a filled pill, and the caption stays directly under the
 * title so the counts and the caught-up mark never leave the masthead. That
 * hands the vertical space to the folder or deck the page exists to show; the
 * title is the loudest thing in the row, which is the point.
 */
export function ShelfHeader({
  title = 'Your decks',
  meta,
  statusLabel,
  onToggleLayout,
  editingLayout,
}: ShelfHeaderProps) {
  const { mobile: compact } = useResponsive();
  // Phones lose the eyebrow row and its captions; the tablet masthead keeps the
  // full title and labelled action.
  const actionIcon = compact ? iconSize.lg : iconSize.sm;

  const actionStyle = {
    minHeight: 44,
    minWidth: 44,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 6,
    paddingHorizontal: compact ? 0 : 8,
    borderRadius: radii.control,
  };

  const actions = editingLayout ? (
    <HintPressable
      hint="Done editing layout"
      onPress={onToggleLayout}
      accessibilityRole="button"
      accessibilityLabel="Done editing layout"
      style={actionStyle}
    >
      <MaterialIcons name="check" size={actionIcon} color={colors.primary} />
      {compact ? null : (
        <AppText variant="caption" weight="semibold" tone="accent">
          Done
        </AppText>
      )}
    </HintPressable>
  ) : (
    <HintPressable
      hint="Edit layout"
      onPress={onToggleLayout}
      accessibilityRole="button"
      accessibilityLabel="Edit layout"
      accessibilityState={{ expanded: editingLayout }}
      style={actionStyle}
    >
      <MaterialIcons name="drag-indicator" size={actionIcon} color={colors.outline} />
      {/* The glyph alone read as an overflow menu on a wide canvas, so the
          tablet control names itself. On mobile the accessible name carries
          the meaning. */}
      {compact ? null : (
        <AppText variant="caption" weight="medium" tone="tertiary">
          Edit layout
        </AppText>
      )}
    </HintPressable>
  );

  const titleNode = (
    <AppText
      headingLevel={2}
      weight="semibold"
      numberOfLines={compact ? 1 : 2}
      style={[
        v3.type.shelfTitle,
        compact ? { flex: 1, minWidth: 0 } : { marginTop: 6 },
      ]}
    >
      {title}
    </AppText>
  );

  const caption = (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        marginTop: compact ? 2 : 6,
        paddingBottom: compact ? 0 : 4,
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
  );

  if (compact) {
    // The caption stays under the title even though the phone drops its first
    // band: the counts and the caught-up mark belong to the shelf, not to a
    // section label that only repeats them.
    return (
      <View>
        <View style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {titleNode}
          <View style={{ flexDirection: 'row', alignItems: 'center', flexShrink: 0 }}>
            {actions}
          </View>
        </View>
        {caption}
      </View>
    );
  }

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
          {actions}
        </View>
      </View>

      {titleNode}
      {caption}
    </View>
  );
}
