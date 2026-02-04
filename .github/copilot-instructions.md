# GatorGuide AI Coding Guide

## Big Picture
React Native Expo app: file-based routing under [app/](../app/), page components under [components/pages/](../components/pages/). Global providers in [app/_layout.tsx](../app/_layout.tsx): `SafeAreaProvider`, `AppThemeProvider`, `AppLanguageProvider`, `AppDataProvider` (in that order). Services are stub-first; toggle real APIs via `EXPO_PUBLIC_USE_STUB_DATA=false` + env keys.

## Navigation & Auth Guards
- Route files → page components (e.g., [app/profile-setup.tsx](../app/profile-setup.tsx) renders `ProfileSetupPage`).
- **Always check `isHydrated`** before accessing `state` (AsyncStorage load timing).
- Auth guards: [app/index.tsx](../app/index.tsx) (global), [app/(tabs)/_layout.tsx](../app/(tabs)/_layout.tsx) (tabs).
- Use `router.replace()` for redirects, `router.push()` for user navigation.

## State & Storage
- `AppDataProvider` → AsyncStorage `gatorguide:appdata:v1`: user, questionnaireAnswers, notificationsEnabled.
- `AppThemeProvider` → `app-theme`: "light" | "dark" | "system".
- `AppLanguageProvider` → `app-language`: persisted Language enum (15 supported languages).
- `signIn()` initializes optional fields to "" (prevents controlled/uncontrolled input warnings).
- Questionnaire: `Record<string, string>` (id → answer); use `useMemo` for derived state.

## Styling
- **NativeWind/Tailwind only** (no `StyleSheet.create()`). Theme colors via `useThemeStyles()`:
  - `textClass`, `secondaryTextClass`, `cardBgClass`, `inputBgClass`, `borderClass`, `progressBgClass`, `placeholderColor`.
- Read `isDark` from `useAppTheme()` for conditional logic (e.g., tab bar color).
- Global reset in [global.css](../global.css) + [tailwind.config.js](../tailwind.config.js).

## Services (Stub-First)
- Import via barrel: `import { authService, collegeService, aiService } from "@/services"`.
- Default stub mode; switch via `EXPO_PUBLIC_USE_STUB_DATA=false` + API keys (see [services/README.md](../services/README.md)).
- All services: async, return Promises, simulate latency in stub mode.
- College service returns `College[]` with fallback source tracking (`getLastSource()`).

## Internationalization
- Use `useAppLanguage()` → `t('translation.key')` for all user-facing strings.
- Keys defined in [services/translations.ts](../services/translations.ts); 15 language support (English, Spanish, Chinese, French, etc.).
- Settings page lets users switch language; persists immediately.

## Common Patterns
- **Multi-step forms:** Track `step` state, validate on next, save on final submit (see [ProfileSetupPage](../components/pages/ProfileSetupPage.tsx)).
- **Search with loading:** Track `isSearching`, prevent submit while loading, handle empty results.
- **Haptic feedback:** Import `expo-haptics`, call `Haptics.impactAsync()` on interactions.
- **SafeAreaInsets:** Wrap pages with `ScreenBackground`, use `useSafeAreaInsets()` for padding.

## Workflow (Windows)
- Dev: `npm install` → `npx expo start` (or `npm run android|ios|web`).
- Lint: `npm run lint` (ESLint v9 flat config).
- Reset: `npm run reset-project` (clears all local state/cache).
- Phone: `npx expo start --tunnel` + scan QR in Expo Go app.

## Key Files
- Auth flow: [app/index.tsx](../app/index.tsx), [app/login.tsx](../app/login.tsx), [AuthPage](../components/pages/AuthPage.tsx).
- Data persistence: [hooks/use-app-data.tsx](../hooks/use-app-data.tsx).
- UI components: [components/ui/FormInput.tsx](../components/ui/FormInput.tsx), [ScreenBackground](../components/layouts/ScreenBackground.tsx).
- Questionnaire: [QuestionnairePage](../components/pages/QuestionnairePage.tsx) (dynamic Q&A with radio/textarea types).
