# UW Bachelor Degrees -> Green River Transfer Planner Master Reference

Last updated: March 31, 2026

## Purpose

This is the current-only master planning doc for the course planner tool.

It does three things in one place:

1. Lists every current UW bachelor's degree/major I could verify across UW Seattle, UW Bothell, and UW Tacoma.
2. Maps each degree to the current Green River College class banks that are most applicable for transfer planning.
3. Lists the Green River prerequisite chains and UW full-credit combo rules that matter when a student needs the stronger UW transfer outcome.

Current verified coverage in this version:

- `UW Seattle`: `116` degree/major rows
- `UW Bothell`: `43` degree/major rows
- `UW Tacoma`: `32` degree/major rows

## Scope Rules

- This doc is current-only.
- It intentionally excludes discontinued Green River rows that are marked historical on the UW equivalency guide.
- It intentionally excludes `No credit` rows.
- It is planner-facing, so it focuses on subject-aligned and pre-major transfer classes rather than every possible general-education elective that could fill an open AA-DTA slot.
- Default writing/composition planning is handled through the `WRIT` bank unless a row says otherwise.
- Generic breadth placeholders such as `HUMANITIES`, `SOCIAL SCIENCE`, `NATURAL SCIENCE`, and `SELECT COURSE FROM LIST` still come from [GRC_LATEST_TRANSFER_ASSOCIATE_DEGREES_AND_COURSES.md](C:\Users\marwa\GatorGuide\Mobile%20Team\docs\GRC_LATEST_TRANSFER_ASSOCIATE_DEGREES_AND_COURSES.md).

## Source Hierarchy

Use these current sources first:

- UW Seattle majors: `https://admit.washington.edu/academics/majors`
- UW Bothell degree programs: `https://www.uwb.edu/catalog/degree-programs`
- UW Tacoma degree programs: `https://www.tacoma.uw.edu/catalog/degree-programs`
- UW Green River equivalency guide: `https://admit.washington.edu/apply/transfer/equivalency-guide/green-river/`
- Green River transfer-degree page: `https://www.greenriver.edu/students/academics/areas-of-interest/university-and-college-transfer/index.html`

Helpful companion docs in this repo:

- [GRC_UW_CURRENT_EQUIVALENCY_FULL_WITH_SERIES_RULES.md](C:\Users\marwa\GatorGuide\Mobile%20Team\docs\GRC_UW_CURRENT_EQUIVALENCY_FULL_WITH_SERIES_RULES.md)
- [COURSE_PLANNER_MAJORS_AND_DEGREE_REQUIREMENTS.md](C:\Users\marwa\GatorGuide\Mobile%20Team\docs\COURSE_PLANNER_MAJORS_AND_DEGREE_REQUIREMENTS.md)
- [GRC_UW_ENGINEERING_TRANSFER_PLANNER.md](C:\Users\marwa\GatorGuide\Mobile%20Team\docs\GRC_UW_ENGINEERING_TRANSFER_PLANNER.md)

## How To Read This Doc

- `banks` means the current Green River transferable subject banks the planner should surface for that degree.
- A degree's exact current GRC class list is the union of every class listed under its assigned bank(s) in the class-bank library below.
- `chains` means Green River prerequisite order and/or UW full-credit combo rules that should be enforced or warned on.
- `support-only` means Green River has transferable supporting coursework for the area, but not a clean direct subject sequence in the current UW Green River guide.
- `WRIT` is the default composition bank and is assumed for almost every bachelor's degree unless a row says otherwise.
- For tool implementation, resolve each degree in this order: `degree row -> bank list -> exact GRC classes -> prerequisite/full-credit chain rules`.

## Current GRC Prerequisite And Full-Credit Chain Library

| Chain ID | Type | Current planner rule |
| --- | --- | --- |
| `WRIT-SEQ` | GRC sequence | `ENGL& 101` stands alone for UW composition. Common Green River follow-on writing/literature path is `ENGL& 101 -> ENGL 126 or ENGL 127 or ENGL 128`. |
| `MATH-STEM` | GRC sequence | `MATH& 151 -> MATH& 152 -> MATH& 163 -> MATH& 254 -> MATH 238 -> MATH 240`. Current UW outcomes in order are `MATH 124`, `125`, `126`, `224 (4) + 2XX (1)`, `207 (4) + 2XX (1)`, and `208 (4) + 2XX (1)`. |
| `MATH-BUS` | GRC sequence | Business / less-calculus-heavy planning commonly uses `MATH& 141 -> MATH& 142` or `MATH 147 -> MATH& 148`. `MATH& 146` and `MATH 256` are standalone quantitative options. |
| `CS-NEW` | GRC sequence | `CS 121 -> CS 122 -> CS 123`. Current UW equivalency entries are separate, but planner sequencing at GRC should treat them in this order. |
| `CS-LEGACY` | GRC sequence | `CS& 141 -> CS 145` is the older CSE `142 -> 143` path. `CS& 131 -> CS 132` is a separate current alternate intro path. |
| `PHYS-CALC` | GRC sequence | `PHYS& 221 -> PHYS& 222 -> PHYS& 223` for calculus-based physics. |
| `PHYS-ALG` | GRC sequence | `PHYS& 114 or PHYS& 154 -> PHYS& 115 or PHYS& 155 -> PHYS& 116 or PHYS& 156` for algebra-based physics. |
| `CHEM-GEN` | Both | `CHEM& 161 -> CHEM& 162 -> CHEM& 163`. Current UW full-credit note: `CHEM& 162 + CHEM& 163` gives `CHEM 152, 162 (5, 5), 1XX (2)`; otherwise each is weaker `CHEM 1XX`. |
| `CHEM-ORG` | Both | `CHEM& 261 -> CHEM& 262 -> CHEM& 263`. Current UW full-credit notes: `261 + 262` strengthens the outcome, and `261 + 262 + 263` yields the full `CHEM 237, 238, 239, 241, 242` package. |
| `BIO-MAJORS` | Both | `BIOL& 211 -> BIOL& 212 -> BIOL& 213`. All three are needed for the full `BIOL 180, 200, 220, 2XX (3)` outcome. |
| `BIO-ANAT` | Both | `BIOL& 241 -> BIOL& 242`. Both are needed for `BIOL 118`, `BIOL 119`, and `NURS 301` credit. |
| `ACCT-COMBO` | Both | `ACCT& 201 + ACCT& 202` are required for the stronger `ACCTG 215 (5), B A 2XX (5)` outcome. `ACCT& 203` then gives `ACCTG 225 (5)`. |
| `ASTR-COMBO` | UW full-credit combo | `ASTR& 100 + ASTR& 101`: either course gives `ASTR 101 (5)` and the second adds `1XX (5)`. |
| `HIST-US` | UW full-credit combo | `HIST& 136 + HIST& 137` together yield `HSTAA 101 (5), 1XX (5)`. |
| `ENGL-250` | UW full-credit combo | `ENGL& 244 + ENGL& 245` together yield `ENGL 250 (5)` plus additional `2XX` credit. |
| `COMM-266` | UW full-credit combo | `CMST 266` yields `CMS 272` only if taken for `5` credits; otherwise it stays `CMS 2XX`. |
| `LANG-CHIN` | GRC sequence | `CHIN& 121 -> CHIN& 122 -> CHIN& 123`. |
| `LANG-FR` | GRC sequence | `FRCH& 121 -> FRCH& 122 -> FRCH& 123 -> FRCH& 221`. |
| `LANG-GER` | GRC sequence | `GERM& 121 -> GERM& 122 -> GERM& 123`. |
| `LANG-JP` | GRC sequence | `JAPN& 121 -> JAPN& 122 -> JAPN& 123`. |
| `LANG-SP` | GRC sequence | `SPAN& 121 -> SPAN& 122 -> SPAN& 123 -> SPAN& 221 -> SPAN& 222 -> SPAN& 223`. |
| `NATRS-COMBO` | UW full-credit combo | `NATRS 180 + NATRS 292` has a special combined ESRM-major rule on the UW guide. |

