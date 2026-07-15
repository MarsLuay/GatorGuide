# GatorGuide Improvement Phase Plan

Status: accepted planning baseline; implementation not started  
Updated: July 11, 2026  
Delivery model: all phases ship together in one combined update  
Primary success measure: planner correctness and complete source-backed coverage

## 1. Outcome

Turn GatorGuide into a focused transfer-planning product for Green River College students targeting undergraduate programs at UW Seattle, UW Bothell, or UW Tacoma.

The product centers one **Living Transfer Plan**: a quarter-by-quarter plan from the student's current Green River record through transfer. Planner facts come from official sources, update automatically through guarded automation, and never depend on conversational or generative AI.

## 2. Accepted Product Decisions

These are requirements, not open questions.

- Serve Green River students transferring to UW Seattle, UW Bothell, or UW Tacoma first.
- Cover every published undergraduate major across all three campuses before expanding to another university.
- Maintain one active campus/major target and one definitive plan.
- Stop the plan at transfer; do not schedule the post-transfer UW degree.
- Keep the existing automatic Green River pathway/track selection behavior.
- Preserve current course-availability behavior.
- When the chosen transfer date is impossible, extend it to the earliest valid quarter rather than violate prerequisites or overload credits.
- Keep existing “use this as a tool, not an advisor” copy where it already appears. Do not proliferate new disclaimer surfaces.
- Keep guest-first use. Accounts remain optional for sync, recovery, and cross-device features.
- Primary tabs become Transfer Planner, Resources, Calendar, and Profile. Settings moves under Profile. Remove the separate Home surface.
- Add course movement and quarter locking while preserving all existing planner features.
- Keep Transfer Equivalency Catalog as a separate tool under Resources.
- Keep scholarships, internships, general resources, and the current opportunity completion workflow.
- Match opportunities deterministically from known student attributes. Unknown attributes never exclude; missing matching data falls back to all opportunities.
- Calendar becomes a Personalized Timeline derived from the active target, transfer quarter, planner milestones, relevant opportunities, and optional personal deadlines.
- Guests receive local reminders. Signed-in users may sync reminders. Push is opt-in. Email reminders are out of scope initially.
- Remove conversational AI, AI explanations, hidden generative ranking, college ranking, Saved Colleges, College Comparison, and Cost Calculator.
- Remove dead code for eliminated product behavior; preserve old persisted values non-destructively during migration.
- Parse transcripts immediately without a mandatory confirmation gate. Allow correction through existing controls.
- Discard original transcript files after parsing; persist/sync only normalized course records.
- Preserve the current brand, themes, and interaction character. Redesign hierarchy, not identity.
- Mobile-first iOS/Android; responsive web remains fully functional. Avoid desktop-only product behavior.
- Require WCAG 2.2 AA-equivalent behavior across mobile and web.
- Keep the planner, timeline, normalized course records, and bundled opportunity catalog usable offline after first load.
- Do not add behavioral telemetry. Measure quality through source audits, pathway fixtures, regression tests, and existing student planner bug reports.
- Keep all current 16 languages. Generate new translations during development, never at runtime.

## 3. Accepted Official-Source Parser Decisions

- Use reusable **Source Family adapters** that emit one normalized **Requirement Model**.
- Processing shape: `Official Source -> acquisition/evidence -> adapter -> Requirement Model -> validation -> planner generation -> Last-Known-Good Dataset`.
- Permit a source-specific adapter only when the document is genuinely structurally unique; do not encode major-specific logic in the orchestration entrypoint.
- Run automatically every week, before the combined update, and on demand through Course Planner Updater and `workflow_dispatch`.
- Automatically accept semantic source updates only when the parse is complete, internally consistent, source-backed, and passes all invariants, fixtures, regressions, and planner checks.
- Ambiguous, incomplete, contradictory, or invalid output never replaces the Last-Known-Good Dataset.
- Discover/promote replacement sources automatically only when one official-domain candidate uniquely matches campus, program, catalog year, and document role.
- Store immutable Requirement Snapshots for the current catalog year plus the previous three years.
- Resolve source authority in this order: program-owned current requirements page, campus catalog, UW–Green River equivalency guide, Green River catalog/schedule.
- A material unresolved source conflict fails visibly; it is never silently resolved.
- A requirement lacking a verified Green River equivalent remains source truth. The planner must not invent or schedule a substitute; preserve existing guidance behavior for such cases.
- Valid scheduled updates use a guarded bot pull request and auto-merge only after required checks pass. Never push generated changes directly to `main`.

## 4. Explicit Non-Goals

- General college discovery or nationwide institution coverage
- Admissions probability, competitiveness scoring, or acceptance prediction
- Post-transfer UW degree scheduling
- Conversational assistant, chatbot, AI explanation, or generative recommendations
- Runtime translation
- Behavioral analytics or engagement optimization
- Full visual rebrand
- Whole-application rewrite
- Direct scheduled writes to `main`
- Hand-editing generated planner outputs

## 5. Current-State Evidence

- Current primary tabs are Home, Resources, Profile, and Settings; planner and calendar are hidden routes.
- Planner tooling reports `244/244` tracked primary requirement-owner parses. The generated adapter data contains 449 successful source-owner blocks, 2,330 requirement groups, 10,135 parsed course rows, and 6 current quality warnings. The main requirement parser is roughly 735 KB/~22,000 lines and still mixes heterogeneous parsing, normalization, fallbacks, reporting, and generation concerns.
- The current bootstrap contains 188 major plans and 247 pathways, while every bootstrap plan still reports partial coverage. A successful parse count therefore cannot serve as the completion definition.
- Structured planner registries and generated student-runtime artifacts already exist under `source/constants/transfer-planner-source/`.
- The refresh pipeline already performs source discovery, parsing, fingerprints, equivalency ingestion, catalog ingestion, generation, audits, and verification. The plan deepens this pipeline rather than replacing it wholesale.
- AI services, college services, saved-college state/actions, chat schema, roadmap behavior, college routes, and associated Firebase/function configuration remain in the codebase.
- Localization currently uses 16 static JSON bundles with 1,360 keys each. Existing scripts normalize bundles and audit hard-coded English, but they do not translate new/changed keys or validate exact placeholder parity; the audit found placeholder loss across 13 locales and large untranslated-English concentrations in Persian and Tagalog.
- Transcript originals are currently copied into persistent app storage, can enter portable exports, and leave source identities in debug/error paths. Normalized transcript records are currently local-only rather than synchronized for signed-in users.
- Opportunity matching currently excludes some unknown demographics/majors, and Calendar still derives facts from roadmap/saved-college behavior. These conflict with the accepted unknown-safe relevance and plan-derived timeline rules.
- Existing user changes are present in `source/app/+html.tsx`, `source/global.css`, `source/package.json`, `source/package-lock.json`, and an integration test. Execution agents must inspect and preserve them.

## 6. Target Boundaries

The end state has these deep modules and ownership boundaries:

1. **Official Source Pipeline** — discovers, acquires, fingerprints, parses, normalizes, validates, versions, and publishes requirement data.
2. **Planner Catalog** — exposes only validated, catalog-year-aware courses, equivalencies, pathways, and requirements to runtime callers.
3. **Living Plan Engine** — evaluates normalized student records and constraints, selects the existing automatic Green River path, schedules through transfer, and supports move/lock/recalculate.
4. **Student Record** — owns normalized transcript-derived courses, active target, plan constraints, progress, persistence, migration, and sync policy.
5. **Personalized Timeline** — derives transfer milestones, plan deadlines, relevant opportunity deadlines, personal deadlines, and reminder state.
6. **Opportunity Catalog** — owns deterministic relevance and the existing completion workflow.
7. **App Shell** — owns the four-tab navigation, route access, Profile-hosted settings, responsive layout, and accessibility behavior.
8. **Localization Pipeline** — owns English-key detection, machine translation, glossary/override protection, risk reporting, and static locale validation.

No UI component may parse official documents. No source adapter may emit runtime UI objects. No planner scheduler may read raw HTML/PDF text. No opportunity matcher may depend on AI. No transcript original may cross the normalized Student Record boundary after parsing.

## 7. Subagent Execution Contract

### 7.1 Parent/orchestrator responsibilities

