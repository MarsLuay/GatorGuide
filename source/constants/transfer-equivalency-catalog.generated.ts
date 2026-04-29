/* eslint-disable */
/* auto-generated from constants/transfer-planner-source for the lightweight web equivalency catalog */

import type { TransferEquivalencyTrackedTag } from "./transfer-equivalency-tags";
import type { TransferPlannerCampusId } from "./transfer-planner-types";

export type TransferEquivalencyCatalogCampus = {
  id: TransferPlannerCampusId;
  title: string;
  summary?: string;
};

export type TransferEquivalencyCatalogEntry = {
  id: string;
  targetSchoolIds: TransferPlannerCampusId[];
  sourceCourseLabel: string;
  sourceCourseTitle: string | null;
  targetOutcome: string;
  tags: TransferEquivalencyTrackedTag[];
};

export const TRANSFER_EQUIVALENCY_CATALOG_CAMPUSES: TransferEquivalencyCatalogCampus[] = [
  {
    "id": "uw-bothell",
    "title": "UW Bothell",
    "summary": "Source-generated from parsed UW requirement-source registries."
  },
  {
    "id": "uw-seattle",
    "title": "UW Seattle",
    "summary": "Source-generated from parsed UW requirement-source registries."
  },
  {
    "id": "uw-tacoma",
    "title": "UW Tacoma",
    "summary": "Source-generated from parsed UW requirement-source registries."
  }
];

