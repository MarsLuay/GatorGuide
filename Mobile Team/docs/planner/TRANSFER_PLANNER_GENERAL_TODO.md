# Transfer Planner General TODO

Last updated: April 10, 2026

This is the single backlog doc for the remaining Green River -> UW transfer-planner work inside Mobile.

It is meant to answer one question quickly:

- what is already done
- what is still missing
- what should be tackled next

## Current Status

Completed recently:

- The planner now materializes an explicit per-major `grcCourseList` in app data.
- The planner UI now shows a per-major Green River class list instead of only grouped bank sections.
- The planner refresh pipeline now rebuilds source checks, primary-source discovery, source-gap reporting, requirement parsing, diff promotion, fingerprints, equivalency rules, catalog ingest outputs, metadata, availability, docs, and tests.
- The one-pass Windows maintenance launcher now runs:
  - planner refresh
  - verification
  - hardening checks
  - Playwright Chromium setup
  - Windows screenshot QA
  - Windows interaction QA
- The current student-visible source-gap registry is empty.
- The current primary requirement parser is succeeding for all tracked visible owners.
- Green River availability fallback notes were replaced with generated machine statuses.
- The planner docs and runtime wording now align on `source-backed or hidden`.

Current green-state baseline:

- hidden source-gap owners: `0`
- primary requirement parses: `244/244`
- Green River catalog ingest rows: `1458`
- planner-relevant UW catalog rows: `915`
- merged generated course metadata rows: `2376`
- latest one-pass command: `npm run planner:full:verify`

Still true:

- The planner should stay `source-backed or hidden`.
- The remaining work is mostly parser depth, safer automatic promotion, transcript robustness, and maintenance hardening.
- The goal is to remove stale wording and hand-maintained planner facts, not to add guesswork.

## Main Goal

Keep moving the planner toward:

- source-backed per-major Green River class lists
- better quarter-by-quarter realism
- stronger transcript matching
- clearer campus-specific and major-specific guidance
- one-command maintenance that non-developers can run safely without touching planner code

## Top Priorities

- [ ] Keep improving source-family adapters so `npm run planner:refresh` can safely parse more UW department pages without falling back to broad note coverage.
- [ ] Continue shrinking the `source-backed` but non-promoted classification buckets into cleaner automatic Green River equivalents where the public sources support it.
- [ ] Keep improving quarter planning from source-backed prerequisite and availability data.
- [ ] Validate the transcript parser against more real unofficial transcript examples.
- [ ] Keep the generated docs, README guidance, and launchers aligned with the actual maintenance contract: source-backed or hidden, never guessed.

## Data Backlog

### Green River Data

- [x] Add full `2024-2025` and `2025-2026` requirements for the engineering-relevant Green River tracks:
  - `999B`
  - `999Q`
  - `999O`
  - `999P`
- [x] Expand every `SELECT COURSE FROM LIST` slot by catalog year instead of leaving it as a placeholder.
- [x] Infer the student's likely Green River catalog year from the unofficial transcript when transcript history exists, and fall back to the current start-year path when it does not.
- [x] Add quarter availability by year for recommended Green River classes from the latest published schedules:
  - fall / winter / spring / summer
  - once-per-year offerings
  - rotating / disappearing offerings
- [ ] Extend that same availability history as future Green River schedules publish.
- [ ] Add stronger prerequisite and co-requisite normalization for engineering-support classes such as:
  - `ENGR 140`
  - `ENGR 250`
  - `ENGR& 204`
  - `ENGR& 214`
  - `ENGR& 215`
  - `ENGR& 224`
  - `ENGR& 225`
- [ ] Add source-backed humanities and social-science filler examples that stay track-safe.
- [ ] Document financial-aid and degree-audit constraints for students who need off-track add-on courses.

### UW Major Data

- [ ] Keep improving full bachelor's degree-map coverage for supported majors, not just transfer admission prerequisites.
- [ ] Keep each requirement clearly marked as one of:
  - required before application
  - required before enrollment
  - worth finishing at Green River
  - better saved for UW
- [ ] Add richer source-backed rule handling when multiple GRC equivalents exist.
- [ ] Add grade minimum and sequencing caveats where the technical equivalency is not the strongest planning choice.
- [ ] Save year-specific department notes or snapshots so planner logic does not depend only on the current live web page.

## Per-Major Backlog

