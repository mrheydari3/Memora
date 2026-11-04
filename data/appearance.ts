/**
 * The icons a deck or a folder can wear.
 *
 * Languages come first because that is what most of this library holds: a
 * German deck, a French folder, a pronunciation deck. Subjects follow, so a
 * folder for law or biology still finds a glyph that means it. Every name exists
 * in the MaterialIcons glyph map, which is also why the list is explicit instead
 * of generated — a name that is not there renders as an empty box.
 */

export const LANGUAGE_ICONS = [
  'language',
  'translate',
  'g-translate',
  'spellcheck',
  'abc',
  'text-fields',
  'text-snippet',
  'format-quote',
  'record-voice-over',
  'headphones',
  'mic',
  'volume-up',
  'hearing',
  'closed-caption',
  'subtitles',
  'podcasts',
  'radio',
  'graphic-eq',
  'speaker',
  'menu-book',
  'article',
  'edit-note',
  'forum',
  'chat',
  'public',
  'flag',
  'signpost',
  'local-library',
  'history-edu',
  'keyboard',
  'font-download',
] as const;

export const SUBJECT_ICONS = [
  'folder',
  'school',
  'science',
  'biotech',
  'calculate',
  'functions',
  'psychology',
  'architecture',
  'engineering',
  'business-center',
  'medical-services',
  'gavel',
  'terminal',
  'code',
  'laptop',
  'palette',
  'brush',
  'draw',
  'music-note',
  'movie',
  'photo-camera',
  'theater-comedy',
  'sports-esports',
  'sports-soccer',
  'restaurant',
  'flight',
  'travel-explore',
  'pets',
  'lightbulb',
  'quiz',
  'auto-stories',
  'book',
  'library-books',
  'workspaces',
] as const;

export const ICON_CHOICES = [...LANGUAGE_ICONS, ...SUBJECT_ICONS] as const;

/** What a folder shows before anyone gives it its own icon. */
export const FOLDER_DEFAULT_ICON = 'folder';
