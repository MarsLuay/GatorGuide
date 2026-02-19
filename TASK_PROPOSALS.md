# Codebase Task Proposals

This document captures four concrete, scoped tasks discovered while reviewing the repository.

## 1) Typo fix task

**Task:** Fix the English typo in the Tagalog translation entry:
- Change `"University at College Transfer Hub (GRC)"` to `"University and College Transfer Hub (GRC)"` in `services/translations.ts`.

**Why:** The phrase `at` is a typo in this context and degrades translation quality/user trust.

## 2) Bug fix task

**Task:** Prevent timeout handle leaks in `fetchScorecardUrl` by moving `clearTimeout(id)` into a `finally` block.

**Why:** Right now `clearTimeout(id)` only runs on the success path after `fetch` resolves. If `fetch` rejects (network failure, aborted request, etc.), the timer is not cleared immediately, which can accumulate unnecessary pending timers.

## 3) Code comment/documentation discrepancy task

**Task:** Update `services/README.md` to match real stub behavior in `college.service.ts`:
- It currently says the college service returns **3 mock Florida colleges**.
- The implementation currently returns **5 mixed WA/FL entries** in stub mode.

**Why:** This mismatch can mislead contributors during manual verification and onboarding.

## 4) Test improvement task

**Task:** Strengthen `scripts/scorecard_test.js` from a logging-only script into a real validation script by:
- Adding explicit assertions (non-empty `results`, required fields like `id` and `school.name`, expected metadata shape).
- Exiting with non-zero status on assertion failures.
- Optionally accepting CLI flags for `--query`, `--per-page`, and timeout to make regression checks reproducible.

**Why:** The current script prints output but can pass silently even when response shapes regress.
