# Transfer Planner Requirement Source Parse Report

Generated: 2026-04-24T10:56:08.655Z

- Primary degree sources parsed: 424
- Parsed successfully: 424
- Parse failures: 0
- Parsed requirement source adapter blocks: 424
- Parsed requirement atom candidates: 26544
- Parsed degree-map block candidates: 873
- Parsed from cached snapshots after live-source failures: 0
- Parsed from alternate official source URLs: 3
- Owners with parsed UW course codes: 417
- Owners with source-only UW course codes not currently in structured degree-map blocks: 6
- Owners with no parsed UW course codes: 7
- Owners with parser-quality warnings: 13
- Owners with parser-quality notes: 3

## Parser Adapters

- generic-official-html-page: 39
- generic-official-pdf-degree-sheet: 16
- uw-bothell-html-degree-page: 114
- uw-bothell-pdf-worksheet: 3
- uw-seattle-catalog-page: 66
- uw-seattle-html-degree-page: 118
- uw-tacoma-catalog-page: 13
- uw-tacoma-html-degree-page: 55

## Resolution Strategies

- alternate-official-source: 3
- primary-source: 421

## Parser Quality Signals

- alternate-official-source-used: 3
- large-structured-only-course-gap: 6
- material-source-structured-drift: 13

## uw-seattle

### Parser-quality warnings

#### American Ethnic Studies - Honors Thesis Option

- Source: https://aes.washington.edu/ba-american-ethnic-studies
- Parse confidence: medium
- Quality warnings: material-source-structured-drift (parsed=5; source-only=0; structured-only=7)

#### Electrical & Computer Engineering - Digital Systems Design Pathway

- Source: https://www.ece.uw.edu/academics/bachelor-of-science/bsece/degree-requirements/
- Parse confidence: high
- Quality warnings: material-source-structured-drift (parsed=70; source-only=70; structured-only=0)

#### Geography - Health and Development Track

- Source: https://geography.washington.edu/ba-geography
- Parse confidence: high
- Quality warnings: material-source-structured-drift (parsed=19; source-only=19; structured-only=0)

#### History & Philosophy of Science

- Source: https://www.washington.edu/students/gencat/program/S/Philosophy-221.html
- Parse confidence: high
- Quality warnings: material-source-structured-drift (parsed=80; source-only=0; structured-only=23) | large-structured-only-course-gap (structured-only=23; parsed=80; structured-coverage=103)

#### History & Philosophy of Science - Ethics

- Source: https://www.washington.edu/students/gencat/program/S/Philosophy-221.html
- Parse confidence: high
- Quality warnings: material-source-structured-drift (parsed=80; source-only=0; structured-only=23) | large-structured-only-course-gap (structured-only=23; parsed=80; structured-coverage=103)

#### History & Philosophy of Science - the Ancient Philosophy option requires:

- Source: https://www.washington.edu/students/gencat/program/S/Philosophy-221.html
- Parse confidence: high
- Quality warnings: material-source-structured-drift (parsed=80; source-only=0; structured-only=23) | large-structured-only-course-gap (structured-only=23; parsed=80; structured-coverage=103)

#### Mathematics

- Source: https://math.washington.edu/ba-mathematics-standard-major-requirements-0
- Parse confidence: high
- Quality warnings: material-source-structured-drift (parsed=12; source-only=0; structured-only=9) | large-structured-only-course-gap (structured-only=9; parsed=12; structured-coverage=21)

#### Mathematics - Major Option Electives

- Source: https://math.washington.edu/ba-mathematics-standard-major-requirements-0
- Parse confidence: high
- Quality warnings: material-source-structured-drift (parsed=25; source-only=25; structured-only=0)

#### Philosophy

- Source: https://www.washington.edu/students/gencat/program/S/Philosophy-221.html
- Parse confidence: high
- Quality warnings: material-source-structured-drift (parsed=80; source-only=0; structured-only=23) | large-structured-only-course-gap (structured-only=23; parsed=80; structured-coverage=103)

#### Philosophy - Ethics

