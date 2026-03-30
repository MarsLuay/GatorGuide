# GRC Transfer Outline Generator Spec

This doc captures the broader product idea for a Green River College transfer-planning system that goes beyond simple prerequisite checklists.

It is a companion to:

- [GRC_UW_ENGINEERING_TRANSFER_PLANNER.md](./GRC_UW_ENGINEERING_TRANSFER_PLANNER.md)

That engineering doc is the deep-dive on UW Seattle engineering admissions and equivalencies.

This doc is the higher-level product / data / implementation spec for the full feature set you described.

## Product Vision

Build a Green River-first transfer planning system that:

- identifies the best Green River associate track for a student's intended destination major
- prefers Green River courses over UW courses whenever the Green River class still transfers cleanly
- preserves financial-aid-friendly enrollment by keeping students inside a valid Green River track as long as possible
- nudges students toward leadership, involvement, and project work at Green River
- supports engineering first, then expands to other majors later

The core idea is:

- not just "what do I need to apply?"
- but "what is the smartest low-cost path through Green River that still transfers well into the final UW degree?"

## Main Feature Pillars

### 1. Best Track Matcher

Given:

- target campus
- target major
- current Green River progress
- completed courses
- start year / catalog year

The system should:

- find the best Green River transfer track
- show why that track is best
- show how much of the destination degree can still be taken at Green River
- flag any major-specific holes that require extra planning

### 2. Transfer Outline Generator

The system should generate a term-by-term outline that shows:

- courses required to apply
- courses required before enrollment
- additional courses that are still cheaper / easier to take at Green River and still transfer
- courses that count toward the chosen Green River associate track
- courses that are off-track and may create financial aid risk

### 3. Leadership + Involvement Prompts

The planner should push students toward involvement at Green River, especially for transfer applications.

Current official Green River sources already support this idea:

- MESA:
  - https://www.greenriver.edu/students/mesa.html
- Clubs and organizations:
  - https://www.greenriver.edu/students/get-involved/clubs-and-organizations.html
- Student leadership:
  - https://www.greenriver.edu/students/get-involved/student-leadership-application.html

Planner idea:

- if student is STEM / engineering track, push MESA first
- then show relevant clubs, leadership roles, and faculty-connected opportunities

### 4. Project Suggestions

The planner should also suggest project ideas by major.

Two layers would work well:

- hardcoded Green River-first suggestions
- optional AI-generated personalized alternatives

Recommendation:

- do not depend on AI for the base experience
- keep a curated project bank first
- use AI only to personalize or extend that bank later

## Engineering First, Others Later

Recommended release order:

### Phase 1

- Green River -> UW Seattle
- engineering majors
- HCDE

### Phase 2

- Green River -> UW Bothell
- Green River -> UW Tacoma
- engineering / computing / biology-adjacent majors where solid planning worksheets already exist

### Phase 3

- non-engineering majors
- biology
- computer science
- software-adjacent programs
- pre-health and other high-demand transfer pathways

## Official Data Sources Found

## Green River

- Class schedules and catalog:
  - https://www.greenriver.edu/students/academics/class-schedules-catalog/index.html
- Catalog archive:
  - https://www.greenriver.edu/students/academics/class-schedules-catalog/catalog-archive.html
- 2025-2026 annual schedule:
  - available from the class schedules and catalog page
- 2024-2025 annual schedule:
  - available from the class schedules and catalog page
- Green River engineering overview:
  - https://www.greenriver.edu/students/academics/degrees-programs/engineering.html

Current Green River engineering program-map style pages found:

- Civil / Mechanical engineering track
- Computer / Electrical engineering track
- Bioengineering / Chemical engineering track

These pages are useful for:

- track names
- current credit totals
- public-facing program descriptions

The sample-plan PDF remains the best single concise source for the term-by-term sequence:

- https://www.greenriver.edu/marketing/media/documents/grad-to-gator/Associate%20Transfer%20Sample%20Ed%20Plans%202024.pdf

## UW Seattle

- Seattle equivalency guide for Green River:
  - https://admit.washington.edu/apply/transfer/equivalency-guide/green-river/
