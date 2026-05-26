import { extractCourseCodes } from "./course-code";

export const GENERAL_ED_PLACEHOLDER_CREDITS = 5;

export type GeneralEducationPlaceholderKind =
  | "ah"
  | "ssc"
  | "nsc"
  | "ahOrSsc"
  | "elective";

export type GeneralEducationPlaceholder = {
  label: string;
  kind: GeneralEducationPlaceholderKind;
};

export type GeneralEducationRequirementTargets = {
  ahCredits: number | null;
  sscCredits: number | null;
  nscCredits: number | null;
  breadthCredits: number | null;
  electiveCredits: number | null;
};

export type CompletedGeneralEducationCreditProgress = {
  ahCredits: number;
  sscCredits: number;
  nscCredits: number;
  breadthCredits: number;
};

const EMPTY_GENERAL_ED_REQUIREMENT_TARGETS: GeneralEducationRequirementTargets = {
  ahCredits: null,
  sscCredits: null,
  nscCredits: null,
  breadthCredits: null,
  electiveCredits: null,
};

export function createEmptyGeneralEducationRequirementTargets(): GeneralEducationRequirementTargets {
  return {
    ...EMPTY_GENERAL_ED_REQUIREMENT_TARGETS,
  };
}

export function hasGeneralEducationRequirementTargets(
  targets: GeneralEducationRequirementTargets | null | undefined
) {
  if (!targets) {
    return false;
  }

  return (
    targets.ahCredits !== null ||
    targets.sscCredits !== null ||
    targets.nscCredits !== null ||
    targets.breadthCredits !== null ||
    targets.electiveCredits !== null
  );
}

export function getGeneralEducationPlaceholderKind(
  label: string
): GeneralEducationPlaceholderKind | null {
  const normalized = String(label ?? "").toLowerCase();
  const hasHumanities = normalized.includes("humanit");
  const hasSocialScience = normalized.includes("social");
  const hasNaturalScience = normalized.includes("natural science") || /\bnsc\b/i.test(normalized);
  const hasElective =
    normalized.includes("elective") ||
    normalized.includes("general education") ||
    normalized.includes("general-education");

  if (hasHumanities && hasSocialScience) {
    return "ahOrSsc";
  }

  if (hasHumanities) {
    return "ah";
  }

  if (hasSocialScience) {
    return "ssc";
  }

  if (hasNaturalScience) {
    return "nsc";
  }

  if (hasElective) {
    return "elective";
  }

  return null;
}

export function createGeneralEducationPlaceholderByKind(
  kind: GeneralEducationPlaceholderKind
): GeneralEducationPlaceholder {
  switch (kind) {
    case "ah":
      return {
        label: "5 credits of Humanities",
        kind,
      };
    case "ssc":
      return {
        label: "5 credits of Social Science",
        kind,
      };
    case "nsc":
      return {
        label: "5 credits of Natural Sciences",
        kind,
      };
    case "ahOrSsc":
      return {
        label: "5 credits of A&H or SSc",
        kind,
      };
    case "elective":
      return {
        label: "5 credits of elective/general education",
        kind,
      };
  }
}

export function buildGeneralEducationPlaceholder(
  label: string
): GeneralEducationPlaceholder | null {
  const kind = getGeneralEducationPlaceholderKind(label);
  if (!kind) return null;

  return createGeneralEducationPlaceholderByKind(kind);
}

export function isChoiceBackedGeneralEducationPlaceholderLabel(label: string) {
  if (!getGeneralEducationPlaceholderKind(label)) {
    return false;
  }

  if (!extractCourseCodes(label).length) {
    return false;
  }

  return /\b(?:or|select|choose)\b/i.test(label);
}

export function buildSingleCategoryGeneralEducationRequirementTargets(
  kind: GeneralEducationPlaceholderKind,
  credits: number
): GeneralEducationRequirementTargets {
  return {
    ahCredits: kind === "ah" ? credits : null,
    sscCredits: kind === "ssc" ? credits : null,
    nscCredits: kind === "nsc" ? credits : null,
    breadthCredits: kind === "ahOrSsc" ? credits : null,
    electiveCredits: kind === "elective" ? credits : null,
  };
}

export function buildCompletedGeneralEducationProgressForCategoryOption(
  kind: GeneralEducationPlaceholderKind,
  credits: number
): CompletedGeneralEducationCreditProgress {
  return {
    ahCredits: kind === "ah" ? credits : 0,
    sscCredits: kind === "ssc" ? credits : 0,
    nscCredits: kind === "nsc" ? credits : 0,
    breadthCredits: kind === "ahOrSsc" ? credits : 0,
  };
}

export function mergeGeneralEducationRequirementTargets(
  primaryTargets: GeneralEducationRequirementTargets,
  fallbackTargets: GeneralEducationRequirementTargets
): GeneralEducationRequirementTargets {
  const mergeCredits = (primaryCredits: number | null, fallbackCredits: number | null) => {
    if (primaryCredits === null) return fallbackCredits;
    if (fallbackCredits === null) return primaryCredits;
    return Math.max(primaryCredits, fallbackCredits);
  };

  return {
    ahCredits: mergeCredits(primaryTargets.ahCredits, fallbackTargets.ahCredits),
    sscCredits: mergeCredits(primaryTargets.sscCredits, fallbackTargets.sscCredits),
    nscCredits: mergeCredits(primaryTargets.nscCredits, fallbackTargets.nscCredits),
    breadthCredits: mergeCredits(primaryTargets.breadthCredits, fallbackTargets.breadthCredits),
    electiveCredits: mergeCredits(primaryTargets.electiveCredits, fallbackTargets.electiveCredits),
  };
}