- Source: https://www.washington.edu/students/gencat/program/S/Philosophy-221.html
- Parse confidence: high
- Quality warnings: material-source-structured-drift (parsed=80; source-only=0; structured-only=23) | large-structured-only-course-gap (structured-only=23; parsed=80; structured-coverage=103)

### Possible source-vs-structured drift

#### Electrical & Computer Engineering - Digital Systems Design Pathway

- Source: https://www.ece.uw.edu/academics/bachelor-of-science/bsece/degree-requirements/
- Parser type: html-degree-page
- Parser adapter: uw-seattle-html-degree-page
- Resolution strategy: primary-source
- Parse confidence: high
- Source-only UW course codes: AMATH 351, AMATH 352, BIOL 161, BIOL 162, CHEM 142, CHEM 143, CHEM 145, CHEM 152, CHEM 153, CHEM 155, CHEM 220, CSE 121, CSE 122, CSE 123, CSE 142, CSE 143, CSE 373, CSE 374, CSE 410, CSE 413, EE 233, EE 331, EE 332, EE 371, EE 393, EE 397, EE 398, EE 406, EE 418, EE 419, EE 437, EE 447, EE 449, EE 461, EE 469, EE 470, EE 473, EE 474, EE 475, EE 476, EE 477, EE 478, EE 490, EE 491, EE 492, EE 497, EE 498, EE 499, ENGL 131, ENGR 101, ENGR 321, ENGR 333, INDE 315, MATH 124, MATH 125, MATH 126, MATH 134, MATH 135, MATH 136, MATH 207, MATH 208, MATH 224, PHYS 121, PHYS 122, PHYS 141, PHYS 142, STAT 390, TAKEN CSE 123, TAKEN CSE 143, UNLESS MATH 135
- Requirement cues: (Only EE course credits may apply except where specifically noted) | 1.A. BSECE Major Requirements and Electives (73-80 credits) *For Students Admitted to Start in ECE in Autumn 2025 and Onward* | 1.B. BSECE Major Requirements and Electives (66-69 credits) *For Students Admitted Prior to Autumn 2025*
- Snapshot: C:\Users\marwa\GatorGuide\Mobile Team\.tmp\transfer-planner-requirement-source-snapshots\uw-seattle-electrical-computer-engineering-pathway-digital-systems-design-pathway.txt

#### Geography - Health and Development Track

- Source: https://geography.washington.edu/ba-geography
- Parser type: html-degree-page
- Parser adapter: uw-seattle-html-degree-page
- Resolution strategy: primary-source
- Parse confidence: high
- Source-only UW course codes: AMONG GEOG 317, AMONG GEOG 326, AMONG GEOG 425, AMONG GEOG 426, GEOG 123, GEOG 230, GEOG 245, GEOG 258, GEOG 280, GEOG 315, GEOG 360, GEOG 381, GEOG 458, GEOG 461, GEOG 465, GEOG 469, GEOG 482, GEOG 496, GEOG 499
- Requirement cues: A combined total of 5 credits of Internship (GEOG 496) and Independent Study (GEOG 499) may be counted towards the required 60 geography credits. | B.A. in Geography: Data Science Option | B.A. in Geography: Data Science Option Sample Course Plan
- Snapshot: C:\Users\marwa\GatorGuide\Mobile Team\.tmp\transfer-planner-requirement-source-snapshots\uw-seattle-geography-pathway-health-and-development-track.txt

#### Mathematics - Major Option Electives

- Source: https://math.washington.edu/ba-mathematics-standard-major-requirements-0
- Parser type: html-overview-page
- Parser adapter: uw-seattle-html-degree-page
- Resolution strategy: primary-source
- Parse confidence: high
- Source-only UW course codes: APPLIED AS 300, EXCLUDE MATH 300, EXCLUDE MATH 382, EXCLUDE MATH 397, EXCLUDE MATH 398, EXCLUDE MATH 399, EXCLUDE MATH 497, EXCLUDE MATH 498, EXCLUDE MATH 499, EXCLUDES MATH 420, MATH 124, MATH 125, MATH 126, MATH 134, MATH 135, MATH 136, MATH 200, MATH 207, MATH 208, MATH 224, MATH 300, MATH 402, MATH 403, MATH 411, MATH 412
- Requirement cues: B.A. Mathematics - Standard Major Requirements | Department of Mathematics | University of Washington | Transfer Credit Evaluations | B.A. Mathematics - Standard Major Requirements
- Snapshot: C:\Users\marwa\GatorGuide\Mobile Team\.tmp\transfer-planner-requirement-source-snapshots\uw-seattle-mathematics-pathway-major-option-electives.txt

