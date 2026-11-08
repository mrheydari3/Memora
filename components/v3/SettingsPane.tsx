import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { MaterialIcons } from '../Icon';
import { AppText } from '../AppText';
import { HeaderIcon } from './HeaderIcon';
import { Surface } from './Surface';
import { alpha, colors, iconSize } from '../../theme/tokens';
import { v3 } from '../../theme/v3';

type IconName = React.ComponentProps<typeof MaterialIcons>['name'];

const NUMERIC = { fontVariant: ['tabular-nums'] as const };

/**
 * The back bar of a settings sub-page: the bare 44px arrow, then the route's
 * name as the page's h1. 64px, like the tab pages' bar, so descending into a
 * setting does not change the height of the app's chrome.
 */
export function SettingsBackHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <View
      style={{
        height: 64,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 12,
        backgroundColor: colors.appBarGlass,
      }}
    >
      <HeaderIcon icon="arrow-back" label="Go back" onPress={onBack} />
      <AppText
        variant="headline"
        weight="semibold"
        headingLevel={1}
        numberOfLines={1}
        style={{ letterSpacing: -0.4, flex: 1 }}
      >
        {title}
      </AppText>
    </View>
  );
}

export type SettingsHeroStatus = {
  label: string;
  tone?: 'success' | 'accent' | 'muted';
};

export type SettingsHeroProps = {
  eyebrow: string;
  status: SettingsHeroStatus;
  title: string;
  description: string;
  ledger: { label: string; value: string }[];
  testID?: string;
};

/**
 * The settings hero — the raised card face the index and Game already use.
 *
 * An eyebrow and a live status pill sit above the page's subject, one sentence
 * explains it, and a three-cell inset ledger answers the three questions the
 * page exists for. Values may run to two lines: a 320px phone gives each cell
 * about 85px, and "20 new · 80 total" must not be clipped to "20 new · 80…".
 */
export function SettingsHero({
  eyebrow,
  status,
  title,
  description,
  ledger,
  testID,
}: SettingsHeroProps) {
  const statusTone = status.tone ?? 'success';
  const statusColour =
    statusTone === 'success'
      ? colors.success
      : statusTone === 'accent'
        ? colors.primary
        : colors.onSurfaceVariant;

  return (
    <Surface tone="scene" padding="md" testID={testID} style={{ gap: 16 }}>
      <View style={{ gap: 6 }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
          }}
        >
          <AppText
            variant="label"
            weight="semibold"
            tone="accent"
            className="uppercase"
            style={{ letterSpacing: 0.6 }}
          >
            {eyebrow}
          </AppText>

          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 5,
              paddingHorizontal: 8,
              paddingVertical: 2,
              borderRadius: 999,
              backgroundColor:
                statusTone === 'muted' ? colors.surfaceControl : alpha(statusColour, 0.12),
              borderWidth: 1,
              borderColor:
                statusTone === 'muted'
                  ? alpha(colors.outlineSoft, 0.4)
                  : alpha(statusColour, 0.25),
            }}
          >
            <View
              style={{
                width: 6,
                height: 6,
                borderRadius: 3,
                backgroundColor: statusColour,
              }}
            />
            <AppText variant="caption" tone={statusTone === 'muted' ? 'muted' : statusTone}>
              {status.label}
            </AppText>
          </View>
        </View>

        <AppText weight="bold" style={v3.type.headlineMd} numberOfLines={2}>
          {title}
        </AppText>
        <AppText variant="bodySm" tone="muted">
          {description}
        </AppText>
      </View>

      <View
        style={{
          flexDirection: 'row',
          backgroundColor: colors.surfaceInset,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: alpha(colors.outlineSoft, 0.2),
          paddingVertical: 12,
          paddingHorizontal: 12,
        }}
      >
        {ledger.map((cell, index) => (
          <View
            key={cell.label}
            style={{
              flex: 1,
              minWidth: 0,
              paddingStart: index === 0 ? 0 : 12,
              borderStartWidth: index === 0 ? 0 : 1,
              borderStartColor: colors.outlineVariant,
            }}
          >
            <AppText variant="caption" tone="tertiary" numberOfLines={1}>
              {cell.label}
            </AppText>
            <AppText
              variant="body"
              weight="semibold"
              numberOfLines={2}
              style={[NUMERIC, { marginTop: 2 }]}
            >
              {cell.value}
            </AppText>
          </View>
        ))}
      </View>
    </Surface>
  );
}

