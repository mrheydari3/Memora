import { useEffect, useState } from 'react';
import { Platform, useWindowDimensions } from 'react-native';

/** At and above this effective scale the shell stops sizing for 12px captions. */
export const LARGE_TEXT_SCALE = 1.5;

/**
 * The browser's text-only scale.
 *
 * Chrome's font-size setting and the 200% audit both change the root font size
 * without changing the CSS viewport, so rem-based AppText grows while
 * `useWindowDimensions().width` stays at 390. Native reports its scale directly.
 */
function readWebTextScale(): number {
  if (typeof document === 'undefined') return 1;
  const root = Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
  return Number.isFinite(root) && root > 0 ? root / 16 : 1;
}

export function useTextScale() {
  const { fontScale } = useWindowDimensions();
  const [webScale, setWebScale] = useState(readWebTextScale);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const update = () => setWebScale(readWebTextScale());
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  const scale = Platform.OS === 'web' ? webScale : Math.max(1, fontScale ?? 1);
  return { largeText: scale >= LARGE_TEXT_SCALE };
}
