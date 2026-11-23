import { useWindowDimensions } from 'react-native';

/**
 * The app has two device layouts.
 *
 * Mobile is the iPhone-class canvas. Tablet is everything from an iPad portrait
 * upward — tablets, laptops and desktops share it — so there is no separate
 * desktop composition to keep in step.
 */
export const TABLET_MIN_WIDTH = 768;

/** The widest phone the 3.2 design is measured against. */
export const PHONE_MAX_WIDTH = 430;

/** Below this the hero and the shelf tighten for a small phone. */
export const PHONE_COMPACT_WIDTH = 359;

/** Shelf and card grids pair two columns on the tablet layout. */
export const TABLET_COLUMNS = 2;

export function useResponsive() {
  const { width, height } = useWindowDimensions();
  const tablet = width >= TABLET_MIN_WIDTH;
  return {
    width,
    height,
    tablet,
    mobile: !tablet,
    phone: width <= PHONE_MAX_WIDTH,
    compact: width <= PHONE_COMPACT_WIDTH,
  };
}
