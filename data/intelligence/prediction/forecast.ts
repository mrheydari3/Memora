/**
 * Predictive intelligence.
 *
 * Three different kinds of "prediction" live here, kept apart on purpose:
 *
 *   1. Scheduled workload — an exact count of cards by due date. Deterministic.
 *   2. Volume / backlog forecast — a statistical projection from observed
 *      reviews, with a prediction interval, assumptions and limitations.
 *   3. Retention at next due — an FSRS model estimate R(due) per card.
 *
 * Nothing is produced without the evidence gate. When the gate fails the
 * forecast says `insufficient_data` and the UI prints the requirement instead of
 * a number.
 */

import type { Deck, Flashcard } from '../../types';
import type {
  BacklogForecast,
  ForecastBundle,
  NormalizedReview,
  RetentionForecast,
  VolumeForecast,
  WorkloadDay,
  WorkloadForecast,
} from '../core/types';
import { addDays, dayLabel, startOfDay } from '../core/dates';
import {
  BACKLOG_SAMPLE_DAYS,
  FORECAST_SAMPLE_DAYS,
  MIN_BACKLOG_NEW_CARDS,
  MIN_FORECAST_ACTIVE_DAYS,
  MIN_FORECAST_DAYS,
  MIN_FORECAST_REVIEWS,
  Z_80,
} from '../core/constants';
import { confidenceFor, standardDeviation } from '../core/stats';
import { buildDailyValues, reviewsInRange } from '../analysis/series';
import { createFSRSScheduler } from '../../schedulers/fsrs';
import { resolveFsrsParams } from '../../fsrs-params';

const VOLUME_ASSUMPTIONS = [
  'Your average daily review rate over the last four weeks continues.',
  'Every calendar day counts, including days with no reviews.',
  'The estimate is for reviews, not unique cards.',
];

const VOLUME_LIMITATIONS = [
  'Daily reviews are not independent: streaks and catch-up days widen the real error.',
  'A change in deck settings, daily caps or available time is not modelled.',
  'The 80% interval is a guide, not a guarantee.',
];

function volumeForecast(
  reviews: readonly NormalizedReview[],
  now: number,
  horizonDays: number
): VolumeForecast {
  const end = startOfDay(now);
  const start = addDays(end, -(FORECAST_SAMPLE_DAYS - 1));
  const { values, total, activeDays } = buildDailyValues(reviews, start, end);
  const sampleDays = values.length;

  if (
    sampleDays < MIN_FORECAST_DAYS ||
    total < MIN_FORECAST_REVIEWS ||
    activeDays < MIN_FORECAST_ACTIVE_DAYS
  ) {
    return {
      status: 'insufficient_data',
      horizonDays,
      method: 'Mean daily reviews with an 80% prediction interval',
      expectedReviews: null,
      expectedPerDay: null,
      interval: null,
      sampleDays,
      sampleReviews: total,
      activeDays,
      confidence: {
        level: 'insufficient',
        score: 0.1,
        sampleSize: total,
        rationale: `Needs ${MIN_FORECAST_DAYS} days, ${MIN_FORECAST_REVIEWS} reviews and ${MIN_FORECAST_ACTIVE_DAYS} active days; this window has ${sampleDays} days, ${total} reviews and ${activeDays} active days.`,
      },
      assumptions: VOLUME_ASSUMPTIONS,
      limitations: VOLUME_LIMITATIONS,
    };
  }

  const perDay = total / sampleDays;
  const sd = standardDeviation(values) ?? 0;
  const expectedReviews = perDay * horizonDays;
  const margin = Z_80 * sd * Math.sqrt(horizonDays);

  return {
    status: 'ok',
    horizonDays,
    method: 'Mean daily reviews with an 80% prediction interval',
    expectedReviews,
    expectedPerDay: perDay,
    interval: {
      low: Math.max(0, expectedReviews - margin),
      high: expectedReviews + margin,
      level: 0.8,
    },
    sampleDays,
    sampleReviews: total,
    activeDays,
    confidence: confidenceFor(total, null, 'reviews in the forecast window'),
    assumptions: VOLUME_ASSUMPTIONS,
    limitations: VOLUME_LIMITATIONS,
  };
}

