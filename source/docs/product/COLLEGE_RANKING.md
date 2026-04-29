# College Ranking Philosophy

As of March 19, 2026, Gator Guide should rank colleges with a two-layer model:

1. `Base Score`: a deterministic, testable score built from student-fit and school-fit signals.
2. `Personalized Score`: the final ordered score shown to the user after limited AI and query-aware refinement.

This matches the current implementation in `source/services/ai/ai.service.ts`, where the main ranking path already uses `finalBaseScore` and `finalScore`.

## Final Product Decision

We are not using a single global "best colleges" list.

We are also not letting AI fully decide ranking order.

The canonical ranking behavior is:

- First, calculate a deterministic score that reflects academic fit, affordability, transfer friendliness, major strength, location handling, and user preferences.
- Then, apply a small personalization layer for AI interpretation and active search intent.
- Sort by the personalized score, then fall back to deterministic tie-break rules.

This means the app is a personalized recommender, but its core ranking is still stable enough to test and debug.

## Two-Layer Score Model

### 1. Base Score

The `Base Score` answers:

"How strong is this college for this student using measurable, repeatable rules?"

This score must be:

- deterministic
- reproducible from the same inputs
- explainable without AI
- the main source of ranking order

The current implementation starts from a weighted core and then applies small deterministic nudges:

```text
Base Score =
  weighted GPA fit
  + weighted prestige/selectivity
  + weighted major strength
  + weighted preference fit
  + deterministic nudges and caps
```

The current code computes:

```text
finalBaseScore =
  round(
    gpaTerm * gpaWeight +
    prestigeTerm * prestigeWeight +
    majorTerm * majorWeight +
    preferenceTerm * preferenceWeight
  )
  + major evidence nudges
  + home-state boost
  + completion / aid / debt / cost nudges
  + institution-level transfer fit
  + CS pathway adjustment
```

It is then clamped to `0-100`, with an academic cap applied when the student's GPA fit is too weak for a selective school.

### 2. Personalized Score

The `Personalized Score` answers:

"Given the user's current query and AI context, how should near-matches be ordered right now?"

This score must:

- preserve the deterministic base order as the main signal
- never let AI dominate ranking
- only refine results near the top of the list

The current implementation is:

```text
finalScore =
  clamp(
    round(
      finalBaseScore * 0.9 +
      aiFactor * 0.1 +
      queryBoost +
      homeStateFinalBoost
    )
  )
```

Current rules:

- `aiFactor` is only computed for the top 20 deterministic candidates.
- If AI is unavailable or disabled, `aiFactor` falls back to `50` neutral.
- Query boost is capped and only helps when the user's search text strongly matches the school or program.
- Personalized score is for final ordering and display, but the deterministic layer still does most of the work.

## Ranking Dimensions

The requested ranking philosophy maps to the implementation like this.

### Academic Fit

Academic fit is the combination of:

- `GPA fit`: compares the student's GPA against an admission-rate-based band.
- `Prestige/selectivity`: uses admission rate as the selectivity proxy.

Current GPA band logic:

- highly selective schools: roughly `3.7-4.0`
- mid-selective schools: roughly `3.0-3.6`
- broader-access schools: roughly `2.5-3.2`

Academic fit is a primary weighted input to `Base Score`.

### Major Strength

Major strength is a primary weighted input and should remain one of the strongest transfer signals.

Evidence is ranked from strongest to weakest:

- exact program title match
- matching CIP 6-digit code
- matching CIP 4-digit code
- partial title containment
- keyword-only evidence

The current system also tracks an evidence grade:

- `A`: strongest direct program evidence
- `B`: strong partial program evidence
- `C`: Washington MRP pathway support
- `D`: keyword-only evidence
- `E`: little or no evidence

Important decision:

- major mismatch should stay hard to hide
- AI should not rescue a school with weak academic-major evidence

### Affordability

Affordability is handled inside `preferenceFit` and through additional nudges.

Current affordability inputs:

- tuition fit
- debt fit
- aid fit

When the user gives a cost preference, affordability becomes much more important and uses this weighted mix:

```text
preferenceFit =
  costFit * 0.45 +
  debtFit * 0.30 +
  aidFit * 0.20 +
  sizeFit * 0.03 +
  settingFit * 0.02
```

When the user does not give a cost preference, the preference dimensions fall back to a simpler average.

Important decision:

- affordability is part of the deterministic score
- it should not be deferred to AI explanation