### Parsed but no UW course codes found

- Art History - Textual Studies)
  - Source: https://www.washington.edu/students/gencat/program/S/Art+ArtHistory+Design-105.html
  - Parser type: catalog-page
  - Requirement cues found: 0
- Italian
  - Source: https://frenchitalian.washington.edu/undergraduate-studies-italian
  - Parser type: html-degree-page
  - Requirement cues found: 5

## uw-bothell

### Parser-quality warnings

#### Business Administration: Accounting (BA) - Management Concentration

- Source: https://www.uwb.edu/business/undergraduate/bachelor-of-business-administration/accounting
- Parse confidence: high
- Quality warnings: material-source-structured-drift (parsed=52; source-only=52; structured-only=0)

#### Business Administration: Accounting (BA) - MIS Concentration

- Source: https://www.uwb.edu/business/undergraduate/bachelor-of-business-administration/accounting
- Parse confidence: high
- Quality warnings: material-source-structured-drift (parsed=46; source-only=46; structured-only=0)

#### Educational Studies: Elementary Education (BA) - See Elementary Education Option

- Source: https://www.uwb.edu/education/undergraduate/elementary-education/degree-requirements
- Parse confidence: high
- Quality warnings: material-source-structured-drift (parsed=33; source-only=33; structured-only=0)

### Possible source-vs-structured drift

#### Business Administration: Accounting (BA) - Management Concentration

- Source: https://www.uwb.edu/business/undergraduate/bachelor-of-business-administration/accounting
- Parser type: html-overview-page
- Parser adapter: uw-bothell-html-degree-page
- Resolution strategy: primary-source
- Parse confidence: high
- Source-only UW course codes: B CUSP 202, BBUS 210, BBUS 211, BBUS 215, BBUS 220, BBUS 221, BBUS 230, BBUS 300, BBUS 307, BBUS 310, BBUS 320, BBUS 330, BBUS 340, BBUS 350, BBUS 361, BBUS 373, BBUS 441, BBUS 443, BBUS 444, BBUS 451, BBUS 453, BBUS 454, BBUS 470, BBUS 471, BBUS 476, BBUS 480, BBUS 490, BBUS 491, BIS 200, BIS 201, BIS 215, BMATH 144, BMATH 215, BWRIT 135, INDE 315, MATH 112, MATH 390, PSYCH 315, PSYCH 317, PSYCH 318, QMETH 201, QSCI 291, QSCI 381, STAT 220, STAT 221, STAT 311, STAT 390, STMATH 113, STMATH 124, STMATH 125, STMATH 126, STMATH 341
- Requirement cues: * A minimum grade of 2.7 in either course is required. | **Accounting Option students who add a Finance Concentration cannot count the following courses as Accounting Option electives: | *Accounting Option students who add a Finance Concentration cannot use the following courses as part of their Finance Concentration (i.e., no double-counting of courses):
- Snapshot: C:\Users\marwa\GatorGuide\Mobile Team\.tmp\transfer-planner-requirement-source-snapshots\uw-bothell-business-administration-accounting-pathway-management-concentration.txt

#### Business Administration: Accounting (BA) - MIS Concentration

