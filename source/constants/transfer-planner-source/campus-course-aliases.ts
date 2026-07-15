import type { TransferPlannerCampusId } from "../transfer-planner-types";
import { normalizeTransferPlannerCourseCode } from "./course-code-normalization";

const BOTHELL_ALIAS_ENTRIES: [string, string[]][] = [
  ["BBIO 180", ["BIOL 180"]],
  ["BBIO 200", ["BIOL 200"]],
  ["BBIO 220", ["BIOL 220"]],
  ["BCHEM 143", ["CHEM 142"]],
  ["BCHEM 144", ["CHEM 142"]],
  ["BCHEM 153", ["CHEM 152"]],
  ["BCHEM 154", ["CHEM 152"]],
  ["BCHEM 163", ["CHEM 162"]],
  ["BCHEM 164", ["CHEM 162"]],
  ["BCHEM 237", ["CHEM 237"]],
  ["BCHEM 238", ["CHEM 238"]],
  ["BCHEM 239", ["CHEM 239"]],
  ["BCHEM 241", ["CHEM 241"]],
  ["BCHEM 242", ["CHEM 242"]],
  ["BPHYS 114", ["PHYS 114"]],
  ["BPHYS 115", ["PHYS 115"]],
  ["BPHYS 116", ["PHYS 116"]],
  ["BPHYS 117", ["PHYS 117"]],
  ["BPHYS 118", ["PHYS 118"]],
  ["BPHYS 119", ["PHYS 119"]],
  ["BPHYS 121", ["PHYS 121"]],
  ["BPHYS 122", ["PHYS 122"]],
  ["BPHYS 123", ["PHYS 123"]],
  ["CHEM 143", ["CHEM 142"]],
  ["CHEM 145", ["CHEM 142"]],
  ["CHEM 153", ["CHEM 152"]],
  ["CHEM 155", ["CHEM 152"]],
  ["CHEM 165", ["CHEM 162"]],
  ["MATH 134", ["MATH 124"]],
  ["MATH 135", ["MATH 125"]],
  ["MATH 136", ["MATH 126"]],
  ["STMATH 124", ["MATH 124"]],
  ["STMATH 125", ["MATH 125"]],
  ["STMATH 126", ["MATH 126"]],
  ["STMATH 207", ["MATH 207"]],
  ["STMATH 208", ["MATH 208"]],
  ["STMATH 224", ["MATH 224"]],
];

export const TRANSFER_PLANNER_BOTHELL_CAMPUS_ALIAS_GUIDE_TARGET_COURSE_ALIASES =
  new Map<string, string[]>(BOTHELL_ALIAS_ENTRIES);

const TACOMA_CAMPUS_ALIAS_GUIDE_TARGET_COURSE_ALIASES = new Map<string, string[]>([
  ["TCES 215", ["EE 215"]],
]);

export function getTransferPlannerCampusAliasGuideTargetCourseCodes(
  campusId: TransferPlannerCampusId | string | null | undefined,
  courseCode: string | null | undefined
) {
  const normalizedCourseCode = normalizeTransferPlannerCourseCode(courseCode ?? "");
  if (!normalizedCourseCode) {
    return [] as string[];
  }

  if (campusId === "uw-bothell") {
    return [
      ...(TRANSFER_PLANNER_BOTHELL_CAMPUS_ALIAS_GUIDE_TARGET_COURSE_ALIASES.get(
        normalizedCourseCode
      ) ?? []),
    ];
  }

  if (campusId === "uw-tacoma") {
    const mathMatch = normalizedCourseCode.match(/^TMATH\s+(\d{3}(?:\.\d+)?[A-Z]?)$/);
    if (mathMatch) {
      return [`MATH ${mathMatch[1]}`];
    }

    const physicsMatch = normalizedCourseCode.match(/^TPHYS\s+(\d{3}(?:\.\d+)?[A-Z]?)$/);
    if (physicsMatch) {
      return [`PHYS ${physicsMatch[1]}`];
    }

    return [...(TACOMA_CAMPUS_ALIAS_GUIDE_TARGET_COURSE_ALIASES.get(normalizedCourseCode) ?? [])];
  }

  return [] as string[];
}
