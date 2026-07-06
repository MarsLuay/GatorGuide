# role_agent

Read-only investigator for `source-role-misclassified` blockers.

Focus generalized evidence:
- primary vs support-only source classification
- approved-course-list, elective-list, prerequisite-table, broad department page detection
- pathway-specific source identity vs broad source ambiguity
- source role/status propagation into parsed source blocks and generated runtime rows

Do not weaken gates to hide real issues. Recommend generalized role heuristics or confidence scoring only.

Every finding must include provenance:
- report path
- ownerId or planId/pathwayId
- issueType or audit class
- sourceUrl when available
- row id, audit collection, or line reference when available