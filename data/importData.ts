import type {
  Deck,
  DeckFolder,
  Flashcard,
  FSRSCardState,
  GameRecord,
  Rating,
  ReviewLogEntry,
  Settings,
} from './types';
import { FSRS_DEFAULTS, resolveFsrsParams } from './fsrs-params';
import { textDirection } from './text';

/**
 * Import parsing is deliberately pure.
 *
 * A flashcard format is data, not a screen: the file picker, textarea and
 * preview all call this module, and the domain tests can exercise every shape
 * without mounting React or touching AsyncStorage. The parser accepts only
 * fields the card model can actually store; anything else is dropped rather
 * than smuggled into a deck.
 */

export const IMPORT_MAX_CARDS = 20_000;
export const DEFAULT_IMPORT_DECK_NAME = 'Imported cards';

export type ImportCard = {
  front: string;
  back: string;
  example?: string;
  synonyms?: string;
  note?: string;
  frontDirection?: 'ltr' | 'rtl';
  backDirection?: 'ltr' | 'rtl';
};

export type CardsImport = {
  kind: 'cards';
  deckName: string;
  description?: string;
  cards: ImportCard[];
  warnings: string[];
};

export type BackupImport = {
  kind: 'backup';
  decks: Deck[];
  folders: DeckFolder[];
  cardsByDeck: Record<string, Flashcard[]>;
  reviewLog: ReviewLogEntry[];
  gameRecords: Record<string, GameRecord>;
  settings?: Settings;
  warnings: string[];
};

export type ParsedImport = CardsImport | BackupImport;

export type ParseResult =
  | { ok: true; value: ParsedImport }
  | { ok: false; error: string };

type UnknownRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is UnknownRecord =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const asString = (value: unknown): string | undefined => {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return undefined;
};

const firstString = (...values: unknown[]): string | undefined => {
  for (const value of values) {
    const text = asString(value);
    if (text !== undefined && text.trim() !== '') return text.trim();
  }
  return undefined;
};

const asNumber = (value: unknown, fallback: number): number => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
};

const asNullableNumber = (value: unknown): number | null => {
  if (value === null || value === undefined) return null;
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
};

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const readDirection = (value: unknown): 'ltr' | 'rtl' | undefined => {
  const text = asString(value)?.trim().toLowerCase();
  return text === 'ltr' || text === 'rtl' ? text : undefined;
};

function readSide(value: unknown): { text: string; direction?: 'ltr' | 'rtl' } | null {
  if (typeof value === 'string') {
    const text = value.trim();
    return text ? { text, direction: textDirection(text) } : null;
  }
  if (!isRecord(value)) return null;

  const text = firstString(value.text, value.value, value.content, value.front, value.back);
  if (!text) return null;
  return {
    text,
    direction: readDirection(value.direction),
  };
}

function readCardSides(
  value: UnknownRecord
): { front: { text: string; direction?: 'ltr' | 'rtl' }; back: { text: string; direction?: 'ltr' | 'rtl' } } | null {
  const front = readSide(
    value.front ?? value.Front ?? value.question ?? value.Question ?? value.term ?? value.Term ?? value.word ?? value.Word
  );
  const back = readSide(
    value.back ?? value.Back ?? value.answer ?? value.Answer ?? value.definition ?? value.Definition ?? value.translation ?? value.Translation
  );
  if (!front || !back) return null;
  return { front, back };
}

function normalizeImportCard(value: unknown): ImportCard | null {
  if (!isRecord(value)) return null;
  const sides = readCardSides(value);
  if (!sides) return null;

  const frontDirection =
    readDirection(value.frontDirection ?? value.front_direction ?? value.direction) ??
    sides.front.direction;
  const backDirection =
    readDirection(value.backDirection ?? value.back_direction ?? value.direction) ??
    sides.back.direction;

  return {
    front: sides.front.text,
    back: sides.back.text,
    ...(firstString(value.example, value.exampleSentence, value.sentence)
      ? { example: firstString(value.example, value.exampleSentence, value.sentence) }
      : {}),
    ...(firstString(value.synonyms, value.synonym)
      ? { synonyms: firstString(value.synonyms, value.synonym) }
      : {}),
    ...(firstString(value.note, value.notes, value.hint)
      ? { note: firstString(value.note, value.notes, value.hint) }
      : {}),
    ...(frontDirection ? { frontDirection } : {}),
    ...(backDirection ? { backDirection } : {}),
  };
}

function deckNameFrom(raw: UnknownRecord): string {
  const deck = isRecord(raw.deck) ? raw.deck : null;
  return (
    firstString(deck?.name, raw.deckName, raw.deck_name, raw.name) ??
    DEFAULT_IMPORT_DECK_NAME
  );
}

