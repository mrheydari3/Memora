import { Animated, View } from 'react-native';
import { ListRow } from './ListRow';
import { GlassCard } from './GlassCard';
import { SectionHeader } from './SectionHeader';
import { staggerDelay, useReveal } from '../motion';

type IconName = React.ComponentProps<typeof import('@expo/vector-icons').MaterialIcons>['name'];

type SettingsRowProps = {
  icon: IconName;
  title: string;
  subtitle?: string;
  /** Quiet right-aligned value, followed by the chevron on pressable rows. */
  value?: string;
  onPress?: () => void;
  isLast?: boolean;
  destructive?: boolean;
  /** Custom trailing element (switch, value pill) replaces the chevron. */
  trailing?: React.ReactNode;
  disabled?: boolean;
  /** Explicit glyph colour, for status rows (installed, stored locally). */
  iconColor?: string;
};

/**
 * SettingsRow — a row in a settings group. A thin wrapper over `ListRow` at the
 * settings density: 38px icon tile, 15px title, 13px subtitle.
 *
 * Values align with the title line (`valueAlign="title"`), so a two-line
 * subtitle keeps the full row width and the value never crowds it.
 */
export function SettingsRow({
  icon,
  title,
  subtitle,
  value,
  onPress,
  isLast = false,
  destructive = false,
  trailing,
  disabled = false,
  iconColor,
}: SettingsRowProps) {
  return (
    <ListRow
      icon={icon}
      title={title}
      subtitle={subtitle}
      value={value}
      valueAlign="title"
      tile="sm"
      density="default"
      titleWeight="medium"
      iconTone={destructive ? 'destructive' : 'neutral'}
      iconColor={iconColor}
      trailing={trailing}
      divider={!isLast}
      onPress={onPress}
      disabled={disabled}
      destructive={destructive}
    />
  );
}

/**
 * SettingsCard — a glass group that holds SettingsRow children. Full-bleed rows,
 * no inner padding, so dividers run edge to edge.
 */
export function SettingsCard({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <GlassCard padding="none" className={className}>
      {children}
    </GlassCard>
  );
}

type SettingsSectionProps = {
  label: string;
  /** Small right-aligned hint, e.g. a count or the active value. */
  hint?: string;
  action?: {
    label: string;
    onPress: () => void;
    icon?: IconName;
  };
  /** Skip the 28px top gap when this is the first block on a screen. */
  first?: boolean;
  /** Position of the chapter, so a settings page reveals its groups in order. */
  index?: number;
  className?: string;
  children: React.ReactNode;
};

/**
 * SettingsSection — one settings chapter: an uppercase section label with a
 * hairline rule and its glass group, with the section rhythm baked in. Every
 * settings screen uses it so the gap above a chapter, the gap above its card
 * and the card material are never re-declared per screen.
 */
export function SettingsSection({
  label,
  hint,
  action,
  first = false,
  index = 0,
  className = '',
  children,
}: SettingsSectionProps) {
  const reveal = useReveal(`section:${index}`, {
    delay: staggerDelay(index, 50) + 40,
    distance: 10,
  });

  return (
    // NativeWind does not forward className to an Animated component, so the
    // chapter's spacing stays on a plain wrapper and only the reveal is animated.
    <View className={first ? className : `mt-7 ${className}`}>
      <Animated.View style={reveal.style}>
        <SectionHeader label={label} hint={hint} action={action} rule />
        <SettingsCard className="mt-3">{children}</SettingsCard>
      </Animated.View>
    </View>
  );
}
