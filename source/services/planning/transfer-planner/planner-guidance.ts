import type { TransferPlannerChecklistItem } from "@/constants/transfer-planner-source/student-runtime";

export const REQUIRED_FOR_DEGREE_EITHER_WAY_NOTE =
  "Not part of the minimum transfer-admission classes, but good to complete before or during UW enrollment because it's needed to complete the degree either way.";
export const REQUIRED_FOR_DEGREE_EITHER_WAY_NOTE_PATTERN =
  /\bnot part of the minimum transfer-admission classes\b[\s\S]*\bneeded to complete the degree either way\b/i;
export const OPTIONAL_STEM_PREP_TEST_OUT_GUIDANCE =
  "Can be tested out of if not needed. Check with advisor for details.";
export const TRACK_SUPPLEMENTAL_TERM_LABEL_PATTERN =
  /\b(transferability of credits|generally transferable courses|section [a-z])\b/i;

function unique<T>(items: T[]) {
  return Array.from(new Set(items));
}

export function joinPlannerLabelList(labels: string[]) {
  if (labels.length <= 1) return labels[0] ?? "";
  if (labels.length === 2) return `${labels[0]} and ${labels[1]}`;
  return `${labels.slice(0, -1).join(", ")}, and ${labels[labels.length - 1]}`;
}

export function joinGuidanceSummaries(...parts: (string | null | undefined)[]) {
  const cleaned = parts
    .map((part) => String(part ?? "").trim())
    .filter(Boolean);

  return cleaned.length ? cleaned.join(" ") : null;
}

export function buildChecklistGuidanceSummary(
  _bucket: unknown,
  item: TransferPlannerChecklistItem
) {
  const explicitNote = String(item.note ?? "").trim();
  if (REQUIRED_FOR_DEGREE_EITHER_WAY_NOTE_PATTERN.test(explicitNote)) {
    return REQUIRED_FOR_DEGREE_EITHER_WAY_NOTE;
  }

  return null;
}

export function buildPrerequisiteGuidanceSummary(dependentCourseLabels: string[]) {
  const uniqueLabels = unique(
    dependentCourseLabels
      .map((label) => String(label ?? "").trim())
      .filter(Boolean)
  );
  if (!uniqueLabels.length) return null;

  return `Prerequisite for ${joinPlannerLabelList(uniqueLabels)}.`;
}

export function buildDependencyGuidanceSummary(input: {
  prerequisiteLabels: string[];
  corequisiteLabels: string[];
}) {
  return buildPrerequisiteGuidanceSummary(
    unique([...input.prerequisiteLabels, ...input.corequisiteLabels])
  );
}
