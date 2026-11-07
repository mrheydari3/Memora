/**
 * Web-only font repair.
 *
 * expo-font registers these families from a dev asset URL that Chromium
 * sometimes answers with a network error (the request returns 200 but never
 * finishes). A font face in the error state renders its text with zero height:
 *
 *  - `Inter_500Medium` / `Inter_600SemiBold`: every `ListRow` title (settings,
 *    deck menus, sheets) disappeared while the 400/700 weights looked fine.
 *  - `material`: the icon font. Every `MaterialIcons` glyph collapsed to zero
 *    width, so a route opened by URL (not by tapping through from Home) showed
 *    blank icon buttons, empty deck tiles and an empty speaker control.
 *
 * The font files themselves are healthy — re-registering the same family names
 * from a static URL loads them and the glyphs come back. Native is untouched:
 * on iOS/Android `useFonts` keeps loading the packaged assets, so only the web
 * path needs this.
 *
 * The face is added only after its load succeeds: adding a failing face leaves
 * Chrome with an error face that renders zero-height text. `swap` paints the
 * fallback first instead of waiting for the file.
 */
import { Platform } from 'react-native';

/** Served from `public/fonts`, which Expo answers at the site root. */
const FACES = [
  { family: 'Inter_400Regular', url: '/fonts/Inter_400Regular.ttf' },
  { family: 'Inter_500Medium', url: '/fonts/Inter_500Medium.ttf' },
  { family: 'Inter_600SemiBold', url: '/fonts/Inter_600SemiBold.ttf' },
  { family: 'Inter_700Bold', url: '/fonts/Inter_700Bold.ttf' },
  // The same file @expo/vector-icons ships, served statically instead of
  // through the dev asset endpoint that fails. The family name must stay
  // `material` — that is what components/Icon.tsx puts on every glyph.
  { family: 'material', url: '/fonts/MaterialIcons.ttf' },
  // Arabic-script coverage for the Persian card backs, quiz answers and deck
  // subtitles. Inter has no Arabic glyphs, and without this the copy depends
  // on an OS font that may not exist (the audit machine has none, so the quiz
  // showed four answers of empty boxes). Registered here rather than through a
  // CSS @font-face so it follows the same proven path as the other faces.
  { family: 'Vazirmatn', url: '/fonts/Vazirmatn-Regular.ttf' },
] as const;

type LoadableFontFace = { load: () => Promise<unknown> };
type FontFaceDescriptors = { display?: 'auto' | 'block' | 'swap' | 'fallback' | 'optional' };
type FontFaceConstructor = new (
  family: string,
  source: string,
  descriptors?: FontFaceDescriptors
) => LoadableFontFace;

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
  if (!doc?.fonts || !FontFace) {
    return;
  }

  const pending = FACES.map(({ family, url }) => {
    const face = new FontFace(family, `url(${url})`, { display: 'swap' });
    return face
      .load()
      .then(() => {
        doc.fonts?.add(face);
      })
      .catch(() => {
        // The browser's fallback stays in place; nothing else to do here.
      });
  });
  void Promise.all(pending);
}
