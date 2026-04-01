# Transfer Planner General TODO

Last updated: March 31, 2026

## Summary of this doc and what it contains

This is the single backlog doc for the remaining Green River -> UW transfer-planner work inside Mobile.
It tracks the next data, planner-logic, parser, UX, and maintenance steps after the planner docs were split into campus-specific degree files.

## Current status

- The planner docs are now split into `UWS`, `UWB`, and `UWT` degree docs.
- The main planner-facing equivalency assumptions now live in `GRC_EQUIVALENCY_GUIDE_REFERENCE.md`.
- The planner now materializes an explicit per-major `grcCourseList`.
- The planner UI now shows a per-major Green River class list instead of only grouped bank sections.
- The strongest Seattle engineering / computing / HCDE rows now have structured degree-map sections.
- Every campus-major `Exact UW Courses Needed for Full Degree at UW` section should now carry a `Links Used` block when the docs are regenerated.
- The full exact-UW course breakdown beneath `Links Used` is already filled for all `117` UWS majors.
- The full exact-UW course breakdown beneath `Links Used` is still `On To Do list.` for `13` UWB majors and `32` UWT majors.
- Many majors are still `partial`, especially outside the hand-authored engineering / computing set.

## Top priorities

- [ ] Fill every campus-major exact-UW course breakdown that still says `On To Do list.` under `Exact UW Courses Needed for Full Degree at UW` after the `Links Used` block in `UWS_DEGREE_COURSES.md`, `UWB_DEGREE_COURSES.md`, and `UWT_DEGREE_COURSES.md`.
- [ ] Replace broad planner-facing coverage with more exact per-major course lists wherever the docs already support that.
- [ ] Add real Green River quarter availability data so the quarter planner stops implying that all classes run every term.
- [ ] Add logic that prioritizes UW-essential classes first when the student wants the planner to focus on transfer-critical coursework.
- [ ] Validate the transcript parser against more real unofficial transcript examples.

## Data backlog

### Green River data

- [ ] Add full `2024-2025` and `2025-2026` requirements for the engineering-relevant Green River tracks:
  - `999B`
  - `999Q`
  - `999O`
  - `999P`
- [ ] Expand every `SELECT COURSE FROM LIST` slot by catalog year instead of leaving it as a placeholder.
- [ ] Pull the student's Green River start year from the unofficial transcript when possible; if it is missing, assume the student is just starting.
- [ ] Add quarter availability by year for recommended Green River classes:
  - fall / winter / spring / summer
  - once-per-year offerings
  - rotating / disappearing offerings
- [ ] Add prerequisite and co-requisite chains for engineering-support classes such as:
  - `ENGR 140`
  - `ENGR 250`
  - `ENGR& 204`
  - `ENGR& 214`
  - `ENGR& 215`
  - `ENGR& 224`
  - `ENGR& 225`
- [ ] Add advisor-approved humanities and social-science filler examples that stay track-safe.
- [ ] Document financial-aid and degree-audit constraints for students who need off-track add-on courses.

### UW major data

- [ ] Keep pushing more majors from transfer-prep coverage toward fuller bachelor's-degree coverage.
- [ ] Mark each requirement clearly as one of:
  - required before application
  - required before enrollment
  - worth finishing at Green River
  - better saved for UW
- [ ] Add advisor-reviewed confirmation when multiple GRC equivalents exist for the same major path.
- [ ] Add grade minimum and sequencing caveats where the technical equivalency is not the strongest planning choice.
- [ ] Save year-specific department notes or snapshots so planner logic does not depend only on the current live web page.

### Exact UW degree-map course backlog from the campus docs

- [x] Fill the exact-UW course breakdown after `Links Used` for all `UWS` majors. No `UWS` majors are still marked `On To Do list.` in that exact-UW section.
- [ ] Fill the exact-UW course breakdown after `Links Used` for `13` `UWB` majors still marked `On To Do list.`:
  - `Interdisciplinary Studies: Individualized Study (BA)`
  - `Law, Economics & Public Policy (BA)`
  - `Mathematical Thinking & Visualization (BA)`
  - `Mathematics (BS)`
  - `Mechanical Engineering`
  - `Media & Communications Studies (BA)`
  - `Nursing (BS), First Year RN to BSN (Direct Entry)`
  - `Nursing (BS), RN to BSN`
  - `Physics (BA)`
  - `Physics (BS)`
  - `Psychology (BA)`
  - `Science, Technology & Society (BA)`
  - `Society, Ethics & Human Behavior (BA)`
