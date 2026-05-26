import {
  getTransferPlannerCanonicalCourse,
  type TransferPlannerMajorPlan,
} from "@/constants/transfer-planner-source/student-runtime";

import { normalizeCourseCode } from "./course-code";

const UW_SEATTLE_COMPUTER_ENGINEERING_PLAN_ID = "uw-seattle-computer-engineering";
const UW_SEATTLE_BIOENGINEERING_PLAN_ID = "uw-seattle-bioengineering";

export type TransferPlannerCoursePlanningGraph = {
  prerequisiteCourseSetsByCourseCode: Record<string, string[][]>;
  corequisiteCourseSetsByCourseCode: Record<string, string[][]>;
  sourceCounts: {
    metadataPrerequisiteCourseCount: number;
    metadataCorequisiteCourseCount: number;
    chainPrerequisiteCourseCount: number;
  };
};

export type CoursePlanningRequirementMapKey =
  | "prerequisiteCourseSetsByCourseCode"
  | "corequisiteCourseSetsByCourseCode";

export type CoursePlanningRequirementCourse = {
  explicitCourseCodes: string[];
  prerequisiteCourseSets: string[][];
  corequisiteCourseSets: string[][];
};

function sortCourseCodes(codes: string[]) {
  return Array.from(new Set(codes.filter(Boolean))).sort((left, right) =>
    left.localeCompare(right)
  );
}

function normalizeCourseRequirementPath(courseCodes: string[]) {
  return sortCourseCodes(courseCodes.map((code) => normalizeCourseCode(code)).filter(Boolean));
}

function addCourseRequirementPath(
  requirementMap: Map<string, string[][]>,
  courseCode: string,
  coursePath: string[]
) {
  const normalizedCourseCode = normalizeCourseCode(courseCode);
  const normalizedPath = normalizeCourseRequirementPath(coursePath).filter(
    (code) => code !== normalizedCourseCode
  );
  if (!normalizedPath.length) return;

  const existingPaths = requirementMap.get(normalizedCourseCode) ?? [];
  const pathKey = normalizedPath.join("|");
  const alreadyRecorded = existingPaths.some((path) => path.join("|") === pathKey);
  if (alreadyRecorded) return;

  requirementMap.set(normalizedCourseCode, [...existingPaths, normalizedPath]);
}

export function buildCourseMetadataRequirementPaths(
  requiredCourseCodes: string[],
  alternativeCourseCodeSets: string[][],
  actionableCourseCodes: Set<string>
) {
  const requiredCodes = normalizeCourseRequirementPath(requiredCourseCodes);
  const alternativePaths = alternativeCourseCodeSets
    .map((courseSet) => normalizeCourseRequirementPath(courseSet))
    .filter((courseSet) => courseSet.length > 0);
  const candidatePaths = alternativePaths.length
    ? alternativePaths.map((courseSet) => normalizeCourseRequirementPath([...requiredCodes, ...courseSet]))
    : requiredCodes.length
      ? [requiredCodes]
      : [];

  return candidatePaths
    .map((courseSet) => courseSet.filter((courseCode) => actionableCourseCodes.has(courseCode)))
    .filter((courseSet) => courseSet.length > 0);
}

function buildMetadataCourseRequirementMap(
  actionableCourseCodes: Set<string>,
  kind: "prerequisite" | "corequisite"
) {
  const requirementMap = new Map<string, string[][]>();

  for (const courseCode of actionableCourseCodes) {
    const course = getTransferPlannerCanonicalCourse("grc", courseCode);
    if (!course) continue;

    const requirementPaths =
      kind === "prerequisite"
        ? buildCourseMetadataRequirementPaths(
            course.prerequisiteCourseCodes,
            course.prerequisiteAlternativeCourseCodeSets,
            actionableCourseCodes
          )
        : buildCourseMetadataRequirementPaths(
            course.corequisiteCourseCodes,
            course.corequisiteAlternativeCourseCodeSets,
            actionableCourseCodes
          );

    for (const requirementPath of requirementPaths) {
      addCourseRequirementPath(requirementMap, courseCode, requirementPath);
    }
  }

  return requirementMap;
}

