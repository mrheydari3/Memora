import { Button } from './Button';

type IconName = React.ComponentProps<typeof import('@expo/vector-icons').MaterialIcons>['name'];

type PrimaryButtonProps = {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  loading?: boolean;
  icon?: IconName;
  /** Full-width by default; pass a className to override. */
  className?: string;
  /**
   * 'quiet' is the study screen's take on the primary action: the same azure
   * fill, but a hairline rim and a spring press. Every other screen uses the
   * default filled treatment.
   */
  variant?: 'default' | 'quiet';
};

/**
 * PrimaryButton — compatibility alias for `Button variant="primary"`.
 * New code should import `Button` directly.
 */
export function PrimaryButton({ variant = 'default', icon, ...rest }: PrimaryButtonProps) {
  return (
    <Button
      {...rest}
      icon={icon}
      variant={variant === 'quiet' ? 'primaryQuiet' : 'primary'}
      size="lg"
    />
  );
}
