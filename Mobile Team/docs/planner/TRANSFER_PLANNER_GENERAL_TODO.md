# Transfer Planner General TODO

Last updated: April 3, 2026

This is the single backlog doc for the remaining Green River -> UW transfer-planner work inside Mobile.

It is meant to answer one question quickly:

- what is already done
- what is still missing
- what should be tackled next

## Current Status

Completed recently:

- The planner now materializes an explicit per-major `grcCourseList` in app data.
- The planner UI now shows a per-major Green River class list instead of only grouped bank sections.
- Existing planner tests were updated and are passing again.
- A one-command planner refresh pipeline now exists to check tracked source URLs, refresh the official Green River annual schedule PDFs, regenerate planner artifacts, and rerun verification.
- The refresh flow now also auto-promotes high-confidence primary degree pages and leaves a campus-grouped review queue for the remaining medium-confidence or unresolved source candidates.
- There are now double-clickable Windows launchers in `scripts/` for non-dev planner refresh runs, with saved logs and automatic opening of the review outputs.
- The refresh flow now also runs a first-pass requirement parser against current primary degree pages and leaves a parse-diff report showing where live UW sources mention course codes not currently reflected in the structured degree-map layer.
- The refresh flow now also auto-promotes only high-confidence parsed requirement diffs into generated structured requirement atoms, and leaves a promotion report for the remaining review-needed or unmapped course codes.

Still true:

- Current planner majors are now `detailed`.
- A number of majors still only have transfer-prep coverage, not a full advisor-grade degree map.
- Bothell and Tacoma still need more normalized major data.

## Main Goal

Keep moving the planner toward:

- advisor-reviewed per-major Green River class lists
- better quarter-by-quarter realism
- stronger transcript matching
- clearer campus-specific and major-specific guidance

## Top Priorities

- [ ] Finish the remaining major-by-major data extraction so more majors move from `partial` to `detailed`.
- [ ] Add source-family adapters so `npm run planner:refresh` can auto-lift more UW department requirement pages instead of only checking links and rebuilding from current structured data.
- [ ] Keep moving major-level hardcoding into the structured source layer so planner behavior does not depend on row-by-row manual overrides.
- [ ] Replace broad planner-facing coverage with more exact per-major course lists wherever the docs already support that.
- [ ] Add real Green River quarter availability data so the quarter planner stops implying that all classes run every term.
- [ ] Add logic that prioiritizes finishing 'essential' classes that transfer into UW first (If differential equations is on the transfer track but UW doesnt need, have thatt be one of the last classes to take when the uw essential checkbox is off):
- [ ] Validate the transcript parser against more real unofficial transcript examples.

## Data Backlog

### Green River Data

- [ ] Add full `2024-2025` and `2025-2026` requirements for the engineering-relevant Green River tracks:
  - `999B`
  - `999Q`
  - `999O`
  - `999P`
  this will be used in the backend eventually to see if a previous year would be better for you when it comes to transferring instead of staying on the current year equivlancy and bachelor program. 
- [ ] Expand every `SELECT COURSE FROM LIST` slot by catalog year instead of leaving it as a placeholder.
- [ ] have the year they started be ripped from their unofficial transcript, and if one not given, assume they are just starting
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

### UW Major Data

- [ ] Add the full bachelor's degree maps for supported majors, not just transfer admission prerequisites.
- [ ] Mark each requirement clearly as one of:
  - required before application
  - required before enrollment
  - worth finishing at Green River
  - better saved for UW
- [ ] Add advisor-reviewed confirmation when multiple GRC equivalents exist.
- [ ] Add grade minimum and sequencing caveats where the technical equivalency is not the strongest planning choice.
- [ ] Save year-specific department notes or snapshots so planner logic does not depend only on the current live web page.

## Per-Major Backlog

### Seattle


  - `UWS`: `55` detailed, `0` partial
