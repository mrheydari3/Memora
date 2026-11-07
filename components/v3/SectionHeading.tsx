import { View } from 'react-native';
import { AppText } from '../AppText';
import { colors, radii } from '../../theme/tokens';

type SectionHeadingProps = {
  label: string;
  /** A count chip beside the label, e.g. "6 decks". */
  count?: string;
  /** A quiet right-aligned note, e.g. "fixed windows". */
  hint?: string;
  action?: React.ReactNode;
  /** The 20% hairline under the row. Off inside a pane or a sheet. */
  rule?: boolean;
  /** Layout only, e.g. the section's top margin. */
  className?: string;
};

/**
 * SectionHeading — the one section marker.
 *
 * Uppercase 12/600 label, an optional surface-control count chip, and a
 * right-hand hint or action. Outside a pane it closes with the 20% hairline
 * rule; inside one, pass `rule={false}` so the fill does the separating.
 */
export function SectionHeading({
  label,
  count,
  hint,
  action,
  rule = true,
  className = '',
}: SectionHeadingProps) {
  return (
    <View className={className}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          paddingBottom: rule ? 10 : 0,
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            flexShrink: 1,
            minWidth: 0,
          }}
        >
          <AppText
            variant="label"
            weight="semibold"
            tone="tertiary"
            headingLevel={2}
            className="uppercase"
            numberOfLines={1}
            style={{ letterSpacing: 0.6, flexShrink: 1 }}
          >
            {label}
          </AppText>
          {count ? (
            <View
              style={{
                paddingHorizontal: 8,
                paddingVertical: 2,
                borderRadius: radii.pill,
                backgroundColor: colors.surfaceControl,
                flexShrink: 0,
              }}
            >
              <AppText variant="caption" weight="medium" tone="muted">
                {count}
              </AppText>
            </View>
          ) : null}
        </View>

        {hint ? (
          <AppText
            variant="caption"
            tone="tertiary"
            numberOfLines={1}
            style={{ marginStart: 'auto', flexShrink: 0 }}
          >
            {hint}
          </AppText>
        ) : null}

        {action ? (
          <View style={{ marginStart: hint ? 0 : 'auto', flexShrink: 0 }}>{action}</View>
        ) : null}
      </View>

      {rule ? (
        <View
          aria-hidden
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={{ height: 1, backgroundColor: colors.hairlineRule }}
        />
      ) : null}
    </View>
  );
}
