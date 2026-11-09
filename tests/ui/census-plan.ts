/**
 * Census plan — turns the 84 manifest rows into concrete browser targets.
 *
 * The manifest names route patterns and triggers. The census needs a URL and a
 * fixture for each row, plus the smallest set of actions that opens an overlay.
 * States that need a whole behavioural flow (finish a quiz round, rate every
 * card in a session) are marked `not-automated`; they are still visited at
 * their route, but the report never pretends the end state was reached.
 */

import type { FixtureId, Surface } from './surfaces';

export const CENSUS_MAIN_DECK = 'deck-german-a2b1';
export const CENSUS_EMPTY_DECK = 'deck-empty';
export const CENSUS_ARCHIVED_DECK = 'deck-archived';
export const CENSUS_HEAVY_DECK = 'heavy-deck-001';
export const CENSUS_DISCOVER_DECK = 'discover-french-basics';

export type CensusAction =
  | { kind: 'click'; name: string; exact?: boolean }
  | { kind: 'fill'; label: string; value: string }
  | { kind: 'press'; key: string }
  | { kind: 'scroll'; text: string }
  | { kind: 'expect'; text: string };

export type CensusState = 'base' | 'triggered' | 'not-automated';

export type CensusTarget = {
  surfaceId: string;
  label: string;
  fixture: FixtureId;
  url: string;
  actions: readonly CensusAction[];
  state: CensusState;
};

const click = (name: string, exact = true): CensusAction => ({ kind: 'click', name, exact });
const fill = (label: string, value: string): CensusAction => ({ kind: 'fill', label, value });
const press = (key: string): CensusAction => ({ kind: 'press', key });
const scroll = (text: string): CensusAction => ({ kind: 'scroll', text });
const expect = (text: string): CensusAction => ({ kind: 'expect', text });

function deckFor(surface: Surface): string {
  if (surface.id === 'DK-02' || surface.id === 'SD-06' || surface.id === 'QZ-09') {
    return CENSUS_EMPTY_DECK;
  }
  if (surface.id === 'DK-03') return CENSUS_ARCHIVED_DECK;
  if (surface.id === 'DK-09') return CENSUS_HEAVY_DECK;
  return CENSUS_MAIN_DECK;
}

export function censusUrl(surface: Surface): string {
  switch (surface.route) {
    case '/':
      return '/';
    case '/home':
    case '/library':
    case '/settings':
    case '/settings/algorithm':
    case '/settings/offline':
    case '/settings/tts':
    case '/add-deck':
    case '/mass-import':
    case '/profile':
    case '/statistics':
    case '/discover':
    case '/dev':
      return surface.route;
    case '/settings/algorithm-advanced':
      // The surface covers both the deck-scoped and bare forms; the deck form
      // exercises the populated branch.
      return `${surface.route}?deckId=${CENSUS_MAIN_DECK}`;
    case '/deck/[id]':
      return `/deck/${deckFor(surface)}`;
    case '/deck/[id]/add-card':
      return `/deck/${deckFor(surface)}/add-card`;
    case '/study/[deckId]':
      return `/study/${deckFor(surface)}`;
    case '/quiz/[deckId]':
      return `/quiz/${deckFor(surface)}`;
    case '/discover/[id]':
      return `/discover/${CENSUS_DISCOVER_DECK}`;
    case '*':
      return '/this-route-does-not-exist';
  }
}

function actionsFor(surface: Surface): CensusAction[] {
  switch (surface.id) {
    case 'HM-06':
      // German is nested inside Languages; open the top-level folder first.
      return [click('Languages', false)];
    case 'HM-07':
      return [click('Nothing here yet', false)];
    case 'HM-08':
      return [click('New folder')];
    case 'HM-09':
      return [
        click('New folder'),
        fill('New folder', 'Languages'),
        click('Create folder'),
        expect('A folder with that name already exists.'),
      ];
    case 'HM-10':
      return [click('New folder'), click('Options for folder Languages')];
    case 'HM-11':
      return [
        click('New folder'),
        click('Options for folder Languages'),
        click('Location', false),
      ];
    case 'HM-12':
      return [click('Options for deck Empty deck')];
    case 'DK-07':
      return [click('More options')];
    case 'AC-05':
      return [
        fill('Front — the prompt', 'Census draft'),
        click('Go back'),
        expect('Discard changes?'),
      ];
    case 'SD-02':
      return [click('Show answer')];
    case 'SD-03':
      return [click('Show answer'), click('Good', false)];
    case 'SD-07':
      return [press('Space'), press('2')];
    case 'ST-09':
      return [click('Go back')];
    case 'DS-03':
      return [click('Add to library')];
    case 'DS-04':
      // Importing happens on Discover, then Home is a different route; the
      // census has no navigation action, so this state stays not-automated
      // rather than clicking an unrelated control on Home.
      return [];
    case 'PR-04':
      return [scroll('Mini Statistics')];
    case 'TX-04':
      return [scroll('Memory')];
    case 'TX-05':
      return [scroll('Memory')];
    case 'TX-06':
      return [scroll('Study habits')];
    case 'TX-07':
      return [scroll('Next 7 days')];
    case 'TX-08':
      return [scroll('What stands out')];
    case 'TX-09':
      return [scroll('Reports')];
    default:
      return [];
  }
}

export function censusTargets(surface: Surface): CensusTarget[] {
  const url = censusUrl(surface);
  const actions = actionsFor(surface);
  const fixtures = surface.fixtures.length > 0 ? surface.fixtures : (['F2'] as const);
  return fixtures.map((fixture) => ({
    surfaceId: surface.id,
    label: surface.label,
    fixture,
    url,
    actions,
    state:
      actions.length > 0 || surface.id === 'SH-02'
        ? 'triggered'
        : surface.trigger
          ? 'not-automated'
          : 'base',
  }));
}

export function allCensusTargets(surfaces: readonly Surface[]): CensusTarget[] {
  return surfaces.flatMap(censusTargets);
}
