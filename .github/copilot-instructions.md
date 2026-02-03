# GatorGuide AI coding guide

## Big picture
- React Native Expo app with file-based routing under [app/](../app/) and UI pages under [components/pages/](../components/pages/).
- Global providers live in [app/_layout.tsx](../app/_layout.tsx): `SafeAreaProvider`, `AppThemeProvider`, `AppDataProvider`.
- Services are stub-first in [services/](../services/), with real API toggles in [services/config.ts](../services/config.ts).

## Navigation + data flow
- Route files are thin wrappers that render page components (e.g., [app/profile-setup.tsx](../app/profile-setup.tsx) → `ProfileSetupPage`).
- Auth/hydration guards live in [app/index.tsx](../app/index.tsx) and [app/(tabs)/_layout.tsx](../app/(tabs)/_layout.tsx); always check `isHydrated` before using `state`.
- Use `router.replace()` for guard redirects and `router.push()` for user-driven navigation.

## State + storage conventions
- `AppDataProvider` persists to AsyncStorage key `gatorguide:appdata:v1`; `AppThemeProvider` uses `app-theme`.
- `signIn()` initializes optional user fields to empty strings to avoid controlled/uncontrolled inputs.
- Questionnaire answers are `Record<string, string>`; prefer `useMemo` for derived checks.

## Styling rules
- NativeWind/Tailwind only (no `StyleSheet.create()`); use `className` everywhere.
- Theme-aware classes read `isDark` from `useAppTheme()`; see [hooks/use-app-theme.tsx](../hooks/use-app-theme.tsx).
- Global Tailwind styles load from [global.css](../global.css) in [app/_layout.tsx](../app/_layout.tsx).

## Service layer (stub-first)
- Import via barrel: `import { authService, collegeService } from "@/services"`.
- Stub mode default; switch via `EXPO_PUBLIC_USE_STUB_DATA=false` and API keys (see [services/README.md](../services/README.md)).
- All services return Promises and simulate latency in stub mode.

## Workflow commands (Windows)
- Dev: `npm install` then `npx expo start` (or `npm run android|ios|web`).
- Lint: `npm run lint` (ESLint v9 flat config in [eslint.config.js](../eslint.config.js)).
- Reset project: `npm run reset-project` (destructive).

## Examples to follow
- Auth guard + loading: [app/index.tsx](../app/index.tsx).
- Multi-step form pattern: [components/pages/ProfileSetupPage.tsx](../components/pages/ProfileSetupPage.tsx).
- Theme-aware inputs: [components/ui/FormInput.tsx](../components/ui/FormInput.tsx).
