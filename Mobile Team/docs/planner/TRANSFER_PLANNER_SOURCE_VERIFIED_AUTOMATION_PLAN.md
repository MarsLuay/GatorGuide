# Transfer Planner Source-Verified Automation Plan

Last updated: April 7, 2026

This is the phased implementation plan for turning the Green River College -> UW transfer planner into a source-verified, mostly automated planning system for Running Start and transfer students.

The goal is not a manually maintained hand-reviewed worksheet. The goal is a planner that uses official public sources, archived snapshots, generated structured data, and strict visibility gates.

## Product Rule

No source, no student-facing claim.

If an official public source cannot prove a major requirement, equivalency rule, course availability rule, or sequence rule, the app should not guess.

For majors, the rule is stricter:

- If a major cannot be source-verified enough to produce a reliable planner row, hide it from the student-facing planner.
- Internally mark the major with a source-gap status so future source discovery can try again.
- Do not rely on ongoing human or non-developer review after the system is complete.
- Use review reports only as build-time automation debt, not as a permanent maintenance workflow.

## Current Starting Point

The current planner already has a strong foundation:

- Planner docs in `Mobile Team/docs/planner/`
- Runtime planner logic in `Mobile Team/services/planning/transfer-planner.service.ts`
- Student UI in `Mobile Team/components/pages/TransferPlannerPage.tsx`
- Transcript parsing in `Mobile Team/services/documents/transcript-pdf.service.ts`
- Source-layer schemas and registries in `Mobile Team/constants/transfer-planner-source/`
- A refresh pipeline in `Mobile Team/scripts/planner/`
- Double-clickable refresh launchers in `Mobile Team/scripts/run-planner-refresh*.cmd`

The missing long-term pieces are:

- full GRC and UW catalog ingestion
- full UW equivalency-guide parsing
- source-family parser adapters for HTML and PDF major pages
- date-effective approved transfer rules
- student-specific evaluation records
- graph-based sequence planning
- source coverage gates that hide unverified majors
- shareable source-backed export/reporting built from source-backed data

## Inspiration Repo Lessons To Keep

From `AI-Transfer-Evaluation-Tool-main`:

- Keep the output student-friendly.
- Add a shareable source-backed PDF or report export.
- Show match buckets clearly: applies cleanly, elective credit, sequence incomplete, not applicable, and hidden when the source is unverified.
- Show applied-credit and excess-credit summaries, including UW transfer-credit cap warnings.

From `transfer-equivalency-credits-eda-master`:

- Separate approved equivalency rules from student-specific transcript evaluations.
- Treat rule start/end dates as first-class data.
- Track rule status and lifecycle, such as active, inactive, legacy, and deprecated.
- Track required grades and awarded credit explicitly.
- Treat requirement-level equivalencies differently from direct course-to-course equivalencies.

## Target Data Layers

The final planner should compile from source-native data into generated TypeScript.

Recommended source folders:

- `Mobile Team/data/planner-source/courses/`
- `Mobile Team/data/planner-source/equivalencies/`
- `Mobile Team/data/planner-source/requirements/`
- `Mobile Team/data/planner-source/policies/`
- `Mobile Team/data/planner-source/source-gaps/`

Generated runtime outputs should continue to live under:

- `Mobile Team/constants/transfer-planner-source/`
- `Mobile Team/constants/transfer-planner-grc-availability.generated.ts`
- `Mobile Team/constants/transfer-planner-master-generated.ts`

## Status Model

Add source coverage fields to the structured planner source layer.

Recommended statuses:

- `verified`: the major or rule is backed by official sources and parser coverage.
- `partially-verified`: official sources exist, but not enough for student-facing automatic planning.
- `source-unfindable`: official public sources were searched and not found.
- `source-conflict`: official sources disagree or produce incompatible results.
- `parser-unsupported`: an official source exists, but the parser cannot safely extract it yet.

Recommended visibility states:

- `visible`: safe to show to students.
- `hidden`: keep internally, but exclude from the student-facing planner.

Student-facing planner rows should require:

- `sourceCoverageStatus === "verified"`
- `studentVisibility === "visible"`
- at least one official primary degree-requirements source
- parsed requirement atoms or parsed degree-map blocks
- source-backed equivalency handling for all GRC courses shown as direct recommendations

## Phase 0: Baseline And Guardrails

Purpose:

Freeze the current behavior before replacing more hand-authored facts with generated source-backed data.

Repo work:

- Add source coverage status types in `Mobile Team/constants/transfer-planner-source/schema.ts`.
- Add a generated hidden-source-gaps export, likely `source-gaps.generated.ts`.
- Add tests in `Mobile Team/scripts/planner/transfer-planner.service.test.ts` that prove hidden majors do not appear in the public planner.
- Add a source summary metric for visible vs hidden majors in `TRANSFER_PLANNER_SOURCE_SUMMARY`.