- [ ] Pull the current public Bothell CompE / ME / CSSE degree-checklist details into normalized JSON instead of relying on PDFs.
- [ ] Confirm year-specific equivalent major worksheets where available.
  - Total: `130` detailed, `0` partial

### Tacoma

  - `UWT`: `32` detailed, `0` partial

- [ ] Convert Tacoma catalog major course lists into structured planner data.
- [ ] Pull Tacoma major planning details while the Tacoma equivalency guide is still under maintenance.
- [ ] Review which Seattle recommendations do and do not safely carry over to Tacoma.

### Partial / Support-Only Majors

- [ ] Review majors marked `support-only` and decide which ones should keep lightweight guidance vs move toward stronger per-major lists.
- [ ] Review majors marked `varies` or `custom bank set` and replace that language with explicit per-major lists where the source docs are strong enough.
- [ ] Decide whether the long-term goal is:
  - planner-owned explicit arrays for every major
  - or generated arrays backed by shared libraries plus advisor notes

## Quarter Planner Backlog

- [ ] Add real quarter-by-quarter Green River offering history for `2024-2025`, `2025-2026`, and later years as they publish.
- [ ] Add typical credit-load guidance for students who work while taking classes.
- [ ] Tag recommended GRC courses as `core STEM` vs `lighter elective / general-ed`.
- [ ] Replace generic placeholders with curated substitute buckets for:
  - `5 credits of humanities`
  - `5 credits of social science`
  - `5 credits of elective/general education`
- [ ] Add a rule for when the planner should intentionally suggest `2 core classes` instead of `1 core + 2 easier classes`.

## Transcript Parser Backlog

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

## Product And UX Backlog

- [ ] Keep the planner framed as advisor-reviewed planning guidance, not an official degree audit.
- [ ] Add clearer confidence/warning language for majors with only transfer-prep coverage.
- [ ] Add stronger campus-specific wording when Bothell or Tacoma recommendations are less complete.
- [ ] Decide whether the app should surface:
  - readiness to apply
  - best-fit Green River track confidence
  - stronger “take this next quarter” reasoning
- [ ] Add involvement, leadership, and project guidance where it materially helps transfer competitiveness.

## Technical Backlog

- [x] Move checklist phase overrides into the structured major-requirement registry with source `phase` plus student-facing `displayPhase`, so runtime bucket rebalancing no longer depends on a hardcoded exception list.
- [x] Add subject-aware fallback planner guidance for checklist items that do not have a hand-authored note, so missing notes no longer collapse to one generic sentence.
- [x] Auto-synthesize fallback `stayAtGrcChecklist` items from the degree-specific Green River course list when a source-generated major would otherwise have all three checklist buckets empty.
- [x] Add a structured source-manifest registry with source role, parser type, confidence, validation notes, and one explicit primary degree-requirements link per major/pathway/track source set.
- [x] Add a one-command planner refresh pipeline:
  - `npm run planner:check-sources`
  - `npm run planner:refresh`
  - writes source-link snapshots into `.tmp/`
  - now also runs high-confidence primary-source discovery + promotion
  - now also rebuilds a medium-confidence / unresolved primary-source review queue
  - now also parses current primary degree pages and leaves a source-vs-structured requirement report
  - refreshes official Green River schedule PDFs
  - regenerates bootstrap, metadata, availability, and docs
  - reruns typecheck plus planner tests
- [x] Add a primary-source discovery helper:
  - `npm run planner:discover-primary-sources`
  - scans majors and pathways that still lack an explicit primary degree-requirements source
  - scores current official links plus first-hop internal links
  - writes ranked candidate reports into `.tmp/`
- [x] Add a safe primary-source promotion step:
  - `npm run planner:promote-primary-sources`
  - reruns discovery first
  - auto-promotes only `high-confidence` candidates
  - writes them into a generated override file that the source-manifest registry now honors
