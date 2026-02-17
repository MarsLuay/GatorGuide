# GatorGuide — AI Coding Guide

Purpose: help an AI coding agent become productive quickly in this React Native + Expo repo and avoid behavior regressions while refactoring.

## Big picture
- React Native Expo app using file-based routing under [app/](../app/).
- Page-level UI lives mostly in [components/pages/](../components/pages/).
- Global providers are composed in [app/_layout.tsx](../app/_layout.tsx) in this order: `SafeAreaProvider`, `AppThemeProvider`, `AppLanguageProvider`, `AppDataProvider`.
- Services live in [services/](../services/) and follow a **stub-first** design: local/mock behavior by default, switched to live APIs via env flags.

## Core conventions
- **Routing:** add routes under `app/` and navigate with `expo-router` (`router.push`, `router.replace`).
- **App data:** `useAppData()` in [hooks/use-app-data.tsx](../hooks/use-app-data.tsx) is the source of truth for profile + questionnaire state.
- **Hydration:** guard persisted state usage with `isHydrated`.
- **Styling:** prefer NativeWind classes and theme helpers (`useThemeStyles`, `useAppTheme`); avoid introducing `StyleSheet.create` unless there is an established exception.
- **Services imports:** prefer the barrel import `@/services` unless there is a strong local reason to import a file directly.
- **i18n:** use `useAppLanguage()` and `t('key')`; translation strings are in [services/translations.ts](../services/translations.ts).

## Environment + integrations
- Stub mode toggle: `EXPO_PUBLIC_USE_STUB_DATA` (see [services/README.md](../services/README.md)).
- Firebase helpers: [services/firebase.ts](../services/firebase.ts) and [services/firebase.client.ts](../services/firebase.client.ts).
- Persistence keys:
  - app data: `gatorguide:appdata:v1`
  - theme: `app-theme`
  - language: `app-language`

## Service refactor guardrails (important)
When refactoring service logic (especially [services/ai.service.ts](../services/ai.service.ts)):
- Preserve existing external behavior unless explicitly changing product logic.
- Keep fallback chains intact (live -> cache/search/matches as applicable).
- Preserve user-visible metadata fields (`reason`, `score`, `breakdown`, `breakdownHuman`, `scoreText`) where currently expected by UI.
- If consolidating duplicate code, extract helpers, but verify branch-specific nuances are retained (e.g., guest-mode in-state behavior, strict in-state empty states, AI fallback reason text).
- Prefer small focused helpers over broad rewrites of large methods.

## Verification checklist before commit
Run these from repo root:
1. `npm run lint`
2. `npx tsc --noEmit`
3. If touching recommendation/scoring flow, sanity-check key codepaths in `services/ai.service.ts` for:
   - stub mode response shape
   - live mode JSON parsing fallback
   - in-state filtering behavior for guest and non-guest users

## Developer commands
- Install deps: `npm install`
- Type-check: `npx tsc --noEmit`
- Start dev: `npx expo start -c`
- Tunnel dev: `npx expo start --tunnel`
- Lint: `npm run lint`
- Reset local app state: `npm run reset-project`

## High-value files to inspect first
- Providers/layout: [app/_layout.tsx](../app/_layout.tsx)
- Routing guards/tabs: [app/index.tsx](../app/index.tsx), [app/(tabs)/_layout.tsx](../app/(tabs)/_layout.tsx)
- Persisted app data model: [hooks/use-app-data.tsx](../hooks/use-app-data.tsx)
- Service entry points: [services/index.ts](../services/index.ts), [services/README.md](../services/README.md)
- AI + recommendations: [services/ai.service.ts](../services/ai.service.ts)
