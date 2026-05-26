import {
  OPPORTUNITY_DEADLINE_TYPES,
  OPPORTUNITY_TYPES,
  type Opportunity,
} from "@/constants/opportunities";

export const SCHOLARSHIP_EXPORT_FILE_NAME = "GatorGuide_scholarships.tsv";

export const SCHOLARSHIP_EXPORT_COLUMNS = [
  "LINK",
  "NAME",
  "AMOUNT",
  "One time or continuous",
  "DESCRIPTION",
  "DEADLINE",
  "PREREQ",
  "Institution-specific?",
  "Discipline-specific?",
  "Full-time required?",
  "GPA requirement",
  "MATERIALS REQUIRED",
  "Essay required?",
  "Submission Form",
  "How many Essays?",
  "How many recommendations required?",
] as const;

type ScholarshipExportColumn = (typeof SCHOLARSHIP_EXPORT_COLUMNS)[number];
type ScholarshipExportRow = Record<ScholarshipExportColumn, string>;

type ScholarshipExportOverride = {
  section?: "catalog" | "legacy";
  amount?: string;
  oneTimeOrContinuous?: string;
  description?: string;
  deadline?: string;
  prereq?: string;
  institutionSpecific?: string;
  disciplineSpecific?: string;
  fullTimeRequired?: string;
  gpaRequirement?: string;
  materialsRequired?: string;
  essayRequired?: string;
  submissionForm?: string;
  howManyEssays?: string;
  howManyRecommendationsRequired?: string;
};

const SCHOLARSHIP_EXPORT_OVERRIDES: Record<string, ScholarshipExportOverride> = {
  "green-river-foundation-scholarship": {
    institutionSpecific: "Green River College",
    disciplineSpecific: "No",
    materialsRequired: "Application, essays, recommendation",
    essayRequired: "Yes",
    submissionForm: "Online",
  },
  "wsos-career-technical-scholarship": {
    institutionSpecific: "No",
    disciplineSpecific: "Yes",
    fullTimeRequired: "No; at least 3 credits per term",
    materialsRequired: "Application, FAFSA/WASFA, essay",
    essayRequired: "Yes",
    submissionForm: "Online",
    howManyRecommendationsRequired: "0",
  },
  "immigrants-rising-scholarship-database": {
    section: "legacy",
    amount: "Varies",
    institutionSpecific: "No",
    disciplineSpecific: "",
    materialsRequired: "",
    essayRequired: "",
    submissionForm: "Online database",
  },
  "granco-federal-credit-union-scholarship": {
    section: "legacy",
    amount: "$500",
    oneTimeOrContinuous: "one time",
    deadline: "March 28",
    prereq: "High school senior or current student accepted into a college, community college, technical college, or other educational institution",
    institutionSpecific: "No",
    disciplineSpecific: "No",
    materialsRequired: "Application, personal letter, essay",
    essayRequired: "Yes",
    submissionForm: "Email, mail, in person",
    howManyEssays: "1",
  },
  "uw-scholarships-database": {
    section: "legacy",
    amount: "Varies",
    institutionSpecific: "UW",
    disciplineSpecific: "No",
    materialsRequired: "",
    essayRequired: "",
    submissionForm: "Online database",
  },
  "silme-domingo-gene-viernes-scholarship": {
    section: "legacy",
    amount: "$6,000",
    oneTimeOrContinuous: "continuous",
    deadline: "May 4, 2026",
    prereq: "Graduate student, entering first-year student, or transfer student to a UW campus; financial need required",
    institutionSpecific: "UW",
    disciplineSpecific: "No",
    fullTimeRequired: "Autumn Quarter enrollment required",
    materialsRequired: "Essay responses, letter of support, transcript, contact information, optional supporting documents",
    essayRequired: "Three prompts; 1,600 words total maximum",
    submissionForm: "Online",
    howManyEssays: "3",
    howManyRecommendationsRequired: "1",
  },
  "washington-society-professional-engineers-educational-foundation-scholarship": {
    section: "legacy",
    amount: "$3,000",
    oneTimeOrContinuous: "one time",
    deadline: "May 1",
    prereq: "Second-year Washington community college student transferring to an ABET-accredited engineering program in Washington",
    institutionSpecific: "No",
    disciplineSpecific: "Yes",
    gpaRequirement: "2.5",
    materialsRequired: "Application, short essay, unofficial transcript, ABET program application, recommendation letter(s)",
    essayRequired: "400 words",
    submissionForm: "Mail",
    howManyEssays: "1",
    howManyRecommendationsRequired: "1 or 2",
  },
};