- [x] Add a primary-source review queue step:
  - `npm run planner:build-primary-review-queue`
  - reruns discovery first
  - groups remaining `medium-confidence` and `no good suggestion yet` owners by campus
  - writes manual follow-up queue files into `.tmp/`
- [x] Add a first requirement-parser step:
  - `npm run planner:parse-requirement-sources`
  - parses current primary HTML and PDF degree-requirements sources
  - extracts UW course codes plus requirement cues
  - compares them against the structured degree-map blocks already in the planner
  - writes parse report and source snapshots into `.tmp/`
- [x] Add a safe requirement-diff promotion step:
  - `npm run planner:promote-requirement-diffs`
  - reruns requirement parsing first when needed
  - only auto-promotes `high-confidence` parsed requirement diffs when the current planner already has strong exact-title UW-to-GRC requirement consensus
  - writes promoted requirement atoms into a generated override file that the structured requirement registry now honors
  - writes a promotion report into `.tmp/` for review-needed and still-unmapped course codes
- [ ] Add structured major or pathway traits for best-track policy generation:
  - `bestTrackId`
  - `bestTrackSummary`
  - `whyThisTrack`
  - `financialAidNote`
- [ ] Add source-family importers for live planner maintenance:
  - UW HTML requirement-page parsers
  - UW PDF degree-sheet extractors
  - source diff classification so cosmetic page changes do not look like requirement changes
  - review queues for majors that still need human interpretation
- [ ] Make the source-refresh pipeline consume the structured source-manifest registry directly:
  - fetch snapshots by manifest entry
  - run the parser implied by `parserType`
  - compare extracted requirement atoms against current structured rows
  - auto-promote only high-confidence diffs
- [ ] Add one explicit `primaryDegreeRequirementsLink` field per major or pathway so the UI does not need to heuristically choose the single displayed UW degree page.
- [ ] Add family-based policy templates for repeated planner copy such as:
  - `summary`
  - `applicationWindow`
  - `startQuarter`
  - repetitive `advisorFlags`
- [ ] Decide whether `bankIds` should remain as a reference/debug layer or eventually be removed after all per-major lists are frozen.
- [ ] If we want fully hand-authored source data, replace generated `grcCourseList` derivation with explicitly stored arrays for every major row.
- [ ] Add stronger tests for:
  - generated partial-major course lists
  - course-list deduplication
  - sequence ordering edge cases
  - planner behavior when a major has no structured quarter template
- [ ] Consider moving planner data maintenance into a more editor-friendly source once the schema settles.

## Recommended Next Pass

If we want the highest-value next pass, do this in order:

1. Finish the remaining Seattle engineering degree-map extractions:
   - ECE
   - BSCE
   - BSENVE
   - MSE
   - BSIE
2. Expand Green River yearly track requirements and every `SELECT COURSE FROM LIST` slot.
3. Add real quarter availability history for the classes the planner recommends.
4. Normalize Bothell CompE / ME / CSSE degree data.
5. Convert Tacoma major course lists into structured planner data.
6. Validate the transcript parser against a larger unofficial-transcript sample set.

## Source Docs

Use these docs as the source of truth while closing the backlog:

- [GRC_UW_ENGINEERING_TRANSFER_PLANNER.md](./GRC_UW_ENGINEERING_TRANSFER_PLANNER.md)
- [COURSE_PLANNER_MAJORS_AND_DEGREE_REQUIREMENTS.md](./COURSE_PLANNER_MAJORS_AND_DEGREE_REQUIREMENTS.md)
- [UW_ALL_BACHELOR_DEGREES_GRC_TRANSFER_PLANNER_MASTER.md](./UW_ALL_BACHELOR_DEGREES_GRC_TRANSFER_PLANNER_MASTER.md)
- [GRC_TRANSFER_OUTLINE_GENERATOR_SPEC.md](./GRC_TRANSFER_OUTLINE_GENERATOR_SPEC.md)
