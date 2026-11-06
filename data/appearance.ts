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

/** The picker keeps the semantic split visible instead of flattening the list. */
export const ICON_GROUPS = [
  { key: 'language', label: 'Languages', icons: LANGUAGE_ICONS },
  { key: 'subject', label: 'Subjects', icons: SUBJECT_ICONS },
] as const;

export const ICON_CHOICES = [...LANGUAGE_ICONS, ...SUBJECT_ICONS] as const;

type IconChoice = (typeof ICON_CHOICES)[number];

/**
 * Words a learner may search for that are not in the Material icon name. They
 * stay separate from `iconLabel` so the visible and spoken names remain the
 * concise slug name while search still understands subjects such as math.
 * The exhaustive record makes a new icon fail type-checking until it has one.
 */
const ICON_ALIASES: Record<IconChoice, string> = {
  language: 'translation languages linguistics',
  translate: 'translation languages',
  'g-translate': 'translation languages google',
  spellcheck: 'spelling grammar writing proofreading',
  abc: 'alphabet letters writing literacy',
  'text-fields': 'typing text writing',
  'text-snippet': 'text note writing',
  'format-quote': 'quote quotation writing',
  'record-voice-over': 'audio voice speaking recording',
  headphones: 'audio listening',
  mic: 'audio microphone speaking recording',
  'volume-up': 'audio sound volume listening',
  hearing: 'audio listening',
  'closed-caption': 'caption captions video subtitles accessibility',
  subtitles: 'captions video translation',
  podcasts: 'audio podcast listening',
  radio: 'audio radio listening',
  'graphic-eq': 'audio equalizer sound music',
  speaker: 'audio sound listening',
  'menu-book': 'book reading study text',
  article: 'reading news writing text',
  'edit-note': 'writing note edit',
  forum: 'chat discussion community conversation',
  chat: 'chat conversation messages',
  public: 'world globe geography global',
  flag: 'country language',
  signpost: 'direction travel',
  'local-library': 'books reading library study',
  'history-edu': 'history school study',
  keyboard: 'typing keyboard input',
  'font-download': 'font typography download text',
  folder: 'organization files',
  school: 'education study learning',
  science: 'chemistry physics lab laboratory',
  biotech: 'biology medicine science lab',
  calculate: 'math mathematics arithmetic numbers calculator',
  functions: 'math mathematics formula algebra',
  psychology: 'mind brain mental',
  architecture: 'building design',
  engineering: 'mechanics tools',
  'business-center': 'business work office finance',
  'medical-services': 'medicine medical health doctor',
  gavel: 'law legal court justice',
  terminal: 'code programming developer',
  code: 'code programming developer software',
  laptop: 'computer code work',
  palette: 'art design color colour painting',
  brush: 'art design painting',
  draw: 'art drawing design',
  'music-note': 'music audio song sound',
  movie: 'film video cinema',
  'photo-camera': 'photo photography camera picture',
  'theater-comedy': 'theater theatre drama art performance',
  'sports-esports': 'sports games gaming esports',
  'sports-soccer': 'sports football soccer',
  restaurant: 'food dining',
  flight: 'travel plane',
  'travel-explore': 'travel explore adventure',
  pets: 'animals dog cat',
  lightbulb: 'ideas idea inspiration',
  quiz: 'test game questions',
  'auto-stories': 'reading books stories',
  book: 'reading study',
  'library-books': 'books reading library study',
  workspaces: 'work office organization',
};

/** A human-readable name for an icon slug, used by the chooser and its search. */
export function iconLabel(icon: string): string {
  return icon
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/** The visible name plus the words a learner is likely to search for. */
export function iconSearchText(icon: string): string {
  return `${iconLabel(icon)} ${ICON_ALIASES[icon as IconChoice] ?? ''}`.toLowerCase();
}

/** What a folder shows before anyone gives it its own icon. */
export const FOLDER_DEFAULT_ICON = 'folder';
