# Transfer Planner Tool Summary

Last updated: April 8, 2026

## Summary of this doc and what it contains

This doc explains what the Green River -> UW transfer planner currently does, what data shape it uses, and what it should and should not promise to students.

## Operational Contract

If a planner fact is not backed by an official public source, the planner should not show it to students.

The maintenance rule is:

- refresh the planner from official sources
- regenerate the structured outputs
- rerun verification, hardening checks, and Windows QA
- keep unsupported or unverified majors hidden instead of hand-editing planner facts

The current one-click Windows entrypoints are:

- `npm run planner:windows:maintenance`
- `npm run planner:full:verify`
- `..\Course-Planner-Updater.bat`

The maintenance launcher is interactive now:

- it can run the full flow
- it can run the full flow while skipping downloads
- it can run Course updates only
- it can run Course updates only while skipping downloads
- it can run one section only
- it can start from a chosen section and complete the rest
- it can print a cache summary showing what artifacts already exist and when the latest maintenance/refresh runs happened
- it can open an `Edit course links` flow that browses institution, then campus or Green River program group, then major/program before saving source-link edits through the source-manifest override layer
- it now prints a `Laymans Diagnosis` section when the tooling can explain a failure or important warning in plain language

The run summary is written to:

- `.tmp/transfer-planner-maintenance-summary.md`

The current green-state maintenance baseline is:

- hidden student-visible source gaps: `0`
- primary requirement-source parses: `244/244`
- Green River catalog ingest rows: `1458`
- planner-relevant UW catalog rows: `915`
- generated merged course-metadata rows: `2376`
- latest full pass: `npm run planner:full:verify`

## Planner accuracy signal

The trusted planner accuracy signal is the `source-backed-runtime-coverage` gate in `.tmp/reports/transfer-planner-source-backed-coverage-audit.md` and `.json`.

The old `legacy-transfer-planner-service-test.*` artifacts are diagnostic only. They are not an accuracy percentage, and stale copies are retired by the refresh flow into `.stale.*` files with a status report at `.tmp/reports/legacy-transfer-planner-service-test.status.md`.

## What the planner is

- A Green River College transfer-planning tool for UW Seattle, UW Bothell, and UW Tacoma.
- A planner that works per row of `source college + target campus + target major`.
- A planning tool that compares transcript courses against Green River equivalents and requirement buckets.

## What the planner currently uses

- An explicit per-major `grcCourseList`.
- A year-aware Green River track reference for `999B`, `999Q`, `999O`, and `999P`, including planner-owned expansions for the engineering `SELECT COURSE FROM LIST` slots.
- Course-level Green River quarter-availability history from the latest published `2024-2025` and `2025-2026` annual schedules, with planner summaries attached when a tracked course is found there.
- Requirement buckets for:
  - required before application
  - required before enrollment
  - worth finishing at Green River
- Structured degree-map notes for the majors that now have deeper campus-specific coverage.
- The transcript parser plus the planner's major/campus selection flow.
- A new layered planner-source foundation in `constants/transfer-planner-source/`:
  - `schema.ts`
  - `registry.ts`
  - `index.ts`
