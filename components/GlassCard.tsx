import { View } from 'react-native';
import type { ViewStyle } from 'react-native';
import { fills, glassFill, paneAccent, rimColor, shadow } from '../theme/tokens';

type GlassCardProps = {
  children: React.ReactNode;
  className?: string;
  /** none = full-bleed rows, sm = 16, md = 20 (default). */
  padding?: 'none' | 'sm' | 'md';
  /** glass (default), accent (the one blue hero pane), inset (nested content). */
  tone?: 'glass' | 'accent' | 'inset';
  /** The lit 1px top rim. Off for nested panes. */
  rim?: boolean;
  radius?: 'pane' | 'sheet';
  style?: ViewStyle | ViewStyle[];
};

const PADDING = { none: '', sm: 'p-4', md: 'p-5' } as const;
const RADIUS = { pane: 'rounded-xl', sheet: 'rounded-2xl' } as const;

/**
 * GlassCard — the single card material in the system: smoked frosted fill,
 * hairline border, 24px radius, lit top rim, 20px inner padding.
 *
 * Every pane in the app is this component: settings groups, deck cards,
 * selectable options, list groups and hero panes. A pane never re-declares its
 * own fill, border or shadow.
 */
export function GlassCard({
  children,
  className = '',
  padding = 'md',
  tone = 'glass',
  rim = true,
  radius = 'pane',
  style,
}: GlassCardProps) {
  return (
    <View
      className={`overflow-hidden border ${
        tone === 'accent' ? 'border-accent-line' : 'border-hairline'
      } ${PADDING[padding]} ${RADIUS[radius]} ${className}`}
      style={[
        glassFill,
        tone === 'accent' && { backgroundColor: paneAccent },
        tone === 'inset' && { backgroundColor: fills.inset },
        { boxShadow: shadow.pane },
        style as ViewStyle,
      ]}
    >
      {rim && (
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: 16,
            right: 16,
            height: 1,
            backgroundColor: rimColor,
            pointerEvents: 'none',
          }}
        />
      )}
      {children}
    </View>
  );
}
