import { useId } from 'react';
import { View } from 'react-native';
import Svg, {
  Defs,
  Ellipse,
  LinearGradient,
  Path,
  Stop,
} from 'react-native-svg';
import { MaterialIcons } from '../Icon';
import { colors } from '../../theme/tokens';

type IconName = React.ComponentProps<typeof MaterialIcons>['name'];

type FolderGlyphProps = {
  /** The folder's chosen glyph; the neutral folder until one is chosen. */
  icon?: string;
  color?: string;
  /** Overall illustration footprint. */
  size?: number;
};

/**
 * FolderGlyph — a real-looking folder image, not a rounded tile.
 *
 * The illustration keeps the folder silhouette: back flap, tab and gradient
 * front panel. The chosen glyph sits directly on the panel with no chip behind
 * it, so the folder stays recognisable and the icon stays legible at 32–48px.
 * There is deliberately no paper lip above the cover and no highlight line
 * along its top edge: at these sizes both read as a stray line over the
 * artwork rather than as depth.
 *
 * The compact drawing (32px, the Edit layout row) drops the side shade and the
 * inner seams, which are sub-pixel noise at that size, and gives the glyph a
 * larger share of the panel.
 */
export function FolderGlyph({ icon, color, size = 44 }: FolderGlyphProps) {
  const tint = color ?? colors.primary;
  const compact = size <= 32;
  const gradientKey = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const backId = `folder-back-${gradientKey}`;
  const frontId = `folder-front-${gradientKey}`;
  const iconSize = Math.max(
    compact ? 13 : 12,
    Math.round(size * (compact ? 0.43 : 0.4))
  );
  // Center the glyph on the front panel, between its top edge (24.7) and its
  // bottom edge (54.3), so the folder tab never competes with it.
  const iconTop = Math.round(size * (39.5 / 64) - iconSize / 2);

  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width: size, height: size, flexShrink: 0 }}
    >
      <Svg width={size} height={size} viewBox="0 0 64 64">
        <Defs>
          <LinearGradient
            id={backId}
            x1="14"
            y1="12"
            x2="46"
            y2="56"
            gradientUnits="userSpaceOnUse"
          >
            <Stop offset="0" stopColor={tint} stopOpacity={0.66} />
            <Stop offset="0.55" stopColor={tint} stopOpacity={0.38} />
            <Stop offset="1" stopColor={tint} stopOpacity={0.24} />
          </LinearGradient>
          <LinearGradient
            id={frontId}
            x1="18"
            y1="24"
            x2="46"
            y2="56"
            gradientUnits="userSpaceOnUse"
          >
            <Stop offset="0" stopColor={tint} stopOpacity={0.74} />
            <Stop offset="0.5" stopColor={tint} stopOpacity={0.46} />
            <Stop offset="1" stopColor={tint} stopOpacity={0.3} />
          </LinearGradient>
        </Defs>

        <Ellipse
          cx="32"
          cy="58.5"
          rx="24"
          ry="3.4"
          fill={colors.background}
          fillOpacity={0.55}
        />

        {/* The back flap carries the tab; the front panel overlaps it. */}
        <Path
          d="M5.5 18C5.5 15 7.9 12.6 10.9 12.6H24.7C26.2 12.6 27.7 13.2 28.7 14.3L33.2 19.5H53.1C56.1 19.5 58.5 21.9 58.5 24.9V49.3C58.5 52.5 55.9 55.1 52.7 55.1H11.3C8.1 55.1 5.5 52.5 5.5 49.3Z"
          fill={`url(#${backId})`}
          stroke={tint}
          strokeOpacity={0.5}
          strokeWidth={0.8}
        />
        <Path
          d="M10.8 13.4H24.4C25.8 13.4 27 13.9 27.9 14.9L30.7 18.2H10.8C9 18.2 7.6 16.8 7.6 15.1C7.6 14.4 7.8 13.9 8.2 13.4Z"
          fill={tint}
          fillOpacity={0.18}
        />

        <Path
          d="M5.7 30.8C5.7 27.4 8.5 24.7 11.9 24.7H52.1C55.5 24.7 58.3 27.4 58.3 30.8V48.2C58.3 51.6 55.5 54.3 52.1 54.3H11.9C8.5 54.3 5.7 51.6 5.7 48.2Z"
          fill={`url(#${frontId})`}
          stroke={tint}
          strokeOpacity={compact ? 0.7 : 0.62}
          strokeWidth={compact ? 1 : 0.9}
        />
        {!compact && (
          <Path
            d="M6.2 31.6C6.5 28.2 9 25.5 12.4 25.2V53.7H12C8.7 53.7 6 51 6 47.7V30.8Z"
            fill={colors.background}
            fillOpacity={0.16}
          />
        )}
      </Svg>

      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: iconTop,
          left: 0,
          right: 0,
          alignItems: 'center',
        }}
      >
        <MaterialIcons
          name={(icon ?? 'folder') as IconName}
          size={iconSize}
          color={colors.onSurface}
        />
      </View>
    </View>
  );
}
