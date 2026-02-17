# GatorGuide — AI Coding Guide (concise)

Purpose: help an AI coding agent be productive quickly in this React Native + Expo repo.

## Big picture
- React Native Expo app using file-based routing under [app/](../app/). Pages live in [components/pages/](../components/pages/).
- Global providers are composed in [app/_layout.tsx](../app/_layout.tsx) in this order: `SafeAreaProvider`, `AppThemeProvider`, `AppLanguageProvider`, `AppDataProvider`. These manage safe area, theming, i18n, and persisted app state.
- Services live in [services/](../services/). The project uses a "stub-first" design: local/mock implementations are default and switched to real APIs via env (see below).

## Key patterns & conventions
- File-based routing: add pages under `app/` — route = file path. Use `router.push()` / `router.replace()` from `expo-router` for navigation.
- State: `useAppData()` (hooks/use-app-data.tsx) is the single source for user and questionnaire state. Always guard with `isHydrated` before accessing persisted data.
- Styling: NativeWind/Tailwind is used everywhere — avoid `StyleSheet.create()`. Use `useThemeStyles()` or `useAppTheme()` helpers for class names.
- Services: import via barrel `import { authService, collegeService, aiService } from "@/services"`. Services return Promises and simulate latency in stub mode.
- i18n: use `useAppLanguage()` + `t('key')`. Translations are in [services/translations.ts](../services/translations.ts).

## Integration points & env
- Toggle stub vs real APIs with `EXPO_PUBLIC_USE_STUB_DATA` (see [services/README.md](../services/README.md)).
- Firebase helpers: [services/firebase.ts](../services/firebase.ts) and [services/firebase.client.ts](../services/firebase.client.ts) — check these when debugging auth/storage.
- Persistent keys: `gatorguide:appdata:v1` (AsyncStorage). Theme/language keys: `app-theme`, `app-language`.
- Local env template: see `env.example` and `process.env` usage in code.

## Developer workflows (commands)
- Install deps: `npm install`
- Type-check: `npx tsc --noEmit`
- Start dev: `npx expo start -c` (clear cache when needed). For device testing: `npx expo start --tunnel`.
- Lint: `npm run lint`
- Reset local app state: `npm run reset-project` (clears AsyncStorage and local caches).

## Files to inspect for common tasks (quick links)
- Routing & guards: [app/index.tsx](../app/index.tsx), [app/(tabs)/_layout.tsx](../app/(tabs)/_layout.tsx)
- App state & persistence: [hooks/use-app-data.tsx](../hooks/use-app-data.tsx)
- Services and integrations: [services/index.ts](../services/index.ts), [services/README.md](../services/README.md), [services/firebase.ts](../services/firebase.ts)
- UI patterns: [components/layouts/ScreenBackground.tsx](../components/layouts/ScreenBackground.tsx), [components/ui/ProfileField.tsx](../components/ui/ProfileField.tsx)

## Agent-specific guidance (do this first)
1. Read `app/_layout.tsx` to understand provider order and hydration.
2. Read `hooks/use-app-data.tsx` to learn `isHydrated`, AsyncStorage keys, and update helpers (`updateUser`, `setQuestionnaireAnswers`).
3. Check `services/` to understand which APIs are stubs and which rely on external keys (AI, Firebase, third-party APIs).
4. When changing UI, follow Tailwind classes and prefer `useThemeStyles()` helpers; test in Expo (simulator or device).

If anything here is unclear or you want more examples (tests, CI, or deeper integration notes), tell me which area to expand.
