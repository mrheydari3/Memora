import { createContext, useContext } from 'react';

/**
 * True once the launch layer has fully left the canvas.
 *
 * The route is deliberately mounted behind the splash so the hand-off is a
 * paint, not a layout swap. That also means a screen's mount-time entrance
 * would finish while the splash is still covering it. Home consumes this flag
 * so its hero starts its reveal at the moment the learner can actually see it,
 * and never replays on ordinary tab navigation.
 */
export const LaunchRevealContext = createContext(false);

export function useLaunchReveal(): boolean {
  return useContext(LaunchRevealContext);
}