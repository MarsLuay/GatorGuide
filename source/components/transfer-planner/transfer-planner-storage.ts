import { TRANSFER_PLANNER_CAMPUSES, type TransferPlannerCampusId } from "@/constants/transfer-planner-source/student-runtime";
import type { UploadedFile } from "@/services/storage/storage.service";

// Planner questionnaire key strings live in "@/constants/planner-storage".
// This module only handles planner UI payload normalization and route-scoped IDs.
export const GRC_PLANNER_CAMPUS_ID = "grc";

export type PlannerCollegeId = "uw" | "grc";
export type PlannerCampusSelectionId = TransferPlannerCampusId | typeof GRC_PLANNER_CAMPUS_ID;
export type PlannerSelectorKey = "college" | "campus" | "major" | null;
export type TranscriptDocument = UploadedFile;

export function getPlannerPathKey(campusId: string, majorId: string, pathwayId?: string | null) {
  return `${String(campusId ?? "").trim()}::${String(majorId ?? "").trim()}::${String(
    pathwayId ?? "base"
  ).trim()}`;
}

export function normalizePlannerCurrentCourseMap(rawValue: unknown) {
  if (!rawValue || typeof rawValue !== "object" || Array.isArray(rawValue)) {
    return {} as Record<string, string[]>;
  }

  const normalized: Record<string, string[]> = {};

  for (const [pathKey, value] of Object.entries(rawValue)) {
    if (!Array.isArray(value)) continue;
    const nextValues = Array.from(
      new Set(
        value
          .map((entry) => String(entry ?? "").trim())
          .filter(Boolean)
      )
    );
    if (nextValues.length) {
      normalized[pathKey] = nextValues;
    }
  }

  return normalized;
}

export function normalizePlannerSelectedOptionsMap(rawValue: unknown) {
  if (!rawValue || typeof rawValue !== "object" || Array.isArray(rawValue)) {
    return {} as Record<string, Record<string, string[]>>;
  }

  const normalized: Record<string, Record<string, string[]>> = {};

  for (const [pathKey, pathValue] of Object.entries(rawValue)) {
    if (!pathValue || typeof pathValue !== "object" || Array.isArray(pathValue)) {
      continue;
    }

    const selections: Record<string, string[]> = {};
    for (const [groupId, rawSelectionValue] of Object.entries(pathValue)) {
      const normalizedGroupId = String(groupId ?? "").trim();
      const rawSelectionValues = Array.isArray(rawSelectionValue)
        ? rawSelectionValue
        : rawSelectionValue == null
          ? []
          : [rawSelectionValue];
      const optionIds = Array.from(
        new Set(
          rawSelectionValues
            .map((entry) => String(entry ?? "").trim())
            .filter(Boolean)
        )
      );

      if (normalizedGroupId) {
        selections[normalizedGroupId] = optionIds;
      }
    }

    if (Object.keys(selections).length) {
      normalized[pathKey] = selections;
    }
  }

  return normalized;
}

export function normalizePlannerSelectedPathwayMap(rawValue: unknown) {
  if (!rawValue || typeof rawValue !== "object" || Array.isArray(rawValue)) {
    return {} as Record<string, string>;
  }

  const normalized: Record<string, string> = {};

  for (const [planId, value] of Object.entries(rawValue)) {
    const normalizedPlanId = String(planId ?? "").trim();
    const normalizedPathwayId = String(value ?? "").trim();
    if (!normalizedPlanId || !normalizedPathwayId) continue;
    normalized[normalizedPlanId] = normalizedPathwayId;
  }

  return normalized;
}

export function normalizePlannerLastSelectedPlan(rawValue: unknown) {
  if (!rawValue || typeof rawValue !== "object" || Array.isArray(rawValue)) {
    return null;
  }

  const rawCollegeId = (rawValue as Record<string, unknown>).collegeId;
  const rawCampusId = (rawValue as Record<string, unknown>).campusId;
  const rawMajorId = (rawValue as Record<string, unknown>).majorId;
  const collegeId = String(rawCollegeId ?? "").trim().toLowerCase();
  const campusId = String(rawCampusId ?? "").trim();
  const majorId = String(rawMajorId ?? "").trim();
  if (!campusId || !majorId) return null;

  return {
    collegeId: collegeId === "grc" || campusId === GRC_PLANNER_CAMPUS_ID ? "grc" : "uw",
    campusId,
    majorId,
  } as {
    collegeId: PlannerCollegeId;
    campusId: PlannerCampusSelectionId;
    majorId: string;
  };
}

export function isPlannerUwCampusId(value: string): value is TransferPlannerCampusId {
  return TRANSFER_PLANNER_CAMPUSES.some((entry) => entry.id === value);
}

export function getDefaultPlannerCampusId(collegeId: PlannerCollegeId): PlannerCampusSelectionId {
  return collegeId === "grc" ? GRC_PLANNER_CAMPUS_ID : "uw-seattle";
}
