# GatorGuide AI Maintainer Guide

This repository is source-available and the working app lives in `source/`. Most commands must be run from `source`, not from the repository root.

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
- Planner runtime implementation for remaining planner orchestration: `source/services/planning/transfer-planner/runtime.ts`
- Planner course parsing/catalog-year logic: `source/services/planning/transfer-planner/course-code.ts`
- Planner requirement status and option matching logic: `source/services/planning/transfer-planner/requirement-status.ts`
- Planner controller composition hook and UI components: `source/components/transfer-planner/`
- Planner controller sub-hooks: `source/components/transfer-planner/usePlannerSelectionState.ts`, `source/components/transfer-planner/useTranscriptPlannerState.ts`, `source/components/transfer-planner/usePlannerComputation.ts`, `source/components/transfer-planner/useCoursePlannerBugReport.ts`
- Planner display helper modules: `source/components/transfer-planner/transfer-planner-transcript-debug.ts`, `source/components/transfer-planner/transfer-planner-bug-report.ts`, `source/components/transfer-planner/transfer-planner-copy.ts`, `source/components/transfer-planner/transfer-planner-suggested-schedule.ts`, `source/components/transfer-planner/transfer-planner-major-specifics-formatters.ts`
- Planner tooling: `source/scripts/planner/`
- Firebase Functions: `source/functions/`

Read `source/AGENTS.md` before making app or planner changes.

## Command Cwd

Run these from `source/`:

```powershell
npm install
npm run lint
npx tsc --noEmit
npm run start
npm run planner:verify
npm run planner:full:verify
```

From the repository root, use `cd source` first unless a root launcher such as `Start-to-run.bat` or `Course-Planner-Updater.bat` is explicitly involved.

## Generated File Rule

Do not hand-edit generated planner artifacts unless the user explicitly asks for a surgical emergency patch. Regenerate them through the planner scripts instead.

Common generated or generated-like planner files include:

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

When planner output changes unexpectedly, inspect the source scripts and reports in `source/.tmp/reports/` rather than editing output files directly.

## Safe Editing Defaults

- Prefer small, behavior-preserving edits.
- Use existing helpers and local patterns before adding new abstractions.
- Keep generated files, package lockfiles, and planner refresh output out of unrelated changes.
- If the worktree already has user changes, work around them and do not revert them.
- For frontend work, preserve the current app shell and theme style unless the user asks for a redesign.

## High-Value Verification

- General app change: `npm run lint` and `npx tsc --noEmit` from `source/`.
- Planner logic or data change: `npm run planner:verify` from `source/`.
- Full planner maintenance confidence: `npm run planner:full:verify` from `source/`.
- Firebase rules change: `npm run test:firebase-rules` from `source/`.
