# GatorGuide AI Coding Guide

## Architecture Overview
- **React Native Expo app** using file-based routing under [app/](../app/), with page components in [components/pages/](../components/pages/).
- **Global providers** are composed in [app/_layout.tsx](../app/_layout.tsx): `SafeAreaProvider`, `AppThemeProvider`, `AppLanguageProvider`, `AppDataProvider` (in this order). These manage safe area, theming, language, and persistent app/user data.
- **Services** are stub-first: all API logic is in [services/](../services/), defaulting to local/mock data unless `EXPO_PUBLIC_USE_STUB_DATA=false` and API keys are set. See [services/README.md](../services/README.md) for switching to real APIs.

## Navigation & Auth
- **File-based routing:** Each file in [app/](../app/) maps to a route. Route files render page components (e.g., [app/profile-setup.tsx](../app/profile-setup.tsx) renders `ProfileSetupPage`).
- **Auth guards:**
  - [app/index.tsx](../app/index.tsx): global guard, redirects based on user state.
  - [app/(tabs)/_layout.tsx](../app/(tabs)/_layout.tsx): tab-level guard.
- **Always check `isHydrated`** from `useAppData()` before reading state (AsyncStorage may not be loaded yet).
- Use `router.replace()` for redirects, `router.push()` for user navigation.

## State & Persistence
- **AppDataProvider** ([hooks/use-app-data.tsx](../hooks/use-app-data.tsx)) manages user, questionnaire answers, and notification state, persisted in AsyncStorage under `gatorguide:appdata:v1`.
- **Theme and language** are persisted as `app-theme` and `app-language`.
- **User sign-in** always initializes optional fields to empty strings to avoid controlled/uncontrolled input warnings.
- **Questionnaire answers** are stored as `Record<string, string>`; use `useMemo` for derived state.

## Styling & UI
- **NativeWind/Tailwind only** for styles (no `StyleSheet.create()`).
- Use `useThemeStyles()` for theme classes: `textClass`, `secondaryTextClass`, `cardBgClass`, `inputBgClass`, `borderClass`, `progressBgClass`, `placeholderColor`.
- Use `isDark` from `useAppTheme()` for conditional logic.
- Global CSS reset in [global.css](../global.css) and [tailwind.config.js](../tailwind.config.js).

## Service Layer
- **Import services via barrel:** `import { authService, collegeService, aiService } from "@/services"`.
- **Stub-first:** All services are async, return Promises, and simulate latency in stub mode. Switch to real APIs by setting `EXPO_PUBLIC_USE_STUB_DATA=false` and providing API keys (see [services/README.md](../services/README.md)).
- **College service** returns `College[]` and tracks data source with `getLastSource()`.

## Internationalization
- Use `useAppLanguage()` and `t('translation.key')` for all user-facing strings.
- Translation keys are in [services/translations.ts](../services/translations.ts) (15+ languages).
- Language can be changed in the settings page and is persisted immediately.

## Common Patterns & Conventions
- **Multi-step forms:** Track `step` state, validate on next, save on final submit (see [ProfileSetupPage.tsx](../components/pages/ProfileSetupPage.tsx)).
- **Search with loading:** Use `isSearching` state, prevent submit while loading, handle empty results.
- **Haptic feedback:** Use `expo-haptics` and call `Haptics.impactAsync()` on user interactions.
- **Safe area:** Wrap pages with `ScreenBackground`, use `useSafeAreaInsets()` for padding.
- **Profile and questionnaire:** See [ProfilePage.tsx](../components/pages/ProfilePage.tsx) and [QuestionnairePage.tsx](../components/pages/QuestionnairePage.tsx) for dynamic Q&A and profile editing patterns.

## Developer Workflow
- **Install:** `npm install`
- **Start dev server:** `npx expo start` (or `npm run android|ios|web`)
- **Lint:** `npm run lint` (ESLint v9, flat config)
- **Reset local state:** `npm run reset-project` (clears all local state/cache)
- **Mobile testing:** `npx expo start --tunnel` and scan QR in Expo Go app

## Key Files & Examples
- **Auth flow:** [app/index.tsx](../app/index.tsx), [app/login.tsx](../app/login.tsx), [AuthPage.tsx](../components/pages/AuthPage.tsx)
- **Data persistence:** [hooks/use-app-data.tsx](../hooks/use-app-data.tsx)
- **UI components:** [FormInput.tsx](../components/ui/FormInput.tsx), [ScreenBackground.tsx](../components/layouts/ScreenBackground.tsx)
- **Profile & questionnaire:** [ProfilePage.tsx](../components/pages/ProfilePage.tsx), [QuestionnairePage.tsx](../components/pages/QuestionnairePage.tsx)

---
**If any section is unclear or missing details, please provide feedback so this guide can be improved for future AI agents.**