function workloadForecast(
  decks: readonly Deck[],
  cardsByDeck: Record<string, Flashcard[]>,
  now: number
): WorkloadForecast {
  const today = startOfDay(now);
  const daily: WorkloadDay[] = Array.from({ length: 7 }, (_, index) => {
    const day = addDays(today, index);
    return { dayStart: day, label: dayLabel(day), count: 0 };
  });

  let overdue = 0;
  let dueToday = 0;
  let next7 = 0;
  let next30 = 0;
  let next90 = 0;
  let scheduledCards = 0;
  const byDeck: WorkloadForecast['byDeck'] = [];

  for (const deck of decks) {
    const cards = cardsByDeck[deck.id] ?? [];
    let deckOverdue = 0;
    let deckNext7 = 0;

    for (const card of cards) {
      // New cards are not scheduled work: they are introduced by the daily cap,
      // not by a due date, and counting them would triple today's workload.
      if (card.fsrs.state === 'New') continue;
      const dueAt = new Date(card.fsrs.due).getTime();
      if (!Number.isFinite(dueAt)) continue;

      scheduledCards += 1;
      const dueDay = startOfDay(dueAt);
      if (dueDay < today) {
        overdue += 1;
        deckOverdue += 1;
      } else if (dueDay === today) {
        dueToday += 1;
      }

      if (dueDay >= today && dueDay <= addDays(today, 6)) {
        next7 += 1;
        deckNext7 += 1;
        const index = Math.round((dueDay - today) / 86_400_000);
        if (index >= 0 && index < daily.length) daily[index].count += 1;
      }
      if (dueDay >= today && dueDay <= addDays(today, 29)) next30 += 1;
      if (dueDay >= today && dueDay <= addDays(today, 89)) next90 += 1;
    }

    if (deckOverdue > 0 || deckNext7 > 0) {
      byDeck.push({ deckId: deck.id, name: deck.name, overdue: deckOverdue, next7: deckNext7 });
    }
  }

  byDeck.sort((a, b) => b.overdue - a.overdue || b.next7 - a.next7);

  return {
    status: scheduledCards === 0 ? 'empty' : 'ok',
    overdue,
    dueToday,
    next7,
    next30,
    next90,
    daily,
    byDeck,
    scheduledCards,
  };
}

function backlogForecast(
  decks: readonly Deck[],
  cardsByDeck: Record<string, Flashcard[]>,
  reviews: readonly NormalizedReview[],
  now: number
): BacklogForecast {
  const end = startOfDay(now);
  const start = addDays(end, -(BACKLOG_SAMPLE_DAYS - 1));
  const window = reviewsInRange(reviews, start, end);
  const windowDays = BACKLOG_SAMPLE_DAYS;

  const introduced = new Set(
    window.filter((review) => review.cardWasNew).map((review) => review.cardId)
  );
  const remainingNewCards = decks.reduce(
    (total, deck) =>
      total + (cardsByDeck[deck.id] ?? []).filter((card) => card.fsrs.state === 'New').length,
    0
  );

  const assumptions = [
    'Your recent rate of introducing new cards continues.',
    'Only cards that are still New are counted as backlog.',
  ];
  const limitations = [
    'Daily new-card caps and changes to deck settings are not modelled.',
    'A pause or a burst of new cards will move the real finish date.',
  ];

  if (remainingNewCards === 0) {
    return {
      status: 'empty',
      remainingNewCards: 0,
      newPerWeek: null,
      weeks: null,
      interval: null,
      sampleNewCards: introduced.size,
      confidence: confidenceFor(introduced.size, null, 'new cards introduced'),
      assumptions,
      limitations,
    };
  }

  if (windowDays < 14 || introduced.size < MIN_BACKLOG_NEW_CARDS) {
    return {
      status: 'insufficient_data',
      remainingNewCards,
      newPerWeek: null,
      weeks: null,
      interval: null,
      sampleNewCards: introduced.size,
      confidence: {
        level: 'insufficient',
        score: 0.1,
        sampleSize: introduced.size,
        rationale: `Needs ${MIN_BACKLOG_NEW_CARDS} new cards introduced in the last 28 days; found ${introduced.size}.`,
      },
      assumptions,
      limitations,
    };
  }

  const weeksObserved = windowDays / 7;
  const perWeek = introduced.size / weeksObserved;
  const weeks = remainingNewCards / perWeek;

  // Poisson-style uncertainty on the observed count, propagated to the rate.
  const standardError = 1.96 * Math.sqrt(introduced.size);
  const lowRate = Math.max(0.1, (introduced.size - standardError) / weeksObserved);
  const highRate = (introduced.size + standardError) / weeksObserved;

  return {
    status: 'ok',
    remainingNewCards,
    newPerWeek: perWeek,
    weeks,
    interval: {
      low: remainingNewCards / highRate,
      high: remainingNewCards / lowRate,
      level: 0.95,
    },
    sampleNewCards: introduced.size,
    confidence: confidenceFor(introduced.size, null, 'new cards introduced'),
    assumptions,
    limitations,
  };
}

