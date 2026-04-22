# Welcome to the Mobile Team!

The Mobile Team is the group that actually builds the app and implements all cool ideas. This folder specifically holds everything important, the pages, settings, translations, etc.

## What's in This Folder

- `app/`: Expo Router screens and navigation.
- `components/`: reusable UI and page-level components.
- `docs/`: implementation notes and behavior specs for the mobile app.
- `services/`: app services for AI, auth, storage, college data, and config.
- `constants/`, `hooks/`, and `utils/`: shared logic and support files.
- `functions/`: Firebase Functions code related to the mobile app.
- [`docs/product/OFFLINE_ONLINE_SYNC_SPEC.md`](docs/product/OFFLINE_ONLINE_SYNC_SPEC.md): current offline/online caching, sync, and conflict-resolution behavior.
- [`docs/product/BRANDING_ASSET_PIPELINE.md`](docs/product/BRANDING_ASSET_PIPELINE.md): icon, splash, adaptive icon, and favicon source-of-truth pipeline.
- [`docs/product/FIREBASE_CHAT_HISTORY_SCHEMA.md`](docs/product/FIREBASE_CHAT_HISTORY_SCHEMA.md): planned Firestore schema, ownership rules, and retention policy for assistant chat sessions/messages.
- [`docs/product/OPPORTUNITY_ADMIN_TOOL.md`](docs/product/OPPORTUNITY_ADMIN_TOOL.md): staff editor flow for creating and managing shared opportunity records without code changes.
- [`docs/planner/UWS_DEGREE_COURSES.md`](docs/planner/UWS_DEGREE_COURSES.md): current Green River -> UW Seattle degree rows, Green River equivalent courses, and tracked requirement sequences.
- [`docs/planner/UWB_DEGREE_COURSES.md`](docs/planner/UWB_DEGREE_COURSES.md): current Green River -> UW Bothell degree rows, Green River equivalent courses, and tracked requirement sequences.
- [`docs/planner/UWT_DEGREE_COURSES.md`](docs/planner/UWT_DEGREE_COURSES.md): current Green River -> UW Tacoma degree rows, Green River equivalent courses, and tracked requirement sequences.
- [`docs/planner/GRC_EQUIVALENCY_GUIDE_REFERENCE.md`](docs/planner/GRC_EQUIVALENCY_GUIDE_REFERENCE.md): consolidated planner-facing Green River -> UW equivalency and transfer-track rules.
- [`docs/planner/TRANSFER_PLANNER_TOOL_SUMMARY.md`](docs/planner/TRANSFER_PLANNER_TOOL_SUMMARY.md): summary of what the transfer planner does and what it uses.
- [`docs/product/COLLEGE_RANKING.md`](docs/product/COLLEGE_RANKING.md): shared college ranking philosophy and score model used by recommendations.

## All Commands

### Windows QA

You can run the Playwright-based Windows/web QA harness locally from `Mobile Team`:

```bash
npm run qa:windows:screenshots
npm run qa:windows:interactions
npm run qa:windows:ci
```

Notes:

- `qa:windows:screenshots` expects an existing app server unless you set `QA_BASE_URL` / `QA_STATIC_EXPORT` yourself.
- `qa:windows:ci` is the full CI-style path: it exports the web build, serves it locally, runs screenshots, then runs interaction checks.

### Web Deployment

This app now deploys to Vercel from `Mobile Team`:

```bash
vercel --prod
```

Notes:

- [`vercel.json`](vercel.json) runs the Expo static web export and serves the built `dist` output.
- The current production URL is <https://gator-guide.vercel.app>.

### Planner Maintenance

For the full planner maintenance pass on Windows, including refresh, verification, hardening checks, Playwright Chromium setup, and Windows QA:

```bash
npm run planner:windows:maintenance
npm run planner:full:verify
```

If you only want to refresh the Green River public-material discovery layer first, including newly published annual schedules and the current catalog source:

```bash
npm run planner:discover-grc-materials
```

Or double-click:

```text
..\Course-Planner-Updater.bat
```

The unified updater now includes the old refresh variants as built-in options:

- Course updates + tests
- Course updates + tests with downloads skipped
- Course updates only
- Course updates only with downloads skipped
- cache summary only
- edit course links from the root launcher (select "Edit course links" from the main Course-Planner-Updater menu)

The maintenance and refresh launchers — and the root updater launcher — now also print a `Laymans Diagnosis` section whenever the tooling already knows enough to explain a failure or important warning in simple language.

This launcher writes a summary to:

```text
Mobile Team\.tmp\transfer-planner-maintenance-summary.md
```

It also writes a planner hardening report that clarifies the current planner contract:

```text
Mobile Team\.tmp\transfer-planner-hardening-report.md
```

The Green River discovery pass also writes the current public-material snapshot used by the refresh tool:

```text
Mobile Team\.tmp\transfer-planner-grc-public-materials.md
```
