# Docs Index

This folder contains the mobile app's planner docs, remaining reference artifacts, and product or implementation specs.

## Folder Layout

- `planner/`: campus-specific planner docs plus the planner summary and consolidated planner-facing equivalency reference.
- `reference/`: remaining non-planner reference artifacts.
- `product/`: product and technical implementation docs for the mobile app.

## Planner Docs

- [UWS_DEGREE_COURSES.md](./planner/UWS_DEGREE_COURSES.md)
  Current Green River -> UW Seattle degree rows, course lists, and tracked requirement sequences.

- [UWB_DEGREE_COURSES.md](./planner/UWB_DEGREE_COURSES.md)
  Current Green River -> UW Bothell degree rows, course lists, and tracked requirement sequences.

- [UWT_DEGREE_COURSES.md](./planner/UWT_DEGREE_COURSES.md)
  Current Green River -> UW Tacoma degree rows, course lists, and tracked requirement sequences.

- [GRC_EQUIVALENCY_GUIDE_REFERENCE.md](./planner/GRC_EQUIVALENCY_GUIDE_REFERENCE.md)
  Consolidated planner-facing equivalency and transfer-track rules pulled from the raw reference docs.

- [TRANSFER_PLANNER_TOOL_SUMMARY.md](./planner/TRANSFER_PLANNER_TOOL_SUMMARY.md)
  One-place summary of what the planner does and what data it uses.

## Planner Reference Migration

- [GRC_EQUIVALENCY_GUIDE_REFERENCE.md](./planner/GRC_EQUIVALENCY_GUIDE_REFERENCE.md)
  This doc now carries the migrated planner-facing content that used to live in the separate Green River transfer-degree and UW equivalency markdown references.

## Product And Technical Docs

- [OFFLINE_ONLINE_SYNC_SPEC.md](./product/OFFLINE_ONLINE_SYNC_SPEC.md)
  Sync behavior and data-handling spec for offline/online app workflows.

- [FIREBASE_CHAT_HISTORY_SCHEMA.md](./product/FIREBASE_CHAT_HISTORY_SCHEMA.md)
  Firebase data-structure notes for chat history.

- [OPPORTUNITY_ADMIN_TOOL.md](./product/OPPORTUNITY_ADMIN_TOOL.md)
  Notes for the opportunity admin tool.

- [BRANDING_ASSET_PIPELINE.md](./product/BRANDING_ASSET_PIPELINE.md)
  Branding and asset-generation pipeline notes.

## Reference Files

- [SSR_TSRPT.pdf](./reference/SSR_TSRPT.pdf)
  Reference PDF kept in this folder.

## Suggested Reading Order

For transfer-planner work:

1. [TRANSFER_PLANNER_TOOL_SUMMARY.md](./planner/TRANSFER_PLANNER_TOOL_SUMMARY.md)
2. [GRC_EQUIVALENCY_GUIDE_REFERENCE.md](./planner/GRC_EQUIVALENCY_GUIDE_REFERENCE.md)
3. [UWS_DEGREE_COURSES.md](./planner/UWS_DEGREE_COURSES.md)
4. [UWB_DEGREE_COURSES.md](./planner/UWB_DEGREE_COURSES.md)
5. [UWT_DEGREE_COURSES.md](./planner/UWT_DEGREE_COURSES.md)

## Notes

- The planner docs are now intentionally split by target UW campus.
- The planner-facing transfer and equivalency markdown references have been migrated into `GRC_EQUIVALENCY_GUIDE_REFERENCE.md`.
- When two planner docs overlap, update the more specific one instead of duplicating the same rule in several places.
- The campus planner docs are generated from the planner source layer. Refresh them from the maintenance pipeline instead of hand-editing them.
- The current one-click planner maintenance entrypoints are:
  - `npm run planner:windows:maintenance`
  - `npm run planner:full:verify`
  - `scripts\run-planner-maintenance.cmd`
- The same maintenance pass now emits `.tmp/transfer-planner-hardening-report.md`, which is the single artifact that checks source gaps, parser failures, diff classification cleanup, machine-readable availability statuses, and source-backed-or-hidden wording.
