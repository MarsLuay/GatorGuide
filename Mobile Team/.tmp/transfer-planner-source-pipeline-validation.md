# Transfer Planner Source Pipeline Validation

Generated: 2026-04-20T08:42:53.412Z

- Outcome: passed
- Passed checks: 9
- Failed checks: 0
- Eligible auto-promotions from discovery: 0
- Review-queue owners: 0
- Source-gap owners: 0
- Promoted owners in canonical registry: 74
- Parseable primary owners: 472
- Parsed owners: 472
- Requirement fingerprints: 472

| Check | Status | Details |
| --- | --- | --- |
| Discovery owners partition cleanly into eligible auto-promotions and review-queue owners | passed | Discovery owners: 0<br>Eligible auto-promotions: 0<br>Review-queue owners: 0 |
| Generated promotion registry matches the promotion report | passed | Promoted owners: 74 |
| Eligible high-confidence discoveries are promoted unless they remain in the review queue | passed | Eligible promoted owners verified: 0 |
| Review queue and source-gap report point at the same unresolved owners | passed | Shared unresolved owners: 0 |
| Auto-promoted owners are materialized in the canonical primary-source registry | passed | Promoted owners: 74<br>Canonical primary owners: 472 |
| Canonical parseable primary owners align with parser input and parser output | passed | Canonical parseable primary owners: 472<br>Parsed owners: 472 |
| Promoted owners appear in parser output and requirement fingerprints | passed | Promoted owners verified end-to-end: 74 |
| Requirement fingerprint coverage stays aligned with parsed requirement owners | passed | Requirement fingerprints: 472<br>Parsed owners: 472<br>Added source fingerprints: 0<br>Added requirement fingerprints: 0 |
| Eligible auto-promotions are fully cleared from the review queue and source-gap report | passed | Eligible owners fully cleared: 0 |

