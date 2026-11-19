/**
 * Folder sessions reuse the deck session screen. This route only supplies the
 * `folderId` parameter that screen reads; the queue itself is built from every
 * active deck filed in the folder.
 */
export { default } from '../[deckId]';
