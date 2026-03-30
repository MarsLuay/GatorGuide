# GRC -> UW Engineering Transfer Planner

This doc is a research and product-planning note for a Green River College to University of Washington engineering course planner / roadmap feature.

Stakeholder context:

- Request came from Lady Ivory, STEM advisor at Green River College.
- Target audience is Green River students on the STEM / engineering transfer pathway.
- Scope is intentionally narrow for v1: Green River College -> UW Seattle engineering-related transfer planning.

## Why This Should Exist

The current app can show colleges, costs, opportunities, and general roadmaps, but it does not yet answer the most advisor-heavy question for engineering transfers:

- "What exact classes should I take at Green River before I transfer to UW?"

For this use case, the app needs something more specific than general college data:

- exact UW major admission requirements
- exact Green River equivalents
- Green River sample degree templates
- deadline-specific planning rules
- major-specific exceptions, especially for spring-start cohort majors like ChemE and BioE

## Official Source Set

Use these as the source of truth before changing planner logic:

- Green River sample transfer plans PDF:
  - https://www.greenriver.edu/marketing/media/documents/grad-to-gator/Associate%20Transfer%20Sample%20Ed%20Plans%202024.pdf
- UW Green River equivalency guide:
  - https://admit.washington.edu/apply/transfer/equivalency-guide/green-river/
- UW College of Engineering prerequisites by major:
  - https://www.engr.washington.edu/admission/department/prereqs-by-major
- UW HCDE admissions:
  - https://www.hcde.washington.edu/bs/admissions/
- UW Aeronautics & Astronautics:
  - https://www.aa.washington.edu/admissions/undergrad/overview
- UW Bioengineering admissions:
  - https://bioe.uw.edu/academic-programs/undergraduate/undergraduate-admissions/
- UW Chemical Engineering admissions:
  - https://www.cheme.washington.edu/undergraduate_students/admission
- UW Civil Engineering prerequisites:
  - https://www.ce.washington.edu/future/undergrad/prereq
- UW Environmental Engineering prerequisites:
  - https://www.ce.washington.edu/future/undergrad/environmental/prereq
- UW Computer Science / Computer Engineering transfer admissions:
  - https://www.cs.washington.edu/academics/undergraduate/admissions/transfers/
- UW Electrical & Computer Engineering admissions:
  - https://www.ece.uw.edu/academics/bachelor-of-science/bs-admissions-requirements/
- UW Industrial & Systems Engineering admissions:
  - https://ise.washington.edu/admissions/BSIE/req_procedure
- UW Materials Science & Engineering admissions:
  - https://mse.washington.edu/admission/undergraduate
- UW Mechanical Engineering admissions:
  - https://www.me.washington.edu/bsme/admissions

## Important Scope Notes

- This planner should be treated as advisor-reviewed planning guidance, not as an automatic replacement for departmental advising.
- UW majors can change application timing, prerequisite policy, or equivalency treatment from year to year.
- The planner should store both:
  - application requirements
  - enrollment / continuation requirements
- A major can be "planner compatible" even if a student still needs advisor review for one or two edge-case courses.

## What The Data Team Covers Today

Today, the Data Team pipeline is not built for this problem.

Current repo evidence:

- `Data Team/docs/PIPELINE_OVERVIEW.md` says the pipeline currently pulls from the College Scorecard API.
- `Data Team/README.md` also points to `DataScrape/` as College Scorecard ETL.

That means the existing pipeline is good for:

- college metadata
- rates, size, costs, location, and general institution info

It is not yet a natural home for:

- department-level transfer rules
- Green River to UW course equivalencies
- term-by-term transfer roadmaps
- advisor-maintained exceptions and overrides

Recommendation:

- Build this planner as a curated dataset owned by Mobile first.
- If it proves valuable, move it into a separate structured pipeline later.

## Green River Degree Templates To Support

These are the Green River sample transfer degree paths that matter most for a GRC -> UW engineering planner.

### 999B - Associate in Science, Transfer Track 2

Intended use in the GRC PDF:

- engineering
- computer science
- physics
- atmospheric science

Core sample sequence from the GRC PDF:

| Term | Courses |
| --- | --- |
| Year 1 Fall | `ENGL& 101`, `MATH& 151`, `ENGR 100` |
| Year 1 Winter | `CHEM& 161`, `MATH& 152`, `ENGR 106` |
| Year 1 Spring | `CHEM& 162`, `MATH& 153`, `Humanities` |
| Year 2 Fall | `PHYS& 221`, `MATH& 254`, `ENGR& 214` |
| Year 2 Winter | `PHYS& 222`, `MATH 238`, `ENGR& 215` |
| Year 2 Spring | `PHYS& 223`, `MATH 240`, `Social Science` |
| Extra note | `CS 120` or `ENGR 120` appears as an added course in the sample |

### 999Q - Associate in Science, Transfer Track 2, MRP

Intended use in the GRC PDF:

- mechanical engineering
- civil engineering
- aeronautical / astronautical engineering
- industrial engineering
- materials science

The GRC PDF shows `999Q` as the `999B` engineering base plus a third-year extension:

| Term | Courses |
| --- | --- |
| Year 3 Fall | `ENGR& 225`, `SELECT COURSE FROM LIST` |
| Year 3 Winter | `Humanities or Social Science`, `SELECT COURSE FROM LIST` |

Important planner note:

- `999Q` is a good base, but several UW majors still need targeted add-ons such as programming, `ENGR 140`, `ENGR& 224`, or `ENGR 250`.

### 999O - Associate in Science, Transfer Track 2, MRP

Intended use in the GRC PDF:

- biological pre-engineering
- chemical pre-engineering

Sample sequence from the GRC PDF:

| Term | Courses |
| --- | --- |
| Year 1 Fall | `ENGL& 101`, `MATH& 151`, `CHEM& 161` (or `CHEM& 140` if required) |
| Year 1 Winter | `ENGR 100`, `MATH& 152`, `CHEM& 162`, plus a humanities or social science course |
| Year 1 Spring | `MATH& 153`, `CHEM& 163` |
| Year 2 Fall | `PHYS& 221` (or `PHYS& 114` if required), `MATH& 254`, `CHEM& 261` |
| Year 2 Winter | `PHYS& 222`, `MATH 238`, `BIOL& 260` or `CHEM& 262` |
| Year 2 Spring | `PHYS& 223`, `Humanities or Social Science`, `SELECT COURSE FROM LIST` |
| Year 3 Fall | `SELECT COURSE FROM LIST`, `SELECT COURSE FROM LIST` |

Important planner note:

- `999O` is not a perfect one-click match for current UW BioE or ChemE requirements.
- BioE now needs biology and programming-specific prep that the stock `999O` sample does not fully cover.
- ChemE has a spring-start cohort and January application cycle, so it needs its own special planning template.

### 999P - Associate in Science, Transfer Track 2, MRP

Intended use in the GRC PDF:

- computer engineering
- electrical engineering / electrical and computer engineering

Sample sequence from the GRC PDF:

| Term | Courses |
| --- | --- |
| Year 1 Fall | `ENGL& 101`, `MATH& 151`, `ENGR 100` |
| Year 1 Winter | `CHEM& 161`, `MATH& 152`, `Humanities` |
| Year 1 Spring | `CS 121`, `MATH& 153`, `Social Science`, `ENGR 106` |
| Year 2 Fall | `PHYS& 221`, `MATH& 254`, `CS 122` |
| Year 2 Winter | `PHYS& 222`, `MATH 238`, `CS 123` |
| Year 2 Spring | `PHYS& 223`, `ENGR& 204`, `Humanities or Social Science` |
| Year 3 Fall | `SELECT COURSE FROM LIST`, `SELECT COURSE FROM LIST` |

Important planner note:

- `999P` is the cleanest stock GRC template for UW Computer Engineering and UW ECE.

## Special Case: UW ChemE Already Publishes A Green River Plan

UW Chemical Engineering has its own Green River sample transfer plan on the department admissions page.

Official ChemE notes that matter:

- ChemE transfer admission is built around a `January 15` department deadline.
- The ChemE cohort starts in `spring quarter`, not autumn.
- Students must reach ChemE-ready coursework before spring start.

The UW ChemE page shows a Green River sample plan that includes, by the end of the GRC plan:

- `CHEM& 161`, `CHEM& 162`, `CHEM& 163`
- `MATH& 151`, `MATH& 152`, `MATH& 153`
- `PHYS& 221`, `PHYS& 222`, `PHYS& 223`
- `MATH 238`
- `CHEM& 261`, `CHEM& 262`
- `ENGR 250`
- `MATH& 254`
- and a spring start at UW for `CHEM E 310` and `CHEM E 375`

