# Scripts

This folder contains Windows launchers for the transfer planner refresh flow.

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

## PowerShell wrappers

These `.cmd` files call the PowerShell scripts in the same folder:

- `run-transfer-planner-refresh.ps1`
- `run-transfer-planner-maintenance.ps1`

## Terminal equivalents

From `Mobile Team`:

```bash
npm run planner:refresh
npm run planner:verify
npm run planner:audit:owners
```