- MyPlan transfer planner:
  - https://depts.washington.edu/myplan/transfer/
- DARS / degree audits:
  - https://www.washington.edu/students/reg/dars/

Important note:

- I found official MyPlan transfer-planning and DARS pages.
- I did not find a documented public API for MyPlan or DARS that should be treated as stable for product ingestion.

Recommendation:

- do not build this feature around a presumed MyPlan API
- instead, use curated course / requirement data

## UW Bothell

- Bothell course equivalency guide hub:
  - https://www.uwb.edu/registrar/policies/community-college-course-equivalency-guide
- Green River page inside the Bothell equivalency guide:
  - https://www.uwb.edu/registrar/policies/community-college-course-equivalency-guide/green-river-college
- Bothell major planning worksheets:
  - https://www.uwb.edu/admissions/apply/major-planning-worksheets
- Bothell STEM transfer guidance:
  - https://www.uwb.edu/stem/undergraduate/resources/stem-transfer-courses

Important Bothell note:

- UW Bothell's STEM transfer page explicitly says students should check the UW Seattle equivalency guide first, then the UW Bothell guide if needed.

That makes Bothell planning feasible.

## UW Tacoma

- Tacoma transfer admission requirements:
  - https://www.tacoma.uw.edu/admissions/transfer-admission
- Tacoma course equivalency guide:
  - https://www.tacoma.uw.edu/admissions/course-equivalency-guide
- Tacoma transfer planning worksheet hub:
  - https://www.tacoma.uw.edu/admissions/planning-your-transfer
- Tacoma majors and degrees:
  - https://www.tacoma.uw.edu/admissions/majors-degrees

Important Tacoma note:

- UW Tacoma's course equivalency guide currently says its Tacoma-specific guides are under maintenance.
- It tells students to use the UW equivalency guide and then confirm with the intended academic program.

That means Tacoma is possible, but it needs more human review than Seattle or Bothell.

## Key Planning Constraint: Financial Aid

This is one of the most important ideas in the whole feature.

The system should not simply return:

- "all classes that would be useful somewhere"

It should return:

- "the best sequence that still keeps the student inside a valid Green River associate track whenever possible"

Why:

- financial aid gets harder when students are taking lots of classes that do not belong to their declared Green River pathway
- advisors need something that is both academically smart and administratively realistic

So the core optimization problem is:

- maximize destination-major utility
- while staying inside a valid Green River associate path

## Core Matching Logic

Recommended algorithm:

1. Student picks:
   - destination campus
   - destination major
   - intended transfer year
   - completed Green River courses
2. Load:
   - destination major full degree requirements
   - destination major transfer / admission requirements
   - Green River course inventory for the correct year
   - Green River associate track templates for the correct year
   - campus-specific equivalency table
3. For each valid Green River associate track:
   - compute how many destination-major prerequisite courses it satisfies
   - compute how many destination-major graduation courses it satisfies
   - compute how many extra off-track classes are needed
   - compute a financial-aid safety score
4. Pick:
   - best-fit track
   - best-fit custom add-ons
5. Output:
   - required-to-apply plan
   - recommended-stay-at-GRC-longer plan
   - transfer-ready earliest point
   - confidence / advisor review flags

## What "Best" Should Mean

The winning track should not be chosen only by prerequisite coverage.

It should balance:

- application prerequisite coverage
- total graduation-course coverage
- Green River track validity
- likely lower total cost
- likely easier lower-division coursework at Green River
- advisor sanity / ease of explanation

Suggested score dimensions:

- `prereqCoverageScore`
- `graduationCoverageScore`
- `aidTrackFitScore`
- `equivalencyConfidenceScore`
- `timeToTransferScore`
- `advisorSimplicityScore`

## Initial Hardcoded Mapping: Engineering First

These are the strongest current hardcoded mappings from the research so far.

### Green River -> UW Seattle