function deckDescriptionFrom(raw: UnknownRecord): string | undefined {
  const deck = isRecord(raw.deck) ? raw.deck : null;
  return firstString(deck?.description, raw.description);
}

function cardsImport(
  values: unknown[],
  deckName: string,
  description: string | undefined,
  source: string
): ParseResult {
  if (values.length > IMPORT_MAX_CARDS) {
    return {
      ok: false,
      error: `${source} contains more than ${IMPORT_MAX_CARDS.toLocaleString('en-US')} cards. Split it into smaller files.`,
    };
  }

  const cards: ImportCard[] = [];
  const warnings: string[] = [];
  values.forEach((value, index) => {
    const card = normalizeImportCard(value);
    if (card) cards.push(card);
    else warnings.push(`Item ${index + 1} was skipped: front and back are required.`);
  });

  if (cards.length === 0) {
    return {
      ok: false,
      error: 'No cards found. Each item needs a front and a back.',
    };
  }

  return {
    ok: true,
    value: {
      kind: 'cards',
      deckName: deckName.trim() || DEFAULT_IMPORT_DECK_NAME,
      ...(description ? { description } : {}),
      cards,
      warnings,
    },
  };
}

function freshFsrs(): FSRSCardState {
  return {
    due: new Date().toISOString(),
    stability: 0,
    difficulty: 0,
    elapsed_days: 0,
    scheduled_days: 0,
    reps: 0,
    lapses: 0,
    state: 'New',
    last_review: null,
    learning_steps: 0,
  };
}

const FSRS_STATES: readonly FSRSCardState['state'][] = ['New', 'Learning', 'Review', 'Relearning'];

function normalizeFsrs(value: unknown): FSRSCardState {
  if (!isRecord(value)) return freshFsrs();
  const rawState = asString(value.state);
  const state = FSRS_STATES.includes(rawState as FSRSCardState['state'])
    ? (rawState as FSRSCardState['state'])
    : 'New';
  const due = asString(value.due);
  const lastReview = asString(value.last_review);
  const dueDate = due && !Number.isNaN(Date.parse(due)) ? due : new Date().toISOString();
  return {
    due: dueDate,
    stability: Math.max(0, asNumber(value.stability, 0)),
    difficulty: Math.max(0, asNumber(value.difficulty, 0)),
    elapsed_days: Math.max(0, asNumber(value.elapsed_days, 0)),
    scheduled_days: Math.max(0, asNumber(value.scheduled_days, 0)),
    reps: Math.max(0, asNumber(value.reps, 0)),
    lapses: Math.max(0, asNumber(value.lapses, 0)),
    state,
    last_review: lastReview && !Number.isNaN(Date.parse(lastReview)) ? lastReview : null,
    learning_steps: Math.max(0, asNumber(value.learning_steps, 0)),
  };
}

function normalizeBackupDeck(value: unknown): Deck | null {
  if (!isRecord(value)) return null;
  const id = firstString(value.id);
  const name = firstString(value.name);
  if (!id || !name) return null;

  const algorithmPreset =
    value.algorithmPreset === 'fast' || value.algorithmPreset === 'general'
      ? value.algorithmPreset
      : 'fsrs';
  const learningSteps = Array.isArray(value.learningSteps)
    ? value.learningSteps.filter((step): step is string => typeof step === 'string')
    : ['12 hours', '1 day', '2 days', '3 days'];

  const deck: Deck = {
    id,
    name,
    ...(firstString(value.description) ? { description: firstString(value.description) } : {}),
    icon: firstString(value.icon) ?? 'style',
    color: firstString(value.color) ?? '#7CBBFF',
    ...(typeof value.rating === 'number' ? { rating: value.rating } : {}),
    parentId: value.parentId === null ? null : firstString(value.parentId) ?? null,
    algorithmPreset,
    newCardsPerDay: clamp(asNumber(value.newCardsPerDay, 20), 0, 99_999),
    maxCardsPerDay: clamp(asNumber(value.maxCardsPerDay, 80), 0, 99_999),
    shuffleCards: value.shuffleCards !== false,
    ...(value.adaptiveOrdering === undefined
      ? {}
      : { adaptiveOrdering: value.adaptiveOrdering === true }),
    learningSteps,
    masteredIntervalMultiplier: Math.max(1, asNumber(value.masteredIntervalMultiplier, 2.5)),
    ...FSRS_DEFAULTS,
    ...resolveFsrsParams(value as Partial<Deck>),
    createdAt: asNumber(value.createdAt, Date.now()),
    archivedAt: asNullableNumber(value.archivedAt),
    ...(value.saved === undefined ? {} : { saved: value.saved === true }),
    folderId: value.folderId === null ? null : firstString(value.folderId) ?? null,
    pinnedAt: asNullableNumber(value.pinnedAt),
  };
  return deck;
}