### Transfer Friendliness

Transfer friendliness is important, but in the current system it is mostly encoded as deterministic nudges and tie-breaks rather than as its own top-level normalized weight.

Current transfer-friendly signals:

- institution level fit:
  - explicit transfer intent prefers `2-year` schools
  - continuing to a higher degree prefers `4-year` schools
- completion rate nudge
- Washington MRP participation tie-break when in-state ranking is active
- computer science pathway adjustment for `2-year` vs `4-year` schools

Important decision:

- transfer friendliness remains deterministic
- it should continue to influence ranking before AI
- for now it stays in the adjustment layer instead of becoming a fifth top-level normalized weight

### Location Fit

Location fit is a deterministic rule set, not an AI-only feature.

Current location handling in the production ranking path:

- explicit `in_state` preference scopes fetching and filtering to the effective state
- guest users default to Washington when needed
- signed-in users without a stored state also fall back to Washington in specific cases
- if there is no explicit in-state preference, home-state schools can receive a soft deterministic boost
- home-state schools can also receive a small final personalized boost

Important implementation note:

- the new structured location question exists now
- in the current weighted ranking path, detailed state/region preferences are not yet a full standalone weighted factor
- deeper state/region preference matching should be added to the deterministic preference layer later, not to the AI layer

### User Preferences

User preferences influence ranking in two ways:

1. They change the content of `preferenceFit`.
2. They rebalance the top-level base-score weights.

Current user-preference inputs include:

- cost preference
- class size
- housing
- transportation
- continue education
- ranking importance
- in-state/out-of-state preference

## Base Weight System

The current deterministic base weights start as:

| Factor | Default weight |
| --- | ---: |
| GPA fit | 0.35 |
| Prestige/selectivity | 0.25 |
| Major strength | 0.20 |
| Preference fit | 0.20 |

Questionnaire answers then shift those weights before they are normalized.

### Ranking Importance Adjustments

| Questionnaire answer | GPA | Prestige | Major | Preference |
| --- | ---: | ---: | ---: | ---: |
| `very_important` | +0.05 | +0.08 | -0.05 | -0.08 |
| `not_important` | +0.05 | -0.07 | 0.00 | +0.02 |

### Continue Education Adjustments

| Questionnaire answer | GPA | Prestige | Major | Preference |
| --- | ---: | ---: | ---: | ---: |
| `yes` | 0.00 | +0.04 | +0.03 | -0.07 |
| `no` | 0.00 | -0.04 | -0.03 | +0.07 |

### Cost Preference Adjustment

If the user gives any real budget preference:

| Factor | Adjustment |
| --- | ---: |
| GPA | -0.10 |
| Prestige | -0.12 |
| Major | -0.03 |
| Preference | +0.25 |

After all adjustments, the weights are normalized to sum to `1.0`.

## Weighted Factor Lock-In

This section locks down the specific factor behavior the team asked about.

Important decision:

- the canonical weighted system is the production `recommendColleges` path
- `GPA` and `Major` are top-level weighted factors
- `Location` is currently a rule-driven filter and boost system, not a peer weight in the production weighted core
- `Size` and `Setting` are nested inside `preferenceFit`, with fixed subweights

### Canonical Factor Summary

| Factor | Canonical role | Weight behavior | Normalization rule | Missing-data behavior |
| --- | --- | --- | --- | --- |
| GPA | top-level base-score factor | questionnaire-driven | `0-100` from GPA vs admission-rate bands | neutral `50` if GPA or admission rate is missing/invalid |
| Major | top-level base-score factor | questionnaire-driven | `0-100` from program evidence tiers | neutral `50` if user major is missing; low score if major exists but evidence is weak |
| Location | deterministic constraint/boost, not a top-level weighted peer | rule-driven, not normalized as a peer weight in the production core | state filter, home-state boosts, and optional location-match bonus in compatibility breakdown | no location preference means no direct location bonus; missing college state can fail state filtering |
| Size | nested inside `preferenceFit` | static subweight inside preference scoring | mapped to `95/65/35` or `95/70/40` depending on preference | neutral `50` if size is missing or user has no size preference |
| Setting | nested inside `preferenceFit` | static subweight inside preference scoring | average of housing/transport heuristics, clamped to `0-100` behavior by design | neutral `50` if setting is missing or there are no usable preference signals |

### GPA Weight and Normalization

GPA is a first-class ranking factor.