## Current GRC Transferable Class Bank Library

`WRIT`

- `ENGL& 101`, `ENGL 126`, `ENGL 127`, `ENGL 128`

`MATH`

- `MATH 106`, `MATH& 107`, `MATH& 141`, `MATH& 142`, `MATH& 146`, `MATH 147`, `MATH& 148`, `MATH& 151`, `MATH& 152`, `MATH& 163`, `MATH& 171`, `MATH& 172`, `MATH& 173`, `MATH 194`, `MATH 238`, `MATH 240`, `MATH& 254`, `MATH 256`, `MATH 297`

`CS`

- `CS 121`, `CS 122`, `CS 123`, `CS& 131`, `CS 132`, `CS& 141`, `CS 145`, `CS 202`

`ENGR`

- `ENGR 100`, `ENGR& 104`, `ENGR 106`, `ENGR& 114`, `ENGR 140`, `ENGR 199`, `ENGR& 204`, `ENGR& 214`, `ENGR& 215`, `ENGR& 224`, `ENGR& 225`, `ENGR 250`

`PHYS`

- `PHYS& 110`, `PHYS& 114`, `PHYS& 154`, `PHYS& 115`, `PHYS& 155`, `PHYS& 116`, `PHYS& 156`, `PHYS& 221`, `PHYS& 222`, `PHYS& 223`, `PHYS 225`, `PHYS 229`, `PHYS 298`

`CHEM`

- `CHEM& 121`, `CHEM& 131`, `CHEM& 140`, `CHEM& 161`, `CHEM& 162`, `CHEM& 163`, `CHEM 194`, `CHEM 195`, `CHEM& 261`, `CHEM& 262`, `CHEM& 263`, `CHEM 296`, `CHEM 299`

`BIO`

- `AP 100`, `AP 102`, `AP 103`, `AP 104`, `AP 210`, `BIOL& 100`, `BIOL 103`, `BIOL 110`, `BIOL 125`, `BIOL 127`, `BIOL 140`, `BIOL 194`, `BIOL 195`, `BIOL& 211`, `BIOL& 212`, `BIOL& 213`, `BIOL& 241`, `BIOL& 242`, `BIOL& 260`, `BIOL 298`

`EARTH`

- `ASTR& 100`, `ASTR& 101`, `ENV S 204`, `GIS 202`, `GIS 260`, `GEOG& 100`, `GEOG 120`, `GEOG 123`, `GEOG 190`, `GEOG& 200`, `GEOG 201`, `GEOG 205`, `GEOG 298`, `GEOG 299`, `GEOL& 101`, `GEOL 150`, `GEOL 152`, `GEOL 153`, `GEOL 200`, `GEOL 206`, `GEOL& 208`, `GEOL 299`, `NATRS 100`, `NATRS 117`, `NATRS 161`, `NATRS 162`, `NATRS 172`, `NATRS 180`, `NATRS 181`, `NATRS 182`, `NATRS 183`, `NATRS 184`, `NATRS 198`, `NATRS 199`, `NATRS 210`, `NATRS 270`, `NATRS 271`, `NATRS 284`, `NATRS 285`, `NATRS 286`, `NATRS 292`, `NATRS 293`, `NATRS 294`, `NATRS 297`, `NATRS 298`, `NATRS 299`, `IDS 101`, `IDS 102`, `IDS 103`, `OCEA& 101`

`BUS`

- `ACCT& 201`, `ACCT& 202`, `ACCT& 203`, `BUS& 101`, `BUS 121`, `BUS& 201`, `BUS 258`, `ECON 100`, `ECON 101`, `ECON 194`, `ECON& 201`, `ECON& 202`, `ECON 298`, `ECON 299`

`AAMES`

- `AMES 100`, `AMES 150`, `AMES 194`, `AMES 211`, `ANTH& 100`, `ANTH 194`, `ANTH& 204`, `ANTH& 205`, `ANTH& 206`, `ANTH& 210`, `ANTH 211`, `ANTH& 216`, `ANTH& 234`, `ANTH& 235`, `ANTH& 236`, `ANTH 273`, `ANTH 294`, `ANTH 298`, `ANTH 299`, `S SCI 160`, `S SCI 194`, `S SCI 211`

`COMM`

- `CMST& 102`, `CMST 194`, `CMST& 210`, `CMST 212`, `CMST 215`, `CMST& 220`, `CMST& 230`, `CMST 238`, `CMST 245`, `CMST 265`, `CMST 266`, `CMST 299`, `FILM 120`, `FILM 121`, `FILM 122`, `JOURN 100.1`, `JOURN 100.2`, `JOURN 100.3`, `JOURN 101`, `JOURN 103`, `JOURN 107`, `JOURN 110`, `JOURN 111`, `JOURN 112`, `JOURN 120`, `JOURN 121`, `JOURN 122`, `JOURN 150`, `JOURN 151`, `JOURN 152`, `JOURN 153`, `JOURN 198`, `JOURN 199`, `JOURN 200`, `JOURN 205`, `JOURN 206`, `JOURN 207`, `JOURN 254`, `JOURN 255`, `JOURN 298`, `JOURN 299`

`ENGL`

- `ENGL 103`, `ENGL 109`, `ENGL& 112`, `ENGL& 113`, `ENGL& 114`, `ENGL 115`, `ENGL 126`, `ENGL 127`, `ENGL 128`, `ENGL 160`, `ENGL 161`, `ENGL 163`, `ENGL 164`, `ENGL 165`, `ENGL 168`, `ENGL 180`, `ENGL 181`, `ENGL 183`, `ENGL 185`, `ENGL 187`, `ENGL 190`, `ENGL 194`, `ENGL 199`, `ENGL& 220`, `ENGL& 226`, `ENGL& 227`, `ENGL& 228`, `ENGL& 236`, `ENGL& 237`, `ENGL 239`, `ENGL& 244`, `ENGL& 245`, `ENGL& 246`, `ENGL 247`, `ENGL 248`, `ENGL 249`, `ENGL& 254`, `ENGL& 255`, `ENGL& 256`, `ENGL 257`, `ENGL 299`

`HIST`

