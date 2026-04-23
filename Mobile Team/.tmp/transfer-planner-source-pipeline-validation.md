# Transfer Planner Source Pipeline Validation

Generated: 2026-04-23T15:30:20.503Z

- Outcome: failed
- Passed checks: 18
- Failed checks: 1
- Eligible auto-promotions from discovery: 6
- Weak existing primaries re-evaluated: 102
- High-confidence replacements: 6
- Review-queue owners: 0
- Source-gap owners: 0
- Promoted owners in canonical registry: 89
- Parseable primary owners: 466
- Parsed owners: 466
- Requirement fingerprints: 466

| Check | Status | Details |
| --- | --- | --- |
| Missing-primary discovery owners partition cleanly into eligible auto-promotions and review-queue owners | passed | Discovery owners: 0<br>Eligible missing-primary auto-promotions: 0<br>Eligible weak-existing replacements: 6<br>Review-queue owners: 0 |
| Generated promotion registry matches the promotion report | passed | Promoted owners: 89 |
| Eligible high-confidence discoveries are promoted unless they remain in the review queue | passed | Eligible promoted owners verified: 6 |
| Review queue and source-gap report point at the same unresolved owners | passed | Shared unresolved owners: 0 |
| Auto-promoted owners are materialized in the canonical primary-source registry | passed | Promoted owners: 89<br>Canonical primary owners: 466 |
| Canonical parseable primary owners align with parser input and parser output | passed | Canonical parseable primary owners: 466<br>Parsed owners: 466 |
| Promoted owners appear in parser output and requirement fingerprints | passed | Promoted owners verified end-to-end: 89 |
| Requirement fingerprint coverage stays aligned with parsed requirement owners | failed | Detected added source fingerprints for a refresh with eligible auto-promotions, but no new requirement fingerprints were produced. |
| Eligible auto-promotions are fully cleared from the review queue and source-gap report | passed | Eligible owners fully cleared: 6 |
| Year-tied primary degree sheets can trigger re-evaluation even when parsing still succeeds | passed | primary-source-appears-year-specific |
| Weak-source replacement can trigger for an owner that already has an official primary source | passed | safe-intentional-empty-state, primary-url-looks-graduate-or-timeline, page-headings-look-graduate-or-timeline-heavy, primary-looks-overview-only |
| Biochemistry stale-year re-evaluation discovers current sibling route pages and checklist PDFs | passed | Suggested replacement: https://chem.washington.edu/bs-biochemistry<br>Discovered newer sibling PDF: https://chem.washington.edu/sites/chem/files/documents/undergrad/biochem2018.pdf<br>Newer sibling PDF score: 45 |
| Newer official sibling requirement docs outrank older equivalent PDFs when the program route still matches | passed | Current PDF score: 13<br>Newer sibling PDF score: 45 |
| Year recency does not override a stronger same-route major-program match | passed | Suggested BA-route replacement: https://chem.washington.edu/ba-biochemistry<br>Top BA-route candidate: https://chem.washington.edu/ba-biochemistry |
| Multi-pathway major owners keep review candidates instead of auto-replacing with a single-route page | passed | Action: keep-existing-primary<br>Review candidate: https://chem.washington.edu/ba-chemistry |
| Replacement candidates come from real official links and discovered anchors, not guessed URLs | passed | Suggested replacement: https://astro.washington.edu/undergraduate-program<br>Source kind: discovered-anchor<br>Discovered from: https://astro.washington.edu/timeline-and-requirements |
| Undergraduate degree pages outrank timeline and graduate pages when all are official | passed | Undergraduate score: 70<br>Timeline score: -32<br>Graduate score: -26 |
| Strong existing primaries are not replaced without a clearly better candidate | passed | Strong undergraduate primary left in place. |
| Focused Astronomy fixture prefers the undergraduate-program page over timeline-and-requirements | passed | Suggested action: replace-existing-primary<br>Replacement: https://astro.washington.edu/undergraduate-program<br>Score delta: 95 |

