import { View } from 'react-native';
import { AnimatedIcon } from './AnimatedIcon';
import { AppText } from './AppText';
import { GlassCard } from './GlassCard';
import { alpha, colors, fills, heights, iconSize, radii } from '../theme/tokens';

export type LedgerEntry = {
  label: string;
  value: string;
  /** The one figure the screen is about. Painted with the accent. */
  accent?: boolean;
};

type PlateStatus = {
  label: string;
  tone?: 'success' | 'warning' | 'muted';
};

type SettingsPlateProps = {
  /** Silkscreen label above the subject, e.g. the current scheduler. */
  eyebrow: string;
  /** What the plate is about: the library, a deck, a voice pair. */
  title: string;
  description?: string;
  /** Quiet state on the right of the eyebrow, e.g. "On this device". */
  status?: PlateStatus;
  /** Aligned key/value readouts. Every settings screen opens with them. */
  ledger?: LedgerEntry[];
  /** accent is reserved for the settings index; every other screen uses glass. */
  tone?: 'accent' | 'glass';
  icon?: React.ComponentProps<typeof import('@expo/vector-icons').MaterialIcons>['name'];
  className?: string;
};

const STATUS_COLOR = {
  success: colors.success,
  warning: colors.warning,
  muted: colors.outlineSoft,
} as const;

/**
 * SettingsPlate — the instrument panel every settings screen opens with.
 *
 * One eyebrow, one subject, and a ledger of the numbers that describe it.
 * Readouts are right-aligned in tabular figures, so the values line up like an
 * engraved gauge instead of floating in three stat columns. The ledger is held
 * together by row height alone — no rules.
 * A screen has at most one plate, and only the settings index uses the accent
 * tone.
 */
export function SettingsPlate({
  eyebrow,
  title,
  description,
  status,
  ledger = [],
  tone = 'glass',
  icon,
  className = '',
}: SettingsPlateProps) {
  return (
    <GlassCard tone={tone} className={className}>
      <View className="flex-row items-center justify-between">
        <View className="flex-1 flex-row items-center gap-2">
          {icon && (
            <View
              className="items-center justify-center"
              style={{
                width: heights.tile,
                height: heights.tile,
                borderRadius: radii.micro,
                backgroundColor:
                  tone === 'accent' ? alpha(colors.primary, 0.16) : fills.tile,
              }}
            >
              <AnimatedIcon
                name={icon}
                size={iconSize.lg}
                color={tone === 'accent' ? colors.primary : colors.outline}
              />
            </View>
          )}
          <AppText
            variant="label"
            tone={tone === 'accent' ? 'accent' : 'muted'}
            className="uppercase"
            numberOfLines={1}
          >
            {eyebrow}
          </AppText>
        </View>

        {status && (
          <View className="ml-3 flex-row items-center gap-1.5">
            <View
              className="h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: STATUS_COLOR[status.tone ?? 'muted'] }}
            />
            <AppText variant="caption" weight="medium" tone="muted" numberOfLines={1}>
              {status.label}
            </AppText>
          </View>
        )}
      </View>

      <AppText variant="headline" className="mt-3" numberOfLines={1}>
        {title}
      </AppText>

      {description && (
        <AppText variant="bodySm" tone="muted" className="mt-1">
          {description}
        </AppText>
      )}

      {ledger.length > 0 && (
        <View className="mt-4">
          {ledger.map((entry) => (
            <View
              key={entry.label}
              className="flex-row items-baseline justify-between py-2.5"
            >
              <AppText
                variant="bodySm"
                tone="muted"
                className="flex-1"
                style={{ minWidth: 84 }}
                numberOfLines={1}
              >
                {entry.label}
              </AppText>
              <AppText
                variant="bodySm"
                weight="semibold"
                tone={entry.accent ? 'accent' : 'default'}
                className="ml-3"
                style={{ flexShrink: 1, maxWidth: '62%', fontVariant: ['tabular-nums'] }}
                numberOfLines={1}
              >
                {entry.value}
              </AppText>
            </View>
          ))}
        </View>
      )}
    </GlassCard>
  );
}
