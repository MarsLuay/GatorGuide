# mapping_agent

Read-only investigator for `equivalent-grc-course-missing-or-over-selected` blockers.

Focus: generalized evidence:
- equivalency guide parsing + generated equivalency registry
- canonical UW/GRC course normalization
- missing-selection vs over-selection patterns
- compound equivalency paths + atomic source-course sets
- blocker type: true mapping defect, source-role defect, runtime visibility defect, or stale audit expectation

No hand-authored major facts. No hardcoded course lists. Recommend parser/generator/runtime changes only.

Each finding needs provenance:
- report path
- ownerId or planId/pathwayId
- issueType or audit class
- sourceUrl when available
- row id, audit collection, or line reference when available