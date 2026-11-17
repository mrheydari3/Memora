import { AppText } from '../AppText';
import type { AppTextProps } from '../AppText';
import { serifFamily } from '../../theme/v4';

/**
 * Serif — the shelf's editorial voice.
 *
 * Only the masthead, section names and due figures wear it. Instrument Serif is
 * a static web face loaded from `public/fonts`; the family stack falls back to
 * a book face on iOS and the platform serif on Android. `AppText` still owns
 * the semantic heading role, language tags and tone.
 */
export function Serif({ style, weight = 'regular', ...rest }: AppTextProps) {
  return (
    <AppText
      weight={weight}
      {...rest}
      style={[{ fontFamily: serifFamily, fontWeight: '400' }, style]}
    />
  );
}
