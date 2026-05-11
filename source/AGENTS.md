# Source App AI Maintainer Guide

This folder contains the Expo/React Native app, Firebase Functions, planner runtime, generated planner data, and planner maintenance scripts.

## Mental Model

- `app/` contains Expo Router route files. Most route files delegate to page components.
- `components/pages/` contains page-level experiences.
- `components/ui/` contains reusable primitives.
- `hooks/use-app-data.tsx` owns local app state, persisted app data, profile updates, questionnaire answers, saved colleges, and account/session reconciliation.
- `services/` contains integration and domain logic.
- `constants/` contains app constants, generated planner data, theme tokens, routes, schema keys, and locale resources.
- `scripts/planner/` owns planner ingestion, parsing, code generation, audits, and verification.

## Command Cwd

Run app and planner commands from this `source/` directory.

```powershell
npm run lint
npx tsc --noEmit
npm run start
npm run planner:verify
npm run planner:full:verify
```

Do not tell users to run these from the repository root unless the command explicitly references `source`.

## Generated Planner Artifacts

Treat generated planner artifacts as outputs, not source of truth. Avoid opening the largest generated files unless absolutely necessary; they can swamp AI context and search results.

Do not hand-edit:

- `constants/transfer-planner-source/requirement-source-adapters.generated.ts`
- `constants/transfer-planner-source/student-runtime.generated.ts`
- `constants/transfer-planner-source/course-metadata.generated.ts`
- `constants/transfer-planner-source/equivalency-guide.generated.ts`
- `constants/transfer-planner-source/source-fingerprints.generated.ts`
- `constants/transfer-planner-source/bootstrap.generated.ts`
- `constants/transfer-planner-source/grc-associate-tracks.generated.ts`
- `constants/transfer-planner-source/primary-source-promotions.generated.ts`
- `constants/transfer-planner-source/source-gaps.generated.ts`
- `constants/transfer-planner-source/requirement-diff-classifications.generated.ts`
- `constants/transfer-planner-grc-availability.generated.ts`
- `constants/transfer-equivalency-catalog.generated.ts`
- `constants/green-river-major-options.generated.ts`
- planner docs under `docs/planner/UW*_DEGREE_COURSES.md`

Prefer editing source inputs and scripts, then regenerating:

```powershell
npm run planner:refresh
npm run planner:verify
npm run planner:full:verify
```

Useful planner reports are written under `.tmp/`, especially:

- `.tmp/transfer-planner-maintenance-summary.md`
- `.tmp/transfer-planner-hardening-report.md`
- `.tmp/transfer-planner-source-backed-coverage-audit.md`
- `.tmp/transfer-planner-requirement-source-parse-report.md`
- `.tmp/transfer-planner-primary-source-discovery.md`

## Where To Edit