function buildPlannerChainPrerequisiteMap(
  plan: TransferPlannerMajorPlan | null | undefined,
  actionableCourseCodes: Set<string>
) {
  const requirementMap = new Map<string, string[][]>();
  const normalizedCs121Code = normalizeCourseCode("CS 121");
  const normalizedCs122Code = normalizeCourseCode("CS 122");
  const normalizedCs123Code = normalizeCourseCode("CS 123");
  const normalizedCs141Code = normalizeCourseCode("CS& 141");
  const normalizedCs145Code = normalizeCourseCode("CS 145");
  const normalizedMath151Code = normalizeCourseCode("MATH& 151");
  const normalizedMath238Code = normalizeCourseCode("MATH 238");
  const normalizedMath264Code = normalizeCourseCode("MATH& 264");

  if (actionableCourseCodes.has(normalizedCs123Code)) {
    addCourseRequirementPath(requirementMap, normalizedCs123Code, [normalizedCs122Code]);
    addCourseRequirementPath(requirementMap, normalizedCs122Code, [normalizedCs121Code]);
  } else if (actionableCourseCodes.has(normalizedCs122Code)) {
    addCourseRequirementPath(requirementMap, normalizedCs122Code, [normalizedCs121Code]);
  }

  if (
    plan?.id === UW_SEATTLE_COMPUTER_ENGINEERING_PLAN_ID &&
    actionableCourseCodes.has(normalizedCs145Code)
  ) {
    addCourseRequirementPath(requirementMap, normalizedCs145Code, [
      normalizedCs141Code,
      normalizedMath151Code,
    ]);
  }

  if (
    plan?.id === UW_SEATTLE_BIOENGINEERING_PLAN_ID &&
    actionableCourseCodes.has(normalizedMath238Code) &&
    actionableCourseCodes.has(normalizedMath264Code)
  ) {
    addCourseRequirementPath(requirementMap, normalizedMath238Code, [normalizedMath264Code]);
  }

  return requirementMap;
}

export function mergeCourseRequirementMaps(...maps: Map<string, string[][]>[]) {
  const merged = new Map<string, string[][]>();

  for (const map of maps) {
    for (const [courseCode, requirementPaths] of map.entries()) {
      for (const requirementPath of requirementPaths) {
        addCourseRequirementPath(merged, courseCode, requirementPath);
      }
    }
  }

  return merged;
}

function applyPlannerPrerequisitePathOverrides(
  requirementMap: Map<string, string[][]>,
  actionableCourseCodes: Set<string>,
  plan: TransferPlannerMajorPlan | null | undefined
) {
  if (plan?.id !== UW_SEATTLE_BIOENGINEERING_PLAN_ID) {
    return requirementMap;
  }

  const normalizedEngl101Code = normalizeCourseCode("ENGL& 101");
  const normalizedChem163Code = normalizeCourseCode("CHEM& 163");
  const normalizedBiol211Code = normalizeCourseCode("BIOL& 211");
  const normalizedBiol212Code = normalizeCourseCode("BIOL& 212");
  const normalizedBiol213Code = normalizeCourseCode("BIOL& 213");
  const normalizedMath238Code = normalizeCourseCode("MATH 238");
  const normalizedMath264Code = normalizeCourseCode("MATH& 264");

  if (
    actionableCourseCodes.has(normalizedBiol211Code) &&
    actionableCourseCodes.has(normalizedChem163Code)
  ) {
    requirementMap.set(normalizedBiol211Code, [
      actionableCourseCodes.has(normalizedEngl101Code)
        ? [normalizedChem163Code, normalizedEngl101Code]
        : [normalizedChem163Code],
    ]);
  }
  if (actionableCourseCodes.has(normalizedBiol213Code)) {
    requirementMap.set(normalizedBiol213Code, [[normalizedBiol212Code]]);
  }
  if (actionableCourseCodes.has(normalizedBiol212Code)) {
    requirementMap.set(normalizedBiol212Code, [[normalizedBiol211Code]]);
  }
  if (
    actionableCourseCodes.has(normalizedMath238Code) &&
    actionableCourseCodes.has(normalizedMath264Code)
  ) {
    requirementMap.set(normalizedMath238Code, [[normalizedMath264Code]]);
  }

  return requirementMap;
}

