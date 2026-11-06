/**
 * Navigation helpers.
 *
 * `router.push` always appends a stack entry, so two presses on the same row —
 * a double-tap, or a press that lands while the first navigation is still
 * settling — push the same screen twice. The stack then holds two identical
 * routes while the browser history holds one entry, so a single Back press
 * appears to do nothing and the user is stuck on the duplicate.
 *
 * `pushOnce` collapses only that case: the same destination within
 * `PUSH_REPEAT_WINDOW_MS`. A different destination, a different set of params,
 * or the same destination later still pushes normally, so intentional revisits
 * keep working.
 */
import type { Href } from 'expo-router';

/** A router that can inspect history and replace the current route. */
type BackRouter = {
  canGoBack: () => boolean;
  back: () => void;
  replace: (href: Href) => void;
};

/**
 * Go back when there is history; otherwise replace the current route with a
 * meaningful parent. A deep link, a browser refresh or a restored PWA can mount
 * a screen with an empty stack, and a bare `router.back()` then dispatches
 * `GO_BACK` to no navigator and leaves the control dead.
 */
export function goBackOr(router: BackRouter, fallback: Href): void {
  if (router.canGoBack()) {
    router.back();
    return;
  }
  router.replace(fallback);
}

/** How long a second push to the identical destination is treated as a repeat. */
export const PUSH_REPEAT_WINDOW_MS = 500;

/** Most recent push per destination string. Bounded by `PRUNE_AT`. */
const lastPushAt = new Map<string, number>();
const PRUNE_AT = 32;

type Pusher = { push: (href: Href) => void };

/** Object hrefs are keyed with their params, so different cards/decks differ. */
function destinationKey(href: Href): string {
  if (typeof href === 'string') return href;
  const { pathname, params } = href as { pathname: string; params?: object };
  return `${pathname}?${JSON.stringify(params ?? {})}`;
}

/** The route portion of a destination key (object hrefs keep their params). */
function routePath(key: string): string {
  return key.split('?')[0];
}

/**
 * Call whenever the active route changes. A guarded destination that is no
 * longer the active route has been left, so pushing it again is a fresh intent:
 * without this, Back followed by an immediate re-tap would read as a dead row.
 */
export function noteActivePath(pathname: string): void {
  for (const key of [...lastPushAt.keys()]) {
    if (routePath(key) !== pathname) lastPushAt.delete(key);
  }
}

/**
 * Push `href`, unless it is the destination that was just pushed.
 * Returns whether the navigation was dispatched.
 */
export function pushOnce(router: Pusher, href: Href): boolean {
  const key = destinationKey(href);
  const now = Date.now();
  const previous = lastPushAt.get(key);

  if (previous !== undefined && now - previous < PUSH_REPEAT_WINDOW_MS) {
    return false;
  }

  lastPushAt.set(key, now);
  if (lastPushAt.size > PRUNE_AT) {
    for (const [entry, at] of lastPushAt) {
      if (now - at >= PUSH_REPEAT_WINDOW_MS) lastPushAt.delete(entry);
    }
  }

  router.push(href);
  return true;
}