Planner implication:

- ChemE should be its own planner template, not just "use 999O."

## High-Value GRC -> UW Course Equivalencies

These are the equivalencies that matter most for an engineering planner.

| UW course / requirement | Best Green River equivalent | Notes |
| --- | --- | --- |
| English Composition / `ENGL 131` | `ENGL& 101` | Clean composition match from the UW equivalency guide. |
| `MATH 124` | `MATH& 151` | Calculus I. |
| `MATH 125` | `MATH& 152` | Calculus II. |
| `MATH 126` | `MATH& 163` | Current direct equivalency effective AUT 2024. This is the cleanest current path. |
| `MATH 126` older route | `MATH& 153` plus later math review | Older GRC sample plans still show `MATH& 153`; do not assume it is the cleanest current path without checking the guide. |
| `MATH 224` | `MATH& 254` | Advanced multivariable / vector calculus equivalency. |
| `MATH 207` | `MATH 238` | Differential equations. |
| `MATH 208` | `MATH 240` | Linear algebra / matrix algebra. |
| `QMETH 201` | `MATH 256` | Useful for HCDE stats options. |
| `STAT 220` | `MATH& 146` | Another useful HCDE stats option. |
| `CHEM 142` | `CHEM& 161` | First UW chemistry requirement. |
| `CHEM 152` and `CHEM 162` | `CHEM& 162` and `CHEM& 163` together | The equivalency guide maps the GRC pair into UW's second and third general chemistry quarters. |
| `CHEM 237` | `CHEM& 261` | Organic chemistry I. |
| `CHEM 238` | `CHEM& 262` | Organic chemistry II. |
| `PHYS 121` | `PHYS& 221` | Calculus-based mechanics. |
| `PHYS 122` | `PHYS& 222` | Calculus-based electromagnetism. |
| `PHYS 123` | `PHYS& 223` | Calculus-based waves. |
| `A A 210` | `ENGR& 214` | Statics. |
| `M E 230` | `ENGR& 215` | Dynamics. |
| `CEE 220` | `ENGR& 225` | Mechanics of materials. |
| `A A 260` | `ENGR& 224` | Thermodynamics. |
| `E E 215` | `ENGR& 204` | Circuit analysis. |
| `AMATH 301` | `ENGR 250` | Scientific computing. |
| `MSE 170` | `ENGR 140` | Important for MSE planning. |
| `CSE 121` | `CS 121` | Direct modern intro sequence match. |
| `CSE 122` | `CS 122` | Direct modern intro sequence match. |
| `CSE 123` | `CS 123` | Direct modern intro sequence match. |
| `BIOL 180`, `BIOL 200`, `BIOL 220` | `BIOL& 211`, `BIOL& 212`, `BIOL& 213` together | The guide gives the cleanest mapping when the full GRC sequence is completed. |

## Biggest Planning Insight

The GRC degree templates are useful, but they do not perfectly match every current UW engineering major.

That means the planner should not be:

- "pick one GRC degree and trust that it solves everything"

It should be:

- "pick a UW target major"
- "attach the best Green River base template"
- "append the exact missing GRC add-on courses"
- "track deadline-sensitive application requirements separately from enrollment requirements"

That model will be much more accurate for real advising.

## UW Major-By-Major Transfer Requirements

Use the equivalency table above to translate UW course numbers into Green River courses.

### Aeronautics & Astronautics (A&A)

Official page:

- https://www.aa.washington.edu/admissions/undergrad/overview

Application timing:

- UW autumn transfer timeline
- department application deadline: `April 5`

Complete by application deadline:

- `MATH 124`, `MATH 125`, `MATH 126`
- `CHEM 142`
- `PHYS 121`, `PHYS 122`
- `A A 210`
- English composition

Complete by autumn enrollment:

- `MATH 207`
- `MATH 208`
- `MATH 224`
- `PHYS 123`
- `CEE 220`
- `M E 230`
- `A A 260`
- `AMATH 301`

Department note:

- The A&A page marks `MATH 224` and `AMATH 301` as the pair where one may be taken during the first autumn if needed.

Best Green River base:

- `999Q`

Common Green River add-ons:

- use the `SELECT COURSE FROM LIST` slots for `ENGR& 224` and `ENGR 250` when possible

### Bioengineering (BioE)

Official page:

- https://bioe.uw.edu/academic-programs/undergraduate/undergraduate-admissions/

