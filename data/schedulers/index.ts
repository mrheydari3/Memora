/**
 * Scheduler dispatcher — selects the right SchedulerEngine based on
 * `deck.algorithmPreset`.
 *
 * FSRS is the default (and the only algorithm that is actively developed
 * here); SM-2 stays available for decks created with it, and Fast Repetition
 * is a no-schedule drill mode.
 */

import type { Deck, SchedulerEngine } from '../types';
import { createFSRSScheduler } from './fsrs';
import { createSM2Scheduler } from './sm2';
import { fastScheduler } from './fast';

export function getSchedulerForDeck(deck: Deck): SchedulerEngine {
  switch (deck.algorithmPreset) {
    case 'fast':
      return fastScheduler;
    case 'general':
      return createSM2Scheduler(deck);
    case 'fsrs':
    default:
      return createFSRSScheduler(deck);
  }
}
