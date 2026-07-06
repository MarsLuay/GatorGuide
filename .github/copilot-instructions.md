# GatorGuide - AI Coding Guide

Purpose: make AI coding agent productive fast in this React Native + Expo repo; avoid regressions during small product changes.

App in `source/`. Deeper agent rules: root `AGENTS.md`, `source/AGENTS.md`.

## Big Picture

- React Native Expo app. File routing under [source/app/](../source/app/).
- Page UI mostly in [source/components/pages/](../source/components/pages/).
- Global providers in [source/app/_layout.tsx](../source/app/_layout.tsx), order: `SafeAreaProvider`, `AppThemeProvider`, `AppLanguageProvider`, `AppDataProvider`.
- Services in [source/services/](../source/services/).
- Planner ingest/parse/generate/audit/verify in [source/scripts/planner/](../source/scripts/planner/).

## Command Cwd

Run app commands from `source/`; [source/package.json](../source/package.json) is package root:

```powershell
cd source
npm install
npm run lint
npx tsc --noEmit
npm run start
```

Planner verify also from `source/`:

```powershell
npm run planner:verify
npm run planner:full:verify
```

Repo-root launchers like `Start-to-run.bat` and `Course-Planner-Updater.bat` are exceptions.

## Core Conventions

- Routing: add route files under `source/app/`; navigate with `expo-router` (`router.push`, `router.replace`).
- App data: `useAppData()` in [source/hooks/use-app-data.tsx](../source/hooks/use-app-data.tsx) owns profile/questionnaire state.
- Hydration: guard persisted state use with `isHydrated`.
- Styling: prefer existing NativeWind classes and theme helpers (`useThemeStyles`, `useAppTheme`). Avoid new `StyleSheet.create` unless local pattern exists.
- Service imports: follow nearby style. Direct imports like `@/services/ai/ai.service` common.
- i18n: use `useAppLanguage()` and `t("key")`; app strings in [source/services/app/translations.ts](../source/services/app/translations.ts), locale refs in [source/constants/locales/](../source/constants/locales/).

## Generated Planner Guardrails

Do not hand-edit generated planner artifacts unless user asks emergency surgical patch. Regenerate via planner scripts.

Generated/generated-like outputs:

- `source/constants/transfer-planner-source/*.generated.ts`
- `source/constants/transfer-planner-source/generated-major-plans.ts`
- `source/constants/transfer-planner-grc-availability.generated.ts`
- `source/constants/transfer-equivalency-catalog.generated.ts`
- `source/constants/green-river-major-options.generated.ts`
- `source/docs/planner/UWS_DEGREE_COURSES.md`
- `source/docs/planner/UWB_DEGREE_COURSES.md`
- `source/docs/planner/UWT_DEGREE_COURSES.md`

For planner work, inspect `source/.tmp/reports/`; prefer:

```powershell
npm run planner:refresh
npm run planner:verify
npm run planner:full:verify
```

## Theme And Visual Guardrails

- Theme values: `light`, `dark`, `green`, `system` in [source/hooks/use-app-theme.tsx](../source/hooks/use-app-theme.tsx).
- Use `resolvedTheme` for UI styling branches.
- Shared surface classes/colors from [source/constants/theme-tokens.ts](../source/constants/theme-tokens.ts) via [source/hooks/use-theme-styles.ts](../source/hooks/use-theme-styles.ts).
- Keep visual edits minimal. No broad restyle for small theme/copy tweak.
- Preserve dark mode unless user explicitly asks change.

## Shared Constants And Sources Of Truth

- Support email: [source/constants/support.ts](../source/constants/support.ts). Use `SUPPORT_EMAIL` / `SUPPORT_MAILTO`.
- App version: [source/constants/app-version.ts](../source/constants/app-version.ts). Use `APP_VERSION`.
- Firestore/local storage schema keys: [source/constants/schema.ts](../source/constants/schema.ts).
- Planner questionnaire storage keys: [source/constants/planner-storage.ts](../source/constants/planner-storage.ts). Import constants; do not duplicate strings.
- Route constants: [source/constants/routes.ts](../source/constants/routes.ts).
- Theme persistence key: `app-theme`.
- Language persistence key: `app-language`.
- App data persistence key: `gatorguide:appdata:v1`.

## Resources Page Conventions

- Curated resources inline in [source/components/pages/ResourcesPage.tsx](../source/components/pages/ResourcesPage.tsx).
- Many sections use translations; some curated sections intentionally plain English.
- New resources: prefer official/primary links, concise descriptions, useful tags, existing `title` / `description` / `url` / `tags` shape.

## Service Refactor Guardrails

When refactoring service logic, especially [source/services/ai/ai.service.ts](../source/services/ai/ai.service.ts):