- Select only unblocked tickets.
- Never assign two agents overlapping write ownership in the same wave.
- Pass the ticket, exact paths, relevant decisions, and current diff—not this entire plan unless needed.
- Keep integration-owned files with one integration agent per wave.
- Inspect every returned diff and treat reports as evidence, not truth.
- Run the phase gate after integrating all tickets.
- Do not commit, push, or auto-merge unless the user separately authorizes it.

### 7.2 Agent task prompt

```text
Objective: Execute ticket <ID> from docs/GATOR_GUIDE_IMPROVEMENT_PHASE_PLAN.md.
Scope: <ticket-owned paths only>.
Dependencies: Confirm <ticket dependency IDs> are integrated.
Constraints: Read repo/source AGENTS.md; preserve unrelated dirty-worktree changes; do not hand-edit generated files; no product-scope expansion.
Output: Patch, focused tests, changed-file list, decisions/assumptions, and verification evidence.
Verification: Run the ticket checks, then report exact pass/fail results.
Do not: Edit integration-owned files, commit, push, alter generated output directly, or fix unrelated findings.
```

### 7.3 Shared hot files

Only a designated integration ticket may edit these within a wave:

- `source/package.json`, `source/package-lock.json`
- `source/constants/routes.ts`
- `source/app/(tabs)/_layout.tsx`
- `source/constants/schema.ts`
- `source/hooks/use-app-data.tsx` and `source/hooks/app-data/*`
- `source/services/index.ts`
- `source/constants/transfer-planner-source/schema.ts`, `registry.ts`, `index.ts`
- `source/scripts/planner/refresh-transfer-planner-sources.cjs`
- `.github/workflows/*`
- Firebase rules/indexes/configuration

### 7.4 Generated-file rule

Agents edit source inputs, adapters, generators, fixtures, or tests. The integration agent runs generators and owns resulting diffs. Never hand-edit:

- `source/constants/transfer-planner-source/*.generated.ts`
- `source/constants/transfer-planner-source/**/*.generated.json`
- `source/constants/transfer-planner-grc-availability.generated.ts`
- `source/constants/transfer-equivalency-catalog.generated.ts`
- `source/constants/green-river-major-options.generated.ts`
- generated planner campus documentation

### 7.5 Verification aliases

Run commands from `Projects/GatorGuide/source/` unless noted.

- **V-TS**: `npm run typecheck`
- **V-LINT**: `npm run lint`
- **V-APP**: `npm run test:app`
- **V-CHECK**: `npm run check`
- **V-PLANNER**: `npm run planner:verify`
- **V-PLANNER-FULL**: `npm run planner:full:verify`
- **V-PARSER**: `npm run planner:test:parser`
- **V-HARNESS**: `npm run planner:test:harness`
- **V-I18N**: `npm run i18n:check`
- **V-FIREBASE**: `npm run test:firebase-rules`
- **V-WEB**: `npm run web:export`
- **V-MOBILE**: `npm run qa:mobile`
- **V-WINDOWS**: `npm run qa:windows:ci`
- **V-TOUCH**: `npm run qa:touch-targets`

Tickets may introduce narrower commands. A phase gate always includes the listed aliases even when focused tests passed.

## 8. Program Dependency Map

Phases are implementation stages, not public releases.
The 21 phases contain 108 bounded ticket IDs. Tickets are assignment units; waves—not phases—define safe concurrency.

```text
00 Decisions and execution safety
  -> 01 Characterization baseline
  -> 02 Module contracts and guardrails
       -> Parser lane: 03 -> 04 -> (05 + 06) -> 07 -> 08 -> 09 -> 10
       -> Product lane: 11 -> 12 -> 13 -> 14 -> 15 -> 16
       -> Enablement lane: 17 + 18 + 19
  -> 20 Whole-program integration, one combined update
```

After Phase 02, parser, product-enablement, localization, and accessibility work may overlap only where ticket ownership does not. Phase 20 begins only after every earlier exit gate passes.

## Phase 00 — Freeze Decisions and Make Execution Safe

Goal: turn the accepted conversation into an auditable execution contract before behavior changes.

Entry: this plan, `CONTEXT.md`, and ADRs exist.  
Parallelism: P00-A through P00-D may run concurrently; P00-E integrates them.

| ID | Owner and bounded objective | Owned scope and output | Depends | Verification |
| --- | --- | --- | --- | --- |
| P00-A | Baseline agent: record the exact dirty worktree and identify collision risks. | Read-only repository report; classify user changes in `source/app/+html.tsx`, `source/global.css`, package files, and tests. Do not alter them. | — | `git status --short`; exact scoped diffs reviewed |
| P00-B | Domain agent: verify agreed language and architectural records. | `CONTEXT.md`, `docs/adr/0001-*` through `0004-*`; tighten definitions only, no implementation specifications in `CONTEXT.md`. | — | Markdown links and ADR numbering validated |
| P00-C | Product inventory agent: map every route, card, service, state field, storage key, Firestore path, function, and test tied to removed features. | Report under `source/.tmp/reports/` or a non-generated planning appendix; exact inbound/outbound references for AI, colleges, Home, compare, cost, saved colleges, roadmap/chat. | — | `rg` reference counts; no source edits |
| P00-D | Planner inventory agent: map source inputs, handwritten registries, generated artifacts, generators, reports, and publish gates. | Parser artifact lineage report with producer/consumer/verification command for each output. | — | Every generated artifact names one producer |
| P00-E | Integration agent: produce the execution manifest. | Add a short implementation manifest beside this plan: phase status, ticket owner, dependency, write scope, and check evidence. This becomes the orchestration ledger; it does not duplicate ticket detail. | P00-A–D | No overlapping ownership in the next wave |

Exit gate:

- Every existing change is attributed to the user or this planning work.
- Every removed feature has a reference inventory.
- Every generated planner artifact has a known producer.
- The next wave can assign agents without overlapping writes.

## Phase 01 — Characterize Existing Behavior Before Refactoring

Goal: preserve valuable behavior and expose accidental coupling before moving code.

Entry: Phase 00 complete.  
Parallelism: all tickets may run concurrently because they own separate tests/fixtures; one integration agent resolves shared test-runner changes.

| ID | Owner and bounded objective | Owned scope and output | Depends | Verification |
| --- | --- | --- | --- | --- |
| P01-A | Planner behavior agent: lock down current student-visible planner outputs. | Add representative fixtures for Seattle, Bothell, Tacoma; fixed and choice-based majors; pathway majors; impossible dates; automatic GRC track selection; transcript complete/in-progress/missing states. | P00-D | Focused planner tests; V-PLANNER |
| P01-B | Parser behavior agent: capture last-known-good parse contracts. | Golden inputs/outputs for each existing parser family, source evidence, confidence, failure classification, and `244/244` owner coverage manifest. Never snapshot volatile timestamps. | P00-D | V-PARSER; deterministic rerun diff is empty |
| P01-C | Product-flow agent: characterize navigation and surviving workflows. | Tests for guest planner entry, transcript path, Resources, equivalency catalog, current opportunity completion, Calendar, Profile, Settings, account opt-in, and bug reports. Removed features are characterized only enough to prove their later removal. | P00-C | V-APP |
| P01-D | Persistence agent: capture migration fixtures. | Versioned fixtures for guest and signed-in app data containing saved colleges, questionnaire preferences, AI/roadmap caches, transcript documents, opportunity status, notifications, and active planner selection. | P00-C | `npm run test:app-data`; round-trip fixtures pass |
| P01-E | Quality agent: record localization, accessibility, responsive, and offline baselines. | Audit artifacts for locale key parity/hard-coded strings, keyboard/focus order, screen-reader labels, touch targets, dynamic text, reduced motion, web/mobile breakpoints, and offline startup. | P00-A | V-I18N; V-TOUCH; existing QA commands |

Exit gate:

- Refactors can be judged against behavioral contracts rather than implementation details.
- Golden parser fixtures cover every meaningful source family, not merely majors.
- Persistence fixtures contain data from features scheduled for removal.
- Baseline failures are documented separately from regressions introduced later.

## Phase 02 — Establish Module Contracts and Guardrails

Goal: create stable seams so parser, runtime, UI, and workflow agents can work independently.

Entry: Phase 01 contracts pass or known failures are explicitly baselined.  
Parallelism: P02-A and P02-B may run together; P02-C follows both; P02-D integrates package/CI changes.

