# GatorGuide AI coding guide

## Big picture
- React Native Expo app with file-based routing under [app/](../app/) and UI pages under [components/pages/](../components/pages/).
- Providers live at root [app/_layout.tsx](../app/_layout.tsx): `SafeAreaProvider`, `AppThemeProvider`, `AppDataProvider`.
- Stub-first services in [services/](../services/) keep UI unblocked; real APIs are toggled by env vars in [services/config.ts](../services/config.ts).

## Navigation + data flow
- Routes are thin wrappers that render page components (e.g., [app/profile-setup.tsx](../app/profile-setup.tsx) -> `ProfileSetupPage`).
- Auth/hydration guards live in [app/index.tsx](../app/index.tsx) and app/(tabs)/_layout.tsx. Always check `isHydrated` before using `state`.
- Use `router.replace()` for guard redirects; `router.push()` for user-driven navigation.

## State + storage conventions
- `AppDataProvider` persists to AsyncStorage key `gatorguide:appdata:v1`; `AppThemeProvider` uses `app-theme`.
- `signIn()` must initialize optional user fields to empty strings to avoid controlled/uncontrolled inputs.
- Questionnaire answers are `Record<string, string>`; prefer `useMemo` for derived checks.

## Styling rules
- NativeWind/Tailwind only (no `StyleSheet.create()`); class names via `className`.
- Theme-aware classes read `isDark` from `useAppTheme()`.
- Global Tailwind styles load from [global.css](../global.css) in [app/_layout.tsx](../app/_layout.tsx).

## Service layer (stub-first)
- Import via barrel: `import { authService, collegeService } from "@/services"`.
- Stub mode default; switch by setting `EXPO_PUBLIC_USE_STUB_DATA=false` and adding API keys (see [services/README.md](../services/README.md)).
- All services return Promises; stub implementations simulate latency.

## Workflow commands (Windows)
- Dev: `npm install` then `npx expo start` (use `npm run android|ios|web` for targets).
- Lint: `npm run lint` (ESLint v9 flat config in [eslint.config.js](../eslint.config.js)).
- Reset project: `npm run reset-project` (destructive).

## Examples to follow
- Auth guard + loading: [app/index.tsx](../app/index.tsx).
- Multi-step form pattern: [components/pages/ProfileSetupPage.tsx](../components/pages/ProfileSetupPage.tsx).
- Theme-aware inputs: [components/ui/FormInput.tsx](../components/ui/FormInput.tsx).