- [x] Seattle, Bothell, and Tacoma student-visible majors now resolve through source-backed planner rows instead of a mixed partial-major surface.
- [ ] Reduce the current English Creative Writing-style automation gap:
  - `34` majors are a strict match for the English Creative Writing pattern: all of their parsed source-backed gaps currently land in `source-backed-choice-set-no-public-grc-path`, and none of those gaps auto-promote.
  - Exact current `planId`s in that strict bucket:
    - `uw-seattle-anthropology`
    - `uw-seattle-applied-and-computational-mathematical-sciences`
    - `uw-seattle-applied-mathematics`
    - `uw-seattle-cinema-and-media-studies`
    - `uw-seattle-classics`
    - `uw-seattle-communication`
    - `uw-seattle-community-environment-and-planning`
    - `uw-seattle-dance`
    - `uw-seattle-design`
    - `uw-seattle-disability-studies`
    - `uw-seattle-drama`
    - `uw-seattle-education-communities-and-organizations`
    - `uw-seattle-education-studies`
    - `uw-seattle-english-creative-writing`
    - `uw-seattle-european-studies`
    - `uw-seattle-finnish`
    - `uw-seattle-french`
    - `uw-seattle-greek`
    - `uw-seattle-individualized-studies`
    - `uw-seattle-informatics`
    - `uw-seattle-latin`
    - `uw-seattle-linguistics`
    - `uw-seattle-middle-eastern-languages-and-cultures`
    - `uw-seattle-nursing`
    - `uw-seattle-philosophy`
    - `uw-seattle-real-estate`
    - `uw-seattle-social-welfare`
    - `uw-seattle-sociology`
    - `uw-seattle-speech-and-hearing-sciences`
    - `uw-seattle-swedish`
    - `uw-tacoma-civil-engineering`
    - `uw-tacoma-computer-science-and-systems-bs`
    - `uw-tacoma-history`
    - `uw-tacoma-spanish-language-and-cultures`
  - `0` majors currently manifest that same gap in the student runtime: the generic `Custom source-backed Green River prep` fallback no longer appears in current runtime plans.
  - The former empty-runtime bucket is now handled automatically with either `UW prep target: ...` rows or `Source-backed UW prep guidance`.
  - Exact `planId`s addressed in the last empty-runtime cleanup pass:
    - `uw-seattle-american-indian-studies`
    - `uw-seattle-asian-languages-and-cultures`
    - `uw-seattle-asian-studies`
    - `uw-seattle-chinese`
    - `uw-seattle-classical-studies`
    - `uw-seattle-comparative-history-of-ideas`
    - `uw-seattle-danish`
    - `uw-seattle-ethnomusicology-b-a`
    - `uw-seattle-gender-women-and-sexuality-studies`
    - `uw-seattle-global-literary-studies`
    - `uw-seattle-japanese`
    - `uw-seattle-jewish-studies`
    - `uw-seattle-korean`
    - `uw-seattle-norwegian`
    - `uw-seattle-oceanography`
    - `uw-seattle-scandinavian-area-studies`
    - `uw-seattle-slavic-languages-and-literatures`
    - `uw-seattle-south-asian-languages-and-cultures`
    - `uw-bothell-developmental-and-youth-studies`
    - `uw-bothell-educational-studies-elementary-education`
    - `uw-bothell-health-studies`
    - `uw-bothell-interactive-media-design`
    - `uw-bothell-interdisciplinary-studies-individualized-study`
    - `uw-bothell-nursing-first-year-rn-to-bsn`
    - `uw-bothell-nursing-rn-to-bsn`
    - `uw-tacoma-healthcare-leadership`
    - `uw-tacoma-information-technology`
    - `uw-tacoma-nursing`
- [ ] Keep promoting source-backed course cues into structured requirement atoms where the public source is clear enough to support automatic promotion.
- [ ] Keep reducing broad note coverage for majors whose public degree pages now expose cleaner course-level structure.
- [ ] Keep source-backed pathway variants aligned when an official department page changes route wording or internal option names.

## Quarter Planner Backlog

- [x] Add real quarter-by-quarter Green River offering history for `2024-2025` and `2025-2026`.
- [ ] Extend that same quarter-by-quarter offering history as later years publish.
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