function normalizeBackupFolder(value: unknown): DeckFolder | null {
  if (!isRecord(value)) return null;
  const id = firstString(value.id);
  const name = firstString(value.name);
  if (!id || !name) return null;
  return {
    id,
    name,
    createdAt: asNumber(value.createdAt, Date.now()),
    ...(firstString(value.icon) ? { icon: firstString(value.icon) } : {}),
    ...(firstString(value.color) ? { color: firstString(value.color) } : {}),
    parentId: value.parentId === null ? null : firstString(value.parentId) ?? null,
    pinnedAt: asNullableNumber(value.pinnedAt),
  };
}

function normalizeBackupCard(
  value: unknown,
  deckId: string,
  index: number,
  usedIds: Set<string>
): Flashcard | null {
  if (!isRecord(value)) return null;
  const source = normalizeImportCard(value);
  if (!source) return null;

  let id =
    firstString(value.id) ?? `card-${deckId}-${String(index + 1).padStart(4, '0')}`;
  while (usedIds.has(id)) id = `${id}-${index + 1}`;
  usedIds.add(id);

  return {
    id,
    deckId,
    front: {
      text: source.front,
      direction: source.frontDirection ?? textDirection(source.front),
    },
    back: {
      text: source.back,
      direction: source.backDirection ?? textDirection(source.back),
    },
    ...(source.example ? { example: source.example } : {}),
    ...(source.synonyms ? { synonyms: source.synonyms } : {}),
    ...(source.note ? { note: source.note } : {}),
    ...(typeof value.marked === 'boolean' ? { marked: value.marked } : {}),
    ...(firstString(value.color) ? { color: firstString(value.color) } : {}),
    createdAt: asNumber(value.createdAt, Date.now() + index),
    fsrs: normalizeFsrs(value.fsrs),
  };
}

function normalizeReviewLog(value: unknown): ReviewLogEntry[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry): ReviewLogEntry[] => {
    if (!isRecord(entry)) return [];
    const cardId = firstString(entry.cardId);
    const deckId = firstString(entry.deckId);
    const rating = asNumber(entry.rating, 0);
    const reviewedAt = asNumber(entry.reviewedAt, 0);
    if (!cardId || !deckId || ![1, 2, 3, 4].includes(rating) || reviewedAt <= 0) return [];
    return [
      {
        cardId,
        deckId,
        rating: rating as Rating,
        reviewedAt,
        elapsedMs: Math.max(0, asNumber(entry.elapsedMs, 0)),
        ...(entry.cardWasNew === undefined ? {} : { cardWasNew: entry.cardWasNew === true }),
        ...(entry.stateBefore === 'New' ||
        entry.stateBefore === 'Learning' ||
        entry.stateBefore === 'Review' ||
        entry.stateBefore === 'Relearning'
          ? { stateBefore: entry.stateBefore }
          : {}),
        ...(isRecord(entry.fsrs)
          ? { fsrs: entry.fsrs as NonNullable<ReviewLogEntry['fsrs']> }
          : {}),
      },
    ];
  });
}

function normalizeGameRecords(value: unknown): Record<string, GameRecord> {
  if (!isRecord(value)) return {};
  const records: Record<string, GameRecord> = {};
  for (const [key, raw] of Object.entries(value)) {
    if (!isRecord(raw)) continue;
    const deckId = firstString(raw.deckId) ?? key;
    if (!deckId) continue;
    records[deckId] = {
      deckId,
      bestScore: Math.max(0, asNumber(raw.bestScore, 0)),
      bestCombo: Math.max(0, asNumber(raw.bestCombo, 0)),
      plays: Math.max(0, asNumber(raw.plays, 0)),
      lastPlayedAt: Math.max(0, asNumber(raw.lastPlayedAt, 0)),
    };
  }
  return records;
}

