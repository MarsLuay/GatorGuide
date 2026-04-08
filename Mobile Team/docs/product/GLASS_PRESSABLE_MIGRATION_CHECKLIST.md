# Glass Pressable Migration Checklist

This is the file-by-file migration plan for glass UI press animations in `Mobile Team`.

## Inventory

- Raw `<Pressable>` occurrences: `198`
- `<GlassButton>` usage sites: `12`
- `HapticTab` assignment sites: `1`

## Wrapper Families

### `AnimatedGlassButton`

Use for:
- primary CTAs
- save/submit/continue actions
- auth and onboarding actions
- destructive confirmations only if they are still visually button-like

Expected feel:
- small press scale
- soft spring back
- strongest glass feedback of the shared wrappers

### `AnimatedCardPressable`

Use for:
- large cards
- navigation tiles
- tappable rows
- summary panels

Expected feel:
- very light scale
- optional brightness or shadow lift
- should feel stable, not bouncy

### `AnimatedIconPressable`

Use for:
- back buttons
- close buttons
- small inline actions
- text-link style controls that still need feedback

Expected feel:
- subtle scale and opacity only
- quick response

### `AnimatedChipPressable`

Use for:
- filter pills
- segmented controls
- questionnaire answers
- choice chips

Expected feel:
- compact scale
- optional fill/tint change
- no big bounce

### `KeepNativePressable`

Use for:
- tiny destructive controls
- checkbox-like toggles
- dense calendar cells
- dev-only controls
- navigation primitives we should not replace yet

Expected feel:
- native or near-native
- no full glass animation yet

## Implementation Order

1. Normalize `GlassButton` so it becomes the reference CTA animation.
2. Add shared wrappers for card, icon, and chip pressables.
3. Convert large card-style surfaces first.
4. Convert CTA buttons and auth/onboarding flows.
5. Convert chips and questionnaire answers.
6. Leave toggles, destructive micro-actions, calendar cells, and dev tools for last.

## File-by-File Plan

### Core Primitives And Shared Components

| File | Current Count | Target Wrapper | Notes |
| --- | --- | --- | --- |
| `components/ui/GlassButton.tsx` | `2` raw internal pressables | `AnimatedGlassButton` | Make this the source of truth for CTA motion. |
| `components/GlassTabBar.tsx` | `1` | keep custom / align with `AnimatedCardPressable` feel | Already animated. Only tune spring constants for consistency. |
| `components/haptic-tab.tsx` | navigator primitive | `KeepNativePressable` | Do not replace unless we fully own every tab button path. |
| `components/ui/ProfileField.tsx` | `3` | mixed: `AnimatedChipPressable`, `AnimatedIconPressable`, `AnimatedCardPressable` | Choice chips should use chip wrapper; larger field entry surfaces can use card wrapper. |
| `components/ui/StateCard.tsx` | `1` | `AnimatedGlassButton` or `AnimatedCardPressable` | Choose based on whether it reads as CTA or summary card. |
| `components/ui/StatusBanner.tsx` | `1` | `AnimatedIconPressable` | Keep feedback subtle. |
| `components/ui/DocumentExtractionReviewCard.tsx` | `2` | `AnimatedGlassButton` | Approval/retry style actions should feel like CTAs. |
| `components/ui/LanguageModal.tsx` | `2` | mixed: `AnimatedChipPressable`, `AnimatedIconPressable` | Language options as chips; dismiss action as icon button. |
| `components/ui/OpportunityCarouselWheel.tsx` | `4` | mixed: `AnimatedCardPressable`, `AnimatedIconPressable` | Cards can animate more than tiny controls. |
| `components/ui/HomeTaskMarquee.tsx` | `1` | `AnimatedCardPressable` | Reads as a tappable card/row. |

### App Shell

