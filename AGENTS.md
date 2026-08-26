# GatorGuide AI Maintainer Guide

<!-- project-memory-bootstrap:v1 -->
## Memory bank bootstrap (technical name: project-memory)

From this project root, before any task, run:

```bash
python3 ../../scripts/project-memory-context.py --root . --task "<current task>"
```

Read every path listed under `Required source reads` before editing. A non-zero result blocks the task; repair the project contract or route before continuing. Edit durable tasks and memory only at contract-listed paths.
<!-- /project-memory-bootstrap:v1 -->


Repo source-available. Working app in `source/`. Most commands run from `source`, not repo root.

## Start Here

- App source: `source/`
- Expo Router screens: `source/app/`
- Page-level UI: `source/components/pages/`
- Shared UI: `source/components/ui/`
- App state provider: `source/hooks/use-app-data.tsx`
- Theme provider and tokens: `source/hooks/use-app-theme.tsx`, `source/constants/theme-tokens.ts`
- Services: `source/services/`
- Planner questionnaire storage keys: `source/constants/planner-storage.ts`
- Planner runtime barrel: `source/services/planning/transfer-planner.service.ts`
- Remaining planner orchestration runtime: `source/services/planning/transfer-planner/runtime.ts`
- Planner course parsing/catalog-year logic: `source/services/planning/transfer-planner/course-code.ts`
- Planner requirement status/option matching logic: `source/services/planning/transfer-planner/requirement-status.ts`
- Planner controller hook/UI components: `source/components/transfer-planner/`
- Planner controller sub-hooks: `source/components/transfer-planner/usePlannerSelectionState.ts`, `source/components/transfer-planner/useTranscriptPlannerState.ts`, `source/components/transfer-planner/usePlannerComputation.ts`, `source/components/transfer-planner/useCoursePlannerBugReport.ts`
- Planner display helpers: `source/components/transfer-planner/transfer-planner-transcript-debug.ts`, `source/components/transfer-planner/transfer-planner-bug-report.ts`, `source/components/transfer-planner/transfer-planner-copy.ts`, `source/components/transfer-planner/transfer-planner-suggested-schedule.ts`, `source/components/transfer-planner/transfer-planner-major-specifics-formatters.ts`
- Planner tooling: `source/scripts/planner/`
- Firebase Functions: `source/functions/`

Read `source/AGENTS.md` before app/planner changes.

## Command Cwd

Run from `source/`:

```powershell
npm install
npm run lint
npx tsc --noEmit
npm run start
npm run planner:verify
npm run planner:full:verify
```

From repo root, `cd source` first unless root launcher like `Start-to-run.bat` or `Course-Planner-Updater.bat` explicitly involved.

## Generated File Rule

Do not hand-edit generated planner artifacts unless user asks surgical emergency patch. Regenerate via planner scripts.

Common generated/generated-like planner files:

- `source/constants/transfer-planner-source/*.generated.ts`
- `source/constants/transfer-planner-source/course-metadata.generated.data.json`
- `source/constants/transfer-planner-source/student-runtime.generated/*.generated.json`
- `source/constants/transfer-planner-source/generated-major-plans.ts`
- `source/constants/transfer-planner-grc-availability.generated.ts`
- `source/constants/transfer-equivalency-catalog.generated.ts`
- `source/constants/green-river-major-options.generated.ts`
- `source/docs/planner/UWS_DEGREE_COURSES.md`
- `source/docs/planner/UWB_DEGREE_COURSES.md`
- `source/docs/planner/UWT_DEGREE_COURSES.md`

When planner output changes unexpectedly, inspect source scripts/reports in `source/.tmp/reports/`, not output files.

## Safe Editing Defaults

- Prefer small behavior-preserving edits.
- Use existing helpers/local patterns before new abstractions.
- Keep generated files, package lockfiles, planner refresh output out of unrelated changes.
- If worktree has user changes, work around them. Do not revert.
- Frontend: preserve current app shell/theme unless user asks redesign.

## High-Value Verification

- General app change: `npm run lint` and `npx tsc --noEmit` from `source/`.
- Planner logic/data change: `npm run planner:verify` from `source/`.
- Full planner confidence: `npm run planner:full:verify` from `source/`.
- Firebase rules change: `npm run test:firebase-rules` from `source/`.


## Code analysis — wont-fix

- **Admin MFA (static scan):** Opportunity-admin access is gated in Firebase; MFA enrollment is configured in Firebase Console / Identity Platform, not in app source.
- **Security-scan** react-native, babel-jest, @jest/transform, babel-plugin-istanbul, @istanbuljs/load-nyc-config, js-yaml; Expo SDK 54 currently pins React Native 0.81.x, and the remaining advisories live in React Native's published Jest/Istanbul toolchain rather than first-party app/runtime code. Gator Guide already applied the in-SDK patch updates plus transitive overrides that clear the Firebase/OpenTelemetry audit chain; removing these last findings requires a coordinated Expo/React Native major upgrade.