function parseBackup(raw: UnknownRecord, cardsByDeckRaw: UnknownRecord): ParseResult {
  const warnings: string[] = [];
  const decks: Deck[] = [];
  const usedDeckIds = new Set<string>();

  for (const [index, value] of (raw.decks as unknown[]).entries()) {
    const deck = normalizeBackupDeck(value);
    if (!deck) {
      warnings.push(`Deck ${index + 1} was skipped: id and name are required.`);
      continue;
    }
    if (usedDeckIds.has(deck.id)) {
      warnings.push(`Deck ${deck.name} was skipped: duplicate id.`);
      continue;
    }
    usedDeckIds.add(deck.id);
    decks.push(deck);
  }

  if (decks.length === 0) {
    return { ok: false, error: 'This backup has no readable decks.' };
  }

  const cardsByDeck: Record<string, Flashcard[]> = {};
  const usedCardIds = new Set<string>();
  let skippedCards = 0;
  let totalCards = 0;

  for (const deck of decks) {
    const list = cardsByDeckRaw[deck.id];
    if (!Array.isArray(list)) {
      cardsByDeck[deck.id] = [];
      continue;
    }
    if (totalCards + list.length > IMPORT_MAX_CARDS) {
      return {
        ok: false,
        error: `This backup has more than ${IMPORT_MAX_CARDS.toLocaleString('en-US')} cards.`,
      };
    }
    const cards = list.flatMap((value, index): Flashcard[] => {
      const card = normalizeBackupCard(value, deck.id, index, usedCardIds);
      if (!card) {
        skippedCards += 1;
        return [];
      }
      totalCards += 1;
      return [card];
    });
    cardsByDeck[deck.id] = cards;
  }

  if (skippedCards > 0) {
    warnings.push(`${skippedCards} card${skippedCards === 1 ? ' was' : 's were'} skipped because front or back was missing.`);
  }

  const folders = Array.isArray(raw.folders)
    ? raw.folders.flatMap((value): DeckFolder[] => {
        const folder = normalizeBackupFolder(value);
        return folder ? [folder] : [];
      })
    : [];
  const reviewLog = normalizeReviewLog(raw.reviewLog);
  const gameRecords = normalizeGameRecords(raw.gameRecords);

  return {
    ok: true,
    value: {
      kind: 'backup',
      decks,
      folders,
      cardsByDeck,
      reviewLog,
      gameRecords,
      ...(isRecord(raw.settings) ? { settings: raw.settings as Settings } : {}),
      warnings,
    },
  };
}

function parseJson(raw: unknown): ParseResult {
  if (Array.isArray(raw)) {
    return cardsImport(raw, DEFAULT_IMPORT_DECK_NAME, undefined, 'JSON');
  }
  if (!isRecord(raw)) {
    return { ok: false, error: 'JSON must be a card list, a deck export, or a full backup.' };
  }

  if (Array.isArray(raw.decks) && isRecord(raw.cardsByDeck)) {
    return parseBackup(raw, raw.cardsByDeck);
  }

  if (Array.isArray(raw.cards)) {
    return cardsImport(
      raw.cards,
      deckNameFrom(raw),
      deckDescriptionFrom(raw),
      'JSON'
    );
  }

  const single = normalizeImportCard(raw);
  if (single) {
    return {
      ok: true,
      value: {
        kind: 'cards',
        deckName: deckNameFrom(raw),
        cards: [single],
        warnings: [],
      },
    };
  }

  return {
    ok: false,
    error: 'No cards found. A card needs a front and a back.',
  };
}

const FRONT_HEADERS = [
  'front',
  'front_text',
  'fronttext',
  'prompt',
  'question',
  'term',
  'word',
  'source',
  'german',
  'expression',
];
const BACK_HEADERS = [
  'back',
  'back_text',
  'backtext',
  'answer',
  'definition',
  'translation',
  'target',
  'persian',
  'meaning',
  'response',
];
const EXAMPLE_HEADERS = ['example', 'example_sentence', 'sentence'];
const NOTE_HEADERS = ['note', 'notes', 'hint'];
const SYNONYM_HEADERS = ['synonyms', 'synonym'];
const FRONT_DIRECTION_HEADERS = ['front_direction', 'frontdirection', 'direction_front'];
const BACK_DIRECTION_HEADERS = ['back_direction', 'backdirection', 'direction_back'];

const normalizeHeader = (value: string): string =>
  value.trim().toLowerCase().replace(/[\s-]+/g, '_');

const findHeader = (headers: string[], aliases: string[]): number =>
  headers.findIndex((header) => aliases.includes(header));

function countOutsideQuotes(line: string, character: string): number {
  let count = 0;
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const current = line[index];
    if (current === '"') quoted = !quoted;
    else if (!quoted && current === character) count += 1;
  }
  return count;
}

function detectDelimiter(firstLine: string): string {
  const comma = countOutsideQuotes(firstLine, ',');
  const tab = countOutsideQuotes(firstLine, '\t');
  const semicolon = countOutsideQuotes(firstLine, ';');
  if (tab >= comma && tab >= semicolon && tab > 0) return '\t';
  if (semicolon > comma && semicolon > tab) return ';';
  return ',';
}

