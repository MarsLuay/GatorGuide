import type { Href } from "expo-router";

import { ROUTES } from "@/constants/routes";
import {
  getTransferPlannerStudentRuntimeMajorsForCampus,
  TRANSFER_PLANNER_TRACKS,
  type TransferPlannerCampusId,
} from "@/constants/transfer-planner-source/student-runtime";

import {
  GRC_PLANNER_CAMPUS_ID,
  isPlannerUwCampusId,
  type PlannerCampusSelectionId,
  type PlannerCollegeId,
} from "./transfer-planner-storage";

export type TransferPlannerRouteParams = {
  college?: string | string[];
  campus?: string | string[];
  major?: string | string[];
};

export type TransferPlannerRouteSelection = {
  collegeId: PlannerCollegeId;
  campusId: PlannerCampusSelectionId;
  majorId: string | null;
};

type PlannerPublicPathInput = {
  collegeId: PlannerCollegeId;
  campusId: PlannerCampusSelectionId;
  majorId: string | null | undefined;
};

function firstRouteValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function normalizeRouteSlug(value: string | null | undefined) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function getUwCampusRouteSlug(campusId: TransferPlannerCampusId) {
  return campusId.replace(/^uw-/, "");
}

function getUwMajorRouteSlug(campusId: TransferPlannerCampusId, majorId: string) {
  const prefix = `${campusId}-`;
  return majorId.startsWith(prefix) ? majorId.slice(prefix.length) : majorId;
}

function resolveUwCampusIdFromRoute(campus: string | string[] | undefined) {
  const campusSlug = normalizeRouteSlug(firstRouteValue(campus));
  if (!campusSlug) return null;

  const campusId = campusSlug.startsWith("uw-") ? campusSlug : `uw-${campusSlug}`;
  return isPlannerUwCampusId(campusId) ? campusId : null;
}

function getMajorTitleSlug(title: string) {
  return normalizeRouteSlug(title.replace(/\([^)]*\)/g, ""));
}

function resolveUwMajorIdFromRoute(
  campusId: TransferPlannerCampusId,
  major: string | string[] | undefined
) {
  const majorSlug = normalizeRouteSlug(firstRouteValue(major));
  if (!majorSlug) return null;

  const majors = getTransferPlannerStudentRuntimeMajorsForCampus(campusId);
  const fullMajorSlug = normalizeRouteSlug(`${campusId}-${majorSlug}`);

  return (
    majors.find((plan) => {
      const planIdSlug = normalizeRouteSlug(plan.id);
      return (
        planIdSlug === majorSlug ||
        planIdSlug === fullMajorSlug ||
        normalizeRouteSlug(getUwMajorRouteSlug(campusId, plan.id)) === majorSlug ||
        getMajorTitleSlug(plan.title) === majorSlug ||
        normalizeRouteSlug(plan.shortTitle) === majorSlug
      );
    })?.id ?? null
  );
}

function resolveGrcMajorIdFromRoute(major: string | string[] | undefined) {
  const majorSlug = normalizeRouteSlug(firstRouteValue(major));
  if (!majorSlug) return null;

  return (
    TRANSFER_PLANNER_TRACKS.find((track) => {
      return (
        normalizeRouteSlug(track.id) === majorSlug ||
        normalizeRouteSlug(track.code) === majorSlug ||
        getMajorTitleSlug(track.title) === majorSlug
      );
    })?.id ?? null
  );
}

export function getTransferPlannerRouteSelection(
  params: TransferPlannerRouteParams
): TransferPlannerRouteSelection | null {
  const collegeSlug = normalizeRouteSlug(firstRouteValue(params.college));
  if (collegeSlug === "grc" || collegeSlug === "green-river") {
    return {
      collegeId: "grc",
      campusId: GRC_PLANNER_CAMPUS_ID,
      majorId: resolveGrcMajorIdFromRoute(params.major),
    };
  }

  if (collegeSlug !== "uw" && collegeSlug !== "university-of-washington") {
    return null;
  }

  const campusId = resolveUwCampusIdFromRoute(params.campus);
  if (!campusId) return null;

  return {
    collegeId: "uw",
    campusId,
    majorId: resolveUwMajorIdFromRoute(campusId, params.major),
  };
}

export function getTransferPlannerPublicPath(input: PlannerPublicPathInput) {
  if (input.collegeId !== "uw" || !isPlannerUwCampusId(input.campusId) || !input.majorId) {
    return String(ROUTES.transferPlanner);
  }

  return `${ROUTES.transferPlanner}/uw/${getUwCampusRouteSlug(
    input.campusId
  )}/${getUwMajorRouteSlug(input.campusId, input.majorId)}`;
}

export function getTransferPlannerHref(input: PlannerPublicPathInput): Href {
  if (input.collegeId !== "uw" || !isPlannerUwCampusId(input.campusId) || !input.majorId) {
    return ROUTES.transferPlanner as Href;
  }

  return ROUTES.transferPlannerMajor({
    college: "uw",
    campus: getUwCampusRouteSlug(input.campusId),
    major: getUwMajorRouteSlug(input.campusId, input.majorId),
  });
}

export function isTransferPlannerPublicPath(pathname: string) {
  const normalizedPath = String(pathname ?? "").replace(/\/+$/, "");
  const plannerRoot = String(ROUTES.transferPlanner);
  return normalizedPath === plannerRoot || normalizedPath.startsWith(`${plannerRoot}/`);
}
