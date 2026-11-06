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

---

## 6. Adaptive review ordering — research questions and decision

### Questions

1. Can Memora improve the learning experience without replacing FSRS or
   recalculating its intervals?
2. Which available signals are real observations, and which are model outputs?
3. Is a weighted “learning score” defensible?
4. Can historical data prove that a reordering policy improves future retention?
5. When should the engine refuse to make a claim?

### What the evidence supports

FSRS is already the memory model and scheduler. Its DSR state is fitted to the
learner’s ratings and intervals; Anki explicitly says users should tune desired
retention rather than hand-edit the parameters, and its simulator is the official
way to explore workload/retention tradeoffs ([FSRS algorithm](https://github.com/open-spaced-repetition/fsrs4anki/wiki/The-Algorithm),
[Anki deck options](https://docs.ankiweb.net/deck-options.html#fsrs),
[optimal retention](https://github.com/open-spaced-repetition/fsrs4anki/wiki/The-optimal-retention)).
A second scheduler or a hand-built forgetting curve would duplicate the
scheduler and create two sources of truth.

Retrieval practice and distributed practice are well supported: retrieval
attempts improve later retention more than restudy in controlled experiments,
and spacing interacts with the retention interval ([Roediger & Karpicke 2006](https://doi.org/10.1111/j.1467-9280.2006.01693.x),
[Karpicke & Blunt 2011](https://doi.org/10.1126/science.1199327),
[Cepeda et al. 2006](https://doi.org/10.1037/0033-2909.132.3.354),
[Bjork & Bjork 2011](https://bjorklab.psych.ucla.edu/wp-content/uploads/sites/13/2016/04/EBjork_RBjork_2011.pdf)).
Those findings justify retrieval and spacing; they do **not** validate a
particular queue-order formula or numeric priority weights.

### Decision: order only, never reschedule

The engine’s adaptive layer ranks cards the existing queue builder has already
marked due. It does not alter `due`, `stability`, `difficulty`, `elapsed_days`,
`scheduled_days`, `reps`, `lapses`, `state`, learning steps or the review log.
FSRS remains the sole authority for the next interval. This makes the feature
reversible and keeps every existing scheduler test meaningful.

### Decision: lexicographic priority, not a weighted score

The ordering is:

1. a due learning/relearning step,
2. a Review card whose FSRS R(now) is below the deck’s desired retention,
3. other due Review cards,
4. New cards (normally kept separate by the daily new-card cap).

Within Review cards: lower R first, then more days overdue, then more lapses,
then higher FSRS difficulty, then the earlier due time, then card id for a
deterministic tie-break. A weighted sum would imply that one extra lapse is
worth a fixed number of retrievability points; no evidence supports that
exchange rate. A lexicographic policy is easier to explain and test, and the
reported percentile is explicitly a queue position, not a recall probability.

### Decision: no reinforcement learning or parameter fitting

FSRS parameter optimisation needs hundreds of reviews and is a
scheduler-level operation. The engine has no counterfactual labels: it cannot
observe what would have happened if a card had appeared earlier or later. RL or
contextual bandits would therefore be trained on fabricated feedback. The
engine stays deterministic, local and inspectable instead.

### Decision: the queue is not the whole intervention

The engine also reports:

- **mastery evidence** from post-graduation reviews plus FSRS state,
- **weakness cues** from observed lapses, sample-gated recent Again rates and a
  Wilson-separated deck comparison,
- a **local profile** built from real pace, session size and observed recall,
- **session estimates** from the learner’s own median review duration.

None of these silently removes a card. A break suggestion is a suggestion, and
is shown only when late-session recall is lower with enough reviews and the
learner’s own median session is shorter than today’s queue.

### Decision: mastery thresholds are product heuristics

The labels New → Learning → Developing → Established → Strong are not a
validated mastery scale. They combine observed post-graduation successes with
FSRS stability, lapse count and a recent-lapse window. The thresholds are
exported constants so they can be challenged and tested. A single Easy rating
cannot reach Established or Strong; new cards and learning steps cannot either.
Every card carries the limitations with its label.

### Decision: time of day is an association, not a prescription

The profile only reports a preferred study window when the 95% Wilson intervals
for that window and the other windows do not overlap, with at least 30 reviews
in each side. Even then the wording is “observed successful recall”, not “best
time” and not a causal claim. Review duration is called recorded review time,
not retrieval latency; it includes reading, revealing and rating.

---

## 7. Evaluation framework

### What was implemented

`data/intelligence/evaluation/ordering.ts` compares the same due cards under the
baseline order and the priority order. It reports:

- the number of cards with a finite FSRS R,
- the number and position of cards whose R is below target,
- the share of at-risk cards in the first half of each ordering,
- how many overdue cards moved earlier,
- the median position of at-risk cards.

### What it does not prove

This is a **structural replay**, not an experiment. The log contains one rating
for each card in the position where it actually appeared. It does not contain
a counterfactual rating the card would have received in another position. The
engine therefore does not claim that moving a card earlier improves retention;
it reports that the ordering changed and labels the limitation in the result.

A true efficacy study would need a controlled or randomized comparison, enough
reviews per arm, and a pre-registered outcome. The official FSRS simulator can
model workload/retention tradeoffs from FSRS state, but it is still a simulation
and is not a substitute for an outcome experiment
([Anki simulator documentation](https://docs.ankiweb.net/deck-options.html#the-simulator)).

---

## 8. Research-to-code map

| Decision | Implementation |
| --- | --- |
| FSRS is the only interval scheduler | `prioritizeDueCards` reads `createFSRSScheduler` and never writes card state |
| No competing forgetting curve | R comes from the existing scheduler; no second formula |
| Hard is a pass | All observed-success calculations use `rating >= 2` |
| No arbitrary weighted composite | lexicographic ordering in `scheduling/priority.ts` |
| No unsupported mastery claim | post-graduation review evidence + stability + lapse gates |
| No false deck conclusions | 30-review floor and non-overlapping Wilson intervals |
| No false time-of-day claim | 30-review floor and non-overlapping Wilson intervals |
| No card removal | session plan only counts and estimates; the queue stays intact |
| No hidden scheduling mutation | `affectsDueDates: false` in the public policy |
| Offline operation | pure TypeScript, local review log, no network or external AI |

---

## 9. Known limitations and future work

- Priority ordering is a defensible heuristic, not a validated intervention.
  A future study could compare baseline and priority queues with a controlled
  design, but the current log cannot answer that question.
- No FSRS parameter optimisation is attempted. The raw log is preserved for a
  future optimizer; fitting parameters on a small log would be unstable.
- No content-aware model is used. Cards have no topic/tag model in the current
  data contract, so the engine cannot claim topic-level weakness detection.
- The profile has no configured “available minutes” input. It reports pace and
  session history instead of inventing a daily time budget.
- The mastery thresholds are product heuristics and should be recalibrated if
  the app later has a validated outcome measure.
- Archived decks are excluded from active analysis, consistent with Home and
  Statistics. Orphan reviews remain counted in data quality.
- The engine runs on the session’s initial queue, not on a background worker;
  this is deliberate for the current data sizes and avoids blocking the review
  interaction with new infrastructure.