- A normalized canonical course-metadata seed in `constants/transfer-planner-source/course-metadata.ts` for planner-critical courses, now carrying titles, credits, prerequisite/co-requisite structure fields, and effective-year ranges where the current sources support them.
- A generated Green River schedule-metadata layer in `constants/transfer-planner-source/course-metadata.generated.ts`, sourced from the official `2024-2025` and `2025-2026` annual schedules to widen title and year-range coverage across many additional planner-tracked GRC courses.
- A one-command refresh pipeline in:
  - `scripts/planner/check-transfer-planner-sources.cjs`
  - `scripts/planner/discover-transfer-planner-primary-sources.cjs`
  - `scripts/planner/build-transfer-planner-primary-source-review-queue.cjs`
  - `scripts/planner/build-transfer-planner-source-gap-report.cjs`
  - `scripts/planner/parse-transfer-planner-requirement-sources.cjs`
  - `scripts/planner/build-transfer-planner-source-fingerprints.cjs`
  - `scripts/planner/parse-transfer-planner-equivalency-guide.cjs`
  - `scripts/planner/ingest-grc-catalog.cjs`
  - `scripts/planner/ingest-uw-catalog.cjs`
  - `scripts/planner/generate-transfer-planner-course-metadata.cjs`
  - `scripts/planner/audit-transfer-planner-source-backed-coverage.cjs`
  - `scripts/planner/verify-transfer-planner-hardening.cjs`
  - `scripts/planner/refresh-transfer-planner-sources.cjs`
  - `../Course-Planner-Updater.bat`
  - `scripts/run-transfer-planner-maintenance.ps1`
  - `npm run planner:check-sources`
  - `npm run planner:discover-primary-sources`
  - `npm run planner:build-primary-review-queue`
  - `npm run planner:build-source-gaps`
  - `npm run planner:parse-requirement-sources`
  - `npm run planner:build-source-fingerprints`
  - `npm run planner:parse-equivalency-guide`
  - `npm run planner:ingest-grc-catalog`
  - `npm run planner:ingest-uw-catalog`
  - `npm run planner:build-course-metadata`
  - `npm run planner:audit:source-backed-coverage`
  - `npm run planner:refresh`
  - `npm run planner:verify`
  - `npm run planner:hardening:verify`
  - `npm run planner:windows:maintenance`
  - `npm run planner:full:verify`

## Current migration state

- The layered source-of-truth foundation now exists in code.
- All current student-visible majors now resolve through the planner layer, and the hidden source-gap registry is currently empty for the student-facing planner.
- The current one-pass maintenance run is green end to end, including planner refresh, typecheck, planner tests, hardening verification, and Windows QA.
- The primary requirement parser is currently succeeding for every tracked student-visible owner (`244/244`).
- The canonical course registry, equivalency-rule registry, degree-map block registry, major-requirement registry, and planner-policy registry are bootstrapped from the current planner data.
- The canonical course registry now stores normalized `title`, `creditValue`, `creditLabel`, `prerequisiteAlternativeCourseCodeSets`, `corequisiteAlternativeCourseCodeSets`, and `effectiveYearRanges` fields for the planner-critical seed set.
- The canonical course registry now also widens Green River title coverage through schedule-display metadata generated from the current annual schedules.
- The current generated metadata coverage includes `1458` Green River catalog courses, `915` planner-relevant UW catalog courses, and `2376` merged generated course-metadata rows.
- The normalization is still intentionally strongest for planner-critical Green River STEM and support sequences plus a small set of UW anchor courses. The remaining work is expanding credits, prerequisite/co-requisite structure, and non-abbreviated titles across the long-tail registry without inventing unknown values.
- The planner now also has a structured major-pathway layer in code, with pathway registry entries and runtime pathway resolution for supported majors.
- The planner now also has a structured source-manifest registry in code, with one entry per tracked major/pathway/track source link. Each manifest entry now carries:
  - source role
  - parser type
  - confidence
  - primary degree-requirements flag
  - validation notes
- The equivalency-rule registry now stores structured acceptance categories, weaker-than relationships, effective-year ranges, and planner warnings, so legacy-accepted and accepted-with-warning paths live in one place instead of only in scattered notes.
- The planner page, generated campus docs, service-layer Green River availability lookups, and planner-facing maintenance scripts now read source-layer runtime helpers or source bootstrap snapshots instead of reaching straight into the mixed legacy row list.
- The legacy planner data module is no longer part of the operational runtime path. It now acts as a bootstrap-only source for snapshot generation, while shared planner types live in `transfer-planner-types.ts` and the structured registries keep expanding.
- Requirement atoms now carry both a source `phase` and a student-facing `displayPhase`, so checklist bucket overrides live in the structured registry layer instead of a runtime-only rebalance list.
- The next migration step is shrinking the remaining bootstrap-only role further by moving long-tail non-normalized fields onto the structured registries and eventually replacing temporary bootstrap snapshots with fully source-native maintenance inputs.
- The next hardening step is improving parser depth and transcript-fixture coverage, not reintroducing hand-maintained planner facts.
- `UW Bothell` is now fully included in the actual planner runtime, not just the Bothell markdown doc: every Bothell major row currently exposes official links, UW degree-map sections, and either an explicit Green River course list or explicit custom guidance.
- `UW Tacoma` is now fully included in the actual planner runtime, not just the Tacoma markdown doc: every Tacoma major row currently exposes official links, UW degree-map sections, and either an explicit Green River course list or explicit custom guidance.

