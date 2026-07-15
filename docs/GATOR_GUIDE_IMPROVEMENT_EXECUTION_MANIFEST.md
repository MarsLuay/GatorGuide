# GatorGuide Improvement — Execution Manifest

Status: Waves 0–20 harness advancing (deep product migration still open)
Updated: 2026-07-11
Orchestrator: gator-guide-improvement-orchestrator
Delivery: one combined update

## Progress summary

| Wave | Phases | Status |
| --- | --- | --- |
| 0–1 | Evidence + characterization | **pass** |
| 2–4 | Contracts + RM + acquisition | **pass** |
| 5–6 | Adapter family harness | **pass** (P05 campus + P06 GRC fixtures extract IR; full campus parity open) |
| 7–9 | Normalize + version + LKG | **pass** |
| 10 | Coverage inventory gate | **harness pass** (full campus migrate open) |
| 11–12 | Living Plan + move/lock model | **engine + UI** — places courses by load/unavailable; Calendar consumes Living Plan quarters; Transfer Planner syncs activeTarget→plannerV2; questionnaire deadline→intended quarter + load UI; transcript→normalizedCourseIds; summer→unavailableQuarters; PlanPlacementCard move/lock wired; runtime.ts extract still open |
| 13–16 | State v2 / privacy / shell / timeline | **partial product wiring + P14-A redirects; Calendar Living Plan primary; Home soft-skips AI roadmap** — Profile PDF transcript uses `transcript-ingestor` strangler (AI reader = fallback); P15 shell swapped (Planner/Resources/Calendar/Profile); Settings under Profile; Home→Planner redirect; State v2 + timeline bridge; Calendar offline projection from plannerV2 |
| 17–20 | i18n / offline / a11y / ship gates | **harness pass + thin P18 product path** (calendar offline); push/a11y/CI still open |

## Verification

`npm run planner:test:pipeline-contracts` — P02–P20 contract suites (83+).

## Preserve

User dirty: `+html.tsx`, `global.css`, `app-rendered-flows.integration.test.cjs`, `package.json` (morgan@1.11.0).

## Honest gap to §11

Harness/strangler contracts exist through P20 gate shapes. Still open: full adapter IR + campus parity, real `runtime.ts` extraction, hard AI/roadmap/saved-college deletion after Calendar hybrid gone, locale automation wiring, offline Firestore merge loop, a11y remediation, weekly refresh CI proof, combined ship rehearsal. Course-Planner-Updater: Node maintenance fallback when pwsh OOM; host-scoped 429 limiter for next audit. **§11 DoD not met.**

No commit without user auth.
