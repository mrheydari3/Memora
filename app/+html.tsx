import { ScrollViewStyleReset } from 'expo-router/html';
import { colors } from '../theme/tokens';

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
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content={colors.background} />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Memora" />
        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}