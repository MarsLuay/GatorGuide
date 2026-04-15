# Scripts

This folder contains Windows launchers for the transfer planner refresh flow.

## Quick start for future people

For the easiest full run, use one command:

```bash
npm run planner:full:verify
```

Or double-click:

- `scripts/run-planner-maintenance.bat`
- `scripts/run-planner-maintenance.cmd`

This executes refresh + verification + hardening + Windows QA and writes a summary to:

- `.tmp/transfer-planner-maintenance-summary.md`

If a run fails because of temporary schedule-download/network issues, use:

```bash
scripts/run-planner-refresh-no-downloads.cmd
```

Then rerun the full maintenance command once network access is stable.

## Planner launchers

- `run-planner-refresh.cmd`
  - Main one to use.
  - Double-click this to regenerate the transfer planner data and rerun the planner verification steps.
  - This now includes the official source-link audit, a major-by-major owner audit report, typecheck, and the planner regression tests.

- `run-planner-refresh-no-downloads.cmd`
  - Runs the planner refresh without downloading Green River schedule snapshots.
  - Use this if the normal refresh fails because of schedule download/network issues but you still want to rebuild the rest of the planner outputs.
  - It still checks official source links, rebuilds the planner data, runs the owner audit, and runs the final verification steps.

- `run-planner-maintenance.cmd`
  - Larger maintenance flow.
  - Runs the planner refresh plus the extra maintenance/QA steps used for the full planner verification workflow.
  - The launcher is interactive now: it can run the full flow, run one maintenance section, start from a selected section through the end, or show a cache/last-run summary before doing any work.

- `run-planner-maintenance.bat`
  - Batch-file wrapper around `run-planner-maintenance.cmd`.
  - Use this if you specifically want a double-clickable `.bat` entrypoint for the full planner update flow.

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

## PowerShell wrappers

These `.cmd` files call the PowerShell scripts in the same folder:

- `run-transfer-planner-refresh.ps1`
- `run-transfer-planner-maintenance.ps1`

The `.bat` wrapper simply forwards to the main maintenance `.cmd` launcher:

- `run-planner-maintenance.bat`

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
