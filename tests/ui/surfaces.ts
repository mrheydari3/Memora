/**
 * Surface manifest — the denominator for the full UI verification.
 *
 * Every route file under `app/` must appear here, and every entry must name at
 * least one fixture (F0–F6) and the gates that apply to it (G1–G12). The
 * route-parity test fails when a route exists without an entry, when an entry
 * names a route that no file defines, or when an entry has no fixture.
 *
 * The plan started at 82 surfaces. Route parity found `app/add-deck.tsx` had no
 * entry, so AD-01 was added and the denominator became 83. Change this number
 * only together with the manifest.
 */

export const ALL_GATES = [
  'G1', // loads
  'G2', // console
  'G3', // axe
  'G4', // semantics
  'G5', // targets
  'G6', // keyboard
  'G7', // layout
  'G8', // visual
  'G9', // motion
  'G10', // data truth
  'G11', // persistence
  'G12', // failure
] as const;

export type Gate = (typeof ALL_GATES)[number];

export const FIXTURES = ['F0', 'F1', 'F2', 'F3', 'F4', 'F5', 'F6'] as const;

export type FixtureId = (typeof FIXTURES)[number];

export const EXPECTED_SURFACE_COUNT = 83;

export const ROUTE_PATTERNS = [
  '/',
  '/home',
  '/library',
  '/settings',
  '/settings/algorithm',
  '/settings/algorithm-advanced',
  '/settings/offline',
  '/settings/tts',
  '/add-deck',
  '/mass-import',
  '/profile',
  '/statistics',
  '/deck/[id]',
  '/deck/[id]/add-card',
  '/study/[deckId]',
  '/quiz/[deckId]',
  '/discover',
  '/discover/[id]',
  '/dev',
  '*',
] as const;

export type RoutePattern = (typeof ROUTE_PATTERNS)[number];

export type Surface = {
  id: string;
  label: string;
  route: RoutePattern;
  fixtures: readonly FixtureId[];
  gates: readonly Gate[];
  /** How the state is reached; required for overlays. */
  trigger?: string;
  /** A sheet, dialog or modal state rather than a standalone route. */
  overlay?: boolean;
};

const LOADING: readonly Gate[] = ['G1', 'G2', 'G3', 'G4', 'G5', 'G6', 'G7', 'G8', 'G9', 'G12'];
const FAILURE: readonly Gate[] = ['G1', 'G2', 'G4', 'G7', 'G8', 'G12'];
const SHELL: readonly Gate[] = ['G1', 'G2', 'G4', 'G7', 'G8', 'G9', 'G12'];
const CHROME: readonly Gate[] = ['G1', 'G2', 'G3', 'G4', 'G5', 'G6', 'G7', 'G8', 'G9', 'G11'];
const NAV: readonly Gate[] = ['G1', 'G2', 'G4', 'G6', 'G7', 'G8', 'G11', 'G12'];

const s = (
  id: string,
  label: string,
  route: RoutePattern,
  fixtures: readonly FixtureId[],
  gates: readonly Gate[] = ALL_GATES,
  extra: { trigger?: string; overlay?: boolean } = {}
): Surface => ({ id, label, route, fixtures, gates, ...extra });