| UW Seattle major | Best Green River base |
| --- | --- |
| Aeronautics & Astronautics | `AST2/MRP Civil and Mechanical Engineering` |
| Civil Engineering | `AST2/MRP Civil and Mechanical Engineering` |
| Industrial & Systems Engineering | `AST2/MRP Civil and Mechanical Engineering` |
| Mechanical Engineering | `AST2/MRP Civil and Mechanical Engineering` |
| Materials Science & Engineering | `AST2/MRP Civil and Mechanical Engineering` plus materials add-ons |
| Computer Engineering | `AST2/MRP Computer and Electrical Engineering` |
| Electrical & Computer Engineering | `AST2/MRP Computer and Electrical Engineering` |
| Chemical Engineering | custom ChemE template based on `AST2 Bioengineering and Chemical Engineering` |
| Bioengineering | custom BioE template based on `AST2 Bioengineering and Chemical Engineering` |
| HCDE | custom template |

### Green River -> UW Bothell

High-confidence likely matches:

| UW Bothell major | Likely best Green River base | Confidence |
| --- | --- | --- |
| Computer Engineering | `AST2/MRP Computer and Electrical Engineering` | high |
| Electrical Engineering | `AST2/MRP Computer and Electrical Engineering` | high |
| Mechanical Engineering | `AST2/MRP Civil and Mechanical Engineering` | high |
| Biology | likely `AST1` or biology-focused track | medium / manual confirm |
| CSSE | likely `Associate in Computer Science` or `AST2` depending worksheet fit | medium / manual confirm |

### Green River -> UW Tacoma

High-confidence likely matches:

| UW Tacoma major | Likely best Green River base | Confidence |
| --- | --- | --- |
| Computer Engineering | `AST2/MRP Computer and Electrical Engineering` | high |
| Electrical Engineering | `AST2/MRP Computer and Electrical Engineering` | high |
| Mechanical Engineering | `AST2/MRP Civil and Mechanical Engineering` | high |
| Civil Engineering | `AST2/MRP Civil and Mechanical Engineering` | high |
| Computer Science & Systems | likely `Associate in Computer Science` or `AST2` | medium / manual confirm |
| Biomedical Sciences | likely `AST1` or biology-heavy custom path | medium / manual confirm |

## Important Campus Availability Rule

Not every campus offers every major in the same form.

Examples:

- UW Seattle has Computer Engineering and ECE through the Allen School / ECE / College of Engineering system.
- UW Bothell has `CSSE` instead of a Seattle-style standalone CS major.
- UW Tacoma has `Computer Science & Systems` instead of the Seattle Allen School transfer model.
- Tacoma and Bothell may use different course prefixes and prerequisite structures than Seattle.

So the planner must always start with:

- destination campus first
- destination program second

## Full Degree Requirements vs Transfer Prerequisites

This feature needs both datasets.

### Transfer prerequisites dataset

This answers:

- what do I need to apply?
- what must be done before enrolling?

### Full degree requirements dataset

This answers:

- which additional lower-division or early major classes should I still take at Green River because they transfer and save money?

This second dataset is what makes the planner financially and strategically useful.

## Data Model Recommendation

```ts
type TransferCampus = 'uw-seattle' | 'uw-bothell' | 'uw-tacoma';

type CatalogYear = '2024-2025' | '2025-2026' | '2026-2027';

type DestinationMajor = {
  id: string;
  campus: TransferCampus;
  title: string;
  availabilityStatus: 'confirmed' | 'manual-review';
  sourceUrls: string[];
  applicationRequirements: PlannerRequirement[];
  enrollmentRequirements: PlannerRequirement[];
  degreeRequirements: PlannerRequirement[];
  notes: string[];
};

type PlannerRequirement = {
  label: string;
  courseOptions: string[];
  minimumCount: number;
  tags: string[];
};

type GrcTrack = {
  id: string;
  catalogYear: CatalogYear;
  title: string;
  degreeType: string;
  terms: {
    label: string;
    courses: string[];
  }[];
  allCourses: string[];
  notes: string[];
};

type CourseEquivalency = {
  catalogYear: CatalogYear;
  campus: TransferCampus;
  grcCourse: string;
  destinationCourseOptions: string[];
  confidence: 'high' | 'medium' | 'manual-review';
  sourceUrl: string;
};

type TrackRecommendation = {
  campus: TransferCampus;
  destinationMajorId: string;
  recommendedTrackId: string | null;
  confidence: 'high' | 'medium' | 'manual-review';
  requiredAddOns: string[];
  rationale: string[];
};
```

