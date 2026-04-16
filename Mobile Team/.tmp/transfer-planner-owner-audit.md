# Transfer Planner Owner Audit

Generated: 2026-04-16T21:11:21.375Z

- Owners audited: 225
- Owners with errors: 0
- Owners with warnings: 1
- Owners with source-only UW course codes: 118
- Root-cause errors: 0
- Root-cause warnings: 1
- Raw symptom errors: 0
- Raw symptom warnings: 1
- Auto-promoted owner invariant violations: 0
- Total source-only UW course codes: 2072

## Root Cause Counts

- used-snapshot-fallback: 1

## Owners With Warnings

### Political Science
- Owner: uw-seattle-political-science
- Campus: uw-seattle
- Source: https://www.polisci.washington.edu/political-science-major-declaration-and-requirements
- [warning] used-snapshot-fallback: Requirement source parsing used a cached snapshot fallback. (HTTP 429 Too Many Requests)
- Diagnostic signals: used-snapshot-fallback
## Coverage Notes

- Source-only UW course codes are tracked in the JSON report as coverage gaps, but they are not treated as warnings in this audit because that bucket is still broadly expected across many majors.

