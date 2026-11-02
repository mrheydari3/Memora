import { Button } from './Button';

type IconName = React.ComponentProps<typeof import('@expo/vector-icons').MaterialIcons>['name'];

type GhostButtonProps = {
  label: string;
  onPress?: () => void;
  icon?: IconName;
  /** 'surface' = glass pane; 'outline' = accent hairline; 'text' = bare label. */
  variant?: 'surface' | 'outline' | 'text';
  destructive?: boolean;
  className?: string;
};

const VARIANT = { surface: 'secondary', outline: 'outline', text: 'text' } as const;

/**
 * GhostButton — compatibility alias for the quieter `Button` variants.
 * New code should import `Button` directly.
 */
export function GhostButton({ variant = 'surface', ...rest }: GhostButtonProps) {
  const mapped = VARIANT[variant];
  return <Button {...rest} variant={mapped} size={mapped === 'text' ? 'lg' : 'md'} />;
}
