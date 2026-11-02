# Memora

A flashcard app with FSRS-6 scheduling, deck folders and a 60-second quiz mode.

**The target is the web only.** Expo Router runs the same app on `react-native-web`
and the browser build is the one that ships; there is no iOS or Android target, no
native project folder and no store build. `app.json` lists `platforms: ["web"]`, and
the design is measured in the browser (431×822 and 320×700 in the checks below).

## Run

```bash
npm install
npm run web            # http://localhost:8081 (Expo picks 8082 if 8081 is taken)
npm start              # same thing; `start` is web-only now
```

## Check

```bash
npx tsc --noEmit                 # types
npm test                         # data-layer unit tests (node:test)
npm run check:design             # no raw hex/rgba in components
npm run test:e2e                 # Playwright suite
node scripts/verify-list-surface.mjs   # flat canvas, list scrolling, contrast
node scripts/verify-mydecks-box.mjs    # My decks tree, Known group, 320px layout
```

The two `verify-*` scripts drive the running dev server (default
`http://localhost:8082`, override with `BASE_URL`) and restore any data they seed.

## Build

```bash
npm run build:web      # expo export --platform web → dist/
```