Current raw default:

- `gpaWeight = 0.35`

Questionnaire behavior:

- questionnaire-driven
- rebalanced by `ranking`, `continueEducation`, and `costOfAttendance`
- normalized with the other top-level factors after all adjustments

Current GPA normalization:

- if admission rate is missing: `gpaFitScore = 50`
- if user GPA is missing or invalid: `gpaFitScore = 50`
- if admission rate is under `0.25`, compare GPA to the `3.7-4.0` band
- if admission rate is `0.25-0.50`, compare GPA to the `3.0-3.6` band
- otherwise compare GPA to the `2.5-3.2` band

Current score behavior:

- below band: penalized from a high baseline and clamped into `0-100`
- inside band: scaled into roughly `80-100`
- above band: small bonus above `92`

Missing-data rule:

- missing GPA does not zero out the ranking
- it becomes a neutral `50` and removes the selective-school GPA cap logic

### Major Weight and Normalization

Major is also a first-class ranking factor.

Current raw default:

- `majorWeight = 0.20`

Questionnaire behavior:

- questionnaire-driven
- rebalanced by `ranking`, `continueEducation`, and `costOfAttendance`
- normalized with the other top-level factors after all adjustments

Current major normalization:

- exact program title match: `92`
- matching CIP 6-digit program code: `88-92`
- matching CIP 4-digit code: `78-84`
- partial title containment: `74-80`
- keyword-only evidence: `60`
- academic-major query with weak/no evidence: `15`
- non-academic weak/no evidence: `45`

Missing-data rule:

- if the student has no declared major, `majorFit = 50`
- if the student has a major but the college has weak evidence, the score should stay low
- weak major evidence must not be repaired by AI alone

### Location Weight and Normalization

Location is intentionally different from GPA and Major.

Final decision:

- in the production weighted core, `Location` does not have its own peer weight
- location is handled through filtering and deterministic boosts instead
- this is deliberate, because in-state requirements behave more like constraints than like soft preferences

Current production behavior:

- explicit `in_state` preference becomes a hard state filter
- guest users can fall back to Washington
- signed-in users without a stored state can also fall back to Washington in specific cases
- home-state soft preference can add `+4` to `finalBaseScore`
- home-state soft preference can add `+2` to `finalScore`

Current location normalization in the older compatibility breakdown path:

- base `locScore = 50`
- if `locationPreferenceMatchesState(...)` is true: `locScore = 75`

Missing-data rule:

- missing location preference means no direct location match bonus
- missing college state becomes neutral in compatibility scoring, but can effectively exclude the school from state-filtered production ranking

### Size Weight and Normalization

Size is not a top-level factor. It is a subfactor of `preferenceFit`.

Current subweight behavior:

- if cost preference is active:
  - `sizeFit * 0.03`
- if cost preference is not active:
  - size is one of five equal subfactors inside the preference average
  - effective share inside `preferenceFit` is `20%`

Current normalization:

- if preferred class size is `small`:
  - small school `95`
  - medium school `65`
  - large school `35`
  - otherwise: `50`

Missing-data rule:

- missing school size returns `50`
- unknown size returns `50`
- no user size preference returns `50`

### Setting Weight and Normalization

Setting is also a subfactor of `preferenceFit`.

Current subweight behavior:

- if cost preference is active:
  - `settingFit * 0.02`
- if cost preference is not active:
  - setting is one of five equal subfactors inside the preference average
  - effective share inside `preferenceFit` is `20%`

Current normalization:

- transportation `transit`, `walk`, or `bike` favors `urban` with score `90`, otherwise `45`
- transportation `car` favors `suburban` or `rural` with score `80`, otherwise `60`
- housing `off_campus` favors `urban` with score `80`, otherwise `55`
- housing `commute` favors `suburban` with score `80`, `urban` with `70`, and `rural` with `60`
- housing `on_campus` contributes neutral `50`
- if multiple signals exist, the scores are averaged
- if no signals exist, return `50`

Missing-data rule:

- missing school setting returns `50`
- missing housing and transportation preferences returns `50`

### Static vs Questionnaire-Driven Decision

The final decision is:

- `GPA` weight is questionnaire-driven
- `Major` weight is questionnaire-driven
- `Location` is rule-driven in the production ranking path
- `Size` uses a static internal subweight, but the input score depends on the questionnaire
- `Setting` uses a static internal subweight, but the input score depends on the questionnaire

