# Transfer Planner Source Pipeline Validation

Generated: 2026-04-22T19:19:32.166Z

- Outcome: failed
- Passed checks: 16
- Failed checks: 3
- Eligible auto-promotions from discovery: 6
- Weak existing primaries re-evaluated: 110
- High-confidence replacements: 6
- Review-queue owners: 3
- Source-gap owners: 3
- Promoted owners in canonical registry: 90
- Parseable primary owners: 367
- Parsed owners: 366
- Requirement fingerprints: 366

| Check | Status | Details |
| --- | --- | --- |
| Missing-primary discovery owners partition cleanly into eligible auto-promotions and review-queue owners | passed | Discovery owners: 3<br>Eligible missing-primary auto-promotions: 0<br>Eligible weak-existing replacements: 6<br>Review-queue owners: 3 |
| Generated promotion registry matches the promotion report | passed | Promoted owners: 90 |
| Eligible high-confidence discoveries are promoted unless they remain in the review queue | passed | Eligible promoted owners verified: 6 |
| Review queue and source-gap report point at the same unresolved owners | passed | Shared unresolved owners: 3 |
| Auto-promoted owners are materialized in the canonical primary-source registry | failed | Promoted owners missing canonical primary entries: uw-seattle-biochemistry:pathway:ba-route, uw-seattle-biochemistry:pathway:bs-route, uw-seattle-chemistry:pathway:ba-route, uw-seattle-chemistry:pathway:bs-route, uw-seattle-electrical-computer-engineering:pathway:computer-architecture-pathway, uw-seattle-electrical-computer-engineering:pathway:control-systems-pathway, uw-seattle-electrical-computer-engineering:pathway:embedded-systems-pathway, uw-seattle-electrical-computer-engineering:pathway:machine-learning-pathway, uw-seattle-electrical-computer-engineering:pathway:microelectronics-and-nanotechnology-pathway, uw-seattle-electrical-computer-engineering:pathway:neurotechnology-pathway
+ actual - expected

+ [
+   'uw-seattle-biochemistry:pathway:ba-route',
+   'uw-seattle-biochemistry:pathway:bs-route',
+   'uw-seattle-chemistry:pathway:ba-route',
+   'uw-seattle-chemistry:pathway:bs-route',
+   'uw-seattle-electrical-computer-engineering:pathway:computer-architecture-pathway',
+   'uw-seattle-electrical-computer-engineering:pathway:control-systems-pathway',
+   'uw-seattle-electrical-computer-engineering:pathway:embedded-systems-pathway',
+   'uw-seattle-electrical-computer-engineering:pathway:machine-learning-pathway',
+   'uw-seattle-electrical-computer-engineering:pathway:microelectronics-and-nanotechnology-pathway',
+   'uw-seattle-electrical-computer-engineering:pathway:neurotechnology-pathway'
+ ]
- []
 |
| Canonical parseable primary owners align with parser input and parser output | failed | Parse report owner count should match the canonical parseable primary-owner count.

366 !== 367
 |
| Promoted owners appear in parser output and requirement fingerprints | failed | Promoted owners missing parsed blocks: uw-seattle-biochemistry:pathway:ba-route, uw-seattle-biochemistry:pathway:bs-route, uw-seattle-chemistry:pathway:ba-route, uw-seattle-chemistry:pathway:bs-route, uw-seattle-electrical-computer-engineering:pathway:computer-architecture-pathway, uw-seattle-electrical-computer-engineering:pathway:control-systems-pathway, uw-seattle-electrical-computer-engineering:pathway:embedded-systems-pathway, uw-seattle-electrical-computer-engineering:pathway:machine-learning-pathway, uw-seattle-electrical-computer-engineering:pathway:microelectronics-and-nanotechnology-pathway, uw-seattle-electrical-computer-engineering:pathway:neurotechnology-pathway
+ actual - expected

+ [
+   'uw-seattle-biochemistry:pathway:ba-route',
+   'uw-seattle-biochemistry:pathway:bs-route',
+   'uw-seattle-chemistry:pathway:ba-route',
+   'uw-seattle-chemistry:pathway:bs-route',
+   'uw-seattle-electrical-computer-engineering:pathway:computer-architecture-pathway',
+   'uw-seattle-electrical-computer-engineering:pathway:control-systems-pathway',
+   'uw-seattle-electrical-computer-engineering:pathway:embedded-systems-pathway',
+   'uw-seattle-electrical-computer-engineering:pathway:machine-learning-pathway',
+   'uw-seattle-electrical-computer-engineering:pathway:microelectronics-and-nanotechnology-pathway',
+   'uw-seattle-electrical-computer-engineering:pathway:neurotechnology-pathway'
+ ]
- []
 |
| Requirement fingerprint coverage stays aligned with parsed requirement owners | passed | Requirement fingerprints: 366<br>Parsed owners: 366<br>Added source fingerprints: 0<br>Added requirement fingerprints: 78 |
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