- `HIST 101`, `HIST 102`, `HIST 103`, `HIST 120`, `HIST 122`, `HIST 135`, `HIST& 136`, `HIST& 137`, `HIST 194`, `HIST& 214`, `HIST& 215`, `HIST 220`, `HIST 224`, `HIST 226`, `HIST 228`, `HIST 230`, `HIST 231`, `HIST 232`, `HIST 233`, `HIST 235`, `HIST 237`, `HIST 240`, `HIST 245`, `HIST 250`, `HIST 299`, `HUMAN 100`, `HUMAN 110`, `HUMAN 133`, `HUMAN 142`, `HUMAN 186`, `HUMAN 190`, `HUMAN 191`, `HUMAN 194`, `HUMAN 224`

`PHIL`

- `PHIL& 101`, `PHIL 102`, `PHIL 103`, `PHIL 104`, `PHIL 105`, `PHIL 110`, `PHIL 112`, `PHIL 114`, `PHIL 115`, `PHIL& 120`, `PHIL 160`, `PHIL 194`, `PHIL 200`, `PHIL 206`, `PHIL 210`, `PHIL 215`, `PHIL 220`, `PHIL 236`, `PHIL 238`, `PHIL 240`, `PHIL 243`, `PHIL 299`

`PSYED`

- `PSYC& 100`, `PSYC& 180`, `PSYC& 200`, `PSYC 201`, `PSYC 209`, `PSYC& 220`, `PSYC 225`, `PSYC 298`, `PSYC 299`, `ECED& 105`, `ECED& 132`, `ECED& 134`, `ECED& 139`, `ECED 152`, `ECED 155`, `ECED& 160`, `ECED 165`, `ECED& 170`, `ECED 175`, `ECED& 180`, `ECED& 190`, `ECED 220`, `EDUC& 115`, `EDUC& 130`, `EDUC& 136`, `EDUC& 150`, `EDUC& 204`, `EDUC& 205`, `EDUC 240`, `EDUC 245`

`ART`

- `ART& 100`, `ART 105`, `ART 106`, `ART 107`, `ART 109`, `ART 110`, `ART 111`, `ART 112`, `ART 113`, `ART 114`, `ART 115`, `ART 119`, `ART 120`, `ART 130`, `ART 133`, `ART 135`, `ART 150`, `ART 180`, `ART 199`, `ART 212`, `ART 213`, `ART 214`, `ART 219`, `ART 251`, `ART 252`, `ART 253`, `ART 255`, `ART 256`, `ART 257`, `ART 275`, `ART 276`, `ART 277`, `ART 294`, `ART 295`, `ART 296`, `ART 297`, `ART 298`, `ART 299`, `PHOTO 101`, `PHOTO 102`, `PHOTO 103`, `PHOTO 111`, `PHOTO 112`, `PHOTO 113`

`PERF`

- `DANCE 101`, `DANCE 102`, `DANCE 103`, `DANCE 110`, `DANCE 204`, `DRMA& 101`, `DRMA 102`, `DRMA 111`, `DRMA 112`, `DRMA 113`, `DRMA 151`, `DRMA 152`, `DRMA 153`, `DRMA 154`, `DRMA 155`, `DRMA 156`, `DRMA 211`, `DRMA 212`, `DRMA 213`, `DRMA 298`

`MUSIC`

- `MUSC 101`, `MUSC 103`, `MUSC 104`, `MUSC& 105`, `MUSC 107`, `MUSC 108`, `MUSC 109`, `MUSC 110`, `MUSC 118`, `MUSC 119`, `MUSC 120`, `MUSC& 121`, `MUSC& 122`, `MUSC& 123`, `MUSC 124`, `MUSC 125`, `MUSC 127`, `MUSC 128`, `MUSC 129`, `MUSC 130.1`, `MUSC 130.2`, `MUSC 130.3`, `MUSC& 131`, `MUSC& 132`, `MUSC& 133`, `MUSC 140`, `MUSC 141`, `MUSC 142`, `MUSC 218`, `MUSC 219`, `MUSC 220`, `MUSC& 221`, `MUSC& 222`, `MUSC 227`, `MUSIC 228`, `MUSIC 229`, `MUSC 230.1`, `MUSC 230.2`, `MUSC 230.3`, `MUSC& 231`, `MUSC& 232`, `MUSC 298`, `MUSC 299`

`LANG-CHIN`

- `CHIN 111`, `CHIN& 121`, `CHIN& 122`, `CHIN& 123`

`LANG-FR`

- `FRCH& 121`, `FRCH& 122`, `FRCH& 123`, `FRCH& 221`

`LANG-GER`

- `GERM& 121`, `GERM& 122`, `GERM& 123`

`LANG-JP`

- `JAPN& 121`, `JAPN& 122`, `JAPN& 123`

`LANG-SP`

- `SPAN 110`, `SPAN& 121`, `SPAN& 122`, `SPAN& 123`, `SPAN 194`, `SPAN& 221`, `SPAN& 222`, `SPAN& 223`, `SPAN 299`

`HEALTH`

- `HL ED 190`, `NUTR& 101`, `O T 100`, `O T 105`, `O T 110`, `O T 115`, `O T 116`, `O T 194`, `O T 198`, `O T 202`, `O T 250`, `O T 251`

`POLSOC`

- `POLS& 101`, `POLS 194`, `POLS& 200`, `POLS& 202`, `POLS& 203`, `POLS& 204`, `POLS 207`, `POLS 209`, `POLS 298`, `CJ& 101`, `CJ& 105`, `CJ& 110`, `CJ 200`, `CJ 205`, `CJ 220`, `CJ 236`, `CJ& 240`, `CJ 294`, `CJ 299`, `SOC& 101`, `SOC 194`, `SOC& 201`, `SOC 215`, `SOC 220`, `SOC 230`, `SOC 240`, `SOC 245`, `SOC 260`, `SOC 298`

Planner note:

- I intentionally left the broad PE activity bank out of the master planner because those limited-credit PE courses are not major-aligned prerequisite drivers for UW bachelor's planning.

## UW Seattle

### Engineering, Computing, And Quantitative Majors

