# GatorGuide AI Assistant Instructions

## Project Overview

GatorGuide is a React Native/Expo mobile app built with TypeScript, NativeWind (Tailwind for React Native), and Expo Router. The app helps students find college matches and manage their academic profile. It uses file-based routing and context-based state management for user data and theme persistence.

**Tech Stack:** Expo 54, React 19, React Native 0.81, TypeScript 5.9, NativeWind 4.2, Expo Router 6, AsyncStorage

**Key Decision:** This project uses a **stub-first architecture** for all external APIs, allowing full UI development without API keys or internet connection. Switch to real APIs by setting environment variables (see Services Layer section).

## Architecture

### Core Providers (Root Level: `app/_layout.tsx`)
Three context providers wrap the entire app:
1. **SafeAreaProvider** - Handles safe area insets for notches/home indicators
2. **AppThemeProvider** (`hooks/use-app-theme.tsx`) - Manages theme state (light/dark/system) with AsyncStorage persistence; exposes `theme`, `isDark`, `setTheme`
3. **AppDataProvider** (`hooks/use-app-data.tsx`) - Manages user profile and questionnaire answers with AsyncStorage persistence; exposes `state`, `signIn`, `updateUser`, `setQuestionnaireAnswers`

Both custom providers handle hydration (`isHydrated`/`hydrated` states) to prevent rendering before local data loads. Components must check these flags before rendering dependent content.

### Navigation Structure
- **Expo Router** (`expo-router` v6) with file-based routing in `app/` directory
- Entry point: `app/index.tsx` (hydration/auth guard that routes to login or main tabs)
- Main flow after auth: `app/(tabs)/_layout.tsx` with bottom tab navigation (Home, Resources, Profile, Settings)
- Auth flow: `login.tsx`, `forgot-password.tsx`, `profile-setup.tsx`, `questionnaire.tsx`

### State Management
- **AppDataProvider** stores user and questionnaire state in AsyncStorage with key `gatorguide:appdata:v1` (exact JSON structure of AppDataState)
- **AppThemeProvider** stores theme preference in AsyncStorage with key `app-theme` with values `"light" | "dark" | "system"`
- **Color scheme** (`hooks/use-color-scheme.ts`): Platform-native hook that detects system dark/light mode preference
- **Hydration timing:** AppDataProvider resolves in ~5-50ms; always check `isHydrated` before accessing `state` in routes
- **State persistence:** Both providers auto-save to AsyncStorage on state change (after initial hydration). Updates are async but non-blocking.
- **Notifications state:** `notificationsEnabled` boolean stored in AppDataState, toggled via `setNotificationsEnabled()`

### Styling Approach
- **NativeWind + Tailwind**: All styling uses Tailwind utility classes (`className` prop) - NO StyleSheet.create()
- **Theme colors defined in** `constants/theme.ts`: Colors export with light/dark variants
- **Theme-aware components**: Components read `isDark` from `useAppTheme()` hook and apply conditional classes like `isDark ? "text-white" : "text-gray-900"`
- **ScreenBackground**: Reusable gradient wrapper (`components/layouts/ScreenBackground.tsx`) with LinearGradient effect based on theme
- **Global CSS** (`global.css`): Imports Tailwind directives only - imported once in `app/_layout.tsx`
- **No inline styles**: Prefer Tailwind classes over `style` prop; if dynamic styling needed, compute className strings

## Key Conventions

### Component Pages vs Routes
- **Page components** in `components/pages/` are presentational, take no props (access context directly), and encapsulate full screen UI
- **Route components** in `app/` are thin wrappers that call page components; routes handle navigation guards and redirects
- **Pattern**: `app/profile.tsx` imports and renders `ProfilePage.tsx` directly
- **Naming:** Routes use kebab-case (`profile-setup.tsx`); pages use PascalCase (`ProfileSetupPage.tsx`)

### Hydration Pattern
Routes that depend on context data must:
1. Check `isHydrated` from the relevant provider hook
2. Show a loading state until hydrated (typically in `app/index.tsx`)
3. Redirect based on auth state once hydrated

Example in `app/index.tsx`:
```tsx
const { isHydrated, state } = useAppData();
if (!isHydrated) return <LoadingScreen />;
if (state.user) router.replace("/(tabs)");
else router.replace("/login");
```

### User Data Structure
```tsx
type User = {
  name: string;
  email: string;
  major?: string;
  gpa?: string;
  sat?: string;
  act?: string;
  resume?: string;  // filename or local URI
  transcript?: string;  // filename or local URI
};
```

Update user fields via `updateUser(patch)` from `useAppData()` hook. Test scores stored as separate `sat` and `act` string fields (not combined).

**Critical:** When creating new users in `signIn()`, initialize ALL optional fields to empty strings (`""`) to prevent controlled/uncontrolled component warnings in forms.

