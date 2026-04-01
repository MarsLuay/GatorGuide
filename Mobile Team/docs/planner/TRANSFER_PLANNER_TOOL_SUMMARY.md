# Transfer Planner Tool Summary

## Summary of this doc and what it contains

This doc explains what the Green River -> UW transfer planner currently does, what data shape it uses, and what it should and should not promise to students.

## What the planner is

- A Green River College transfer-planning tool for UW Seattle, UW Bothell, and UW Tacoma.
- A planner that works per row of `source college + target campus + target major`.
- A planning tool that compares transcript courses against curated Green River equivalents and requirement buckets.

## What the planner currently uses

- An explicit per-major `grcCourseList`.
- Requirement buckets for:
  - required before application
  - required before enrollment
  - worth finishing at Green River
- Structured degree-map notes for the majors that now have deeper campus-specific coverage.
- The transcript parser plus the planner's major/campus selection flow.

## Equivalency assumptions already folded into the planner

The detailed planner-facing equivalency and series-rule assumptions now live in:

- [GRC_EQUIVALENCY_GUIDE_REFERENCE.md](./GRC_EQUIVALENCY_GUIDE_REFERENCE.md)

## What the planner currently outputs

- A campus-major-specific Green River equivalent course list.
- A done vs missing view for the tracked requirement buckets.
- A recommended next-step or quarter-plan suggestion based on missing tracked courses.
- Planner notes, caution flags, and official reference links for the selected major.

## What the planner is not

- It is not an official UW degree audit.
- It is not a live registrar schedule.
- It is not a promise that every course is offered every quarter.
- It is not a substitute for advisor review when the major has multiple valid science, math, or programming paths.

## Planner doc set

- [UWS_DEGREE_COURSES.md](./UWS_DEGREE_COURSES.md)
- [UWB_DEGREE_COURSES.md](./UWB_DEGREE_COURSES.md)
- [UWT_DEGREE_COURSES.md](./UWT_DEGREE_COURSES.md)
- [GRC_EQUIVALENCY_GUIDE_REFERENCE.md](./GRC_EQUIVALENCY_GUIDE_REFERENCE.md)
- [TRANSFER_PLANNER_GENERAL_TODO.md](./TRANSFER_PLANNER_GENERAL_TODO.md)