- `Aeronautics & Astronautics`: banks `ENGR`, `MATH`, `PHYS`, `CHEM`; chains `MATH-STEM`, `PHYS-CALC`, `CHEM-GEN`; note `direct engineering-prep coverage`.
- `Applied & Computational Mathematical Sciences (ACMS)`: banks `MATH`, `CS`, `PHYS`; chains `MATH-STEM`, `CS-NEW`, `PHYS-CALC`; note `best planner path depends on ACMS option`.
- `Applied Mathematics`: banks `MATH`, `PHYS`, `CS`; chains `MATH-STEM`, `PHYS-CALC`, `CS-NEW`; note `strongest prep is calculus plus programming plus physics`.
- `Computational Finance & Risk Management`: banks `MATH`, `BUS`, `CS`; chains `MATH-STEM`, `MATH-BUS`, `CS-NEW`; note `quant-heavy finance prep`.
- `Computer Engineering`: banks `CS`, `MATH`, `PHYS`, `ENGR`, `CHEM`; chains `CS-NEW`, `MATH-STEM`, `PHYS-CALC`, `CHEM-GEN`; note `use existing detailed Seattle CompE planner for junior/senior specifics`.
- `Computer Science`: banks `CS`, `MATH`, `PHYS`; chains `CS-NEW`, `MATH-STEM`, `PHYS-CALC`; note `use existing detailed Seattle CS planner for stronger admission prep`.
- `Construction Management`: banks `ENGR`, `MATH`, `PHYS`, `BUS`; chains `MATH-STEM`, `PHYS-CALC`; note `supportive engineering and business prep; no direct GRC construction-management sequence`.
- `Electrical & Computer Engineering`: banks `ENGR`, `CS`, `MATH`, `PHYS`, `CHEM`; chains `CS-NEW`, `MATH-STEM`, `PHYS-CALC`, `CHEM-GEN`; note `direct engineering-prep coverage`.
- `Human Centered Design and Engineering`: banks `ENGR`, `CS`, `MATH`, `PHYS`, `COMM`, `ENGL`; chains `CS-NEW`, `MATH-STEM`, `PHYS-CALC`; note `supportive prep only because HCDE is not a one-to-one GRC transfer degree`.
- `Industrial Engineering`: banks `ENGR`, `MATH`, `PHYS`, `CHEM`, `BUS`; chains `MATH-STEM`, `PHYS-CALC`, `CHEM-GEN`; note `direct engineering-prep coverage`.
- `Informatics`: banks `CS`, `MATH`, `COMM`, `BUS`; chains `CS-NEW`, `MATH-STEM`; note `supportive prep only; Informatics has no single GRC MRP track`.
- `Materials Science & Engineering`: banks `ENGR`, `MATH`, `PHYS`, `CHEM`; chains `MATH-STEM`, `PHYS-CALC`, `CHEM-GEN`; note `direct engineering-prep coverage`.
- `Mathematics`: banks `MATH`, `PHYS`, `CS`; chains `MATH-STEM`, `PHYS-CALC`, `CS-NEW`; note `best prep is calculus through MATH 240 or higher`.
- `Mechanical Engineering`: banks `ENGR`, `MATH`, `PHYS`, `CHEM`; chains `MATH-STEM`, `PHYS-CALC`, `CHEM-GEN`; note `direct engineering-prep coverage`.
- `Statistics`: banks `MATH`, `CS`, `BUS`; chains `MATH-STEM`, `CS-NEW`; note `supportive prep only; use MATH& 146 and calculus together when possible`.

### Life, Physical, And Environmental Sciences

- `Aquatic Conservation & Ecology`: banks `BIO`, `EARTH`, `CHEM`, `MATH`; chains `BIO-MAJORS`, `CHEM-GEN`, `MATH-STEM`; note `supportive science prep`.
- `Astronomy`: banks `EARTH`, `PHYS`, `MATH`; chains `ASTR-COMBO`, `PHYS-CALC`, `MATH-STEM`; note `use astronomy plus calculus-based physics`.
- `Atmospheric and Climate Science`: banks `EARTH`, `MATH`, `PHYS`, `CHEM`; chains `MATH-STEM`, `PHYS-CALC`, `CHEM-GEN`; note `strongest prep is atmospheric-science style AST2 STEM base`.
- `Biochemistry`: banks `CHEM`, `BIO`, `MATH`, `PHYS`; chains `CHEM-GEN`, `CHEM-ORG`, `BIO-MAJORS`, `MATH-STEM`, `PHYS-CALC`; note `direct science-prep coverage`.
- `Bioengineering`: banks `CHEM`, `BIO`, `MATH`, `PHYS`, `ENGR`, `CS`; chains `CHEM-GEN`, `CHEM-ORG`, `BIO-MAJORS`, `MATH-STEM`, `PHYS-CALC`, `CS-NEW`; note `use existing Seattle BioE planner for department-specific timing`.
- `Biology`: banks `BIO`, `CHEM`, `MATH`; chains `BIO-MAJORS`, `CHEM-GEN`, `MATH-STEM`; note `direct science-prep coverage`.
- `Chemical Engineering`: banks `CHEM`, `MATH`, `PHYS`, `ENGR`; chains `CHEM-GEN`, `CHEM-ORG`, `MATH-STEM`, `PHYS-CALC`; note `department has special spring-start timing`.
- `Chemistry`: banks `CHEM`, `MATH`, `PHYS`; chains `CHEM-GEN`, `CHEM-ORG`, `MATH-STEM`, `PHYS-CALC`; note `direct science-prep coverage`.
- `Earth & Space Sciences`: banks `EARTH`, `CHEM`, `MATH`, `PHYS`; chains `MATH-STEM`, `PHYS-CALC`, `CHEM-GEN`; note `use geology, oceanography, and geography support`.
- `Environmental Design & Sustainability`: banks `ART`, `EARTH`, `MATH`, `PHYS`, `ENGL`; chains `MATH-STEM`; note `support-only; combine design/art foundations with environment and STEM support`.
- `Environmental Engineering`: banks `ENGR`, `MATH`, `PHYS`, `CHEM`, `EARTH`; chains `MATH-STEM`, `PHYS-CALC`, `CHEM-GEN`; note `direct engineering-prep coverage`.
- `Environmental Public Health`: banks `BIO`, `CHEM`, `MATH`, `HEALTH`, `PSYED`; chains `BIO-MAJORS`, `CHEM-GEN`, `MATH-STEM`; note `supportive pre-health prep only`.
- `Environmental Science & Terrestrial Resource Management`: banks `EARTH`, `BIO`, `CHEM`, `MATH`; chains `NATRS-COMBO`, `BIO-MAJORS`, `CHEM-GEN`, `MATH-STEM`; note `strongest direct GRC subject bank is EARTH`.
- `Environmental Studies`: banks `EARTH`, `HIST`, `POLSOC`, `ENGL`; chains none; note `supportive prep only`.
- `Food Systems, Nutrition, & Health`: banks `HEALTH`, `BIO`, `CHEM`, `EARTH`; chains `BIO-MAJORS`, `CHEM-GEN`; note `supportive prep only`.
- `Marine Biology`: banks `BIO`, `CHEM`, `MATH`, `PHYS`, `EARTH`; chains `BIO-MAJORS`, `CHEM-GEN`, `MATH-STEM`, `PHYS-CALC`; note `strongest prep is science-heavy AST track`.
- `Medical Laboratory Science`: banks `BIO`, `CHEM`, `MATH`, `HEALTH`; chains `BIO-MAJORS`, `CHEM-GEN`, `CHEM-ORG`; note `supportive pre-clinical prep only`.
- `Microbiology`: banks `BIO`, `CHEM`, `MATH`; chains `BIO-MAJORS`, `CHEM-GEN`, `CHEM-ORG`; note `use BIOL& 260 plus major biology/chemistry sequence`.
- `Neuroscience`: banks `BIO`, `CHEM`, `MATH`, `PHYS`, `PSYED`; chains `BIO-MAJORS`, `CHEM-GEN`, `MATH-STEM`, `PHYS-CALC`; note `supportive pre-major prep`.
- `Nursing`: banks `BIO`, `CHEM`, `HEALTH`, `PSYED`, `COMM`; chains `BIO-ANAT`, `CHEM-GEN`; note `pre-nursing planning should also use the GRC pre-nursing transfer plan`.
- `Oceanography`: banks `EARTH`, `CHEM`, `MATH`, `PHYS`; chains `MATH-STEM`, `PHYS-CALC`, `CHEM-GEN`; note `use OCEA& 101 and earth-science support`.
- `Physics`: banks `PHYS`, `MATH`, `CHEM`; chains `PHYS-CALC`, `MATH-STEM`, `CHEM-GEN`; note `direct science-prep coverage`.
- `Public Health - Global Health`: banks `BIO`, `CHEM`, `MATH`, `HEALTH`, `POLSOC`; chains `BIO-MAJORS`, `CHEM-GEN`, `MATH-STEM`; note `supportive public-health prep`.
- `Speech & Hearing Sciences`: banks `BIO`, `PSYED`, `HEALTH`, `COMM`; chains `BIO-ANAT`; note `supportive prep only; no direct GRC SHS sequence`.
- `Sustainable Bioresource Systems Engineering`: banks `ENGR`, `MATH`, `PHYS`, `CHEM`, `EARTH`; chains `MATH-STEM`, `PHYS-CALC`, `CHEM-GEN`, `NATRS-COMBO`; note `supportive prep only`.

