import { ScrollViewStyleReset } from 'expo-router/html';
import { colors } from '../theme/tokens';

const PRODUCTION_URL = 'https://site-4cf1794985694a0fbdbfb3b24dec3e09.freebuff.page';
const SOCIAL_IMAGE =
  'https://raw.githubusercontent.com/mrheydari3/Memora/main/docs/assets/social-preview.png';

/**
 * Custom HTML wrapper for PWA support and dark mode initialization.
 * The dark-mode script runs before any React Native code to prevent
 * the "Cannot manually set color scheme" error from react-native-css-interop.
 */
export default function Root({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no"
        />
        {/* Set dark mode class on html before any JS loads */}
        <script dangerouslySetInnerHTML={{
          __html: `document.documentElement.classList.add('dark');`,
        }} />
        {/*
          The canvas is painted before the stylesheet arrives, so the first
          paint is ink rather than a white flash. The value comes from the
          palette; the rest of the base layer lives in global.css, where
          Tailwind resolves the same tokens.
        */}
        <style dangerouslySetInnerHTML={{
          __html: `:root{color-scheme:dark;background-color:${colors.background}}`,
        }} />
        <meta
          name="description"
          content="Memora is a local-first flashcard workspace built on FSRS-6, honest analytics, and a calm Nocturne Focus interface. No account. No telemetry."
        />
        <meta name="color-scheme" content="dark" />
        <meta name="application-name" content="Memora" />
        <meta name="robots" content="index,follow" />
        <link rel="canonical" href={PRODUCTION_URL} />
        <link rel="manifest" href="/manifest.json" />
        <link rel="icon" href="/favicon-v5.ico" sizes="48x48" />
        <link rel="icon" type="image/png" sizes="192x192" href="/icon-192-v5.png" />
        <link rel="apple-touch-icon" href="/apple-touch-icon-v5.png" />
        <meta name="theme-color" content={colors.background} />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Memora" />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="Memora" />
        <meta property="og:title" content="Memora — Remember more. Study with intention." />
        <meta
          property="og:description"
          content="A local-first flashcard workspace built on FSRS-6, calm design, and data you can actually trust."
        />
        <meta property="og:url" content={PRODUCTION_URL} />
        <meta property="og:image" content={SOCIAL_IMAGE} />
        <meta property="og:image:width" content="1280" />
        <meta property="og:image:height" content="640" />
        <meta property="og:image:alt" content="Memora — Remember more. Study with intention." />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Memora — Remember more. Study with intention." />
        <meta
          name="twitter:description"
          content="A local-first flashcard workspace built on FSRS-6, calm design, and data you can actually trust."
        />
        <meta name="twitter:image" content={SOCIAL_IMAGE} />
        <meta name="twitter:image:alt" content="Memora — Remember more. Study with intention." />
        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}