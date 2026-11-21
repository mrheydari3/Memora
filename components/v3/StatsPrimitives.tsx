import type { ReactNode } from 'react';
import { View } from 'react-native';
import type { ViewStyle } from 'react-native';
import { AppText } from '../AppText';
import { alpha, colors, radii } from '../../theme/tokens';
import { v3 } from '../../theme/v3';
import { SectionHeading } from './SectionHeading';
import { Surface } from './Surface';

export type StatsSectionProps = {
  title: string;
  count?: string;
  hint?: string;
  children: ReactNode;
  style?: ViewStyle | ViewStyle[];
};

/** A titled statistics chapter: heading plus its measured content. */
export function StatsSection({ title, count, hint, children, style }: StatsSectionProps) {
  return (
    <View style={[{ marginTop: v3.spacing.page }, style]}>
      <SectionHeading label={title} count={count} hint={hint} />
      <View style={{ marginTop: 10 }}>{children}</View>
    </View>
  );
}

/** A small status pill for a report claim. */
export function TinyPill({ label, accent = false }: { label: string; accent?: boolean }) {
  return (
    <View
      style={{
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: radii.pill,
        backgroundColor: accent ? alpha(colors.primary, 0.13) : colors.surfaceControl,
      }}
    >
      <AppText
        variant="caption"
        weight="medium"
        tone={accent ? 'accent' : 'muted'}
        style={{ letterSpacing: 0.2 }}
      >
        {label}
      </AppText>
    </View>
  );
}

export type StatsCardProps = {
  children: ReactNode;
  style?: ViewStyle;
  tone?: 'pane' | 'inset';
  padding?: 'none' | 'sm' | 'md';
};

/** One statistics pane on the shared surface grammar. */
export function StatsCard({ children, style, tone = 'pane', padding = 'md' }: StatsCardProps) {
  return (
    <Surface tone={tone} radius="card" padding={padding} style={style}>
      {children}
    </Surface>
  );
}
