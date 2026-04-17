# Transfer Planner Owner Audit

Generated: 2026-04-17T23:37:15.272Z

- Owners audited: 225
- Owners with errors: 0
- Owners with warnings: 5
- Owners with source-only UW course codes: 1
- Root-cause errors: 0
- Root-cause warnings: 5
- Raw symptom errors: 0
- Raw symptom warnings: 5
- Auto-promoted owner invariant violations: 0
- Total source-only UW course codes: 6

## Root Cause Counts

- no-parsed-uw-course-codes: 4
- used-snapshot-fallback: 1

## Owners With Warnings

### Business Administration (BA)
- Owner: uw-bothell-business-administration
- Campus: uw-bothell
- Source: https://www.uwb.edu/business/undergraduate/bachelor-of-business-administration
- [warning] no-parsed-uw-course-codes: Parsed requirement source block produced zero UW course codes.
- Diagnostic signals: no-parsed-uw-course-codes
### Economics (BS)
- Owner: uw-bothell-economics
- Campus: uw-bothell
- Source: https://www.uwb.edu/business/undergraduate/bachelor-of-economics
- [warning] no-parsed-uw-course-codes: Parsed requirement source block produced zero UW course codes.
- Diagnostic signals: no-parsed-uw-course-codes
### Physics
- Owner: uw-seattle-physics
- Campus: uw-seattle
- Source: https://phys.washington.edu/physics-bs-degree-requirements
- [warning] used-snapshot-fallback: Requirement source parsing fell back to a cached snapshot after live-source throttling and still needs attention. (HTTP 429 Too Many Requests)
- Diagnostic signals: used-snapshot-fallback
### History (BA)
- Owner: uw-tacoma-history
- Campus: uw-tacoma
- Source: https://www.tacoma.uw.edu/sias/socs/history
- [warning] no-parsed-uw-course-codes: Parsed requirement source block produced zero UW course codes.
- Diagnostic signals: no-parsed-uw-course-codes
### Social Welfare (BA)
- Owner: uw-tacoma-social-welfare
- Campus: uw-tacoma
- Source: https://www.tacoma.uw.edu/swcj/basw-curriculum
- [warning] no-parsed-uw-course-codes: Parsed requirement source block produced zero UW course codes.
- Diagnostic signals: no-parsed-uw-course-codes
## Coverage Notes

- Source-only UW course codes are tracked in the JSON report as coverage gaps, but they are not treated as warnings in this audit because that bucket is still broadly expected across many majors.