- Preserve external behavior unless changing product logic explicitly.
- Keep fallback chains.
- Preserve UI-expected metadata (`reason`, `score`, `breakdown`, `breakdownHuman`, `scoreText`).
- When consolidating duplicate code, extract helpers while preserving branch-specific nuance.
- Prefer small focused helpers over broad method rewrites.

## Verification Checklist

Run from `source/`:

1. `npm run lint`
2. `npx tsc --noEmit`
3. If touching recommendation/scoring flow, sanity-check `source/services/ai/ai.service.ts`: stub mode shape, live mode JSON parse fallback, in-state filtering.
4. If touching planner logic/data, run `npm run planner:verify`.

## High-Value Files To Inspect First

- Providers and layout: [source/app/_layout.tsx](../source/app/_layout.tsx)
- Tab shell and route guards: [source/app/(tabs)/_layout.tsx](<../source/app/(tabs)/_layout.tsx>)
- Persisted app data model: [source/hooks/use-app-data.tsx](../source/hooks/use-app-data.tsx)
- Theme helpers: [source/hooks/use-app-theme.tsx](../source/hooks/use-app-theme.tsx), [source/hooks/use-theme-styles.ts](../source/hooks/use-theme-styles.ts)
- Settings behavior: [source/components/pages/SettingsPage.tsx](../source/components/pages/SettingsPage.tsx)
- Resources data: [source/components/pages/ResourcesPage.tsx](../source/components/pages/ResourcesPage.tsx)
- Service entry points: [source/services/index.ts](../source/services/index.ts), [source/services/README.md](../source/services/README.md)
- AI and recommendations: [source/services/ai/ai.service.ts](../source/services/ai/ai.service.ts)
- Transfer planner runtime barrel: [source/services/planning/transfer-planner.service.ts](../source/services/planning/transfer-planner.service.ts)
- Transfer planner runtime implementation for remaining orchestration: [source/services/planning/transfer-planner/runtime.ts](../source/services/planning/transfer-planner/runtime.ts)
- Transfer planner course parsing/catalog-year logic: [source/services/planning/transfer-planner/course-code.ts](../source/services/planning/transfer-planner/course-code.ts)
- Transfer planner requirement status and option matching logic: [source/services/planning/transfer-planner/requirement-status.ts](../source/services/planning/transfer-planner/requirement-status.ts)
- Transfer planner controller composition hook: [source/components/transfer-planner/useTransferPlannerController.ts](../source/components/transfer-planner/useTransferPlannerController.ts)
- Transfer planner selection/persistence hook: [source/components/transfer-planner/usePlannerSelectionState.ts](../source/components/transfer-planner/usePlannerSelectionState.ts)
- Transfer planner transcript upload/parsing hook: [source/components/transfer-planner/useTranscriptPlannerState.ts](../source/components/transfer-planner/useTranscriptPlannerState.ts)
- Transfer planner computation hook: [source/components/transfer-planner/usePlannerComputation.ts](../source/components/transfer-planner/usePlannerComputation.ts)
- Transfer planner bug-report hook: [source/components/transfer-planner/useCoursePlannerBugReport.ts](../source/components/transfer-planner/useCoursePlannerBugReport.ts)
- Transfer planner helper barrel: [source/components/transfer-planner/transfer-planner-formatters.ts](../source/components/transfer-planner/transfer-planner-formatters.ts)
- Transfer planner transcript debug helpers: [source/components/transfer-planner/transfer-planner-transcript-debug.ts](../source/components/transfer-planner/transfer-planner-transcript-debug.ts)
- Transfer planner bug-report formatting: [source/components/transfer-planner/transfer-planner-bug-report.ts](../source/components/transfer-planner/transfer-planner-bug-report.ts)
- Transfer planner copy/link helpers: [source/components/transfer-planner/transfer-planner-copy.ts](../source/components/transfer-planner/transfer-planner-copy.ts), [source/components/transfer-planner/transfer-planner-linking.ts](../source/components/transfer-planner/transfer-planner-linking.ts)
- Transfer planner schedule display helpers: [source/components/transfer-planner/transfer-planner-suggested-schedule.ts](../source/components/transfer-planner/transfer-planner-suggested-schedule.ts)
- Transfer planner major-specific display helpers: [source/components/transfer-planner/transfer-planner-major-specifics-formatters.ts](../source/components/transfer-planner/transfer-planner-major-specifics-formatters.ts)
- Transfer planner UI components: [source/components/transfer-planner/](../source/components/transfer-planner/)
- Transfer planner route shell: [source/components/pages/TransferPlannerPage.tsx](../source/components/pages/TransferPlannerPage.tsx)