### Business, Policy, And Social Science Majors

- `American Ethnic Studies`: banks `AAMES`, `HIST`, `ENGL`; chains none; note `direct subject coverage through AMES plus related anthropology/history`.
- `American Indian Studies`: banks `AAMES`, `HIST`, `ENGL`; chains none; note `supportive coverage; no separate current GRC American Indian prefix`.
- `Anthropology`: banks `AAMES`, `HIST`, `BIO`; chains none; note `direct subject coverage through anthropology sequence`.
- `Business Administration`: banks `BUS`, `MATH`; chains `MATH-BUS`, `ACCT-COMBO`; note `best paired with the current GRC business DTA/MRP plan`.
- `Community, Environment & Planning`: banks `EARTH`, `POLSOC`, `HIST`; chains none; note `supportive prep only`.
- `Disability Studies`: banks `PSYED`, `HEALTH`, `POLSOC`; chains none; note `supportive prep only`.
- `Early Childhood & Family Studies`: banks `PSYED`; chains none; note `direct support through ECED and related education/psychology coursework`.
- `Economics`: banks `BUS`, `MATH`; chains `MATH-BUS`, `MATH-STEM`; note `best prep is economics plus calculus or business math depending target path`.
- `Education Studies`: banks `PSYED`, `HIST`, `POLSOC`; chains none; note `supportive prep only`.
- `Education, Communities & Organizations`: banks `PSYED`, `POLSOC`, `HIST`; chains none; note `supportive prep only`.
- `Gender, Women & Sexuality Studies`: banks `PHIL`, `HIST`, `POLSOC`, `PSYED`, `AAMES`; chains none; note `supportive prep only`.
- `Geography`: banks `EARTH`, `POLSOC`, `MATH`; chains none; note `direct subject coverage through geography/GIS bank`.
- `History`: banks `HIST`, `ENGL`; chains `HIST-US`; note `direct history coverage`.
- `International Studies`: banks `HIST`, `POLSOC`, `ENGL`, `LANG-CHIN`, `LANG-FR`, `LANG-GER`, `LANG-JP`, `LANG-SP`; chains `LANG-CHIN`, `LANG-FR`, `LANG-GER`, `LANG-JP`, `LANG-SP`; note `supportive prep varies by regional focus`.
- `Law, Societies & Justice`: banks `POLSOC`, `PHIL`, `ENGL`; chains none; note `direct support through CJ/POLS/SOC plus philosophy`.
- `Political Science`: banks `POLSOC`, `HIST`, `PHIL`; chains none; note `direct subject coverage through current POLS sequence`.
- `Psychology`: banks `PSYED`, `BIO`; chains none; note `use PSYC& 100 plus research and biological support`.
- `Public Service & Policy`: banks `POLSOC`, `BUS`, `HIST`, `PHIL`; chains `MATH-BUS`; note `supportive policy/econ prep`.
- `Real Estate`: banks `BUS`, `MATH`, `POLSOC`; chains `MATH-BUS`, `ACCT-COMBO`; note `supportive business prep only`.
- `Social Welfare`: banks `POLSOC`, `PSYED`, `HIST`; chains none; note `supportive prep only`.
- `Sociology`: banks `POLSOC`, `PSYED`; chains none; note `direct sociology coverage through current SOC sequence`.

### Arts, Humanities, Languages, And Design Majors

