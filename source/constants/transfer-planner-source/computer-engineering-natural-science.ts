import { normalizeTransferPlannerCourseCode } from "./course-code-normalization";

export const COMPUTER_ENGINEERING_APPROVED_NATURAL_SCIENCE_FILTER_ID =
  "CE_APPROVED_NATURAL_SCIENCE";
export const COMPUTER_ENGINEERING_APPROVED_NATURAL_SCIENCE_FILTER_PARAM =
  "ce-approved-natural-science";
export const COMPUTER_ENGINEERING_APPROVED_NATURAL_SCIENCE_FILTER_LABEL =
  "CE-approved Natural Science";
export const COMPUTER_ENGINEERING_APPROVED_NATURAL_SCIENCE_FILTER_HEADING =
  "Computer Engineering Natural Science";
export const COMPUTER_ENGINEERING_APPROVED_NATURAL_SCIENCE_SOURCE_URL =
  "https://www.cs.washington.edu/academics/undergraduate/degree-requirements/courses/#core";
export const COMPUTER_ENGINEERING_APPROVED_NATURAL_SCIENCE_CATEGORY =
  "COMPE_APPROVED_NATURAL_SCIENCE";
export const COMPUTER_ENGINEERING_APPROVED_MATH_SCIENCE_CATEGORY =
  "COMPE_APPROVED_MATH_SCIENCE";

export const COMPUTER_ENGINEERING_APPROVED_NATURAL_SCIENCE_UW_COURSE_CODES = [
  "BIOL 162",
  "BIOL 180",
  "BIOL 200",
  "BIOL 220",
  "BIOL 325",
  "BIOL 333",
  "BIOL 340",
  "BIOL 354",
  "BIOL 355",
  "BIOL 356",
  "BIOL 401",
  "BIOL 402",
  "BIOL 403",
  "BIOL 405",
  "BIOL 407",
  "BIOL 408",
  "BIOL 409",
  "BIOL 411",
  "BIOL 412",
  "BIOL 413",
  "BIOL 414",
  "BIOL 415",
  "BIOL 425",
  "BIOL 426",
  "BIOL 427",
  "BIOL 433",
  "BIOL 434",
  "BIOL 435",
  "BIOL 437",
  "BIOL 440",
  "BIOL 441",
  "BIOL 442",
  "BIOL 443",
  "BIOL 444",
  "BIOL 446",
  "BIOL 452",
  "BIOL 454",
  "BIOL 455",
  "BIOL 459",
  "BIOL 462",
  "BIOL 463",
  "BIOL 464",
  "BIOL 471",
  "BIOL 472",
  "BIOL 473",
  "BIOL 474",
  "BIOL 475",
  "BIOL 476",
  "BIOL 477",
  "BIOL 479",
  "BIOL 480",
  "CHEM 142",
  "CHEM 143",
  "CHEM 144",
  "CHEM 145",
  "CHEM 152",
  "CHEM 155",
  "CHEM 162",
  "CHEM 165",
  "CHEM 220",
  "CHEM 221",
  "CHEM 223",
  "CHEM 224",
  "CHEM 237",
  "CHEM 238",
  "CHEM 239",
  "CHEM 241",
  "CHEM 242",
  "CHEM 312",
  "CHEM 317",
  "CHEM 321",
  "PHYS 116",
  "PHYS 119",
  "PHYS 123",
  "PHYS 143",
  "PHYS 224",
  "PHYS 225",
  "PHYS 227",
  "PHYS 228",
  "PHYS 231",
  "PHYS 232",
  "PHYS 315",
  "PHYS 321",
  "PHYS 322",
  "PHYS 323",
  "PHYS 324",
  "PHYS 325",
  "PHYS 328",
  "PHYS 331",
  "PHYS 334",
  "PHYS 335",
  "PHYS 407",
  "PHYS 408",
  "PHYS 421",
  "PHYS 422",
  "PHYS 423",
  "PHYS 424",
  "PHYS 425",
  "PHYS 426",
  "PHYS 434",
  "PHYS 460",
  "ESS 311",
  "ESS 313",
  "ESS 403",
  "ESS 413",
  "ESS 414",
  "ESS 415",
  "ESS 424",
  "ESS 431",
  "ESS 437",
  "ESS 438",
  "ESS 458",
  "ESS 464",
  "ESS 466",
  "ESS 467",
  "ESS 471",
  "ASTR 301",
  "ASTR 321",
  "ASTR 322",
  "ASTR 323",
  "ASTR 423",
  "ASTR 480",
  "ATMOS 301",
  "ATMOS 321",
  "ATMOS 370",
  "ATMOS 380",
  "ATMOS 451",
  "ATMOS 452",
  "ATMOS 460",
] as const;

export const COMPUTER_ENGINEERING_APPROVED_NATURAL_SCIENCE_PETITION_ONLY_NOTES = [
  "CHEM other graded 400-level courses by petition",
  "Courses not on the Allen School list that require PHYS 121, CHEM 142/145, or BIOL 180 as prerequisites require CSE adviser review",
] as const;

const COMPUTER_ENGINEERING_APPROVED_NATURAL_SCIENCE_UW_COURSE_CODE_SET =
  new Set(
    COMPUTER_ENGINEERING_APPROVED_NATURAL_SCIENCE_UW_COURSE_CODES.map((courseCode) =>
      normalizeTransferPlannerCourseCode(courseCode)
    )
  );

export function isComputerEngineeringApprovedNaturalScienceUwCourseCode(
  courseCode: string | null | undefined
) {
  return COMPUTER_ENGINEERING_APPROVED_NATURAL_SCIENCE_UW_COURSE_CODE_SET.has(
    normalizeTransferPlannerCourseCode(String(courseCode ?? ""))
  );
}

export function isComputerEngineeringApprovedNaturalScienceCategory(
  value: string | null | undefined
) {
  return (
    String(value ?? "")
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") === COMPUTER_ENGINEERING_APPROVED_NATURAL_SCIENCE_CATEGORY
  );
}

export function normalizeComputerEngineeringNaturalScienceFilterId(
  value: string | null | undefined
) {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (
    normalized === COMPUTER_ENGINEERING_APPROVED_NATURAL_SCIENCE_FILTER_PARAM ||
    normalized === "computer-engineering-natural-science" ||
    normalized === "ce-natural-science" ||
    normalized === "ce-approved-nsc" ||
    normalized === "ce-approved-natural-sciences"
  ) {
    return COMPUTER_ENGINEERING_APPROVED_NATURAL_SCIENCE_FILTER_ID;
  }

  return null;
}