## Leadership / Involvement Data Model

The planner should also support a small Green River opportunity bank:

```ts
type InvolvementOpportunity = {
  id: string;
  source: 'grc';
  title: string;
  type: 'club' | 'leadership' | 'academic-support' | 'project' | 'research' | 'internship-prep';
  targetMajors: string[];
  targetTags: string[];
  url: string;
  summary: string;
  priority: number;
};
```

Good initial hardcoded entries:

- MESA
- Student clubs and organizations
- Aerospace Club
- Student Leadership Program

## Projects Feature Recommendation

There are two separate project concepts here:

### 1. Current official Green River opportunities

I found strong official sources for:

- MESA
- clubs
- student leadership

I did not find a clean, centralized public Green River page for:

- engineering faculty project listings
- STEM project bank
- student research matching board

Recommendation:

- treat "current GRC projects" as a manually curated advisor / faculty list
- do not wait for a public API or public directory that may not exist

### 2. Personalized suggested projects

This can come later and can use AI.

Good input fields:

- target major
- campus
- completed coursework
- clubs / involvement
- interests
- research / industry preference
- portfolio goal

Good outputs:

- Green River-first project suggestions
- portfolio project ideas
- club leadership ideas
- project ladder:
  - beginner
  - application-strengthening
  - transfer-portfolio-ready

## Human-Curated Data Still Needed

This is the section the team can use as the manual collection checklist.

### Must collect manually or semi-manually

- every single Green River associate track and all required classes for each year
- every destination major's full lower-division and upper-division degree requirement list
- year-specific changes in major requirements
- campus-specific degree availability by year
- advisor-approved "worth staying at GRC for this class" flags
- current Green River faculty / club / project opportunities that are not centrally published

### Especially important manual data

- 2025-2026 Green River associate-track requirements
- 2024-2025 Green River associate-track requirements
- quarter-by-quarter Green River course offering history by year so the planner can later stop suggesting classes in terms when Green River does not actually run them
- UW Seattle engineering degree requirement maps by major
- UW Bothell major planning worksheet prerequisite details by major
- UW Tacoma planning worksheet prerequisite details by major
- Tacoma-specific major review notes wherever the Tacoma equivalency guide is incomplete

## What I Could Not Confirm Fully From Public Sources

These should be explicitly tracked in the spec so nobody assumes they are already solved:

- a stable public API for MyPlan or DARS
- a centralized public Green River engineering project inventory
- fully structured campus-by-campus equivalency data for every UW Bothell / Tacoma major
- a single official machine-readable source for every full degree requirement across all UW campuses

Recommendation:

- mark these as `manual-review` in the dataset until the team has advisor-approved data

## Recommended Implementation Path

### Step 1

Build a static, advisor-reviewed engineering dataset for:

- Green River
- UW Seattle

### Step 2

Add Bothell and Tacoma engineering / computing using:

- Bothell major planning worksheets
- Tacoma transfer planning worksheets
- existing equivalency guides
- manual validation for edge cases

### Step 3

Add the best-track matching engine and the financial-aid-aware scoring model.

### Step 4

Add leadership / involvement prompts using hardcoded Green River opportunities.

### Step 5

Add curated project banks, then optional AI personalization later.

## Recommended UI Shape

A good UX for this feature would likely be:

1. Pick your target:
   - campus
   - major
2. Review best Green River path:
   - recommended associate track
   - confidence
   - why this is the best fit
3. See your plan:
   - courses required to apply
   - courses worth taking before transfer
   - Green River-only savings opportunities
4. Strengthen your application:
   - MESA
   - clubs
   - leadership
   - project suggestions

## Bottom Line

This feature should be built as a year-versioned, advisor-reviewed planning system with:

- campus-specific equivalencies
- full degree requirement maps
- best-track matching
- Green River financial-aid-aware logic
- hardcoded involvement and project guidance

And the safest rollout is still:

- engineering first
- Seattle first
- then Bothell / Tacoma
- then other majors