- `Architectural Design`: banks `ART`, `MATH`, `PHYS`, `ENGL`; chains `MATH-STEM`; note `support-only; no current direct architecture sequence at GRC`.
- `Architectural Studies`: banks `ART`, `MATH`, `PHYS`, `ENGL`; chains `MATH-STEM`; note `support-only; no current direct architecture sequence at GRC`.
- `Art`: banks `ART`; chains none; note `direct studio and art-history support`.
- `Art History`: banks `ART`, `HIST`, `ENGL`; chains none; note `direct support through art history and related humanities`.
- `Asian Languages & Cultures`: banks `LANG-CHIN`, `LANG-JP`, `HIST`, `ENGL`; chains `LANG-CHIN`, `LANG-JP`; note `support-only because current GRC language coverage is strongest in Chinese and Japanese`.
- `Asian Studies`: banks `LANG-CHIN`, `LANG-JP`, `HIST`, `ENGL`; chains `LANG-CHIN`, `LANG-JP`; note `support-only`.
- `Chinese`: banks `LANG-CHIN`, `ENGL`, `HIST`; chains `LANG-CHIN`; note `direct current Chinese transfer support`.
- `Cinema & Media Studies`: banks `COMM`, `ENGL`, `HIST`; chains `COMM-266`; note `direct communication/film support`.
- `Classical Studies`: banks `HIST`, `ENGL`, `PHIL`; chains none; note `support-only; no current GRC Greek or Latin sequence in the UW guide`.
- `Classics`: banks `HIST`, `ENGL`, `PHIL`; chains none; note `support-only; no current GRC Greek or Latin sequence in the UW guide`.
- `Communication`: banks `COMM`; chains `COMM-266`; note `direct communication support`.
- `Comparative History of Ideas`: banks `ENGL`, `PHIL`, `HIST`, `LANG-FR`, `LANG-GER`, `LANG-JP`, `LANG-SP`; chains `LANG-FR`, `LANG-GER`, `LANG-JP`, `LANG-SP`; note `support-only`.
- `Comparative Literature`: banks `ENGL`, `LANG-FR`, `LANG-GER`, `LANG-JP`, `LANG-SP`, `HIST`; chains `LANG-FR`, `LANG-GER`, `LANG-JP`, `LANG-SP`; note `support-only`.
- `Comparative Religion`: banks `PHIL`, `AAMES`, `HIST`, `ENGL`; chains none; note `support-only using philosophy, anthropology/religion, and history`.
- `Dance`: banks `PERF`; chains none; note `direct performance support`.
- `Danish`: banks `HIST`, `ENGL`; chains none; note `support-only; no current Danish language bank at GRC`.
- `Design`: banks `ART`, `COMM`, `ENGL`; chains none; note `support-only; no current direct UW Design-equivalent GRC sequence`.
- `Drama`: banks `PERF`; chains none; note `direct drama support`.
- `English - Creative Writing`: banks `ENGL`; chains `ENGL-250`; note `direct English support`.
- `English - Language, Literature & Culture`: banks `ENGL`; chains `ENGL-250`; note `direct English support`.
- `European Studies`: banks `HIST`, `ENGL`, `LANG-FR`, `LANG-GER`, `LANG-SP`; chains `LANG-FR`, `LANG-GER`, `LANG-SP`; note `support-only`.
- `Ethnomusicology, B.A.`: banks `MUSIC`, `HIST`, `ENGL`; chains none; note `support-only but strong music prep exists`.
- `Finnish`: banks `HIST`, `ENGL`; chains none; note `support-only; no current Finnish language bank at GRC`.
- `French`: banks `LANG-FR`, `ENGL`; chains `LANG-FR`; note `direct current French transfer support`.
- `German`: banks `LANG-GER`, `ENGL`; chains `LANG-GER`; note `direct current German transfer support`.
- `Global Literary Studies`: banks `ENGL`, `LANG-FR`, `LANG-GER`, `LANG-JP`, `LANG-SP`, `HIST`; chains `LANG-FR`, `LANG-GER`, `LANG-JP`, `LANG-SP`; note `support-only`.
- `Greek`: banks `HIST`, `PHIL`, `ENGL`; chains none; note `support-only; no current Greek language bank at GRC`.
- `Guitar, B.M.`: banks `MUSIC`; chains none; note `direct music support`.
- `History & Philosophy of Science`: banks `HIST`, `PHIL`, `CHEM`, `BIO`, `PHYS`, `EARTH`, `MATH`; chains `MATH-STEM`, `PHYS-CALC`, `CHEM-GEN`, `BIO-MAJORS`; note `support-only but strong lower-division prep exists`.
- `Individualized Studies`: banks `varies`; chains `varies`; note `planner must build custom bank set case by case`.
- `Italian`: banks `ENGL`, `HIST`, `LANG-FR`, `LANG-SP`; chains `LANG-FR`, `LANG-SP`; note `support-only; no current Italian language bank at GRC`.
- `Japanese`: banks `LANG-JP`, `ENGL`; chains `LANG-JP`; note `direct current Japanese transfer support`.
- `Jazz Studies, B.M.`: banks `MUSIC`; chains none; note `direct music support`.
- `Jewish Studies`: banks `HIST`, `PHIL`, `ENGL`; chains none; note `support-only`.
- `Korean`: banks `HIST`, `ENGL`; chains none; note `support-only; no current Korean language bank at GRC`.
- `Landscape Architecture`: banks `ART`, `EARTH`, `MATH`, `ENGL`; chains `MATH-STEM`; note `support-only`.
- `Latin`: banks `HIST`, `PHIL`, `ENGL`; chains none; note `support-only; no current Latin language bank at GRC`.
- `Latin American & Caribbean Studies`: banks `HIST`, `LANG-SP`, `ENGL`; chains `LANG-SP`; note `support-only with strong Spanish support`.
- `Linguistics`: banks `ENGL`, `PHIL`, `LANG-CHIN`, `LANG-FR`, `LANG-GER`, `LANG-JP`, `LANG-SP`; chains `LANG-CHIN`, `LANG-FR`, `LANG-GER`, `LANG-JP`, `LANG-SP`; note `support-only`.
- `Middle Eastern Languages & Cultures`: banks `HIST`, `ENGL`, `PHIL`; chains none; note `support-only; no current Middle Eastern language bank at GRC`.
- `Music Composition, B.M.`: banks `MUSIC`; chains none; note `direct music support`.
- `Music Education, B.M.`: banks `MUSIC`, `PSYED`, `COMM`; chains none; note `support-only with strong music foundation`.
- `Music, B.A.`: banks `MUSIC`; chains none; note `direct music support`.
- `Norwegian`: banks `HIST`, `ENGL`; chains none; note `support-only; no current Norwegian language bank at GRC`.
- `Orchestral Instruments, B.M.`: banks `MUSIC`; chains none; note `direct music support`.
- `Organ, B.M.`: banks `MUSIC`; chains none; note `direct music support`.
- `Percussion Performance, B.M.`: banks `MUSIC`; chains none; note `direct music support`.
- `Philosophy`: banks `PHIL`, `ENGL`; chains none; note `direct philosophy support`.
- `Piano, B.M.`: banks `MUSIC`; chains none; note `direct music support`.
- `Scandinavian Area Studies`: banks `HIST`, `ENGL`, `LANG-GER`; chains `LANG-GER`; note `support-only; no current Scandinavian language bank at GRC`.
- `Slavic Languages & Literatures`: banks `HIST`, `ENGL`; chains none; note `support-only; no current Russian/Slavic language bank at GRC`.
- `South Asian Languages & Cultures`: banks `HIST`, `ENGL`; chains none; note `support-only; no current South Asian language bank at GRC`.
- `Spanish`: banks `LANG-SP`, `ENGL`; chains `LANG-SP`; note `direct current Spanish transfer support`.
- `Swedish`: banks `HIST`, `ENGL`; chains none; note `support-only; no current Swedish language bank at GRC`.
- `Voice, B.M.`: banks `MUSIC`; chains none; note `direct music support`.

## UW Bothell

### STEM, Computing, And Quantitative Majors