export type ScholarshipExportFile = {
  fileName: string;
  content: string;
  scholarshipCount: number;
  catalogCount: number;
  legacyCount: number;
};

function cleanCell(value: string | number | boolean | null | undefined) {
  return String(value ?? "")
    .replace(/\r?\n/g, " ")
    .replace(/\t/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function formatCurrency(value: number, currency: string) {
  if (currency === "USD") {
    return `$${value.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  }
  return `${value.toLocaleString("en-US", { maximumFractionDigits: 0 })} ${currency}`;
}

function formatAmount(opportunity: Opportunity) {
  if (opportunity.award.amountText) return opportunity.award.amountText;

  const currency = opportunity.award.currency || "USD";
  const minimum = opportunity.award.amountMin;
  const maximum = opportunity.award.amountMax;

  if (minimum != null && maximum != null) {
    if (minimum === maximum) return formatCurrency(minimum, currency);
    return `${formatCurrency(minimum, currency)} - ${formatCurrency(maximum, currency)}`;
  }
  if (maximum != null) return `Up to ${formatCurrency(maximum, currency)}`;
  if (minimum != null) return `${formatCurrency(minimum, currency)}+`;
  return "Varies";
}

function formatAwardCadence(opportunity: Opportunity) {
  if (opportunity.award.renewable == null) return "";
  return opportunity.award.renewable ? "continuous" : "one time";
}

function formatDate(value: string | null) {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(parsed);
}

function formatDeadline(opportunity: Opportunity) {
  if (opportunity.deadline.type === OPPORTUNITY_DEADLINE_TYPES.rolling) {
    return "Rolling";
  }

  const formattedDate = formatDate(opportunity.dueAt);
  if (formattedDate) return formattedDate;

  if (opportunity.recurrence.isYearly && opportunity.recurrence.month && opportunity.recurrence.day) {
    const recurringDate = new Date(2026, opportunity.recurrence.month - 1, opportunity.recurrence.day);
    const month = recurringDate.toLocaleString("en-US", { month: "long" });
    return `${month} ${opportunity.recurrence.day}`;
  }

  return opportunity.deadline.label ?? "";
}

function formatPrereq(opportunity: Opportunity) {
  const prereqs: string[] = [];
  if (opportunity.eligibility.transferOnly) prereqs.push("Transfer student");
  if (opportunity.eligibility.residencyTypes.length) {
    prereqs.push(`Residency: ${opportunity.eligibility.residencyTypes.join(", ")}`);
  }
  if (opportunity.eligibility.communityTags.length) {
    prereqs.push(`Community: ${opportunity.eligibility.communityTags.join(", ")}`);
  }
  if (opportunity.matching.hasToBeMajor && opportunity.matching.suggestedMajors.length) {
    prereqs.push(`Major: ${opportunity.matching.suggestedMajors.join(", ")}`);
  }
  return prereqs.join("; ");
}

function formatInstitutionSpecific(opportunity: Opportunity) {
  return opportunity.college.collegeName ?? "No";
}

function formatDisciplineSpecific(opportunity: Opportunity) {
  return opportunity.matching.hasToBeMajor || opportunity.matching.suggestedMajors.length
    ? "Yes"
    : "No";
}

function formatMaterials(opportunity: Opportunity) {
  const materials: string[] = [];
  if (opportunity.requirements.essayCount > 0) materials.push("Essay");
  if (opportunity.requirements.recommendationCountMin > 0) {
    materials.push(
      opportunity.requirements.recommendationCountMin === 1
        ? "Recommendation"
        : `${opportunity.requirements.recommendationCountMin} recommendations`
    );
  }
  if (opportunity.externalUrl) materials.push("Application");
  return materials.join(", ");
}

function formatEssayRequired(opportunity: Opportunity) {
  return opportunity.requirements.essayCount > 0 ? "Yes" : "No";
}

function formatSubmissionForm(opportunity: Opportunity) {
  return opportunity.externalUrl ? "Online" : "";
}

function formatCount(value: number | null | undefined) {
  return value && value > 0 ? String(value) : "";
}

function applyOverride(
  override: ScholarshipExportOverride | undefined,
  key: keyof ScholarshipExportOverride,
  fallback: string
) {
  const value = override?.[key];
  return typeof value === "string" ? value : fallback;
}

function buildScholarshipRow(opportunity: Opportunity): ScholarshipExportRow {
  const override = SCHOLARSHIP_EXPORT_OVERRIDES[opportunity.opportunityId];

  return {
    LINK: opportunity.externalUrl ?? opportunity.source.sourceUrl ?? "",
    NAME: opportunity.title,
    AMOUNT: applyOverride(override, "amount", formatAmount(opportunity)),
    "One time or continuous": applyOverride(
      override,
      "oneTimeOrContinuous",
      formatAwardCadence(opportunity)
    ),
    DESCRIPTION: applyOverride(override, "description", opportunity.summary),
    DEADLINE: applyOverride(override, "deadline", formatDeadline(opportunity)),
    PREREQ: applyOverride(override, "prereq", formatPrereq(opportunity)),
    "Institution-specific?": applyOverride(
      override,
      "institutionSpecific",
      formatInstitutionSpecific(opportunity)
    ),
    "Discipline-specific?": applyOverride(
      override,
      "disciplineSpecific",
      formatDisciplineSpecific(opportunity)
    ),
    "Full-time required?": applyOverride(override, "fullTimeRequired", ""),
    "GPA requirement": applyOverride(
      override,
      "gpaRequirement",
      opportunity.eligibility.gpaMin == null ? "" : String(opportunity.eligibility.gpaMin)
    ),
    "MATERIALS REQUIRED": applyOverride(
      override,
      "materialsRequired",
      formatMaterials(opportunity)
    ),
    "Essay required?": applyOverride(
      override,
      "essayRequired",
      formatEssayRequired(opportunity)
    ),
    "Submission Form": applyOverride(
      override,
      "submissionForm",
      formatSubmissionForm(opportunity)
    ),
    "How many Essays?": applyOverride(
      override,
      "howManyEssays",
      formatCount(opportunity.requirements.essayCount)
    ),
    "How many recommendations required?": applyOverride(
      override,
      "howManyRecommendationsRequired",
      formatCount(opportunity.requirements.recommendationCountMin)
    ),
  };
}

function isLegacyScholarship(opportunity: Opportunity) {
  const override = SCHOLARSHIP_EXPORT_OVERRIDES[opportunity.opportunityId];
  return override?.section === "legacy" || opportunity.source.kind === "legacy";
}

function dedupeOpportunities(opportunities: Opportunity[]) {
  const byId = new Map<string, Opportunity>();
  for (const opportunity of opportunities) {
    byId.set(opportunity.opportunityId, opportunity);
  }
  return Array.from(byId.values());
}

function renderSection(title: string, rows: ScholarshipExportRow[]) {
  const titleRow = [title, ...Array(SCHOLARSHIP_EXPORT_COLUMNS.length - 1).fill("")].join("\t");
  const headerRow = SCHOLARSHIP_EXPORT_COLUMNS.join("\t");
  const dataRows = rows.map((row) =>
    SCHOLARSHIP_EXPORT_COLUMNS.map((column) => cleanCell(row[column])).join("\t")
  );
  return [titleRow, headerRow, ...dataRows].join("\n");
}

export function buildScholarshipExportFile(
  opportunities: Opportunity[]
): ScholarshipExportFile {
  const scholarships = dedupeOpportunities(opportunities).filter(
    (opportunity) => opportunity.type === OPPORTUNITY_TYPES.scholarship
  );

  const catalogRows = scholarships
    .filter((opportunity) => !isLegacyScholarship(opportunity))
    .map(buildScholarshipRow);
  const legacyRows = scholarships
    .filter(isLegacyScholarship)
    .map(buildScholarshipRow);

  const content = [
    renderSection("Catalog Scholarships", catalogRows),
    renderSection("Legacy Scholarships", legacyRows),
  ].join("\n\n");

  return {
    fileName: SCHOLARSHIP_EXPORT_FILE_NAME,
    content: `${content}\n`,
    scholarshipCount: scholarships.length,
    catalogCount: catalogRows.length,
    legacyCount: legacyRows.length,
  };
}
