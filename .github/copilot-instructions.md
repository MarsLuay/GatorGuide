# GatorGuide - AI Coding Guide

Purpose: help an AI coding agent become productive quickly in this React Native + Expo repo and avoid behavior regressions while making small product changes.

## Big picture
- React Native Expo app using file-based routing under [app/](../app/).
- Page-level UI lives mostly in [components/pages/](../components/pages/).
- Global providers are composed in [app/_layout.tsx](../app/_layout.tsx) in this order: `SafeAreaProvider`, `AppThemeProvider`, `AppLanguageProvider`, `AppDataProvider`.
- Services live in [services/](../services/) and follow a stub-first design: local/mock behavior by default, switched to live APIs via env flags.

## Core conventions
- Routing: add routes under `app/` and navigate with `expo-router` (`router.push`, `router.replace`).
- App data: `useAppData()` in [hooks/use-app-data.tsx](../hooks/use-app-data.tsx) is the source of truth for profile and questionnaire state.
- Hydration: guard persisted state usage with `isHydrated`.
- Styling: prefer NativeWind classes and shared theme helpers (`useThemeStyles`, `useAppTheme`). Avoid introducing `StyleSheet.create` unless there is already a local pattern that uses it.
- Services imports: prefer the barrel import `@/services` unless there is a strong local reason to import a file directly.
- i18n: use `useAppLanguage()` and `t("key")`; translation strings live in [services/translations.ts](../services/translations.ts) and locale JSON files under [constants/locales/](../constants/locales/).

## Theme and visual guardrails
- Theme values are `light`, `dark`, `green`, and `system` in [hooks/use-app-theme.tsx](../hooks/use-app-theme.tsx).
- `resolvedTheme` is the correct branch point for UI styling. Use `isDark`, `isGreen`, and `isLight` from `useAppTheme()` where available.
- Shared surface classes come from [hooks/use-theme-styles.ts](../hooks/use-theme-styles.ts):
  - dark mode uses neutral gray surfaces (`bg-gray-900/80`, `bg-gray-800`, `border-gray-*`)
  - green theme uses emerald-dark surfaces
  - light mode uses white cards and inputs with emerald borders
- Keep visual edits minimal. Do not broadly restyle the app when the request is only about green/black colors or a small theme tweak.
- Preserve the existing dark-mode look unless the user explicitly asks to change it. Recent user preference is to keep dark mode very close to the old neutral/slate appearance.

## Shared constants and single sources of truth
- Support email lives in [constants/support.ts](../constants/support.ts). Use `SUPPORT_EMAIL` / `SUPPORT_MAILTO` instead of hardcoding addresses.
- App version lives in [constants/app-version.ts](../constants/app-version.ts). Use `APP_VERSION` instead of duplicating version strings.
- Theme persistence key: `app-theme`
- Language persistence key: `app-language`
- App data persistence key: `gatorguide:appdata:v1`

## Resources page conventions
- Curated resources are defined inline in [components/pages/ResourcesPage.tsx](../components/pages/ResourcesPage.tsx).
- Many sections use translations, but some curated sections intentionally use plain English titles and descriptions, such as `Career Fair Prep` and `Engineering Career Prep`.
- For new resource entries:
  - prefer official or primary-source links
  - keep descriptions concise and practical
  - add useful search tags
  - follow the existing `title` / `description` / `url` / `tags` shape

## Service refactor guardrails
When refactoring service logic, especially [services/ai.service.ts](../services/ai.service.ts):
- Preserve existing external behavior unless explicitly changing product logic.
- Keep fallback chains intact.
- Preserve user-visible metadata fields (`reason`, `score`, `breakdown`, `breakdownHuman`, `scoreText`) where currently expected by UI.
- If consolidating duplicate code, extract helpers, but verify branch-specific nuances are retained.
- Prefer small focused helpers over broad rewrites of large methods.

## Verification checklist before commit
Run these from repo root:
1. `npm run lint`
2. `npx tsc --noEmit`
3. If touching recommendation or scoring flow, sanity-check key codepaths in `services/ai.service.ts` for:
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
- Providers and layout: [app/_layout.tsx](../app/_layout.tsx)
- Tab shell and route guards: [app/(tabs)/_layout.tsx](../app/(tabs)/_layout.tsx)
- Persisted app data model: [hooks/use-app-data.tsx](../hooks/use-app-data.tsx)
- Theme helpers: [hooks/use-app-theme.tsx](../hooks/use-app-theme.tsx), [hooks/use-theme-styles.ts](../hooks/use-theme-styles.ts)
- Settings behavior: [components/pages/SettingsPage.tsx](../components/pages/SettingsPage.tsx)
- Resources data: [components/pages/ResourcesPage.tsx](../components/pages/ResourcesPage.tsx)
- Service entry points: [services/index.ts](../services/index.ts), [services/README.md](../services/README.md)
- AI and recommendations: [services/ai.service.ts](../services/ai.service.ts)