Acceptance criteria:

- Current visible majors still appear unless explicitly marked hidden.
- Hidden majors are still tracked internally.
- Planner tests fail if a hidden or unverified major leaks into the student-facing selector.

## Phase 1: Complete Official Source Manifest

Purpose:

Hardcode every stable official source link needed to support the planner.

Repo work:

- Expand the source manifest in `Mobile Team/constants/transfer-planner-source/registry.ts` or move manifest input into `Mobile Team/data/planner-source/sources/`.
- Keep UW and GRC source URLs official-domain only when possible.
- Add search/discovery output for missing sources into `.tmp/transfer-planner-source-gaps.*`.
- Promote safe official links into a stable generated file only after source checks pass.

Official source families:

- UW Seattle degree pages
- UW Bothell degree pages and PDFs
- UW Tacoma catalog pages and degree pages
- UW Green River equivalency guide
- Green River catalog pages
- Green River annual schedule PDFs
- Green River transfer degree and pathway PDFs

Acceptance criteria:

- Every visible major has one explicit primary degree-requirements source.
- Every source has a parser type.
- Every source has validation notes and a last-checked date when available.
- Missing sources produce internal source-gap records, not student-facing guesses.

## Phase 2: Source Snapshots And Reproducibility

Purpose:

Make planner updates reproducible even if public pages change later.

Repo work:

- Extend `Mobile Team/scripts/planner/refresh-transfer-planner-sources.cjs`.
- Store source snapshots under `.tmp/` for local runs.
- Add an optional durable archive location for checked-in source metadata, not necessarily full copyrighted source bodies.
- Add snapshot hashes to generated source metadata.
- Keep enough extracted structured facts to reproduce planner output.

Acceptance criteria:

- Refresh reports show which sources changed since the last run.
- Cosmetic source changes do not automatically look like requirement changes.
- Requirement changes produce structured diffs.

## Phase 3: Full Course Catalog Ingestion

Purpose:

Stop relying on partial course metadata and build the course graph from source-backed GRC and UW catalog data.

Repo work:

- Add `Mobile Team/scripts/planner/ingest-grc-catalog.cjs`.
- Add `Mobile Team/scripts/planner/ingest-uw-catalog.cjs`.
- Generate full source-backed entries into `course-metadata.generated.ts`.
- Preserve historical course rows with effective year ranges instead of deleting them.

Fields to parse:

- course code
- title
- credits
- subject
- catalog number
- prerequisites
- corequisites
- course descriptions when useful
- effective catalog year
- campus or institution
- source links

Acceptance criteria:

- Course title coverage and credit coverage approach full catalog coverage for GRC and planner-relevant UW courses.
- Prerequisite and corequisite coverage exists for all planner-recommended GRC courses.
- Unknown prerequisites are represented as unknown, not guessed.

## Phase 4: UW Equivalency Guide Parser

Purpose:

Make Green River -> UW equivalency facts generated from the official equivalency guide.

Repo work:

- Add `Mobile Team/scripts/planner/parse-transfer-planner-equivalency-guide.cjs`.
- Generate approved equivalency rules into the source-layer registry.
- Extend `TransferPlannerEquivalencyRule` in `schema.ts`.
- Add rule lifecycle and date-effective matching.

Rules to support:

- direct one-course equivalencies
- sequence-required equivalencies
- limited-credit rules
- elective credit outcomes
- no-credit rows
- legacy or effective-term notes
- technically accepted but not planner-recommended paths

Acceptance criteria:

- The planner can explain why a GRC course maps or does not map to a UW outcome.
- Sequence rules like multi-course chemistry, biology, accounting, or calculus are represented once in the equivalency registry.
- Date-effective rules can be applied against when a student took the course.

## Phase 5: Major Requirement Parser Adapters

Purpose:

Replace manual major fact updates with source-family parsers.

Repo work:

- Extend `parse-transfer-planner-requirement-sources.cjs`.
- Add parser adapters by source family instead of one generic parser.
- Keep parser type definitions in `schema.ts`.
- Generate requirement atoms and degree-map blocks from official pages and PDFs.

Parser adapter families:

- UW Seattle HTML degree pages
- UW Bothell HTML degree pages
- UW Bothell PDF worksheets
- UW Tacoma catalog pages
- UW Tacoma HTML degree pages
- generic official PDF degree sheets

Acceptance criteria:

- Visible majors have parsed requirement atoms or parsed degree-map blocks.
- Parser-unsupported majors are hidden and internally marked.
- Source conflicts hide the major until the conflict is resolved by stronger source logic.

## Phase 6: Historical GRC Track Comparison

Purpose:

Support Running Start and transfer students whose GRC plan started under a prior catalog year.

Repo work:

- Add source data for year-specific GRC track plans under `Mobile Team/data/planner-source/grc-tracks/`.
- Ingest `999B`, `999Q`, `999O`, and `999P` by catalog year.
- Update `transcript-pdf.service.ts` to infer first GRC term/year when the transcript supports it.
- Update planner logic to compare the student's likely GRC catalog year against current UW requirements.

Acceptance criteria:

- The planner can distinguish current students from students already following an older GRC path.
- Legacy GRC paths can remain valid when official equivalency or track rules still support them.
- The planner prefers current recommended paths for new students.

## Phase 7: Graph-Based Quarter Planning

Purpose:

Replace limited chain hardcoding with an automatically derived planning graph.

Repo work:

- Update `Mobile Team/services/planning/transfer-planner.service.ts`.
- Build prerequisite and corequisite graphs from catalog metadata.
- Combine the graph with GRC quarter availability.
- Keep hardcoded chain IDs only as temporary migration fallback.

Inputs:

- completed transcript courses
- in-progress courses
- catalog-year-aware GRC track rules
- GRC course availability by quarter/year
- prerequisite/corequisite graph
- UW major requirement atoms
- equivalency rules

Acceptance criteria:

- The planner does not suggest a course before its prerequisites are satisfied.
- The planner understands co-requisite constraints where source data supports them.
- Essential UW-required classes are prioritized ahead of optional or weaker-path courses.
- Quarter suggestions respect known GRC offering patterns.

## Phase 8: Student Evaluation Layer

Purpose:

Separate approved source facts from a student's transcript-specific result.

Repo work:

- Add `TransferPlannerStudentCourseEvaluation` types in `schema.ts`.
- Update `transfer-planner.service.ts` to produce evaluation records.
- Keep static approved rules separate from transcript-specific outputs.

Evaluation outcomes:

- `auto-approved`
- `sequence-incomplete`
- `legacy-rule-used`
- `elective-credit`
- `no-credit`
- `not-applicable-to-major`
- `source-unverified-hidden`

Acceptance criteria:

- A student's result can say which approved rule was used.
- If a sequence is incomplete, the missing GRC courses are explicit.
- If a rule is legacy, the student sees a warning.
- Hidden/unverified majors never produce a student-facing evaluation.

## Phase 9: Student-Facing Output And Reports

Purpose:

Make the planner usable for Running Start and transfer students without sacrificing source rigor.

Repo work:

- Update `Mobile Team/components/pages/TransferPlannerPage.tsx`.
- Add a shareable source-backed export path, likely a generated PDF or structured report.
- Show source-backed reasoning for matches and missing requirements.

Student-facing buckets:

- completed and applies
- completed but only elective credit
- sequence incomplete
- still needed before application
- still needed before enrollment
- good to finish at GRC
- better saved for UW
- hidden/unavailable major not shown in selector

Acceptance criteria:

- Students can understand what to take next and why.
- Reports cite official sources or source-derived rule IDs.
- The UI never displays a major that failed the source-verification gate.

## Phase 10: Fully Automated Refresh

Purpose:

Make `npm run planner:refresh` the main maintenance entry point.

Repo work:

- Update `Mobile Team/scripts/planner/refresh-transfer-planner-sources.cjs`.
- Add all new ingest and parser scripts to the refresh sequence.
- Regenerate docs and runtime data from source-native inputs.
- Keep Windows launchers working for local non-developer execution, but do not require non-developer interpretation.

Final refresh sequence:

- check official source links
- discover missing official sources
- snapshot official sources
- ingest GRC catalog
- ingest UW catalog
- parse UW equivalency guide
- parse UW major requirements
- classify source gaps
- hide unverified majors
- generate registries
- generate docs
- run typecheck
- run planner tests

Acceptance criteria:

- One command rebuilds planner data.
- Tests fail if visible majors are not source-verified.
- Internal reports list hidden source gaps.
- Student-facing data contains only verified planner rows.

## Long-Term Definition Of Done

The planner is complete when:

- every visible major is official-source-backed
- unverified majors are hidden automatically
- full GRC and UW course catalogs are ingested or intentionally scoped with source-gap records
- GRC -> UW equivalency rules are parsed from official sources
- prerequisite and corequisite sequencing is graph-driven
- prior GRC catalog years are preserved
- transcript parsing supports Running Start and transfer edge cases
- reports are student-friendly and easy to share without custom interpretation
- `transfer-planner-data.ts` is no longer a source of new planner facts
- the refresh pipeline can rebuild generated planner output without hand-editing TypeScript

## Non-Goals

- Do not guess requirements from unofficial pages.
- Do not rely on ongoing human review to fill missing planner data.
- Do not show a major to students if the source pipeline cannot verify it.
- Do not use AI semantic matching as a source of truth for equivalencies.
- Do not hand-maintain one giant planner fact file.