- [ ] Fill the exact-UW course breakdown after `Links Used` for `32` `UWT` majors still marked `On To Do list.`:
  - `Arts, Media and Culture (BA)`
  - `Bachelor of Arts in Business Administration (BABA)`
  - `Biomedical Sciences (BS)`
  - `Civil Engineering (BSCE)`
  - `Communications (BA)`
  - `Computer Engineering`
  - `Computer Science and Systems (BA)`
  - `Computer Science and Systems (BS)`
  - `Criminal Justice (BA)`
  - `Economics and Policy Analysis (BA)`
  - `Education (BA)`
  - `Electrical Engineering`
  - `Environmental Science (BS)`
  - `Environmental Sustainability (BA)`
  - `Ethnic, Gender and Labor Studies (BA)`
  - `Healthcare Leadership (BA)`
  - `History (BA)`
  - `Information Technology (BS)`
  - `Interdisciplinary Arts and Sciences (BA)`
  - `Interdisciplinary Arts and Sciences: Individually-designed (BA)`
  - `Law and Policy (BA)`
  - `Mathematics (BS)`
  - `Mechanical Engineering`
  - `Nursing (BSN)`
  - `Politics, Philosophy and Economics (BA)`
  - `Psychology (BA)`
  - `Social Welfare (BA)`
  - `Spanish Language and Cultures (BA)`
  - `Sustainable Urban Development (BA)`
  - `Urban Design (BS)`
  - `Urban Studies (BA)`
  - `Writing Studies (BA)`

### Per-campus validation follow-up

- [ ] Validate the newly lifted Seattle detailed rows against the next department refresh:
  - `Electrical & Computer Engineering`
  - `Bioengineering`
  - `Chemical Engineering`
  - `Civil Engineering`
  - `Environmental Engineering`
  - `Human Centered Design & Engineering`
  - `Industrial & Systems Engineering`
  - `Materials Science & Engineering`
- [ ] Validate Bothell `Computer Engineering`, `Mechanical Engineering`, and `CSSE` against the next worksheet year.
- [ ] Validate Tacoma `Computer Engineering`, `Electrical Engineering`, and `Mechanical Engineering` against the next catalog year.
- [ ] Convert the next batch of `partial` majors in the three campus degree docs into hand-authored planner rows.

## Quarter planner backlog

- [ ] Add real quarter-by-quarter Green River offering history for `2024-2025`, `2025-2026`, and later years as they publish.
- [ ] Add typical credit-load guidance for students who work while taking classes.
- [ ] Tag recommended GRC courses as `core STEM` vs `lighter elective / general-ed`.
- [ ] Replace generic placeholders with curated substitute buckets for:
  - `5 credits of humanities`
  - `5 credits of social science`
  - `5 credits of elective/general education`
- [ ] Add a rule for when the planner should intentionally suggest `2 core classes` instead of `1 core + 2 easier classes`.

## Transcript parser backlog

- [ ] Validate the parser against more unofficial transcript samples with:
  - repeated courses
  - withdrawals
  - transfer credit from another school
  - in-progress current-quarter classes
  - older transcript layouts
- [ ] Reconfirm that the parser should always ignore:
  - current classes
  - planned classes
  - zero-earned-credit rows
  - summary rows

## Product and UX backlog

- [ ] Keep the planner framed as advisor-reviewed planning guidance, not an official degree audit.
- [ ] Add clearer confidence and warning language for majors that still only have transfer-prep coverage.
- [ ] Add stronger campus-specific wording when Bothell or Tacoma recommendations are less complete.
- [ ] Decide whether the app should surface:
  - readiness to apply
  - best-fit Green River track confidence
  - stronger "take this next quarter" reasoning
- [ ] Add involvement, leadership, and project guidance where it materially helps transfer competitiveness.

## Technical backlog

- [ ] Decide whether `bankIds` should remain as a reference/debug layer or eventually be removed after all per-major lists are frozen.
- [ ] If we want fully hand-authored source data, replace generated `grcCourseList` derivation with explicitly stored arrays for every major row.
- [ ] Add stronger tests for:
  - generated partial-major course lists
  - course-list deduplication
  - sequence ordering edge cases
  - planner behavior when a major has no structured quarter template
- [ ] Consider moving planner data maintenance into a more editor-friendly source once the schema settles.

## Recommended next pass

If we want the highest-value next pass, do this in order:

1. Fill the next named batch of `Exact UW Courses Needed for Full Degree at UW` sections from the exhaustive `UWS` / `UWB` / `UWT` lists above.
2. Expand Green River yearly track requirements and every `SELECT COURSE FROM LIST` slot.
3. Add real quarter availability history for the classes the planner recommends.
4. Validate the newly lifted Seattle detailed rows against the next department refresh.
5. Validate Bothell `Computer Engineering`, `Mechanical Engineering`, and `CSSE` against the next worksheet year.
6. Validate Tacoma `Computer Engineering`, `Electrical Engineering`, and `Mechanical Engineering` against the next catalog year.
7. Validate the transcript parser against a larger unofficial-transcript sample set.

## Source docs

Use these docs as the source of truth while closing the backlog:

- [GRC_EQUIVALENCY_GUIDE_REFERENCE.md](./GRC_EQUIVALENCY_GUIDE_REFERENCE.md)
- [UWS_DEGREE_COURSES.md](./UWS_DEGREE_COURSES.md)
- [UWB_DEGREE_COURSES.md](./UWB_DEGREE_COURSES.md)
- [UWT_DEGREE_COURSES.md](./UWT_DEGREE_COURSES.md)
- [TRANSFER_PLANNER_TOOL_SUMMARY.md](./TRANSFER_PLANNER_TOOL_SUMMARY.md)