| ID | Owner and bounded objective | Owned scope and output | Depends | Verification |
| --- | --- | --- | --- | --- |
| P02-A | Architecture agent: define the Official Source Pipeline boundary. | New private modules under `source/scripts/planner/pipeline/`; one public `refreshPlannerData(options)` orchestration interface hiding acquisition, parsing, reconciliation, validation, compilation, reporting, and publication. Do not migrate parsing yet. | P01-B | Contract tests compile; V-HARNESS |
| P02-B | Architecture agent: define runtime boundaries. | Interfaces among Planner Catalog, Living Plan Engine, Student Record, Personalized Timeline, and Opportunity Catalog. Keep ports internal unless production and test adapters both exist. | P01-A,C,D | V-TS; dependency diagram reviewed |
| P02-C | Boundary agent: enforce allowed imports. | Extend existing planner modularization/architecture checks so UI cannot import parser internals, runtime cannot read raw source text, generated modules cannot import app state, and removed feature namespaces cannot re-enter surviving modules. | P02-A,B | `planner-modules.test.cjs`; V-TS |
| P02-D | Integration agent: add focused commands and required check names. | `source/package.json`, lockfile only if necessary, and CI check map. Add stable commands for parser contracts, app migrations, localization generation, and accessibility audits without duplicating existing scripts. | P02-C | Commands execute; V-CHECK remains green/baselined |

Exit gate:

- Each target module has one small caller-facing contract.
- Dependency tests reject forbidden cross-boundary imports.
- Subsequent adapter agents can add files without editing the orchestration entrypoint.

## Phase 03 — Define the Normalized Requirement Model

Goal: represent official requirements without losing semantics or leaking document layout into runtime data.

Entry: Official Source Pipeline contract exists.  
Parallelism: P03-A through P03-D may be designed concurrently against separate files; P03-E integrates and owns the central schema export.

| ID | Owner and bounded objective | Owned scope and output | Depends | Verification |
| --- | --- | --- | --- | --- |
| P03-A | Requirement-model agent: define identities and ownership. | Types for institution, campus, program, pathway, catalog year, source owner, requirement set, stable IDs, display labels, and source roles. | P02-A | Type-level fixtures; stable serialization tests |
| P03-B | Requirement-expression agent: model boolean/quantity semantics. | Recursive expressions for all-of, any-of, choose-N, credit thresholds, course sequences, approved lists/filters, and compound equivalency paths. Avoid free-text requirements as schedulable facts. | P02-A | Truth-table fixtures and invalid-shape tests |
| P03-C | Academic-rule agent: model course constraints. | Course/subject references, minimum grades, prerequisites, co-requisites, effective ranges, application/enrollment phases, schedulability, and transfer relevance. | P02-A | Representative STEM, language, elective, and admission fixtures |
| P03-D | Evidence agent: model provenance. | Exact source URL, canonical/final URL, catalog year, source role, extraction location, evidence text/hash, acquired-at metadata, parser family/version, and conflict lineage attached to normalized facts. | P02-A | Every schedulable atom requires evidence |
| P03-E | Schema integration agent: publish Requirement Model v1. | Central schema/validator/serializer, discriminated diagnostic types, compatibility adapter for current generated schema, and version header. Own central exports only after A–D land. | P03-A–D | Round-trip determinism; schema validation; V-TS; V-HARNESS |

Exit gate:

- The model can express current Seattle/Bothell/Tacoma fixtures without per-major fields.
- Lossy or ambiguous source text becomes a diagnostic, not a fabricated atom.
- Every student-visible planner fact can trace to evidence and catalog year.
- Runtime-compatible generation remains possible through a temporary adapter.

## Phase 04 — Separate Acquisition, Evidence, and Parsing

Goal: make source fetching/cache behavior deterministic and independently testable.

Entry: Requirement Model v1 accepted.  
Parallelism: P04-A and P04-B may run together; P04-C depends on both; P04-D integrates.

| ID | Owner and bounded objective | Owned scope and output | Depends | Verification |
| --- | --- | --- | --- | --- |
| P04-A | Acquisition agent: deepen source downloading. | Extract URL resolution, timeout/retry, redirects, content type, cache reuse, and official-domain checks into a Source Acquisition module with production and fixture adapters. | P02-A | Existing fetch-contract tests; new redirect/cache/error fixtures |
| P04-B | Snapshot agent: define immutable raw snapshots. | Content-addressed snapshot metadata and storage layout for HTML/PDF bytes plus headers and fingerprint. Catalog-year identity must not depend only on fetch date. | P03-D | Same content deduplicates; changed content creates a new immutable snapshot |
| P04-C | Document agent: normalize transport-level documents. | Convert acquired HTML/PDF into a Source Document containing pages/sections/text blocks/tables/links with stable evidence locations; no academic interpretation. | P04-A,B | HTML/PDF document fixtures; deterministic extraction |
| P04-D | Orchestration agent: replace direct downloader/parser coupling. | Thin entrypoint routes Source Documents to registered adapters; current parser remains behind a temporary legacy adapter until migrated. | P04-C | Existing parser golden suite unchanged; V-PARSER |

Exit gate:

- Network and cache failures are testable without internet.
- Raw snapshots are immutable and reproducible.
- Academic adapters consume Source Documents, never network responses or filesystem cache details.

## Phase 05 — Build Real HTML Source-Family Adapters

Goal: replace nominal adapter labels that all dispatch to generic parsing with structurally distinct, fixture-owned adapters.

Entry: Source Document contract and adapter registry exist.  
Parallelism: P05-B through P05-D own separate adapter directories and may run concurrently after P05-A; P05-E integrates registry ordering only.

| ID | Owner and bounded objective | Owned scope and output | Depends | Verification |
| --- | --- | --- | --- | --- |
| P05-A | Adapter-harness agent: implement selection and contract tests. | `source/scripts/planner/pipeline/adapters/registry.*` and adapter contract tests. Exactly one primary adapter must match; ambiguity and unsupported structure fail. Add an architecture test forbidding `planId`, `ownerId`, or major-title dispatch. | P04-D | Fixture selection matrix; V-HARNESS |
| P05-B | UW program-page agent: implement `uw-program-html`. | Department/program pages with explicit section scoping and structural sub-strategies for UW Drupal, Bothell program pages, and Tacoma SET-style pages. Emit IR plus evidence, never GRC mappings. | P05-A | Required-row, choice, credit, sequence, support-list, phase, and boundary fixtures |
| P05-C | UW catalog agent: implement `uw-general-catalog-html`. | Program/credential anchors, current/archive variants, sibling-major/minor/graduate boundary isolation, pathway and credential identity. | P05-A | No sibling/minor/graduate leakage; catalog fixtures deterministic |
| P05-D | Official support-page agent: parse approved lists and admission-support pages. | Structurally reusable approved-course, elective, upper-division prerequisite, and admissions pages. Mark support-only/non-schedulable facts explicitly. | P05-A | Support pages cannot create required rows; list fixtures pass |
| P05-E | Adapter integration agent: register HTML families behind the legacy strangler. | Registry priorities/signatures, diagnostics, and a parity report comparing new HTML adapters to legacy output owner-by-owner. Do not delete legacy code. | P05-B–D | Zero unexplained HTML semantic deltas; V-PARSER |

Exit gate:

- HTML families are selected by structure and context, not owner identity.
- Each family owns representative fixtures across campuses.
- Semantic parity differences are either fixed or recorded as source-backed intentional corrections.

## Phase 06 — Build Degree-Document and Green River Adapters

Goal: isolate PDF/DOCX structure recovery and Green River source families without changing current availability behavior.

Entry: adapter contract harness passes.  
Parallelism: all four implementation tickets own separate directories and may run together; integration occurs in the phase gate.

