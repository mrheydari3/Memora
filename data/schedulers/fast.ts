/**
 * Fast Repetition scheduler.
 *
 * No long-term scheduling — cards are shuffled into a session queue.
 * Ratings only record to the review log for statistics but do not change
 * any due-date math. Buttons show no interval labels — just "Again/Hard/Good/Easy".
 */

import type { Rating, SchedulerEngine, IntervalPreviews, ScheduleResult } from '../types';

export const fastScheduler: SchedulerEngine = {
  getIntervalPreviews(_card): IntervalPreviews {
    // No interval previews in fast mode — empty labels tell the UI to
    // render plain Again/Hard/Good/Easy without the interval line.
    return [
      { rating: 1, label: '' },
      { rating: 2, label: '' },
      { rating: 3, label: '' },
      { rating: 4, label: '' },
    ];
  },

  schedule(card, rating): ScheduleResult {
    // Simple re-ordering: Again re-inserts near front, Easy near back.
    // We don't modify the card state — just return as-is.
    return {
      updatedCard: { ...card },
      intervalPreviewLabel: ['Again', 'Hard', 'Good', 'Easy'][rating - 1] ?? 'OK',
    };
  },
};