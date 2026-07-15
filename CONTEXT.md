# GatorGuide Transfer Planning

GatorGuide helps Green River College students build and maintain a source-backed plan for transferring into an undergraduate program at UW Seattle, UW Bothell, or UW Tacoma.

## Student Planning

**Living Transfer Plan**:
The student's single active, quarter-by-quarter plan from their current Green River record through transfer. It changes when their target, transcript-derived record, constraints, or progress changes.
_Avoid_: Roadmap, AI plan, graduation plan

**Active Target**:
The one UW campus and undergraduate major currently driving a student's Living Transfer Plan.
_Avoid_: Saved college, ranked college, parallel plan

**Planned Course**:
A Green River course placed into a future quarter of the Living Transfer Plan.

**Locked Course**:
A Planned Course the student has fixed to a specific quarter so recalculation cannot move it automatically.

**Transfer Horizon**:
The period ending with successful transfer readiness. It excludes scheduling the student's post-transfer UW degree.

## Official Requirements

**Official Source**:
A public Green River or UW document authorized to supply a planner fact.
_Avoid_: Reference page, supporting guess

**Source Family**:
A group of Official Sources with the same meaningful document structure and parsing behavior.

**Requirement Snapshot**:
An immutable, catalog-year-specific representation of requirements parsed from an Official Source.

**Requirement Model**:
The normalized representation of courses, choices, credit thresholds, sequences, phases, pathways, and constraints used to generate planner data.
_Avoid_: Parsed text, scraped row

**Last-Known-Good Dataset**:
The newest complete planner dataset that passed source audits, pathway fixtures, invariants, and regression tests.
_Avoid_: Fallback guess, stale scrape

**Source Conflict**:
A material disagreement between Official Sources that cannot be resolved by the accepted source-precedence rules.

## Opportunities and Time

**Relevant Opportunity**:
A scholarship or internship matched deterministically to known student attributes. Unknown attributes do not exclude an opportunity; when matching data is unavailable, all opportunities remain visible.

**Personalized Timeline**:
The student's calendar of transfer milestones, plan-derived deadlines, relevant opportunity deadlines, and optional personal deadlines.
_Avoid_: General-purpose calendar

