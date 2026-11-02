import { Animated, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { AppText } from './AppText';
import { colors, iconSize } from '../theme/tokens';
import type { TextVariant } from './AppText';
import { useReveal } from '../motion';

type IconName = React.ComponentProps<typeof MaterialIcons>['name'];

type EmptyStateProps = {
  icon: IconName;
  title: string;
  description?: string;
  /** The title's type step; lists use body, full-page states use headline. */
  titleVariant?: Extract<TextVariant, 'body' | 'bodyLg' | 'headline'>;
  /** Optional action rendered under the description. */
  action?: React.ReactNode;
  className?: string;
};

/**
 * EmptyState — the one way to say "nothing here": a quiet glyph, a short title
 * and one line of guidance. The caller owns the container (a pane, a dashed
 * frame, or bare canvas), so the same content sits anywhere.
 *
 * It settles in with a small pop instead of appearing mid-layout, which is what
 * keeps an empty screen from looking like a failed one.
 */
export function EmptyState({
  icon,
  title,
  description,
  titleVariant = 'body',
  action,
  className = '',
}: EmptyStateProps) {
  const reveal = useReveal('empty', { distance: 8, scale: 0.97 });

  return (
    <View className={`items-center ${className}`}>
      <Animated.View className="items-center" style={reveal.style}>
      <MaterialIcons name={icon} size={iconSize.display} color={colors.outline} />
      <AppText
        variant={titleVariant}
        weight="semibold"
        align="center"
        className="mt-3"
        numberOfLines={2}
      >
        {title}
      </AppText>
      {description && (
        <AppText variant="bodySm" tone="muted" align="center" className="mt-1">
          {description}
        </AppText>
      )}
      {action && <View className="mt-4">{action}</View>}
      </Animated.View>
    </View>
  );
}