| ID | Owner and bounded objective | Owned scope and output | Depends | Verification |
| --- | --- | --- | --- | --- |
| P06-A | Degree-document agent: implement `official-degree-document`. | PDF/DOCX degree sheets, worksheets, planning grids, table/column reconstruction, page boundaries, and evidence locators. Structural recovery belongs in document normalization; academic meaning belongs in this adapter. | P05-A | PDF/DOCX fixtures across all three campuses; sequence/column integrity |
| P06-B | Equivalency agent: implement `uw-grc-equivalency`. | Canonical direct, sequence, alternate, limited-credit, legacy, restriction, effective-range, and no-credit equivalency facts from the official guide. | P05-A | Equivalency fixtures; no independent flattening of sequence rules |
| P06-C | GRC catalog agent: implement `grc-catalog`. | Green River programs, courses, credits, prerequisites/co-requisites, associate-track facts, grouped choices, and catalog-year identity. | P05-A | Current catalog/track fixtures; totals and prerequisite graphs match baseline |
| P06-D | GRC schedule agent: encapsulate `grc-annual-schedule-pdf`. | Move current annual-schedule extraction behind the adapter/document boundary and preserve emitted availability semantics byte-for-byte. | P05-A | Current availability artifacts remain semantically identical |

Exit gate:

- Official PDF/DOCX facts have page/table evidence.
- UW requirement parsing and UW–GRC equivalency parsing are separate domains.
- GRC course/track and schedule facts come only from their authoritative sources.
- Existing availability behavior is unchanged.

## Phase 07 — Normalize Academic Semantics and Reconcile Authority

Goal: produce complete Requirement Model facts rather than course-code bags and parser heuristics.

Entry: all source families emit preliminary IR.  
Parallelism: P07-A through P07-D may run concurrently against independent normalizers; P07-E owns reconciliation; P07-F owns derived mapping compilation.

| ID | Owner and bounded objective | Owned scope and output | Depends | Verification |
| --- | --- | --- | --- | --- |
| P07-A | Course-identity agent: normalize course references safely. | Cross-listing, prefixes, spaced/compact codes, aliases, ranges, sequences, catalog identity, and duplicate-obligation prevention. | P03-C, P05, P06 | Course-code property tests; duplicate aliases never double-count |
| P07-B | Requirement-algebra agent: normalize selection structures. | All-of, choose-N, min/max, credits-from, mutually exclusive sequences, categories, approved lists, and compound paths. Keep informational/support lists outside requirement nodes. | P03-B, P05, P06 | Truth-table fixtures for every structural shape |
| P07-C | Phase/constraint agent: normalize timing and admissions facts. | Before-application, before-enrollment, stay-at-GRC recommendation, minimum grade/GPA/credits, recency, residency, application windows, and direct-to-major steps. No acceptance prediction. | P03-C, P05, P06 | Phase and constraint fixtures; non-schedulable rules stay non-schedulable |
| P07-D | Program/pathway agent: normalize credentials and scoped pathways. | Stable campus/program/credential/pathway identity; prevent pathway facts leaking to siblings or parents. Preserve existing supported path selector semantics. | P03-A, P05, P06 | BA/BS, option, concentration, and single-path fixtures |
| P07-E | Authority agent: reconcile facts and detect material conflict. | `pipeline/reconciliation/`; apply authority by fact domain, merge agreeing evidence, allow lower authority to fill absence, retain both conflicting facts in diagnostics, and block publication. | P07-A–D | Program/catalog agreement, fallback, and conflict fixtures |
| P07-F | Transfer-mapping agent: join domains without mutating source IR. | Compile `UW Requirement IR + UW–GRC Equivalency IR + GRC Course IR` into transfer requirements. Missing equivalents remain explicit and unscheduled; no invented substitute. | P06-B,C, P07-E | Every mapping cites active equivalency; compound/sequence mappings preserved |

Exit gate:

- Full requirement structures, not only course sets, are comparable.
- Program-owned sources, catalogs, equivalency data, and GRC facts retain separate authority.
- A missing equivalent remains truthfully represented without fake schedule output.
- Every derived GRC path traces to an effective equivalency rule.

## Phase 08 — Version Catalog Years and Classify Semantic Change

Goal: retain immutable current-plus-three-year history and distinguish cosmetic source movement from material academic change.

Entry: reconciled IR is deterministic.  
Parallelism: P08-A and P08-B may run together; P08-C follows them; P08-D and P08-E integrate policy and reports.

| ID | Owner and bounded objective | Owned scope and output | Depends | Verification |
| --- | --- | --- | --- | --- |
| P08-A | Catalog-year agent: resolve effective identity. | Rules for catalog-year extraction, current/archive source mapping, effective ranges, unknown-year diagnostics, and preventing historical facts entering the current snapshot. | P07-E | Current/archived fixtures across three campuses |
| P08-B | Revision-store agent: implement immutable snapshots. | Content-addressed revisions under `source/data/transfer-planner/catalog-years/<year>/revisions/`; per-year manifest points to active semantic hash. Store normalized facts/evidence hashes, not full source documents. | P04-B, P03-E | Existing revisions cannot be overwritten; identical semantics deduplicate |
| P08-C | Retention agent: enforce four-year window. | Current plus previous three years; create new current year before pruning N-4; never delete a year until its successor passes full gates. | P08-A,B | Rollover and rollback fixtures |
| P08-D | Semantic-diff agent: compare complete IR. | Detect changes to structure, counts, credits, phases, prerequisites, pathways, constraints, evidence authority, and equivalencies; ignore ordering/layout/cosmetic text. | P07, P08-B | Mutation tests for every semantic category |
| P08-E | Change-policy agent: connect automation decisions. | Cosmetic changes may yield no candidate diff. Valid semantic changes proceed automatically. Ambiguity/conflict/incompleteness blocks with exact owner, IR path, evidence, and remediation class. | P08-D | Policy decision matrix; no score-based tie-breaking |

Exit gate:

- Four immutable catalog years are addressable.
- Same-year updates produce new semantic revisions rather than overwrites.
- Cosmetic page edits do not churn planner output.
- Every semantic update is visible in a complete structured diff.

## Phase 09 — Stage, Validate, Compile, and Atomically Publish

Goal: make partial refreshes incapable of corrupting canonical generated data.

Entry: versioned IR and semantic diff exist.  
Parallelism: P09-A and P09-B may run together; P09-C depends on both; P09-D and P09-E follow; P09-F integrates the command.

| ID | Owner and bounded objective | Owned scope and output | Depends | Verification |
| --- | --- | --- | --- | --- |
| P09-A | Invariant agent: centralize publish-blocking validation. | Schema/reference/source/requirement/equivalency/coverage/architecture invariants under `pipeline/validation/`. Diagnostics include owner, source, IR path, evidence, and remediation class. | P07, P08 | Each invariant has a failing mutation fixture |
| P09-B | Candidate-store agent: implement isolated staging. | Filesystem production store plus temporary/in-memory test store. Stage candidates and generated artifacts outside canonical paths; active data is read through a manifest pointer. | P08-B | Failed stage leaves canonical bytes unchanged |
| P09-C | Runtime-compiler agent: compile IR to current app contracts. | Deterministic compiler for major plans, pathways, requirements, equivalencies, GRC tracks, availability, compact registries, and partition indexes. No network or `.tmp` runtime dependency. | P07-F, P09-A,B | Same snapshot gives byte-identical output; V-TS |
| P09-D | Publication agent: implement atomic promotion/rollback. | Promote only after IR and compiled-runtime gates pass. Promotion changes active manifests/generated artifact set atomically; interruption and failure preserve Last-Known-Good. | P09-B,C | Failure-injection and rollback tests |
| P09-E | Reporting agent: unify candidate diagnostics. | Human and JSON summaries for source discovery, adapter selection, semantic diff, conflicts, coverage, validation, generation, and publish result. Reports must identify actionable owner/source/family. | P09-A–D | Snapshot tests; no full source content/secrets in reports |
| P09-F | Orchestration agent: implement `refreshPlannerData(options)`. | One cross-platform command used by focused refresh, full refresh, Course Planner Updater, and later CI. Existing `refresh-transfer-planner-sources.cjs` becomes a thin compatibility wrapper. | P09-A–E | Targeted/full refresh parity; failed refresh leaves canonical diff empty; V-PLANNER |

Exit gate:

- Canonical outputs change only after every gate passes.
- A failed refresh leaves Last-Known-Good byte-identical.
- Runtime generation is deterministic and network-free.
- One command hides internal pipeline complexity.

## Phase 10 — Migrate All Sources and Retire the Parser Monolith

Goal: achieve complete three-campus source-family coverage, prove parity, then delete superseded orchestration and owner-specific branches.

Entry: new pipeline can stage and compile candidate artifacts.  
Parallelism: campus parity tickets may run concurrently because they own separate fixtures/reports; integration and retirement remain single-owner.