This means not every factor should be promoted to a top-level adjustable slider.

That is intentional.

The system should preserve strong control over:

- academic fit
- major fit
- budget sensitivity

And it should keep lower-signal lifestyle factors lightweight unless the team explicitly redesigns the ranking model.

## Compatibility Breakdown Path

`ai.service.ts` still contains an older generic weighting helper:

- `buildPreferenceWeights`
- `computePreferenceBreakdown`

That path currently starts from these raw integer defaults:

| Dimension | Raw default |
| --- | ---: |
| academics | 45 |
| cost | 25 |
| location | 15 |
| prestige | 5 |
| size | 5 |
| setting | 5 |
| aid | 0 |
| debt | 0 |
| aiFit | 0 |

It then applies questionnaire/query adjustments and normalizes the result to integer percentages summing to `100`.

Important decision:

- this compatibility breakdown is not the canonical ranking source of truth
- it is acceptable for explanation/debug/fallback use
- future ranking work should align to the production `finalBaseScore` model, not this older helper

## Score Calculation Logic

This section finalizes the calculation model the team should use when discussing ranking, reviewing pull requests, or writing tests.

Important decision:

- the production score should be explained as three deterministic parts plus one small personalization layer
- those parts are:
  - `schoolSideScore`
  - `userPreferenceScore`
  - `contextAdjustment`
  - then the final personalization layer on top

This decomposition matches the current production formula even though the code currently stores the combined result as `finalBaseScore`.

### 1. School-Side Score

`schoolSideScore` is the objective school-profile contribution.

It should answer:

"Ignoring the specific student's lifestyle preferences for a moment, how strong is the school's own academic/outcome profile in this ranking model?"

Canonical formula:

```text
schoolSideScore =
  round(prestigeTerm * prestigeWeight)
  + completionNudge
```

Current inputs:

- `prestigeTerm` comes from admission rate and is normalized to `0-100`
- `completionNudge` comes from completion rate and is a small deterministic integer adjustment of about `-2..+2`

Important decision:

- `prestige` is the main school-side weighted term
- `completion` remains a school-side nudge rather than becoming a new peer weight

### 2. User-Side Preference Score

`userPreferenceScore` is the direct student-to-school fit contribution.

It should answer:

"How well does this school match this student's GPA, major, affordability needs, and stated preferences?"

Canonical formula:

```text
userPreferenceScore =
  round(
    gpaTerm * gpaWeight +
    majorTerm * majorWeight +
    preferenceTerm * preferenceWeight
  )
```

Current inputs:

- `gpaTerm = gpaFitScore` unless GPA influence is explicitly disabled
- `majorTerm = majorFit` unless major influence is explicitly disabled
- `preferenceTerm = preferenceFit` unless preference influence is explicitly disabled

And:

```text
preferenceFit =
  if cost preference is active:
    round(
      costFit * 0.45 +
      debtFit * 0.30 +
      aidFit * 0.20 +
      sizeFit * 0.03 +
      settingFit * 0.02
    )
  else:
    round(average(costFit, debtFit, aidFit, sizeFit, settingFit))
```

Important decision:

- this is the main user-fit score
- `preferenceFit` already includes affordability, size, and setting
- location is not embedded here as a peer weighted dimension in the production path

### 3. Context Adjustment

`contextAdjustment` contains the remaining deterministic adjustments that are important, but too specific to deserve their own top-level peer weight.

Canonical formula:

```text
contextAdjustment =
  majorEvidenceBoost
  + strictAcademicBoost
  + majorPointsNudge
  + homeStateBoost
  + aidDebtNudge
  + costNudge
  + institutionFit
  + csPathFit
```

Where the current production rules are:

```text
majorEvidenceBoost = min(4, floor(majorEvidenceCount / 2))
strictAcademicBoost = strict academic query ? min(3, floor(majorEvidenceCount / 6)) : 0
majorPointsNudge = strict academic query ? round(majorPoints * 0.25) : 0
homeStateBoost = signed-in soft home-state preference ? 4 : 0
aidDebtNudge = round((((aidFit + debtFit) / 2) - 50) * 0.04)
costNudge = cost preference active ? round((costFit - 50) * 0.16) : 0
institutionFit = institutionPreferenceAdjustment(...)
csPathFit = csPathAdjustment(...)
```

Important decision:

- these are still deterministic
- they are not optional explanation-only sugar
- they should remain small relative to the main weighted user-fit score