function readDelimited(
  text: string,
  delimiter: string
): { rows: string[][]; error?: string } {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        field += character;
      }
      continue;
    }

    if (character === '"') {
      quoted = true;
    } else if (character === delimiter) {
      row.push(field);
      field = '';
    } else if (character === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (character === '\r') {
      if (text[index + 1] === '\n') index += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += character;
    }
  }

  if (quoted) return { rows: [], error: 'The file has an unclosed quote.' };
  row.push(field);
  rows.push(row);
  return { rows: rows.filter((cells) => cells.some((cell) => cell.trim() !== '')) };
}

function parseDelimited(text: string): ParseResult {
  const clean = text.replace(/^\uFEFF/, '');
  const firstLine = clean.split(/\r?\n/, 1)[0] ?? '';
  const delimiter = detectDelimiter(firstLine);
  const { rows, error } = readDelimited(clean, delimiter);
  if (error) return { ok: false, error };

  if (rows.length === 0) {
    return { ok: false, error: 'No rows found. Paste a CSV or TSV with at least one card.' };
  }

  const headers = rows[0].map(normalizeHeader);
  const frontIndex = findHeader(headers, FRONT_HEADERS);
  const backIndex = findHeader(headers, BACK_HEADERS);
  const hasHeader = frontIndex >= 0 && backIndex >= 0;
  const exampleIndex = findHeader(headers, EXAMPLE_HEADERS);
  const noteIndex = findHeader(headers, NOTE_HEADERS);
  const synonymIndex = findHeader(headers, SYNONYM_HEADERS);
  const frontDirectionIndex = findHeader(headers, FRONT_DIRECTION_HEADERS);
  const backDirectionIndex = findHeader(headers, BACK_DIRECTION_HEADERS);
  const directionIndex = headers.indexOf('direction');
  const cards: ImportCard[] = [];
  const warnings: string[] = [];

  for (let index = hasHeader ? 1 : 0; index < rows.length; index += 1) {
    const cells = rows[index];
    const rowNumber = index + 1;
    const front = (cells[hasHeader ? frontIndex : 0] ?? '').trim();
    const back = (cells[hasHeader ? backIndex : 1] ?? '').trim();
    if (!front && !back) continue;
    if (!front || !back) {
      warnings.push(`Row ${rowNumber} was skipped: front and back are required.`);
      continue;
    }
    if (cards.length >= IMPORT_MAX_CARDS) {
      warnings.push(`Only the first ${IMPORT_MAX_CARDS.toLocaleString('en-US')} cards were read.`);
      break;
    }

    const frontDirection =
      readDirection(cells[frontDirectionIndex]) ??
      readDirection(cells[directionIndex]) ??
      textDirection(front);
    const backDirection =
      readDirection(cells[backDirectionIndex]) ??
      readDirection(cells[directionIndex]) ??
      textDirection(back);
    const example = exampleIndex >= 0 ? cells[exampleIndex]?.trim() : '';
    const note = noteIndex >= 0 ? cells[noteIndex]?.trim() : '';
    const synonyms = synonymIndex >= 0 ? cells[synonymIndex]?.trim() : '';

    cards.push({
      front,
      back,
      frontDirection,
      backDirection,
      ...(example ? { example } : {}),
      ...(note ? { note } : {}),
      ...(synonyms ? { synonyms } : {}),
    });
  }

  if (cards.length === 0) {
    return {
      ok: false,
      error: warnings[0] ?? 'No cards found. Each row needs a front and a back.',
    };
  }

  return {
    ok: true,
    value: {
      kind: 'cards',
      deckName: DEFAULT_IMPORT_DECK_NAME,
      cards,
      warnings,
    },
  };
}

/**
 * Parse a pasted file or textarea value.
 *
 * JSON is identified by its first non-space character. A malformed JSON object
 * is reported as JSON rather than retried as CSV, so a broken backup cannot be
 * mistaken for a one-column spreadsheet. Everything else is delimiter-separated
 * text with an optional header row.
 */
export function parseImport(text: string): ParseResult {
  const input = text.replace(/^\uFEFF/, '').trim();
  if (!input) return { ok: false, error: 'Paste some data or choose a file first.' };

  if (input.startsWith('{') || input.startsWith('[')) {
    try {
      return parseJson(JSON.parse(input) as unknown);
    } catch {
      return { ok: false, error: 'That looks like JSON, but it could not be read.' };
    }
  }

  return parseDelimited(input);
}
