import { TRANSFER_PLANNER_GENERATED_COURSE_METADATA } from "./course-metadata.generated";

const KNOWN_TRANSFER_PLANNER_SUBJECT_CODES = new Set(
  TRANSFER_PLANNER_GENERATED_COURSE_METADATA.map((entry) =>
    String(entry.code ?? "").match(/^([A-Z&]+(?: [A-Z&]+)*)\s+\d/)
  )
    .map((match) => match?.[1] ?? null)
    .filter((subjectCode): subjectCode is string => Boolean(subjectCode))
);

const EXPLICIT_SPACED_SUBJECT_ALIASES = new Map<string, string>([
  ["A A", "AA"],
  ["A MATH", "AMATH"],
  ["ART H", "ARTH"],
  ["CHEM E", "CHEME"],
  ["E E", "EE"],
  ["IND E", "INDE"],
  ["M E", "ME"],
]);

const RECOVERABLE_LEADING_SUBJECT_TOKENS = new Set([
  "AND",
  "AS",
  "BOTH",
  "EITHER",
  "IN",
  "OR",
  "PREREQ",
  "PREREQUISITE",
]);

export function normalizeTransferPlannerCourseCode(value: string) {
  const normalized = String(value ?? "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
  const match = normalized.match(/^([A-Z&]+(?: [A-Z&]+)*) (\d{3}(?:\.\d+)?[A-Z]?)$/);
  if (!match) {
    return normalized;
  }

  let subjectTokens = match[1].split(" ").filter(Boolean);
  while (
    subjectTokens.length > 1 &&
    RECOVERABLE_LEADING_SUBJECT_TOKENS.has(subjectTokens[0])
  ) {
    const candidateTokens = subjectTokens.slice(1);
    const candidateSpacedSubject = candidateTokens.join(" ");
    const candidateCollapsedSubject = candidateTokens.join("");
    if (
      KNOWN_TRANSFER_PLANNER_SUBJECT_CODES.has(candidateSpacedSubject) ||
      KNOWN_TRANSFER_PLANNER_SUBJECT_CODES.has(candidateCollapsedSubject)
    ) {
      subjectTokens = candidateTokens;
      continue;
    }
    break;
  }

  const spacedSubject = subjectTokens.join(" ");
  const explicitAlias = EXPLICIT_SPACED_SUBJECT_ALIASES.get(spacedSubject);
  if (explicitAlias) {
    return `${explicitAlias} ${match[2]}`;
  }

  const collapsedSubject = subjectTokens.join("");
  const normalizedSubject =
    subjectTokens.every((token) => token.length === 1) ||
    (subjectTokens.length > 1 &&
      KNOWN_TRANSFER_PLANNER_SUBJECT_CODES.has(collapsedSubject) &&
      !KNOWN_TRANSFER_PLANNER_SUBJECT_CODES.has(spacedSubject))
      ? collapsedSubject
      : spacedSubject;

  return `${normalizedSubject} ${match[2]}`;
}
