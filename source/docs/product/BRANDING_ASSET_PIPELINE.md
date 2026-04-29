# Branding Asset Pipeline

The mobile app now treats the checked-in PNGs in `assets/images/` as the final Expo branding inputs and normalizes them through one verification command.

The source of truth for those PNGs is the chosen graduation-hat mark set in `assets/brand/`.

## Commands

```powershell
npm run assets:brand
npm run assets:brand:verify
```

- `npm run assets:brand`: regenerates the finalized brand assets in the required Expo source sizes.
- `npm run assets:brand:verify`: checks dimensions, required `app.json` references, and confirms placeholder Expo logo files are gone.
- both commands also verify that the vector source files in `assets/brand/` exist before generation/verification continues.

## Final Asset Roles

- `assets/brand/mark-foreground.svg`: transparent green-circle mark used for the app icon foreground, splash mark, and favicon source.
- `assets/brand/mark-monochrome.svg`: themed Android icon source. It keeps the circle silhouette and knocks the hat out of it so the system tint still shows the full mark.
- `assets/brand/mark-background.svg`: solid white adaptive icon background source used behind the transparent foreground layer.

- `assets/images/icon.png`: primary Expo app icon source (`1024x1024`).
- `assets/icon.png`: compatibility copy for tools that still look in the root `assets/` folder (`1024x1024`).
- `assets/images/android-icon-foreground.png`: Android adaptive foreground layer (`1024x1024`, transparent background).
- `assets/images/android-icon-background.png`: Android adaptive background layer (`1024x1024`).
- `assets/images/android-icon-monochrome.png`: Android monochrome layer for themed icons (`1024x1024`, transparent background).
- `assets/images/favicon.png`: web favicon source (`512x512`).
- `assets/images/splash-icon.png`: dedicated splash/loading mark (`1024x1024`, transparent background).

## App Config Expectations

The validator enforces these branding surfaces:

- `expo.name` is `Gator Guide`.
- `expo.icon` points to `./assets/images/icon.png`.
- `expo.web.favicon` points to `./assets/images/favicon.png`.
- `expo.android.adaptiveIcon.*` points to the dedicated Android image set.
- `expo-splash-screen` points to `./assets/images/splash-icon.png` for both light and dark mode.

## Placeholder Cleanup

The old Expo template logo assets were removed from `assets/images/`. If they reappear, `npm run assets:brand:verify` will fail so the placeholder branding does not silently ship again.