| File | Current Count | Target Wrapper | Notes |
| --- | --- | --- | --- |
| `app/_layout.tsx` | `3` | `AnimatedGlassButton` | Error / retry / auth-gate actions can share CTA behavior. |
| `app/+not-found.tsx` | `2` | mixed: `AnimatedGlassButton`, `AnimatedIconPressable` | Main recovery action can be stronger than secondary navigation. |
| `app/(tabs)/_layout.tsx` | `1` `HapticTab` site | `KeepNativePressable` | Leave navigator binding alone. |
| `app/(tabs)/privacy.tsx` | `1` | `AnimatedIconPressable` | Likely a simple back action. |
| `app/(tabs)/terms.tsx` | `1` | `AnimatedIconPressable` | Same as privacy. |
| `app/(tabs)/college/[collegeId].tsx` | `9` | mixed: `AnimatedGlassButton`, `AnimatedCardPressable`, `AnimatedIconPressable` | Top actions and major CTAs can be stronger; save/back/link micro-actions should stay subtle. |

### Auth And Onboarding

| File | Current Count | Target Wrapper | Notes |
| --- | --- | --- | --- |
| `components/pages/AuthPage.tsx` | `9` raw, `5` glass | mixed: `AnimatedGlassButton`, `AnimatedChipPressable`, `KeepNativePressable` | Primary auth actions should use glass button; auth mode toggles can use chip wrapper; debug-only actions should stay native. |
| `components/pages/ForgotPasswordPage.tsx` | `1` raw, `2` glass | mixed: `AnimatedGlassButton`, `AnimatedIconPressable` | Reset action as CTA; return/login link stays subtle. |
| `components/pages/OnboardingPage.tsx` | `1` raw, `2` glass | mixed: `AnimatedGlassButton`, `AnimatedChipPressable` | Continue/skip as CTA; compact choice controls can use chip wrapper. |
| `components/pages/ProfileSetupPage.tsx` | `3` raw, `3` glass | mixed: `AnimatedGlassButton`, `AnimatedCardPressable`, `AnimatedIconPressable` | Keep save/continue strong; image/source pickers can use card wrapper. |

### Navigation, Content, And Discovery Screens

| File | Current Count | Target Wrapper | Notes |
| --- | --- | --- | --- |
| `components/pages/HomePage.tsx` | `21` | mixed: `AnimatedCardPressable`, `AnimatedGlassButton`, `AnimatedIconPressable` | Home is a major hotspot. Big navigational cards should use card wrapper; tiny link rows stay subtle. |
| `components/pages/ResourcesPage.tsx` | `11` | mixed: `AnimatedCardPressable`, `AnimatedChipPressable`, `KeepNativePressable` | Resource cards and major CTAs can animate; done/check controls should not get full glass behavior yet. |
| `components/pages/ComparePage.tsx` | `8` | mixed: `AnimatedChipPressable`, `AnimatedCardPressable`, `AnimatedIconPressable` | Sort/filter pills as chips, rows as cards, remove/back controls subtle. |
| `components/pages/CollegeSearchToolPage.tsx` | `7` | mixed: `AnimatedCardPressable`, `AnimatedGlassButton`, `AnimatedIconPressable` | Search result cards can animate lightly; launch/save actions depend on prominence. |
| `components/pages/CostCalculatorPage.tsx` | `5` | mixed: `AnimatedChipPressable`, `AnimatedCardPressable`, `AnimatedIconPressable` | Option selectors as chips; result blocks or rows as cards. |
| `components/pages/DeadlineCalendarPage.tsx` | `6` | mixed: `AnimatedIconPressable`, `AnimatedCardPressable`, `KeepNativePressable` | Month arrows/back can animate subtly; date cells should stay near-native for now. |
| `components/pages/SavedCollegesPage.tsx` | `3` | mixed: `AnimatedCardPressable`, `AnimatedIconPressable` | College rows as cards, remove/back as subtle icons. |
| `components/pages/RoadmapPage.tsx` | `22` | mixed: `AnimatedCardPressable`, `AnimatedGlassButton`, `KeepNativePressable` | Large task rows and document actions can animate; tiny delete/complete controls should not get full glass yet. |
| `components/pages/SettingsPage.tsx` | `16` | mixed: `AnimatedCardPressable`, `AnimatedGlassButton`, `AnimatedIconPressable`, `KeepNativePressable` | Rows can use subtle card feedback; toggles stay near-native; logout/delete confirmations can use CTA behavior. |
| `components/pages/OpportunityAdminPage.tsx` | `11` | mixed: `AnimatedChipPressable`, `AnimatedGlassButton`, `KeepNativePressable` | Filter/type pills as chips; add/save/import buttons as glass buttons; micro edit/delete stays simpler. |
| `components/pages/TransferPlannerPage.tsx` | `12` | mixed: `AnimatedCardPressable`, `AnimatedChipPressable`, `AnimatedGlassButton`, `AnimatedIconPressable` | Dense page, so keep most motion restrained. |