- `Applied Computing (BA)`: banks `CS`, `MATH`, `COMM`, `BUS`; chains `CS-NEW`, `MATH-STEM`; note `supportive computing prep`.
- `Biology (BS)`: banks `BIO`, `CHEM`, `MATH`; chains `BIO-MAJORS`, `CHEM-GEN`, `MATH-STEM`; note `direct science-prep coverage`.
- `Chemistry (BA)`: banks `CHEM`, `MATH`, `PHYS`; chains `CHEM-GEN`, `CHEM-ORG`, `MATH-STEM`, `PHYS-CALC`; note `direct science-prep coverage`.
- `Chemistry (BS)`: banks `CHEM`, `MATH`, `PHYS`; chains `CHEM-GEN`, `CHEM-ORG`, `MATH-STEM`, `PHYS-CALC`; note `direct science-prep coverage`.
- `Chemistry: Biochemistry (BS)`: banks `CHEM`, `BIO`, `MATH`, `PHYS`; chains `CHEM-GEN`, `CHEM-ORG`, `BIO-MAJORS`, `MATH-STEM`, `PHYS-CALC`; note `direct science-prep coverage`.
- `Computer Engineering (BS)`: banks `CS`, `MATH`, `PHYS`, `ENGR`, `CHEM`; chains `CS-NEW`, `MATH-STEM`, `PHYS-CALC`, `CHEM-GEN`; note `direct engineering-prep coverage`.
- `Computer Science & Software Engineering (BS)`: banks `CS`, `MATH`, `PHYS`; chains `CS-NEW`, `MATH-STEM`, `PHYS-CALC`; note `direct computing prep`.
- `Computer Science & Software Engineering: Information Assurance & Cybersecurity (BS)`: banks `CS`, `MATH`, `COMM`; chains `CS-NEW`, `MATH-STEM`; note `supportive prep only`.
- `Conservation & Restoration Science (BS)`: banks `EARTH`, `BIO`, `CHEM`, `MATH`; chains `BIO-MAJORS`, `CHEM-GEN`, `MATH-STEM`, `NATRS-COMBO`; note `strong environment/restoration prep`.
- `Data Visualization (BA)`: banks `MATH`, `CS`, `ART`, `COMM`; chains `MATH-STEM`, `CS-NEW`; note `supportive prep only`.
- `Data Visualization (BS)`: banks `MATH`, `CS`, `ART`, `COMM`; chains `MATH-STEM`, `CS-NEW`; note `supportive prep only`.
- `Earth System Science (BS)`: banks `EARTH`, `CHEM`, `MATH`, `PHYS`; chains `MATH-STEM`, `PHYS-CALC`, `CHEM-GEN`; note `direct earth-science support`.
- `Electrical Engineering (BS)`: banks `ENGR`, `CS`, `MATH`, `PHYS`, `CHEM`; chains `CS-NEW`, `MATH-STEM`, `PHYS-CALC`, `CHEM-GEN`; note `direct engineering-prep coverage`.
- `Mathematical Thinking & Visualization (BA)`: banks `MATH`, `CS`, `ART`; chains `MATH-STEM`, `CS-NEW`; note `supportive prep only`.
- `Mathematics (BS)`: banks `MATH`, `PHYS`, `CS`; chains `MATH-STEM`, `PHYS-CALC`, `CS-NEW`; note `direct quantitative prep`.
- `Mechanical Engineering (BS)`: banks `ENGR`, `MATH`, `PHYS`, `CHEM`; chains `MATH-STEM`, `PHYS-CALC`, `CHEM-GEN`; note `direct engineering-prep coverage`.
- `Physics (BA)`: banks `PHYS`, `MATH`, `CHEM`; chains `PHYS-CALC`, `MATH-STEM`, `CHEM-GEN`; note `direct science-prep coverage`.
- `Physics (BS)`: banks `PHYS`, `MATH`, `CHEM`; chains `PHYS-CALC`, `MATH-STEM`, `CHEM-GEN`; note `direct science-prep coverage`.

### Business, Health, Education, And Social Science Majors

- `Business Administration (BA)`: banks `BUS`, `MATH`; chains `MATH-BUS`, `ACCT-COMBO`; note `base business pathway`.
- `Business Administration: Accounting (BA)`: banks `BUS`, `MATH`; chains `MATH-BUS`, `ACCT-COMBO`; note `accounting-focused business pathway`.
- `Business Administration: Finance (BA)`: banks `BUS`, `MATH`; chains `MATH-BUS`, `ACCT-COMBO`; note `finance-focused business pathway`.
- `Business Administration: Leadership & Strategic Innovation (BA)`: banks `BUS`, `MATH`, `COMM`; chains `MATH-BUS`; note `supportive business prep only`.
- `Business Administration: Marketing (BA)`: banks `BUS`, `COMM`, `MATH`; chains `MATH-BUS`; note `supportive business prep only`.
- `Business Administration: Supply Chain Management (BA)`: banks `BUS`, `MATH`; chains `MATH-BUS`; note `supportive business prep only`.
- `Developmental and Youth Studies (BA)`: banks `PSYED`; chains none; note `direct education/child-development support`.
- `Economics (BS)`: banks `BUS`, `MATH`; chains `MATH-BUS`, `MATH-STEM`; note `economics plus quantitative prep`.
- `Educational Studies: Elementary Education (BA)`: banks `PSYED`, `MATH`; chains `MATH-BUS`; note `teacher-prep support through ECED/EDUC plus math`.
- `Health Studies (BA)`: banks `BIO`, `HEALTH`, `PSYED`; chains `BIO-ANAT`; note `supportive prep only`.
- `Law, Economics & Public Policy (BA)`: banks `POLSOC`, `BUS`, `PHIL`; chains `MATH-BUS`; note `supportive policy/econ prep`.
- `Nursing (BS), First Year RN to BSN (Direct Entry)`: banks `BIO`, `CHEM`, `HEALTH`, `PSYED`, `COMM`; chains `BIO-ANAT`, `CHEM-GEN`; note `pre-nursing prep only`.
- `Nursing (BS), RN to BSN`: banks `BIO`, `CHEM`, `HEALTH`, `PSYED`, `COMM`; chains `BIO-ANAT`, `CHEM-GEN`; note `for licensed RN students, planner should treat this as support-only`.
- `Psychology (BA)`: banks `PSYED`, `BIO`; chains none; note `direct psychology support`.
- `Science, Technology & Society (BA)`: banks `ENGL`, `HIST`, `PHIL`, `CS`, `MATH`; chains `CS-NEW`, `MATH-STEM`; note `supportive interdisciplinary prep`.
- `Society, Ethics & Human Behavior (BA)`: banks `PHIL`, `POLSOC`, `PSYED`, `HIST`; chains none; note `supportive interdisciplinary prep`.

### Arts, Humanities, Media, And Global Majors

- `American & Ethnic Studies (BA)`: banks `AAMES`, `HIST`, `ENGL`; chains none; note `direct subject support`.
- `Culture, Literature & the Arts (BA)`: banks `ENGL`, `ART`, `PERF`, `MUSIC`, `HIST`; chains `ENGL-250`; note `supportive interdisciplinary arts/humanities prep`.
- `Environmental Studies (BA)`: banks `EARTH`, `HIST`, `POLSOC`, `ENGL`; chains none; note `supportive prep only`.
- `Gender, Women, & Sexuality Studies (BA)`: banks `PHIL`, `HIST`, `POLSOC`, `PSYED`, `AAMES`; chains none; note `supportive prep only`.
- `Global Studies (BA)`: banks `HIST`, `POLSOC`, `ENGL`, `LANG-CHIN`, `LANG-FR`, `LANG-GER`, `LANG-JP`, `LANG-SP`; chains `LANG-CHIN`, `LANG-FR`, `LANG-GER`, `LANG-JP`, `LANG-SP`; note `supportive prep only`.
- `Interactive Media Design (BA)`: banks `ART`, `COMM`, `CS`; chains `CS-NEW`; note `supportive media/design prep`.
- `Interdisciplinary Arts (BA)`: banks `ART`, `PERF`, `MUSIC`, `ENGL`; chains none; note `supportive prep only`.
- `Interdisciplinary Studies: Individualized Study (BA)`: banks `varies`; chains `varies`; note `planner must build a custom bank set`.
- `Media & Communications Studies (BA)`: banks `COMM`; chains `COMM-266`; note `direct media/communication support`.

## UW Tacoma