Application timing:

- UW application by `December 15`
- BioE department application by `January 15`
- BioE core starts in `spring quarter`

Complete for transfer application:

- `MATH 124`, `MATH 125`, `MATH 126`
- `CHEM 142`, `CHEM 152`, `CHEM 162`
- `PHYS 121`, `PHYS 122`
- `BIOL 180`
- `CHEM 223` or `CHEM 237`
- `AMATH 301` or `CSE 12X + BIOEN 217` or `CSE 160 + BIOEN 217`
- English composition

Additional BioE context:

- The admissions page also references `BIOL 200` in major-ready guidance and recommends `BIOEN 215`.

Best Green River base:

- custom plan built from `999O`, not `999O` by itself

Why custom:

- the stock `999O` sample is chemistry-heavy but does not automatically cover the biology plus programming combination BioE now expects

Most likely Green River add-ons:

- full biology sequence if the student wants the clean `BIOL 180` pathway
- `CS 121` / `CS 122` / `CS 123` or `ENGR 250`
- organic chemistry sequence as needed

### Chemical Engineering (ChemE)

Official page:

- https://www.cheme.washington.edu/undergraduate_students/admission

Application timing:

- UW application by `December 15`
- ChemE department application by `January 15`
- ChemE cohort starts in `spring quarter`

Complete before application:

- `CHEM 142`, `CHEM 152`
- `MATH 124`, `MATH 125`, `MATH 126`
- `PHYS 121`
- English composition

Complete before spring start:

- `CHEM 162`
- `PHYS 122`
- `MATH 207`

Complete before the following autumn:

- `CHEM 237`, `CHEM 238` or department-approved organic alternatives
- `PHYS 123`
- `MATH 208`
- `CHEM E 310` and `CHEM E 375` at UW during the spring immediately after admission

Best Green River base:

- custom ChemE planner template

Why custom:

- ChemE is the clearest example of a major that does not fit a generic autumn-transfer engineering roadmap

Green River-friendly mapping:

- `CHEM& 161`
- `CHEM& 162` and `CHEM& 163`
- `PHYS& 221`, `PHYS& 222`, `PHYS& 223`
- `MATH& 151`, `MATH& 152`, `MATH& 163` or advisor-reviewed equivalent
- `MATH 238`
- `MATH 240`
- `CHEM& 261`, `CHEM& 262`
- `ENGR 250`

### Civil Engineering (BSCE)

Official page:

- https://www.ce.washington.edu/future/undergrad/prereq

Application timing:

- UW autumn transfer timeline
- engineering department application by `April 5`

Complete by application deadline:

- `MATH 124`, `MATH 125`, `MATH 126`
- `CHEM 142`
- `PHYS 121`, `PHYS 122`
- `A A 210`
- English composition

Complete by autumn enrollment:

- one computing course from:
  - `AMATH 301`
  - `CSE 121`, `CSE 122`, or `CSE 123`
  - `CSE 142`
  - `CSE 160`
- `CEE 220`
- `M E 230`
- `MATH 208` or `AMATH 352`

Strongly recommended before enrollment:

- `CHEM 152`
- `PHYS 123`

Best Green River base:

- `999Q`

Planner caveat:

- the stock `999Q` plan needs a computing add-on

### Computer Engineering (CompE)

Official page:

- https://www.cs.washington.edu/academics/undergraduate/admissions/transfers/

Application timing:

- spring or autumn transfer cycle
- department deadline is `January 15` for spring, `April 5` for autumn

Minimum prerequisites:

- `MATH 124`, `MATH 125`, `MATH 126`
- `CSE 143` or `CSE 123`
- five credits of English composition
- `PHYS 121`

Important Allen School notes:

- Allen prefers Java-based intro programming preparation
- applicants can request one prerequisite exception if the final course is in progress and all other rules are met

Best Green River base:

- `999P`

Clean Green River mapping:

- `CS 121`, `CS 122`, `CS 123`
- `MATH& 151`, `MATH& 152`, `MATH& 163`
- `PHYS& 221`
- `ENGL& 101`

### Electrical & Computer Engineering (ECE)

Official page:

- https://www.ece.uw.edu/academics/bachelor-of-science/bs-admissions-requirements/

Application timing:

- UW autumn transfer timeline
- ECE department application by `April 5`

Complete by application deadline:

- `MATH 124`, `MATH 125`, `MATH 126`
- `CSE 122` or `CSE 123` or `CSE 142` or `CSE 143`
- `PHYS 121`, `PHYS 122`
- English composition

Complete by autumn enrollment:

- `CSE 123` or `CSE 143`
- `MATH 207` or `AMATH 351`
- two of:
  - `BIOL 130`
  - `BIOL 220`
  - `CHEM 142`
  - `MATH 208`
  - `MATH 224`
  - `PHYS 123`

Best Green River base:

- `999P`

Why it fits well:

- `999P` already lines up with the CSE sequence, differential equations, advanced math, physics sequence, and circuit prep

### Environmental Engineering (BSENVE)

Official page:

- https://www.ce.washington.edu/future/undergrad/environmental/prereq

Application timing:

- UW autumn transfer timeline
- engineering department application by `April 5`

Complete by application deadline:

- `MATH 124`, `MATH 125`, `MATH 126`
- `CHEM 142`, `CHEM 152`
- `PHYS 121`, `PHYS 122`
- `A A 210`
- English composition

Complete by autumn enrollment:

- `MATH 207` or `AMATH 351`
- `BIOL 180`
- one computing course from the standard engineering list
- `A A 260`

Best Green River base:

- custom hybrid plan, usually starting from `999O` or `999Q`

Why custom:

- BSENVE needs biology and thermodynamics together, which no stock GRC MRP template covers cleanly on its own

### Human Centered Design & Engineering (HCDE)

Official page:

- https://www.hcde.washington.edu/bs/admissions/

Application timing:

- UW autumn transfer timeline
- engineering department application by `April 5`

Complete by application deadline:

- ten credits from `MATH 124`, `MATH 125`, `MATH 126`
- one programming course from `CSE 121`, `CSE 122`, `CSE 123`, `CSE 142`, `CSE 160`
- one statistics course from the approved list, including `STAT 220` and `QMETH 201`
- three science courses from the approved list, including chemistry, physics, and biology options
- English composition

Important HCDE note:

- for students applying to start in autumn 2026 or later, HCDE explicitly removed precalculus, algebra-based physics, and biopsychology from the admission prerequisite list

Best Green River base:

- custom HCDE planner template

Green River-friendly strategy:

- calculus via `MATH& 151`, `152`, `163`
- programming via `CS 121` and/or `CS 122`
- stats via `MATH& 146` or `MATH 256`
- sciences via `CHEM& 161`, `PHYS& 221`, `PHYS& 222` or biology sequence as needed

### Industrial & Systems Engineering (ISE)

Official page:

- https://ise.washington.edu/admissions/BSIE/req_procedure

Application timing:

- UW autumn transfer timeline
- ISE department application by `April 5`

Complete by application deadline:

- `MATH 124`, `MATH 125`, `MATH 126`
- `CHEM 142`
- `PHYS 121`, `PHYS 122`
- `A A 210`
- English composition

Complete by autumn enrollment:

- `CHEM 152`
- `PHYS 123`
- `CEE 220` or `M E 230`

Strongly recommended for competitiveness:

- `CSE 122` or `CSE 142`
- `MATH 207`
- `MATH 208`

Best Green River base:

- `999Q`

Planner caveat:

- add programming and linear algebra explicitly

### Materials Science & Engineering (MSE)

Official page:

- https://mse.washington.edu/admission/undergraduate

Application timing:

- UW autumn transfer timeline
- MSE department application by `April 5`

Complete by application deadline:

- `MATH 124`, `MATH 125`, `MATH 126`
- `CHEM 142`, `CHEM 152`
- `PHYS 121`, `PHYS 122`
- English composition

Complete by autumn enrollment:

- `MATH 207`
- `MSE 170`
- one programming course:
  - `AMATH 301`
  - `CSE 142`
  - `CSE 122`

Strongly encouraged before enrollment:

- `A A 210`
- `CEE 220`
- `PHYS 123`
- `MATH 208`
- `CHEM 162`

Best Green River base:

- `999Q` plus targeted add-ons

Critical add-ons at Green River:

- `ENGR 140` for `MSE 170`
- `ENGR 250` or `CS 122`
- `CHEM& 163`
- `MATH 240`

### Mechanical Engineering (ME)

Official page:

- https://www.me.washington.edu/bsme/admissions

Application timing:

- UW autumn transfer timeline
- department application by `April 5`

Complete by application deadline:

- English composition
- `MATH 124`, `MATH 125`, `MATH 126`
- `PHYS 121`, `PHYS 122`
- `CHEM 142`
- `A A 210`

Complete by autumn enrollment:

- `CHEM 152`
- `CEE 220`
- `M E 230`
- `PHYS 123`

Strongly encouraged before enrollment:

- `MATH 207`
- `MATH 208`

Best Green River base:

- `999Q`

Planner caveat:

- add second-quarter chemistry and linear algebra explicitly if the student wants the cleanest ME launch

## Best-Fit Summary

| UW major | Best Green River starting template | Planner note |
| --- | --- | --- |
| A&A | `999Q` | Add `ENGR& 224` and ideally `ENGR 250` if possible. |
| BioE | custom off `999O` | Needs biology + programming logic beyond stock `999O`. |
| ChemE | custom ChemE template | Spring-start cohort with Jan 15 deadline. |
| Civil | `999Q` | Add computing requirement. |
| CompE | `999P` | Cleanest current fit. |
| ECE | `999P` | Cleanest current fit. |
| EnvE | custom hybrid | Needs biology + thermodynamics. |
| HCDE | custom HCDE template | Needs programming + stats + science mix. |
| ISE | `999Q` | Add programming and linear algebra. |
| MSE | `999Q` | Add `ENGR 140`, programming, and chemistry depth. |
| ME | `999Q` | Add `CHEM& 163` and `MATH 240` when possible. |

## Missing Information Still Needed

This section is the concrete collection checklist for the planner. The current docs and sources are good enough to build a strong v1, but not enough to treat every output as fully complete forever without more advisor-reviewed data.

### Green River data still needed

- Full `2024-2025` and `2025-2026` course requirements for the engineering-relevant Green River tracks, not just the summary PDF:
  - `999B`
  - `999Q`
  - `999O`
  - `999P`
- The exact approved course choices behind every `SELECT COURSE FROM LIST` slot in those tracks, by catalog year.
- Quarter availability by year for the courses the planner will recommend:
  - fall / winter / spring / summer availability
  - courses that are only offered once per year
  - courses that rotate or disappear in some years
- Green River prerequisite and co-requisite chains for engineering-support courses such as:
  - `ENGR 140`
  - `ENGR 250`
  - `ENGR& 204`
  - `ENGR& 214`
  - `ENGR& 215`
  - `ENGR& 224`
  - `ENGR& 225`
- Advisor-approved examples of the easiest / safest humanities and social science fillers that still keep students inside the correct transfer track.
- Any financial-aid or degree-audit constraints for students who need one or two off-track add-on courses.

### UW Seattle engineering data still needed

- The full bachelor's degree map for each supported engineering major, not just transfer admission prerequisites.
- A clean label for which requirements are:
  - required before application
  - required before enrollment
  - still worth finishing at Green River after transfer admission
  - better saved for UW
- Advisor-reviewed confirmation of which GRC equivalents are preferred when multiple UW options exist.
- Major-specific minimum-grade or sequencing caveats where a course is technically equivalent but not the strongest planning choice.
- Archived snapshots or manually saved notes for year-specific department changes so the planner is not relying only on whatever the current web page says later.

### Major-specific gaps still to confirm

- `BioE`: the best exact Green River biology + programming path for the current BioE admission model.
- `ChemE`: the best Green River sequencing for the spring-start cohort when a student wants to stay aid-safe and still finish as many UW-usable courses as possible.
- `HCDE`: the strongest Green River science + stats combination for different student backgrounds.
- `MSE`: confirmation of the best GRC path for `MSE 170` prep plus programming.
- `Civil`, `ISE`, and `ME`: the cleanest recommendation for when programming, linear algebra, or second-quarter chemistry should be prioritized over general-ed fillers.

### Scheduling data still needed for the quarter planner

- Real quarter-by-quarter Green River offering history for `2024-2025`, `2025-2026`, and future years as they publish.
- Typical credit-load guidance from advising for transfer students who are also working.
- A curated `core STEM` vs `lighter elective / general-ed` tagging pass for the recommended GRC courses so the planner's suggested quarter mixes are based on explicit data rather than heuristic logic alone.
- Recommended substitute buckets for placeholders such as:
  - `5 credits of humanities`
  - `5 credits of social science`
  - `5 credits of elective/general education`