| ID | Owner and bounded objective | Owned scope and output | Depends | Verification |
| --- | --- | --- | --- | --- |
| P10-A | Coverage-manifest agent: define complete inventory. | Machine-readable list of every published undergraduate program/credential/pathway at all three campuses, expected primary source, family, catalog year, and runtime ID. Reconcile the current 188 major plans, 247 pathways, 244 primary owners, and 449 parsed source-owner blocks without conflating counts. | P09-F | No duplicate/missing program identity; inventory review |
| P10-B | Seattle parity agent: migrate all Seattle owners. | Seattle family fixtures and parity report. Every delta is exact parity or a source-backed intentional correction; no unexplained owner-level differences. | P10-A | Seattle coverage and regression suites; V-PARSER |
| P10-C | Bothell parity agent: migrate all Bothell owners. | Bothell fixtures/report with identical classification contract. | P10-A | Bothell coverage and regression suites; V-PARSER |
| P10-D | Tacoma parity agent: migrate all Tacoma owners. | Tacoma fixtures/report with identical classification contract. | P10-A | Tacoma coverage and regression suites; V-PARSER |
| P10-E | Green River/equivalency parity agent: migrate catalog, tracks, equivalencies, and schedules. | Prove current planner-critical course, mapping, track, and availability semantics; classify source-backed corrections. | P10-A | GRC/equivalency audits; availability parity |
| P10-F | Pathway/credential agent: verify all multi-route majors and credential boundaries. | Fixture per supported pathway family; ensure single-path majors have no fake selector and BA/BS/option semantics remain source-true. | P10-B–D | Pathway selector/source-backed tests |
| P10-G | Coverage-gate agent: enforce publish completeness. | Every published undergraduate major must have canonical identity, current official source, known adapter, successful parse, valid IR/evidence, runtime compile, current year, and source-family fixture. Remove product filtering by direct equivalency only after this gate is real. | P10-B–F | Zero hidden student-visible source gaps; all plan coverage statuses complete |
| P10-H | Retirement agent: delete superseded monolith behavior. | Shrink/remove migrated sections of `parse-transfer-planner-requirement-sources.cjs`, bootstrap/student-runtime generator repairs, registry import-time derivations, obsolete diagnostics, and owner-ID parser branches. Keep only thin compatibility entrypoints still used. | P10-G | Architecture tests; no owner-ID adapter branches; V-PLANNER-FULL |

Exit gate:

- All published undergraduate majors at Seattle, Bothell, and Tacoma pass the complete source-backed contract.
- All existing source families route through real adapters.
- Current 6 quality warnings are resolved or explicitly blocking; no warning is silently accepted.
- The legacy monolith no longer owns acquisition, parsing, normalization, reconciliation, generation, or publication.

## Phase 11 — Deepen the Planner Catalog and Living Plan Engine

Goal: make runtime planning consume one validated catalog contract and produce one plan through transfer.

Entry: source pipeline publishes complete catalog-year snapshots.  
Parallelism: P11-A and P11-B may start together; P11-C and P11-D depend on both; P11-E integrates.

| ID | Owner and bounded objective | Owned scope and output | Depends | Verification |
| --- | --- | --- | --- | --- |
| P11-A | Planner Catalog agent: create the runtime read boundary. | Replace broad imports from generated registries with a small catalog interface for campuses, programs, pathways, requirements, equivalencies, courses, availability, catalog years, and evidence metadata. Preserve lazy/partitioned loading. | P10-G | Generated-runtime partitioning tests; V-TS |
| P11-B | Living Plan Engine agent: extract scheduling from the 22,983-line `runtime.ts`. | Introduce pure `buildLivingTransferPlan(input) -> LivingTransferPlan` around existing requirement evaluation, option resolution, planning graph, quarter slots, and suggestions. Move behavior incrementally into focused modules. | P01-A, P02-B | Existing scheduler/runtime suites; no UI/storage imports |
| P11-C | Planning-input agent: define one complete input. | Normalized transcript record, active target, intended transfer quarter, preferred load, unavailable quarters, existing option selections, course state, placement overrides, and immutable catalog snapshot ID. | P11-A,B | Input validation/property tests |
| P11-D | Scheduling-policy agent: centralize accepted rules. | Stop at transfer; preserve current availability and automatic GRC track selection; extend impossible target dates; never violate prerequisites, hard locks, unavailable quarters, or load limits; never predict admission. | P11-C | Impossible-date, path-selection, availability, phase, and overload fixtures |
| P11-E | Runtime integration agent: switch callers to the engine. | `transfer-planner.service.ts`, `usePlannerComputation.ts`, and compatibility adapters; remove duplicated schedule construction while retaining student evaluation, major specifics, and bug-report inputs. | P11-C,D | V-PLANNER; V-APP; all campus fixtures |

Exit gate:

- UI callers know one planner interface, not internal helpers.
- The engine is pure and testable entirely in process.
- All accepted scheduling rules live in one policy boundary.
- Plan output has stable course-instance and quarter identities.

## Phase 12 — Add Course Move, Lock, and Recalculation

Goal: add the only new plan-editing behaviors requested, without weakening existing features.

Entry: stable Living Plan Engine and planning input.  
Parallelism: P12-A and P12-B are sequential core work; P12-C and P12-D may proceed together after them; P12-E integrates UI/controller behavior.

| ID | Owner and bounded objective | Owned scope and output | Depends | Verification |
| --- | --- | --- | --- | --- |
| P12-A | Override-model agent: define stable placement intent. | `PlacementOverride { courseInstanceId, preferredQuarterId, locked }`; move is a preferred placement, lock is a hard constraint. IDs must survive recomputation and cannot use display labels. | P11-E | Serialization, identity, malformed-data tests |
| P12-B | Scheduler agent: apply move/lock constraints. | Recalculate downstream prerequisites and load; preserve unlocked moves when valid; reject impossible locks with a focused result; extend transfer date when necessary; never silently unlock. | P12-A | Moved prerequisite, hard-lock conflict, overload, unavailable quarter, removed course, and target-extension fixtures |
| P12-C | Planner-state agent: persist overrides. | `constants/planner-storage.ts` and `transfer-planner-storage.ts` versioned fields/normalizers; preserve existing path selections, options, current-course state, and toggles. | P12-A | Storage corruption/migration tests |
| P12-D | Controller agent: expose commands. | `usePlannerSelectionState.ts`, `usePlannerComputation.ts`, `useTransferPlannerController.ts`; commands for move, lock, unlock, reset placement, and recompute. No scheduling logic in hooks. | P12-B,C | Controller tests; V-TS |
| P12-E | Planner UI agent: add accessible controls. | `SuggestedScheduleCard.tsx`, `SuggestedScheduleCourseRow.tsx`, focused new components; quarter picker/move action, lock state/control, conflict feedback, keyboard/screen-reader semantics. Preserve current planner features and themes. | P12-D | UI extraction tests; V-TOUCH; keyboard/screen-reader checks |

Exit gate:

- Moving and locking work across reload and recalculation.
- Invalid hard locks are explicit and never bypass prerequisites/load limits.
- Existing option selection, current-course marking, transcript controls, plan toggles, and bug reporting still work.

## Phase 13 — Introduce Planner State v2 and Transcript Privacy

Goal: support one active plan offline/synced while ensuring original transcript files do not persist.

Entry: Living Plan input and override schema stable.  
Parallelism: P13-A and P13-B may run together; P13-C follows B; P13-D follows A/C; P13-E is the final privacy sweep.

