/**
 * Web-only font repair.
 *
 * expo-font registers `Inter_500Medium` and `Inter_600SemiBold` from a dev asset
 * URL that Chromium answers with a network error. A font face in the error state
 * renders its text with zero height, so every `ListRow` title (settings, deck
 * menus, sheets) disappeared while the 400/700 weights looked fine.
 *
 * The font files themselves are healthy — re-registering the same family names
 * from a static URL loads them and the text comes back at its normal height.
 * Native is untouched: on iOS/Android `useFonts` keeps loading the packaged
 * assets, so only the web path needs this.
 */
import { Platform } from 'react-native';

/** Served from `public/fonts`, which Expo answers at the site root. */
const FACES = [
  { family: 'Inter_500Medium', url: '/fonts/Inter_500Medium.ttf' },
  { family: 'Inter_600SemiBold', url: '/fonts/Inter_600SemiBold.ttf' },
] as const;

type LoadableFontFace = { load: () => Promise<unknown> };
type FontFaceConstructor = new (family: string, source: string) => LoadableFontFace;

type WebDocument = {
  fonts?: {
    add: (face: LoadableFontFace) => void;
  };
};

/** One attempt per page load; the browser keeps the registered faces. */
let attempted = false;

export function ensureWebFonts(): void {
  if (Platform.OS !== 'web' || attempted) return;
  attempted = true;

  // The project compiles with DOM types, so route the narrow shape through
  // `unknown` instead of pretending it is the built-in Document.
  const doc = (globalThis as unknown as { document?: WebDocument }).document;
  const FontFace = (globalThis as unknown as { FontFace?: FontFaceConstructor }).FontFace;
  if (!doc?.fonts || !FontFace) return;

  for (const { family, url } of FACES) {
    const face = new FontFace(family, `url(${url})`);
    face
      .load()
      .then(() => doc.fonts?.add(face))
      .catch(() => {
        // The browser's fallback stays in place; nothing else to do here.
      });
  }
}