export const SURFACES: readonly Surface[] = [
  // ---- Shell -----------------------------------------------------------------
  s('SH-01', 'Boot splash', '/', ['F0'], LOADING, { trigger: 'cold load' }),
  s('SH-02', 'Storage read failure and corrupt JSON', '/', ['F5', 'F6'], FAILURE, {
    trigger: 'throw on memory:decks, or write invalid JSON into it',
  }),
  s('SH-03', 'Tab capsule (active lens and drag)', '/home', ['F2'], CHROME, {
    trigger: 'every tabbed route at 320',
  }),
  s('SH-04', 'Unknown route', '*', ['F0']),
  s('SH-05', 'Document head and PWA shell', '/', ['F0'], SHELL),

  // ---- Home ------------------------------------------------------------------
  s('HM-01', 'Home loading skeleton', '/home', ['F0'], LOADING),
  s('HM-02', 'Empty library', '/home', ['F1']),
  s('HM-03', 'Today hero with due cards', '/home', ['F2']),
  s('HM-04', 'Today hero with nothing due', '/home', ['F2'], ALL_GATES, {
    trigger: 'move every due date in the fixture into the future',
  }),
  s('HM-05', 'Deck shelf at the root', '/home', ['F2']),
  s('HM-06', 'Folder opened one level', '/home', ['F2'], ALL_GATES, {
    trigger: 'tap a folder row',
  }),
  s('HM-07', 'Empty folder', '/home', ['F2'], ALL_GATES, {
    trigger: 'open "Nothing here yet"',
  }),
  s('HM-08', 'Folders sheet: list and create', '/home', ['F2'], ALL_GATES, {
    trigger: 'Folders button in the Home header',
    overlay: true,
  }),
  s('HM-09', 'Folder create validation error', '/home', ['F2'], ALL_GATES, {
    trigger: 'submit an empty or duplicate folder name',
    overlay: true,
  }),
  s('HM-10', 'Folder editor: name, icon, colour, pin', '/home', ['F2'], ALL_GATES, {
    trigger: 'options on an existing folder',
    overlay: true,
  }),
  s('HM-11', 'Folder move / location', '/home', ['F2'], ALL_GATES, {
    trigger: 'Location row in the folder editor',
    overlay: true,
  }),
  s('HM-12', 'Deck options sheet (pin and move)', '/home', ['F2'], ALL_GATES, {
    trigger: 'options on a deck row',
    overlay: true,
  }),
  s('HM-13', 'Long, RTL and 40-character names at 320', '/home', ['F2']),

  // ---- Library (Game) --------------------------------------------------------
  s('LB-01', 'Game lobby', '/library', ['F3']),
  s('LB-02', 'No playable deck', '/library', ['F1']),
  s('LB-03', 'Selected deck with best record', '/library', ['F3']),
  s('LB-04', 'Deck under four cards', '/library', ['F2']),

  // ---- Settings --------------------------------------------------------------
  s('ST-01', 'Settings index', '/settings', ['F0']),
  s('ST-02', 'Study chapter: algorithm and TTS rows', '/settings', ['F0']),
  s('ST-03', 'Game toggles: sound and haptics', '/settings', ['F0']),
  s('ST-04', 'Data chapter', '/settings', ['F0']),
  s('ST-05', 'Algorithm settings', '/settings/algorithm', ['F2']),
  s('ST-06', 'Algorithm advanced with and without deckId', '/settings/algorithm-advanced', ['F2']),
  s('ST-07', 'Text-to-Speech settings', '/settings/tts', ['F0']),
  s('ST-08', 'Offline and install settings', '/settings/offline', ['F0']),
  s('ST-09', 'Direct-loaded settings child and Back', '/settings/algorithm', ['F0'], NAV, {
    trigger: 'load /settings/algorithm directly, then press Back',
  }),

  // ---- Deck ------------------------------------------------------------------
  s('DK-01', 'Deck ledger', '/deck/[id]', ['F2']),
  s('DK-02', 'Deck with no cards', '/deck/[id]', ['F2'], ALL_GATES, {
    trigger: '/deck/deck-empty',
  }),
  s('DK-03', 'Archived deck', '/deck/[id]', ['F2'], ALL_GATES, {
    trigger: '/deck/deck-archived',
  }),
  s('DK-04', 'Card search with no match', '/deck/[id]', ['F2']),
  s('DK-05', 'Colour filter: open, applied, cleared', '/deck/[id]', ['F2']),
  s('DK-06', 'Card context expanded', '/deck/[id]', ['F2']),
  s('DK-07', 'Deck options sheet', '/deck/[id]', ['F2'], ALL_GATES, {
    trigger: 'deck options button',
    overlay: true,
  }),
  s('DK-08', 'Long and RTL card text at 320', '/deck/[id]', ['F2']),
  s('DK-09', 'Long card ledger scroll', '/deck/[id]', ['F4']),

  // ---- Card composer ---------------------------------------------------------
  s('AC-01', 'Composer empty validation', '/deck/[id]/add-card', ['F2']),
  s('AC-02', 'Composer with both faces', '/deck/[id]/add-card', ['F2']),
  s('AC-03', 'Card colour picker', '/deck/[id]/add-card', ['F2']),
  s('AC-04', 'Editing an existing card', '/deck/[id]/add-card', ['F2']),
  s('AC-05', 'Unsaved draft keep or discard', '/deck/[id]/add-card', ['F2'], ALL_GATES, {
    trigger: 'type, then leave the composer with unsaved text',
    overlay: true,
  }),
  s('AC-06', 'Long prompt that grows', '/deck/[id]/add-card', ['F2']),

  // ---- Study -----------------------------------------------------------------
  s('SD-01', 'Study front', '/study/[deckId]', ['F2']),
  s('SD-02', 'Answer revealed with four ratings', '/study/[deckId]', ['F2']),
  s('SD-03', 'Rate, requeue, next card', '/study/[deckId]', ['F2']),
  s('SD-04', 'Stable progress denominator', '/study/[deckId]', ['F2']),
  s('SD-05', 'Session complete', '/study/[deckId]', ['F2']),
  s('SD-06', 'Deck with no cards copy', '/study/[deckId]', ['F2'], ALL_GATES, {
    trigger: '/study/deck-empty',
  }),
  s('SD-07', 'Space reveals, 1–4 rate', '/study/[deckId]', ['F2'], ALL_GATES, {
    trigger: 'keyboard only',
  }),
  s('SD-08', 'Text-to-Speech playback', '/study/[deckId]', ['F2']),

  // ---- Quiz ------------------------------------------------------------------
  s('QZ-01', 'Round start', '/quiz/[deckId]', ['F3']),
  s('QZ-02', 'Correct answer', '/quiz/[deckId]', ['F3']),
  s('QZ-03', 'Wrong answer and reveal', '/quiz/[deckId]', ['F3']),
  s('QZ-04', 'Combo at three or more', '/quiz/[deckId]', ['F3']),
  s('QZ-05', 'Timer under ten seconds', '/quiz/[deckId]', ['F3']),
  s('QZ-06', 'Result overlay focus trap and restore', '/quiz/[deckId]', ['F3']),
  s('QZ-07', 'Play again', '/quiz/[deckId]', ['F3']),
  s('QZ-08', 'Deck cleared bonus', '/quiz/[deckId]', ['F3']),
  s('QZ-09', 'Unplayable or deleted deck', '/quiz/[deckId]', ['F2']),

  // ---- Statistics ------------------------------------------------------------
  s('TX-01', 'Statistics empty', '/statistics', ['F1']),
  s('TX-02', 'Statistics populated', '/statistics', ['F3']),
  s('TX-03', 'Range switch', '/statistics', ['F3']),
  s('TX-04', 'Top section', '/statistics', ['F3']),
  s('TX-05', 'Memory section', '/statistics', ['F3']),
  s('TX-06', 'Habits section', '/statistics', ['F3']),
  s('TX-07', 'Forecast section', '/statistics', ['F3']),
  s('TX-08', 'Insights section', '/statistics', ['F3']),
  s('TX-09', 'Reports section', '/statistics', ['F3']),

  // ---- Profile ---------------------------------------------------------------
  s('PR-01', 'Profile with no reviews', '/profile', ['F1']),
  s('PR-02', 'Profile populated', '/profile', ['F3']),
  s('PR-03', 'Badge rail at 320', '/profile', ['F3']),

  // ---- Discover --------------------------------------------------------------
  s('DS-01', 'Discover catalogue', '/discover', ['F0']),
  s('DS-02', 'Discover deck detail', '/discover/[id]', ['F0']),
  s('DS-03', 'Import a Discover deck', '/discover/[id]', ['F0']),
  s('DS-04', 'Imported deck on Home', '/home', ['F2'], ALL_GATES, {
    trigger: 'import a Discover deck, then open Home',
  }),
  s('DS-05', 'Discover deep link', '/discover/[id]', ['F0'], ALL_GATES, {
    trigger: 'direct URL',
  }),

  // ---- Other routes ----------------------------------------------------------
  s('AD-01', 'New deck sheet: form, validation, direct load', '/add-deck', ['F0'], ALL_GATES, {
    trigger: 'Add deck from Home, or direct /add-deck',
    overlay: true,
  }),
  s('MI-01', 'Mass import planned state', '/mass-import', ['F0']),
  s('DV-01', 'Developer data: load, restore, wipe', '/dev', ['F0']),
];
