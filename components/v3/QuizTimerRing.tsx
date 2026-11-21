import { StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { AppText } from '../AppText';
import { colors, fills } from '../../theme/tokens';

/**
 * The round's clock as a ring. The arc is the remaining time; the number in
 * the middle is the same clock every other surface shows. The ring turns to
 * the warning tone under 10 seconds and is decorative: the time is text.
 */
export function TimerRing({
  size,
  progress,
  low,
  label,
}: {
  size: number;
  progress: number;
  low: boolean;
  label: string;
}) {
  const stroke = Math.max(5, Math.round(size / 20));
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={fills.track}
          strokeWidth={stroke}
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={low ? colors.warning : colors.primary}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={circumference * (1 - Math.max(0, Math.min(1, progress)))}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      {/*
        Size and leading are inline on purpose. Setting them as `text-[…]`
        utilities lost to the variant's own font-size, so the 56px ring drew
        34px digits inside a 20px line box and cut them in half; matching values
        in one place keeps the two branches honest.
      */}
      <AppText
        variant="display"
        style={{
          fontVariant: ['tabular-nums'],
          color: low ? colors.warning : undefined,
          fontSize: size > 100 ? 32 : 17,
          lineHeight: size > 100 ? 36 : 22,
          letterSpacing: size > 100 ? -1.1 : -0.3,
        }}
      >
        {label}
      </AppText>
      {size > 100 && (
        <AppText variant="caption" tone="muted">
          left
        </AppText>
      )}
    </View>
  );
}
