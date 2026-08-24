# Source App AI Maintainer Guide

<!-- project-memory-bootstrap:v1 -->
## Project memory bootstrap

From this project root, before any task, run:

```bash
python3 ../../scripts/project-memory-context.py --root . --task "<current task>"
```

Read every path listed under `Required source reads` before editing. A non-zero result blocks the task; repair the project contract or route before continuing. Edit durable tasks and memory only at contract-listed paths.
<!-- /project-memory-bootstrap:v1 -->


This folder has Expo/React Native app, Firebase Functions, planner runtime, generated planner data, planner maintenance scripts.

## Mental Model

- `app/` has Expo Router route files. Most route files delegate to page components.
- `components/pages/` has page-level experiences.
- `components/ui/` has reusable primitives.
- `hooks/use-app-data.tsx` owns local app state, persisted app data, profile updates, questionnaire answers, saved colleges, account/session reconciliation.
- `services/` has integration and domain logic.
- `constants/` has app constants, generated planner data, theme tokens, routes, schema keys, locale resources.
- `scripts/planner/` owns planner ingestion, parsing, code generation, audits, verification.

## Command Cwd

Run app and planner commands from this `source/` directory.

```powershell
npm run lint
npx tsc --noEmit
npm run start
npm run planner:verify
npm run planner:full:verify
```

Do not tell users to run these from repository root unless command explicitly references `source`.

## Generated Planner Artifacts

> Detailed rules: [AGENTS.details/generated-planner-artifacts.md](AGENTS.details/generated-planner-artifacts.md). Read them before working in this area.

## Where To Edit

> Detailed rules: [AGENTS.details/where-to-edit.md](AGENTS.details/where-to-edit.md). Read them before working in this area.

## Large-File Warning

These files human-maintained but large. Inspect targeted symbols with `rg` before broad chunks:

- `services/planning/transfer-planner/runtime.ts`
- `services/ai/ai.service.ts`
- `scripts/planner/parse-transfer-planner-requirement-sources.cjs`
- `scripts/planner/audit-transfer-planner-source-backed-coverage.cjs`
- `scripts/planner/transfer-planner.service.test.ts`

Use focused searches such as:

```powershell
rg -n "buildSuggestedQuarterPlan" services/planning/transfer-planner/runtime.ts
rg -n "buildRequirementStatuses|getRequirementOptionCourseLabels" services/planning/transfer-planner/requirement-status.ts
rg -n "TRANSFER_PLANNER_TRANSCRIPT_COURSES_FIELD|TRANSFER_PLANNER_CURRENT_COURSES_BY_PATH_FIELD" constants/planner-storage.ts components/transfer-planner services/planning
rg -n "^test\\(" scripts/planner/transfer-planner.service.test.ts
```

## Planner Change Checklist

When touching planner logic/source data:

- Identify real source: script, manual override file, or generated output.
- Do not edit generated output directly.
- Run narrowest relevant planner test first.
- Run `npm run planner:verify` before done.
- If generated files changed, summarize producing script and confirming report.

## App Change Checklist

When touching app behavior:

- Keep route constants and tab aliases synced.
- Keep storage keys centralized where possible.
- For planner questionnaire state, add/rename keys only in `constants/planner-storage.ts`; import elsewhere.
- Guard persisted state with `isHydrated`.
- Preserve guest-mode and signed-in behavior unless request changes account behavior.
- Keep theme behavior consistent across `light`, `dark`, `green`, and `system`.
- Use `SUPPORT_EMAIL`, `SUPPORT_MAILTO`, and `APP_VERSION` instead of duplicating values.
- Run `npm run lint` and `npx tsc --noEmit` for broad app changes.

## Code analysis — wont-fix

- **Graph-analysis:** `constants/transfer-planner-source/course-metadata.generated.ts` intentionally references `course-metadata.ts` for shared runtime/types in the generated planner metadata loader. The analyzer reports that generated import cycle, but the planner contract is verified by the source-backed maintenance checks above and this cycle is an accepted artifact of the codegen boundary.
- **Security-scan** react-native, babel-jest, @jest/transform, babel-plugin-istanbul, @istanbuljs/load-nyc-config, js-yaml; Expo SDK 54 pins React Native 0.81.x, and remaining advisories live in React Native published Jest/Istanbul toolchain, not first-party app/runtime code. Gator Guide applied in-SDK patch updates plus transitive overrides that clear Firebase/OpenTelemetry audit chain; clearing last findings needs coordinated Expo/React Native major upgrade.