### Engineering, Computing, And Quantitative Majors

- `Biomedical Sciences (BS)`: banks `BIO`, `CHEM`, `PHYS`, `MATH`; chains `BIO-MAJORS`, `CHEM-GEN`, `CHEM-ORG`, `PHYS-CALC`, `MATH-STEM`; note `direct science-prep coverage`.
- `Civil Engineering (BSCE)`: banks `ENGR`, `MATH`, `PHYS`, `CHEM`; chains `MATH-STEM`, `PHYS-CALC`, `CHEM-GEN`; note `direct engineering-prep coverage`.
- `Computer Engineering (BS)`: banks `CS`, `MATH`, `PHYS`, `ENGR`, `CHEM`; chains `CS-NEW`, `MATH-STEM`, `PHYS-CALC`, `CHEM-GEN`; note `direct engineering-prep coverage`.
- `Computer Science and Systems (BA)`: banks `CS`, `MATH`, `PHYS`; chains `CS-NEW`, `MATH-STEM`, `PHYS-CALC`; note `supportive computing prep`.
- `Computer Science and Systems (BS)`: banks `CS`, `MATH`, `PHYS`; chains `CS-NEW`, `MATH-STEM`, `PHYS-CALC`; note `direct computing prep`.
- `Electrical Engineering (BSEE)`: banks `ENGR`, `CS`, `MATH`, `PHYS`, `CHEM`; chains `CS-NEW`, `MATH-STEM`, `PHYS-CALC`, `CHEM-GEN`; note `direct engineering-prep coverage`.
- `Environmental Science (BS)`: banks `EARTH`, `BIO`, `CHEM`, `MATH`; chains `BIO-MAJORS`, `CHEM-GEN`, `MATH-STEM`, `NATRS-COMBO`; note `strong environmental-science prep`.
- `Information Technology (BS)`: banks `CS`, `MATH`, `COMM`; chains `CS-NEW`, `MATH-STEM`; note `supportive IT prep only`.
- `Mathematics (BS)`: banks `MATH`, `CS`, `PHYS`; chains `MATH-STEM`, `CS-NEW`, `PHYS-CALC`; note `direct quantitative prep`.
- `Mechanical Engineering (BSME)`: banks `ENGR`, `MATH`, `PHYS`, `CHEM`; chains `MATH-STEM`, `PHYS-CALC`, `CHEM-GEN`; note `direct engineering-prep coverage`.
- `Urban Design (BS)`: banks `ART`, `EARTH`, `MATH`; chains `MATH-STEM`; note `supportive design/environment prep only`.

### Business, Policy, Health, And Social Science Majors

- `Bachelor of Arts in Business Administration (BABA)`: banks `BUS`, `MATH`; chains `MATH-BUS`, `ACCT-COMBO`; note `use accounting/finance/management/marketing options after transfer`.
- `Criminal Justice (BA)`: banks `POLSOC`; chains none; note `direct CJ support`.
- `Economics and Policy Analysis (BA)`: banks `BUS`, `POLSOC`, `MATH`; chains `MATH-BUS`, `MATH-STEM`; note `supportive policy/econ prep`.
- `Education (BA)`: banks `PSYED`; chains none; note `direct education-prep support`.
- `Ethnic, Gender and Labor Studies (BA)`: banks `AAMES`, `HIST`, `POLSOC`, `PHIL`, `PSYED`; chains none; note `supportive interdisciplinary prep`.
- `Healthcare Leadership (BA)`: banks `BIO`, `HEALTH`, `BUS`, `PSYED`; chains `BIO-ANAT`, `MATH-BUS`; note `supportive prep only`.
- `Law and Policy (BA)`: banks `POLSOC`, `PHIL`, `HIST`; chains none; note `direct policy-support prep`.
- `Nursing (BSN)`: banks `BIO`, `CHEM`, `HEALTH`, `PSYED`, `COMM`; chains `BIO-ANAT`, `CHEM-GEN`; note `pre-nursing prep only`.
- `Politics, Philosophy and Economics (BA)`: banks `POLSOC`, `PHIL`, `BUS`, `MATH`; chains `MATH-BUS`, `MATH-STEM`; note `supportive PPE prep`.
- `Psychology (BA)`: banks `PSYED`, `BIO`; chains none; note `direct psychology support`.
- `Social Welfare (BA)`: banks `POLSOC`, `PSYED`, `HIST`; chains none; note `supportive prep only`.
- `Urban Studies (BA)`: banks `EARTH`, `POLSOC`, `MATH`; chains none; note `supportive urban/community planning prep`.

### Arts, Humanities, Languages, And Interdisciplinary Majors

- `Arts, Media and Culture (BA)`: banks `ART`, `COMM`, `PERF`, `MUSIC`, `ENGL`, `HIST`; chains `COMM-266`, `ENGL-250`; note `supportive interdisciplinary arts prep`.
- `Communications (BA)`: banks `COMM`; chains `COMM-266`; note `direct communication support`.
- `Environmental Sustainability (BA)`: banks `EARTH`, `POLSOC`, `HIST`, `ENGL`; chains none; note `supportive prep only`.
- `History (BA)`: banks `HIST`, `ENGL`; chains `HIST-US`; note `direct history support`.
- `Interdisciplinary Arts and Sciences (BA)`: banks `varies`; chains `varies`; note `planner should choose banks by student concentration`.
- `Interdisciplinary Arts and Sciences: Individually-designed (BA)`: banks `varies`; chains `varies`; note `planner must build a custom bank set`.
- `Spanish Language and Cultures (BA)`: banks `LANG-SP`, `ENGL`; chains `LANG-SP`; note `direct Spanish support`.
- `Sustainable Urban Development (BA)`: banks `EARTH`, `POLSOC`, `MATH`; chains none; note `supportive planning/sustainability prep`.
- `Writing Studies (BA)`: banks `ENGL`, `COMM`; chains `WRIT-SEQ`, `ENGL-250`; note `direct writing/communication support`.

## Bottom Line For The Planner

- Use this file as the degree-to-bank routing layer.
- Use [GRC_UW_CURRENT_EQUIVALENCY_FULL_WITH_SERIES_RULES.md](C:\Users\marwa\GatorGuide\Mobile%20Team\docs\GRC_UW_CURRENT_EQUIVALENCY_FULL_WITH_SERIES_RULES.md) when the planner needs the exact UW equivalency wording.
- Use [GRC_LATEST_TRANSFER_ASSOCIATE_DEGREES_AND_COURSES.md](C:\Users\marwa\GatorGuide\Mobile%20Team\docs\GRC_LATEST_TRANSFER_ASSOCIATE_DEGREES_AND_COURSES.md) when the planner needs the latest current Green River degree-template structure.
- For direct-entry engineering and computer majors, also keep [COURSE_PLANNER_MAJORS_AND_DEGREE_REQUIREMENTS.md](C:\Users\marwa\GatorGuide\Mobile%20Team\docs\COURSE_PLANNER_MAJORS_AND_DEGREE_REQUIREMENTS.md) in the source set because it contains deeper junior/senior requirement notes than this master routing file.