| ID | Owner and bounded objective | Owned scope and output | Depends | Verification |
| --- | --- | --- | --- | --- |
| P13-A | Migration agent: implement app/planner schema v2. | `constants/schema.ts`, app-data state/persistence tests. Add active target, intended quarter, load/unavailable-quarter constraints, normalized transcript record reference, overrides, and reminder preferences. Move saved-college/obsolete questionnaire/AI-roadmap values into opaque legacy data; never delete them during upgrade. | P01-D, P11-C, P12-C | Guest/signed-in v1→v2 fixtures; `npm run test:app-data` |
| P13-B | Transcript-ingestion agent: unify parsing. | One `TranscriptIngestor` used by Planner, Profile, and Profile Setup: picker URI/blob → deterministic parser → normalized records → guaranteed source disposal in `finally`. Remove Gemini/document-reader dependence and mandatory review path. | P01-C | Web blob, iOS/Android URI, cancel, failure, duplicate, and success fixtures |
| P13-C | Repository agent: add local-first PlannerStateRepository. | AsyncStorage production adapter, Firestore production adapter, in-memory tests; state covers active target, normalized courses, plan constraints/state, overrides, revisions, and reminder preferences. Generated catalog data is never user state. | P13-A,B | Offline write/restart/reconnect/two-device conflict tests |
| P13-D | Sync agent: sync normalized transcript records only. | Guest-local behavior; account promotion; signed-in course/GPA/parser-version/timestamp sync; deterministic revision conflict rule. Original filename/path/blob/data URL never crosses repository boundary. | P13-C | Firebase emulator/rules and cross-device fixtures; V-FIREBASE in CI |
| P13-E | Privacy agent: purge legacy transcript artifacts. | Remove transcript URL/source fields, persistent transcript copies, base64 export, debug source identities, remote-log paths, and transcript storage permissions. Imports strip embedded transcripts. Add dry-run/admin cleanup for legacy stored transcripts; preserve resume/avatar. | P13-B–D | Inspect AsyncStorage/export/log/Firestore/Storage payloads; account deletion tests |

Exit gate:

- A transcript original is discarded after parsing on success and failure.
- Guests work locally; signed-in users sync normalized records and plan state.
- Existing saved-college/obsolete values survive invisibly as opaque legacy data.
- No privacy-sensitive source identity appears in bug/error payloads.

## Phase 14 — Remove AI and Broad College-Discovery Product Code

Goal: delete obsolete runtime behavior only after deterministic replacements and safe migrations exist.

Entry: Planner State v2, deterministic transcript ingestion, Living Plan, and timeline prerequisites exist.  
Parallelism: P14-A and P14-B may inspect in parallel but share no writes; P14-C/D follow migration replacements; P14-E owns package/functions integration.

| ID | Owner and bounded objective | Owned scope and output | Depends | Verification |
| --- | --- | --- | --- | --- |
| P14-A | Surface-removal agent: remove college tools. | Delete Saved Colleges, Compare, Cost Calculator, college-detail routes/pages/cards and route metadata. Remove corresponding resource-catalog entries. Preserve Transfer Equivalency Catalog under Resources. | P13-A | Zero route/caller references; V-APP; V-I18N |
| P14-B | Saved-college runtime agent: retire actions/sync. | Remove public saved-college actions, pending mutation work, reconciliation, saved-college opportunity generation, Scorecard/college services, and college targets. Preserve opaque legacy payload and account-deletion cleanup. | P13-A, P14-A | Persistence/auth promotion/deletion tests; zero runtime imports |
| P14-C | Roadmap agent: replace and retire legacy roadmap. | Remove roadmap-generated course suggestions and saved-college seeds after Living Plan/Personalized Timeline callers replace them. Preserve remote legacy records until account deletion; do not destructively migrate them. | P11-E, P16-B | Zero runtime imports; calendar/planner tests |
| P14-D | AI-removal agent: remove client AI stack. | Delete `services/ai/*`, `document-reader.service.ts`, chat/AI storage keys, client gateway, AI diagnostics, prompts/types, and config/env references after deterministic transcript/opportunity/plan paths exist. | P13-B, P14-B,C | Zero `aiService`, `aiGateway`, chat-assistant, or Gemini client references; V-TS |
| P14-E | Functions/dependency integration agent: remove server AI and analytics. | Remove `geminiGateway`, prompt templates/tests, AI portions of `opportunityGateway`, chat rules/collections, Vercel Analytics component/package, AI env docs, and unused dependencies. Preserve deterministic opportunity admin CRUD, support email, operational error logging, and planner bug reports. | P14-D | Functions tests/lint, V-FIREBASE in CI, V-CHECK, V-WEB |

Exit gate:

- No conversational, explanatory, ranking, roadmap-generating, or hidden generative AI remains.
- No behavioral analytics SDK remains.
- No surviving code reads Saved Colleges for product behavior.
- Removed routes have deliberate redirect/not-found behavior and no dead tab aliases.

## Phase 15 — Replace the Shell with Planner-First Navigation and Onboarding

Goal: make the product hierarchy match the focused mission while preserving brand and guest-first access.

Entry: removed feature routes are known; planner and calendar replacements exist.  
Parallelism: P15-A is integration-owned; P15-B/C can proceed after its route contract; P15-D integrates onboarding and old links.

| ID | Owner and bounded objective | Owned scope and output | Depends | Verification |
| --- | --- | --- | --- | --- |
| P15-A | Route integration agent: define four primary tabs. | `constants/routes.ts`, `app/(tabs)/_layout.tsx`, `ResourcesAwareTabBar.tsx`: Transfer Planner, Resources, Calendar, Profile. Settings becomes a hidden Profile-owned route. Choose one canonical planner URL and preserve valid legacy deep links through explicit redirects/aliases. | P14-A | Route metadata/startup tests; V-TS |
| P15-B | Landing-page agent: make Planner the root experience. | Replace `app/(tabs)/index.tsx`/Home routing with planner landing; add compact next-action summary sourced from Living Plan/Timeline. Delete `HomePage.tsx` and `components/pages/home/*` only after all useful behavior is relocated. | P15-A, P11-E, P16-B | Guest/signed-in startup tests; rendered-flow tests |
| P15-C | Profile/settings agent: nest settings. | Add Settings entry to Profile; settings subpages return through Settings while tab highlighting remains Profile. Preserve themes, languages, reminders, import/export, support, privacy, terms, and account deletion. | P15-A | Route/return-to tests; Profile/Settings QA |
| P15-D | Onboarding agent: focus setup and tours. | Require only transcript/manual course entry, UW campus/major, intended transfer quarter, preferred load, and unavailable quarters. Keep eligibility fields optional later. Remove broad college-preference questions from active UI. Replace Home/Settings tour targets. Guests generate immediately; account CTA remains optional. | P13, P15-A–C | Clean guest → plan flow; signed-in migration flow; tour tests |

Exit gate:

- Four tabs and their active/highlight/return behavior are correct on web/mobile.
- Planner is the landing experience; no separate Home remains.
- Settings is reachable inside Profile but not a primary tab.
- Onboarding collects only plan-critical data.

## Phase 16 — Build the Personalized Timeline and Focus Resources

Goal: connect plan milestones and relevant opportunities without inventing a new opportunity-status workflow.

Entry: Living Plan, active target, and final navigation exist.  
Parallelism: P16-A and P16-B may start together; P16-C follows both; P16-D/E own UI/reminder integration separately.

| ID | Owner and bounded objective | Owned scope and output | Depends | Verification |
| --- | --- | --- | --- | --- |
| P16-A | Opportunity-matching agent: implement unknown-safe deterministic relevance. | Pure matcher inputs: campus, major, transfer year, GPA, residency, optional demographics/interests. Known hard mismatches may exclude; unknown is neutral; no profile signals or zero results returns all active opportunities. Emit typed reason codes/parameters, not English strings. Preserve current status/completion semantics. | P13-A | Table-driven known/unknown/mismatch/fallback tests |
| P16-B | Timeline agent: implement `projectTransferTimeline`. | Pure builder from active plan, official application/prerequisite milestones, relevant opportunities, current completion state, and optional personal deadlines. Stable entry IDs, source type, due date, destination, and localized message descriptor. Remove roadmap/saved-college facts. | P11-E, P16-A | Seattle/Bothell/Tacoma, target-switch, completion, and offline fixtures |
| P16-C | Reminder-intent agent: derive language-neutral reminders. | Timeline → reminder intents with offsets, stable IDs, completion cancellation, and idempotent rescheduling. Only relevant/fallback opportunities schedule. | P16-B | Clock-controlled 7/1/0-day, cancel, reschedule, duplicate tests |
| P16-D | Calendar UI agent: make Timeline the primary Calendar experience. | `DeadlineCalendarPage.tsx`, controller/view helpers; retain useful current calendar presentation while removing college-detail targets and general roadmap dependence. Provide source-aware navigation to Planner/Resources/external official links. | P16-B | Calendar interaction/keyboard tests; V-APP |
| P16-E | Resources agent: focus the catalog. | Resources contains scholarships, internships, useful transfer resources, opportunity completion behavior, opportunity match reasons, and the separate Transfer Equivalency Catalog. Remove planner duplicate cards and eliminated college tools. | P14-A, P16-A, P15-A | Resource model tests; V-I18N; responsive QA |

