# Source App AI Maintainer Guide

This folder has Expo/React Native app, Firebase Functions, planner runtime, generated planner data, planner maintenance scripts.

## Mental Model

- `app/` has Expo Router route files. Most route files delegate to page components.
- `components/pages/` has page-level experiences.
- `components/ui/` has reusable primitives.
- `hooks/use-app-data.tsx` owns local app state, persisted app data, profile updates, questionnaire answers, saved colleges, account/session reconciliation.
- `services/` has integration and domain logic.
- `constants/` has app constants, generated planner data, theme tokens, routes, schema keys, locale resources.
- `scripts/planner/` owns planner ingestion, parsing, code generation, audits, verification.

## Command Cwd

Run app and planner commands from this `source/` directory.

```powershell
npm run lint
npx tsc --noEmit
npm run start
npm run planner:verify
npm run planner:full:verify
```

Do not tell users to run these from repository root unless command explicitly references `source`.

## Generated Planner Artifacts

Treat generated planner artifacts as outputs, not source of truth. Avoid largest generated files unless needed; they swamp AI context and search.

Do not hand-edit:

- `constants/transfer-planner-source/requirement-source-adapters.generated.ts`
- `constants/transfer-planner-source/student-runtime.generated.ts`
- `constants/transfer-planner-source/student-runtime.generated/*.generated.json`
- `constants/transfer-planner-source/course-metadata.generated.ts`
- `constants/transfer-planner-source/course-metadata.generated.data.json`
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

Edit source inputs/scripts, then regenerate:

```powershell
npm run planner:refresh
npm run planner:verify
npm run planner:full:verify
```

Useful planner reports under `.tmp/reports/`, especially:

- `.tmp/reports/transfer-planner-maintenance-summary.md`
- `.tmp/reports/transfer-planner-hardening-report.md`
- `.tmp/reports/transfer-planner-source-backed-coverage-audit.md`
- `.tmp/reports/transfer-planner-requirement-source-parse-report.md`
- `.tmp/reports/transfer-planner-primary-source-discovery.md`

## Where To Edit

- Routing constants: `constants/routes.ts`
- Tab shell and hidden tab routes: `app/(tabs)/_layout.tsx`
- Resources tab highlighting aliases: `components/ResourcesAwareTabBar.tsx`
- App state and persistence: `hooks/use-app-data.tsx`
- Firestore/local storage schema keys: `constants/schema.ts`
- Planner questionnaire storage keys: `constants/planner-storage.ts`
- Theme values: `constants/theme-tokens.ts`
- Theme state: `hooks/use-app-theme.tsx`
- Translation source JSON: `constants/locales/`
- Translation app adapter: `services/app/translations.ts`
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

These files human-maintained but large. Inspect targeted symbols with `rg` before broad chunks:

- `services/planning/transfer-planner/runtime.ts`
- `services/ai/ai.service.ts`
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

When touching planner logic/source data:

- Identify real source: script, manual override file, or generated output.
- Do not edit generated output directly.
- Run narrowest relevant planner test first.
- Run `npm run planner:verify` before done.
- If generated files changed, summarize producing script and confirming report.

## App Change Checklist

When touching app behavior:

- Keep route constants and tab aliases synced.
- Keep storage keys centralized where possible.
- For planner questionnaire state, add/rename keys only in `constants/planner-storage.ts`; import elsewhere.
- Guard persisted state with `isHydrated`.
- Preserve guest-mode and signed-in behavior unless request changes account behavior.
- Keep theme behavior consistent across `light`, `dark`, `green`, and `system`.
- Use `SUPPORT_EMAIL`, `SUPPORT_MAILTO`, and `APP_VERSION` instead of duplicating values.
- Run `npm run lint` and `npx tsc --noEmit` for broad app changes.

## Code analysis — wont-fix

- **Graph-analysis:** `constants/transfer-planner-source/course-metadata.generated.ts` intentionally references `course-metadata.ts` for shared runtime/types in the generated planner metadata loader. The analyzer reports that generated import cycle, but the planner contract is verified by the source-backed maintenance checks above and this cycle is an accepted artifact of the codegen boundary.
- **Security-scan** react-native, babel-jest, @jest/transform, babel-plugin-istanbul, @istanbuljs/load-nyc-config, js-yaml; Expo SDK 54 pins React Native 0.81.x, and remaining advisories live in React Native published Jest/Istanbul toolchain, not first-party app/runtime code. Gator Guide applied in-SDK patch updates plus transitive overrides that clear Firebase/OpenTelemetry audit chain; clearing last findings needs coordinated Expo/React Native major upgrade.