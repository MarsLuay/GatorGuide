# Automate source updates with last-known-good safety

The official-source pipeline will run weekly and on demand, automatically accepting semantic updates only when discovery, parsing, invariants, pathway fixtures, regression tests, and planner verification all pass. Ambiguous, incomplete, conflicting, or invalid results leave the Last-Known-Good Dataset unchanged and fail visibly; valid bot pull requests may auto-merge after required checks.

