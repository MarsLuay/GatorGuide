"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TRANSFER_PLANNER_MASTER_MAJOR_ROWS = exports.TRANSFER_PLANNER_MASTER_BANK_LIBRARY = exports.TRANSFER_PLANNER_MASTER_CHAIN_LIBRARY = void 0;
exports.TRANSFER_PLANNER_MASTER_CHAIN_LIBRARY = [
    {
        "id": "WRIT-SEQ",
        "type": "GRC sequence",
        "rule": "`ENGL\u0026 101` stands alone for UW composition. Common Green River follow-on writing/literature path is `ENGL\u0026 101 -\u003e ENGL 126 or ENGL 127 or ENGL 128`."
    },
    {
        "id": "MATH-STEM",
        "type": "GRC sequence",
        "rule": "`MATH\u0026 151 -\u003e MATH\u0026 152 -\u003e MATH\u0026 163 -\u003e MATH\u0026 254 -\u003e MATH 238 -\u003e MATH 240`. Current UW outcomes in order are `MATH 124`, `125`, `126`, `224 (4) + 2XX (1)`, `207 (4) + 2XX (1)`, and `208 (4) + 2XX (1)`."
    },
    {
        "id": "MATH-BUS",
        "type": "GRC sequence",
        "rule": "Business / less-calculus-heavy planning commonly uses `MATH\u0026 141 -\u003e MATH\u0026 142` or `MATH 147 -\u003e MATH\u0026 148`. `MATH\u0026 146` and `MATH 256` are standalone quantitative options."
    },
    {
        "id": "CS-NEW",
        "type": "GRC sequence",
        "rule": "`CS 121 -\u003e CS 122 -\u003e CS 123`. Current UW equivalency entries are separate, but planner sequencing at GRC should treat them in this order."
    },
    {
        "id": "CS-LEGACY",
        "type": "GRC sequence",
        "rule": "`CS\u0026 141 -\u003e CS 145` is the older CSE `142 -\u003e 143` path. `CS\u0026 131 -\u003e CS 132` is a separate current alternate intro path."
    },
    {
        "id": "PHYS-CALC",
        "type": "GRC sequence",
        "rule": "`PHYS\u0026 221 -\u003e PHYS\u0026 222 -\u003e PHYS\u0026 223` for calculus-based physics."
    },
    {
        "id": "PHYS-ALG",
        "type": "GRC sequence",
        "rule": "`PHYS\u0026 114 or PHYS\u0026 154 -\u003e PHYS\u0026 115 or PHYS\u0026 155 -\u003e PHYS\u0026 116 or PHYS\u0026 156` for algebra-based physics."
    },
    {
        "id": "CHEM-GEN",
        "type": "Both",
        "rule": "`CHEM\u0026 161 -\u003e CHEM\u0026 162 -\u003e CHEM\u0026 163`. Current UW full-credit note: `CHEM\u0026 162 + CHEM\u0026 163` gives `CHEM 152, 162 (5, 5), 1XX (2)`; otherwise each is weaker `CHEM 1XX`."
    },
    {
        "id": "CHEM-ORG",
        "type": "Both",
        "rule": "`CHEM\u0026 261 -\u003e CHEM\u0026 262 -\u003e CHEM\u0026 263`. Current UW full-credit notes: `261 + 262` strengthens the outcome, and `261 + 262 + 263` yields the full `CHEM 237, 238, 239, 241, 242` package."
    },
    {
        "id": "BIO-MAJORS",
        "type": "Both",
        "rule": "`BIOL\u0026 211 -\u003e BIOL\u0026 212 -\u003e BIOL\u0026 213`. All three are needed for the full `BIOL 180, 200, 220, 2XX (3)` outcome."
    },
    {
        "id": "BIO-ANAT",
        "type": "Both",
        "rule": "`BIOL\u0026 241 -\u003e BIOL\u0026 242`. Both are needed for `BIOL 118`, `BIOL 119`, and `NURS 301` credit."
    },
    {
        "id": "ACCT-COMBO",
        "type": "Both",
        "rule": "`ACCT\u0026 201 + ACCT\u0026 202` are required for the stronger `ACCTG 215 (5), B A 2XX (5)` outcome. `ACCT\u0026 203` then gives `ACCTG 225 (5)`."
    },
    {
        "id": "ASTR-COMBO",
        "type": "UW full-credit combo",
        "rule": "`ASTR\u0026 100 + ASTR\u0026 101`: either course gives `ASTR 101 (5)` and the second adds `1XX (5)`."
    },
    {
        "id": "HIST-US",
        "type": "UW full-credit combo",
        "rule": "`HIST\u0026 136 + HIST\u0026 137` together yield `HSTAA 101 (5), 1XX (5)`."
    },
    {
        "id": "ENGL-250",
        "type": "UW full-credit combo",
        "rule": "`ENGL\u0026 244 + ENGL\u0026 245` together yield `ENGL 250 (5)` plus additional `2XX` credit."
    },
    {
        "id": "COMM-266",
        "type": "UW full-credit combo",
        "rule": "`CMST 266` yields `CMS 272` only if taken for `5` credits; otherwise it stays `CMS 2XX`."
    },
    {
        "id": "LANG-CHIN",
        "type": "GRC sequence",
        "rule": "`CHIN\u0026 121 -\u003e CHIN\u0026 122 -\u003e CHIN\u0026 123`."
    },
    {
        "id": "LANG-FR",
        "type": "GRC sequence",
        "rule": "`FRCH\u0026 121 -\u003e FRCH\u0026 122 -\u003e FRCH\u0026 123 -\u003e FRCH\u0026 221`."
    },
    {
        "id": "LANG-GER",
        "type": "GRC sequence",
        "rule": "`GERM\u0026 121 -\u003e GERM\u0026 122 -\u003e GERM\u0026 123`."
    },
    {
        "id": "LANG-JP",
        "type": "GRC sequence",
        "rule": "`JAPN\u0026 121 -\u003e JAPN\u0026 122 -\u003e JAPN\u0026 123`."
    },
    {
        "id": "LANG-SP",
        "type": "GRC sequence",
        "rule": "`SPAN\u0026 121 -\u003e SPAN\u0026 122 -\u003e SPAN\u0026 123 -\u003e SPAN\u0026 221 -\u003e SPAN\u0026 222 -\u003e SPAN\u0026 223`."
    },
    {
        "id": "NATRS-COMBO",
        "type": "UW full-credit combo",
        "rule": "`NATRS 180 + NATRS 292` has a special combined ESRM-major rule on the UW guide."
    }
];
exports.TRANSFER_PLANNER_MASTER_BANK_LIBRARY = [
    {
        "id": "WRIT",
        "courses": [
            "ENGL\u0026 101",
            "ENGL 126",
            "ENGL 127",
            "ENGL 128"
        ]
    },
    {
        "id": "MATH",
        "courses": [
            "MATH 106",
            "MATH\u0026 107",
            "MATH\u0026 141",
            "MATH\u0026 142",
            "MATH\u0026 146",
            "MATH 147",
            "MATH\u0026 148",
            "MATH\u0026 151",
            "MATH\u0026 152",
            "MATH\u0026 163",
            "MATH\u0026 171",
            "MATH\u0026 172",
            "MATH\u0026 173",
            "MATH 194",
            "MATH 238",
            "MATH 240",
            "MATH\u0026 254",
            "MATH 256",
            "MATH 297"
        ]
    },
    {
        "id": "CS",
        "courses": [
            "CS 121",
            "CS 122",
            "CS 123",
            "CS\u0026 131",
            "CS 132",
            "CS\u0026 141",
            "CS 145",
            "CS 202"
        ]
    },
    {
        "id": "ENGR",
        "courses": [
            "ENGR 100",
            "ENGR\u0026 104",
            "ENGR 106",
            "ENGR\u0026 114",
            "ENGR 140",
            "ENGR 199",
            "ENGR\u0026 204",
            "ENGR\u0026 214",
            "ENGR\u0026 215",
            "ENGR\u0026 224",
            "ENGR\u0026 225",
            "ENGR 250"
        ]
    },
    {
        "id": "PHYS",
        "courses": [
            "PHYS\u0026 110",
            "PHYS\u0026 114",
            "PHYS\u0026 154",
            "PHYS\u0026 115",
            "PHYS\u0026 155",
            "PHYS\u0026 116",
            "PHYS\u0026 156",
            "PHYS\u0026 221",
            "PHYS\u0026 222",
            "PHYS\u0026 223",
            "PHYS 225",
            "PHYS 229",
            "PHYS 298"
        ]
    },
    {
        "id": "CHEM",
        "courses": [
            "CHEM\u0026 121",
            "CHEM\u0026 131",
            "CHEM\u0026 140",
            "CHEM\u0026 161",
            "CHEM\u0026 162",
            "CHEM\u0026 163",
            "CHEM 194",
            "CHEM 195",
            "CHEM\u0026 261",
            "CHEM\u0026 262",
            "CHEM\u0026 263",
            "CHEM 296",
            "CHEM 299"
        ]
    },
    {
        "id": "BIO",
        "courses": [
            "AP 100",
            "AP 102",
            "AP 103",
            "AP 104",
            "AP 210",
            "BIOL\u0026 100",
            "BIOL 103",
            "BIOL 110",
            "BIOL 125",
            "BIOL 127",
            "BIOL 140",
            "BIOL 194",
            "BIOL 195",
            "BIOL\u0026 211",
            "BIOL\u0026 212",
            "BIOL\u0026 213",
            "BIOL\u0026 241",
            "BIOL\u0026 242",
            "BIOL\u0026 260",
            "BIOL 298"
        ]
    },
    {
        "id": "EARTH",
        "courses": [
            "ASTR\u0026 100",
            "ASTR\u0026 101",
            "ENV S 204",
            "GIS 202",
            "GIS 260",
            "GEOG\u0026 100",
            "GEOG 120",
            "GEOG 123",
            "GEOG 190",
            "GEOG\u0026 200",
            "GEOG 201",
            "GEOG 205",
            "GEOG 298",
            "GEOG 299",
            "GEOL\u0026 101",
            "GEOL 150",
            "GEOL 152",
            "GEOL 153",
            "GEOL 200",
            "GEOL 206",
            "GEOL\u0026 208",
            "GEOL 299",
            "NATRS 100",
            "NATRS 117",
            "NATRS 161",
            "NATRS 162",
            "NATRS 172",
            "NATRS 180",
            "NATRS 181",
            "NATRS 182",
            "NATRS 183",
            "NATRS 184",
            "NATRS 198",
            "NATRS 199",
            "NATRS 210",
            "NATRS 270",
            "NATRS 271",
            "NATRS 284",
            "NATRS 285",
            "NATRS 286",
            "NATRS 292",
            "NATRS 293",
            "NATRS 294",
            "NATRS 297",
            "NATRS 298",
            "NATRS 299",
            "IDS 101",
            "IDS 102",
            "IDS 103",
            "OCEA\u0026 101"
        ]
    },
    {
        "id": "BUS",
        "courses": [
            "ACCT\u0026 201",
            "ACCT\u0026 202",
            "ACCT\u0026 203",
            "BUS\u0026 101",
            "BUS 121",
            "BUS\u0026 201",
            "BUS 258",
            "ECON 100",
            "ECON 101",
            "ECON 194",
            "ECON\u0026 201",
            "ECON\u0026 202",
            "ECON 298",
            "ECON 299"
        ]
    },
    {
        "id": "AAMES",
        "courses": [
            "AMES 100",
            "AMES 150",
            "AMES 194",
            "AMES 211",
            "ANTH\u0026 100",
            "ANTH 194",
            "ANTH\u0026 204",
            "ANTH\u0026 205",
            "ANTH\u0026 206",
            "ANTH\u0026 210",
            "ANTH 211",
            "ANTH\u0026 216",
            "ANTH\u0026 234",
            "ANTH\u0026 235",
            "ANTH\u0026 236",
            "ANTH 273",
            "ANTH 294",
            "ANTH 298",
            "ANTH 299",
            "S SCI 160",
            "S SCI 194",
            "S SCI 211"
        ]
    },
    {
        "id": "COMM",
        "courses": [
            "CMST\u0026 102",
            "CMST 194",
            "CMST\u0026 210",
            "CMST 212",
            "CMST 215",
            "CMST\u0026 220",
            "CMST\u0026 230",
            "CMST 238",
            "CMST 245",
            "CMST 265",
            "CMST 266",
            "CMST 299",
            "FILM 120",
            "FILM 121",
            "FILM 122",
            "JOURN 100.1",
            "JOURN 100.2",
            "JOURN 100.3",
            "JOURN 101",
            "JOURN 103",
            "JOURN 107",
            "JOURN 110",
            "JOURN 111",
            "JOURN 112",
            "JOURN 120",
            "JOURN 121",
            "JOURN 122",
            "JOURN 150",
            "JOURN 151",
            "JOURN 152",
            "JOURN 153",
            "JOURN 198",
            "JOURN 199",
            "JOURN 200",
            "JOURN 205",
            "JOURN 206",
            "JOURN 207",
            "JOURN 254",
            "JOURN 255",
            "JOURN 298",
            "JOURN 299"
        ]
    },
    {
        "id": "ENGL",
        "courses": [
            "ENGL 103",
            "ENGL 109",
            "ENGL\u0026 112",
            "ENGL\u0026 113",
            "ENGL\u0026 114",
            "ENGL 115",
            "ENGL 126",
            "ENGL 127",
            "ENGL 128",
            "ENGL 160",
            "ENGL 161",
            "ENGL 163",
            "ENGL 164",
            "ENGL 165",
            "ENGL 168",
            "ENGL 180",
            "ENGL 181",
            "ENGL 183",
            "ENGL 185",
            "ENGL 187",
            "ENGL 190",
            "ENGL 194",
            "ENGL 199",
            "ENGL\u0026 220",
            "ENGL\u0026 226",
            "ENGL\u0026 227",
            "ENGL\u0026 228",
            "ENGL\u0026 236",
            "ENGL\u0026 237",
            "ENGL 239",
            "ENGL\u0026 244",
            "ENGL\u0026 245",
            "ENGL\u0026 246",
            "ENGL 247",
            "ENGL 248",
            "ENGL 249",
            "ENGL\u0026 254",
            "ENGL\u0026 255",
            "ENGL\u0026 256",
            "ENGL 257",
            "ENGL 299"
        ]
    },
    {
        "id": "HIST",
        "courses": [
            "HIST 101",
            "HIST 102",
            "HIST 103",
            "HIST 120",
            "HIST 122",
            "HIST 135",
            "HIST\u0026 136",
            "HIST\u0026 137",
            "HIST 194",
            "HIST\u0026 214",
            "HIST\u0026 215",
            "HIST 220",
            "HIST 224",
            "HIST 226",
            "HIST 228",
            "HIST 230",
            "HIST 231",
            "HIST 232",
            "HIST 233",
            "HIST 235",
            "HIST 237",
            "HIST 240",
            "HIST 245",
            "HIST 250",
            "HIST 299",
            "HUMAN 100",
            "HUMAN 110",
            "HUMAN 133",
            "HUMAN 142",
            "HUMAN 186",
            "HUMAN 190",
            "HUMAN 191",
            "HUMAN 194",
            "HUMAN 224"
        ]
    },
    {
        "id": "PHIL",
        "courses": [
            "PHIL\u0026 101",
            "PHIL 102",
            "PHIL 103",
            "PHIL 104",
            "PHIL 105",
            "PHIL 110",
            "PHIL 112",
            "PHIL 114",
            "PHIL 115",
            "PHIL\u0026 120",
            "PHIL 160",
            "PHIL 194",
            "PHIL 200",
            "PHIL 206",
            "PHIL 210",
            "PHIL 215",
            "PHIL 220",
            "PHIL 236",
            "PHIL 238",
            "PHIL 240",
            "PHIL 243",
            "PHIL 299"
        ]
    },
    {
        "id": "PSYED",
        "courses": [
            "PSYC\u0026 100",
            "PSYC\u0026 180",
            "PSYC\u0026 200",
            "PSYC 201",
            "PSYC 209",
            "PSYC\u0026 220",
            "PSYC 225",
            "PSYC 298",
            "PSYC 299",
            "ECED\u0026 105",
            "ECED\u0026 132",
            "ECED\u0026 134",
            "ECED\u0026 139",
            "ECED 152",
            "ECED 155",
            "ECED\u0026 160",
            "ECED 165",
            "ECED\u0026 170",
            "ECED 175",
            "ECED\u0026 180",
            "ECED\u0026 190",
            "ECED 220",
            "EDUC\u0026 115",
            "EDUC\u0026 130",
            "EDUC\u0026 136",
            "EDUC\u0026 150",
            "EDUC\u0026 204",
            "EDUC\u0026 205",
            "EDUC 240",
            "EDUC 245"
        ]
    },
    {
        "id": "ART",
        "courses": [
            "ART\u0026 100",
            "ART 105",
            "ART 106",
            "ART 107",
            "ART 109",
            "ART 110",
            "ART 111",
            "ART 112",
            "ART 113",
            "ART 114",
            "ART 115",
            "ART 119",
            "ART 120",
            "ART 130",
            "ART 133",
            "ART 135",
            "ART 150",
            "ART 180",
            "ART 199",
            "ART 212",
            "ART 213",
            "ART 214",
            "ART 219",
            "ART 251",
            "ART 252",
            "ART 253",
            "ART 255",
            "ART 256",
            "ART 257",
            "ART 275",
            "ART 276",
            "ART 277",
            "ART 294",
            "ART 295",
            "ART 296",
            "ART 297",
            "ART 298",
            "ART 299",
            "PHOTO 101",
            "PHOTO 102",
            "PHOTO 103",
            "PHOTO 111",
            "PHOTO 112",
            "PHOTO 113"
        ]
    },
    {
        "id": "PERF",
        "courses": [
            "DANCE 101",
            "DANCE 102",
            "DANCE 103",
            "DANCE 110",
            "DANCE 204",
            "DRMA\u0026 101",
            "DRMA 102",
            "DRMA 111",
            "DRMA 112",
            "DRMA 113",
            "DRMA 151",
            "DRMA 152",
            "DRMA 153",
            "DRMA 154",
            "DRMA 155",
            "DRMA 156",
            "DRMA 211",
            "DRMA 212",
            "DRMA 213",
            "DRMA 298"
        ]
    },
    {
        "id": "MUSIC",
        "courses": [
            "MUSC 101",
            "MUSC 103",
            "MUSC 104",
            "MUSC\u0026 105",
            "MUSC 107",
            "MUSC 108",
            "MUSC 109",
            "MUSC 110",
            "MUSC 118",
            "MUSC 119",
            "MUSC 120",
            "MUSC\u0026 121",
            "MUSC\u0026 122",
            "MUSC\u0026 123",
            "MUSC 124",
            "MUSC 125",
            "MUSC 127",
            "MUSC 128",
            "MUSC 129",
            "MUSC 130.1",
            "MUSC 130.2",
            "MUSC 130.3",
            "MUSC\u0026 131",
            "MUSC\u0026 132",
            "MUSC\u0026 133",
            "MUSC 140",
            "MUSC 141",
            "MUSC 142",
            "MUSC 218",
            "MUSC 219",
            "MUSC 220",
            "MUSC\u0026 221",
            "MUSC\u0026 222",
            "MUSC 227",
            "MUSIC 228",
            "MUSIC 229",
            "MUSC 230.1",
            "MUSC 230.2",
            "MUSC 230.3",
            "MUSC\u0026 231",
            "MUSC\u0026 232",
            "MUSC 298",
            "MUSC 299"
        ]
    },
    {
        "id": "LANG-CHIN",
        "courses": [
            "CHIN 111",
            "CHIN\u0026 121",
            "CHIN\u0026 122",
            "CHIN\u0026 123"
        ]
    },
    {
        "id": "LANG-FR",
        "courses": [
            "FRCH\u0026 121",
            "FRCH\u0026 122",
            "FRCH\u0026 123",
            "FRCH\u0026 221"
        ]
    },
    {
        "id": "LANG-GER",
        "courses": [
            "GERM\u0026 121",
            "GERM\u0026 122",
            "GERM\u0026 123"
        ]
    },
    {
        "id": "LANG-JP",
        "courses": [
            "JAPN\u0026 121",
            "JAPN\u0026 122",
            "JAPN\u0026 123"
        ]
    },
    {
        "id": "LANG-SP",
        "courses": [
            "SPAN 110",
            "SPAN\u0026 121",
            "SPAN\u0026 122",
            "SPAN\u0026 123",
            "SPAN 194",
            "SPAN\u0026 221",
            "SPAN\u0026 222",
            "SPAN\u0026 223",
            "SPAN 299"
        ]
    },
    {
        "id": "HEALTH",
        "courses": [
            "HL ED 190",
            "NUTR\u0026 101",
            "O T 100",
            "O T 105",
            "O T 110",
            "O T 115",
            "O T 116",
            "O T 194",
            "O T 198",
            "O T 202",
            "O T 250",
            "O T 251"
        ]
    },
    {
        "id": "POLSOC",
        "courses": [
            "POLS\u0026 101",
            "POLS 194",
            "POLS\u0026 200",
            "POLS\u0026 202",
            "POLS\u0026 203",
            "POLS\u0026 204",
            "POLS 207",
            "POLS 209",
            "POLS 298",
            "CJ\u0026 101",
            "CJ\u0026 105",
            "CJ\u0026 110",
            "CJ 200",
            "CJ 205",
            "CJ 220",
            "CJ 236",
            "CJ\u0026 240",
            "CJ 294",
            "CJ 299",
            "SOC\u0026 101",
            "SOC 194",
            "SOC\u0026 201",
            "SOC 215",
            "SOC 220",
            "SOC 230",
            "SOC 240",
            "SOC 245",
            "SOC 260",
            "SOC 298"
        ]
    }
];
exports.TRANSFER_PLANNER_MASTER_MAJOR_ROWS = [
    {
        "campusId": "uw-seattle",
        "family": "Engineering, Computing, And Quantitative Majors",
        "title": "Aeronautics \u0026 Astronautics",
        "bankIds": [
            "ENGR",
            "MATH",
            "PHYS",
            "CHEM"
        ],
        "chainIds": [
            "MATH-STEM",
            "PHYS-CALC",
            "CHEM-GEN"
        ],
        "note": "direct engineering-prep coverage"
    },
    {
        "campusId": "uw-seattle",
        "family": "Engineering, Computing, And Quantitative Majors",
        "title": "Applied \u0026 Computational Mathematical Sciences (ACMS)",
        "bankIds": [
            "MATH",
            "CS",
            "PHYS"
        ],
        "chainIds": [
            "MATH-STEM",
            "CS-NEW",
            "PHYS-CALC"
        ],
        "note": "best planner path depends on ACMS option"
    },
    {
        "campusId": "uw-seattle",
        "family": "Engineering, Computing, And Quantitative Majors",
        "title": "Applied Mathematics",
        "bankIds": [
            "MATH",
            "PHYS",
            "CS"
        ],
        "chainIds": [
            "MATH-STEM",
            "PHYS-CALC",
            "CS-NEW"
        ],
        "note": "strongest prep is calculus plus programming plus physics"
    },
    {
        "campusId": "uw-seattle",
        "family": "Engineering, Computing, And Quantitative Majors",
        "title": "Computational Finance \u0026 Risk Management",
        "bankIds": [
            "MATH",
            "BUS",
            "CS"
        ],
        "chainIds": [
            "MATH-STEM",
            "MATH-BUS",
            "CS-NEW"
        ],
        "note": "quant-heavy finance prep"
    },
    {
        "campusId": "uw-seattle",
        "family": "Engineering, Computing, And Quantitative Majors",
        "title": "Computer Engineering",
        "bankIds": [
            "CS",
            "MATH",
            "PHYS",
            "ENGR",
            "CHEM"
        ],
        "chainIds": [
            "CS-NEW",
            "MATH-STEM",
            "PHYS-CALC",
            "CHEM-GEN"
        ],
        "note": "use existing detailed Seattle CompE planner for junior/senior specifics"
    },
    {
        "campusId": "uw-seattle",
        "family": "Engineering, Computing, And Quantitative Majors",
        "title": "Computer Science",
        "bankIds": [
            "CS",
            "MATH",
            "PHYS"
        ],
        "chainIds": [
            "CS-NEW",
            "MATH-STEM",
            "PHYS-CALC"
        ],
        "note": "use existing detailed Seattle CS planner for stronger admission prep"
    },
    {
        "campusId": "uw-seattle",
        "family": "Engineering, Computing, And Quantitative Majors",
        "title": "Construction Management",
        "bankIds": [
            "ENGR",
            "MATH",
            "PHYS",
            "BUS"
        ],
        "chainIds": [
            "MATH-STEM",
            "PHYS-CALC"
        ],
        "note": "supportive engineering and business prep; no direct GRC construction-management sequence"
    },
    {
        "campusId": "uw-seattle",
        "family": "Engineering, Computing, And Quantitative Majors",
        "title": "Electrical \u0026 Computer Engineering",
        "bankIds": [
            "ENGR",
            "CS",
            "MATH",
            "PHYS",
            "CHEM"
        ],
        "chainIds": [
            "CS-NEW",
            "MATH-STEM",
            "PHYS-CALC",
            "CHEM-GEN"
        ],
        "note": "direct engineering-prep coverage"
    },
    {
        "campusId": "uw-seattle",
        "family": "Engineering, Computing, And Quantitative Majors",
        "title": "Human Centered Design and Engineering",
        "bankIds": [
            "ENGR",
            "CS",
            "MATH",
            "PHYS",
            "COMM",
            "ENGL"
        ],
        "chainIds": [
            "CS-NEW",
            "MATH-STEM",
            "PHYS-CALC"
        ],
        "note": "supportive prep only because HCDE is not a one-to-one GRC transfer degree"
    },
    {
        "campusId": "uw-seattle",
        "family": "Engineering, Computing, And Quantitative Majors",
        "title": "Industrial Engineering",
        "bankIds": [
            "ENGR",
            "MATH",
            "PHYS",
            "CHEM",
            "BUS"
        ],
        "chainIds": [
            "MATH-STEM",
            "PHYS-CALC",
            "CHEM-GEN"
        ],
        "note": "direct engineering-prep coverage"
    },
    {
        "campusId": "uw-seattle",
        "family": "Engineering, Computing, And Quantitative Majors",
        "title": "Informatics",
        "bankIds": [
            "CS",
            "MATH",
            "COMM",
            "BUS"
        ],
        "chainIds": [
            "CS-NEW",
            "MATH-STEM"
        ],
        "note": "supportive prep only; Informatics has no single GRC MRP track"
    },
    {
        "campusId": "uw-seattle",
        "family": "Engineering, Computing, And Quantitative Majors",
        "title": "Materials Science \u0026 Engineering",
        "bankIds": [
            "ENGR",
            "MATH",
            "PHYS",
            "CHEM"
        ],
        "chainIds": [
            "MATH-STEM",
            "PHYS-CALC",
            "CHEM-GEN"
        ],
        "note": "direct engineering-prep coverage"
    },
    {
        "campusId": "uw-seattle",
        "family": "Engineering, Computing, And Quantitative Majors",
        "title": "Mathematics",
        "bankIds": [
            "MATH",
            "PHYS",
            "CS"
        ],
        "chainIds": [
            "MATH-STEM",
            "PHYS-CALC",
            "CS-NEW"
        ],
        "note": "best prep is calculus through MATH 240 or higher"
    },
    {
        "campusId": "uw-seattle",
        "family": "Engineering, Computing, And Quantitative Majors",
        "title": "Mechanical Engineering",
        "bankIds": [
            "ENGR",
            "MATH",
            "PHYS",
            "CHEM"
        ],
        "chainIds": [
            "MATH-STEM",
            "PHYS-CALC",
            "CHEM-GEN"
        ],
        "note": "direct engineering-prep coverage"
    },
    {
        "campusId": "uw-seattle",
        "family": "Engineering, Computing, And Quantitative Majors",
        "title": "Statistics",
        "bankIds": [
            "MATH",
            "CS",
            "BUS"
        ],
        "chainIds": [
            "MATH-STEM",
            "CS-NEW"
        ],
        "note": "supportive prep only; use MATH\u0026 146 and calculus together when possible"
    },
    {
        "campusId": "uw-seattle",
        "family": "Life, Physical, And Environmental Sciences",
        "title": "Aquatic Conservation \u0026 Ecology",
        "bankIds": [
            "BIO",
            "EARTH",
            "CHEM",
            "MATH"
        ],
        "chainIds": [
            "BIO-MAJORS",
            "CHEM-GEN",
            "MATH-STEM"
        ],
        "note": "supportive science prep"
    },
    {
        "campusId": "uw-seattle",
        "family": "Life, Physical, And Environmental Sciences",
        "title": "Astronomy",
        "bankIds": [
            "EARTH",
            "PHYS",
            "MATH"
        ],
        "chainIds": [
            "ASTR-COMBO",
            "PHYS-CALC",
            "MATH-STEM"
        ],
        "note": "use astronomy plus calculus-based physics"
    },
    {
        "campusId": "uw-seattle",
        "family": "Life, Physical, And Environmental Sciences",
        "title": "Atmospheric and Climate Science",
        "bankIds": [
            "EARTH",
            "MATH",
            "PHYS",
            "CHEM"
        ],
        "chainIds": [
            "MATH-STEM",
            "PHYS-CALC",
            "CHEM-GEN"
        ],
        "note": "strongest prep is atmospheric-science style AST2 STEM base"
    },
    {
        "campusId": "uw-seattle",
        "family": "Life, Physical, And Environmental Sciences",
        "title": "Biochemistry",
        "bankIds": [
            "CHEM",
            "BIO",
            "MATH",
            "PHYS"
        ],
        "chainIds": [
            "CHEM-GEN",
            "CHEM-ORG",
            "BIO-MAJORS",
            "MATH-STEM",
            "PHYS-CALC"
        ],
        "note": "direct science-prep coverage"
    },
    {
        "campusId": "uw-seattle",
        "family": "Life, Physical, And Environmental Sciences",
        "title": "Bioengineering",
        "bankIds": [
            "CHEM",
            "BIO",
            "MATH",
            "PHYS",
            "ENGR",
            "CS"
        ],
        "chainIds": [
            "CHEM-GEN",
            "CHEM-ORG",
            "BIO-MAJORS",
            "MATH-STEM",
            "PHYS-CALC",
            "CS-NEW"
        ],
        "note": "use existing Seattle BioE planner for department-specific timing"
    },
    {
        "campusId": "uw-seattle",
        "family": "Life, Physical, And Environmental Sciences",
        "title": "Biology",
        "bankIds": [
            "BIO",
            "CHEM",
            "MATH"
        ],
        "chainIds": [
            "BIO-MAJORS",
            "CHEM-GEN",
            "MATH-STEM"
        ],
        "note": "direct science-prep coverage"
    },
    {
        "campusId": "uw-seattle",
        "family": "Life, Physical, And Environmental Sciences",
        "title": "Chemical Engineering",
        "bankIds": [
            "CHEM",
            "MATH",
            "PHYS",
            "ENGR"
        ],
        "chainIds": [
            "CHEM-GEN",
            "CHEM-ORG",
            "MATH-STEM",
            "PHYS-CALC"
        ],
        "note": "department has special spring-start timing"
    },
    {
        "campusId": "uw-seattle",
        "family": "Life, Physical, And Environmental Sciences",
        "title": "Chemistry",
        "bankIds": [
            "CHEM",
            "MATH",
            "PHYS"
        ],
        "chainIds": [
            "CHEM-GEN",
            "CHEM-ORG",
            "MATH-STEM",
            "PHYS-CALC"
        ],
        "note": "direct science-prep coverage"
    },
    {
        "campusId": "uw-seattle",
        "family": "Life, Physical, And Environmental Sciences",
        "title": "Earth \u0026 Space Sciences",
        "bankIds": [
            "EARTH",
            "CHEM",
            "MATH",
            "PHYS"
        ],
        "chainIds": [
            "MATH-STEM",
            "PHYS-CALC",
            "CHEM-GEN"
        ],
        "note": "use geology, oceanography, and geography support"
    },
    {
        "campusId": "uw-seattle",
        "family": "Life, Physical, And Environmental Sciences",
        "title": "Environmental Design \u0026 Sustainability",
        "bankIds": [
            "ART",
            "EARTH",
            "MATH",
            "PHYS",
            "ENGL"
        ],
        "chainIds": [
            "MATH-STEM"
        ],
        "note": "support-only; combine design/art foundations with environment and STEM support"
    },
    {
        "campusId": "uw-seattle",
        "family": "Life, Physical, And Environmental Sciences",
        "title": "Environmental Engineering",
        "bankIds": [
            "ENGR",
            "MATH",
            "PHYS",
            "CHEM",
            "EARTH"
        ],
        "chainIds": [
            "MATH-STEM",
            "PHYS-CALC",
            "CHEM-GEN"
        ],
        "note": "direct engineering-prep coverage"
    },
    {
        "campusId": "uw-seattle",
        "family": "Life, Physical, And Environmental Sciences",
        "title": "Environmental Public Health",
        "bankIds": [
            "BIO",
            "CHEM",
            "MATH",
            "HEALTH",
            "PSYED"
        ],
        "chainIds": [
            "BIO-MAJORS",
            "CHEM-GEN",
            "MATH-STEM"
        ],
        "note": "supportive pre-health prep only"
    },
    {
        "campusId": "uw-seattle",
        "family": "Life, Physical, And Environmental Sciences",
        "title": "Environmental Science \u0026 Terrestrial Resource Management",
        "bankIds": [
            "EARTH",
            "BIO",
            "CHEM",
            "MATH"
        ],
        "chainIds": [
            "NATRS-COMBO",
            "BIO-MAJORS",
            "CHEM-GEN",
            "MATH-STEM"
        ],
        "note": "strongest direct GRC subject bank is EARTH"
    },
    {
        "campusId": "uw-seattle",
        "family": "Life, Physical, And Environmental Sciences",
        "title": "Environmental Studies",
        "bankIds": [
            "EARTH",
            "HIST",
            "POLSOC",
            "ENGL"
        ],
        "chainIds": [],
        "note": "supportive prep only"
    },
    {
        "campusId": "uw-seattle",
        "family": "Life, Physical, And Environmental Sciences",
        "title": "Food Systems, Nutrition, \u0026 Health",
        "bankIds": [
            "HEALTH",
            "BIO",
            "CHEM",
            "EARTH"
        ],
        "chainIds": [
            "BIO-MAJORS",
            "CHEM-GEN"
        ],
        "note": "supportive prep only"
    },
    {
        "campusId": "uw-seattle",
        "family": "Life, Physical, And Environmental Sciences",
        "title": "Marine Biology",
        "bankIds": [
            "BIO",
            "CHEM",
            "MATH",
            "PHYS",
            "EARTH"
        ],
        "chainIds": [
            "BIO-MAJORS",
            "CHEM-GEN",
            "MATH-STEM",
            "PHYS-CALC"
        ],
        "note": "strongest prep is science-heavy AST track"
    },
    {
        "campusId": "uw-seattle",
        "family": "Life, Physical, And Environmental Sciences",
        "title": "Medical Laboratory Science",
        "bankIds": [
            "BIO",
            "CHEM",
            "MATH",
            "HEALTH"
        ],
        "chainIds": [
            "BIO-MAJORS",
            "CHEM-GEN",
            "CHEM-ORG"
        ],
        "note": "supportive pre-clinical prep only"
    },
    {
        "campusId": "uw-seattle",
        "family": "Life, Physical, And Environmental Sciences",
        "title": "Microbiology",
        "bankIds": [
            "BIO",
            "CHEM",
            "MATH"
        ],
        "chainIds": [
            "BIO-MAJORS",
            "CHEM-GEN",
            "CHEM-ORG"
        ],
        "note": "use BIOL\u0026 260 plus major biology/chemistry sequence"
    },
    {
        "campusId": "uw-seattle",
        "family": "Life, Physical, And Environmental Sciences",
        "title": "Neuroscience",
        "bankIds": [
            "BIO",
            "CHEM",
            "MATH",
            "PHYS",
            "PSYED"
        ],
        "chainIds": [
            "BIO-MAJORS",
            "CHEM-GEN",
            "MATH-STEM",
            "PHYS-CALC"
        ],
        "note": "supportive pre-major prep"
    },
    {
        "campusId": "uw-seattle",
        "family": "Life, Physical, And Environmental Sciences",
        "title": "Nursing",
        "bankIds": [
            "BIO",
            "CHEM",
            "HEALTH",
            "PSYED",
            "COMM"
        ],
        "chainIds": [
            "BIO-ANAT",
            "CHEM-GEN"
        ],
        "note": "pre-nursing planning should also use the GRC pre-nursing transfer plan"
    },
    {
        "campusId": "uw-seattle",
        "family": "Life, Physical, And Environmental Sciences",
        "title": "Oceanography",
        "bankIds": [
            "EARTH",
            "CHEM",
            "MATH",
            "PHYS"
        ],
        "chainIds": [
            "MATH-STEM",
            "PHYS-CALC",
            "CHEM-GEN"
        ],
        "note": "use OCEA\u0026 101 and earth-science support"
    },
    {
        "campusId": "uw-seattle",
        "family": "Life, Physical, And Environmental Sciences",
        "title": "Physics",
        "bankIds": [
            "PHYS",
            "MATH",
            "CHEM"
        ],
        "chainIds": [
            "PHYS-CALC",
            "MATH-STEM",
            "CHEM-GEN"
        ],
        "note": "direct science-prep coverage"
    },
    {
        "campusId": "uw-seattle",
        "family": "Life, Physical, And Environmental Sciences",
        "title": "Public Health - Global Health",
        "bankIds": [
            "BIO",
            "CHEM",
            "MATH",
            "HEALTH",
            "POLSOC"
        ],
        "chainIds": [
            "BIO-MAJORS",
            "CHEM-GEN",
            "MATH-STEM"
        ],
        "note": "supportive public-health prep"
    },
    {
        "campusId": "uw-seattle",
        "family": "Life, Physical, And Environmental Sciences",
        "title": "Speech \u0026 Hearing Sciences",
        "bankIds": [
            "BIO",
            "PSYED",
            "HEALTH",
            "COMM"
        ],
        "chainIds": [
            "BIO-ANAT"
        ],
        "note": "supportive prep only; no direct GRC SHS sequence"
    },
    {
        "campusId": "uw-seattle",
        "family": "Life, Physical, And Environmental Sciences",
        "title": "Sustainable Bioresource Systems Engineering",
        "bankIds": [
            "ENGR",
            "MATH",
            "PHYS",
            "CHEM",
            "EARTH"
        ],
        "chainIds": [
            "MATH-STEM",
            "PHYS-CALC",
            "CHEM-GEN",
            "NATRS-COMBO"
        ],
        "note": "supportive prep only"
    },
    {
        "campusId": "uw-seattle",
        "family": "Business, Policy, And Social Science Majors",
        "title": "American Ethnic Studies",
        "bankIds": [
            "AAMES",
            "HIST",
            "ENGL"
        ],
        "chainIds": [],
        "note": "direct subject coverage through AMES plus related anthropology/history"
    },
    {
        "campusId": "uw-seattle",
        "family": "Business, Policy, And Social Science Majors",
        "title": "American Indian Studies",
        "bankIds": [
            "AAMES",
            "HIST",
            "ENGL"
        ],
        "chainIds": [],
        "note": "supportive coverage; no separate current GRC American Indian prefix"
    },
    {
        "campusId": "uw-seattle",
        "family": "Business, Policy, And Social Science Majors",
        "title": "Anthropology",
        "bankIds": [
            "AAMES",
            "HIST",
            "BIO"
        ],
        "chainIds": [],
        "note": "direct subject coverage through anthropology sequence"
    },
    {
        "campusId": "uw-seattle",
        "family": "Business, Policy, And Social Science Majors",
        "title": "Business Administration",
        "bankIds": [
            "BUS",
            "MATH"
        ],
        "chainIds": [
            "MATH-BUS",
            "ACCT-COMBO"
        ],
        "note": "best paired with the current GRC business DTA/MRP plan"
    },
    {
        "campusId": "uw-seattle",
        "family": "Business, Policy, And Social Science Majors",
        "title": "Community, Environment \u0026 Planning",
        "bankIds": [
            "EARTH",
            "POLSOC",
            "HIST"
        ],
        "chainIds": [],
        "note": "supportive prep only"
    },
    {
        "campusId": "uw-seattle",
        "family": "Business, Policy, And Social Science Majors",
        "title": "Disability Studies",
        "bankIds": [
            "PSYED",
            "HEALTH",
            "POLSOC"
        ],
        "chainIds": [],
        "note": "supportive prep only"
    },
    {
        "campusId": "uw-seattle",
        "family": "Business, Policy, And Social Science Majors",
        "title": "Early Childhood \u0026 Family Studies",
        "bankIds": [
            "PSYED"
        ],
        "chainIds": [],
        "note": "direct support through ECED and related education/psychology coursework"
    },
    {
        "campusId": "uw-seattle",
        "family": "Business, Policy, And Social Science Majors",
        "title": "Economics",
        "bankIds": [
            "BUS",
            "MATH"
        ],
        "chainIds": [
            "MATH-BUS",
            "MATH-STEM"
        ],
        "note": "best prep is economics plus calculus or business math depending target path"
    },
    {
        "campusId": "uw-seattle",
        "family": "Business, Policy, And Social Science Majors",
        "title": "Education Studies",
        "bankIds": [
            "PSYED",
            "HIST",
            "POLSOC"
        ],
        "chainIds": [],
        "note": "supportive prep only"
    },
    {
        "campusId": "uw-seattle",
        "family": "Business, Policy, And Social Science Majors",
        "title": "Education, Communities \u0026 Organizations",
        "bankIds": [
            "PSYED",
            "POLSOC",
            "HIST"
        ],
        "chainIds": [],
        "note": "supportive prep only"
    },
    {
        "campusId": "uw-seattle",
        "family": "Business, Policy, And Social Science Majors",
        "title": "Gender, Women \u0026 Sexuality Studies",
        "bankIds": [
            "PHIL",
            "HIST",
            "POLSOC",
            "PSYED",
            "AAMES"
        ],
        "chainIds": [],
        "note": "supportive prep only"
    },
    {
        "campusId": "uw-seattle",
        "family": "Business, Policy, And Social Science Majors",
        "title": "Geography",
        "bankIds": [
            "EARTH",
            "POLSOC",
            "MATH"
        ],
        "chainIds": [],
        "note": "direct subject coverage through geography/GIS bank"
    },
    {
        "campusId": "uw-seattle",
        "family": "Business, Policy, And Social Science Majors",
        "title": "History",
        "bankIds": [
            "HIST",
            "ENGL"
        ],
        "chainIds": [
            "HIST-US"
        ],
        "note": "direct history coverage"
    },
    {
        "campusId": "uw-seattle",
        "family": "Business, Policy, And Social Science Majors",
        "title": "International Studies",
        "bankIds": [
            "HIST",
            "POLSOC",
            "ENGL",
            "LANG-CHIN",
            "LANG-FR",
            "LANG-GER",
            "LANG-JP",
            "LANG-SP"
        ],
        "chainIds": [
            "LANG-CHIN",
            "LANG-FR",
            "LANG-GER",
            "LANG-JP",
            "LANG-SP"
        ],
        "note": "supportive prep varies by regional focus"
    },
    {
        "campusId": "uw-seattle",
        "family": "Business, Policy, And Social Science Majors",
        "title": "Law, Societies \u0026 Justice",
        "bankIds": [
            "POLSOC",
            "PHIL",
            "ENGL"
        ],
        "chainIds": [],
        "note": "direct support through CJ/POLS/SOC plus philosophy"
    },
    {
        "campusId": "uw-seattle",
        "family": "Business, Policy, And Social Science Majors",
        "title": "Political Science",
        "bankIds": [
            "POLSOC",
            "HIST",
            "PHIL"
        ],
        "chainIds": [],
        "note": "direct subject coverage through current POLS sequence"
    },
    {
        "campusId": "uw-seattle",
        "family": "Business, Policy, And Social Science Majors",
        "title": "Psychology",
        "bankIds": [
            "PSYED",
            "BIO"
        ],
        "chainIds": [],
        "note": "use PSYC\u0026 100 plus research and biological support"
    },
    {
        "campusId": "uw-seattle",
        "family": "Business, Policy, And Social Science Majors",
        "title": "Public Service \u0026 Policy",
        "bankIds": [
            "POLSOC",
            "BUS",
            "HIST",
            "PHIL"
        ],
        "chainIds": [
            "MATH-BUS"
        ],
        "note": "supportive policy/econ prep"
    },
    {
        "campusId": "uw-seattle",
        "family": "Business, Policy, And Social Science Majors",
        "title": "Real Estate",
        "bankIds": [
            "BUS",
            "MATH",
            "POLSOC"
        ],
        "chainIds": [
            "MATH-BUS",
            "ACCT-COMBO"
        ],
        "note": "supportive business prep only"
    },
    {
        "campusId": "uw-seattle",
        "family": "Business, Policy, And Social Science Majors",
        "title": "Social Welfare",
        "bankIds": [
            "POLSOC",
            "PSYED",
            "HIST"
        ],
        "chainIds": [],
        "note": "supportive prep only"
    },
    {
        "campusId": "uw-seattle",
        "family": "Business, Policy, And Social Science Majors",
        "title": "Sociology",
        "bankIds": [
            "POLSOC",
            "PSYED"
        ],
        "chainIds": [],
        "note": "direct sociology coverage through current SOC sequence"
    },
    {
        "campusId": "uw-seattle",
        "family": "Arts, Humanities, Languages, And Design Majors",
        "title": "Architectural Design",
        "bankIds": [
            "ART",
            "MATH",
            "PHYS",
            "ENGL"
        ],
        "chainIds": [
            "MATH-STEM"
        ],
        "note": "support-only; no current direct architecture sequence at GRC"
    },
    {
        "campusId": "uw-seattle",
        "family": "Arts, Humanities, Languages, And Design Majors",
        "title": "Architectural Studies",
        "bankIds": [
            "ART",
            "MATH",
            "PHYS",
            "ENGL"
        ],
        "chainIds": [
            "MATH-STEM"
        ],
        "note": "support-only; no current direct architecture sequence at GRC"
    },
    {
        "campusId": "uw-seattle",
        "family": "Arts, Humanities, Languages, And Design Majors",
        "title": "Art",
        "bankIds": [
            "ART"
        ],
        "chainIds": [],
        "note": "direct studio and art-history support"
    },
    {
        "campusId": "uw-seattle",
        "family": "Arts, Humanities, Languages, And Design Majors",
        "title": "Art History",
        "bankIds": [
            "ART",
            "HIST",
            "ENGL"
        ],
        "chainIds": [],
        "note": "direct support through art history and related humanities"
    },
    {
        "campusId": "uw-seattle",
        "family": "Arts, Humanities, Languages, And Design Majors",
        "title": "Asian Languages \u0026 Cultures",
        "bankIds": [
            "LANG-CHIN",
            "LANG-JP",
            "HIST",
            "ENGL"
        ],
        "chainIds": [
            "LANG-CHIN",
            "LANG-JP"
        ],
        "note": "support-only because current GRC language coverage is strongest in Chinese and Japanese"
    },
    {
        "campusId": "uw-seattle",
        "family": "Arts, Humanities, Languages, And Design Majors",
        "title": "Asian Studies",
        "bankIds": [
            "LANG-CHIN",
            "LANG-JP",
            "HIST",
            "ENGL"
        ],
        "chainIds": [
            "LANG-CHIN",
            "LANG-JP"
        ],
        "note": "support-only"
    },
    {
        "campusId": "uw-seattle",
        "family": "Arts, Humanities, Languages, And Design Majors",
        "title": "Chinese",
        "bankIds": [
            "LANG-CHIN",
            "ENGL",
            "HIST"
        ],
        "chainIds": [
            "LANG-CHIN"
        ],
        "note": "direct current Chinese transfer support"
    },
    {
        "campusId": "uw-seattle",
        "family": "Arts, Humanities, Languages, And Design Majors",
        "title": "Cinema \u0026 Media Studies",
        "bankIds": [
            "COMM",
            "ENGL",
            "HIST"
        ],
        "chainIds": [
            "COMM-266"
        ],
        "note": "direct communication/film support"
    },
    {
        "campusId": "uw-seattle",
        "family": "Arts, Humanities, Languages, And Design Majors",
        "title": "Classical Studies",
        "bankIds": [
            "HIST",
            "ENGL",
            "PHIL"
        ],
        "chainIds": [],
        "note": "support-only; no current GRC Greek or Latin sequence in the UW guide"
    },
    {
        "campusId": "uw-seattle",
        "family": "Arts, Humanities, Languages, And Design Majors",
        "title": "Classics",
        "bankIds": [
            "HIST",
            "ENGL",
            "PHIL"
        ],
        "chainIds": [],
        "note": "support-only; no current GRC Greek or Latin sequence in the UW guide"
    },
    {
        "campusId": "uw-seattle",
        "family": "Arts, Humanities, Languages, And Design Majors",
        "title": "Communication",
        "bankIds": [
            "COMM"
        ],
        "chainIds": [
            "COMM-266"
        ],
        "note": "direct communication support"
    },
    {
        "campusId": "uw-seattle",
        "family": "Arts, Humanities, Languages, And Design Majors",
        "title": "Comparative History of Ideas",
        "bankIds": [
            "ENGL",
            "PHIL",
            "HIST",
            "LANG-FR",
            "LANG-GER",
            "LANG-JP",
            "LANG-SP"
        ],
        "chainIds": [
            "LANG-FR",
            "LANG-GER",
            "LANG-JP",
            "LANG-SP"
        ],
        "note": "support-only"
    },
    {
        "campusId": "uw-seattle",
        "family": "Arts, Humanities, Languages, And Design Majors",
        "title": "Comparative Literature",
        "bankIds": [
            "ENGL",
            "LANG-FR",
            "LANG-GER",
            "LANG-JP",
            "LANG-SP",
            "HIST"
        ],
        "chainIds": [
            "LANG-FR",
            "LANG-GER",
            "LANG-JP",
            "LANG-SP"
        ],
        "note": "support-only"
    },
    {
        "campusId": "uw-seattle",
        "family": "Arts, Humanities, Languages, And Design Majors",
        "title": "Comparative Religion",
        "bankIds": [
            "PHIL",
            "AAMES",
            "HIST",
            "ENGL"
        ],
        "chainIds": [],
        "note": "support-only using philosophy, anthropology/religion, and history"
    },
    {
        "campusId": "uw-seattle",
        "family": "Arts, Humanities, Languages, And Design Majors",
        "title": "Dance",
        "bankIds": [
            "PERF"
        ],
        "chainIds": [],
        "note": "direct performance support"
    },
    {
        "campusId": "uw-seattle",
        "family": "Arts, Humanities, Languages, And Design Majors",
        "title": "Danish",
        "bankIds": [
            "HIST",
            "ENGL"
        ],
        "chainIds": [],
        "note": "support-only; no current Danish language bank at GRC"
    },
    {
        "campusId": "uw-seattle",
        "family": "Arts, Humanities, Languages, And Design Majors",
        "title": "Design",
        "bankIds": [
            "ART",
            "COMM",
            "ENGL"
        ],
        "chainIds": [],
        "note": "support-only; no current direct UW Design-equivalent GRC sequence"
    },
    {
        "campusId": "uw-seattle",
        "family": "Arts, Humanities, Languages, And Design Majors",
        "title": "Drama",
        "bankIds": [
            "PERF"
        ],
        "chainIds": [],
        "note": "direct drama support"
    },
    {
        "campusId": "uw-seattle",
        "family": "Arts, Humanities, Languages, And Design Majors",
        "title": "English - Creative Writing",
        "bankIds": [
            "ENGL"
        ],
        "chainIds": [
            "ENGL-250"
        ],
        "note": "direct English support"
    },
    {
        "campusId": "uw-seattle",
        "family": "Arts, Humanities, Languages, And Design Majors",
        "title": "English - Language, Literature \u0026 Culture",
        "bankIds": [
            "ENGL"
        ],
        "chainIds": [
            "ENGL-250"
        ],
        "note": "direct English support"
    },
    {
        "campusId": "uw-seattle",
        "family": "Arts, Humanities, Languages, And Design Majors",
        "title": "European Studies",
        "bankIds": [
            "HIST",
            "ENGL",
            "LANG-FR",
            "LANG-GER",
            "LANG-SP"
        ],
        "chainIds": [
            "LANG-FR",
            "LANG-GER",
            "LANG-SP"
        ],
        "note": "support-only"
    },
    {
        "campusId": "uw-seattle",
        "family": "Arts, Humanities, Languages, And Design Majors",
        "title": "Ethnomusicology, B.A.",
        "bankIds": [
            "MUSIC",
            "HIST",
            "ENGL"
        ],
        "chainIds": [],
        "note": "support-only but strong music prep exists"
    },
    {
        "campusId": "uw-seattle",
        "family": "Arts, Humanities, Languages, And Design Majors",
        "title": "Finnish",
        "bankIds": [
            "HIST",
            "ENGL"
        ],
        "chainIds": [],
        "note": "support-only; no current Finnish language bank at GRC"
    },
    {
        "campusId": "uw-seattle",
        "family": "Arts, Humanities, Languages, And Design Majors",
        "title": "French",
        "bankIds": [
            "LANG-FR",
            "ENGL"
        ],
        "chainIds": [
            "LANG-FR"
        ],
        "note": "direct current French transfer support"
    },
    {
        "campusId": "uw-seattle",
        "family": "Arts, Humanities, Languages, And Design Majors",
        "title": "German",
        "bankIds": [
            "LANG-GER",
            "ENGL"
        ],
        "chainIds": [
            "LANG-GER"
        ],
        "note": "direct current German transfer support"
    },
    {
        "campusId": "uw-seattle",
        "family": "Arts, Humanities, Languages, And Design Majors",
        "title": "Global Literary Studies",
        "bankIds": [
            "ENGL",
            "LANG-FR",
            "LANG-GER",
            "LANG-JP",
            "LANG-SP",
            "HIST"
        ],
        "chainIds": [
            "LANG-FR",
            "LANG-GER",
            "LANG-JP",
            "LANG-SP"
        ],
        "note": "support-only"
    },
    {
        "campusId": "uw-seattle",
        "family": "Arts, Humanities, Languages, And Design Majors",
        "title": "Greek",
        "bankIds": [
            "HIST",
            "PHIL",
            "ENGL"
        ],
        "chainIds": [],
        "note": "support-only; no current Greek language bank at GRC"
    },
    {
        "campusId": "uw-seattle",
        "family": "Arts, Humanities, Languages, And Design Majors",
        "title": "Guitar, B.M.",
        "bankIds": [
            "MUSIC"
        ],
        "chainIds": [],
        "note": "direct music support"
    },
    {
        "campusId": "uw-seattle",
        "family": "Arts, Humanities, Languages, And Design Majors",
        "title": "History \u0026 Philosophy of Science",
        "bankIds": [
            "HIST",
            "PHIL",
            "CHEM",
            "BIO",
            "PHYS",
            "EARTH",
            "MATH"
        ],
        "chainIds": [
            "MATH-STEM",
            "PHYS-CALC",
            "CHEM-GEN",
            "BIO-MAJORS"
        ],
        "note": "support-only but strong lower-division prep exists"
    },
    {
        "campusId": "uw-seattle",
        "family": "Arts, Humanities, Languages, And Design Majors",
        "title": "Individualized Studies",
        "bankIds": [
            "varies"
        ],
        "chainIds": [
            "varies"
        ],
        "note": "planner must build custom bank set case by case"
    },
    {
        "campusId": "uw-seattle",
        "family": "Arts, Humanities, Languages, And Design Majors",
        "title": "Italian",
        "bankIds": [
            "ENGL",
            "HIST",
            "LANG-FR",
            "LANG-SP"
        ],
        "chainIds": [
            "LANG-FR",
            "LANG-SP"
        ],
        "note": "support-only; no current Italian language bank at GRC"
    },
    {
        "campusId": "uw-seattle",
        "family": "Arts, Humanities, Languages, And Design Majors",
        "title": "Japanese",
        "bankIds": [
            "LANG-JP",
            "ENGL"
        ],
        "chainIds": [
            "LANG-JP"
        ],
        "note": "direct current Japanese transfer support"
    },
    {
        "campusId": "uw-seattle",
        "family": "Arts, Humanities, Languages, And Design Majors",
        "title": "Jazz Studies, B.M.",
        "bankIds": [
            "MUSIC"
        ],
        "chainIds": [],
        "note": "direct music support"
    },
    {
        "campusId": "uw-seattle",
        "family": "Arts, Humanities, Languages, And Design Majors",
        "title": "Jewish Studies",
        "bankIds": [
            "HIST",
            "PHIL",
            "ENGL"
        ],
        "chainIds": [],
        "note": "support-only"
    },
    {
        "campusId": "uw-seattle",
        "family": "Arts, Humanities, Languages, And Design Majors",
        "title": "Korean",
        "bankIds": [
            "HIST",
            "ENGL"
        ],
        "chainIds": [],
        "note": "support-only; no current Korean language bank at GRC"
    },
    {
        "campusId": "uw-seattle",
        "family": "Arts, Humanities, Languages, And Design Majors",
        "title": "Landscape Architecture",
        "bankIds": [
            "ART",
            "EARTH",
            "MATH",
            "ENGL"
        ],
        "chainIds": [
            "MATH-STEM"
        ],
        "note": "support-only"
    },
    {
        "campusId": "uw-seattle",
        "family": "Arts, Humanities, Languages, And Design Majors",
        "title": "Latin",
        "bankIds": [
            "HIST",
            "PHIL",
            "ENGL"
        ],
        "chainIds": [],
        "note": "support-only; no current Latin language bank at GRC"
    },
    {
        "campusId": "uw-seattle",
        "family": "Arts, Humanities, Languages, And Design Majors",
        "title": "Latin American \u0026 Caribbean Studies",
        "bankIds": [
            "HIST",
            "LANG-SP",
            "ENGL"
        ],
        "chainIds": [
            "LANG-SP"
        ],
        "note": "support-only with strong Spanish support"
    },
    {
        "campusId": "uw-seattle",
        "family": "Arts, Humanities, Languages, And Design Majors",
        "title": "Linguistics",
        "bankIds": [
            "ENGL",
            "PHIL",
            "LANG-CHIN",
            "LANG-FR",
            "LANG-GER",
            "LANG-JP",
            "LANG-SP"
        ],
        "chainIds": [
            "LANG-CHIN",
            "LANG-FR",
            "LANG-GER",
            "LANG-JP",
            "LANG-SP"
        ],
        "note": "support-only"
    },
    {
        "campusId": "uw-seattle",
        "family": "Arts, Humanities, Languages, And Design Majors",
        "title": "Middle Eastern Languages \u0026 Cultures",
        "bankIds": [
            "HIST",
            "ENGL",
            "PHIL"
        ],
        "chainIds": [],
        "note": "support-only; no current Middle Eastern language bank at GRC"
    },
    {
        "campusId": "uw-seattle",
        "family": "Arts, Humanities, Languages, And Design Majors",
        "title": "Music Composition, B.M.",
        "bankIds": [
            "MUSIC"
        ],
        "chainIds": [],
        "note": "direct music support"
    },
    {
        "campusId": "uw-seattle",
        "family": "Arts, Humanities, Languages, And Design Majors",
        "title": "Music Education, B.M.",
        "bankIds": [
            "MUSIC",
            "PSYED",
            "COMM"
        ],
        "chainIds": [],
        "note": "support-only with strong music foundation"
    },
    {
        "campusId": "uw-seattle",
        "family": "Arts, Humanities, Languages, And Design Majors",
        "title": "Music, B.A.",
        "bankIds": [
            "MUSIC"
        ],
        "chainIds": [],
        "note": "direct music support"
    },
    {
        "campusId": "uw-seattle",
        "family": "Arts, Humanities, Languages, And Design Majors",
        "title": "Norwegian",
        "bankIds": [
            "HIST",
            "ENGL"
        ],
        "chainIds": [],
        "note": "support-only; no current Norwegian language bank at GRC"
    },
    {
        "campusId": "uw-seattle",
        "family": "Arts, Humanities, Languages, And Design Majors",
        "title": "Orchestral Instruments, B.M.",
        "bankIds": [
            "MUSIC"
        ],
        "chainIds": [],
        "note": "direct music support"
    },
    {
        "campusId": "uw-seattle",
        "family": "Arts, Humanities, Languages, And Design Majors",
        "title": "Organ, B.M.",
        "bankIds": [
            "MUSIC"
        ],
        "chainIds": [],
        "note": "direct music support"
    },
    {
        "campusId": "uw-seattle",
        "family": "Arts, Humanities, Languages, And Design Majors",
        "title": "Percussion Performance, B.M.",
        "bankIds": [
            "MUSIC"
        ],
        "chainIds": [],
        "note": "direct music support"
    },
    {
        "campusId": "uw-seattle",
        "family": "Arts, Humanities, Languages, And Design Majors",
        "title": "Philosophy",
        "bankIds": [
            "PHIL",
            "ENGL"
        ],
        "chainIds": [],
        "note": "direct philosophy support"
    },
    {
        "campusId": "uw-seattle",
        "family": "Arts, Humanities, Languages, And Design Majors",
        "title": "Piano, B.M.",
        "bankIds": [
            "MUSIC"
        ],
        "chainIds": [],
        "note": "direct music support"
    },
    {
        "campusId": "uw-seattle",
        "family": "Arts, Humanities, Languages, And Design Majors",
        "title": "Scandinavian Area Studies",
        "bankIds": [
            "HIST",
            "ENGL",
            "LANG-GER"
        ],
        "chainIds": [
            "LANG-GER"
        ],
        "note": "support-only; no current Scandinavian language bank at GRC"
    },
    {
        "campusId": "uw-seattle",
        "family": "Arts, Humanities, Languages, And Design Majors",
        "title": "Slavic Languages \u0026 Literatures",
        "bankIds": [
            "HIST",
            "ENGL"
        ],
        "chainIds": [],
        "note": "support-only; no current Russian/Slavic language bank at GRC"
    },
    {
        "campusId": "uw-seattle",
        "family": "Arts, Humanities, Languages, And Design Majors",
        "title": "South Asian Languages \u0026 Cultures",
        "bankIds": [
            "HIST",
            "ENGL"
        ],
        "chainIds": [],
        "note": "support-only; no current South Asian language bank at GRC"
    },
    {
        "campusId": "uw-seattle",
        "family": "Arts, Humanities, Languages, And Design Majors",
        "title": "Spanish",
        "bankIds": [
            "LANG-SP",
            "ENGL"
        ],
        "chainIds": [
            "LANG-SP"
        ],
        "note": "direct current Spanish transfer support"
    },
    {
        "campusId": "uw-seattle",
        "family": "Arts, Humanities, Languages, And Design Majors",
        "title": "Swedish",
        "bankIds": [
            "HIST",
            "ENGL"
        ],
        "chainIds": [],
        "note": "support-only; no current Swedish language bank at GRC"
    },
    {
        "campusId": "uw-seattle",
        "family": "Arts, Humanities, Languages, And Design Majors",
        "title": "Voice, B.M.",
        "bankIds": [
            "MUSIC"
        ],
        "chainIds": [],
        "note": "direct music support"
    },
    {
        "campusId": "uw-bothell",
        "family": "STEM, Computing, And Quantitative Majors",
        "title": "Applied Computing (BA)",
        "bankIds": [
            "CS",
            "MATH",
            "COMM",
            "BUS"
        ],
        "chainIds": [
            "CS-NEW",
            "MATH-STEM"
        ],
        "note": "supportive computing prep"
    },
    {
        "campusId": "uw-bothell",
        "family": "STEM, Computing, And Quantitative Majors",
        "title": "Biology (BS)",
        "bankIds": [
            "BIO",
            "CHEM",
            "MATH"
        ],
        "chainIds": [
            "BIO-MAJORS",
            "CHEM-GEN",
            "MATH-STEM"
        ],
        "note": "direct science-prep coverage"
    },
    {
        "campusId": "uw-bothell",
        "family": "STEM, Computing, And Quantitative Majors",
        "title": "Chemistry (BA)",
        "bankIds": [
            "CHEM",
            "MATH",
            "PHYS"
        ],
        "chainIds": [
            "CHEM-GEN",
            "CHEM-ORG",
            "MATH-STEM",
            "PHYS-CALC"
        ],
        "note": "direct science-prep coverage"
    },
    {
        "campusId": "uw-bothell",
        "family": "STEM, Computing, And Quantitative Majors",
        "title": "Chemistry (BS)",
        "bankIds": [
            "CHEM",
            "MATH",
            "PHYS"
        ],
        "chainIds": [
            "CHEM-GEN",
            "CHEM-ORG",
            "MATH-STEM",
            "PHYS-CALC"
        ],
        "note": "direct science-prep coverage"
    },
    {
        "campusId": "uw-bothell",
        "family": "STEM, Computing, And Quantitative Majors",
        "title": "Chemistry: Biochemistry (BS)",
        "bankIds": [
            "CHEM",
            "BIO",
            "MATH",
            "PHYS"
        ],
        "chainIds": [
            "CHEM-GEN",
            "CHEM-ORG",
            "BIO-MAJORS",
            "MATH-STEM",
            "PHYS-CALC"
        ],
        "note": "direct science-prep coverage"
    },
    {
        "campusId": "uw-bothell",
        "family": "STEM, Computing, And Quantitative Majors",
        "title": "Computer Engineering (BS)",
        "bankIds": [
            "CS",
            "MATH",
            "PHYS",
            "ENGR",
            "CHEM"
        ],
        "chainIds": [
            "CS-NEW",
            "MATH-STEM",
            "PHYS-CALC",
            "CHEM-GEN"
        ],
        "note": "direct engineering-prep coverage"
    },
    {
        "campusId": "uw-bothell",
        "family": "STEM, Computing, And Quantitative Majors",
        "title": "Computer Science \u0026 Software Engineering (BS)",
        "bankIds": [
            "CS",
            "MATH",
            "PHYS"
        ],
        "chainIds": [
            "CS-NEW",
            "MATH-STEM",
            "PHYS-CALC"
        ],
        "note": "direct computing prep"
    },
    {
        "campusId": "uw-bothell",
        "family": "STEM, Computing, And Quantitative Majors",
        "title": "Computer Science \u0026 Software Engineering: Information Assurance \u0026 Cybersecurity (BS)",
        "bankIds": [
            "CS",
            "MATH",
            "COMM"
        ],
        "chainIds": [
            "CS-NEW",
            "MATH-STEM"
        ],
        "note": "supportive prep only"
    },
    {
        "campusId": "uw-bothell",
        "family": "STEM, Computing, And Quantitative Majors",
        "title": "Conservation \u0026 Restoration Science (BS)",
        "bankIds": [
            "EARTH",
            "BIO",
            "CHEM",
            "MATH"
        ],
        "chainIds": [
            "BIO-MAJORS",
            "CHEM-GEN",
            "MATH-STEM",
            "NATRS-COMBO"
        ],
        "note": "strong environment/restoration prep"
    },
    {
        "campusId": "uw-bothell",
        "family": "STEM, Computing, And Quantitative Majors",
        "title": "Data Visualization (BA)",
        "bankIds": [
            "MATH",
            "CS",
            "ART",
            "COMM"
        ],
        "chainIds": [
            "MATH-STEM",
            "CS-NEW"
        ],
        "note": "supportive prep only"
    },
    {
        "campusId": "uw-bothell",
        "family": "STEM, Computing, And Quantitative Majors",
        "title": "Data Visualization (BS)",
        "bankIds": [
            "MATH",
            "CS",
            "ART",
            "COMM"
        ],
        "chainIds": [
            "MATH-STEM",
            "CS-NEW"
        ],
        "note": "supportive prep only"
    },
    {
        "campusId": "uw-bothell",
        "family": "STEM, Computing, And Quantitative Majors",
        "title": "Earth System Science (BS)",
        "bankIds": [
            "EARTH",
            "CHEM",
            "MATH",
            "PHYS"
        ],
        "chainIds": [
            "MATH-STEM",
            "PHYS-CALC",
            "CHEM-GEN"
        ],
        "note": "direct earth-science support"
    },
    {
        "campusId": "uw-bothell",
        "family": "STEM, Computing, And Quantitative Majors",
        "title": "Electrical Engineering (BS)",
        "bankIds": [
            "ENGR",
            "CS",
            "MATH",
            "PHYS",
            "CHEM"
        ],
        "chainIds": [
            "CS-NEW",
            "MATH-STEM",
            "PHYS-CALC",
            "CHEM-GEN"
        ],
        "note": "direct engineering-prep coverage"
    },
    {
        "campusId": "uw-bothell",
        "family": "STEM, Computing, And Quantitative Majors",
        "title": "Mathematical Thinking \u0026 Visualization (BA)",
        "bankIds": [
            "MATH",
            "CS",
            "ART"
        ],
        "chainIds": [
            "MATH-STEM",
            "CS-NEW"
        ],
        "note": "supportive prep only"
    },
    {
        "campusId": "uw-bothell",
        "family": "STEM, Computing, And Quantitative Majors",
        "title": "Mathematics (BS)",
        "bankIds": [
            "MATH",
            "PHYS",
            "CS"
        ],
        "chainIds": [
            "MATH-STEM",
            "PHYS-CALC",
            "CS-NEW"
        ],
        "note": "direct quantitative prep"
    },
    {
        "campusId": "uw-bothell",
        "family": "STEM, Computing, And Quantitative Majors",
        "title": "Mechanical Engineering (BS)",
        "bankIds": [
            "ENGR",
            "MATH",
            "PHYS",
            "CHEM"
        ],
        "chainIds": [
            "MATH-STEM",
            "PHYS-CALC",
            "CHEM-GEN"
        ],
        "note": "direct engineering-prep coverage"
    },
    {
        "campusId": "uw-bothell",
        "family": "STEM, Computing, And Quantitative Majors",
        "title": "Physics (BA)",
        "bankIds": [
            "PHYS",
            "MATH",
            "CHEM"
        ],
        "chainIds": [
            "PHYS-CALC",
            "MATH-STEM",
            "CHEM-GEN"
        ],
        "note": "direct science-prep coverage"
    },
    {
        "campusId": "uw-bothell",
        "family": "STEM, Computing, And Quantitative Majors",
        "title": "Physics (BS)",
        "bankIds": [
            "PHYS",
            "MATH",
            "CHEM"
        ],
        "chainIds": [
            "PHYS-CALC",
            "MATH-STEM",
            "CHEM-GEN"
        ],
        "note": "direct science-prep coverage"
    },
    {
        "campusId": "uw-bothell",
        "family": "Business, Health, Education, And Social Science Majors",
        "title": "Business Administration (BA)",
        "bankIds": [
            "BUS",
            "MATH"
        ],
        "chainIds": [
            "MATH-BUS",
            "ACCT-COMBO"
        ],
        "note": "base business pathway"
    },
    {
        "campusId": "uw-bothell",
        "family": "Business, Health, Education, And Social Science Majors",
        "title": "Business Administration: Accounting (BA)",
        "bankIds": [
            "BUS",
            "MATH"
        ],
        "chainIds": [
            "MATH-BUS",
            "ACCT-COMBO"
        ],
        "note": "accounting-focused business pathway"
    },
    {
        "campusId": "uw-bothell",
        "family": "Business, Health, Education, And Social Science Majors",
        "title": "Business Administration: Finance (BA)",
        "bankIds": [
            "BUS",
            "MATH"
        ],
        "chainIds": [
            "MATH-BUS",
            "ACCT-COMBO"
        ],
        "note": "finance-focused business pathway"
    },
    {
        "campusId": "uw-bothell",
        "family": "Business, Health, Education, And Social Science Majors",
        "title": "Business Administration: Leadership \u0026 Strategic Innovation (BA)",
        "bankIds": [
            "BUS",
            "MATH",
            "COMM"
        ],
        "chainIds": [
            "MATH-BUS"
        ],
        "note": "supportive business prep only"
    },
    {
        "campusId": "uw-bothell",
        "family": "Business, Health, Education, And Social Science Majors",
        "title": "Business Administration: Marketing (BA)",
        "bankIds": [
            "BUS",
            "COMM",
            "MATH"
        ],
        "chainIds": [
            "MATH-BUS"
        ],
        "note": "supportive business prep only"
    },
    {
        "campusId": "uw-bothell",
        "family": "Business, Health, Education, And Social Science Majors",
        "title": "Business Administration: Supply Chain Management (BA)",
        "bankIds": [
            "BUS",
            "MATH"
        ],
        "chainIds": [
            "MATH-BUS"
        ],
        "note": "supportive business prep only"
    },
    {
        "campusId": "uw-bothell",
        "family": "Business, Health, Education, And Social Science Majors",
        "title": "Developmental and Youth Studies (BA)",
        "bankIds": [
            "PSYED"
        ],
        "chainIds": [],
        "note": "direct education/child-development support"
    },
    {
        "campusId": "uw-bothell",
        "family": "Business, Health, Education, And Social Science Majors",
        "title": "Economics (BS)",
        "bankIds": [
            "BUS",
            "MATH"
        ],
        "chainIds": [
            "MATH-BUS",
            "MATH-STEM"
        ],
        "note": "economics plus quantitative prep"
    },
    {
        "campusId": "uw-bothell",
        "family": "Business, Health, Education, And Social Science Majors",
        "title": "Educational Studies: Elementary Education (BA)",
        "bankIds": [
            "PSYED",
            "MATH"
        ],
        "chainIds": [
            "MATH-BUS"
        ],
        "note": "teacher-prep support through ECED/EDUC plus math"
    },
    {
        "campusId": "uw-bothell",
        "family": "Business, Health, Education, And Social Science Majors",
        "title": "Health Studies (BA)",
        "bankIds": [
            "BIO",
            "HEALTH",
            "PSYED"
        ],
        "chainIds": [
            "BIO-ANAT"
        ],
        "note": "supportive prep only"
    },
    {
        "campusId": "uw-bothell",
        "family": "Business, Health, Education, And Social Science Majors",
        "title": "Law, Economics \u0026 Public Policy (BA)",
        "bankIds": [
            "POLSOC",
            "BUS",
            "PHIL"
        ],
        "chainIds": [
            "MATH-BUS"
        ],
        "note": "supportive policy/econ prep"
    },
    {
        "campusId": "uw-bothell",
        "family": "Business, Health, Education, And Social Science Majors",
        "title": "Nursing (BS), First Year RN to BSN (Direct Entry)",
        "bankIds": [
            "BIO",
            "CHEM",
            "HEALTH",
            "PSYED",
            "COMM"
        ],
        "chainIds": [
            "BIO-ANAT",
            "CHEM-GEN"
        ],
        "note": "pre-nursing prep only"
    },
    {
        "campusId": "uw-bothell",
        "family": "Business, Health, Education, And Social Science Majors",
        "title": "Nursing (BS), RN to BSN",
        "bankIds": [
            "BIO",
            "CHEM",
            "HEALTH",
            "PSYED",
            "COMM"
        ],
        "chainIds": [
            "BIO-ANAT",
            "CHEM-GEN"
        ],
        "note": "for licensed RN students, planner should treat this as support-only"
    },
    {
        "campusId": "uw-bothell",
        "family": "Business, Health, Education, And Social Science Majors",
        "title": "Psychology (BA)",
        "bankIds": [
            "PSYED",
            "BIO"
        ],
        "chainIds": [],
        "note": "direct psychology support"
    },
    {
        "campusId": "uw-bothell",
        "family": "Business, Health, Education, And Social Science Majors",
        "title": "Science, Technology \u0026 Society (BA)",
        "bankIds": [
            "ENGL",
            "HIST",
            "PHIL",
            "CS",
            "MATH"
        ],
        "chainIds": [
            "CS-NEW",
            "MATH-STEM"
        ],
        "note": "supportive interdisciplinary prep"
    },
    {
        "campusId": "uw-bothell",
        "family": "Business, Health, Education, And Social Science Majors",
        "title": "Society, Ethics \u0026 Human Behavior (BA)",
        "bankIds": [
            "PHIL",
            "POLSOC",
            "PSYED",
            "HIST"
        ],
        "chainIds": [],
        "note": "supportive interdisciplinary prep"
    },
    {
        "campusId": "uw-bothell",
        "family": "Arts, Humanities, Media, And Global Majors",
        "title": "American \u0026 Ethnic Studies (BA)",
        "bankIds": [
            "AAMES",
            "HIST",
            "ENGL"
        ],
        "chainIds": [],
        "note": "direct subject support"
    },
    {
        "campusId": "uw-bothell",
        "family": "Arts, Humanities, Media, And Global Majors",
        "title": "Culture, Literature \u0026 the Arts (BA)",
        "bankIds": [
            "ENGL",
            "ART",
            "PERF",
            "MUSIC",
            "HIST"
        ],
        "chainIds": [
            "ENGL-250"
        ],
        "note": "supportive interdisciplinary arts/humanities prep"
    },
    {
        "campusId": "uw-bothell",
        "family": "Arts, Humanities, Media, And Global Majors",
        "title": "Environmental Studies (BA)",
        "bankIds": [
            "EARTH",
            "HIST",
            "POLSOC",
            "ENGL"
        ],
        "chainIds": [],
        "note": "supportive prep only"
    },
    {
        "campusId": "uw-bothell",
        "family": "Arts, Humanities, Media, And Global Majors",
        "title": "Gender, Women, \u0026 Sexuality Studies (BA)",
        "bankIds": [
            "PHIL",
            "HIST",
            "POLSOC",
            "PSYED",
            "AAMES"
        ],
        "chainIds": [],
        "note": "supportive prep only"
    },
    {
        "campusId": "uw-bothell",
        "family": "Arts, Humanities, Media, And Global Majors",
        "title": "Global Studies (BA)",
        "bankIds": [
            "HIST",
            "POLSOC",
            "ENGL",
            "LANG-CHIN",
            "LANG-FR",
            "LANG-GER",
            "LANG-JP",
            "LANG-SP"
        ],
        "chainIds": [
            "LANG-CHIN",
            "LANG-FR",
            "LANG-GER",
            "LANG-JP",
            "LANG-SP"
        ],
        "note": "supportive prep only"
    },
    {
        "campusId": "uw-bothell",
        "family": "Arts, Humanities, Media, And Global Majors",
        "title": "Interactive Media Design (BA)",
        "bankIds": [
            "ART",
            "COMM",
            "CS"
        ],
        "chainIds": [
            "CS-NEW"
        ],
        "note": "supportive media/design prep"
    },
    {
        "campusId": "uw-bothell",
        "family": "Arts, Humanities, Media, And Global Majors",
        "title": "Interdisciplinary Arts (BA)",
        "bankIds": [
            "ART",
            "PERF",
            "MUSIC",
            "ENGL"
        ],
        "chainIds": [],
        "note": "supportive prep only"
    },
    {
        "campusId": "uw-bothell",
        "family": "Arts, Humanities, Media, And Global Majors",
        "title": "Interdisciplinary Studies: Individualized Study (BA)",
        "bankIds": [
            "varies"
        ],
        "chainIds": [
            "varies"
        ],
        "note": "planner must build a custom bank set"
    },
    {
        "campusId": "uw-bothell",
        "family": "Arts, Humanities, Media, And Global Majors",
        "title": "Media \u0026 Communications Studies (BA)",
        "bankIds": [
            "COMM"
        ],
        "chainIds": [
            "COMM-266"
        ],
        "note": "direct media/communication support"
    },
    {
        "campusId": "uw-tacoma",
        "family": "Engineering, Computing, And Quantitative Majors",
        "title": "Biomedical Sciences (BS)",
        "bankIds": [
            "BIO",
            "CHEM",
            "PHYS",
            "MATH"
        ],
        "chainIds": [
            "BIO-MAJORS",
            "CHEM-GEN",
            "CHEM-ORG",
            "PHYS-CALC",
            "MATH-STEM"
        ],
        "note": "direct science-prep coverage"
    },
    {
        "campusId": "uw-tacoma",
        "family": "Engineering, Computing, And Quantitative Majors",
        "title": "Civil Engineering (BSCE)",
        "bankIds": [
            "ENGR",
            "MATH",
            "PHYS",
            "CHEM"
        ],
        "chainIds": [
            "MATH-STEM",
            "PHYS-CALC",
            "CHEM-GEN"
        ],
        "note": "direct engineering-prep coverage"
    },
    {
        "campusId": "uw-tacoma",
        "family": "Engineering, Computing, And Quantitative Majors",
        "title": "Computer Engineering (BS)",
        "bankIds": [
            "CS",
            "MATH",
            "PHYS",
            "ENGR",
            "CHEM"
        ],
        "chainIds": [
            "CS-NEW",
            "MATH-STEM",
            "PHYS-CALC",
            "CHEM-GEN"
        ],
        "note": "direct engineering-prep coverage"
    },
    {
        "campusId": "uw-tacoma",
        "family": "Engineering, Computing, And Quantitative Majors",
        "title": "Computer Science and Systems (BA)",
        "bankIds": [
            "CS",
            "MATH",
            "PHYS"
        ],
        "chainIds": [
            "CS-NEW",
            "MATH-STEM",
            "PHYS-CALC"
        ],
        "note": "supportive computing prep"
    },
    {
        "campusId": "uw-tacoma",
        "family": "Engineering, Computing, And Quantitative Majors",
        "title": "Computer Science and Systems (BS)",
        "bankIds": [
            "CS",
            "MATH",
            "PHYS"
        ],
        "chainIds": [
            "CS-NEW",
            "MATH-STEM",
            "PHYS-CALC"
        ],
        "note": "direct computing prep"
    },
    {
        "campusId": "uw-tacoma",
        "family": "Engineering, Computing, And Quantitative Majors",
        "title": "Electrical Engineering (BSEE)",
        "bankIds": [
            "ENGR",
            "CS",
            "MATH",
            "PHYS",
            "CHEM"
        ],
        "chainIds": [
            "CS-NEW",
            "MATH-STEM",
            "PHYS-CALC",
            "CHEM-GEN"
        ],
        "note": "direct engineering-prep coverage"
    },
    {
        "campusId": "uw-tacoma",
        "family": "Engineering, Computing, And Quantitative Majors",
        "title": "Environmental Science (BS)",
        "bankIds": [
            "EARTH",
            "BIO",
            "CHEM",
            "MATH"
        ],
        "chainIds": [
            "BIO-MAJORS",
            "CHEM-GEN",
            "MATH-STEM",
            "NATRS-COMBO"
        ],
        "note": "strong environmental-science prep"
    },
    {
        "campusId": "uw-tacoma",
        "family": "Engineering, Computing, And Quantitative Majors",
        "title": "Information Technology (BS)",
        "bankIds": [
            "CS",
            "MATH",
            "COMM"
        ],
        "chainIds": [
            "CS-NEW",
            "MATH-STEM"
        ],
        "note": "supportive IT prep only"
    },
    {
        "campusId": "uw-tacoma",
        "family": "Engineering, Computing, And Quantitative Majors",
        "title": "Mathematics (BS)",
        "bankIds": [
            "MATH",
            "CS",
            "PHYS"
        ],
        "chainIds": [
            "MATH-STEM",
            "CS-NEW",
            "PHYS-CALC"
        ],
        "note": "direct quantitative prep"
    },
    {
        "campusId": "uw-tacoma",
        "family": "Engineering, Computing, And Quantitative Majors",
        "title": "Mechanical Engineering (BSME)",
        "bankIds": [
            "ENGR",
            "MATH",
            "PHYS",
            "CHEM"
        ],
        "chainIds": [
            "MATH-STEM",
            "PHYS-CALC",
            "CHEM-GEN"
        ],
        "note": "direct engineering-prep coverage"
    },
    {
        "campusId": "uw-tacoma",
        "family": "Engineering, Computing, And Quantitative Majors",
        "title": "Urban Design (BS)",
        "bankIds": [
            "ART",
            "EARTH",
            "MATH"
        ],
        "chainIds": [
            "MATH-STEM"
        ],
        "note": "supportive design/environment prep only"
    },
    {
        "campusId": "uw-tacoma",
        "family": "Business, Policy, Health, And Social Science Majors",
        "title": "Bachelor of Arts in Business Administration (BABA)",
        "bankIds": [
            "BUS",
            "MATH"
        ],
        "chainIds": [
            "MATH-BUS",
            "ACCT-COMBO"
        ],
        "note": "use accounting/finance/management/marketing options after transfer"
    },
    {
        "campusId": "uw-tacoma",
        "family": "Business, Policy, Health, And Social Science Majors",
        "title": "Criminal Justice (BA)",
        "bankIds": [
            "POLSOC"
        ],
        "chainIds": [],
        "note": "direct CJ support"
    },
    {
        "campusId": "uw-tacoma",
        "family": "Business, Policy, Health, And Social Science Majors",
        "title": "Economics and Policy Analysis (BA)",
        "bankIds": [
            "BUS",
            "POLSOC",
            "MATH"
        ],
        "chainIds": [
            "MATH-BUS",
            "MATH-STEM"
        ],
        "note": "supportive policy/econ prep"
    },
    {
        "campusId": "uw-tacoma",
        "family": "Business, Policy, Health, And Social Science Majors",
        "title": "Education (BA)",
        "bankIds": [
            "PSYED"
        ],
        "chainIds": [],
        "note": "direct education-prep support"
    },
    {
        "campusId": "uw-tacoma",
        "family": "Business, Policy, Health, And Social Science Majors",
        "title": "Ethnic, Gender and Labor Studies (BA)",
        "bankIds": [
            "AAMES",
            "HIST",
            "POLSOC",
            "PHIL",
            "PSYED"
        ],
        "chainIds": [],
        "note": "supportive interdisciplinary prep"
    },
    {
        "campusId": "uw-tacoma",
        "family": "Business, Policy, Health, And Social Science Majors",
        "title": "Healthcare Leadership (BA)",
        "bankIds": [
            "BIO",
            "HEALTH",
            "BUS",
            "PSYED"
        ],
        "chainIds": [
            "BIO-ANAT",
            "MATH-BUS"
        ],
        "note": "supportive prep only"
    },
    {
        "campusId": "uw-tacoma",
        "family": "Business, Policy, Health, And Social Science Majors",
        "title": "Law and Policy (BA)",
        "bankIds": [
            "POLSOC",
            "PHIL",
            "HIST"
        ],
        "chainIds": [],
        "note": "direct policy-support prep"
    },
    {
        "campusId": "uw-tacoma",
        "family": "Business, Policy, Health, And Social Science Majors",
        "title": "Nursing (BSN)",
        "bankIds": [
            "BIO",
            "CHEM",
            "HEALTH",
            "PSYED",
            "COMM"
        ],
        "chainIds": [
            "BIO-ANAT",
            "CHEM-GEN"
        ],
        "note": "pre-nursing prep only"
    },
    {
        "campusId": "uw-tacoma",
        "family": "Business, Policy, Health, And Social Science Majors",
        "title": "Politics, Philosophy and Economics (BA)",
        "bankIds": [
            "POLSOC",
            "PHIL",
            "BUS",
            "MATH"
        ],
        "chainIds": [
            "MATH-BUS",
            "MATH-STEM"
        ],
        "note": "supportive PPE prep"
    },
    {
        "campusId": "uw-tacoma",
        "family": "Business, Policy, Health, And Social Science Majors",
        "title": "Psychology (BA)",
        "bankIds": [
            "PSYED",
            "BIO"
        ],
        "chainIds": [],
        "note": "direct psychology support"
    },
    {
        "campusId": "uw-tacoma",
        "family": "Business, Policy, Health, And Social Science Majors",
        "title": "Social Welfare (BA)",
        "bankIds": [
            "POLSOC",
            "PSYED",
            "HIST"
        ],
        "chainIds": [],
        "note": "supportive prep only"
    },
    {
        "campusId": "uw-tacoma",
        "family": "Business, Policy, Health, And Social Science Majors",
        "title": "Urban Studies (BA)",
        "bankIds": [
            "EARTH",
            "POLSOC",
            "MATH"
        ],
        "chainIds": [],
        "note": "supportive urban/community planning prep"
    },
    {
        "campusId": "uw-tacoma",
        "family": "Arts, Humanities, Languages, And Interdisciplinary Majors",
        "title": "Arts, Media and Culture (BA)",
        "bankIds": [
            "ART",
            "COMM",
            "PERF",
            "MUSIC",
            "ENGL",
            "HIST"
        ],
        "chainIds": [
            "COMM-266",
            "ENGL-250"
        ],
        "note": "supportive interdisciplinary arts prep"
    },
    {
        "campusId": "uw-tacoma",
        "family": "Arts, Humanities, Languages, And Interdisciplinary Majors",
        "title": "Communications (BA)",
        "bankIds": [
            "COMM"
        ],
        "chainIds": [
            "COMM-266"
        ],
        "note": "direct communication support"
    },
    {
        "campusId": "uw-tacoma",
        "family": "Arts, Humanities, Languages, And Interdisciplinary Majors",
        "title": "Environmental Sustainability (BA)",
        "bankIds": [
            "EARTH",
            "POLSOC",
            "HIST",
            "ENGL"
        ],
        "chainIds": [],
        "note": "supportive prep only"
    },
    {
        "campusId": "uw-tacoma",
        "family": "Arts, Humanities, Languages, And Interdisciplinary Majors",
        "title": "History (BA)",
        "bankIds": [
            "HIST",
            "ENGL"
        ],
        "chainIds": [
            "HIST-US"
        ],
        "note": "direct history support"
    },
    {
        "campusId": "uw-tacoma",
        "family": "Arts, Humanities, Languages, And Interdisciplinary Majors",
        "title": "Interdisciplinary Arts and Sciences (BA)",
        "bankIds": [
            "varies"
        ],
        "chainIds": [
            "varies"
        ],
        "note": "planner should choose banks by student concentration"
    },
    {
        "campusId": "uw-tacoma",
        "family": "Arts, Humanities, Languages, And Interdisciplinary Majors",
        "title": "Interdisciplinary Arts and Sciences: Individually-designed (BA)",
        "bankIds": [
            "varies"
        ],
        "chainIds": [
            "varies"
        ],
        "note": "planner must build a custom bank set"
    },
    {
        "campusId": "uw-tacoma",
        "family": "Arts, Humanities, Languages, And Interdisciplinary Majors",
        "title": "Spanish Language and Cultures (BA)",
        "bankIds": [
            "LANG-SP",
            "ENGL"
        ],
        "chainIds": [
            "LANG-SP"
        ],
        "note": "direct Spanish support"
    },
    {
        "campusId": "uw-tacoma",
        "family": "Arts, Humanities, Languages, And Interdisciplinary Majors",
        "title": "Sustainable Urban Development (BA)",
        "bankIds": [
            "EARTH",
            "POLSOC",
            "MATH"
        ],
        "chainIds": [],
        "note": "supportive planning/sustainability prep"
    },
    {
        "campusId": "uw-tacoma",
        "family": "Arts, Humanities, Languages, And Interdisciplinary Majors",
        "title": "Writing Studies (BA)",
        "bankIds": [
            "ENGL",
            "COMM"
        ],
        "chainIds": [
            "WRIT-SEQ",
            "ENGL-250"
        ],
        "note": "direct writing/communication support"
    }
];