function mapRequirementPathsToRecord(map: Map<string, string[][]>) {
  return Object.fromEntries(
    [...map.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([courseCode, requirementPaths]) => [
        courseCode,
        requirementPaths
          .map((requirementPath) => [...requirementPath])
          .sort((left, right) => left.join("|").localeCompare(right.join("|"))),
      ])
  );
}

export function buildTransferPlannerCoursePlanningGraph(input: {
  plan?: TransferPlannerMajorPlan | null;
  actionableCourseCodes: Set<string> | string[];
}): TransferPlannerCoursePlanningGraph {
  const actionableCourseCodes = new Set(
    [...input.actionableCourseCodes].map((courseCode) => normalizeCourseCode(courseCode))
  );
  const metadataPrerequisiteMap = buildMetadataCourseRequirementMap(
    actionableCourseCodes,
    "prerequisite"
  );
  const metadataCorequisiteMap = buildMetadataCourseRequirementMap(
    actionableCourseCodes,
    "corequisite"
  );
  const chainPrerequisiteMap = buildPlannerChainPrerequisiteMap(input.plan, actionableCourseCodes);
  const prerequisiteMap = applyPlannerPrerequisitePathOverrides(
    mergeCourseRequirementMaps(
      metadataPrerequisiteMap,
      chainPrerequisiteMap
    ),
    actionableCourseCodes,
    input.plan
  );

  return {
    prerequisiteCourseSetsByCourseCode: mapRequirementPathsToRecord(prerequisiteMap),
    corequisiteCourseSetsByCourseCode: mapRequirementPathsToRecord(metadataCorequisiteMap),
    sourceCounts: {
      metadataPrerequisiteCourseCount: metadataPrerequisiteMap.size,
      metadataCorequisiteCourseCount: metadataCorequisiteMap.size,
      chainPrerequisiteCourseCount: chainPrerequisiteMap.size,
    },
  };
}

export function getCoursePlanningGraphRequirementMap(
  graph: TransferPlannerCoursePlanningGraph,
  key: CoursePlanningRequirementMapKey
) {
  return new Map(
    Object.entries(graph[key]).map(([courseCode, requirementPaths]) => [
      courseCode,
      requirementPaths.map((requirementPath) => [...requirementPath]),
    ])
  );
}

export function requirementPathsAreSatisfied(
  requirementPaths: string[][],
  satisfiedCourseCodes: Set<string>
) {
  if (!requirementPaths.length) {
    return true;
  }

  return requirementPaths.some((coursePath) =>
    coursePath.every((courseCode) => satisfiedCourseCodes.has(courseCode))
  );
}

export function courseHasSatisfiedPrerequisites<Course extends CoursePlanningRequirementCourse>(
  course: Course,
  completedCourseCodes: Set<string>
) {
  return requirementPathsAreSatisfied(course.prerequisiteCourseSets, completedCourseCodes);
}

export function courseHasSatisfiedCorequisites<Course extends CoursePlanningRequirementCourse>(
  course: Course,
  completedCourseCodes: Set<string>,
  selectedCourses: Course[]
) {
  const satisfiedCourseCodes = new Set([
    ...completedCourseCodes,
    ...selectedCourses.flatMap((selectedCourse) => selectedCourse.explicitCourseCodes),
  ]);
  return requirementPathsAreSatisfied(course.corequisiteCourseSets, satisfiedCourseCodes);
}
