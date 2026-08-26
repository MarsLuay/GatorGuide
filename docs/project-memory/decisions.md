# Decisions

- Product scope is Green River-to-UW transfer planning for UW Seattle, UW Bothell, and UW Tacoma, centered on one Living Transfer Plan through transfer. College ranking, comparison, cost-calculator, saved-college, and conversational/generative-AI surfaces are outside the focused product direction.
- Official requirements are normalized through reusable Source Family adapters into one Requirement Model before planner generation, rather than expanding a universal parser with per-major exceptions.
- Source updates run weekly and on demand with last-known-good safety. Ambiguous, incomplete, conflicting, or invalid results must fail visibly and leave the last-known-good dataset unchanged.
- Changed English interface copy is translated during development with placeholder protection, an academic glossary, explicit overrides, and risk-based review; the app ships static translations.