- Source: https://www.uwb.edu/business/undergraduate/bachelor-of-business-administration/accounting
- Parser type: html-overview-page
- Parser adapter: uw-bothell-html-degree-page
- Resolution strategy: primary-source
- Parse confidence: high
- Source-only UW course codes: B CUSP 202, BBUS 210, BBUS 211, BBUS 215, BBUS 220, BBUS 221, BBUS 230, BBUS 300, BBUS 307, BBUS 310, BBUS 320, BBUS 340, BBUS 350, BBUS 361, BBUS 373, BBUS 451, BBUS 453, BBUS 454, BBUS 470, BBUS 480, BBUS 490, BBUS 491, BIS 200, BIS 201, BIS 215, BMATH 144, BMATH 215, BWRIT 135, INDE 315, MATH 112, MATH 390, PSYCH 315, PSYCH 317, PSYCH 318, QMETH 201, QSCI 291, QSCI 381, STAT 220, STAT 221, STAT 311, STAT 390, STMATH 113, STMATH 124, STMATH 125, STMATH 126, STMATH 341
- Requirement cues: * A minimum grade of 2.7 in either course is required. | **Accounting Option students who add a Finance Concentration cannot count the following courses as Accounting Option electives: | *Accounting Option students who add a Finance Concentration cannot use the following courses as part of their Finance Concentration (i.e., no double-counting of courses):
- Snapshot: C:\Users\marwa\GatorGuide\Mobile Team\.tmp\transfer-planner-requirement-source-snapshots\uw-bothell-business-administration-accounting-pathway-mis-concentration.txt

#### Educational Studies: Elementary Education (BA) - See Elementary Education Option

- Source: https://www.uwb.edu/education/undergraduate/elementary-education/degree-requirements
- Parser type: html-degree-page
- Parser adapter: uw-bothell-html-degree-page
- Resolution strategy: primary-source
- Parse confidence: high
- Source-only UW course codes: BEDUC 170, BEDUC 205, BEDUC 210, BEDUC 240, BEDUC 241, BEDUC 242, BEDUC 250, BEDUC 340, BIS 164, BIS 175, BIS 180, BIS 200, BIS 203, BIS 206, BIS 218, BIS 242, BIS 280, BIS 301, BIS 361, BIS 370, BIS 371, BIS 377, BIS 379, BIS 387, BIS 388, BIS 389, BIS 407, BIS 455, BIS 481, BIS 486, BIS 487, BWRIT 133, BWRIT 134
- Requirement cues: Students will receive support and guidance on all certification requirements from academic advisors, field placement coordinators, and field instructors. | The Elementary Education Option requires that students complete a student teaching practicum, along with a practicum in an English to Speakers of Other Languages (ESOL) classroom OR a practicum in a Special Education classroom. International students with a visa, other than F-1 visa holders, should consult an immigration attorney to determine their eligibility for completing these required practica. F-1 visa holders will need to plan and apply for Curricular Practical Training (CPT) prior to beginning these required practica. If you have any questions, please contact the International Student Services (ISS) office. | Elementary Education Endorsement Academic Breadth Requirements
- Snapshot: C:\Users\marwa\GatorGuide\Mobile Team\.tmp\transfer-planner-requirement-source-snapshots\uw-bothell-educational-studies-elementary-education-pathway-see-elementary-education-option.txt

### Parsed but no UW course codes found

- Developmental and Youth Studies (BA) - M.Ed. with Educating for Critical Race Theory (E-Crit) Concentration
  - Source: https://www.uwb.edu/education/undergraduate/developmental-and-youth-studies/degree-requirements
  - Parser type: html-degree-page
  - Requirement cues found: 5
- Economics (BS) - Leadership & Strategic Innovation Option
  - Source: https://www.uwb.edu/business/undergraduate/bachelor-of-economics
  - Parser type: html-overview-page
  - Requirement cues found: 11
- Economics (BS) - Supply Chain Management Option
  - Source: https://www.uwb.edu/business/undergraduate/bachelor-of-economics
  - Parser type: html-overview-page
  - Requirement cues found: 11

## uw-tacoma

### Parsed but no UW course codes found

- Arts, Media and Culture (BA)
  - Source: https://www.tacoma.uw.edu/sias/cac/arts-media-culture
  - Parser type: html-overview-page
  - Requirement cues found: 10
- Communications (BA) - Professional TRACK
  - Source: https://www.tacoma.uw.edu/sias/cac/communication
  - Parser type: html-degree-page
  - Requirement cues found: 5

