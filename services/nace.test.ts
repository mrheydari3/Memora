import test from 'node:test';
import assert from 'node:assert/strict';
import { NaceClient } from 'nace-sdk';
import { DREX_DECISION_ENDPOINT, DREX_MODEL, decideChoice, routeOption } from './nace';

type Captured = { url: string; init?: RequestInit };

/** A real NaceClient with a stubbed transport, so the request shape is real. */
function stubClient(probabilities: Record<string, number>, choice = 'book') {
  const calls: Captured[] = [];
  const client = new NaceClient({
    apiKey: 'test-api-key',
    retry: { maxRetries: 0 },
    fetch: async (input, init) => {
      calls.push({ url: input, init });
      return new Response(
        JSON.stringify({
          model: DREX_MODEL,
          answers: {
            decision: { type: 'choice', choice, confidence: 0.91, probabilities },
          },
          usage: { input_tokens: 12, output_tokens: 4 },
          evaluation_time_ms: 4.2,
          request_id: 'req_test',
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      );
    },
  });
  return { client, calls };
}

test('decideChoice sends the case state and typed questions to the Drex endpoint', async () => {
  const probabilities = { read: 0.05, book: 0.9, skip: 0.05 };
  const { client, calls } = stubClient(probabilities);

  const decision = await decideChoice({
    state: { dueCards: 42, minutes: 3, streak: 6 },
    question: 'What should this session do next?',
    options: { read: 'Open the deck', book: 'Start a short session', skip: 'Rest today' },
    client,
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, DREX_DECISION_ENDPOINT);

  const headers = new Headers(calls[0].init?.headers);
  assert.equal(headers.get('authorization'), 'Bearer test-api-key');

  const body = JSON.parse(String(calls[0].init?.body));
  assert.equal(body.model, DREX_MODEL);
  assert.deepEqual(body.state, { dueCards: 42, minutes: 3, streak: 6 });
  assert.equal(body.questions.decision.type, 'choice');
  assert.deepEqual(Object.keys(body.questions.decision.criteria), ['read', 'book', 'skip']);

  assert.equal(decision.option, 'book');
  assert.equal(decision.probability, 0.9);
  assert.deepEqual(decision.probabilities, probabilities);
  assert.equal(decision.model, DREX_MODEL);
  assert.equal(decision.requestId, 'req_test');
});

test('routeOption acts on the calibrated probability and falls back below the threshold', () => {
  const confident = routeOption({ read: 0.08, book: 0.84, skip: 0.08 }, { fallback: 'review' });
  assert.equal(confident.kind, 'option');
  if (confident.kind === 'option') {
    assert.equal(confident.option, 'book');
    assert.equal(confident.probability, 0.84);
  }

  // A near tie is not a decision: route to review and keep the number for the explanation.
  const unsure = routeOption({ read: 0.46, book: 0.54 }, { fallback: 'review', threshold: 0.7 });
  assert.equal(unsure.kind, 'fallback');
  if (unsure.kind === 'fallback') {
    assert.equal(unsure.fallback, 'review');
    assert.equal(unsure.probability, 0.54);
  }

  assert.throws(() => routeOption({}, { fallback: 'review' }), /no options/);
});