### Theme Integration
Always use theme context when applying colors/styles:
```tsx
const { isDark } = useAppTheme();
const textColor = isDark ? "text-white" : "text-gray-900";
<Text className={textColor}>Content</Text>
```

## Development Workflows

### Start Development
```bash
npm install
npx expo start
```
Then choose: `a` (Android), `i` (iOS), `w` (Web), or scan QR for Expo Go.

**Platform-specific commands:**
```bash
npm run android  # Launch Android emulator
npm run ios      # Launch iOS simulator
npm run web      # Start web dev server
```

### Lint Code
```bash
npm run lint
```
Uses expo-lint config based on ESLint v9 flat config (`eslint.config.js`).

### Reset Project
```bash
npm run reset-project
```
Moves starter code to `app-example/` and creates fresh `app/` directory. **Warning:** This is destructive!

### Build Configuration
- **Metro bundler:** Configured in `metro.config.js` with NativeWind integration via `withNativeWind(config, { input: "./global.css" })`
- **Babel:** Uses `babel-preset-expo` with `jsxImportSource: "nativewind"` and `nativewind/babel` preset (see `babel.config.js`)
- **Global CSS:** All Tailwind styles loaded through `global.css` (imported once in `app/_layout.tsx`); uses NativeWind preset from `tailwind.config.js`
- **Tailwind content paths:** Configured in `tailwind.config.js` to scan `app/`, `components/`, and `src/` directories
- **Expo config:** `app.json` enables new architecture (`newArchEnabled: true`), React Compiler (`reactCompiler: true`), and typed routes (`typedRoutes: true`)

## Critical Integration Points

