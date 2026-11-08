import test from 'node:test';
import assert from 'node:assert/strict';
import { parseImport } from './importData';

const cardsFrom = (text: string) => {
  const result = parseImport(text);
  if (!result.ok) throw new Error(result.error);
  assert.equal(result.value.kind, 'cards');
  if (result.value.kind !== 'cards') throw new Error('expected a card import');
  return result.value;
};

test('CSV with a header keeps quoted commas and optional columns', () => {
  const value = cardsFrom(
    'front,back,example,note\n"Haus, das",house,"Das Haus ist groß.",noun\ndie Katze,cat,,\n'
  );
  assert.equal(value.cards.length, 2);
  assert.equal(value.cards[0]?.front, 'Haus, das');
  assert.equal(value.cards[0]?.back, 'house');
  assert.equal(value.cards[0]?.example, 'Das Haus ist groß.');
  assert.equal(value.cards[0]?.note, 'noun');
  assert.equal(value.cards[1]?.note, undefined);
  assert.equal(value.cards[1]?.frontDirection, 'ltr');
  assert.equal(value.cards[1]?.backDirection, 'ltr');
});

test('TSV without a header uses the first two columns', () => {
  const value = cardsFrom('Hallo\thello\nسلام\thello\n');
  assert.equal(value.cards.length, 2);
  assert.equal(value.cards[1]?.front, 'سلام');
  assert.equal(value.cards[1]?.frontDirection, 'rtl');
  assert.equal(value.cards[1]?.backDirection, 'ltr');
});

test('a JSON deck export keeps its name and cards', () => {
  const value = cardsFrom(
    JSON.stringify({
      deck: { name: 'French basics', description: 'First words' },
      cards: [
        { front: 'oui', back: 'yes' },
        { front: 'non', back: 'no', example: 'Non, merci.' },
      ],
    })
  );
  assert.equal(value.deckName, 'French basics');
  assert.equal(value.description, 'First words');
  assert.equal(value.cards.length, 2);
  assert.equal(value.cards[1]?.example, 'Non, merci.');
});

test('a full backup preserves decks, folders, cards and review history', () => {
  const backup = {
    format: 'memora-backup',
    version: 1,
    decks: [{ id: 'deck-fr', name: 'French' }],
    folders: [{ id: 'fold-fr', name: 'Languages', parentId: null }],
    cardsByDeck: {
      'deck-fr': [
        { id: 'card-1', front: 'oui', back: 'yes' },
        { id: 'card-2', front: 'non', back: 'no', fsrs: { state: 'Review', stability: 3 } },
      ],
    },
    reviewLog: [
      {
        cardId: 'card-1',
        deckId: 'deck-fr',
        rating: 3,
        reviewedAt: 123,
        elapsedMs: 900,
        fsrs: {
          rating: 3,
          state: 'Review',
          due: '2026-11-08T00:00:00.000Z',
          stability: 4,
          difficulty: 5,
          elapsedDays: 2,
          lastElapsedDays: 2,
          scheduledDays: 4,
          learningStep: 0,
          review: 123,
        },
      },
    ],
    gameRecords: { 'deck-fr': { deckId: 'deck-fr', bestScore: 9, bestCombo: 3, plays: 2 } },
    settings: { ttsEnabled: false },
  };
  const result = parseImport(JSON.stringify(backup));
  if (!result.ok) throw new Error(result.error);
  if (result.value.kind !== 'backup') throw new Error('expected a backup');
  assert.equal(result.value.decks.length, 1);
  assert.equal(result.value.decks[0]?.name, 'French');
  assert.equal(result.value.folders.length, 1);
  assert.equal(result.value.cardsByDeck['deck-fr']?.length, 2);
  assert.equal(result.value.cardsByDeck['deck-fr']?.[1]?.fsrs.state, 'Review');
  assert.equal(result.value.reviewLog.length, 1);
  assert.equal(result.value.reviewLog[0]?.fsrs?.stability, 4);
  assert.equal(result.value.gameRecords['deck-fr']?.bestScore, 9);
  assert.equal(result.value.settings?.ttsEnabled, false);
});

test('malformed JSON is reported instead of being read as a spreadsheet', () => {
  const result = parseImport('{"cards": [');
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.error, /JSON/i);
});

test('a header-only CSV has no cards', () => {
  const result = parseImport('front,back\n');
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.error, /No cards|Row 2/);
});

test('rows missing a side are skipped with a warning', () => {
  const value = cardsFrom('front,back\nHallo,\nGoodbye,Tschüss\n');
  assert.equal(value.cards.length, 1);
  assert.equal(value.warnings.length, 1);
  assert.match(value.warnings[0], /front and back/);
});
