# Library Quiz Game — Design

Date: 2026-11-01
Status: approved

## Problem

The Library is a management screen: search, category chips, deck list. There is no
reason to open it for fun, and the only way to review is the full study session.
We want a fast, arcade-feeling way to review that starts from the Library, keeps the
user's real FSRS progress honest, and does not disturb the existing study flow.

## Scope

In scope:

- A "Quiz" start card at the top of the Library.
- A 60-second timed multiple-choice game at `/quiz/[deckId]`.
- Correct answers and wrong answers written as real FSRS reviews.
- Best score / best combo persisted per deck.
- Sound, haptics and motion effects, each gated by a setting.
- Pure game logic in `data/quiz.ts` with unit tests.

Out of scope:

- New deck or card data fields beyond a `GameRecord` collection.
- Leaderboards, sharing, multiplayer, daily quests.
- Changing the study session, scheduler or FSRS parameters.
- Native-only effects that need a custom build (no new native modules beyond
  `expo-audio` and `expo-haptics`).

## Decisions

| Question | Decision |
| --- | --- |
| What is "game" | A game mode inside Library, not a gamified list |
| Game type | 4-option timed quiz |
| Card source | One deck chosen by the user (default: the deck with the most due cards) |
| Round length | 60 seconds, correct answers add time, combo multiplier |
| FSRS coupling | Every answer is a real review: correct = `Good (3)`, wrong = `Again (1)` |
| Entry point | A start card at the top of Library |
| Effects | Full: motion, sound, haptics, all opt-out in Settings |

## Mechanics

### Question

A question shows one card's `front.text` and four options built from `back.text`:

- one correct option (the card's own back),
- three distractors taken from other cards in the same deck,
- option texts are unique and non-empty,
- order is shuffled.

A card appears at most once per round. A deck with fewer than 4 cards that have a
non-empty `front.text` and `back.text` is not playable; the start card explains why.

### Timer and score

- Round starts at 60s. The timer only runs while a question is on screen and the
  round is active.
- Correct: `+3s`, score `+= 100 × min(combo, 5)`, combo `+= 1`.
- Wrong: `−2s`, combo resets to 0, the correct option is revealed for 700ms.
- Timer reaching 0 ends the round.
- Exhausting the card pool ends the round early with a `+250` "deck cleared" bonus.
- `bestCombo` is the highest combo reached in the round; `bestScore` is the round
  score, stored per deck when it beats the previous best.

### Review logging

For each answered question, in this order:

1. `scheduler.schedule(card, rating, new Date(now))` with `rating = 3` (correct) or
   `1` (wrong).
2. `useDeckStore.updateCard(card.id, { fsrs: updatedCard.fsrs })`.
3. `useReviewStore.logReview({ cardId, deckId, rating, reviewedAt: now,
   elapsedMs: now - questionShownAt, cardWasNew: card.fsrs.state === 'New',
   fsrs: log })`.

Daily new/review caps from `buildStudyQueue` are deliberately not applied: the game
is practice, and the scheduler's own state remains authoritative.

## Data

### `GameRecord`

```ts
export type GameRecord = {
  deckId: string;
  bestScore: number;
  bestCombo: number;
  plays: number;
  lastPlayedAt: number; // epoch ms
};
```

Persisted as a `Record<string, GameRecord>` keyed by deck id under
`memory:gameRecords` through `data/repository.ts`
(`loadGameRecords`, `saveGameRecords`).

### Settings

Two new boolean settings, both default `true`:

- `soundEnabled`
- `hapticsEnabled`

Stored with the existing `Settings` shape; exposed as `ToggleSwitch` rows in a new
"Game" section on the Settings screen.

## Pure logic — `data/quiz.ts`

```ts
export const ROUND_MS = 60_000;
export const CORRECT_BONUS_MS = 3_000;
export const WRONG_PENALTY_MS = 2_000;
export const CLEAR_BONUS_POINTS = 250;
export const COMBO_CAP = 5;

export function isDeckPlayable(cards: Flashcard[]): boolean;
export function buildQuestion(card, cards, rng): Question | null;
export function buildRound(cards, rng): Question[];
export function scoreForAnswer(combo: number): number;
export function applyAnswer(state, isCorrect): RoundState;
export function nextQuestion(round, index): { question, index, cleared };
```

`rng` is injected (`() => number`, default `Math.random`) so tests are deterministic.
All functions are pure and framework-free.

## UI

### Start card — `components/QuizStartCard.tsx`

Placed at the top of the Library content, above the search bar.

- Label `QUIZ · 60s`, headline `Beat the clock`, one-line subtitle.
- Best-score pill when the selected deck has a record.
- Horizontal row of deck chips (`Chip variant="select"`), only playable decks,
  default selection = deck with the most due cards, else first playable deck.
- Full-width `Play` button (`play-arrow`). Disabled with an explanatory line when
  no deck is playable.
- Composition only from `GlassCard`, `Chip`, `Button`, `Pill`, `AppText`.

### Game screen — `app/quiz/[deckId].tsx`

A stack route outside `(tabs)`, so the tab bar is absent.

- Top row: close `IconButton`, deck name, question counter, score (animated pop).
- Timer: 3px track (`bg-fill-track`) with animated width; `warning` colour under 10s.
- Question pane: `GlassCard` with the card's front text, `writingDirection` taken
  from `front.direction`.
- Answers: 2×2 grid of `QuizAnswer` (new component). States: idle, correct, wrong,
  dimmed. Minimum 64px tall, `accessibilityRole="button"`, and a check/cross glyph
  so colour is not the only signal.
- Combo pill (`×3`) that scales in on each correct answer and disappears at 0.
- Result overlay on the same screen: score, `New best` badge, accuracy, correct /
  wrong counts, best combo, `Play again` and `Back to Library`.

### Effects

- Motion uses `motion/` helpers only (`useReveal`, `timingTo`, `springTo`), so
  reduce-motion is honoured automatically.
- Sound uses `expo-audio` with four generated WAV files under `assets/sfx/`
  (`correct`, `wrong`, `combo`, `end`), produced by `scripts/make-sfx.mjs`.
  Playback is `seekTo(0)` then `play()`; every playback error is swallowed.
- Haptics use `expo-haptics`: success/error notifications, medium impact at combo
  ≥ 3, heavy impact at round end. Guarded off on web and when disabled.
- Both are skipped when the corresponding setting is off.

## Error handling

- Unknown `deckId`, deck deleted mid-round, or a deck that became unplayable:
  the screen renders an `EmptyState` with a `Back to Library` action.
- Audio or haptics failing never interrupts the round.
- A storage failure writing the record does not block `Play again`; the store keeps
  the in-memory best.
- `scheduler.schedule` throwing for a malformed legacy card: the answer still scores
  and advances, the review is skipped, and the card is not mutated.

## Testing

- `data/quiz.test.ts` (runs under `npm test`):
  - 4 unique options, correct one present, deterministic with a seeded RNG.
  - Cards with empty sides are excluded; decks below 4 playable cards are rejected.
  - Score math with combo cap.
  - Time math: +3s, −2s, clamp at 0, round ends at 0.
  - Pool exhaustion reports `cleared` and adds the bonus once.
- Manual: `npm run check:design`, `npx tsc --noEmit`, then a real round in the web
  preview: score changes, timer ends the round, due count on Home changes, and the
  review log gains one entry per answer.

## Files

New:

- `data/quiz.ts`, `data/quiz.test.ts`
- `store/useGameStore.ts`
- `components/QuizStartCard.tsx`, `components/QuizAnswer.tsx`
- `app/quiz/[deckId].tsx`
- `scripts/make-sfx.mjs`, `assets/sfx/*.wav`

Changed:

- `data/types.ts` (`GameRecord`, two settings fields)
- `data/repository.ts` (game records)
- `store/useSettingsStore.ts` (defaults)
- `app/(tabs)/library.tsx` (start card)
- `app/(tabs)/settings.tsx` (Game section)
- `app/_layout.tsx` (load the game store)
- `package.json` (`expo-audio`, `expo-haptics`)