- A future rule for when a quarter should intentionally use `2 core classes` instead of `1 core + 2 easier classes`.

### Transcript-parser validation data still needed

- More sample Green River unofficial transcripts, especially with:
  - repeated courses
  - withdrawals
  - transfer credit from another school
  - in-progress current-quarter classes
  - older transcript layouts
- Confirmation that the current parser should always ignore:
  - current classes
  - planned classes
  - zero-earned-credit rows
  - summary rows

### Bothell and Tacoma data still needed later

- Year-specific equivalent major worksheets for UW Bothell engineering / computing where available.
- Tacoma major planning details wherever the Tacoma equivalency guide remains under maintenance.
- Campus-specific confirmation that a Seattle recommendation should or should not carry over to Bothell or Tacoma.

## Recommended Next Collection Pass

If the team wants the highest-value next data pass, collect these in this order:

1. Green River yearly track requirements plus every `SELECT COURSE FROM LIST` expansion.
2. Quarter availability by year for the engineering-relevant Green River courses.
3. Full UW Seattle engineering degree maps beyond admissions prerequisites.
4. More sample Green River unofficial transcripts for parser validation.

## Product Recommendation For A Roadmap Feature

The most efficient feature design is not a general "course planner" for every college.

It is a narrow, curated planner with these v1 inputs:

- current school: Green River College
- target school: UW Seattle
- target major: one of the supported engineering / HCDE pathways
- current math start point
- completed courses
- intended transfer cycle:
  - spring-start majors
  - autumn-start majors

Then the planner should output:

- required-to-apply checklist
- required-before-enrollment checklist
- recommended add-ons
- exact Green River substitutes for UW courses
- quarter-by-quarter Green River template
- warning flags for majors that need custom handling

## Recommended Data Model

This should be a curated dataset, not a scraped Scorecard feed.

Suggested shape:

```ts
type PlannerMajor = {
  id: string;
  title: string;
  uwDepartmentUrl: string;
  uwApplicationDeadlineLabel: string;
  uwStartQuarter: 'autumn' | 'spring';
  grcBaseTemplateId: string | null;
  summary: string;
  notes: string[];
  applicationRequirements: RequirementGroup[];
  enrollmentRequirements: RequirementGroup[];
  recommendedRequirements: RequirementGroup[];
};

type RequirementGroup = {
  label: string;
  rules: RequirementRule[];
};

type RequirementRule = {
  uwCourseOptions: string[];
  countNeeded: number;
  grcOptions: string[];
  plannerNote?: string;
};

type GrcTemplate = {
  id: string;
  title: string;
  terms: {
    label: string;
    courses: string[];
  }[];
  notes: string[];
};
```

## Recommended Non-Developer Content Workflow

The most efficient workflow is probably:

1. Keep the planner data in a single advisor-editable spreadsheet.
2. Export that sheet into versioned JSON for the app.
3. Have Mobile consume the JSON.

Why this is better than hardcoding:

- advisor can review or propose changes without editing TypeScript
- easier to audit year-to-year policy changes
- easier to add notes like "take this at GRC instead of UW"
- easier to support Lady Ivory's advising workflow directly

If you want a repo-first version before building a spreadsheet editor:

- create JSON files in `Mobile Team/data/`
- keep this doc as the human-readable source map
- later add a small import script from CSV / Google Sheets export

## Recommended v1 Boundaries

Keep the first implementation narrow:

- Green River only
- UW Seattle only
- engineering + HCDE only
- no full four-year degree auditing yet
- no automatic course equivalency inference for other colleges yet

That version is already valuable, much easier to keep accurate, and much easier for advising staff to trust.

## Biggest Advising Risks To Flag In The UI

- ChemE is spring-start and not an ordinary autumn-transfer plan.
- BioE is also winter-application / spring-start logic.
- Some majors need a custom add-on course beyond the stock GRC MRP sample.
- The current UW equivalency guide is more important than older sample plan PDFs when they disagree.
- The planner should show "advisor review recommended" whenever a student is relying on:
  - an in-progress exception
  - a mixed sequence
  - an older course equivalency
  - a missing major-specific add-on

## Bottom Line

The cleanest implementation is:

- one curated Green River -> UW engineering planner dataset
- major-specific requirement groups
- Green River template + add-on logic
- advisor-reviewed JSON, not College Scorecard ETL

That will support a roadmap feature that is actually useful for Green River STEM transfers instead of just looking like a generic planner.