Exit gate:

- Calendar entries derive from one Living Plan and relevant/fallback opportunities.
- Unknown profile values never hide an opportunity.
- Existing completion behavior is unchanged.
- Transfer Equivalency Catalog remains separate under Resources.

## Phase 17 — Automate Static Localization

Goal: let developers author English once while shipping validated static translations for all existing languages.

Entry: final product copy surfaces and typed reason/message descriptors are stable enough to translate.  
Parallelism: P17-A precedes all; P17-B and P17-C may run together; P17-D follows both; P17-E integrates workflow/CI.

| ID | Owner and bounded objective | Owned scope and output | Depends | Verification |
| --- | --- | --- | --- | --- |
| P17-A | Locale-registry agent: create one source of locale configuration. | `constants/locales/locales.config.json` (or typed equivalent) contains language name, locale code, file, RTL metadata, and enabled state. Generate Metro-compatible static imports/types/maps so `translations.ts` and scripts stop duplicating 16-language lists. | P02-D | A fixture locale requires only config + locale JSON; V-I18N |
| P17-B | Translation-engine agent: implement changed-key automation. | Development/CI-only provider port plus fake test adapter; English value hashes and translation-state manifest; translate only new/changed keys; stage writes and roll back on provider failure. No provider code/credentials enter the app bundle. | P17-A | Fake-provider, changed-key, idempotency, rollback tests |
| P17-C | Terminology agent: protect meaning. | Token shielding for `{placeholders}`, interpolation plural forms, URLs, campus names, course codes, program IDs, and glossary terms; academic glossary plus explicit per-key overrides. | P17-A | Mutation/property tests preserve exact token multisets |
| P17-D | Risk/quality agent: classify and repair translations. | Auto-write ordinary copy; flag legal, multiline, placeholder-rich, academic, or override-conflicting strings. Strengthen validation for exact placeholder multisets and suspicious English fallbacks. Repair current known losses: 13 locales with missing placeholders, English-heavy Persian/Tagalog, and any additional audit findings. | P17-B,C | 16 locales × all keys; deliberate placeholder/untranslated mutations fail |
| P17-E | Workflow agent: expose translation commands. | Commands to scan, translate, review risky keys, validate, and check generated drift. Expand user-facing-string audit to notifications and relevant planner UI. Document secrets only for developer/CI environments. | P17-D | V-I18N; V-CHECK; app bundle contains no translation client |

Exit gate:

- New/changed English copy can update 15 non-English bundles automatically.
- Adding a locale is configuration-driven.
- Placeholders, course codes, campus names, and academic vocabulary cannot be silently damaged.
- Runtime uses static bundles only.

## Phase 18 — Complete Offline, Sync, and Reminder Delivery

Goal: make agreed planner/timeline behavior reliable across offline use, restart, account promotion, and multiple devices.

Entry: PlannerStateRepository and Timeline/Reminder Intent contracts exist.  
Parallelism: P18-A and P18-B may run together; P18-C depends on A; P18-D depends on B/C; P18-E integrates offline catalog behavior.

| ID | Owner and bounded objective | Owned scope and output | Depends | Verification |
| --- | --- | --- | --- | --- |
| P18-A | Offline-state agent: implement local-first mutations. | Active target, normalized transcript records, constraints, course state, placement overrides, opportunity completion, timeline completion, and reminder preferences work from AsyncStorage without network. Queue signed-in mutations for replay. | P13-C | Offline create/edit/restart/reconnect fixtures |
| P18-B | Sync-policy agent: define deterministic convergence. | Revision/timestamp conflict semantics for one active plan; guest-to-account promotion; sign-out isolation; two-device updates; account deletion. Do not sync OS notification IDs. | P13-D | Two-device/conflict/promotion/deletion tests |
| P18-C | Local-reminder agent: schedule guest/device reminders. | Local-device adapter consumes Reminder Intents; permission handling, completion cancellation, target change, locale change, idempotent reschedule, and device-local identifiers. | P16-C, P18-A | Fake clock/device scheduler tests; offline QA |
| P18-D | Push agent: add optional signed-in push. | Explicit opt-in; per-device Expo token + locale; Firestore token rules; scheduled Firebase dispatcher; retry/idempotency; invalid-token cleanup; sign-out/delete revocation. No email path. | P18-B,C | Fake Expo endpoint, functions tests, V-FIREBASE in CI |
| P18-E | Offline-catalog agent: guarantee read availability. | Bundle/retain validated planner catalog snapshot and starter opportunity catalog for first-load/offline use; update atomically when online. Calendar renders from local plan/timeline instead of requiring `ensureUserRoadmap`. | P11-A, P16-B, P18-A | Clean install, first online load, airplane-mode restart, stale/new snapshot tests |

Exit gate:

- Planner, Timeline, normalized course records, and opportunity catalog remain usable offline after first load.
- Guest reminders are local; signed-in preferences/intents sync; push remains opt-in.
- Reconnect never creates a second active plan or resurrects deleted/old state.

## Phase 19 — Enforce Accessibility and Responsive Quality

Goal: make WCAG 2.2 AA-equivalent behavior a reusable property of shared components and a release gate.

Entry: final navigation and core workflows are structurally stable.  
Parallelism: P19-A precedes screen remediation; P19-B through P19-D own disjoint screen groups; P19-E integrates automated/manual gates.

| ID | Owner and bounded objective | Owned scope and output | Depends | Verification |
| --- | --- | --- | --- | --- |
| P19-A | Accessibility-foundation agent: deepen shared primitives. | Reduced-motion hook/animation bypass, accessible role/name/state conventions, web focus styling, dynamic-type-safe sizing, RTL-aware layout metadata, and automated theme-token contrast audit. Update `AnimatedPressables` so animation is not unconditional. | P17-A | Primitive tests across themes, font scales, RTL, and reduced motion |
| P19-B | Planner accessibility agent: remediate Planner/onboarding. | Heading/reading order, selection semantics, move/lock controls, live recalculation/conflict announcements, dropdown/modal focus, keyboard reachability, 200% text, narrow widths, and translated labels. | P12-E, P15-D, P19-A | Screen assertions; keyboard and screen-reader checklist |
| P19-C | Timeline/Resources accessibility agent: remediate Calendar, Resources, and Equivalency Catalog. | Entry/list semantics, completion states, filters, reasons, external-link labels, focus restoration, responsive tables/cards, RTL, and dynamic type. | P16, P19-A | Axe/keyboard/RTL/text-scale tests |
| P19-D | Profile/settings/auth accessibility agent: remediate account surfaces. | Form labels/errors, modal focus traps/restoration, destructive confirmation semantics, language/theme controls, notification permission copy, and responsive web/mobile layout. | P15-C,D, P18-D, P19-A | Form/modal tests; manual VoiceOver/TalkBack/keyboard |
| P19-E | QA agent: create the accessibility matrix and CI gates. | Axe-style web audit, contrast, keyboard/focus order, reduced motion, RTL, 200% text, 320/360px overflow, touch targets, and mobile harness. Keep existing touch audit and run `qa:mobile` in CI, not only Windows web QA. | P19-B–D | Deliberately broken fixtures fail each gate; V-TOUCH; V-MOBILE; V-WINDOWS |

Exit gate:

- Core workflows pass automated accessibility checks in all themes and representative locales.
- Manual VoiceOver, TalkBack, and keyboard/NVDA checklists pass.
- No layout loses actions/content at 200% text or narrow supported widths.
- Reduced-motion preference suppresses nonessential animation.

## Phase 20 — Automate Refresh, Integrate Everything, and Ship One Update

Goal: prove the combined system, enable guarded weekly source refresh, and prepare one coherent update.

Entry: every earlier phase gate passes independently.  
Parallelism: P20-A/B/C may prepare concurrently with non-overlapping ownership; P20-D integrates migrations; P20-E/F run after the integrated build; P20-G is the final release gate.