function retentionForecast(
  decks: readonly Deck[],
  cardsByDeck: Record<string, Flashcard[]>,
  now: number
): RetentionForecast {
  const horizonDays = 7;
  const horizonEnd = addDays(startOfDay(now), horizonDays);
  const fsrsDecks = decks.filter((deck) => deck.algorithmPreset === 'fsrs');

  let dueCards = 0;
  let sum = 0;
  let thresholdSum = 0;

  for (const deck of fsrsDecks) {
    const scheduler = createFSRSScheduler(deck);
    thresholdSum += resolveFsrsParams(deck).requestRetention;

    for (const card of cardsByDeck[deck.id] ?? []) {
      if (card.fsrs.state !== 'Review' && card.fsrs.state !== 'Relearning') continue;
      if (card.fsrs.stability <= 0) continue;
      const dueAt = new Date(card.fsrs.due).getTime();
      if (!Number.isFinite(dueAt) || dueAt > horizonEnd) continue;

      // R at the card's own scheduled due date — the model's recall probability
      // for that moment, not the probability today and not measured retention.
      const retrievability = scheduler.getRetrievability(card, new Date(dueAt));
      if (retrievability === null) continue;
      dueCards += 1;
      sum += retrievability;
    }
  }

  const desiredRetention = fsrsDecks.length > 0 ? thresholdSum / fsrsDecks.length : null;
  const status: RetentionForecast['status'] =
    fsrsDecks.length === 0 || dueCards === 0
      ? 'empty'
      : dueCards < 10
        ? 'insufficient_data'
        : 'ok';

  return {
    status,
    horizonDays,
    dueCards,
    meanPredictedRetrievability: dueCards > 0 ? sum / dueCards : null,
    desiredRetention,
    confidence: confidenceFor(dueCards, null, 'cards due in the next 7 days'),
    note: 'FSRS-predicted recall probability at each card’s scheduled due date. A model estimate — not a measured retention rate.',
  };
}

export function analyzeForecast(params: {
  decks: readonly Deck[];
  cardsByDeck: Record<string, Flashcard[]>;
  reviews: readonly NormalizedReview[];
  allReviews: readonly NormalizedReview[];
  now: number;
}): ForecastBundle {
  const { decks, cardsByDeck, allReviews, now } = params;

  return {
    workload: workloadForecast(decks, cardsByDeck, now),
    volume: {
      seven: volumeForecast(allReviews, now, 7),
      thirty: volumeForecast(allReviews, now, 30),
      ninety: volumeForecast(allReviews, now, 90),
    },
    backlog: backlogForecast(decks, cardsByDeck, allReviews, now),
    retention: retentionForecast(decks, cardsByDeck, now),
  };
}
