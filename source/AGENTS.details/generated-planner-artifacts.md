## Generated Planner Artifacts

Treat generated planner artifacts as outputs, not source of truth. Avoid largest generated files unless needed; they swamp AI context and search.

Do not hand-edit:

- `constants/transfer-planner-source/requirement-source-adapters.generated.ts`
- `constants/transfer-planner-source/student-runtime.generated.ts`
- `constants/transfer-planner-source/student-runtime.generated/*.generated.json`
- `constants/transfer-planner-source/course-metadata.generated.ts`
- `constants/transfer-planner-source/course-metadata.generated.data.json`
- `constants/transfer-planner-source/equivalency-guide.generated.ts`
- `constants/transfer-planner-source/source-fingerprints.generated.ts`
- `constants/transfer-planner-source/bootstrap.generated.ts`
- `constants/transfer-planner-source/grc-associate-tracks.generated.ts`
- `constants/transfer-planner-source/primary-source-promotions.generated.ts`
- `constants/transfer-planner-source/source-gaps.generated.ts`
- `constants/transfer-planner-source/requirement-diff-classifications.generated.ts`
- `constants/transfer-planner-grc-availability.generated.ts`
- `constants/transfer-equivalency-catalog.generated.ts`
- `constants/green-river-major-options.generated.ts`
- planner docs under `docs/planner/UW*_DEGREE_COURSES.md`

Edit source inputs/scripts, then regenerate:

```powershell
npm run planner:refresh
npm run planner:verify
npm run planner:full:verify
```

Useful planner reports under `.tmp/reports/`, especially:

- `.tmp/reports/transfer-planner-maintenance-summary.md`
- `.tmp/reports/transfer-planner-hardening-report.md`
- `.tmp/reports/transfer-planner-source-backed-coverage-audit.md`
- `.tmp/reports/transfer-planner-requirement-source-parse-report.md`
- `.tmp/reports/transfer-planner-primary-source-discovery.md`

