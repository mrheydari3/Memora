/**
 * Thresholds that decide when the engine is allowed to say something.
 *
 * These are engineering decisions, not scientific laws. Each one is exported so
 * the UI can print the requirement instead of showing a misleading number
 * ("needs 10 rated reviews") and so tests can assert the boundary.
 */

/** Minimum rated reviews before a recall percentage is shown at all. */
export const MIN_RECALL_SAMPLE = 10;

/** Rated reviews required in EACH window before a direction is reported. */
export const MIN_TREND_WINDOW_REVIEWS = 20;

/** Reviews required before two decks are compared with each other. */
export const MIN_DECK_SAMPLE = 30;

/** Fewer daily points than this cannot support a Mann–Kendall result. */
export const MIN_TREND_POINTS = 8;

/** Minimum days before anomaly detection is meaningful. */
export const MIN_ANOMALY_POINTS = 14;

/** Robust z threshold (Leys et al. 2013 recommendation). */
export const ANOMALY_Z_THRESHOLD = 2.5;

/** Minimum days/reviews/active days before a volume forecast is produced. */
export const MIN_FORECAST_DAYS = 14;
export const MIN_FORECAST_REVIEWS = 30;
export const MIN_FORECAST_ACTIVE_DAYS = 5;

/** New-card introductions required before projecting the new-card backlog. */
export const MIN_BACKLOG_NEW_CARDS = 8;

/** Two reviews closer than this belong to the same study session. */
export const SESSION_GAP_MS = 30 * 60 * 1000;

/**
 * A review that took longer than this is not study time: the learner walked
 * away, left the tab open, or the device slept. Excluded from duration stats
 * and counted as an outlier so it is never silently dropped.
 */
export const MAX_REVIEW_DURATION_MS = 30 * 60 * 1000;

/** Clock skew tolerance for a "future" review timestamp. */
export const FUTURE_TIMESTAMP_TOLERANCE_MS = 5 * 60 * 1000;

/** Anki's default leech threshold. A product default, not an evidence cutoff. */
export const LEECH_THRESHOLD = 8;

/** Lapses at which a card is labelled "repeatedly forgotten". */
export const REPEATED_FAILURE_THRESHOLD = 2;

/** z for a 95% two-sided interval. */
export const Z_95 = 1.959964;

/** z for an 80% two-sided prediction interval. */
export const Z_80 = 1.281552;

/** A recall change smaller than this is not reported as a direction. */
export const MIN_RECALL_CHANGE = 0.08;

/** Days of history the volume forecast reads. */
export const FORECAST_SAMPLE_DAYS = 28;

/** Days of history the new-card pace reads. */
export const BACKLOG_SAMPLE_DAYS = 28;

/** The three ranges the dashboard offers. */
export const RANGE_OPTIONS = [7, 30, 90] as const;
export type RangeOption = (typeof RANGE_OPTIONS)[number];