- [ ] Keep the planner framed as source-backed planning guidance, not an official degree audit.
- [ ] Add clearer confidence and warning language for majors with only transfer-prep coverage.
- [ ] Add stronger campus-specific wording when Bothell or Tacoma recommendations are less complete.
- [ ] Decide whether the app should surface:
  - readiness to apply
  - best-fit Green River track confidence
  - stronger "take this next quarter" reasoning
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
  - runs high-confidence primary-source discovery and promotion
  - rebuilds source-gap reports
  - parses current primary degree pages
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
- [x] Add internal source-gap reporting:
  - `npm run planner:build-primary-review-queue`
  - `npm run planner:build-source-gaps`
  - writes internal source-gap automation files into `.tmp/`
- [x] Add a first requirement-parser step:
  - `npm run planner:parse-requirement-sources`
  - parses current primary HTML and PDF degree-requirements sources
  - extracts UW course codes plus requirement cues
  - compares them against the structured degree-map blocks already in the planner
  - writes parse report and source snapshots into `.tmp/`
- [x] Add a safe requirement-diff promotion step:
  - `npm run planner:promote-requirement-diffs`
  - reruns requirement parsing first when needed
  - only auto-promotes high-confidence parsed requirement diffs when the current planner already has strong exact-title UW-to-GRC consensus
  - writes promoted requirement atoms into a generated override file that the structured requirement registry honors
  - writes a classification report into `.tmp/` for automatically classified and still-non-promoted course codes
- [x] Add the generated hidden-source-gap registry and hardening verifier so visible majors stay source-backed or hidden in one maintenance pass.
- [x] Replace Green River availability fallback notes with generated machine statuses.
- [ ] Add structured major or pathway traits for best-track policy generation:
  - `bestTrackId`
  - `bestTrackSummary`
  - `whyThisTrack`
  - `financialAidNote`
- [ ] Keep improving source-family importers for live planner maintenance:
  - UW HTML requirement-page parsers
  - UW PDF degree-sheet extractors
  - source diff classification so cosmetic page changes do not look like requirement changes
  - source-gap reports for majors that still need more parser/source coverage
- [ ] Keep moving the source-refresh pipeline toward direct structured source-manifest consumption:
  - fetch snapshots by manifest entry
  - run the parser implied by `parserType`
  - compare extracted requirement atoms against current structured rows
  - auto-promote only high-confidence diffs
- [ ] Add one explicit `primaryDegreeRequirementsLink` field per major or pathway so the UI does not need to heuristically choose the single displayed UW degree page.
- [ ] Add family-based policy templates for repeated planner copy such as:
  - `summary`
  - `applicationWindow`
  - `startQuarter`
  - repetitive source-coverage notes
- [ ] Decide whether `bankIds` should remain as a reference/debug layer or eventually be removed after all per-major lists are frozen.
- [ ] Add stronger tests for:
  - generated partial-major course lists
  - course-list deduplication
  - sequence ordering edge cases
  - planner behavior when a major has no structured quarter template
- [ ] Consider moving planner data maintenance into a more editor-friendly source once the schema settles.

## Recommended Next Pass

If we want the highest-value next pass, do this in order:

1. Keep improving parser depth for majors whose public pages still only yield broad note coverage or sparse parsed course-code structure.
2. Shrink the non-promoted but source-backed classification buckets into cleaner automatic Green River equivalents where the public evidence is strong enough.
3. Validate the transcript parser against a larger unofficial-transcript sample set.
4. Extend Green River availability history when newer annual schedules publish.
5. Keep generated planner docs, launchers, and maintenance reports aligned with the current source-backed-or-hidden contract.

## Source Docs

Use these docs as the source of truth while closing the backlog:

- [TRANSFER_PLANNER_TOOL_SUMMARY.md](./TRANSFER_PLANNER_TOOL_SUMMARY.md)
- [TRANSFER_PLANNER_SOURCE_VERIFIED_AUTOMATION_PLAN.md](./TRANSFER_PLANNER_SOURCE_VERIFIED_AUTOMATION_PLAN.md)
- [GRC_EQUIVALENCY_GUIDE_REFERENCE.md](./GRC_EQUIVALENCY_GUIDE_REFERENCE.md)
- [UWS_DEGREE_COURSES.md](./UWS_DEGREE_COURSES.md)
- [UWB_DEGREE_COURSES.md](./UWB_DEGREE_COURSES.md)
- [UWT_DEGREE_COURSES.md](./UWT_DEGREE_COURSES.md)
