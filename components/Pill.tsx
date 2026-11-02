import { View } from 'react-native';
import { AppText } from './AppText';
import { alpha, colors } from '../theme/tokens';

type PillProps = {
  label: string;
  /** neutral = settings value, accent = Saved/Beta, warning = Archived. */
  tone?: 'neutral' | 'accent' | 'warning';
  className?: string;
};

/**
 * Pill — a small capsule for a value or a status. One component replaces the
 * four hand-rolled variants (settings value, Saved, Beta, Archived) so the
 * radius, padding and type step stay identical wherever a pill appears.
 */
export function Pill({ label, tone = 'neutral', className = '' }: PillProps) {
  if (tone === 'accent') {
    return (
      <View
        className={`rounded-full border border-accent-line bg-accent-soft px-2.5 py-0.5 ${className}`}
        style={{ borderColor: colors.accentLine, backgroundColor: colors.accentSoft }}
      >
        <AppText variant="caption" weight="bold" tone="accent" className="uppercase">
          {label}
        </AppText>
      </View>
    );
  }

  if (tone === 'warning') {
    return (
      <View
        className={`rounded-full border border-hairline px-2 py-0.5 ${className}`}
        style={{ backgroundColor: alpha(colors.warning, 0.08) }}
      >
        <AppText variant="caption" weight="semibold" tone="warning" className="uppercase">
          {label}
        </AppText>
      </View>
    );
  }

  return (
    <View className={`rounded-full border border-hairline px-3 py-1 ${className}`}>
      <AppText variant="bodySm" weight="semibold">
        {label}
      </AppText>
    </View>
  );
}
