/**
 * SM-2 scheduler tests — the scheduler must honour the review instant it is
 * given and reject step text it cannot actually parse.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { createSM2Scheduler, isSM2StepValid } from './sm2';
import { defaultFSRSState } from '../seed';
import type { Deck, Flashcard } from '../types';

const NOW = new Date('2026-03-10T12:00:00Z');

function makeDeck(overrides: Partial<Deck> = {}): Deck {
  return {
    id: 'deck',
    name: 'Deck',
    icon: 'language',
    color: '#fff',
    algorithmPreset: 'general',
    newCardsPerDay: 20,
    maxCardsPerDay: 80,
    shuffleCards: false,
    learningSteps: ['1 day'],
    masteredIntervalMultiplier: 2.5,
    createdAt: 0,
    ...overrides,
  };
}

function makeCard(overrides: Partial<Flashcard> = {}): Flashcard {
  return {
    id: 'card',
    deckId: 'deck',
    front: { text: 'a', direction: 'ltr' },
    back: { text: 'b', direction: 'ltr' },
    createdAt: 0,
    fsrs: defaultFSRSState(),
    ...overrides,
  };
}

test('SM-2 schedules from the supplied review instant, not the wall clock', () => {
  const scheduler = createSM2Scheduler(makeDeck());
  const { updatedCard } = scheduler.schedule(makeCard(), 3, NOW);

  assert.equal(updatedCard.fsrs.last_review, NOW.toISOString());
  assert.equal(updatedCard.fsrs.state, 'Review');
  // One 1-day learning step, graduated with the 2.5× starting multiplier.
  const due = new Date(updatedCard.fsrs.due).getTime();
  assert.equal(due - NOW.getTime(), 2.5 * 86_400_000);
});

test('SM-2 keeps sub-day learning steps as hours', () => {
  const scheduler = createSM2Scheduler(makeDeck({ learningSteps: ['12 hours', '1 day'] }));
  const { updatedCard } = scheduler.schedule(makeCard(), 1, NOW);

  assert.equal(updatedCard.fsrs.state, 'Learning');
  assert.equal(
    new Date(updatedCard.fsrs.due).getTime() - NOW.getTime(),
    12 * 60 * 60 * 1000
  );
});

test('SM-2 accepts minute abbreviations consistently', () => {
  const scheduler = createSM2Scheduler(makeDeck({ learningSteps: ['15 mins', '1 day'] }));
  const { updatedCard } = scheduler.schedule(makeCard(), 1, NOW);

  assert.equal(new Date(updatedCard.fsrs.due).getTime() - NOW.getTime(), 15 * 60 * 1000);
});

test('SM-2 step validation rejects text the parser would silently default', () => {
  assert.equal(isSM2StepValid('12 hours'), true);
  assert.equal(isSM2StepValid('1 day'), true);
  assert.equal(isSM2StepValid('30m'), true);
  assert.equal(isSM2StepValid('twelve hours'), false);
  assert.equal(isSM2StepValid('0 days'), false);
  assert.equal(isSM2StepValid(''), false);
});