### 4. Deterministic Base Score

With the three pieces above, the canonical deterministic score is:

```text
finalBaseScore =
  clamp(
    schoolSideScore +
    userPreferenceScore +
    contextAdjustment
  )
```

And then:

- if `shouldApplyCap` is true and `gpaFitScore < 40`, cap `finalBaseScore` at `65`

This is the score the team should treat as the canonical deterministic ranking output.

Important decision:

- if we need a stable score for QA, experiments, or regression tests, use `finalBaseScore`

### 5. Final Match Score

The user-facing score is still slightly more personalized than `finalBaseScore`.

Canonical formula:

```text
finalMatchScore =
  clamp(
    round(
      finalBaseScore * 0.90 +
      aiFactor * 0.10 +
      queryBoost +
      homeStateFinalBoost
    )
  )
```

Current production rules:

- `aiFactor` defaults to neutral `50` if AI is unavailable or disabled
- `queryBoost` is `0` when there is no strong query match
- `homeStateFinalBoost` is `+2` in the signed-in soft home-state case, otherwise `0`

Important decision:

- `finalMatchScore` is the display/order score
- `finalBaseScore` is the deterministic test anchor

### 6. What Is School-Side vs User-Side

For future work, use this split consistently.

#### School-Side

- admission rate
- completion rate
- degree level
- program inventory
- Washington MRP availability
- published tuition, debt, and aid fields as raw school data

#### User-Side

- GPA
- intended major
- ranking importance
- continue education intent
- cost tolerance
- class size preference
- housing preference
- transportation preference
- in-state/out-of-state preference
- structured location preference
- active query text

#### Hybrid / Contextual

These depend on both the school and the student, so they are tracked as deterministic adjustments instead of being assigned to only one side:

- `preferenceFit`
- `institutionFit`
- `csPathFit`
- `homeStateBoost`
- `aidDebtNudge`
- `costNudge`

### 7. Testability Rules

To keep the model deterministic enough to test:

- treat `finalBaseScore` as the canonical regression-test score
- normalize every major input to an integer `0-100` score before combining
- keep the top-level weights normalized to sum to `1.0`
- keep nudges integer-valued and small
- use neutral `50` defaults when a required score input is missing
- clamp score outputs to `0-100`
- avoid hidden randomness in ranking order

Deterministic test mode should assume:

- `aiFactor = 50`
- `queryBoost = 0` unless the test is specifically about query behavior
- `homeStateFinalBoost` driven only by explicit state inputs

That makes the production ranking logic stable enough to snapshot and regression test.

## Deterministic Nudges and Guardrails

After the weighted core score is computed, the base score is refined with small deterministic rules:

- major evidence count nudge
- extra major evidence nudge for strict academic queries
- major points nudge in strict academic mode
- home-state soft boost
- completion-rate nudge
- aid/debt nudge
- cost nudge when budget preference is active
- institution-level transfer adjustment
- CS pathway adjustment

Guardrails:

- the score is clamped to `0-100`
- if GPA fit is weak for a selective school, the base score can be capped at `65`
- schools with weak major evidence should not climb because of AI alone

## Personalized Layer Rules

The personalized layer is intentionally limited.

### AI Factor

- AI only evaluates the top 20 deterministic candidates.
- AI contributes 10 percent of the final score formula.
- Neutral fallback is `50`.
- If the AI component is disabled, the ranking still works.

### Query Boost

Current query boost range:

- `+8` for strongest text/program matches
- smaller boosts for medium matches
- `0` when the match is weak

Strict academic queries add a safety rule:

- weak major evidence should not receive a strong query boost

### Final Home-State Boost

- small extra final boost for home-state schools when the user did not explicitly ask for in-state filtering but still has a known home state

## Tie-Break Rules

When scores are close or equal, ranking should fall back to deterministic ordering.

Current order:

1. Higher `finalScore`
2. If home-state soft boost mode is active and scores are within 2 points, prefer home-state schools
3. If still tied, prefer home-state schools again when that mode is active
4. If in-state ranking is active, prefer Washington MRP participants
5. Higher completion rate
6. Lower tuition
7. Lower admission rate
8. Alphabetical college name

Important decision:

- there should be no hidden randomness in ranking

## School-Side vs User-Side Signals

For team alignment, use this split when discussing future changes.

### School-Side Signals

- admission rate
- tuition
- debt
- aid rate
- completion rate
- degree level
