import { View } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { colors, radii } from '../../theme/tokens';

type HeroAuraProps = {
  /**
   * Unique SVG gradient id. Tab screens can stay mounted together, so Today
   * and Game must not share one gradient definition.
   */
  id: string;
};

/**
 * HeroAura — the quiet light field behind a frosted scene hero.
 *
 * A backdrop blur needs something to refract. The app canvas is intentionally
 * flat, so the glass would only read as a darker rectangle; this blue bloom
 * gives the five-percent tint something to hold. It is clipped to the hero's
 * shape, sits behind it, and never enters the accessibility or pointer path.
 */
export function HeroAura({ id }: HeroAuraProps) {
  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
        borderRadius: radii.pane,
        overflow: 'hidden',
      }}
    >
      <Svg
        width="100%"
        height="100%"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
      >
        <Defs>
          <RadialGradient id={id} cx="72%" cy="30%" r="78%">
            <Stop offset="0%" stopColor={colors.primaryContainer} stopOpacity={0.26} />
            <Stop offset="45%" stopColor={colors.primary} stopOpacity={0.14} />
            <Stop offset="78%" stopColor={colors.primary} stopOpacity={0.035} />
            <Stop offset="100%" stopColor={colors.primary} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100" height="100" fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}