### AsyncStorage Persistence
- Theme: `app-theme` key with values `"light" | "dark" | "system"`
- App data: `gatorguide:appdata:v1` key with JSON-stringified `AppDataState`
- Always await storage operations; handle errors gracefully (don't crash on corrupt data)

### Router Navigation
- Use `router.push()` for stack navigation, `router.replace()` for replacing current screen, `router.back()` to go back
- Import from `expo-router`: `import { router } from "expo-router"`
- Guards: Auth check happens in `app/index.tsx` before tabs are accessible
- Navigation pattern: Routes redirect based on auth state after hydration (see `app/index.tsx` and `app/(tabs)/_layout.tsx`)
- **Double navigation prevention:** Use `useRef` flag (`hasNavigated`) in `app/index.tsx` to prevent navigation loops in StrictMode/Fast Refresh

### Icons
- Primary: `@expo/vector-icons` (Ionicons, MaterialIcons): `import { Ionicons, MaterialIcons } from "@expo/vector-icons"`
- Alternative: `lucide-react-native` for additional icon options
- Tab icons defined in `app/(tabs)/_layout.tsx`

### Haptic Feedback
- Configured via `components/haptic-tab.tsx` for tab interactions
- Uses `expo-haptics` for platform-native feedback (iOS only via `process.env.EXPO_OS === 'ios'` check)
- Pattern: `Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)` in onPressIn handler

### Special Effects & Media
- **Confetti animation:** `react-native-confetti-cannon` used in ProfilePage for milestone celebrations (ref-based trigger)
- **Audio playback:** `expo-audio` (`useAudioPlayer` hook) for sound effects; initialize player at component level, then call `player.play()` as needed
- **Pattern:** Use cooldown flags (e.g., `confettiCooldown` state) to prevent rapid re-triggering of animations
- **Ref management:** Confetti ref typed as `any` due to library type limitations
- **Note:** `expo-notifications` has limited functionality in Expo Go; use development builds for full push notification support

### Services Layer (`services/` directory)
All API integrations are centralized in the `services/` folder with a **stub-first approach**:
- **Stub Mode (default):** All services return mock data immediately; no API calls are made. This allows UI development without API keys or internet.
- **Configuration:** `services/config.ts` manages API keys via env vars (`EXPO_PUBLIC_USE_STUB_DATA`, `EXPO_PUBLIC_FIREBASE_API_KEY`, etc.)
- **Stub detection:** `isStubMode()` returns true if `EXPO_PUBLIC_USE_STUB_DATA !== 'false'` OR if Firebase API key is `'STUB'`
- **Services available:**
  - `authService` - Firebase Authentication (stub: returns mock user immediately)
  - `collegeService` - College Scorecard API (stub: returns 3 mock Florida colleges)
  - `aiService` - Google Gemini chat (stub: returns canned keyword-based responses)
  - `storageService` - Firebase Storage for resume/transcript uploads (stub: saves to AsyncStorage)
  - `notificationsService` - Push notifications (stub: logs to console)
- **Import pattern:** Use barrel export: `import { authService, collegeService } from '@/services'`
- **Switching to real APIs:** Set `EXPO_PUBLIC_USE_STUB_DATA=false` in env, add real API keys, follow setup in [services/README.md](services/README.md)
- **Design principle:** Services abstract API details; UI code never knows if it's calling stub or real API. All services return Promises for consistency.

## Common Patterns to Follow

1. **Export types explicitly** for data structures (User, AppDataState, QuestionnaireAnswers) from provider hooks
2. **Use `useCallback` in context providers** for memoized action functions to prevent unnecessary re-renders
3. **Separate concerns**: hooks for logic/state, components for UI, pages for screen-specific composition
4. **Always unsubscribe/cleanup**: useEffect in providers returns cleanup functions to prevent memory leaks (check `mounted` flag)
5. **Theme-aware class names**: Prefer computed class strings over inline ternaries for readability
6. **Questionnaire answers stored as** `Record<string, string>` for flexible form handling
7. **Input validation patterns**: Use regex tests and type guards (e.g., GPA validation with `/^\d*\.?\d*$/` and `num <= 4.0`)
8. **Conditional rendering for auth**: Pages that require user data should return fallback UI if `!user`, not null (prevents crashes)
9. **Use `useMemo`** for derived state calculations (e.g., checking if questionnaire data exists: `useMemo(() => Object.keys(state.questionnaireAnswers ?? {}).length > 0, [state.questionnaireAnswers])`)
10. **Always provide sensible defaults** in TextInput and form fields (empty string `""`, not `undefined`) to prevent uncontrolled/controlled component warnings
11. **Multi-step forms pattern**: Use local state for step tracking (see [ProfileSetupPage.tsx](components/pages/ProfileSetupPage.tsx)); progress indicators use conditional `bg-green-500` vs `bg-gray-200`/`bg-gray-800` classes
12. **Haptic feedback pattern**: iOS-only feature via `process.env.EXPO_OS === 'ios'` check before calling `Haptics.impactAsync()`
13. **Auth guard pattern**: Both [app/index.tsx](app/index.tsx) and [app/(tabs)/_layout.tsx](app/(tabs)/_layout.tsx) implement hydration + auth checks. Index routes to profile-setup if user lacks profile completion (checks for `major` or `gpa` fields), else routes to tabs. Tabs layout guards against direct deep linking by redirecting unauthenticated users to login.
14. **User initialization**: When creating users in `signIn()`, initialize ALL optional fields (`major`, `gpa`, `sat`, `act`, `resume`, `transcript`) to empty strings to prevent form bugs
15. **Component props pattern**: Reusable UI components (like `FormInput`, `ProfileField`) accept theme-aware class name props (`textClass`, `inputBgClass`, etc.) instead of consuming theme context directly - keeps them flexible and testable
16. **Path aliases**: TypeScript configured with `@/*` alias mapping to workspace root (see `tsconfig.json`); always use for imports: `import { useAppData } from "@/hooks/use-app-data"`
17. **Error handling in services**: All service methods return Promises; stub implementations simulate network delays (200-500ms) for realistic UX testing; errors thrown with descriptive messages when real APIs not configured

## Environment Variables

No `.env` file exists by default. To configure real APIs:
1. Create `.env` file in project root (not tracked in git)
2. Add keys: `EXPO_PUBLIC_USE_STUB_DATA=false`, `EXPO_PUBLIC_FIREBASE_API_KEY=...`, etc.
3. Access via `process.env.EXPO_PUBLIC_*` (only `EXPO_PUBLIC_` prefixed vars are exposed to client)
4. See [services/config.ts](services/config.ts) for all available env vars

**Security note:** Never commit API keys; use environment variables. Firebase Functions should handle server-side API calls (Gemini) to avoid exposing keys to client.

## Files to Reference

- Navigation: [app/_layout.tsx](app/_layout.tsx), [app/(tabs)/_layout.tsx](app/(tabs)/_layout.tsx), [app/index.tsx](app/index.tsx)
- State: [hooks/use-app-data.tsx](hooks/use-app-data.tsx), [hooks/use-app-theme.tsx](hooks/use-app-theme.tsx)
- Styling: [tailwind.config.js](tailwind.config.js), [constants/theme.ts](constants/theme.ts), [global.css](global.css), [babel.config.js](babel.config.js)
- Layout: [components/layouts/ScreenBackground.tsx](components/layouts/ScreenBackground.tsx)
- UI Components: [components/ui/FormInput.tsx](components/ui/FormInput.tsx) (theme-aware input), [components/ui/ProfileField.tsx](components/ui/ProfileField.tsx)
- Example pages: [components/pages/ProfilePage.tsx](components/pages/ProfilePage.tsx) (editing pattern), [components/pages/ProfileSetupPage.tsx](components/pages/ProfileSetupPage.tsx) (multi-step form)
- Route wrapping: [app/profile-setup.tsx](app/profile-setup.tsx) (demonstrates thin route wrapper pattern)
- Services: [services/README.md](services/README.md) (stub/real API setup), [services/config.ts](services/config.ts) (API configuration)
- Config: [app.json](app.json) (Expo configuration), [metro.config.js](metro.config.js) (bundler setup)
