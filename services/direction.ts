import { useEffect, useState } from 'react';
import { I18nManager, Platform } from 'react-native';

/**
 * Layout direction.
 *
 * The web build follows the document's `dir`, which a host page, a translated
 * shell or the reader's own devtools can set; native follows I18nManager. Both
 * answers are read at runtime, because a component that hard-codes the side of
 * a rail breaks the moment the direction changes.
 */
export function isRtl(): boolean {
  if (Platform.OS === 'web') {
    if (typeof document === 'undefined' || typeof window === 'undefined') return false;
    return window.getComputedStyle(document.documentElement).direction === 'rtl';
  }
  return I18nManager.isRTL;
}

/**
 * Reactive form. On the web it follows `dir` mutations on <html>, so a page that
 * flips direction re-renders the components that care instead of leaving them
 * mirrored the wrong way.
 */
export function useRtl(): boolean {
  const [rtl, setRtl] = useState(isRtl);

  useEffect(() => {
    setRtl(isRtl());
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;

    const read = () => setRtl(isRtl());
    const observer = new MutationObserver(read);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['dir'] });
    return () => observer.disconnect();
  }, []);

  return rtl;
}