### Profile And Questionnaire

| File | Current Count | Target Wrapper | Notes |
| --- | --- | --- | --- |
| `components/pages/ProfilePage.tsx` | `14` | mixed: `AnimatedCardPressable`, `AnimatedGlassButton`, `AnimatedIconPressable` | Questionnaire summary card and major profile tiles should use card wrapper. Keep compact profile utility actions subtle. |
| `components/pages/QuestionnairePage.tsx` | `7` | mixed: `AnimatedChipPressable`, `AnimatedGlassButton`, `AnimatedIconPressable` | Answer options should be chip-based. `Next` and `Save and Exit` should be strongest buttons on the screen. |

### Lightweight Screens

| File | Current Count | Target Wrapper | Notes |
| --- | --- | --- | --- |
| `components/pages/AboutPage.tsx` | `1` | `AnimatedIconPressable` | Keep very subtle. |
| `components/pages/LanguagePage.tsx` | `2` | mixed: `AnimatedCardPressable`, `AnimatedIconPressable` | Language rows can feel like tappable cards. |

### Dev And Low-Priority Areas

| File | Current Count | Target Wrapper | Notes |
| --- | --- | --- | --- |
| `components/dev/UniversalDevMode.tsx` | `5` | `KeepNativePressable` | Defer until product-facing motion is stable. |

## Recommended Migration Buckets

### Bucket 1: Convert Immediately

- `components/ui/GlassButton.tsx`
- `components/pages/AuthPage.tsx`
- `components/pages/ForgotPasswordPage.tsx`
- `components/pages/OnboardingPage.tsx`
- `components/pages/ProfileSetupPage.tsx`
- `components/pages/QuestionnairePage.tsx`
- `components/pages/HomePage.tsx`

### Bucket 2: Convert After Shared Wrappers Exist

- `components/pages/ResourcesPage.tsx`
- `components/pages/ProfilePage.tsx`
- `components/pages/ComparePage.tsx`
- `components/pages/CollegeSearchToolPage.tsx`
- `components/pages/SavedCollegesPage.tsx`
- `components/pages/RoadmapPage.tsx`
- `components/pages/SettingsPage.tsx`
- `components/pages/OpportunityAdminPage.tsx`
- `components/pages/TransferPlannerPage.tsx`

### Bucket 3: Keep Subtle Or Defer

- `components/dev/UniversalDevMode.tsx`
- `components/haptic-tab.tsx`
- `components/pages/DeadlineCalendarPage.tsx` date cells
- destructive icon-only controls in `RoadmapPage`, `SettingsPage`, and `OpportunityAdminPage`

## Highest-Risk Areas

These files have enough pressables that we should convert them carefully and test layout/touch behavior after each pass.

- `components/pages/RoadmapPage.tsx`
- `components/pages/HomePage.tsx`
- `components/pages/SettingsPage.tsx`
- `components/pages/ProfilePage.tsx`
- `components/pages/TransferPlannerPage.tsx`
- `components/pages/ResourcesPage.tsx`
- `components/pages/OpportunityAdminPage.tsx`

## Best Next Step

Build these shared wrappers in order:

1. `AnimatedGlassButton`
2. `AnimatedCardPressable`
3. `AnimatedIconPressable`
4. `AnimatedChipPressable`

Then migrate Bucket 1 first so the most visible CTA interactions feel consistent before we touch dense utility screens.
