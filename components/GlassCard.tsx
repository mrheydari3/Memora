import { View } from 'react-native';
import type { ViewStyle } from 'react-native';
import { fills, glassFill, paneAccent, shadow } from '../theme/tokens';

type GlassCardProps = {
  children: React.ReactNode;
  className?: string;
  /** none = full-bleed rows, sm = 16, md = 20 (default). */
  padding?: 'none' | 'sm' | 'md';
  /** glass (default), accent (the one blue hero pane), inset (nested content). */
  tone?: 'glass' | 'accent' | 'inset';
  radius?: 'pane' | 'sheet';
  style?: ViewStyle | ViewStyle[];
};

const PADDING = { none: '', sm: 'p-4', md: 'p-5' } as const;
const RADIUS = { pane: 'rounded-xl', sheet: 'rounded-2xl' } as const;

/**
 * GlassCard — the single card material in the system: smoked frosted fill,
 * 24px radius, 20px inner padding.
 *
 * There is no outline or top rule: a pane is separated from the canvas by its
 * fill and its shadow, and the elements inside it are separated from the pane by
 * their own (slightly lighter) fills. Every pane in the app is this component:
 * settings groups, deck cards, selectable options, list groups and hero panes. A
 * pane never re-declares its own fill or shadow.
 */
export function GlassCard({
  children,
  className = '',
  padding = 'md',
  tone = 'glass',
  radius = 'pane',
  style,
}: GlassCardProps) {
  return (
    <View
      className={`overflow-hidden ${PADDING[padding]} ${RADIUS[radius]} ${className}`}
      style={[
        glassFill,
        tone === 'accent' && { backgroundColor: paneAccent },
        tone === 'inset' && { backgroundColor: fills.inset },
        { boxShadow: shadow.pane },
        style as ViewStyle,
      ]}
    >
      {children}
    </View>
  );
}