- Routing constants: `constants/routes.ts`
- Tab shell and hidden tab routes: `app/(tabs)/_layout.tsx`
- Resources tab highlighting aliases: `components/ResourcesAwareTabBar.tsx`
- App state and persistence: `hooks/use-app-data.tsx`
- Firestore/local storage schema keys: `constants/schema.ts`
- Planner questionnaire storage keys: `constants/planner-storage.ts`
- Theme values: `constants/theme-tokens.ts`
- Theme state: `hooks/use-app-theme.tsx`
- Translation source used by the app: `services/app/translations.ts`
- Locale JSON references: `constants/locales/`
- AI recommendations and assistant behavior: `services/ai/ai.service.ts`
- AI gateway client: `services/ai/ai-gateway.service.ts`
- AI context serialization: `services/ai/ai-context.service.ts`
- College Scorecard integration: `services/colleges/college.service.ts`, `services/colleges/scorecard.ts`
- Saved colleges sync: `services/colleges/saved-colleges.service.ts`
- Opportunity catalog/status/matching: `services/opportunities/`
- Deadline grouping: `services/deadlines/deadline-calendar.service.ts`
- Transcript cache behavior and credit estimates: `services/planning/transfer-planner-cache.service.ts`
- Transcript reset behavior: `services/planning/transcript-reset.service.ts`
- Transfer planner runtime barrel: `services/planning/transfer-planner.service.ts`
- Transfer planner runtime implementation for remaining orchestration: `services/planning/transfer-planner/runtime.ts`
- Transfer planner course parsing/catalog-year logic: `services/planning/transfer-planner/course-code.ts`
- Transfer planner requirement status and option matching logic: `services/planning/transfer-planner/requirement-status.ts`
- Transfer planner controller composition hook: `components/transfer-planner/useTransferPlannerController.ts`
- Transfer planner selection/persistence hook: `components/transfer-planner/usePlannerSelectionState.ts`
- Transfer planner transcript upload/parsing hook: `components/transfer-planner/useTranscriptPlannerState.ts`
- Transfer planner computation hook: `components/transfer-planner/usePlannerComputation.ts`
- Transfer planner bug-report hook: `components/transfer-planner/useCoursePlannerBugReport.ts`
- Transfer planner helper barrel: `components/transfer-planner/transfer-planner-formatters.ts`
- Transfer planner transcript debug helpers: `components/transfer-planner/transfer-planner-transcript-debug.ts`
- Transfer planner bug-report formatting: `components/transfer-planner/transfer-planner-bug-report.ts`
- Transfer planner copy/link helpers: `components/transfer-planner/transfer-planner-copy.ts`, `components/transfer-planner/transfer-planner-linking.ts`
- Transfer planner schedule display helpers: `components/transfer-planner/transfer-planner-suggested-schedule.ts`
- Transfer planner major-specific display helpers: `components/transfer-planner/transfer-planner-major-specifics-formatters.ts`
- Transfer planner UI components: `components/transfer-planner/`
- Transfer planner route page shell: `components/pages/TransferPlannerPage.tsx`
- Transfer equivalency UI: `components/pages/TransferEquivalencyCatalogPage.tsx`
- Planner parser and refresh tooling: `scripts/planner/`

## Large-File Warning

These files are human-maintained but large enough that AI agents should inspect targeted symbols with `rg` before opening broad chunks:

- `services/planning/transfer-planner/runtime.ts`
- `services/ai/ai.service.ts`
- `services/app/translations.ts`
- `scripts/planner/parse-transfer-planner-requirement-sources.cjs`
- `scripts/planner/audit-transfer-planner-source-backed-coverage.cjs`
- `scripts/planner/transfer-planner.service.test.ts`

Use focused searches such as:

```powershell
rg -n "buildSuggestedQuarterPlan" services/planning/transfer-planner/runtime.ts
rg -n "buildRequirementStatuses|getRequirementOptionCourseLabels" services/planning/transfer-planner/requirement-status.ts
rg -n "TRANSFER_PLANNER_TRANSCRIPT_COURSES_FIELD|TRANSFER_PLANNER_CURRENT_COURSES_BY_PATH_FIELD" constants/planner-storage.ts components/transfer-planner services/planning
rg -n "^test\\(" scripts/planner/transfer-planner.service.test.ts
```

## Planner Change Checklist

When touching planner logic or source data:

- Identify whether the real source is a script, a manual override file, or generated output.
- Avoid editing generated output directly.
- Run the narrowest relevant planner test first.
- Run `npm run planner:verify` before considering the change complete.
- If generated files changed, summarize which script produced them and which report confirms the result.

## App Change Checklist

When touching app behavior:

- Keep route constants and tab aliases in sync.
- Keep storage keys centralized where possible.
- For planner questionnaire state, add or rename keys only in `constants/planner-storage.ts` and import them elsewhere.
- Guard persisted state with `isHydrated`.
- Preserve guest-mode and signed-in behavior unless the request changes account behavior.
- Keep theme behavior consistent across `light`, `dark`, `green`, and `system`.
- Use `SUPPORT_EMAIL`, `SUPPORT_MAILTO`, and `APP_VERSION` instead of duplicating values.
- Run `npm run lint` and `npx tsc --noEmit` for broad app changes.