## Planned major-path selector behavior

Some majors do not really have one single fixed path.
They have multiple valid internal routes such as:

- `biology-centered path`
- `chemistry-centered path`
- different official options or concentrations that materially change the lower-division planning

The planner should support that directly instead of flattening those majors into one blended list.

The current behavior is:

- A major gets a pathway dropdown only when that major actually has multiple named planner-supported paths.
- If a major has only one path, the dropdown does not appear at all.
- Each pathway should carry its own:
  - requirement atoms
  - Green River equivalent course list
  - degree-map blocks
  - planner warnings
  - official source links
  - validation date
- Switching the dropdown should recompute the main course box, done/missing buckets, and suggested quarter plan for that selected path.
- The planner should never invent a path just to fill the UI. If the docs do not support distinct paths, the dropdown should not exist.

This should be treated as structured planner data, not just a frontend toggle.

The supported pathway-backed majors now include:

- `UW Seattle Biology`
- `UW Seattle Atmospheric and Climate Science`
- `UW Seattle Biochemistry`
- `UW Seattle Chemistry`
- `UW Seattle Earth & Space Sciences`
- `UW Seattle Economics`
- `UW Seattle Geography`
- `UW Seattle Psychology`
- `UW Seattle Public Health - Global Health`
- `UW Seattle Statistics`
- `UW Tacoma Communications (BA)`
- `UW Tacoma Arts, Media and Culture (BA)`
- `UW Tacoma Bachelor of Arts in Business Administration (BABA)`
- `UW Tacoma Environmental Sustainability (BA)`
- `UW Tacoma Ethnic, Gender and Labor Studies (BA)`
- `UW Tacoma Sustainable Urban Development (BA)`
- `UW Tacoma Urban Studies (BA)`
- `UW Tacoma Writing Studies (BA)`

## Best long-term maintenance model

The best long-term solution is not one giant per-major hardcoded file and not one giant freeform "god doc."
The best solution is a layered source-of-truth model with generated planner output.

The recommended layers are:

- `1. Canonical course registry`
  - Store every Green River and UW course once with a stable ID.
  - Keep title, credits, campus, subject, level, quarter availability by year, prerequisites, co-requisites, effective years, and source links here.
  - Never delete historical rows; mark them with effective date ranges or inactive status.

- `2. Equivalency rule registry`
  - Store transfer rules separately from courses.
  - Support rule types such as:
    - direct one-course equivalent
    - full-sequence-required
    - partial-credit-only
    - one-of-many options
    - only-valid-for-specific catalog years
    - technically transferable but not planner-recommended
  - Each rule should also be able to say:
    - whether it is the preferred path, accepted path, accepted-with-warning path, or legacy-accepted path
    - whether it is weaker than another rule
    - whether it only applies to a specific year range or legacy-support window
    - what planner warnings should be shown when the rule is technically valid but not the strongest planning choice
  - This is where nuances like `BIOL& 211 + 212 + 213 only counts cleanly as the full UW biology path` should live once instead of being repeated in many majors.

- `3. Major requirement registry`
  - Store each campus-major-year requirement block as structured requirement atoms instead of repeated freehand lists.
  - Each requirement should carry:
    - target UW course or block
    - requirement phase
    - minimum grade if known
    - minimum count if it is a choose-N rule
    - allowed alternatives
    - whether it is admissions-critical, enrollment-critical, optional-at-GRC, or better-left-for-UW
    - year range and source links
  - Example: `uws:ece:autumn-2025:calc-sequence` should be one reusable requirement object, not copied as text into several places.
  - If a major has multiple real routes, the registry should also support `major pathway` objects so one major can expose multiple structured variants without being split into fake duplicate majors.

- `4. Planner policy layer`
  - Keep planning opinions separate from raw equivalency facts.
  - This layer should hold things like:
    - best Green River track
    - strongest recommended programming path
    - financial-aid-safe path notes
    - quarter-planning priority rules
    - when a technically valid equivalent is not the best planning choice

- `5. Generated planner output`
  - Compile the structured source layers into the app-friendly planner rows, explicit `grcCourseList` arrays, docs, and tests.
  - The app can still consume explicit per-major data, but humans should not have to hand-maintain the repeated copies.

