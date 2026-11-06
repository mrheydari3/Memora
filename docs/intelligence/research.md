# Memora Intelligence Engine — research notes

This document records what the engine is allowed to conclude, why, and which source
supports each decision. It is deliberately explicit about the difference between a
**measured** quantity and a **model estimate**, because that distinction is the
single biggest correctness risk in learning analytics.

Status labels used below:

- **[E] established** — official specification, peer-reviewed result, or a formal
  statistical definition.
- **[M] model estimate** — an output of the FSRS model fitted to ratings; not a
  measurement of the learner's memory.
- **[H] heuristic** — a defensible derived metric with no validated standard. It is
  labelled as such in code and in the UI.

---

## 1. FSRS facts that constrain the engine

### Which FSRS version Memora actually runs

`ts-fsrs@5.4.1` is the FSRS-6 reference implementation (its version string is
`v5.4.2 using FSRS-6.0` and its default weight vector has 21 parameters). Memora
never supplies custom weights, so every deck runs the **FSRS-6 default parameters**.

- [ts-fsrs v5.4.2 constants](https://github.com/open-spaced-repetition/ts-fsrs/blob/v5.4.2/packages/fsrs/src/constant.ts)
- [ts-fsrs v5.4.2 default weights](https://github.com/open-spaced-repetition/ts-fsrs/blob/v5.4.2/packages/fsrs/src/default.ts)

### The forgetting curve

```
R(t, S) = (1 + FACTOR · t / S) ^ (−DECAY)
```

- FSRS-5: `DECAY = 0.5`, `FACTOR = 19/81`.
- FSRS-6: `DECAY = w20`, `FACTOR = 0.9^(−1/w20) − 1`. With the default
  `w20 = 0.1542`, `FACTOR ≈ 0.98035`.
- `R(S, S) = 0.9` by construction: stability is the time (days) at which recall
  probability has decayed to 90%.
- `t` is the **actual** elapsed time since the last review, not the scheduled
  interval, so overdue reviews lower `R`.

Sources: [FSRS algorithm wiki](https://github.com/open-spaced-repetition/awesome-fsrs/wiki/The-Algorithm),
[ts-fsrs algorithm.ts](https://github.com/open-spaced-repetition/ts-fsrs/blob/v5.4.2/packages/fsrs/src/algorithm.ts).

**Decision:** the engine never re-derives `R`. It calls
`scheduler.getRetrievability(card, at)`, which is the scheduler's own curve with the
deck's own parameters. A second implementation would be a second source of truth.

### What a review state means

Anki defines the states as scheduler phases, not as memory-strength categories:

| State | Meaning | What it does **not** mean |
| --- | --- | --- |
| New | never studied | — |
| Learning | still in the initial learning steps | not "unlearned" |
| Review | graduated to long-term intervals | **not proof of permanent mastery** |
| Relearning | a Review card lapsed and is back in steps | not New |

A Review card still has finite stability, and at its due date FSRS itself predicts
roughly `1 − desiredRetention` chance of failure. "Mature" is only an interval
label (≥ 21 days), not a mastery test.

Sources: [Anki manual — card states](https://docs.ankiweb.net/getting-started.html#card-states),
[Anki manual — statistics](https://docs.ankiweb.net/stats.html).

**Decision:** the dashboard calls the Review bucket *"In review schedule"*, never
"mastered", and the memory section states in one line that these are scheduler
states, not measured mastery.

### Desired retention

Anki: "the proportion of cards recalled successfully when they are due", default
90%. Higher retention ⇒ shorter intervals ⇒ more reviews; above ~0.95 the workload
rises steeply ([Anki deck options](https://docs.ankiweb.net/deck-options.html#fsrs)).

**Decision:** per-deck `requestRetention` is read as the retention target. A card
whose model `R(t)` has fallen below its deck's target is reported as *below the
deck's desired retention*, which is a statement about the schedule, not about the
learner's brain.

### Limits of using FSRS state as "actual retention"

- FSRS fits latent `S` and `D` to **ratings and intervals** by maximum likelihood;
  stability is "a statistical variable of a group of reviews with the same review
  history" ([optimization mechanism](https://github.com/open-spaced-repetition/awesome-fsrs/wiki/The-Mechanism-of-optimization)).
- The model assumes three variables are sufficient to describe a memory
  ([Anki FAQ](https://docs.ankiweb.net/faqs/what-spaced-repetition-algorithm)).
- FSRS only uses grades and intervals — not response time or context
  ([Anki FSRS FAQ](https://docs.ankiweb.net/faqs/frequently-asked-questions-about-fsrs)).
- Anki's *true retention* is a **measured** statistic (first review per card per
  day, `Again` = fail, `Hard/Good/Easy` = pass), and it is noisy on a single day
  ([Anki statistics](https://docs.ankiweb.net/stats.html)).

**Decision:** three quantities are kept apart in the types and in the UI:

1. **Observed recall** — pass/fail counts from the review log (measured).
2. **Estimated retrievability** — FSRS `R(t)` (model estimate).
3. **Predicted retention at the next due date** — FSRS `R(due)` (model estimate).

The engine never claims (3) is measured retention, and never extrapolates `R`
beyond the next scheduled review as if it were observed.

### Review logs and minimum data

The official optimizer consumes raw `card_id, review_time, review_rating[, review_state, review_duration]`
and reconstructs `S/D` itself; pre-review stability snapshots are model outputs and
are **not** independent labels ([fsrs-optimizer schema](https://github.com/open-spaced-repetition/fsrs-optimizer/blob/main/README.md)).

Anki's optimizer guidance: ≥ 1000 reviews (older), ≥ 400 (24.04), no hard minimum
since 24.06.3 — but "less than a few hundred" is still listed as a limitation
([FSRS tutorial](https://github.com/open-spaced-repetition/fsrs4anki/blob/main/docs/tutorial.md),
[Anki deck options](https://docs.ankiweb.net/deck-options.html#fsrs)).

**Decision:** Memora stores exactly the raw rating/timestamp log (plus a pre-review
snapshot used by undo), so parameter optimization stays possible later. The engine
does **not** attempt to fit FSRS parameters; that would duplicate the scheduler's
job and is unreliable under a few hundred reviews.

---

## 2. Rating semantics — Hard is not a failure

Anki's definitions ([studying](https://docs.ankiweb.net/studying.html),
[deck options](https://docs.ankiweb.net/deck-options.html#fsrs)):

| Rating | Meaning | Binary coding |
| --- | --- | --- |
| 1 Again | incorrect or could not recall | **fail** |
| 2 Hard | correct, but with doubt / took long | **pass** |
| 3 Good | correct, some effort | pass |
| 4 Easy | correct, no effort | pass |

Anki's True Retention uses exactly `Again = Fail; Hard, Good, Easy = Pass`.
Effortful successful retrieval is not a failure — retrieval difficulty and retrieval
success are separate dimensions (Bjork & Bjork 2011; Pyc & Rawson 2009,
*JML*; Kornell & Vaughn 2016).

**Definitions used by the engine** (shown verbatim in the UI where the number appears):

```
Successful recall rate = (Hard + Good + Easy) / all rated reviews
Fluent recall rate     = (Good + Easy) / all rated reviews
Difficult recall rate  = Hard / all rated reviews
Again rate             = Again / all rated reviews
Lapse                  = rating Again on a card whose pre-review state was Review
```

`Hard` is never folded into failures, and "accuracy" is avoided as a label because
the rating is a self-report, not a verified answer.

Sources: [Anki statistics](https://docs.ankiweb.net/stats.html),
[Pyc & Rawson 2009](https://doi.org/10.1016/j.jml.2009.01.004),
[Bjork & Bjork 2011](https://bjorklab.psych.ucla.edu/wp-content/uploads/sites/13/2016/04/EBjork_RBjork_2011.pdf).

### Response time

Memora records `elapsedMs` from the moment the card was displayed to the rating
press. That is **total review duration**, not retrieval latency: it includes reading,
thinking, revealing the answer and choosing a rating. Response time is a valid
*relative, within-person* index of retrieval fluency, never an absolute measure of
automaticity, and it is confounded by card length, language, device and strategy
(Karpicke & Roediger 2007; Logan & Balota 2015; Moors & De Houwer 2006).

**Decision:** latency is always reported as **median review duration**, never as
"recall speed" or "automaticity", and durations above 30 minutes are excluded from
duration statistics and counted as outliers (a walked-away tab is not study time).

### Lapses and leeches

Anki: a lapse is `Again` **on a review card**; the default leech threshold is 8
lapses ([leeches](https://docs.ankiweb.net/leeches.html)). The threshold is a
product default, not an evidence-based cutoff.

**Decision:**

```
lapse rate = lapses / review-state reviews     [H]
```

Cards with ≥ 2 lapses are "repeatedly forgotten"; ≥ 8 are labelled "leech
(Anki default threshold)" and the threshold is configurable in code.

---

## 3. Statistical methods

Every percentage in the dashboard is a proportion of a counted sample, so it carries
a **Wilson score interval** (95%). Wilson keeps nominal coverage at small `n` and
near 0/1, where the normal approximation fails (Wilson 1927; Agresti & Coull 1998;
[NIST Dataplot](https://www.itl.nist.gov/div898/software/dataplot/refman1/auxillar/propconf.htm)).

Implication used in the UI: at `n = 30`, a 95% interval is at least ±15 points wide,
so a bare "27%" would be misleading. The engine therefore:

- refuses to show a rate below **10 rated reviews** (`MIN_RECALL_SAMPLE`),
- prints the interval whenever `n < 200`,
- never calls a difference between two windows real unless the intervals separate.

### Trend detection

The daily review count is a short, gappy, tie-heavy count series. The engine uses:

- **Sen's slope** — median of all pairwise slopes, robust to outliers, works on
  irregular dates ([Sen 1968](https://doi.org/10.1080/01621459.1968.10480934)).
- **Mann–Kendall** — rank-based monotonic trend test with tie-corrected variance
  and continuity correction ([Mann 1945](https://doi.org/10.2307/1907187);
  [PNNL](https://vsp.pnnl.gov/help/Vsample/Design_Trend_Mann_Kendall.htm)).
  With `n < 8` the normal approximation is not trustworthy, so the engine returns
  `insufficient_data` instead of a p-value.
- **Two-window recall comparison** — Wilson intervals on equal-length windows; a
  direction is reported only when each window has ≥ 20 rated reviews and the
  intervals do not overlap, otherwise `stable`/`insufficient_data`.

Known limitation, stated in code: daily reviews are serially correlated (streaks,
weekends), which makes Mann–Kendall anti-conservative. The engine therefore labels
the test *descriptive* and never uses it as the sole basis for a recommendation.

### Missing days vs zero days

A day inside the observed range with no reviews is a **true zero** (the app was
available), not a missing value. It must stay in the denominator, otherwise
"average daily reviews" silently becomes "average per active day" and the trend can
flip sign (FPP3 §13.9; [intermittent demand](https://openforecast.org/2024/06/18/introduction-to-intermittent-demand/)).

**Decision:** the engine builds a complete local-calendar grid, fills zeros, and
reports **both** `perCalendarDay` and `perActiveDay`, explicitly named. Study days
are local days (`startOfLocalDay` / `addLocalDays`), so DST and midnight transitions
cannot drift the buckets.

### Anomalies

Robust z-score with median/MAD (`1.4826 · MAD`), threshold 2.5 (Leys et al. 2013).
MAD has a 50% breakdown point but is **zero** when more than half the days are
identical — common with sparse logs. The engine floors the scale and returns no
anomalies when the series is degenerate, rather than flagging every non-zero day.

### Forecasting

Volume forecast uses the least complex defensible model: the **mean daily count
with an 80% prediction interval** widened by `√h` for the horizon, on a complete
daily grid. It is explicitly a scenario, not a promise.

- Minimum evidence: 14 days observed, ≥ 5 active days, ≥ 30 reviews. Otherwise
  `insufficient_data`.
- Prediction intervals are mandatory; point forecasts alone are "of almost no
  value" ([FPP3 §5.5](https://otexts.com/fpp3/prediction-intervals.html)).
- No universal minimum sample rule exists for exponential smoothing; the parameter
  floor is not a practical floor ([FPP3 §13.7](https://otexts.com/fpp3/long-short-ts.html)).
  That is why the engine sets its own explicit evidence gate and reports it.

Two other "predictions" are **not** statistical forecasts and are labelled
differently:

- **Scheduled workload** — an exact count of cards by due date. Deterministic.
- **Retention at next due** — FSRS `R(due)` per card, averaged. Model estimate.

### Correlations

Pearson `r` is unstable at small `n` and autocorrelated daily counts have an
effective sample far below the nominal one. The engine computes **no correlation
coefficients** for the dashboard. Where it compares performance early vs late in a
session it reports the two rates and says "associated with", never "caused by".

---

## 4. Decisions that follow

| Question | Decision |
| --- | --- |
| Is `Hard` a failure? | No — pass. Separate "difficult recall" metric. |
| Is a Review card "mastered"? | No — labelled "in review schedule". |
| Can we show actual retention? | No. Observed recall, FSRS `R`, and predicted `R` at due are distinct. |
| Can we show FSRS retrievability for SM-2 decks? | No — SM-2 packs ease/interval into the FSRS fields. Memory analytics cover FSRS decks only and say so. |
| Can we forecast with 5 reviews? | No — explicit `insufficient_data` with the requirement shown. |
| Minimum rated reviews for a rate? | 10. Trend direction needs 20 per window. Deck comparison needs 30. |
| Zero-review days? | Counted as zeros on a complete calendar grid; "per active day" reported separately. |
| Duplicate / invalid records? | Counted and reported in a data-quality block, not silently dropped. |
| Archived decks? | Excluded by default (consistent with Home/Profile), counted in coverage. |
| Response time? | "Median review duration"; > 30 min excluded and counted. |
| External AI? | Not required. The engine is deterministic and local-only; no study data leaves the device. |

## 5. Non-goals (deliberate)

- No composite "memory score" or "learning score" — the constructs (retention,
  fluency, adherence, habit) are not interchangeable and no weights are validated.
- No FSRS parameter optimization — that is the scheduler's job and needs hundreds of
  reviews; the raw log is preserved so it can be added later.
- No "habit strength" claim — a timestamp log measures behavioural consistency, not
  automaticity (SRHI/SRBAI are self-report instruments).
- No causal claims about fatigue, session length or time of day.
