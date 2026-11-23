/**
 * Nace Drex decision service — calibrated probabilities for each option.
 *
 * Drex is a decision model, not a chat model: we send a case state and typed
 * questions, and one forward pass returns a probability for every option we
 * supplied. This module sends that request and turns a choice answer into a
 * route, so a caller can act on the most likely option and fall back when the
 * model is not confident enough.
 *
 * The decision call is POST https://console.nace.ai/v1/systemone. The API key
 * must stay on the server/Node side (Drex refuses browser calls), so import
 * this from scripts or a server entry point — never from a screen. Set the key
 * in the environment; `.env.example` names it.
 */

import { NaceClient, choice, type Question, type SystemOneResult } from 'nace-sdk';

/** Drex checkpoint alias; Nace resolves it to the current Drex version. */
export const DREX_MODEL = 'drex-latest';

/** API root the SDK sends decision calls to; the route is `/v1/systemone`. */
export const DREX_BASE_URL = 'https://console.nace.ai';

/** Full decision endpoint, for callers that need to allow-list it. */
export const DREX_DECISION_ENDPOINT = `${DREX_BASE_URL}/v1/systemone`;

/** A JSON value Drex can evaluate as a case state. */
export type DrexState =
  | string
  | number
  | boolean
  | null
  | DrexState[]
  | { [key: string]: DrexState };

/** Typed questions keyed by the name their answer comes back under. */
export type DrexQuestions = Record<string, Question>;

/** Answers keyed by question name, with the model that produced them. */
export type DrexAnswers<Q extends DrexQuestions> = {
  model: string;
  answers: SystemOneResult<Q>['answers'];
  requestId: string;
  inputTokens: number;
};

/** One choice question's outcome, probabilities intact. */
export type DrexChoice<T extends string> = {
  option: T;
  probability: number;
  confidence: number;
  probabilities: Record<T, number>;
  model: string;
  requestId: string;
};

/** The decision a probability distribution supports. */
export type DrexRoute<T extends string, F extends string = string> =
  | { kind: 'option'; option: T; probability: number; probabilities: Record<T, number> }
  | { kind: 'fallback'; fallback: F; probability: number; probabilities: Record<T, number> };

/** True when a Nace key is present. The value is never logged or returned. */
export function isNaceConfigured(): boolean {
  return Boolean(process.env.NACE_API_KEY?.trim());
}

/**
 * Build the Drex client. Throws before any request when NACE_API_KEY is unset,
 * so a missing key fails loudly instead of sending an anonymous decision call.
 */
export function createDrexClient(model: string = DREX_MODEL): NaceClient {
  const apiKey = process.env.NACE_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('NACE_API_KEY is not set. Copy .env.example to .env.local and add your Nace API key.');
  }
  return new NaceClient({ apiKey, baseURL: DREX_BASE_URL, defaultModel: model });
}

/**
 * Evaluate typed questions against one case state, in a single Drex request.
 * Several questions about the same state share one pass over that state.
 */
export async function evaluateCase<Q extends DrexQuestions>({
  state,
  questions,
  model = DREX_MODEL,
  client,
}: {
  state: DrexState;
  questions: Q;
  model?: string;
  client?: NaceClient;
}): Promise<DrexAnswers<Q>> {
  const drex = client ?? createDrexClient(model);
  const result = await drex.systemOne({ model, state, questions });

  return {
    model: result.model,
    answers: result.answers,
    requestId: result.request_id,
    inputTokens: result.usage.input_tokens,
  };
}

/**
 * Ask which option applies to a case state, then read the calibrated
 * probability Drex put on every option rather than only its top pick.
 */
export async function decideChoice<T extends string>({
  state,
  question,
  options,
  model = DREX_MODEL,
  client,
}: {
  state: DrexState;
  question: string;
  options: Record<T, string | null>;
  model?: string;
  client?: NaceClient;
}): Promise<DrexChoice<T>> {
  const { answers, model: answeredBy, requestId } = await evaluateCase({
    state,
    questions: { decision: choice(question, options) },
    model,
    client,
  });

  const answer = answers.decision;
  const probabilities = { ...answer.probabilities } as Record<T, number>;

  return {
    option: answer.choice as T,
    probability: probabilities[answer.choice as T] ?? answer.confidence,
    confidence: answer.confidence,
    probabilities,
    model: answeredBy,
    requestId,
  };
}

/**
 * Make or route the decision from the per-option probabilities.
 *
 * The likeliest option wins only when its probability clears `threshold`
 * (0.5 by default, and higher when a wrong pick is expensive). Otherwise the
 * caller gets the fallback route — a review queue, a human, a safe default —
 * with the winning probability attached so the route can be explained.
 */
export function routeOption<T extends string, F extends string = string>(
  probabilities: Readonly<Record<T, number>>,
  { fallback, threshold = 0.5 }: { fallback: F; threshold?: number }
): DrexRoute<T, F> {
  const options = Object.keys(probabilities) as T[];
  if (options.length === 0) {
    throw new Error('Drex returned no options to route on.');
  }

  const [option, probability] = options.reduce<[T, number]>(
    (best, candidate) => (probabilities[candidate] > best[1] ? [candidate, probabilities[candidate]] : best),
    [options[0], probabilities[options[0]]]
  );

  const copy = { ...probabilities } as Record<T, number>;
  return probability >= threshold
    ? { kind: 'option', option, probability, probabilities: copy }
    : { kind: 'fallback', fallback, probability, probabilities: copy };
}
