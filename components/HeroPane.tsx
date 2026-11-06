import { View } from 'react-native';
import type { ViewStyle } from 'react-native';
import { AppText } from './AppText';
import { GlassCard } from './GlassCard';
import { alpha, colors, glassFill, rims } from '../theme/tokens';
import { v2 } from '../theme/v2';

type HeroPaneProps = {
  /** The silkscreen label above the figure, e.g. "Today · Thu 5 Nov". */
  eyebrow: string;
  /** The page's one display-sized figure. */
  value: number | string;
  /** The unit printed beside the figure, on the baseline. */
  unit: string;
  /** What the figure counts, for assistive tech ("20 cards due today"). */
  valueLabel?: string;
  /** One quiet line under the figure. */
  context?: string;
  /** `body` on the stage panes (Home, Deck); `bodySm` where the pane is shorter. */
  contextVariant?: 'body' | 'bodySm';
  /** Quiet element that leads the eyebrow row: an avatar, a glyph. */
  leading?: React.ReactNode;
  /** Quiet element that closes the eyebrow row: a status, a streak. */
  trailing?: React.ReactNode;
  /** The eyebrow is the page's h1 only on Home. */
  headingLevel?: 1 | 2;
  /** The one action, directly under the figure. */
  action?: React.ReactNode;
  /** A quiet line between the action and the rail ("Next up · …"). */
  note?: React.ReactNode;
  /** The rail: TodayRail, an XP bar, a chart. */
  rail?: React.ReactNode;
  /** Cap the action's width so it does not stretch across a wide pane. */
  actionMaxWidth?: number;
  /** GlassCard tone, ignored by the stage variant (which paints its own fill). */
  tone?: 'accent' | 'glass';
  /**
   * The stage panes — Home's today panel and the deck queue band — are the one
   * pane with a lit rim and an accent wash. Everything else is a plain
   * `GlassCard`, so the hero content stays identical and only the material of
   * the pane changes.
   */
  stage?: boolean;
  /** Stage only: put the action and the rail in a 300px column beside the figure. */
  wide?: boolean;
  testID?: string;
  bodyTestID?: string;
  className?: string;
  style?: ViewStyle;
};

/**
 * HeroPane — the anatomy every page's hero shares.
 *
 * One eyebrow row (optional leading and trailing), then the page's only
 * display-sized figure with its unit on the baseline, then one line of context.
 * The action, the quiet note and the rail follow in that order, so a hero reads
 * the same on Home, a deck, Statistics and Profile and no screen re-declares the
 * 56px step, the 12px column gap or the baseline padding.
 *
 * `stage` is the deck/home material: the ink fill with a lit top rim, a hairline
 * bottom edge and a 6% accent wash. Without it the pane is the ordinary
 * `GlassCard`, which is what the two settings-adjacent heroes use.
 */
export function HeroPane({
  eyebrow,
  value,
  unit,
  valueLabel,
  context,
  contextVariant = 'body',
  leading,
  trailing,
  headingLevel = 2,
  action,
  note,
  rail,
  actionMaxWidth,
  tone = 'accent',
  stage = false,
  wide = false,
  testID,
  bodyTestID,
  className = '',
  style,
}: HeroPaneProps) {
  const figure = (
    <>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 }}>
          {leading}
          <AppText
            variant="caption"
            weight="semibold"
            tone="accent"
            className="uppercase"
            headingLevel={headingLevel}
            numberOfLines={2}
            style={{ flexShrink: 1 }}
          >
            {eyebrow}
          </AppText>
        </View>
        {trailing}
      </View>

      <View
        className="flex-row flex-wrap items-end"
        style={{ columnGap: 12, rowGap: 2, marginTop: 2 }}
      >
        <AppText variant="display" style={v2.type.display} accessibilityLabel={valueLabel}>
          {value}
        </AppText>
        <AppText variant="bodyLg" tone="muted" style={{ paddingBottom: 9 }}>
          {unit}
        </AppText>
      </View>

      {context && (
        <AppText variant={contextVariant} tone="muted" className="mt-1">
          {context}
        </AppText>
      )}
    </>
  );

  const controls = action || note || rail ? (
    <View style={wide ? { width: 300, flexShrink: 0 } : undefined}>
      {action && (
        <View style={{ marginTop: wide ? 0 : 20, maxWidth: actionMaxWidth }}>
          {action}
        </View>
      )}
      {note && <View style={{ marginTop: 12 }}>{note}</View>}
      {rail && <View style={{ marginTop: note ? 16 : 20 }}>{rail}</View>}
    </View>
  ) : null;

  const body = (
    <View
      style={
        wide ? { flexDirection: 'row', alignItems: 'center', columnGap: 32 } : undefined
      }
    >
      <View style={wide ? { flex: 1, minWidth: 0 } : undefined}>{figure}</View>
      {controls}
    </View>
  );

  if (stage) {
    return (
      <View
        testID={testID}
        style={[
          glassFill,
          {
            borderRadius: v2.radii.pane,
            borderTopWidth: 1,
            borderTopColor: rims.soft,
            borderBottomWidth: 1,
            borderBottomColor: colors.outlineVariant,
            overflow: 'hidden',
          },
          style,
        ]}
      >
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: alpha(colors.primary, 0.06),
          }}
        />
        <View testID={bodyTestID} style={{ padding: v2.spacing.panel }}>
          {body}
        </View>
      </View>
    );
  }

  return (
    <GlassCard tone={tone} className={className} style={style}>
      {body}
    </GlassCard>
  );
}
