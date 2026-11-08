import type { Deck, Flashcard } from '../data/types';
import type { BackupImport, ImportCard } from '../data/importData';
import { DEFAULT_IMPORT_DECK_NAME } from '../data/importData';
import { FSRS_DEFAULTS } from '../data/fsrs-params';
import { defaultFSRSState } from '../data/seed';
import { textDirection } from '../data/text';
import * as repository from '../data/repository';
import { useDeckStore } from '../store/useDeckStore';
import { useGameStore } from '../store/useGameStore';
import { useReviewStore } from '../store/useReviewStore';
import { useSettingsStore } from '../store/useSettingsStore';
import { colors } from '../theme/tokens';

/**
 * Write side of the import flow.
 *
 * The parser owns shape; this module owns persistence. A card import creates a
 * new deck and never touches an existing deck's schedule. A backup import is a
 * full replacement, which is why the screen arms it before calling this.
 */

function deckIdForImport(now: number): string {
  return `deck-import-${now}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function importCardsToDeck(
  deckName: string,
  description: string | undefined,
  cards: ImportCard[]
): Promise<string> {
  if (cards.length === 0) throw new Error('No cards to import.');

  const now = Date.now();
  const deckId = deckIdForImport(now);
  const deck: Deck = {
    id: deckId,
    name: deckName.trim() || DEFAULT_IMPORT_DECK_NAME,
    ...(description ? { description } : {}),
    icon: 'file-download',
    color: colors.info,
    parentId: null,
    algorithmPreset: 'fsrs',
    newCardsPerDay: 20,
    maxCardsPerDay: 80,
    shuffleCards: true,
    adaptiveOrdering: true,
    learningSteps: ['12 hours', '1 day', '2 days', '3 days'],
    masteredIntervalMultiplier: 2.5,
    ...FSRS_DEFAULTS,
    createdAt: now,
    archivedAt: null,
    folderId: null,
    pinnedAt: null,
  };

  const flashcards: Flashcard[] = cards.map((card, index) => ({
    id: `card-import-${now}-${index + 1}`,
    deckId,
    front: {
      text: card.front,
      direction: card.frontDirection ?? textDirection(card.front),
    },
    back: {
      text: card.back,
      direction: card.backDirection ?? textDirection(card.back),
    },
    ...(card.example ? { example: card.example } : {}),
    ...(card.synonyms ? { synonyms: card.synonyms } : {}),
    ...(card.note ? { note: card.note } : {}),
    createdAt: now + index,
    fsrs: defaultFSRSState(),
  }));

  await useDeckStore.getState().addDeckWithCards(deck, flashcards);
  return deckId;
}

/**
 * Replace every collection with the backup's copy. The caller must have armed
 * this explicitly; there is no merge path because merging two review logs
 * without a stable device id would invent a history the user never studied.
 */
export async function replaceLibraryFromBackup(backup: BackupImport): Promise<void> {
  await repository.saveDecks(backup.decks);
  await repository.saveFolders(backup.folders);
  await repository.saveAllCards(backup.cardsByDeck);
  await repository.saveReviewLog(backup.reviewLog);
  await repository.saveGameRecords(backup.gameRecords);
  if (backup.settings) await repository.saveSettings(backup.settings);
  await repository.markInitialized();

  await Promise.all([
    useDeckStore.getState().load(),
    useReviewStore.getState().load(),
    useGameStore.getState().load(),
    useSettingsStore.getState().load(),
  ]);
}