/** A chapter title and its pane; the pane's radius matches a deck card. */
export function SettingsChapter({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <View>
      <AppText
        variant="label"
        weight="semibold"
        tone="tertiary"
        headingLevel={2}
        className="uppercase"
        style={{ letterSpacing: 0.6, marginBottom: 10, paddingHorizontal: 4 }}
      >
        {label}
      </AppText>
      <View
        style={{
          backgroundColor: colors.surfacePane,
          borderRadius: 22,
          borderWidth: 1,
          borderColor: alpha(colors.outlineSoft, 0.2),
          overflow: 'hidden',
        }}
      >
        {children}
      </View>
    </View>
  );
}

type LineProps = {
  icon: IconName;
  /** The glyph's colour; the tile itself stays a quiet control fill. */
  tone?: string;
  title: string;
  subtitle?: string;
  /** A short right-aligned state, e.g. "On" or the scheduler's name. */
  value?: string;
  onPress?: () => void;
  trailing?: React.ReactNode;
  /** The last row in a pane draws no divider. */
  last?: boolean;
  /** Replaces the composed name when a flow queries an exact label. */
  accessibilityLabel?: string;
  /** Disclosure state for a row that opens a menu or a dialog. */
  ariaExpanded?: boolean;
  ariaHasPopup?: 'menu' | 'dialog';
};

/**
 * One settings line, v3: a 40px tile, a 15/600 title, a 13px subtitle and an
 * optional state. Rows that do something are buttons with a 64px minimum
 * target; switch rows stay inert containers so the switch owns the press.
 *
 * The divider starts at the title, not the card edge, so a pane reads as one
 * group instead of a stack of separate boxes.
 */
export function SettingsLine({
  icon,
  tone = colors.primary,
  title,
  subtitle,
  value,
  onPress,
  trailing,
  last = false,
  accessibilityLabel,
  ariaExpanded,
  ariaHasPopup,
}: LineProps) {
  const [hovered, setHovered] = useState(false);

  const content = (
    <>
      {/* Both glyphs are decoration: hidden from the tree, they cannot leak
          into the row's visible text and break its accessible name. */}
      <View
        aria-hidden
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{
          width: 40,
          height: 40,
          borderRadius: 12,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.surfaceControl,
          flexShrink: 0,
        }}
      >
        <MaterialIcons name={icon} size={iconSize.lg} color={tone} />
      </View>

      <View style={{ flex: 1, minWidth: 0 }}>
        <AppText variant="body" weight="semibold" numberOfLines={1}>
          {title}
        </AppText>
        {subtitle && (
          <AppText variant="bodySm" tone="muted" numberOfLines={2} style={{ marginTop: 2 }}>
            {subtitle}
          </AppText>
        )}
      </View>

      {value && (
        <AppText variant="caption" tone="tertiary" numberOfLines={1}>
          {value}
        </AppText>
      )}
      {trailing}
      {onPress && (
        <View
          aria-hidden
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <MaterialIcons name="chevron-right" size={iconSize.lg} color={colors.outline} />
        </View>
      )}
    </>
  );

  const baseStyle = {
    minHeight: 64,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 12,
  };

  return (
    <View>
      {onPress ? (
        <Pressable
          onPress={onPress}
          onHoverIn={() => setHovered(true)}
          onHoverOut={() => setHovered(false)}
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel}
          accessibilityState={ariaExpanded === undefined ? undefined : { expanded: ariaExpanded }}
          {...(ariaExpanded === undefined ? {} : { 'aria-expanded': ariaExpanded })}
          {...(ariaHasPopup ? { 'aria-haspopup': ariaHasPopup } : {})}
          style={[baseStyle, hovered ? { backgroundColor: alpha(colors.surfaceTile, 0.5) } : null]}
        >
          {content}
        </Pressable>
      ) : (
        <View style={baseStyle}>{content}</View>
      )}

      {!last && (
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={{ height: 1, backgroundColor: colors.outlineVariant, marginStart: 68 }}
        />
      )}
    </View>
  );
}

/** A quiet closing note: one glyph and a caption, never another card. */
export function SettingsFootnote({
  icon,
  children,
}: {
  icon: IconName;
  children: React.ReactNode;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 8,
        paddingHorizontal: 4,
      }}
    >
      <View style={{ paddingTop: 1 }}>
        <MaterialIcons name={icon} size={iconSize.sm} color={colors.outline} />
      </View>
      <AppText variant="caption" tone="tertiary" style={{ flexShrink: 1 }}>
        {children}
      </AppText>
    </View>
  );
}
