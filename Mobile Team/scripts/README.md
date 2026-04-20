# Scripts

This folder contains the PowerShell helpers and compatibility wrapper for the transfer planner refresh flow.

## Quick start for future people

For the easiest full run, use one command:

```bash
npm run planner:full:verify
```

Or double-click the repo-root launcher:

- `..\Course-Planner-Updater.bat`

This executes refresh + verification + hardening + Windows QA and writes a summary to:

- `.tmp/transfer-planner-maintenance-summary.md`

If a run fails because of temporary schedule-download/network issues, use the updater's built-in no-download option:

```bash
..\Course-Planner-Updater.bat refresh-no-downloads
```

Then rerun the full maintenance command once network access is stable.

## Planner launchers

- `Course-Planner-Updater.bat`
  - Main one to use.
  - Lives at the repo root now, with `scripts/Course-Planner-Updater.bat` kept as a thin compatibility wrapper.
  - Double-click it for a menu, or run it from a terminal with one of the built-in modes:
    - `maintenance`
    - `maintenance-no-downloads`
    - `refresh`
    - `refresh-no-downloads`
    - `cache-summary`
    - `edit-course-links`
    - `laymans-diagnosis`
  - This is now the single user-facing Windows launcher for the planner update flow.
  - The root launcher now also includes `Edit course links` and `Laymans Diagnosis`, and both launchers print `Laymans Diagnosis` when they can explain failures or important warnings in plain language.

## Required update inputs

These are the required inputs that drive planner updates:

- Working Node + npm install in `Mobile Team`.
- Official UW/GRC source pages and PDFs reachable over network.
- Current Green River annual schedule URLs (discovered automatically by the GRC public-materials step).
- Current UW/GRC catalog pages for ingestion.
- Existing source manifest and parser adapter coverage for each major/pathway owner.

If any of those inputs change, the run output reports exactly where automation coverage broke.

## How to see what must be updated

After `planner:full:verify`, open:

- `.tmp/transfer-planner-maintenance-summary.md`

The summary now includes:

- `Automation Signals` counts (source gaps, parse failures, diff debt, owner-audit issues, hardening outcome).
- `Required Update Queue`, which lists the concrete update categories still blocking a clean state.

Use the linked reports in that summary for details:

- `.tmp/transfer-planner-source-gaps.md`
- `.tmp/transfer-planner-requirement-source-parse-report.md`
- `.tmp/transfer-planner-requirement-diff-promotion-report.md`
- `.tmp/transfer-planner-owner-audit.md`
- `.tmp/transfer-planner-hardening-report.md`

## PowerShell helpers

The batch launcher calls the PowerShell scripts in the same folder:

- `run-transfer-planner-refresh.ps1`
- `run-transfer-planner-maintenance.ps1`

## Terminal equivalents

From `Mobile Team`:

```bash
npm run planner:full:verify
npm run planner:status
npm run planner:check-year-coverage
npm run planner:refresh
npm run planner:verify
npm run planner:audit:owners
```

For the interactive maintenance launcher in a terminal:

```bash
powershell -ExecutionPolicy Bypass -File scripts/run-transfer-planner-maintenance.ps1
```

Helpful direct options:

- `-ShowCacheSummary`
  - Print the current cached-artifact snapshot plus the latest maintenance/refresh timestamps, then exit.
- `-OnlySection <section-id>`
  - Run just one section such as `verification` or `hardening`.
- `-StartSection <section-id>`
  - Start from one section and continue through the remaining sections.
- `-NoPrompt`
  - Skip the interactive menu and use the flag-driven selection directly.