export const TRANSFER_EQUIVALENCY_CATALOG_ENTRIES: TransferEquivalencyCatalogEntry[] = [
  {
    "id": "uw-grc-guide:0004:american-minority-and-ethnic-studies:ames-100-5-formerly-eth-s-100",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "AMES 100 (5) formerly ETH S 100",
    "sourceCourseTitle": "Introduction to American Ethnic Studies",
    "targetOutcome": "UW 1XX",
    "tags": [
      "SSC"
    ]
  },
  {
    "id": "uw-grc-guide:0005:american-minority-and-ethnic-studies:ames-150-5",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "AMES 150 (5)",
    "sourceCourseTitle": "Race and Ethnicity in the Pacific",
    "targetOutcome": "UW 1XX",
    "tags": [
      "SSC"
    ]
  },
  {
    "id": "uw-grc-guide:0007:american-minority-and-ethnic-studies:ames-211-5-formerly-ames-215-same-as-anth-211-and-s-sci-211",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "AMES 211 (5) formerly AMES 215 same as ANTH 211 and S SCI 211",
    "sourceCourseTitle": null,
    "targetOutcome": "AIS 2XX",
    "tags": [
      "SSC"
    ]
  },
  {
    "id": "uw-grc-guide:0035:anthropology:anth-211-5-formerly-anthr-215-same-as-ames-211-and-s-sci-211",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "ANTH 211 (5) formerly ANTHR 215 same as AMES 211 and S SCI 211",
    "sourceCourseTitle": null,
    "targetOutcome": "AIS 2XX",
    "tags": [
      "SSC"
    ]
  },
  {
    "id": "uw-grc-guide:0020:anthropology:anthand-100-5-formerly-anthr-100",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "ANTH& 100 (5) formerly ANTHR 100",
    "sourceCourseTitle": "Survey of Anthropology",
    "targetOutcome": "ANTH 100 (5)",
    "tags": [
      "SSC"
    ]
  },
  {
    "id": "uw-grc-guide:0028:anthropology:anthand-204-5-formerly-anthr-203",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "ANTH& 204 (5) formerly ANTHR 203",
    "sourceCourseTitle": "Archaeology",
    "targetOutcome": "ARCHY 205 (5)",
    "tags": [
      "SSC"
    ]
  },
  {
    "id": "uw-grc-guide:0029:anthropology:anthand-205-5-formerly-anthr-201",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "ANTH& 205 (5) formerly ANTHR 201",
    "sourceCourseTitle": "Biological Anthropology",
    "targetOutcome": "BIO A 201 (5)",
    "tags": [
      "NSC"
    ]
  },
  {
    "id": "uw-grc-guide:0031:anthropology:anthand-206-5-formerly-anthr-202",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "ANTH& 206 (5) formerly ANTHR 202",
    "sourceCourseTitle": "Cultural Anthropology",
    "targetOutcome": "ANTH 202 (5)",
    "tags": [
      "SSC"
    ]
  },
  {
    "id": "uw-grc-guide:0033:anthropology:anthand-210-5-formerly-anthr-210",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "ANTH& 210 (5) formerly ANTHR 210",
    "sourceCourseTitle": "Indigenous Peoples of North America",
    "targetOutcome": "ANTH 2XX",
    "tags": [
      "SSC"
    ]
  },
  {
    "id": "uw-grc-guide:0038:anthropology:anthand-216-5-formerly-anthr-220",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "ANTH& 216 (5) formerly ANTHR 220",
    "sourceCourseTitle": "Indigenous Peoples of the Northwest Coast",
    "targetOutcome": "AIS 2XX",
    "tags": [
      "SSC"
    ]
  },
  {
    "id": "uw-grc-guide:0040:anthropology:anthand-234-5-formerly-anthr-206",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "ANTH& 234 (5) formerly ANTHR 206",
    "sourceCourseTitle": "Religion and Culture",
    "targetOutcome": "RELIG 2XX",
    "tags": [
      "SSC"
    ]
  },
  {
    "id": "uw-grc-guide:0041:anthropology:anthand-235-5-formerly-anthr-205",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "ANTH& 235 (5) formerly ANTHR 205",
    "sourceCourseTitle": "Cross-Cultural Medicine",
    "targetOutcome": "ANTH 2XX",
    "tags": [
      "SSC"
    ]
  },
  {
    "id": "uw-grc-guide:0042:anthropology:anthand-236-5-formerly-anthr-265",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "ANTH& 236 (5) formerly ANTHR 265",
    "sourceCourseTitle": "Forensic Anthropology",
    "targetOutcome": "BIO A 2XX",
    "tags": [
      "SSC",
      "NSC"
    ]
  },
  {
    "id": "uw-grc-guide:0010:anatomy-and-physiology-prefix-formerly-a-phy:ap-100-5",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "AP 100 (5)",
    "sourceCourseTitle": "Survey of Human Anatomy and Physiology",
    "targetOutcome": "BIOL 1XX",
    "tags": [
      "NSC"
    ]
  },
  {
    "id": "uw-grc-guide:0011:anatomy-and-physiology-prefix-formerly-a-phy:ap-102-5",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "AP 102 (5)",
    "sourceCourseTitle": "Bringing Anatomy and Physiology to Life",
    "targetOutcome": "BIOL 1XX",
    "tags": [
      "NSC"
    ]
  },
  {
    "id": "uw-grc-guide:0012:anatomy-and-physiology-prefix-formerly-a-phy:ap-103-5",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "AP 103 (5)",
    "sourceCourseTitle": "Essentials of Human Anatomy and Physiology 1",
    "targetOutcome": "BIOL 1XX",
    "tags": [
      "NSC"
    ]
  },
  {
    "id": "uw-grc-guide:0013:anatomy-and-physiology-prefix-formerly-a-phy:ap-104-5",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "AP 104 (5)",
    "sourceCourseTitle": "Essentials of Human Anatomy and Physiology 2",
    "targetOutcome": "BIOL 1XX",
    "tags": [
      "NSC"
    ]
  },
  {
    "id": "uw-grc-guide:0019:anatomy-and-physiology-prefix-formerly-a-phy:ap-210-1",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "AP 210 (1)",
    "sourceCourseTitle": "Cadaver Anatomy",
    "targetOutcome": "BIOL 2XX",
    "tags": [
      "NSC"
    ]
  },
  {
    "id": "uw-grc-guide:0059:art:art-105-5",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "ART 105 (5)",
    "sourceCourseTitle": "Beginning Drawing",
    "targetOutcome": "ART 1XX",
    "tags": [
      "AH"
    ]
  },
  {
    "id": "uw-grc-guide:0060:art:art-106-5",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "ART 106 (5)",
    "sourceCourseTitle": "Intermediate Drawing",
    "targetOutcome": "ART 1XX",
    "tags": [
      "AH"
    ]
  },
  {
    "id": "uw-grc-guide:0061:art:art-107-5",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "ART 107 (5)",
    "sourceCourseTitle": "Advanced Drawing",
    "targetOutcome": "ART 1XX",
    "tags": [
      "AH"
    ]
  },
  {
    "id": "uw-grc-guide:0062:art:art-109-5",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "ART 109 (5)",
    "sourceCourseTitle": "Beginning Design",
    "targetOutcome": "ART 1XX",
    "tags": [
      "AH"
    ]
  },
  {
    "id": "uw-grc-guide:0063:art:art-110-5",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "ART 110 (5)",
    "sourceCourseTitle": "Intermediate Design and Color",
    "targetOutcome": "ART 1XX",
    "tags": [
      "AH"
    ]
  },
  {
    "id": "uw-grc-guide:0064:art:art-111-5",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "ART 111 (5)",
    "sourceCourseTitle": "Painting 1",
    "targetOutcome": "ART 1XX",
    "tags": [
      "AH"
    ]
  },
  {
    "id": "uw-grc-guide:0065:art:art-112-5",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "ART 112 (5)",
    "sourceCourseTitle": "Painting 2",
    "targetOutcome": "ART 1XX",
    "tags": [
      "AH"
    ]
  },
  {
    "id": "uw-grc-guide:0066:art:art-113-5",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "ART 113 (5)",
    "sourceCourseTitle": "Painting 3",
    "targetOutcome": "ART 1XX",
    "tags": [
      "AH"
    ]
  },
  {
    "id": "uw-grc-guide:0067:art:art-114-3-5",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "ART 114 (3 - 5)",
    "sourceCourseTitle": "Pottery 1",
    "targetOutcome": "ART 1XX",
    "tags": [
      "AH"
    ]
  },
  {
    "id": "uw-grc-guide:0068:art:art-115-3-5",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "ART 115 (3 - 5)",
    "sourceCourseTitle": "Pottery 2",
    "targetOutcome": "ART 1XX",
    "tags": [
      "AH"
    ]
  },
  {
    "id": "uw-grc-guide:0070:art:art-119-5-formerly-art-209-5",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "ART 119 (5) formerly ART 209 (5)",
    "sourceCourseTitle": "3-Dimensional Design",
    "targetOutcome": "ART 1XX",
    "tags": [
      "AH"
    ]
  },
  {
    "id": "uw-grc-guide:0071:art:art-120-5",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "ART 120 (5)",
    "sourceCourseTitle": "Introduction to Graphic Design",
    "targetOutcome": "ART 1XX",
    "tags": [
      "AH"
    ]
  },
  {
    "id": "uw-grc-guide:0073:art:art-130-3",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "ART 130 (3)",
    "sourceCourseTitle": "Watercolor Painting",
    "targetOutcome": "ART 1XX",
    "tags": [
      "AH"
    ]
  },
  {
    "id": "uw-grc-guide:0076:art:art-133-3",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "ART 133 (3)",
    "sourceCourseTitle": null,
    "targetOutcome": "ART 1XX",
    "tags": [
      "AH"
    ]
  },
  {
    "id": "uw-grc-guide:0078:art:art-135-3",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "ART 135 (3)",
    "sourceCourseTitle": "Introduction to Screen Printing",
    "targetOutcome": "ART 1XX",
    "tags": [
      "AH"
    ]
  },
  {
    "id": "uw-grc-guide:0094:art:art-212-5",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "ART 212 (5)",
    "sourceCourseTitle": "History of Art 1",
    "targetOutcome": "ART H 201 (5)",
    "tags": [
      "AH"
    ]
  },
  {
    "id": "uw-grc-guide:0095:art:art-213-5",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "ART 213 (5)",
    "sourceCourseTitle": "History of Art 2",
    "targetOutcome": "ART H 202 (5)",
    "tags": [
      "AH"
    ]
  },
  {
    "id": "uw-grc-guide:0096:art:art-214-5",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "ART 214 (5)",
    "sourceCourseTitle": "History of Art 3",
    "targetOutcome": "ART H 203 (5)",
    "tags": [
      "AH"
    ]
  },
  {
    "id": "uw-grc-guide:0097:art:art-219-5-formerly-art-210",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "ART 219 (5) formerly ART 210",
    "sourceCourseTitle": "Advanced 3-Dimensional Design",
    "targetOutcome": "ART 2XX",
    "tags": [
      "AH"
    ]
  },
  {
    "id": "uw-grc-guide:0098:art:art-251-5",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "ART 251 (5)",
    "sourceCourseTitle": "Ceramics 1",
    "targetOutcome": "ART 2XX",
    "tags": [
      "AH"
    ]
  },
  {
    "id": "uw-grc-guide:0099:art:art-252-5",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "ART 252 (5)",
    "sourceCourseTitle": "Ceramics 2",
    "targetOutcome": "ART 2XX",
    "tags": [
      "AH"
    ]
  },
  {
    "id": "uw-grc-guide:0100:art:art-253-5",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "ART 253 (5)",
    "sourceCourseTitle": "Ceramics 3",
    "targetOutcome": "ART 2XX",
    "tags": [
      "AH"
    ]
  },
  {
    "id": "uw-grc-guide:0101:art:art-255-5",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "ART 255 (5)",
    "sourceCourseTitle": "Advanced Painting 1",
    "targetOutcome": "ART 2XX",
    "tags": [
      "AH"
    ]
  },
  {
    "id": "uw-grc-guide:0102:art:art-256-5",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "ART 256 (5)",
    "sourceCourseTitle": "Advanced Painting 2",
    "targetOutcome": "ART 2XX",
    "tags": [
      "AH"
    ]
  },
  {
    "id": "uw-grc-guide:0103:art:art-257-5",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "ART 257 (5)",
    "sourceCourseTitle": "Advanced Painting 3",
    "targetOutcome": "ART 2XX",
    "tags": [
      "AH"
    ]
  },
  {
    "id": "uw-grc-guide:0107:art:art-275-1-5",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "ART 275 (1-5)",
    "sourceCourseTitle": "Independent Study-Ceramics 1",
    "targetOutcome": "ART 2XX",
    "tags": [
      "AH"
    ]
  },
  {
    "id": "uw-grc-guide:0108:art:art-276-1-5",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "ART 276 (1-5)",
    "sourceCourseTitle": "Independent Study-Ceramics 2",
    "targetOutcome": "ART 2XX",
    "tags": [
      "AH"
    ]
  },
  {
    "id": "uw-grc-guide:0109:art:art-277-1-5",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "ART 277 (1-5)",
    "sourceCourseTitle": "Independent Study-Ceramics 3",
    "targetOutcome": "ART 2XX",
    "tags": [
      "AH"
    ]
  },
  {
    "id": "uw-grc-guide:0117:art:art-294-1-5",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "ART 294 (1-5)",
    "sourceCourseTitle": "Independent Study-Painting 1",
    "targetOutcome": "ART 2XX",
    "tags": [
      "AH"
    ]
  },
  {
    "id": "uw-grc-guide:0118:art:art-295-1-5",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "ART 295 (1-5)",
    "sourceCourseTitle": null,
    "targetOutcome": "ART 2XX",
    "tags": [
      "AH"
    ]
  },
  {
    "id": "uw-grc-guide:0119:art:art-296-1-5",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "ART 296 (1-5)",
    "sourceCourseTitle": null,
    "targetOutcome": "ART 2XX",
    "tags": [
      "AH"
    ]
  },
  {
    "id": "uw-grc-guide:0120:art:art-297-1-5",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "ART 297 (1-5)",
    "sourceCourseTitle": "Independent Study-Advanced Drawing 1",
    "targetOutcome": "ART 2XX",
    "tags": [
      "AH"
    ]
  },
  {
    "id": "uw-grc-guide:0121:art:art-298-1-5",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "ART 298 (1-5)",
    "sourceCourseTitle": null,
    "targetOutcome": "ART 2XX",
    "tags": [
      "AH"
    ]
  },
  {
    "id": "uw-grc-guide:0122:art:art-299-1-5",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "ART 299 (1-5)",
    "sourceCourseTitle": null,
    "targetOutcome": "ART 2XX",
    "tags": [
      "AH"
    ]
  },
  {
    "id": "uw-grc-guide:0056:art:artand-100-5-formerly-art-100",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "ART& 100 (5) formerly ART 100",
    "sourceCourseTitle": "Art Appreciation",
    "targetOutcome": "ART 1XX",
    "tags": [
      "AH"
    ]
  },
  {
    "id": "uw-grc-guide:0124:astronomy:astrand-100-101-5-5-formerly-astro-100-101",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "ASTR& 100, 101 (5, 5) formerly ASTRO 100, 101",
    "sourceCourseTitle": "Introduction to Astronomy",
    "targetOutcome": "ASTR 101 (5) for either course, 1XX (5)",
    "tags": [
      "NSC"
    ]
  },
  {
    "id": "uw-grc-guide:0141:biology:biol-103-5",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "BIOL 103 (5)",
    "sourceCourseTitle": "Introduction to Botany",
    "targetOutcome": "BIOL 1XX",
    "tags": [
      "NSC"
    ]
  },
  {
    "id": "uw-grc-guide:0143:biology:biol-110-5-formerly-biol-105",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "BIOL 110 (5) formerly BIOL 105",
    "sourceCourseTitle": "Northwest Ecology",
    "targetOutcome": "BIOL 1XX",
    "tags": [
      "NSC"
    ]
  },
  {
    "id": "uw-grc-guide:0152:biology:biol-127-5",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "BIOL 127 (5)",
    "sourceCourseTitle": "Natural Science of Australia and New Zealand",
    "targetOutcome": "BIOL 1XX",
    "tags": [
      "NSC"
    ]
  },
  {
    "id": "uw-grc-guide:0159:biology:biol-194-1-5",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "BIOL 194 (1-5)",
    "sourceCourseTitle": "Special Topics-Biology 1",
    "targetOutcome": "BIOL 1XX",
    "tags": [
      "NSC"
    ]
  },
  {
    "id": "uw-grc-guide:0160:biology:biol-195-1-4",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "BIOL 195 (1-4)",
    "sourceCourseTitle": "Special Topics-Biology 2",
    "targetOutcome": "BIOL 1XX",
    "tags": [
      "NSC"
    ]
  },
  {
    "id": "uw-grc-guide:0138:biology:bioland-100-5-formerly-biol-100",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "BIOL& 100 (5) formerly BIOL 100",
    "sourceCourseTitle": "Survey of Biology",
    "targetOutcome": "BIOL 100 (5)",
    "tags": [
      "NSC"
    ]
  },
  {
    "id": "biology-majors-full-sequence",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "BIOL& 211 + BIOL& 212 + BIOL& 213",
    "sourceCourseTitle": "Majors Cellular / Majors Animal / Majors Plant",
    "targetOutcome": "Full UW BIOL 180, 200, 220, and 2XX package.",
    "tags": [
      "NSC"
    ]
  },
  {
    "id": "uw-grc-guide:0168:biology:bioland-211-212-213-6-6-6-formerly-biol-201-202-203",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "BIOL& 211, 212, 213 (6, 6, 6) formerly BIOL 201, 202, 203",
    "sourceCourseTitle": "Majors Cellular / Majors Animal / Majors Plant",
    "targetOutcome": "BIOL 180, 200, 220, 2XX (5, 5, 5, 3) if all three courses taken; otherwise 2XX",
    "tags": [
      "NSC"
    ]
  },
  {
    "id": "anatomy-physiology-full-sequence",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "BIOL& 241 + BIOL& 242",
    "sourceCourseTitle": "Human Anatomy and Physiology 1 / Human Anatomy and Physiology 2",
    "targetOutcome": "UW BIOL 118, BIOL 119, and NURS 301 equivalency pattern used in health pathways.",
    "tags": [
      "NSC"
    ]
  },
  {
    "id": "uw-grc-guide:0169:biology:bioland-241-242-5-5-formerly-ap-205-206",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "BIOL& 241, 242 (5, 5) formerly AP 205, 206",
    "sourceCourseTitle": "Human Anatomy and Physiology 1 / Human Anatomy and Physiology 2",
    "targetOutcome": "BIOL 118, 119 (5, 1) NURS 301 (4) if both courses taken; otherwise, BIOL 2XX",
    "tags": [
      "NSC"
    ]
  },
  {
    "id": "uw-grc-guide:0171:biology:bioland-260-5-formerly-biol-210",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "BIOL& 260 (5) formerly BIOL 210",
    "sourceCourseTitle": "Microbiology",
    "targetOutcome": "MICROM 301,302 (3,2)",
    "tags": [
      "NSC"
    ]
  },
  {
    "id": "uw-grc-guide:0184:business-management:busand-101-1-5-formerly-b-a-101",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "BUS& 101 (1-5) formerly B A 101",
    "sourceCourseTitle": "Introduction to Business",
    "targetOutcome": "UW 1XX",
    "tags": [
      "SSC"
    ]
  },
  {
    "id": "uw-grc-guide:0186:business-management:busand-201-5",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "BUS& 201 (5)",
    "sourceCourseTitle": "Business Law and the Regulation of Business",
    "targetOutcome": "MGMT 200 (5)",
    "tags": [
      "SSC"
    ]
  },
  {
    "id": "uw-grc-guide:0196:chemistry:chemand-121-5-formerly-chem-101",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "CHEM& 121 (5) formerly CHEM 101",
    "sourceCourseTitle": "Introduction to Chemistry",
    "targetOutcome": "CHEM 120 (5)",
    "tags": [
      "NSC"
    ]
  },
  {
    "id": "uw-grc-guide:0197:chemistry:chemand-131-5-formerly-chem-102",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "CHEM& 131 (5) formerly CHEM 102",
    "sourceCourseTitle": "Introduction to Organic Chemistry and Biochemistry",
    "targetOutcome": "CHEM 220 (5)",
    "tags": [
      "NSC"
    ]
  },
  {
    "id": "uw-grc-guide:0198:chemistry:chemand-140-5-6-formerly-chem-140",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "CHEM& 140 (5-6) formerly CHEM 140",
    "sourceCourseTitle": "General Chemistry Prep with Lab",
    "targetOutcome": "CHEM 1XX",
    "tags": [
      "NSC"
    ]
  },
  {
    "id": "uw-grc-guide:0204:chemistry:chemand-161-6-formerly-chem-140",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "CHEM& 161 (6) formerly CHEM 140",
    "sourceCourseTitle": "General Chemistry with Lab I",
    "targetOutcome": "CHEM 142 (5), 1XX (1)",
    "tags": [
      "NSC"
    ]
  },
  {
    "id": "general-chemistry-full-sequence",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "CHEM& 161 + CHEM& 162 + CHEM& 163",
    "sourceCourseTitle": "General Chemistry with Lab I / General Chemistry with Lab II / General Chemistry with Lab III",
    "targetOutcome": "Full strongest general-chemistry transfer outcome used across many STEM majors.",
    "tags": [
      "NSC"
    ]
  },
  {
    "id": "uw-grc-guide:0205:chemistry:chemand-162-163-6-6-formerly-chem-150-160",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "CHEM& 162, 163 (6, 6) formerly CHEM 150, 160",
    "sourceCourseTitle": "General Chemistry with Lab II / General Chemistry with Lab III",
    "targetOutcome": "CHEM 152, 162 (5, 5), 1XX (2) if both courses taken; otherwise, CHEM 1XX",
    "tags": [
      "NSC"
    ]
  },
  {
    "id": "uw-grc-guide:0218:chemistry:chemand-261-6-formerly-chem-235",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "CHEM& 261 (6) formerly CHEM 235",
    "sourceCourseTitle": "Organic Chemistry with Lab I",
    "targetOutcome": "CHEM 237 (4), 2XX (2)",
    "tags": [
      "NSC"
    ]
  },
  {
    "id": "organic-chemistry-full-sequence",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "CHEM& 261 + CHEM& 262 + CHEM& 263",
    "sourceCourseTitle": "Organic Chemistry with Lab I / Organic Chemistry with Lab II / Organic Chemistry with Lab III",
    "targetOutcome": "Full UW CHEM 237, 238, 239, 241, and 242 package when the full sequence is completed.",
    "tags": [
      "NSC"
    ]
  },
  {
    "id": "uw-grc-guide:0217:chemistry:chemand-261-262-6-6-formerly-chem-235-236",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "CHEM& 261, 262 (6, 6) formerly CHEM 235, 236",
    "sourceCourseTitle": "Organic Chemistry with Lab I / Organic Chemistry with Lab II",
    "targetOutcome": "CHEM 237, 238, 241 (4, 4, 3), 2XX (1) if both courses taken; otherwise, as below",
    "tags": [
      "NSC"
    ]
  },
  {
    "id": "uw-grc-guide:0216:chemistry:chemand-261-262-263-6-6-6-formerly-chem-235-236-237",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "CHEM& 261, 262, 263 (6, 6, 6) formerly CHEM 235, 236, 237",
    "sourceCourseTitle": "Organic Chemistry with Lab I / Organic Chemistry with Lab II / Organic Chemistry with Lab III",
    "targetOutcome": "CHEM 237, 238, 239, 241, 242 (4, 4, 4, 3, 3) if all three courses taken; otherwise, as below",
    "tags": [
      "NSC"
    ]
  },
  {
    "id": "uw-grc-guide:0219:chemistry:chemand-262-6-formerly-chem-236",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "CHEM& 262 (6) formerly CHEM 236",
    "sourceCourseTitle": "Organic Chemistry with Lab II",
    "targetOutcome": "CHEM 238 (4), 2XX (2)",
    "tags": [
      "NSC"
    ]
  },
  {
    "id": "uw-grc-guide:0220:chemistry:chemand-263-6-formerly-chem-237",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "CHEM& 263 (6) formerly CHEM 237",
    "sourceCourseTitle": "Organic Chemistry with Lab III",
    "targetOutcome": "CHEM 239 (4), 2XX (2)",
    "tags": [
      "NSC"
    ]
  },
  {
    "id": "uw-grc-guide:0289:criminal-justice:cj-200-5-formerly-crj-200",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "CJ 200 (5) formerly CRJ 200",
    "sourceCourseTitle": "Constitutional Law",
    "targetOutcome": "LSJ 363 (5) or POL S 363 (5)",
    "tags": [
      "SSC"
    ]
  },
  {
    "id": "uw-grc-guide:0291:criminal-justice:cj-205-5-formerly-crj-205",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "CJ 205 (5) formerly CRJ 205",
    "sourceCourseTitle": "Criminal Evidence",
    "targetOutcome": "LSJ 2XX ( LC )",
    "tags": [
      "SSC"
    ]
  },
  {
    "id": "uw-grc-guide:0284:criminal-justice:cjand-101-5-formerly-crj-100",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "CJ& 101 (5) formerly CRJ 100",
    "sourceCourseTitle": "Introduction to Criminal Justice",
    "targetOutcome": "SOC 1XX",
    "tags": [
      "SSC"
    ]
  },
  {
    "id": "uw-grc-guide:0286:criminal-justice:cjand-105-5-formerly-crj-230",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "CJ& 105 (5) formerly CRJ 230",
    "sourceCourseTitle": "Introduction to Corrections",
    "targetOutcome": "LSJ 1XX ( LC )",
    "tags": [
      "SSC"
    ]
  },
  {
    "id": "uw-grc-guide:0287:criminal-justice:cjand-110-5-formerly-crj-225",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "CJ& 110 (5) formerly CRJ 225",
    "sourceCourseTitle": "Criminal Law",
    "targetOutcome": "LSJ 1XX ( LC )",
    "tags": [
      "SSC"
    ]
  },
  {
    "id": "uw-grc-guide:0245:communication-studies:cmst-212-5-formerly-comm-212",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "CMST 212 (5) formerly COMM 212",
    "sourceCourseTitle": "Persuasion and Propaganda",
    "targetOutcome": "COM 2XX",
    "tags": [
      "AH",
      "SSC"
    ]
  },
  {
    "id": "uw-grc-guide:0247:communication-studies:cmst-215-5-formerly-comm-215",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "CMST 215 (5) formerly COMM 215",
    "sourceCourseTitle": "Critical Analysis of Media",
    "targetOutcome": "COM 2XX",
    "tags": [
      "SSC"
    ]
  },
  {
    "id": "uw-grc-guide:0252:communication-studies:cmst-238-5-formerly-comm-238",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "CMST 238 (5) formerly COMM 238",
    "sourceCourseTitle": "Intercultural Communication",
    "targetOutcome": "COM 2XX",
    "tags": [
      "AH",
      "SSC"
    ]
  },
  {
    "id": "uw-grc-guide:0254:communication-studies:cmst-245-5-formerly-comm-245",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "CMST 245 (5) formerly COMM 245",
    "sourceCourseTitle": "Argumentation",
    "targetOutcome": "COM 334 (5)",
    "tags": [
      "AH",
      "SSC"
    ]
  },
  {
    "id": "uw-grc-guide:0255:communication-studies:cmst-265-5",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "CMST 265 (5)",
    "sourceCourseTitle": "Introduction to Popular Culture",
    "targetOutcome": "COM 2XX",
    "tags": [
      "AH",
      "SSC"
    ]
  },
  {
    "id": "uw-grc-guide:0256:communication-studies:cmst-266-1-5",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "CMST 266 (1-5)",
    "sourceCourseTitle": "Film and Television as Popular Culture",
    "targetOutcome": "CMS 272 if 5 credits taken, otherwise CMS 2XX",
    "tags": [
      "AH",
      "SSC"
    ]
  },
  {
    "id": "uw-grc-guide:0233:communication-studies:cmstand-102-5",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "CMST& 102 (5)",
    "sourceCourseTitle": "Introduction to Mass Media",
    "targetOutcome": "COM 1XX",
    "tags": [
      "SSC"
    ]
  },
  {
    "id": "uw-grc-guide:0244:communication-studies:cmstand-210-5-formerly-comm-110",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "CMST& 210 (5) formerly COMM 110",
    "sourceCourseTitle": "Interpersonal Communication",
    "targetOutcome": "COM 270 (5)",
    "tags": [
      "AH",
      "SSC"
    ]
  },
  {
    "id": "uw-grc-guide:0249:communication-studies:cmstand-220-5-formerly-comm-101",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "CMST& 220 (5) formerly COMM 101",
    "sourceCourseTitle": "Public Speaking",
    "targetOutcome": "COM 220 (5)",
    "tags": [
      "AH",
      "SSC"
    ]
  },
  {
    "id": "uw-grc-guide:0250:communication-studies:cmstand-230-5-formerly-comm-234",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "CMST& 230 (5) formerly COMM 234",
    "sourceCourseTitle": "Small Group Communication",
    "targetOutcome": "COM 2XX",
    "tags": [
      "AH"
    ]
  },
  {
    "id": "uw-grc-guide:0266:computer-science:cs-121-5",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "CS 121 (5)",
    "sourceCourseTitle": "Computer Programming 1",
    "targetOutcome": "CSE 121 (4), 1XX (1)",
    "tags": [
      "NSC"
    ]
  },
  {
    "id": "computer-science-new-sequence",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "CS 121 + CS 122 + CS 123",
    "sourceCourseTitle": "Computer Programming 1 / Computer Programming 2 - Java Objects / Computer Programming 3 - Java Data Structures",
    "targetOutcome": "Primary Green River intro programming sequence used for planning current CS pathways.",
    "tags": [
      "NSC"
    ]
  },
  {
    "id": "uw-grc-guide:0267:computer-science:cs-122-5",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "CS 122 (5)",
    "sourceCourseTitle": "Computer Programming 2 - Java Objects",
    "targetOutcome": "CSE 122 (4), 1XX (1)",
    "tags": [
      "NSC"
    ]
  },
  {
    "id": "uw-grc-guide:0268:computer-science:cs-123-5",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "CS 123 (5)",
    "sourceCourseTitle": "Computer Programming 3 - Java Data Structures",
    "targetOutcome": "CSE 123 (4), 1XX (1)",
    "tags": [
      "NSC"
    ]
  },
  {
    "id": "uw-grc-guide:0270:computer-science:cs-132-5-formerly-c-sci-143",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "CS 132 (5) formerly C SCI 143",
    "sourceCourseTitle": "C++ Data Structures",
    "targetOutcome": "UW 1XX",
    "tags": [
      "NSC"
    ]
  },
  {
    "id": "uw-grc-guide:0280:computer-science:cs-202-5",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "CS 202 (5)",
    "sourceCourseTitle": "Discrete Structures 1",
    "targetOutcome": "MATH 300 (4), 2XX (1)",
    "tags": [
      "NSC"
    ]
  },
  {
    "id": "uw-grc-guide:0269:computer-science:csand-131-5-formerly-c-sci-142",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "CS& 131 (5) formerly C SCI 142",
    "sourceCourseTitle": "Computer Science I C++",
    "targetOutcome": "CSE 1XX",
    "tags": [
      "NSC"
    ]
  },
  {
    "id": "uw-grc-guide:0271:computer-science:csand-141-5-formerly-c-sci-144",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "CS& 141 (5) formerly C SCI 144",
    "sourceCourseTitle": "Computer Science I Java",
    "targetOutcome": "CSE 142 (4), 1XX (1) or CSE 1XX (5) if either C SCI 142 or G E 142 is also taken",
    "tags": [
      "NSC"
    ]
  },
  {
    "id": "uw-grc-guide:0310:dance:dance-101-3",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "DANCE 101 (3)",
    "sourceCourseTitle": "Introduction to Dance",
    "targetOutcome": "DANCE 1XX",
    "tags": [
      "AH"
    ]
  },
  {
    "id": "uw-grc-guide:0312:dance:dance-102-3",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "DANCE 102 (3)",
    "sourceCourseTitle": "Dance Technique 1",
    "targetOutcome": "DANCE 1XX",
    "tags": [
      "AH"
    ]
  },
  {
    "id": "uw-grc-guide:0314:dance:dance-103-3",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "DANCE 103 (3)",
    "sourceCourseTitle": "Dance Technique 2",
    "targetOutcome": "DANCE 1XX",
    "tags": [
      "AH"
    ]
  },
  {
    "id": "uw-grc-guide:0318:dance:dance-110-2",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "DANCE 110 (2)",
    "sourceCourseTitle": null,
    "targetOutcome": "DANCE 1XX",
    "tags": [
      "AH"
    ]
  },
  {
    "id": "uw-grc-guide:0322:dance:dance-204-3",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "DANCE 204 (3)",
    "sourceCourseTitle": "Choreography Workshop",
    "targetOutcome": "DANCE 2XX",
    "tags": [
      "AH"
    ]
  },
  {
    "id": "uw-grc-guide:0327:drama:drma-102-5",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "DRMA 102 (5)",
    "sourceCourseTitle": "Contemporary American Theatre",
    "targetOutcome": "DRAMA 1XX",
    "tags": [
      "AH"
    ]
  },
  {
    "id": "uw-grc-guide:0328:drama:drma-111-5-formerly-drama-111",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "DRMA 111 (5) formerly DRAMA 111",
    "sourceCourseTitle": "Rehearsal and Performance 1",
    "targetOutcome": "DRAMA 1XX",
    "tags": [
      "AH"
    ]
  },
  {
    "id": "uw-grc-guide:0330:drama:drma-112-5-formerly-drama-112",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "DRMA 112 (5) formerly DRAMA 112",
    "sourceCourseTitle": "Rehearsal and Performance 2",
    "targetOutcome": "DRAMA 1XX",
    "tags": [
      "AH"
    ]
  },
  {
    "id": "uw-grc-guide:0332:drama:drma-113-5-formerly-drama-113",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "DRMA 113 (5) formerly DRAMA 113",
    "sourceCourseTitle": "Rehearsal and Performance 3",
    "targetOutcome": "DRAMA 1XX",
    "tags": [
      "AH"
    ]
  },
  {
    "id": "uw-grc-guide:0341:drama:drma-151-5",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "DRMA 151 (5)",
    "sourceCourseTitle": "Acting Fundamentals",
    "targetOutcome": "DRAMA 251 (5)",
    "tags": [
      "AH"
    ]
  },
  {
    "id": "uw-grc-guide:0344:drama:drma-152-5-formerly-drama-152",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "DRMA 152 (5) formerly DRAMA 152",
    "sourceCourseTitle": "Acting-Building a Character",
    "targetOutcome": "DRAMA 1XX",
    "tags": [
      "AH"
    ]
  },
  {
    "id": "uw-grc-guide:0346:drama:drma-153-5-formerly-drama-153",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "DRMA 153 (5) formerly DRAMA 153",
    "sourceCourseTitle": "Acting-Text Analysis",
    "targetOutcome": "DRAMA 1XX",
    "tags": [
      "AH"
    ]
  },
  {
    "id": "uw-grc-guide:0348:drama:drma-154-5",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "DRMA 154 (5)",
    "sourceCourseTitle": "Improvisation 1",
    "targetOutcome": "DRAMA 1XX",
    "tags": [
      "AH"
    ]
  },
  {
    "id": "uw-grc-guide:0349:drama:drma-155-5",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "DRMA 155 (5)",
    "sourceCourseTitle": "Improvisation 2",
    "targetOutcome": "DRAMA 1XX",
    "tags": [
      "AH"
    ]
  },
  {
    "id": "uw-grc-guide:0350:drama:drma-156-5",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "DRMA 156 (5)",
    "sourceCourseTitle": "Improvisation 3",
    "targetOutcome": "DRAMA 1XX",
    "tags": [
      "AH"
    ]
  },
  {
    "id": "uw-grc-guide:0353:drama:drma-211-5",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "DRMA 211 (5)",
    "sourceCourseTitle": "Rehearsal and Performance 4",
    "targetOutcome": "DRAMA 1XX",
    "tags": [
      "AH"
    ]
  },
  {
    "id": "uw-grc-guide:0354:drama:drma-212-5",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "DRMA 212 (5)",
    "sourceCourseTitle": "Rehearsal and Performance 5",
    "targetOutcome": "DRAMA 1XX",
    "tags": [
      "AH"
    ]
  },
  {
    "id": "uw-grc-guide:0355:drama:drma-213-5",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "DRMA 213 (5)",
    "sourceCourseTitle": "Rehearsal and Performance 6",
    "targetOutcome": "DRAMA 1XX",
    "tags": [
      "AH"
    ]
  },
  {
    "id": "uw-grc-guide:0324:drama:drmaand-101-5-formerly-drama-102",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "DRMA& 101 (5) formerly DRAMA 102",
    "sourceCourseTitle": "Introduction to Theatre",
    "targetOutcome": "DRAMA 1XX",
    "tags": [
      "AH"
    ]
  },
  {
    "id": "uw-grc-guide:0378:economics:econ-100-5",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "ECON 100 (5)",
    "sourceCourseTitle": "Economic Principles and Applications",
    "targetOutcome": "ECON 100 (5)",
    "tags": [
      "SSC"
    ]
  },
  {
    "id": "uw-grc-guide:0379:economics:econ-101-5",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "ECON 101 (5)",
    "sourceCourseTitle": null,
    "targetOutcome": "ECON 1XX",
    "tags": [
      "SSC"
    ]
  },
  {
    "id": "uw-grc-guide:0383:economics:econand-201-5-formerly-econ-201",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "ECON& 201 (5) formerly ECON 201",
    "sourceCourseTitle": "Micro Economics",
    "targetOutcome": "ECON 200 (5)",
    "tags": [
      "SSC"
    ]
  },
  {
    "id": "uw-grc-guide:0385:economics:econand-202-5-formerly-econ-200",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "ECON& 202 (5) formerly ECON 200",
    "sourceCourseTitle": "Macro Economics",
    "targetOutcome": "ECON 201 (5)",
    "tags": [
      "SSC"
    ]
  },
  {
    "id": "uw-grc-guide:0394:education:educand-115-5-formerly-edec-110",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "EDUC& 115 (5) formerly EDEC 110",
    "sourceCourseTitle": "Child Development",
    "targetOutcome": "PSYCH 1XX",
    "tags": [
      "SSC"
    ]
  },
  {
    "id": "uw-grc-guide:0459:english:engl-115-5-formerly-engl-135",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "ENGL 115 (5) formerly ENGL 135",
    "sourceCourseTitle": "Introduction to Novels",
    "targetOutcome": "ENGL 1XX",
    "tags": [
      "AH"
    ]
  },
  {
    "id": "uw-grc-guide:0478:english:engl-160-5",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "ENGL 160 (5)",
    "sourceCourseTitle": "Women's Literature",
    "targetOutcome": "ENGL 1XX or GWSS 1XX",
    "tags": [
      "AH"
    ]
  },
  {
    "id": "uw-grc-guide:0479:english:engl-161-5",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "ENGL 161 (5)",
    "sourceCourseTitle": "Cultures of Desire",
    "targetOutcome": "ENGL 1XX",
    "tags": [
      "AH"
    ]
  },
  {
    "id": "uw-grc-guide:0480:english:engl-163-5",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "ENGL 163 (5)",
    "sourceCourseTitle": "The Poetics of Rap and Hip Hop",
    "targetOutcome": "ENGL 1XX",
    "tags": [
      "AH"
    ]
  },
  {
    "id": "uw-grc-guide:0481:english:engl-164-5",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "ENGL 164 (5)",
    "sourceCourseTitle": "Film as Literature",
    "targetOutcome": "CLIT 271",
    "tags": [
      "AH"
    ]
  },
  {
    "id": "uw-grc-guide:0482:english:engl-165-5",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "ENGL 165 (5)",
    "sourceCourseTitle": "Introduction to the Myths of the World",
    "targetOutcome": "ENGL 1XX",
    "tags": [
      "AH"
    ]
  },
  {
    "id": "uw-grc-guide:0483:english:engl-168-5",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "ENGL 168 (5)",
    "sourceCourseTitle": "Introduction to Irish Literature",
    "targetOutcome": "ENGL 1XX",
    "tags": [
      "AH"
    ]
  },
  {
    "id": "uw-grc-guide:0487:english:engl-180-5",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "ENGL 180 (5)",
    "sourceCourseTitle": "Children's Literature",
    "targetOutcome": "ENGL 1XX",
    "tags": [
      "AH"
    ]
  },
  {
    "id": "uw-grc-guide:0489:english:engl-181-5",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "ENGL 181 (5)",
    "sourceCourseTitle": "Literary Approaches to Pop Culture",
    "targetOutcome": "ENGL 207 (5)",
    "tags": [
      "AH"
    ]
  },
  {
    "id": "uw-grc-guide:0490:english:engl-183-5",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "ENGL 183 (5)",
    "sourceCourseTitle": "Detective and Mystery Fiction",
    "targetOutcome": "ENGL 1XX",
    "tags": [
      "AH"
    ]
  },
  {
    "id": "uw-grc-guide:0491:english:engl-185-5",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "ENGL 185 (5)",
    "sourceCourseTitle": "The Bible as Literature",
    "targetOutcome": "ENGL 1XX",
    "tags": [
      "AH"
    ]
  },
  {
    "id": "uw-grc-guide:0492:english:engl-187-5",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "ENGL 187 (5)",
    "sourceCourseTitle": null,
    "targetOutcome": "ENGL 1XX",
    "tags": [
      "AH"
    ]
  },
  {
    "id": "uw-grc-guide:0493:english:engl-190-5",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "ENGL 190 (5)",
    "sourceCourseTitle": "Young Adult Literature",
    "targetOutcome": "ENGL 1XX",
    "tags": [
      "AH"
    ]
  },
  {
    "id": "uw-grc-guide:0521:english:engl-247-5-formerly-engl-224",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "ENGL 247 (5) formerly ENGL 224",
    "sourceCourseTitle": "American Ethnic Literature",
    "targetOutcome": "ENGL 2XX",
    "tags": [
      "AH"
    ]
  },
  {
    "id": "uw-grc-guide:0522:english:engl-248-5",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "ENGL 248 (5)",
    "sourceCourseTitle": "African-American Literature",
    "targetOutcome": "ENGL 258",
    "tags": [
      "AH"
    ]
  },
  {
    "id": "uw-grc-guide:0523:english:engl-249-5",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "ENGL 249 (5)",
    "sourceCourseTitle": "U.S. Latinx Literature",
    "targetOutcome": "ENGL 2XX",
    "tags": [
      "AH"
    ]
  },
  {
    "id": "uw-grc-guide:0527:english:engl-257-5-formerly-engl-268",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "ENGL 257 (5) formerly ENGL 268",
    "sourceCourseTitle": null,
    "targetOutcome": "ENGL 2XX",
    "tags": [
      "AH"
    ]
  },
  {
    "id": "uw-grc-guide:0454:english:england-112-5-formerly-engl-131",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "ENGL& 112 (5) formerly ENGL 131",
    "sourceCourseTitle": "Introduction to Fiction",
    "targetOutcome": "ENGL 242 (5)",
    "tags": [
      "AH"
    ]
  },
  {
    "id": "uw-grc-guide:0456:english:england-113-5-formerly-engl-133",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "ENGL& 113 (5) formerly ENGL 133",
    "sourceCourseTitle": "Introduction to Poetry",
    "targetOutcome": "ENGL 243 (5)",
    "tags": [
      "AH"
    ]
  },
  {
    "id": "uw-grc-guide:0458:english:england-114-5-formerly-engl-132",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "ENGL& 114 (5) formerly ENGL 132",
    "sourceCourseTitle": "Introduction to Drama",
    "targetOutcome": "ENGL 244 (5)",
    "tags": [
      "AH"
    ]
  },
  {
    "id": "uw-grc-guide:0503:english:england-220-5-formerly-engl-240",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "ENGL& 220 (5) formerly ENGL 240",
    "sourceCourseTitle": "Introduction to Shakespeare",
    "targetOutcome": "ENGL 225 (5)",
    "tags": [
      "AH"
    ]
  },
  {
    "id": "uw-grc-guide:0508:english:england-226-5-formerly-engl-244",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "ENGL& 226 (5) formerly ENGL 244",
    "sourceCourseTitle": "British Literature I: 7th to 16th Century",
    "targetOutcome": "ENGL 228 (5)",
    "tags": [
      "AH"
    ]
  },
  {
    "id": "uw-grc-guide:0509:english:england-227-5-formerly-engl-245",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "ENGL& 227 (5) formerly ENGL 245",
    "sourceCourseTitle": "British Literature II: 17th to 18th Century",
    "targetOutcome": "ENGL 229 (5)",
    "tags": [
      "AH"
    ]
  },
  {
    "id": "uw-grc-guide:0510:english:england-228-5-formerly-engl-246",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "ENGL& 228 (5) formerly ENGL 246",
    "sourceCourseTitle": "British Literature III: 19th to 21st Century",
    "targetOutcome": "ENGL 230 (5)",
    "tags": [
      "AH"
    ]
  },
  {
    "id": "uw-grc-guide:0511:english:england-236-5-formerly-engl-151",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "ENGL& 236 (5) formerly ENGL 151",
    "sourceCourseTitle": "Creative Writing I",
    "targetOutcome": "ENGL 2XX",
    "tags": [
      "AH"
    ]
  },
  {
    "id": "uw-grc-guide:0512:english:england-237-5-formerly-engl-152",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "ENGL& 237 (5) formerly ENGL 152",
    "sourceCourseTitle": "Creative Writing II",
    "targetOutcome": "ENGL 2XX",
    "tags": [
      "AH"
    ]
  },
  {
    "id": "uw-grc-guide:0515:english:england-244-245-5-5-formerly-engl-221-222",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "ENGL& 244, 245 (5, 5) formerly ENGL 221, 222",
    "sourceCourseTitle": "American Literature I: American Literature to 1860 / American Literature II: Civil War to WWI",
    "targetOutcome": "ENGL 250 (5) for either course, 2XX (5-10)",
    "tags": [
      "AH"
    ]
  },
  {
    "id": "uw-grc-guide:0519:english:england-246-5-formerly-engl-223",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "ENGL& 246 (5) formerly ENGL 223",
    "sourceCourseTitle": "American Literature III: WWI to Present",
    "targetOutcome": "ENGL 2XX",
    "tags": [
      "AH"
    ]
  },
  {
    "id": "uw-grc-guide:0524:english:england-254-5-formerly-engl-265",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "ENGL& 254 (5) formerly ENGL 265",
    "sourceCourseTitle": null,
    "targetOutcome": "ENGL 210 (5)",
    "tags": [
      "AH"
    ]
  },
  {
    "id": "uw-grc-guide:0525:english:england-255-5-formerly-engl-266",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "ENGL& 255 (5) formerly ENGL 266",
    "sourceCourseTitle": "World Literature II: 7th to 18th Century",
    "targetOutcome": "ENGL 211 (5)",
    "tags": [
      "AH"
    ]
  },
  {
    "id": "uw-grc-guide:0526:english:england-256-5-formerly-engl-267",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "ENGL& 256 (5) formerly ENGL 267",
    "sourceCourseTitle": "World Literature III: 19th to 21st Century",
    "targetOutcome": "ENGL 213 (5)",
    "tags": [
      "AH"
    ]
  },
  {
    "id": "uw-grc-guide:0421:engineering-formerly-general-engineering:engr-140-5-formerly-g-e-140",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "ENGR 140 (5) formerly G E 140",
    "sourceCourseTitle": "Engineering Materials",
    "targetOutcome": "MSE 170 (4), 1XX (1)",
    "tags": [
      "NSC"
    ]
  },
  {
    "id": "uw-grc-guide:0441:engineering-formerly-general-engineering:engr-250-5",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "ENGR 250 (5)",
    "sourceCourseTitle": "Numerical Methods Using MATLAB",
    "targetOutcome": "AMATH 301, 2XX (4,1)",
    "tags": [
      "NSC"
    ]
  },
  {
    "id": "uw-grc-guide:0412:engineering-formerly-general-engineering:engrand-104-5-formerly-g-e-104",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "ENGR& 104 (5) formerly G E 104",
    "sourceCourseTitle": "Introduction to Design",
    "targetOutcome": "ENGR 100 (5)",
    "tags": [
      "SSC"
    ]
  },
  {
    "id": "uw-grc-guide:0417:engineering-formerly-general-engineering:engrand-114-5-formerly-g-e-123",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "ENGR& 114 (5) formerly G E 123",
    "sourceCourseTitle": "Engineering Graphics",
    "targetOutcome": "M E 123 (4), 1XX (1)",
    "tags": [
      "AH",
      "NSC"
    ]
  },
  {
    "id": "uw-grc-guide:0432:engineering-formerly-general-engineering:engrand-204-5-formerly-g-e-235",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "ENGR& 204 (5) formerly G E 235",
    "sourceCourseTitle": "Electrical Circuits",
    "targetOutcome": "E E 215 (4), 2XX (1)",
    "tags": [
      "NSC"
    ]
  },
  {
    "id": "uw-grc-guide:0433:engineering-formerly-general-engineering:engrand-214-5-formerly-g-e-112",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "ENGR& 214 (5) formerly G E 112",
    "sourceCourseTitle": "Statics",
    "targetOutcome": "A A 210 (4), 2XX (1)",
    "tags": [
      "NSC"
    ]
  },
  {
    "id": "uw-grc-guide:0434:engineering-formerly-general-engineering:engrand-215-5-formerly-g-e-281",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "ENGR& 215 (5) formerly G E 281",
    "sourceCourseTitle": "Dynamics",
    "targetOutcome": "M E 230 (4), 2XX (1)",
    "tags": [
      "NSC"
    ]
  },
  {
    "id": "uw-grc-guide:0436:engineering-formerly-general-engineering:engrand-224-4-formerly-g-e-280",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "ENGR& 224 (4) formerly G E 280",
    "sourceCourseTitle": "Thermodynamics",
    "targetOutcome": "A A 260 (4)",
    "tags": [
      "NSC"
    ]
  },
  {
    "id": "uw-grc-guide:0437:engineering-formerly-general-engineering:engrand-225-5-formerly-g-e-240",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "ENGR& 225 (5) formerly G E 240",
    "sourceCourseTitle": "Mechanics of Materials",
    "targetOutcome": "CEE 220 (4), 2XX (1)",
    "tags": [
      "NSC"
    ]
  },
  {
    "id": "uw-grc-guide:0537:environmental-science:env-s-204-5",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "ENV S 204 (5)",
    "sourceCourseTitle": "Natural Science and the Environment",
    "targetOutcome": "ENVIR 2XX",
    "tags": [
      "NSC"
    ]
  },
  {
    "id": "uw-grc-guide:0540:film:film-120-5-formerly-drma-120",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "FILM 120 (5) formerly DRMA 120",
    "sourceCourseTitle": "The Art of the Film",
    "targetOutcome": "CMS 270 (5)",
    "tags": [
      "AH"
    ]
  },
  {
    "id": "uw-grc-guide:0576:french:frchand-221-formerly-fren-201",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "FRCH& 221 formerly FREN 201",
    "sourceCourseTitle": "French IV",
    "targetOutcome": "FRENCH 201 (5)",
    "tags": [
      "AH"
    ]
  },
  {
    "id": "uw-grc-guide:0590:geography:geog-120-5",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "GEOG 120 (5)",
    "sourceCourseTitle": "Introduction to Physical Geography",
    "targetOutcome": "GEOG 1XX",
    "tags": [
      "NSC"
    ]
  },
  {
    "id": "uw-grc-guide:0591:geography:geog-123-5",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "GEOG 123 (5)",
    "sourceCourseTitle": "Globalization",
    "targetOutcome": "GEOG 123 (5)",
    "tags": [
      "SSC"
    ]
  },
  {
    "id": "uw-grc-guide:0597:geography:geog-201-5-formerly-geog-200",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "GEOG 201 (5) formerly GEOG 200",
    "sourceCourseTitle": "World Regional Geography",
    "targetOutcome": "GEOG 102 (5)",
    "tags": [
      "SSC"
    ]
  },
  {
    "id": "uw-grc-guide:0598:geography:geog-205-5",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "GEOG 205 (5)",
    "sourceCourseTitle": "Environmental Geography",
    "targetOutcome": "GEOG 2XX (5)",
    "tags": [
      "SSC"
    ]
  },
  {
    "id": "uw-grc-guide:0585:geography:geogand-100-5",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "GEOG& 100 (5)",
    "sourceCourseTitle": "Introduction to Geography",
    "targetOutcome": "GEOG 100 (5)",
    "tags": [
      "SSC"
    ]
  },
  {
    "id": "uw-grc-guide:0595:geography:geogand-200-5-formerly-geog-108",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "GEOG& 200 (5) formerly GEOG 108",
    "sourceCourseTitle": "Human Geography",
    "targetOutcome": "GEOG 200 (5)",
    "tags": [
      "SSC"
    ]
  },
  {
    "id": "uw-grc-guide:0616:geology:geol-200-5",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "GEOL 200 (5)",
    "sourceCourseTitle": "Geological Investigations of the National Parks",
    "targetOutcome": "ESS 305 (5)",
    "tags": [
      "NSC"
    ]
  },
  {
    "id": "uw-grc-guide:0618:geology:geol-206-5",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "GEOL 206 (5)",
    "sourceCourseTitle": "Earth History",
    "targetOutcome": "ESS 203 (5)",
    "tags": [
      "NSC"
    ]
  },
  {
    "id": "uw-grc-guide:0603:geology:geoland-101-5-formerly-geol-101",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "GEOL& 101 (5) formerly GEOL 101",
    "sourceCourseTitle": "Introduction to Physical Geology",
    "targetOutcome": "ESS 212 (5)",
    "tags": [
      "NSC"
    ]
  },
  {
    "id": "uw-grc-guide:0619:geology:geoland-208-5-formerly-geol-208",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "GEOL& 208 (5) formerly GEOL 208",
    "sourceCourseTitle": "Geology of the Pacific Northwest",
    "targetOutcome": "ESS 301 (5)",
    "tags": [
      "NSC"
    ]
  },
  {
    "id": "uw-grc-guide:0582:geographic-information-systems:gis-202-5",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "GIS 202 (5)",
    "sourceCourseTitle": null,
    "targetOutcome": "ESRM 250 (5)",
    "tags": [
      "NSC",
      "QSR"
    ]
  },
  {
    "id": "uw-grc-guide:0584:geographic-information-systems:gis-260-5",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "GIS 260 (5)",
    "sourceCourseTitle": null,
    "targetOutcome": "GEOG 2XX",
    "tags": [
      "SSC"
    ]
  },
  {
    "id": "uw-grc-guide:0639:history:hist-101-5",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "HIST 101 (5)",
    "sourceCourseTitle": null,
    "targetOutcome": "HSTAM 111 (5)",
    "tags": [
      "SSC"
    ]
  },
  {
    "id": "uw-grc-guide:0641:history:hist-102-5",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "HIST 102 (5)",
    "sourceCourseTitle": null,
    "targetOutcome": "HSTAM 112 (5)",
    "tags": [
      "SSC"
    ]
  },
  {
    "id": "uw-grc-guide:0643:history:hist-103-5",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "HIST 103 (5)",
    "sourceCourseTitle": null,
    "targetOutcome": "HSTEU 113 (5)",
    "tags": [
      "SSC"
    ]
  },
  {
    "id": "uw-grc-guide:0645:history:hist-120-5",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "HIST 120 (5)",
    "sourceCourseTitle": "History of the Movies",
    "targetOutcome": "CMS 1XX",
    "tags": [
      "AH",
      "SSC"
    ]
  },
  {
    "id": "uw-grc-guide:0646:history:hist-122-5",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "HIST 122 (5)",
    "sourceCourseTitle": "History of Australian Movies",
    "targetOutcome": "CMS 1XX",
    "tags": [
      "AH",
      "SSC"
    ]
  },
  {
    "id": "uw-grc-guide:0648:history:hist-135-5",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "HIST 135 (5)",
    "sourceCourseTitle": "The United States Since 1940",
    "targetOutcome": "HSTAA 235 (5)",
    "tags": [
      "SSC"
    ]
  },
  {
    "id": "uw-grc-guide:0663:history:hist-220-5",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "HIST 220 (5)",
    "sourceCourseTitle": null,
    "targetOutcome": "HSTAA 2XX",
    "tags": [
      "SSC"
    ]
  },
  {
    "id": "uw-grc-guide:0666:history:hist-224-5",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "HIST 224 (5)",
    "sourceCourseTitle": null,
    "targetOutcome": "HSTAA 150 (5)",
    "tags": [
      "SSC"
    ]
  },
  {
    "id": "uw-grc-guide:0668:history:hist-226-5",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "HIST 226 (5)",
    "sourceCourseTitle": null,
    "targetOutcome": "HSTAA 205 (5)",
    "tags": [
      "SSC"
    ]
  },
  {
    "id": "uw-grc-guide:0669:history:hist-228-5",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "HIST 228 (5)",
    "sourceCourseTitle": "Latinos in the United States",
    "targetOutcome": "AES 2XX",
    "tags": [
      "SSC"
    ]
  },
  {
    "id": "uw-grc-guide:0670:history:hist-230-5",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "HIST 230 (5)",
    "sourceCourseTitle": "Modern Europe",
    "targetOutcome": "HSTEU 2XX",
    "tags": [
      "SSC"
    ]
  },
  {
    "id": "uw-grc-guide:0671:history:hist-231-5",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "HIST 231 (5)",
    "sourceCourseTitle": "Modern Asia",
    "targetOutcome": "JSIS A 2XX",
    "tags": [
      "SSC"
    ]
  },
  {
    "id": "uw-grc-guide:0672:history:hist-232-5",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "HIST 232 (5)",
    "sourceCourseTitle": "Renaissance and Reformation",
    "targetOutcome": "HSTEU 2XX",
    "tags": [
      "SSC"
    ]
  },
  {
    "id": "uw-grc-guide:0673:history:hist-233-5",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "HIST 233 (5)",
    "sourceCourseTitle": "History of Latin America",
    "targetOutcome": "HSTLAC 185 (5)",
    "tags": [
      "SSC"
    ]
  },
  {
    "id": "uw-grc-guide:0675:history:hist-235-5",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "HIST 235 (5)",
    "sourceCourseTitle": null,
    "targetOutcome": "HSTEU 275 (5)",
    "tags": [
      "SSC"
    ]
  },
  {
    "id": "uw-grc-guide:0677:history:hist-237-5",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "HIST 237 (5)",
    "sourceCourseTitle": "History of Australia and New Zealand",
    "targetOutcome": "HSTCMP 2XX",
    "tags": [
      "SSC"
    ]
  },
  {
    "id": "uw-grc-guide:0678:history:hist-240-5",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "HIST 240 (5)",
    "sourceCourseTitle": "The Civil War",
    "targetOutcome": "HSTAA 2XX",
    "tags": [
      "SSC"
    ]
  },
  {
    "id": "uw-grc-guide:0679:history:hist-245-5",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "HIST 245 (5)",
    "sourceCourseTitle": "The Second World War",
    "targetOutcome": "HSTCMP 2XX",
    "tags": [
      "SSC"
    ]
  },
  {
    "id": "uw-grc-guide:0680:history:hist-250-5",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "HIST 250 (5)",
    "sourceCourseTitle": "The Vietnam War",
    "targetOutcome": "HSTAS 265 (5)",
    "tags": [
      "SSC"
    ]
  },
  {
    "id": "uw-grc-guide:0649:history:histand-136-137-5-5-formerly-hist-221-222",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "HIST& 136, 137 (5, 5) formerly HIST 221, 222",
    "sourceCourseTitle": "U.S. History I / U.S. History II",
    "targetOutcome": "HSTAA 101 (5), 1XX (5) if both courses taken; otherwise, HSTAA 1XX",
    "tags": [
      "SSC"
    ]
  },
  {
    "id": "uw-grc-guide:0660:history:histand-214-5-formerly-hist-200",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "HIST& 214 (5) formerly HIST 200",
    "sourceCourseTitle": "Pacific Northwest History",
    "targetOutcome": "HSTAA 2XX",
    "tags": [
      "SSC"
    ]
  },
  {
    "id": "uw-grc-guide:0661:history:histand-215-5-formerly-hist-225",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "HIST& 215 (5) formerly HIST 225",
    "sourceCourseTitle": "Women in U.S. History",
    "targetOutcome": "HSTAA 2XX or GWSS 2XX",
    "tags": [
      "SSC"
    ]
  },
  {
    "id": "uw-grc-guide:0685:humanities:human-100-5",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "HUMAN 100 (5)",
    "sourceCourseTitle": null,
    "targetOutcome": "UW 1XX",
    "tags": [
      "AH",
      "SSC"
    ]
  },
  {
    "id": "uw-grc-guide:0686:humanities:human-110-5",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "HUMAN 110 (5)",
    "sourceCourseTitle": "Background for the Humanities",
    "targetOutcome": "UW 1XX",
    "tags": [
      "AH"
    ]
  },
  {
    "id": "uw-grc-guide:0688:humanities:human-133-5",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "HUMAN 133 (5)",
    "sourceCourseTitle": "People, Language and Culture",
    "targetOutcome": "UW 1XX",
    "tags": [
      "AH",
      "SSC"
    ]
  },
  {
    "id": "uw-grc-guide:0693:humanities:human-190-5",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "HUMAN 190 (5)",
    "sourceCourseTitle": "Latin American Culture Through Literature",
    "targetOutcome": "JSIS A 1XX",
    "tags": [
      "AH",
      "SSC"
    ]
  },
  {
    "id": "uw-grc-guide:0694:humanities:human-191-5",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "HUMAN 191 (5)",
    "sourceCourseTitle": "Latin America in Film",
    "targetOutcome": "CMS 1XX",
    "tags": [
      "AH",
      "SSC"
    ]
  },
  {
    "id": "uw-grc-guide:0696:humanities:human-224-5",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "HUMAN 224 (5)",
    "sourceCourseTitle": "Women and World Religions",
    "targetOutcome": "GWSS 2XX",
    "tags": [
      "SSC"
    ]
  },
  {
    "id": "uw-grc-guide:0698:interdisciplinary-science:ids-101-5",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "IDS 101 (5)",
    "sourceCourseTitle": null,
    "targetOutcome": "UW 1XX",
    "tags": [
      "NSC"
    ]
  },
  {
    "id": "uw-grc-guide:0699:interdisciplinary-science:ids-102-5",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "IDS 102 (5)",
    "sourceCourseTitle": null,
    "targetOutcome": "UW 1XX",
    "tags": [
      "NSC"
    ]
  },
  {
    "id": "uw-grc-guide:0700:interdisciplinary-science:ids-103-5",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "IDS 103 (5)",
    "sourceCourseTitle": null,
    "targetOutcome": "UW 1XX",
    "tags": [
      "NSC"
    ]
  },
  {
    "id": "uw-grc-guide:0773:mathematics:math-106-5",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "MATH 106 (5)",
    "sourceCourseTitle": "Essentials of Pre-Calculus Mathematics",
    "targetOutcome": "UW 1XX",
    "tags": [
      "NSC"
    ]
  },
  {
    "id": "uw-grc-guide:0789:mathematics:math-147-5-formerly-math-156",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "MATH 147 (5) formerly MATH 156",
    "sourceCourseTitle": "Finite Mathematics-Business and Social Science",
    "targetOutcome": "MATH 111 (5)",
    "tags": [
      "NSC"
    ]
  },
  {
    "id": "uw-grc-guide:0807:mathematics:math-194-1-5",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "MATH 194 (1-5)",
    "sourceCourseTitle": "Special Topics-Mathematics",
    "targetOutcome": "MATH 1XX",
    "tags": [
      "NSC"
    ]
  },
  {
    "id": "uw-grc-guide:0813:mathematics:math-238-5",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "MATH 238 (5)",
    "sourceCourseTitle": "Differential Equations",
    "targetOutcome": "MATH 207 (4), 2XX (1)",
    "tags": [
      "NSC"
    ]
  },
  {
    "id": "uw-grc-guide:0815:mathematics:math-240-5",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "MATH 240 (5)",
    "sourceCourseTitle": "Topics in Linear Algebra",
    "targetOutcome": "MATH 208 (4), 2XX (1)",
    "tags": [
      "NSC"
    ]
  },
  {
    "id": "uw-grc-guide:0819:mathematics:math-256-5",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "MATH 256 (5)",
    "sourceCourseTitle": "Statistics for Business and Social Science",
    "targetOutcome": "QMETH 201 (4), B A 2XX (1)",
    "tags": [
      "NSC"
    ]
  },
  {
    "id": "uw-grc-guide:0774:mathematics:mathand-107-5-formerly-math-107",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "MATH& 107 (5) formerly MATH 107",
    "sourceCourseTitle": "Math in Society",
    "targetOutcome": "MATH 1XX",
    "tags": [
      "NSC"
    ]
  },
  {
    "id": "uw-grc-guide:0786:mathematics:mathand-141-5-formerly-math-102",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "MATH& 141 (5) formerly MATH 102",
    "sourceCourseTitle": "PreCalculus I",
    "targetOutcome": "MATH 1XX",
    "tags": [
      "NSC"
    ]
  },
  {
    "id": "uw-grc-guide:0787:mathematics:mathand-142-5-formerly-math-104",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "MATH& 142 (5) formerly MATH 104",
    "sourceCourseTitle": "PreCalculus II",
    "targetOutcome": "MATH 120 (5)",
    "tags": [
      "NSC"
    ]
  },
  {
    "id": "uw-grc-guide:0788:mathematics:mathand-146-5",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "MATH& 146 (5)",
    "sourceCourseTitle": "Introduction to Statistics",
    "targetOutcome": "STAT 220 (5)",
    "tags": [
      "NSC"
    ]
  },
  {
    "id": "uw-grc-guide:0790:mathematics:mathand-148-5-formerly-math-157",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "MATH& 148 (5) formerly MATH 157",
    "sourceCourseTitle": "Business Calculus",
    "targetOutcome": "MATH 112 (5)",
    "tags": [
      "NSC"
    ]
  },
  {
    "id": "uw-grc-guide:0792:mathematics:mathand-151-5-formerly-math-124",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "MATH& 151 (5) formerly MATH 124",
    "sourceCourseTitle": "Calculus I",
    "targetOutcome": "MATH 124 (5)",
    "tags": [
      "NSC"
    ]
  },
  {
    "id": "stem-calculus-older-sequence",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "MATH& 151 + MATH& 152 + MATH& 153 + MATH& 264",
    "sourceCourseTitle": "Calculus I / Calculus II / Calculus III / Calculus IV",
    "targetOutcome": "UW MATH 124, 125, 126, plus stronger 224 / 2XX treatment when the full older path is completed.",
    "tags": [
      "NSC"
    ]
  },
  {
    "id": "stem-calculus-current-sequence",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "MATH& 151 + MATH& 152 + MATH& 163",
    "sourceCourseTitle": "Calculus I / Calculus II / Calculus III",
    "targetOutcome": "UW MATH 124, 125, and 126 transfer path.",
    "tags": [
      "NSC"
    ]
  },
  {
    "id": "uw-grc-guide:0793:mathematics:mathand-152-5-formerly-math-125",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "MATH& 152 (5) formerly MATH 125",
    "sourceCourseTitle": "Calculus II",
    "targetOutcome": "MATH 125 (5)",
    "tags": [
      "NSC"
    ]
  },
  {
    "id": "uw-grc-guide:0798:mathematics:mathand-163-5",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "MATH& 163 (5)",
    "sourceCourseTitle": "Calculus III",
    "targetOutcome": "MATH 126 (5)",
    "tags": [
      "NSC"
    ]
  },
  {
    "id": "uw-grc-guide:0800:mathematics:mathand-171-5-formerly-math-170",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "MATH& 171 (5) formerly MATH 170",
    "sourceCourseTitle": "Mathematics for Elementary Education I",
    "targetOutcome": "EDUC 170 (5)",
    "tags": [
      "NSC"
    ]
  },
  {
    "id": "uw-grc-guide:0802:mathematics:mathand-172-5-formerly-math-171",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "MATH& 172 (5) formerly MATH 171",
    "sourceCourseTitle": "Mathematics for Elementary Education II",
    "targetOutcome": "EDUC 171 (5)",
    "tags": [
      "NSC"
    ]
  },
  {
    "id": "uw-grc-guide:0804:mathematics:mathand-173-5-formerly-math-172",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "MATH& 173 (5) formerly MATH 172",
    "sourceCourseTitle": "Mathematics for Elementary Education III",
    "targetOutcome": "EDUC 1XX",
    "tags": [
      "NSC"
    ]
  },
  {
    "id": "uw-grc-guide:0817:mathematics:mathand-264-5-see-also-mathand-153-combined-entry",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "MATH& 264 (5) see also MATH& 153 combined entry",
    "sourceCourseTitle": "Calculus IV",
    "targetOutcome": "MATH 224 (4), 2XX (1)",
    "tags": [
      "NSC"
    ]
  },
  {
    "id": "uw-grc-guide:0825:music:musc-101-5-formerly-music-101",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "MUSC 101 (5) formerly MUSIC 101",
    "sourceCourseTitle": "Fundamentals of Music",
    "targetOutcome": "MUSIC 1XX",
    "tags": [
      "AH"
    ]
  },
  {
    "id": "uw-grc-guide:0829:music:musc-103-5-formerly-music-103",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "MUSC 103 (5) formerly MUSIC 103",
    "sourceCourseTitle": "American Popular Music",
    "targetOutcome": "MUSIC 1XX",
    "tags": [
      "AH"
    ]
  },
  {
    "id": "uw-grc-guide:0831:music:musc-104-5-formerly-music-104",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "MUSC 104 (5) formerly MUSIC 104",
    "sourceCourseTitle": "Music in World Culture",
    "targetOutcome": "MUSIC 1XX",
    "tags": [
      "AH"
    ]
  },
  {
    "id": "uw-grc-guide:0836:music:musc-107-5-formerly-music-107",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "MUSC 107 (5) formerly MUSIC 107",
    "sourceCourseTitle": "History of Jazz",
    "targetOutcome": "UW 1XX",
    "tags": [
      "AH"
    ]
  },
  {
    "id": "uw-grc-guide:0838:music:musc-108-5-formerly-music-105",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "MUSC 108 (5) formerly MUSIC 105",
    "sourceCourseTitle": "Computer Music 1",
    "targetOutcome": "UW 1XX",
    "tags": [
      "AH"
    ]
  },
  {
    "id": "uw-grc-guide:0839:music:musc-109-5-formerly-music-106",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "MUSC 109 (5) formerly MUSIC 106",
    "sourceCourseTitle": "Computer Music 2",
    "targetOutcome": "UW 1XX",
    "tags": [
      "AH"
    ]
  },
  {
    "id": "uw-grc-guide:0840:music:musc-110-5",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "MUSC 110 (5)",
    "sourceCourseTitle": "Computer Music 3",
    "targetOutcome": "MUSIC 1XX",
    "tags": [
      "AH"
    ]
  },
  {
    "id": "uw-grc-guide:0847:music:musc-118-1-3-formerly-music-118",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "MUSC 118 (1-3) formerly MUSIC 118",
    "sourceCourseTitle": "Concert Choir 1",
    "targetOutcome": "MUSIC 1XX",
    "tags": [
      "AH"
    ]
  },
  {
    "id": "uw-grc-guide:0849:music:musc-119-1-3-formerly-music-119",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "MUSC 119 (1-3) formerly MUSIC 119",
    "sourceCourseTitle": "Concert Choir 2",
    "targetOutcome": "MUSIC 1XX",
    "tags": [
      "AH"
    ]
  },
  {
    "id": "uw-grc-guide:0851:music:musc-120-1-3-formerly-music-120",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "MUSC 120 (1-3) formerly MUSIC 120",
    "sourceCourseTitle": "Concert Choir 3",
    "targetOutcome": "MUSIC 1XX",
    "tags": [
      "AH"
    ]
  },
  {
    "id": "uw-grc-guide:0858:music:musc-124-5-formerly-music-124",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "MUSC 124 (5) formerly MUSIC 124",
    "sourceCourseTitle": "Musical Rehearsal and Performance",
    "targetOutcome": "MUSIC 1XX",
    "tags": [
      "AH"
    ]
  },
  {
    "id": "uw-grc-guide:0860:music:musc-125-5",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "MUSC 125 (5)",
    "sourceCourseTitle": "Vocal Couching for Singers",
    "targetOutcome": "MUSIC 1XX",
    "tags": [
      "AH"
    ]
  },
  {
    "id": "uw-grc-guide:0861:music:musc-127-1-5-formerly-music-127",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "MUSC 127 (1-5) formerly MUSIC 127",
    "sourceCourseTitle": "Green River Jazz Voices 1",
    "targetOutcome": "MUSIC 1XX",
    "tags": [
      "AH"
    ]
  },
  {
    "id": "uw-grc-guide:0863:music:musc-128-1-5-formerly-music-128",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "MUSC 128 (1-5) formerly MUSIC 128",
    "sourceCourseTitle": "Green River Jazz Voices 2",
    "targetOutcome": "MUSIC 1XX",
    "tags": [
      "AH"
    ]
  },
  {
    "id": "uw-grc-guide:0865:music:musc-129-1-5-formerly-music-129",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "MUSC 129 (1-5) formerly MUSIC 129",
    "sourceCourseTitle": "Green River Jazz Voices 3",
    "targetOutcome": "MUSIC 1XX",
    "tags": [
      "AH"
    ]
  },
  {
    "id": "uw-grc-guide:0868:music:musc-130-1-1-formerly-music-130-1",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "MUSC 130.1 (1) formerly MUSIC 130.1",
    "sourceCourseTitle": null,
    "targetOutcome": "MUSIC 1XX",
    "tags": [
      "AH"
    ]
  },
  {
    "id": "uw-grc-guide:0870:music:musc-130-2-1-formerly-music-130-2",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "MUSC 130.2 (1) formerly MUSIC 130.2",
    "sourceCourseTitle": null,
    "targetOutcome": "MUSIC 1XX",
    "tags": [
      "AH"
    ]
  },
  {
    "id": "uw-grc-guide:0872:music:musc-130-3-1-formerly-music-130-3",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "MUSC 130.3 (1) formerly MUSIC 130.3",
    "sourceCourseTitle": null,
    "targetOutcome": "MUSIC 1XX",
    "tags": [
      "AH"
    ]
  },
  {
    "id": "uw-grc-guide:0883:music:musc-140-2-formerly-music-132",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "MUSC 140 (2) formerly MUSIC 132",
    "sourceCourseTitle": "Class Piano 1",
    "targetOutcome": "MUSIC 1XX",
    "tags": [
      "AH"
    ]
  },
  {
    "id": "uw-grc-guide:0885:music:musc-141-2-formerly-music-133",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "MUSC 141 (2) formerly MUSIC 133",
    "sourceCourseTitle": "Class Piano 2",
    "targetOutcome": "MUSIC 1XX",
    "tags": [
      "AH"
    ]
  },
  {
    "id": "uw-grc-guide:0887:music:musc-142-2-formerly-music-134",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "MUSC 142 (2) formerly MUSIC 134",
    "sourceCourseTitle": "Class Piano 3",
    "targetOutcome": "MUSIC 1XX",
    "tags": [
      "AH"
    ]
  },
  {
    "id": "uw-grc-guide:0898:music:musc-218-1-3-formerly-music-218",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "MUSC 218 (1-3) formerly MUSIC 218",
    "sourceCourseTitle": "Concert Choir 4",
    "targetOutcome": "MUSIC 2XX",
    "tags": [
      "AH"
    ]
  },
  {
    "id": "uw-grc-guide:0900:music:musc-219-1-3-formerly-music-219",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "MUSC 219 (1-3) formerly MUSIC 219",
    "sourceCourseTitle": "Concert Choir 5",
    "targetOutcome": "MUSIC 2XX",
    "tags": [
      "AH"
    ]
  },
  {
    "id": "uw-grc-guide:0902:music:musc-220-1-3-music-220",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "MUSC 220 (1-3) MUSIC 220",
    "sourceCourseTitle": "Concert Choir 6",
    "targetOutcome": "MUSIC 2XX",
    "tags": [
      "AH"
    ]
  },
  {
    "id": "uw-grc-guide:0908:music:musc-227-1-5-formerly-music-227",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "MUSC 227 (1-5) formerly MUSIC 227",
    "sourceCourseTitle": "Green River Jazz Voices 4",
    "targetOutcome": "MUSIC 2XX",
    "tags": [
      "AH"
    ]
  },
  {
    "id": "uw-grc-guide:0915:music:musc-230-1-1-formerly-music-230-1",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "MUSC 230.1 (1) formerly MUSIC 230.1",
    "sourceCourseTitle": null,
    "targetOutcome": "MUSIC 2XX",
    "tags": [
      "AH"
    ]
  },
  {
    "id": "uw-grc-guide:0917:music:musc-230-2-1-formerly-music-230-2",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "MUSC 230.2 (1) formerly MUSIC 230.2",
    "sourceCourseTitle": null,
    "targetOutcome": "MUSIC 2XX",
    "tags": [
      "AH"
    ]
  },
  {
    "id": "uw-grc-guide:0919:music:musc-230-3-1-formerly-music-230-3",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "MUSC 230.3 (1) formerly MUSIC 230.3",
    "sourceCourseTitle": null,
    "targetOutcome": "MUSIC 2XX",
    "tags": [
      "AH"
    ]
  },
  {
    "id": "uw-grc-guide:0833:music:muscand-105-5-formerly-music-100",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "MUSC& 105 (5) formerly MUSIC 100",
    "sourceCourseTitle": "Music Appreciation",
    "targetOutcome": "MUSIC 1XX",
    "tags": [
      "AH"
    ]
  },
  {
    "id": "uw-grc-guide:0853:music:muscand-121-2-formerly-music-114",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "MUSC& 121 (2) formerly MUSIC 114",
    "sourceCourseTitle": "Ear Training 1",
    "targetOutcome": "MUSIC 1XX",
    "tags": [
      "AH"
    ]
  },
  {
    "id": "uw-grc-guide:0854:music:muscand-122-2-formerly-music-115",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "MUSC& 122 (2) formerly MUSIC 115",
    "sourceCourseTitle": "Ear Training 2",
    "targetOutcome": "MUSIC 1XX",
    "tags": [
      "AH"
    ]
  },
  {
    "id": "uw-grc-guide:0856:music:muscand-123-2-formerly-music-116",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "MUSC& 123 (2) formerly MUSIC 116",
    "sourceCourseTitle": "Ear Training 3",
    "targetOutcome": "MUSIC 1XX",
    "tags": [
      "AH"
    ]
  },
  {
    "id": "uw-grc-guide:0874:music:muscand-131-3-formerly-music-111",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "MUSC& 131 (3) formerly MUSIC 111",
    "sourceCourseTitle": "Music Theory 1",
    "targetOutcome": "MUSIC 1XX",
    "tags": [
      "AH"
    ]
  },
  {
    "id": "uw-grc-guide:0875:music:muscand-132-3-formerly-music-112",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "MUSC& 132 (3) formerly MUSIC 112",
    "sourceCourseTitle": "Music Theory 2",
    "targetOutcome": "MUSIC 1XX",
    "tags": [
      "AH"
    ]
  },
  {
    "id": "uw-grc-guide:0877:music:muscand-133-3-formerly-music-113",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "MUSC& 133 (3) formerly MUSIC 113",
    "sourceCourseTitle": "Music Theory 3",
    "targetOutcome": "MUSIC 1XX",
    "tags": [
      "AH"
    ]
  },
  {
    "id": "uw-grc-guide:0904:music:muscand-221-2-formerly-music-254",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "MUSC& 221 (2) formerly MUSIC 254",
    "sourceCourseTitle": null,
    "targetOutcome": "MUSIC 2XX",
    "tags": [
      "AH"
    ]
  },
  {
    "id": "uw-grc-guide:0905:music:muscand-222-2-formerly-music-255",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "MUSC& 222 (2) formerly MUSIC 255",
    "sourceCourseTitle": null,
    "targetOutcome": "MUSIC 2XX",
    "tags": [
      "AH"
    ]
  },
  {
    "id": "uw-grc-guide:0921:music:muscand-231-3-formerly-music-251",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "MUSC& 231 (3) formerly MUSIC 251",
    "sourceCourseTitle": null,
    "targetOutcome": "MUSIC 2XX",
    "tags": [
      "AH"
    ]
  },
  {
    "id": "uw-grc-guide:0922:music:muscand-232-3-formerly-music-252",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "MUSC& 232 (3) formerly MUSIC 252",
    "sourceCourseTitle": null,
    "targetOutcome": "MUSIC 2XX",
    "tags": [
      "AH"
    ]
  },
  {
    "id": "uw-grc-guide:0910:music:music-228-1-5-formerly-music-228",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "MUSIC 228 (1-5) formerly MUSIC 228",
    "sourceCourseTitle": null,
    "targetOutcome": "MUSIC 2XX",
    "tags": [
      "AH"
    ]
  },
  {
    "id": "uw-grc-guide:0912:music:music-229-1-5-formerly-music-229",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "MUSIC 229 (1-5) formerly MUSIC 229",
    "sourceCourseTitle": null,
    "targetOutcome": "MUSIC 2XX",
    "tags": [
      "AH"
    ]
  },
  {
    "id": "uw-grc-guide:0937:natural-resources:natrs-100-5-formerly-fores-100",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "NATRS 100 (5) formerly FORES 100",
    "sourceCourseTitle": "Introduction to Natural Resources",
    "targetOutcome": "ESRM 101",
    "tags": [
      "SSC",
      "NSC"
    ]
  },
  {
    "id": "uw-grc-guide:0938:natural-resources:natrs-117-2-formerly-fores-117",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "NATRS 117 (2) formerly FORES 117",
    "sourceCourseTitle": null,
    "targetOutcome": "ESRM 1XX",
    "tags": [
      "NSC"
    ]
  },
  {
    "id": "uw-grc-guide:0939:natural-resources:natrs-161-5-formerly-fores-161",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "NATRS 161 (5) formerly FORES 161",
    "sourceCourseTitle": "Wildlife Habitat Management",
    "targetOutcome": "ESRM 150 (5)",
    "tags": [
      "NSC"
    ]
  },
  {
    "id": "uw-grc-guide:0940:natural-resources:natrs-162-3",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "NATRS 162 (3)",
    "sourceCourseTitle": null,
    "targetOutcome": "ESRM 1XX",
    "tags": [
      "NSC"
    ]
  },
  {
    "id": "uw-grc-guide:0943:natural-resources:natrs-180-5-7-formerly-fores-180-see-also-natrs-180-combined-entry",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "NATRS 180 (5-7) formerly FORES 180, see also NATRS 180 combined entry",
    "sourceCourseTitle": "Natural Resources Measurement",
    "targetOutcome": "ESRM 1XX (5)",
    "tags": [
      "NSC"
    ]
  },
  {
    "id": "uw-grc-guide:0942:natural-resources:natrs-180-natrs-292-5-5",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "NATRS 180, NATRS 292 (5, 5)",
    "sourceCourseTitle": "Natural Resources Measurement / Resource Sampling and Appraisal of Forest Condit",
    "targetOutcome": "ESRM 368 (4), ESRM 2XX (9), for ESRM majors only, otherwise see individual entries",
    "tags": [
      "NSC"
    ]
  },
  {
    "id": "uw-grc-guide:0944:natural-resources:natrs-181-8-formerly-fores-181",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "NATRS 181 (8) formerly FORES 181",
    "sourceCourseTitle": null,
    "targetOutcome": "ESRM 1XX",
    "tags": [
      "NSC"
    ]
  },
  {
    "id": "uw-grc-guide:0945:natural-resources:natrs-182-5-formerly-fores-182",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "NATRS 182 (5) formerly FORES 182",
    "sourceCourseTitle": "Aerial Photos, GIS and Forest Navigation",
    "targetOutcome": "ESRM 430 (5), for ESRM majors only; otherwise ESRM 1XX (5)",
    "tags": [
      "NSC"
    ]
  },
  {
    "id": "uw-grc-guide:0946:natural-resources:natrs-183-5-formerly-fores-183",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "NATRS 183 (5) formerly FORES 183",
    "sourceCourseTitle": "Tree and Shrub Identification",
    "targetOutcome": "ESRM 1XX",
    "tags": [
      "NSC"
    ]
  },
  {
    "id": "uw-grc-guide:0947:natural-resources:natrs-184-5-formerly-fores-184",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "NATRS 184 (5) formerly FORES 184",
    "sourceCourseTitle": "Wildflower Identification",
    "targetOutcome": "ESRM 1XX",
    "tags": [
      "NSC"
    ]
  },
  {
    "id": "uw-grc-guide:0950:natural-resources:natrs-198-1-5-formerly-fores-198",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "NATRS 198 (1-5) formerly FORES 198",
    "sourceCourseTitle": "Independent Study-Natural Resources 1",
    "targetOutcome": "ESRM 1XX",
    "tags": [
      "NSC"
    ]
  },
  {
    "id": "uw-grc-guide:0951:natural-resources:natrs-199-1-5-formerly-fores-199",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "NATRS 199 (1-5) formerly FORES 199",
    "sourceCourseTitle": "Independent Study-Natural Resources 2",
    "targetOutcome": "ESRM 1XX",
    "tags": [
      "NSC"
    ]
  },
  {
    "id": "uw-grc-guide:0952:natural-resources:natrs-210-5",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "NATRS 210 (5)",
    "sourceCourseTitle": "Introduction to Soils",
    "targetOutcome": "ESRM 210 (5)",
    "tags": [
      "NSC"
    ]
  },
  {
    "id": "uw-grc-guide:0953:natural-resources:natrs-270-5",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "NATRS 270 (5)",
    "sourceCourseTitle": "Stream and Wetland Ecology",
    "targetOutcome": "ESRM 2XX",
    "tags": [
      "NSC"
    ]
  },
  {
    "id": "uw-grc-guide:0954:natural-resources:natrs-271-5",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "NATRS 271 (5)",
    "sourceCourseTitle": "Stream and Wetland Restoration",
    "targetOutcome": "ESRM 2XX",
    "tags": [
      "NSC"
    ]
  },
  {
    "id": "uw-grc-guide:0955:natural-resources:natrs-284-6-formerly-fores-284",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "NATRS 284 (6) formerly FORES 284",
    "sourceCourseTitle": "Road and Trail Engineering",
    "targetOutcome": "ESRM 2XX",
    "tags": [
      "NSC"
    ]
  },
  {
    "id": "uw-grc-guide:0956:natural-resources:natrs-285-5-formerly-fores-285",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "NATRS 285 (5) formerly FORES 285",
    "sourceCourseTitle": null,
    "targetOutcome": "ESRM 324 (5), for ESRM majors only; otherwise ESRM 2XX",
    "tags": [
      "NSC"
    ]
  },
  {
    "id": "uw-grc-guide:0957:natural-resources:natrs-286-5",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "NATRS 286 (5)",
    "sourceCourseTitle": "Natural Resources Business Principles",
    "targetOutcome": "ESRM 2XX",
    "tags": [
      "SSC",
      "NSC"
    ]
  },
  {
    "id": "uw-grc-guide:0959:natural-resources:natrs-293-5-formerly-fores-293",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "NATRS 293 (5) formerly FORES 293",
    "sourceCourseTitle": "Silvicultural Analysis and Forest Protection",
    "targetOutcome": "ESRM 323 (5)",
    "tags": [
      "NSC"
    ]
  },
  {
    "id": "uw-grc-guide:0961:natural-resources:natrs-297-1-5-formerly-fores-297",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "NATRS 297 (1-5) formerly FORES 297",
    "sourceCourseTitle": "Independent Study-Natural Resources 4",
    "targetOutcome": "ESRM 2XX",
    "tags": [
      "NSC"
    ]
  },
  {
    "id": "uw-grc-guide:0962:natural-resources:natrs-298-1-5-formerly-fores-298",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "NATRS 298 (1-5) formerly FORES 298",
    "sourceCourseTitle": "Independent Study-Natural Resources 5",
    "targetOutcome": "ESRM 2XX",
    "tags": [
      "NSC"
    ]
  },
  {
    "id": "uw-grc-guide:0972:nutrition:nutrand-101-5",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "NUTR& 101 (5)",
    "sourceCourseTitle": "Nutrition",
    "targetOutcome": "NUTR 200 (5)",
    "tags": [
      "NSC"
    ]
  },
  {
    "id": "uw-grc-guide:1000:oceanography:oceaand-101-5-formerly-ocean-101",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "OCEA& 101 (5) formerly OCEAN 101",
    "sourceCourseTitle": "Introduction to Oceanography",
    "targetOutcome": "OCEAN 101 (5)",
    "tags": [
      "NSC"
    ]
  },
  {
    "id": "uw-grc-guide:1004:philosophy:phil-102-5",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "PHIL 102 (5)",
    "sourceCourseTitle": "Contemporary Moral Problems",
    "targetOutcome": "PHIL 102 (5)",
    "tags": [
      "AH",
      "SSC"
    ]
  },
  {
    "id": "uw-grc-guide:1005:philosophy:phil-103-5",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "PHIL 103 (5)",
    "sourceCourseTitle": "Historical Survey-Ancient Philosophy",
    "targetOutcome": "PHIL 1XX",
    "tags": [
      "SSC"
    ]
  },
  {
    "id": "uw-grc-guide:1006:philosophy:phil-104-5",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "PHIL 104 (5)",
    "sourceCourseTitle": null,
    "targetOutcome": "PHIL 1XX",
    "tags": [
      "SSC"
    ]
  },
  {
    "id": "uw-grc-guide:1007:philosophy:phil-105-5",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "PHIL 105 (5)",
    "sourceCourseTitle": "Historical Survey-Modern Philosophy",
    "targetOutcome": "PHIL 1XX",
    "tags": [
      "SSC"
    ]
  },
  {
    "id": "uw-grc-guide:1009:philosophy:phil-110-5",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "PHIL 110 (5)",
    "sourceCourseTitle": "Social and Political Philosophy",
    "targetOutcome": "PHIL 110 (5)",
    "tags": [
      "SSC"
    ]
  },
  {
    "id": "uw-grc-guide:1011:philosophy:phil-114-5",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "PHIL 114 (5)",
    "sourceCourseTitle": null,
    "targetOutcome": "PHIL 114 (5)",
    "tags": [
      "SSC"
    ]
  },
  {
    "id": "uw-grc-guide:1012:philosophy:phil-115-5",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "PHIL 115 (5)",
    "sourceCourseTitle": null,
    "targetOutcome": "PHIL 115 (5)",
    "tags": [
      "SSC"
    ]
  },
  {
    "id": "uw-grc-guide:1016:philosophy:phil-160-5",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "PHIL 160 (5)",
    "sourceCourseTitle": "Introduction to the Philosophy of Science",
    "targetOutcome": "PHIL 1XX",
    "tags": [
      "SSC"
    ]
  },
  {
    "id": "uw-grc-guide:1021:philosophy:phil-194-1-5",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "PHIL 194 (1-5)",
    "sourceCourseTitle": null,
    "targetOutcome": "PHIL 1XX",
    "tags": [
      "SSC"
    ]
  },
  {
    "id": "uw-grc-guide:1024:philosophy:phil-200-5",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "PHIL 200 (5)",
    "sourceCourseTitle": "Introduction to the Philosophy of Religion",
    "targetOutcome": "PHIL 267 (5)",
    "tags": [
      "SSC"
    ]
  },
  {
    "id": "uw-grc-guide:1026:philosophy:phil-206-5",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "PHIL 206 (5)",
    "sourceCourseTitle": "Gender and Philosophy",
    "targetOutcome": "PHIL 206 (5) or GWSS 206 (5) or POL S 212 (5)",
    "tags": [
      "SSC"
    ]
  },
  {
    "id": "uw-grc-guide:1027:philosophy:phil-210-5",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "PHIL 210 (5)",
    "sourceCourseTitle": "Comparative Religion",
    "targetOutcome": "RELIG 2XX",
    "tags": [
      "SSC"
    ]
  },
  {
    "id": "uw-grc-guide:1028:philosophy:phil-215-5",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "PHIL 215 (5)",
    "sourceCourseTitle": null,
    "targetOutcome": "PHIL 2XX",
    "tags": [
      "SSC",
      "NSC"
    ]
  },
  {
    "id": "uw-grc-guide:1029:philosophy:phil-220-5",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "PHIL 220 (5)",
    "sourceCourseTitle": "Introduction to Eastern Philosophy",
    "targetOutcome": "PHIL 2XX",
    "tags": [
      "SSC"
    ]
  },
  {
    "id": "uw-grc-guide:1032:philosophy:phil-236-5",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "PHIL 236 (5)",
    "sourceCourseTitle": "Existentialism",
    "targetOutcome": "PHIL 2XX",
    "tags": [
      "SSC"
    ]
  },
  {
    "id": "uw-grc-guide:1033:philosophy:phil-238-5",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "PHIL 238 (5)",
    "sourceCourseTitle": "Introduction to Philosophy of Human Rights",
    "targetOutcome": "PHIL 2XX",
    "tags": [
      "SSC"
    ]
  },
  {
    "id": "uw-grc-guide:1034:philosophy:phil-240-5",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "PHIL 240 (5)",
    "sourceCourseTitle": "Introduction to Ethics",
    "targetOutcome": "PHIL 240 (5)",
    "tags": [
      "AH",
      "SSC"
    ]
  },
  {
    "id": "uw-grc-guide:1003:philosophy:philand-101-5-formerly-phil-100",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "PHIL& 101 (5) formerly PHIL 100",
    "sourceCourseTitle": "Introduction to Philosophy",
    "targetOutcome": "PHIL 100 (5)",
    "tags": [
      "SSC"
    ]
  },
  {
    "id": "uw-grc-guide:1013:philosophy:philand-120-5-formerly-philand-106",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "PHIL& 120 (5) formerly PHIL& 106",
    "sourceCourseTitle": "Symbolic Logic",
    "targetOutcome": "PHIL 120 (5)",
    "tags": [
      "SSC",
      "NSC"
    ]
  },
  {
    "id": "uw-grc-guide:1037:photography:photo-101-5",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "PHOTO 101 (5)",
    "sourceCourseTitle": "Beginning Black and White Photography",
    "targetOutcome": "ART 1XX",
    "tags": [
      "AH"
    ]
  },
  {
    "id": "uw-grc-guide:1038:photography:photo-102-5",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "PHOTO 102 (5)",
    "sourceCourseTitle": "Intermediate Photography",
    "targetOutcome": "ART 1XX",
    "tags": [
      "AH"
    ]
  },
  {
    "id": "uw-grc-guide:1039:photography:photo-103-5",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "PHOTO 103 (5)",
    "sourceCourseTitle": "Advanced Photography",
    "targetOutcome": "ART 1XX",
    "tags": [
      "AH"
    ]
  },
  {
    "id": "uw-grc-guide:1043:photography:photo-111-5-formerly-photo-104",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "PHOTO 111 (5) formerly PHOTO 104",
    "sourceCourseTitle": "Beginning Digital Photography",
    "targetOutcome": "ART 1XX",
    "tags": [
      "AH"
    ]
  },
  {
    "id": "uw-grc-guide:1044:photography:photo-112-5",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "PHOTO 112 (5)",
    "sourceCourseTitle": "Intermediate Digital Photography",
    "targetOutcome": "ART 1XX",
    "tags": [
      "AH"
    ]
  },
  {
    "id": "uw-grc-guide:1045:photography:photo-113-5",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "PHOTO 113 (5)",
    "sourceCourseTitle": "Advanced Digital Photography",
    "targetOutcome": "ART 1XX",
    "tags": [
      "AH"
    ]
  },
  {
    "id": "uw-grc-guide:1199:physics:phys-225-3-formerly-phys-221",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "PHYS 225 (3) formerly PHYS 221",
    "sourceCourseTitle": "Modern Physics",
    "targetOutcome": "PHYS 225 (3)",
    "tags": [
      "NSC"
    ]
  },
  {
    "id": "uw-grc-guide:1200:physics:phys-229-2-formerly-phys-208",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "PHYS 229 (2) formerly PHYS 208",
    "sourceCourseTitle": "Electric and Magnetic Fields",
    "targetOutcome": "PHYS 2XX",
    "tags": [
      "NSC"
    ]
  },
  {
    "id": "uw-grc-guide:1183:physics:physand-110-5-formerly-phys-105",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "PHYS& 110 (5) formerly PHYS 105",
    "sourceCourseTitle": "Physics Non-Science Majors with Lab",
    "targetOutcome": "PHYS 101 (5)",
    "tags": [
      "NSC"
    ]
  },
  {
    "id": "uw-grc-guide:1187:physics:physand-114-154-5-5-formerly-phys-110-150",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "PHYS& 114, 154 (5, 5) formerly PHYS 110, 150",
    "sourceCourseTitle": "General Physics I with Lab",
    "targetOutcome": "PHYS 114, 117 (4, 1) for either course",
    "tags": [
      "NSC"
    ]
  },
  {
    "id": "uw-grc-guide:1188:physics:physand-115-155-5-5-formerly-phys-111-151",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "PHYS& 115, 155 (5, 5) formerly PHYS 111, 151",
    "sourceCourseTitle": "General Physics II with Lab",
    "targetOutcome": "PHYS 115, 118 (4, 1) for either course",
    "tags": [
      "NSC"
    ]
  },
  {
    "id": "uw-grc-guide:1189:physics:physand-116-156-5-5-formerly-phys-112-152",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "PHYS& 116, 156 (5, 5) formerly PHYS 112, 152",
    "sourceCourseTitle": "General Physics III with Lab",
    "targetOutcome": "PHYS 116,119 (4, 1) for either course",
    "tags": [
      "NSC"
    ]
  },
  {
    "id": "uw-grc-guide:1196:physics:physand-221-5-formerly-phys-201",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "PHYS& 221 (5) formerly PHYS 201",
    "sourceCourseTitle": "Engineering Physics I with Lab",
    "targetOutcome": "PHYS 121 (5)",
    "tags": [
      "NSC"
    ]
  },
  {
    "id": "calculus-physics-sequence",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "PHYS& 221 + PHYS& 222 + PHYS& 223",
    "sourceCourseTitle": "Engineering Physics I with Lab / Engineering Physics II with Lab / Engineering Physics III with Lab",
    "targetOutcome": "Primary calculus-based physics transfer sequence.",
    "tags": [
      "NSC"
    ]
  },
  {
    "id": "uw-grc-guide:1197:physics:physand-222-5-formerly-phys-202",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "PHYS& 222 (5) formerly PHYS 202",
    "sourceCourseTitle": "Engineering Physics II with Lab",
    "targetOutcome": "PHYS 122 (5)",
    "tags": [
      "NSC"
    ]
  },
  {
    "id": "uw-grc-guide:1198:physics:physand-223-5-formerly-phys-203",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "PHYS& 223 (5) formerly PHYS 203",
    "sourceCourseTitle": "Engineering Physics III with Lab",
    "targetOutcome": "PHYS 123 (5)",
    "tags": [
      "NSC"
    ]
  },
  {
    "id": "uw-grc-guide:1221:political-science:pols-207-5",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "POLS 207 (5)",
    "sourceCourseTitle": "American Political Participation",
    "targetOutcome": "POL S 334",
    "tags": [
      "SSC"
    ]
  },
  {
    "id": "uw-grc-guide:1222:political-science:pols-209-5-formerly-p-sci-204",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "POLS 209 (5) formerly P SCI 204",
    "sourceCourseTitle": "State and Local Government Politics",
    "targetOutcome": "POL S 2XX",
    "tags": [
      "SSC"
    ]
  },
  {
    "id": "uw-grc-guide:1204:political-science:polsand-101-5-formerly-p-sci-100",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "POLS& 101 (5) formerly P SCI 100",
    "sourceCourseTitle": "Introduction to Political Science",
    "targetOutcome": "POL S 101 (5)",
    "tags": [
      "SSC"
    ]
  },
  {
    "id": "uw-grc-guide:1209:political-science:polsand-200-5",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "POLS& 200 (5)",
    "sourceCourseTitle": "Introduction to Law: United States",
    "targetOutcome": "POL S 2XX",
    "tags": [
      "SSC"
    ]
  },
  {
    "id": "uw-grc-guide:1212:political-science:polsand-202-5-formerly-p-sci-202",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "POLS& 202 (5) formerly P SCI 202",
    "sourceCourseTitle": "United States Government",
    "targetOutcome": "POL S 202 (5)",
    "tags": [
      "SSC"
    ]
  },
  {
    "id": "uw-grc-guide:1214:political-science:polsand-203-5-formerly-p-sci-203",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "POLS& 203 (5) formerly P SCI 203",
    "sourceCourseTitle": "International Relations",
    "targetOutcome": "POL S 203 (5)",
    "tags": [
      "SSC"
    ]
  },
  {
    "id": "uw-grc-guide:1216:political-science:polsand-204-5-formerly-p-sci-201",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "POLS& 204 (5) formerly P SCI 201",
    "sourceCourseTitle": "Comparative Government",
    "targetOutcome": "POL S 204 (5)",
    "tags": [
      "SSC"
    ]
  },
  {
    "id": "uw-grc-guide:1234:psychology:psyc-201-5-formerly-psych-201",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "PSYC 201 (5) formerly PSYCH 201",
    "sourceCourseTitle": "Personality",
    "targetOutcome": "PSYCH 203 (4), 2XX (1)",
    "tags": [
      "SSC"
    ]
  },
  {
    "id": "uw-grc-guide:1243:psychology:psyc-225-5-formerly-psych-220",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "PSYC 225 (5) formerly PSYCH 220",
    "sourceCourseTitle": "Fundamentals of Physiological Psychology",
    "targetOutcome": "PSYCH 202 (5)",
    "tags": [
      "NSC"
    ]
  },
  {
    "id": "uw-grc-guide:1225:psychology:psycand-100-5-formerly-psych-100",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "PSYC& 100 (5) formerly PSYCH 100",
    "sourceCourseTitle": "General Psychology",
    "targetOutcome": "PSYCH 101 (5)",
    "tags": [
      "SSC"
    ]
  },
  {
    "id": "uw-grc-guide:1229:psychology:psycand-180-5-formerly-psych-200",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "PSYC& 180 (5) formerly PSYCH 200",
    "sourceCourseTitle": "Human Sexuality",
    "targetOutcome": "PSYCH 210 (5)",
    "tags": [
      "SSC"
    ]
  },
  {
    "id": "uw-grc-guide:1232:psychology:psycand-200-5-formerly-psych-210",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "PSYC& 200 (5) formerly PSYCH 210",
    "sourceCourseTitle": "Lifespan Psychology",
    "targetOutcome": "PSYCH 2XX",
    "tags": [
      "SSC"
    ]
  },
  {
    "id": "uw-grc-guide:1241:psychology:psycand-220-5-formerly-psych-250",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "PSYC& 220 (5) formerly PSYCH 250",
    "sourceCourseTitle": "Psychological Disorders",
    "targetOutcome": "PSYCH 2XX",
    "tags": [
      "SSC"
    ]
  },
  {
    "id": "uw-grc-guide:1259:social-science:s-sci-160-5",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "S SCI 160 (5)",
    "sourceCourseTitle": "Introduction to the Study of Gender",
    "targetOutcome": "GWSS 1XX",
    "tags": [
      "SSC"
    ]
  },
  {
    "id": "uw-grc-guide:1263:social-science:s-sci-211-5-formerly-s-sci-215-same-as-ames-211-and-anthr-211",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "S SCI 211 (5) formerly S SCI 215, same as AMES 211, and ANTHR 211",
    "sourceCourseTitle": null,
    "targetOutcome": "AIS 2XX",
    "tags": [
      "SSC"
    ]
  },
  {
    "id": "uw-grc-guide:1274:sociology:soc-215-5-was-same-as-crj-215",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "SOC 215 (5) was same as \u00a7 CRJ 215",
    "sourceCourseTitle": "Survey of Criminology",
    "targetOutcome": "SOC 2XX",
    "tags": [
      "SSC"
    ]
  },
  {
    "id": "uw-grc-guide:1275:sociology:soc-220-5-formerly-soc-120",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "SOC 220 (5) formerly SOC 120",
    "sourceCourseTitle": "Sex and Gender in Society",
    "targetOutcome": "SOC 2XX or GWSS 1XX",
    "tags": [
      "SSC"
    ]
  },
  {
    "id": "uw-grc-guide:1277:sociology:soc-230-5",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "SOC 230 (5)",
    "sourceCourseTitle": "Sociology of Death and Dying",
    "targetOutcome": "SOC 2XX",
    "tags": [
      "SSC"
    ]
  },
  {
    "id": "uw-grc-guide:1278:sociology:soc-240-5",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "SOC 240 (5)",
    "sourceCourseTitle": "Sociology of the Family",
    "targetOutcome": "SOC 2XX",
    "tags": [
      "SSC"
    ]
  },
  {
    "id": "uw-grc-guide:1279:sociology:soc-245-5",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "SOC 245 (5)",
    "sourceCourseTitle": "Juvenile Delinquency",
    "targetOutcome": "SOC 2XX",
    "tags": [
      "SSC"
    ]
  },
  {
    "id": "uw-grc-guide:1281:sociology:soc-260-5",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "SOC 260 (5)",
    "sourceCourseTitle": "Crime and Justice",
    "targetOutcome": "SOC 2XX",
    "tags": [
      "SSC"
    ]
  },
  {
    "id": "uw-grc-guide:1268:sociology:socand-101-5-formerly-soc-110",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "SOC& 101 (5) formerly SOC 110",
    "sourceCourseTitle": "Introduction to Sociology",
    "targetOutcome": "SOC 110 (5)",
    "tags": [
      "SSC"
    ]
  },
  {
    "id": "uw-grc-guide:1272:sociology:socand-201-5-formerly-soc-201",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "SOC& 201 (5) formerly SOC 201",
    "sourceCourseTitle": "Social Problems",
    "targetOutcome": "SOC 270 (5)",
    "tags": [
      "SSC"
    ]
  },
  {
    "id": "uw-grc-guide:1296:spanish:spanand-221-5-formerly-span-201",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "SPAN& 221 (5) formerly SPAN 201",
    "sourceCourseTitle": "Spanish IV",
    "targetOutcome": "SPAN 201 (5)",
    "tags": [
      "AH"
    ]
  },
  {
    "id": "uw-grc-guide:1297:spanish:spanand-222-5-formerly-span-202",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "SPAN& 222 (5) formerly SPAN 202",
    "sourceCourseTitle": "Spanish V",
    "targetOutcome": "SPAN 202 (5)",
    "tags": [
      "AH"
    ]
  },
  {
    "id": "uw-grc-guide:1298:spanish:spanand-223-5-formerly-span-203",
    "targetSchoolIds": [
      "uw-seattle"
    ],
    "sourceCourseLabel": "SPAN& 223 (5) formerly SPAN 203",
    "sourceCourseTitle": "Spanish VI",
    "targetOutcome": "SPAN 203 (5)",
    "tags": [
      "AH"
    ]
  }
];