## Why this is better than one "god code document"

- A single giant file would still duplicate facts across majors.
- It would mix course facts, equivalency facts, major facts, and planning opinions into one place.
- That makes yearly updates harder, not easier.
- It also makes it too easy to accidentally overwrite one nuance while updating another.
- A layered model keeps every nuance, but stores each nuance in the one layer where it actually belongs.

## What accuracy-focused maintenance should look like

Because the planner is supposed to preserve every nuance, the source data should be designed to keep ambiguity instead of flattening it away.

That means:

- keep catalog-year ranges instead of overwriting old rules
- keep multiple allowed equivalents when departments publish multiple valid paths
- keep planner warnings when one equivalent is technically valid but weaker
- keep source links and last-validated dates on the exact rule or major row they support
- keep historical or inactive paths marked as historical instead of deleting them

## Recommended implementation direction

If this planner keeps growing, the best implementation direction is:

- move human-edited planner source into structured `JSON` or `YAML` files with a schema
- keep one registry file or folder for courses
- keep one registry file or folder for equivalencies
- keep one registry file or folder for major requirements by campus-major-year
- keep one registry file or folder for planner policy and recommendation rules
- generate the TypeScript planner constants and planner docs from those registries
- keep a temporary bootstrap layer while parity checks compare generated output to the current planner behavior

This gives you the thing you want most:

- explicit per-major outputs in the app
- no guessed deletions
- no repeated hardcoding of the same course facts
- room for very specific per-class and per-major logic when nuance matters

## Next generalization targets

The biggest remaining per-major hardcoding that should still move into structured source data is:

- trait-backed best-track policy generation
  - `bestTrackId`
  - `recommendedTrackSummary`
  - `whyThisTrack`
- a single explicit `primaryDegreeRequirementsLink` per major or pathway, so the UI does not need to heuristically choose one page from a broader official-link set
- family-based templates for repetitive planner copy such as:
  - `summary`
  - some source-coverage notes
- continued replacement of hand-bucketed checklist placement in the legacy planner data module with structured major-requirement atoms and display-phase metadata

## What the refresh automation does now

Running `npm run planner:refresh` now does the highest-value automatic maintenance that this repo can safely do today:

- checks every tracked planner source URL already attached to majors, pathways, and tracks
- discovers candidate primary degree-requirements links and records confidence-ranked recommendations in source-gap automation reports
- rebuilds internal source-gap automation reports for medium-confidence and unresolved primary-source candidates
- parses the current primary degree-requirements sources and compares extracted UW course codes against the structured degree-map blocks already in the planner
- classifies parsed requirement diffs into categories and leaves the requirement-diff classification report in `.tmp/`
- writes source and parsed-fact fingerprints into `.tmp/`
- writes a source snapshot plus change summary into `.tmp/`
- parses the UW Green River equivalency guide into generated structured rules
- ingests the Green River course catalog
- ingests planner-relevant UW course catalogs
- refreshes the local official Green River annual schedule PDFs used by the generators
- regenerates:
  - source bootstrap
  - generated course metadata
  - generated Green River availability data
  - campus planner docs
- runs planner verification:
  - `tsc --noEmit`
  - planner tests

This gives the project one script that can check the tracked sources and update all current generated planner outputs.

There is now a one-click Windows launcher at the repo root:

- `Course-Planner-Updater.bat`

It is meant to be double-clicked and now exposes the old refresh variants as built-in choices plus root-level `Edit course links` and `Laymans Diagnosis` entries. The PowerShell launchers still handle dependency repair, timestamped logs in `.tmp/planner-refresh-logs/`, `Laymans Diagnosis`, and the detailed refresh/maintenance flow itself.

The maintenance launcher adds:

- planner refresh and verification
- Playwright Chromium setup
- Windows screenshot QA
- Windows interaction QA
- one human-readable pass/fail summary

There is now also a companion discovery script for missing primary UW degree pages:

- `npm run planner:discover-primary-sources`
- scans majors and pathways that still do not have an explicit primary degree-requirements link
- scores the current official links plus first-hop internal links
- writes ranked suggestions into `.tmp/`
- helps turn a `missing primary source` problem into a source-gap automation candidate list instead of manual browsing from scratch

There is now also a source-gap backlog step for everything that is still not high-confidence:

- `npm run planner:build-primary-review-queue`
- reruns discovery first
- collects the remaining `medium-confidence` suggestions plus the `no good suggestion yet` owners
- groups them by campus
- writes:
  - `.tmp/transfer-planner-primary-source-review-queue.json`
  - `.tmp/transfer-planner-primary-source-review-queue.md`
- this is an internal source-gap automation report, not a student-facing review workflow

There is now also a first real requirement-parser layer:

- `npm run planner:parse-requirement-sources`
- parses the current primary UW degree-requirements source for each major or pathway that now has one
- supports:
  - HTML degree/curriculum/catalog-style pages
  - PDF degree sheets and checklists
- extracts:
  - UW course codes
  - headings
  - requirement cue lines
  - choose/select statements
  - pathway/option labels
- compares those extracted UW course codes against the current structured degree-map blocks already in the planner
- writes:
  - `.tmp/transfer-planner-requirement-source-parse-report.json`
  - `.tmp/transfer-planner-requirement-source-parse-report.md`
  - `.tmp/transfer-planner-requirement-source-snapshots/`
- this is the first automatic layer that can actually say "the live source mentions course X but the current structured planner does not"

## What is still not fully automatic

The refresh pipeline still does **not** auto-rewrite every nuanced Seattle, Bothell, or Tacoma major row from live department pages.

That remaining work needs source-family adapters such as:

- UW department-page scrapers/parsers for majors that publish requirement tables in repeatable HTML
- PDF extractors for majors that still publish degree sheets only as PDFs
- explicit diff rules for when a page changed cosmetically vs when a requirement really changed
- a source-gap backlog for majors where public pages are category-based, inconsistent, or still need more parser/source coverage

So the new script gets the project much closer to a real `check sources + refresh outputs` workflow, but the last step to full automation is still structured source ingestion for the heterogeneous UW major pages.

## Equivalency assumptions already folded into the planner

The detailed planner-facing equivalency and series-rule assumptions now live in:

- [GRC_EQUIVALENCY_GUIDE_REFERENCE.md](./GRC_EQUIVALENCY_GUIDE_REFERENCE.md)

## What the planner currently outputs

- A campus-major-specific Green River equivalent course list.
- For proposal-based or intentionally custom majors, explicit Green River planning guidance instead of a fake universal course list.
- A done vs missing view for the tracked requirement buckets.
- A recommended next-step or quarter-plan suggestion based on missing tracked courses.
- Quarter-plan suggestions that now keep UW-critical requirements ahead of optional Green River-only add-ons.
- Subject-aware fallback guidance when a checklist item has no hand-authored planner note, so the planner can still describe math, programming, circuit, writing, statistics, language, or other common head starts without adding a custom note for every single major row.
- Auto-generated fallback checklist items for majors that still have a degree-specific Green River course list but no hand-authored checklist buckets yet, so the planner can still build a usable quarter plan instead of collapsing to the quarter-plan warning block.
- Quarter-plan course cards that can now show recent Green River offering history when the planner has it.
- Planner notes, caution flags, and official reference links for the selected major.
- For supported multi-route majors, a pathway selector inside the `Major Specifics` dropdown at the bottom of the transcript-based course-plan box, and it only appears when the selected major truly has more than one planner-supported route.
- The `Major Specifics` dropdown should show one primary official UW degree page for the selected major, not a long list of supporting links.
- The `Major Specifics` dropdown should not surface noisy per-major course counts like `97 tracked` or `2/97 completed`; it should focus on the actual classes, route choice, and degree notes.

## What the planner is not

- It is not an official UW degree audit.
- It is not a live registrar schedule.
- It is not a promise that every course is offered every quarter.
- It is not a claim beyond the current public requirements; unsupported paths should stay hidden.
- It should not show fake dropdown choices for majors that do not actually have distinct supported pathways.

## Planner doc set

- [UWS_DEGREE_COURSES.md](./UWS_DEGREE_COURSES.md)
- [UWB_DEGREE_COURSES.md](./UWB_DEGREE_COURSES.md)
- [UWT_DEGREE_COURSES.md](./UWT_DEGREE_COURSES.md)
- [GRC_EQUIVALENCY_GUIDE_REFERENCE.md](./GRC_EQUIVALENCY_GUIDE_REFERENCE.md)