| ID | Owner and bounded objective | Owned scope and output | Depends | Verification |
| --- | --- | --- | --- | --- |
| P20-A | Automation agent: add weekly/manual planner refresh. | `.github/workflows/planner-refresh.yml` and required PR checks: weekly cron, `workflow_dispatch`, Node 20, `npm ci`, candidate refresh, full parser/invariant/fixture/regression/type/runtime gates, reports uploaded on every outcome, no-diff success, valid bot PR, invalid issue/update with unchanged data. | P10, P17-E | Workflow lint/dry-run; intentionally invalid candidate cannot publish |
| P20-B | Bot-delivery agent: configure guarded PR automation. | Dedicated GitHub App/automation token if needed so bot PRs trigger downstream checks; bot branch; squash auto-merge only after named required checks. No direct `main` writes. Avoid storing secrets in repo. | P20-A | Test repository dry-run or documented sandbox evidence |
| P20-C | Cross-platform updater agent: unify local and CI commands. | Course Planner Updater launchers call the same `refreshPlannerData` path; remove PowerShell-only requirement from core full verification while preserving Windows launcher UX and layman diagnosis. | P09-F | Windows/macOS/Linux command-path tests; targeted/full refresh |
| P20-D | Upgrade/migration agent: run combined v1→v2 migration rehearsal. | Clean install, guest upgrade, signed-in upgrade, opaque legacy saved-college/roadmap preservation, transcript artifact cleanup, locale state, notification state, account promotion, sign-out, and deletion. Produce rollback notes. | P13–P18 | Migration fixtures plus device/emulator rehearsal |
| P20-E | Full verification agent: run every code/data gate. | Execute V-CHECK, V-PLANNER, V-PLANNER-FULL, V-FIREBASE, V-WEB, V-MOBILE, V-WINDOWS, V-TOUCH plus parser parity, semantic diff, translation quality, privacy, offline/sync, and accessibility suites. Java 21 must be provisioned for Firebase emulator tests. | P20-A–D | Exact command log with zero unexplained failures |
| P20-F | Product QA agent: verify real workflows. | Web, iOS, Android: guest immediate plan, signed-in sync, all campuses/representative majors, impossible transfer date, move/lock/recalculate, offline restart, relevant/fallback opportunities, Timeline/reminders, Equivalency Catalog, Settings under Profile, locales/RTL/themes, bug report. | P20-D,E | Screenshot/interaction evidence; no console/runtime errors |
| P20-G | Release integrator: complete one-update readiness review. | Confirm scope, generated diffs/producers, privacy/terms/offline docs, removed env/dependencies, source audit coverage, artifact sizes, route migrations, Last-Known-Good rollback, release notes, and no unrelated worktree changes. Do not publish without explicit user authorization. | P20-E,F | Final checklist signed; clean scoped diff; one combined build candidate |

Exit gate:

- The weekly and manual source pipeline safely auto-updates via guarded PRs.
- One combined update passes every planner, app, privacy, offline, localization, accessibility, Firebase, and platform gate.
- Last-Known-Good planner data and application rollback procedures are proven.
- Release/publish remains a separate user-authorized action.

## 9. Recommended Subagent Waves

Do not equate one ticket with one simultaneously running agent. Use the available concurrency limit and preserve write isolation.

1. **Wave 0 — Evidence:** P00-A–D, then P00-E.
2. **Wave 1 — Characterization:** P01-A–E, grouped so only one agent owns each test runner/config.
3. **Wave 2 — Contracts:** P02-A/B in parallel, then P02-C/D.
4. **Wave 3 — Requirement Model:** P03-A–D in parallel, then P03-E.
5. **Wave 4 — Acquisition:** P04-A/B, then P04-C/D.
6. **Wave 5 — Adapters:** P05-B/C/D and P06-A/B/C/D in bounded adapter directories; one registry integrator owns P05-A/E.
7. **Wave 6 — Semantics:** P07-A–D, then reconciliation/mapping P07-E/F.
8. **Wave 7 — Versioning/publication:** P08-A/B, P08-C/D/E, then P09-A/B/C and P09-D/E/F.
9. **Wave 8 — Coverage:** campus agents P10-B/C/D plus GRC agent P10-E; integration agent owns A/F/G/H.
10. **Wave 9 — Runtime:** P11-A/B, then C/D/E.
11. **Wave 10 — Plan editing and state:** P12 followed by P13; transcript and repository agents may overlap only before shared state integration.
12. **Wave 11 — Product removal:** P14-A/B/C in isolated scopes; P14-D/E after replacements prove zero callers.
13. **Wave 12 — Shell and product workflows:** P15 followed by P16; route and screen integrators remain single-owner.
14. **Wave 13 — Enablement:** P17 localization and P19 accessibility foundations may overlap; P18 follows stable state/timeline contracts.
15. **Wave 14 — Whole integration:** P20-A/B/C, migration rehearsal, full verification, product QA, final review.

## 10. Critical Risks and Required Countermeasures

| Risk | Countermeasure |
| --- | --- |
| A green parse count hides incomplete semantics. | Gate full Requirement Model structure/evidence/coverage, not only successful fetch/course-code extraction. |
| Candidate generation mutates canonical files before validation. | Stage everything, validate/compile/test, then atomically promote manifest/artifact set. |
| New adapters become per-major condition piles. | Select by structural signatures; architecture test forbids owner/plan/major dispatch; source-cited typed overrides only. |
| Equivalency logic contaminates official UW requirements. | Keep UW Requirement IR and equivalency IR separate; derive GRC mappings in compiler. |
| Saved-college deletion destroys user data. | Migrate to opaque legacy storage first; remove only runtime consumers. |
| AI removal breaks transcript/profile/calendar flows. | Land deterministic TranscriptIngestor, Living Plan, Timeline, and relevance matching before deleting AI/roadmap code. |
| Move/lock uses display labels and corrupts placements. | Stable course-instance IDs and versioned overrides; invalid locks return explicit conflicts. |
| Calendar points to removed college pages. | Timeline projection owns target types; route contract test rejects retired destinations. |
| Signed-in planner/calendar fails offline. | Local-first repository and local Timeline projection; Firestore is sync, not read prerequisite. |
| Transcript originals survive in cache/export/logs/storage. | Privacy tests inspect every boundary plus dry-run cleanup of legacy Firebase/local artifacts. |
| Auto-translation damages placeholders or academic terms. | Exact token-multiset validation, shielding, glossary, overrides, risk review, atomic provider writes. |
| Bot PR does not trigger required workflows. | Use a GitHub App/dedicated automation token and verify required-check execution before enabling auto-merge. |
| Existing user work is overwritten. | Re-read exact dirty diffs before each hot-file ticket; one integration owner; never revert unrelated changes. |
| Firebase tests appear green locally because Java is missing. | Treat missing Java as a failed/unverified gate; run emulator suite in Java 21 CI before completion. |

## 11. Definition of Done

The combined update is done only when all statements are true:

- Transfer Planner is the landing tab and supports one active UW target through transfer.
- Primary tabs are Transfer Planner, Resources, Calendar, and Profile; Settings is under Profile; Home is gone.
- All published undergraduate majors at UW Seattle, Bothell, and Tacoma meet the complete source-backed coverage contract.
- Official source refresh is source-family-based, catalog-year-versioned, automatic, guarded, atomic, and reproducible.
- Failed/ambiguous source updates leave Last-Known-Good data byte-identical.
- The plan preserves existing features and adds working move/lock/recalculate behavior.
- Impossible targets extend safely; current automatic GRC track and availability behavior remain intact.
- Relevant opportunities are deterministic and unknown-safe; fallback-all works; current completion behavior remains.
- Calendar is a Personalized Timeline and reminders follow the accepted guest/signed-in model.
- Original transcript files are discarded; only normalized records persist/sync/export/log.
- Conversational/generative AI, ranking, Saved Colleges, Compare, Cost Calculator, broad college services, roadmap generation, chat infrastructure, and behavioral analytics are absent from runtime.
- Existing obsolete user values remain non-destructively preserved through upgrade.
- All 16 locales are generated/validated statically with placeholder and terminology protection.
- Offline, accessibility, responsive, Firebase, planner, parser, app, web, mobile, and Windows gates pass.
- Existing planner bug reporting remains functional.
- No generated file was hand-edited and every generated diff names its producer.
- No unrelated user change was reverted.
- Nothing is published until the user explicitly authorizes release.
