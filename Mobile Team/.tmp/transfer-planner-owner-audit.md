# Transfer Planner Owner Audit

Generated: 2026-04-22T19:18:37.565Z

- Owners audited: 361
- Owners with errors: 1
- Owners with warnings: 11
- Owners with source-only UW course codes: 76
- Root-cause errors: 1
- Root-cause warnings: 11
- Raw symptom errors: 1
- Raw symptom warnings: 11
- Auto-promoted owner invariant violations: 0
- Total source-only UW course codes: 3970

## Root Cause Counts

- no-parsed-uw-course-codes: 11
- registry-parser-drift: 1

## Owners With Errors

### Education Studies - Intercollegiate Athletics Leadership) (Fee-Based)
- Owner: uw-seattle-education-studies:pathway:intercollegiate-athletics-leadership-fee-based
- Campus: uw-seattle
- Source: https://www.washington.edu/students/gencat/program/S/CollegeofEducation-351.html
- Auto-promoted primary source: no
- [error] registry-parser-drift: Canonical registry and parsed requirement blocks drifted for this owner. ({"ownerId":"uw-seattle-education-studies:pathway:intercollegiate-athletics-leadership-fee-based","autoPromotedPrimarySource":false,"symptoms":["missing-parsed-source-block"]})
- Diagnostic signals: missing-parsed-source-block
## Owners With Warnings

### Business Administration (BA)
- Owner: uw-bothell-business-administration
- Campus: uw-bothell
- Source: https://www.uwb.edu/business/undergraduate/bachelor-of-business-administration/curriculum
- [warning] no-parsed-uw-course-codes: Parsed requirement source block produced zero UW course codes.
- Diagnostic signals: no-parsed-uw-course-codes
### Economics (BS)
- Owner: uw-bothell-economics
- Campus: uw-bothell
- Source: https://www.uwb.edu/business/undergraduate/bachelor-of-economics
- [warning] no-parsed-uw-course-codes: Parsed requirement source block produced zero UW course codes.
- Diagnostic signals: no-parsed-uw-course-codes
### Nursing (BS), First Year RN to BSN (Direct Entry) - Tenure Track
- Owner: uw-bothell-nursing-first-year-rn-to-bsn:pathway:tenure-track
- Campus: uw-bothell
- Source: https://www.uwb.edu/nhs/about/promotion-and-tenure-guidelines
- [warning] no-parsed-uw-course-codes: Parsed requirement source block produced zero UW course codes.
- Diagnostic signals: no-parsed-uw-course-codes
### Nursing (BS), RN to BSN - Tenure track
- Owner: uw-bothell-nursing-rn-to-bsn:pathway:tenure-track
- Campus: uw-bothell
- Source: https://www.uwb.edu/nhs/about/promotion-and-tenure-guidelines
- [warning] no-parsed-uw-course-codes: Parsed requirement source block produced zero UW course codes.
- Diagnostic signals: no-parsed-uw-course-codes
### Art History - Textual Studies)
- Owner: uw-seattle-art-history:pathway:textual-studies
- Campus: uw-seattle
- Source: https://www.washington.edu/students/gencat/program/S/Art+ArtHistory+Design-105.html
- [warning] no-parsed-uw-course-codes: Parsed requirement source block produced zero UW course codes.
- Diagnostic signals: no-parsed-uw-course-codes
### Drama - Acting)
- Owner: uw-seattle-drama:pathway:acting
- Campus: uw-seattle
- Source: https://www.washington.edu/students/gencat/program/S/Drama-134.html
- [warning] no-parsed-uw-course-codes: Parsed requirement source block produced zero UW course codes.
- Diagnostic signals: no-parsed-uw-course-codes
### Education Studies - Curriculum and Instruction): Social Studies
- Owner: uw-seattle-education-studies:pathway:curriculum-and-instruction-social-studies
- Campus: uw-seattle
- Source: https://www.washington.edu/students/gencat/program/S/CollegeofEducation-351.html
- [warning] no-parsed-uw-course-codes: Parsed requirement source block produced zero UW course codes.
- Diagnostic signals: no-parsed-uw-course-codes
### Education Studies - Social Studies
- Owner: uw-seattle-education-studies:pathway:social-studies
- Campus: uw-seattle
- Source: https://www.washington.edu/students/gencat/program/S/CollegeofEducation-351.html
- [warning] no-parsed-uw-course-codes: Parsed requirement source block produced zero UW course codes.
- Diagnostic signals: no-parsed-uw-course-codes
### Italian
- Owner: uw-seattle-italian
- Campus: uw-seattle
- Source: https://frenchitalian.washington.edu/undergraduate-studies-italian
- [warning] no-parsed-uw-course-codes: Parsed requirement source block produced zero UW course codes.
- Diagnostic signals: no-parsed-uw-course-codes
### Arts, Media and Culture (BA)
- Owner: uw-tacoma-arts-media-culture
- Campus: uw-tacoma
- Source: https://www.tacoma.uw.edu/sias/cac/arts-media-culture
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

