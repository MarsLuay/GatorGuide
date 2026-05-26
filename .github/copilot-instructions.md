# GatorGuide - AI Coding Guide

Purpose: help an AI coding agent become productive quickly in this React Native + Expo repo and avoid behavior regressions while making small product changes.

The app lives in `source/`. For deeper agent instructions, read `AGENTS.md` at the repository root and `source/AGENTS.md`.

## Big Picture

- React Native Expo app using file-based routing under [source/app/](../source/app/).
- Page-level UI lives mostly in [source/components/pages/](../source/components/pages/).
- Global providers are composed in [source/app/_layout.tsx](../source/app/_layout.tsx) in this order: `SafeAreaProvider`, `AppThemeProvider`, `AppLanguageProvider`, `AppDataProvider`.
- Services live in [source/services/](../source/services/).
- Planner ingestion, parsing, generation, audits, and verification live in [source/scripts/planner/](../source/scripts/planner/).

## Command Cwd

Run normal app commands from `source/`, because [source/package.json](../source/package.json) is the package root:

```powershell
cd source
npm install
npm run lint
npx tsc --noEmit
npm run start
```

Planner verification also runs from `source/`:

```powershell
npm run planner:verify
npm run planner:full:verify
```

Repository-root launchers such as `Start-to-run.bat` and `Course-Planner-Updater.bat` are exceptions.

## Core Conventions

- Routing: add route files under `source/app/` and navigate with `expo-router` (`router.push`, `router.replace`).
- App data: `useAppData()` in [source/hooks/use-app-data.tsx](../source/hooks/use-app-data.tsx) is the source of truth for profile and questionnaire state.
- Hydration: guard persisted state usage with `isHydrated`.
- Styling: prefer existing NativeWind classes and shared theme helpers (`useThemeStyles`, `useAppTheme`). Avoid introducing `StyleSheet.create` unless there is already a local pattern that uses it.
- Services imports: follow nearby file style. Direct service imports such as `@/services/ai/ai.service` are common in this repo.
- i18n: use `useAppLanguage()` and `t("key")`; translation strings used by the app live in [source/services/app/translations.ts](../source/services/app/translations.ts), with locale references under [source/constants/locales/](../source/constants/locales/).

## Generated Planner Guardrails

Do not hand-edit generated planner artifacts unless the user explicitly asks for an emergency surgical patch. Regenerate them through planner scripts.

Generated or generated-like outputs include:

- `source/constants/transfer-planner-source/*.generated.ts`
- `source/constants/transfer-planner-source/generated-major-plans.ts`
- `source/constants/transfer-planner-grc-availability.generated.ts`
- `source/constants/transfer-equivalency-catalog.generated.ts`
- `source/constants/green-river-major-options.generated.ts`
- `source/docs/planner/UWS_DEGREE_COURSES.md`
- `source/docs/planner/UWB_DEGREE_COURSES.md`
- `source/docs/planner/UWT_DEGREE_COURSES.md`

For planner work, inspect reports under `source/.tmp/reports/` and prefer these commands:

```powershell
npm run planner:refresh
npm run planner:verify
npm run planner:full:verify
```

## Theme And Visual Guardrails

- Theme values are `light`, `dark`, `green`, and `system` in [source/hooks/use-app-theme.tsx](../source/hooks/use-app-theme.tsx).
- `resolvedTheme` is the correct branch point for UI styling.
- Shared surface classes and colors come from [source/constants/theme-tokens.ts](../source/constants/theme-tokens.ts) through [source/hooks/use-theme-styles.ts](../source/hooks/use-theme-styles.ts).
- Keep visual edits minimal. Do not broadly restyle the app when the request is a small theme or copy tweak.
- Preserve the existing dark-mode look unless the user explicitly asks to change it.

## Shared Constants And Sources Of Truth

- Support email: [source/constants/support.ts](../source/constants/support.ts). Use `SUPPORT_EMAIL` / `SUPPORT_MAILTO`.
- App version: [source/constants/app-version.ts](../source/constants/app-version.ts). Use `APP_VERSION`.
- Firestore and local storage schema keys: [source/constants/schema.ts](../source/constants/schema.ts).
- Planner questionnaire storage keys: [source/constants/planner-storage.ts](../source/constants/planner-storage.ts). Import these constants instead of duplicating planner key strings.
- Route constants: [source/constants/routes.ts](../source/constants/routes.ts).
- Theme persistence key: `app-theme`.
- Language persistence key: `app-language`.
- App data persistence key: `gatorguide:appdata:v1`.

## Resources Page Conventions

- Curated resources are defined inline in [source/components/pages/ResourcesPage.tsx](../source/components/pages/ResourcesPage.tsx).
- Many sections use translations, but some curated sections intentionally use plain English titles and descriptions.
- For new resource entries, prefer official or primary-source links, concise descriptions, useful search tags, and the existing `title` / `description` / `url` / `tags` shape.

## Service Refactor Guardrails

When refactoring service logic, especially [source/services/ai/ai.service.ts](../source/services/ai/ai.service.ts):

- Preserve existing external behavior unless explicitly changing product logic.
- Keep fallback chains intact.
- Preserve user-visible metadata fields (`reason`, `score`, `breakdown`, `breakdownHuman`, `scoreText`) where currently expected by UI.
- If consolidating duplicate code, extract helpers while preserving branch-specific nuances.
- Prefer small focused helpers over broad rewrites of large methods.

## Verification Checklist

Run from `source/`:

1. `npm run lint`
2. `npx tsc --noEmit`
3. If touching recommendation or scoring flow, sanity-check key codepaths in `source/services/ai/ai.service.ts` for stub mode response shape, live mode JSON parsing fallback, and in-state filtering behavior.
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
