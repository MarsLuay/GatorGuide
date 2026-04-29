export type TransferPlannerSourceSchoolId =
  | "grc"
  | "uw-seattle"
  | "uw-bothell"
  | "uw-tacoma";

export type TransferPlannerSourceLink = {
  label: string;
  url: string;
  note?: string;
  visibility?: "visible" | "hidden";
  status?:
    | "verified"
    | "partially-verified"
    | "source-unfindable"
    | "source-conflict"
    | "parser-unsupported";
  reason?: string;
  sourceConfidence?: "high" | "medium" | "low";
};

export type TransferPlannerSourceManifestOwnerType =
  | "major"
  | "pathway"
  | "track"
  | "reference";

export type TransferPlannerSourceManifestRole =
  | "degree-requirements"
  | "admissions"
  | "curriculum"
  | "overview"
  | "equivalency"
  | "catalog"
  | "worksheet"
  | "availability"
  | "other";

export type TransferPlannerSourceManifestParserType =
  | "html-degree-page"
  | "html-admissions-page"
  | "html-curriculum-page"
  | "html-overview-page"
  | "catalog-page"
  | "equivalency-guide"
  | "pdf-degree-sheet"
  | "pdf-worksheet"
  | "annual-schedule-pdf"
  | "generic-html"
  | "generic-pdf"
  | "unknown";

export type TransferPlannerSourceManifestConfidence = "high" | "medium" | "low";

export type TransferPlannerSourceCoverageStatus =
  | "verified"
  | "partially-verified"
  | "source-unfindable"
  | "source-conflict"
  | "parser-unsupported";

export type TransferPlannerStudentVisibility = "visible" | "hidden";

export type TransferPlannerSourceManifestEntry = {
  id: string;
  ownerType: TransferPlannerSourceManifestOwnerType;
  ownerId: string;
  ownerTitle: string;
  planId?: string | null;
  pathwayId?: string | null;
  trackId?: string | null;
  campusId?: TransferPlannerSourceSchoolId | null;
  label: string;
  url: string;
  role: TransferPlannerSourceManifestRole;
  parserType: TransferPlannerSourceManifestParserType;
  confidence: TransferPlannerSourceManifestConfidence;
  isPrimaryDegreeRequirementsLink: boolean;
  note?: string;
  lastValidatedOn?: string | null;
  validationNotes: string[];
};

export type TransferPlannerPrimarySourcePromotionEntry = {
  ownerType: Extract<TransferPlannerSourceManifestOwnerType, "major" | "pathway">;
  ownerId: string;
  ownerKey: string;
  planId: string;
  pathwayId: string | null;
  ownerTitle: string;
  campusId: Exclude<TransferPlannerSourceSchoolId, "grc">;
  url: string;
  label: string;
  score: number;
  confidence: "high";
  reasons: string[];
  generatedAt: string;
};

export type TransferPlannerSourceGapEntry = {
  ownerType: TransferPlannerSourceManifestOwnerType;
  ownerKey: string;
  planId: string;
  pathwayId: string | null;
  title: string;
  campusId: Exclude<TransferPlannerSourceSchoolId, "grc">;
  sourceCoverageStatus: Extract<
    TransferPlannerSourceCoverageStatus,
    "source-unfindable" | "parser-unsupported"
  >;
  studentVisibility: "hidden";
  sourceGapReason: string;
  generatedAt: string;
  officialLinkCount: number;
  candidateCount: number;
  suggestedPrimary: {
    url: string;
    label: string | null;
    score: number;
    confidence: "medium";
    reasons: string[];
  } | null;
  sourceDiscoveryAttempts: Array<{
    url: string;
    label: string | null;
    score: number;
    confidence: TransferPlannerSourceManifestConfidence;
    reasons: string[];
  }>;
};

export type TransferPlannerSourceFingerprintEntry = {
  url: string;
  finalUrl: string | null;
  labels: string[];
  ownerIds: string[];
  kinds: string[];
  ok: boolean;
  status: number | null;
  contentType: string | null;
  contentLength: string | null;
  etag: string | null;
  lastModified: string | null;
  title: string | null;
  fetchMode: string;
  resourceFingerprint: string;
};

export type TransferPlannerRequirementSourceFingerprintEntry = {
  ownerId: string;
  ownerTitle: string;
  planId: string;
  pathwayId: string | null;
  campusId: Exclude<TransferPlannerSourceSchoolId, "grc">;
  parserType: TransferPlannerSourceManifestParserType;
  sourceUrl: string;
  sourceLabel: string;
  ok: boolean;
  parseConfidence: TransferPlannerSourceManifestConfidence;
  parsedUwCourseCodeCount: number;
  sourceOnlyUwCourseCodeCount: number;
  structuredOnlyUwCourseCodeCount: number;
  extractedHeadingCount: number;
  requirementCueLineCount: number;
  chooseStatementCount: number;
  qualitySignalCodes: TransferPlannerRequirementParseQualitySignalCode[];
  qualityWarningCount: number;
  qualityNoteCount: number;
  requirementFingerprint: string;
  parsedUwCourseCodes: string[];
  sourceOnlyUwCourseCodes: string[];
  structuredOnlyUwCourseCodes: string[];
};

export type TransferPlannerRequirementSourceParserAdapterId =
  | "uw-seattle-html-degree-page"
  | "uw-seattle-catalog-page"
  | "uw-bothell-html-degree-page"
  | "uw-bothell-catalog-page"
  | "uw-bothell-pdf-worksheet"
  | "uw-tacoma-html-degree-page"
  | "uw-tacoma-catalog-page"
  | "generic-official-pdf-degree-sheet"
  | "generic-official-html-page";

export type TransferPlannerRequirementSourceResolutionStrategy =
  | "primary-source"
  | "alternate-official-source"
  | "cached-snapshot";

export type TransferPlannerRequirementParseQualitySignalSeverity = "note" | "warning";

export type TransferPlannerRequirementParseQualitySignalCode =
  | "material-source-structured-drift"
  | "large-structured-only-course-gap"
  | "high-confidence-low-course-coverage"
  | "snapshot-fallback-used"
  | "alternate-official-source-used";

export type TransferPlannerRequirementParseQualitySignal = {
  severity: TransferPlannerRequirementParseQualitySignalSeverity;
  code: TransferPlannerRequirementParseQualitySignalCode;
  message: string;
  details: string | null;
};

export type TransferPlannerParsedRequirementAtomCandidate = {
  id: string;
  title: string;
  uwCourseCode: string;
  phase: TransferPlannerRequirementPhase | null;
  displayPhase: TransferPlannerRequirementPhase | null;
  phaseConfidence: "high" | "medium" | "low" | null;
  sourceLineHints: string[];
};

export type TransferPlannerParsedDegreeMapBlockCandidate = {
  id: string;
  title: string;
  uwCourseCodes: string[];
  sourceLineHints: string[];
};

export type TransferPlannerParsedRequirementType =
  | "all_required"
  | "choose_one"
  | "choose_n"
  | "choose_credits"
  | "sequence_choice";

export type TransferPlannerParsedRequirementOption = {
  id?: string;
  displayCourseCodes?: string[];
  uwCourses: string[];
  equivalentUwCourseCodes?: string[];
  credits?: number | null;
  creditMin?: number | null;
  creditMax?: number | null;
  creditText?: string | null;
  maxCredits?: number | null;
  title?: string | null;
  department?: string | null;
  category?: string | null;
  sourceHeading?: string | null;
  sourceCategory?: string | null;
  grcMatches: string[];
  constraints?: string[];
  notes?: string[];
  label: string;
};

export type TransferPlannerParsedRequirementGroup = {
  id: string;
  label: string;
  category: string;
  subcategory?: string | null;
  requirementType: TransferPlannerParsedRequirementType;
  minCourses?: number | null;
  maxCourses?: number | null;
  minCredits?: number | null;
  maxCredits?: number | null;
  sourceHeading?: string | null;
  notes?: string[];
  options: TransferPlannerParsedRequirementOption[];
};

export type TransferPlannerParsedRequirementCourseOptionRole =
  | "required"
  | "option"
  | "alias"
  | "note_only";

export type TransferPlannerParsedRequirementCourse = {
  courseCode: string;
  normalizedCourseCode: string;
  title?: string | null;
  credits?: number | null;
  creditMin?: number | null;
  creditMax?: number | null;
  creditText?: string | null;
  category: string;
  requirementGroupId: string;
  requirementType: TransferPlannerParsedRequirementType;
  optionRole: TransferPlannerParsedRequirementCourseOptionRole;
  sourceHeading: string;
  sourceCategory: string;
  notes?: string[];
};

export type TransferPlannerParsedRequirementReplacement = {
  baseRequirementId: string;
  replacedByRequirementId: string;
  appliesWhen: string;
  replacementReason: string;
  sourceUrl: string;
  sourceHeading: string;
};

export type TransferPlannerParsedRequirementSourceBlock = {
  id: string;
  ownerId: string;
  ownerTitle: string;
  planId: string;
  pathwayId: string | null;
  campusId: Exclude<TransferPlannerSourceSchoolId, "grc">;
  primaryParserType: TransferPlannerSourceManifestParserType;
  primarySourceUrl: string;
  primarySourceLabel: string;
  parserType: TransferPlannerSourceManifestParserType;
  adapterId: TransferPlannerRequirementSourceParserAdapterId;
  adapterFamily: string;
  sourceUrl: string;
  sourceLabel: string;
  resolutionStrategy: TransferPlannerRequirementSourceResolutionStrategy;
  ok: boolean;
  parseConfidence: TransferPlannerSourceManifestConfidence;
  parsedUwCourseCodes: string[];
  sourceOnlyUwCourseCodes: string[];
  structuredOnlyUwCourseCodes: string[];
  requirementCueLines: string[];
  chooseStatements: string[];
  pathwayLabels: string[];
  qualitySignals: TransferPlannerRequirementParseQualitySignal[];
  parsedRequirementAtomCandidates: TransferPlannerParsedRequirementAtomCandidate[];
  parsedDegreeMapBlockCandidates: TransferPlannerParsedDegreeMapBlockCandidate[];
  parsedRequirementGroups?: TransferPlannerParsedRequirementGroup[];
  parsedRequirementCourses?: TransferPlannerParsedRequirementCourse[];
  parsedRequirementReplacements?: TransferPlannerParsedRequirementReplacement[];
  snapshotPath: string | null;
  usedSnapshotFallback: boolean;
  snapshotFallbackReason: string | null;
  error: string | null;
};

export type TransferPlannerRequirementSourceAdapterSummary = {
  generatedAt: string;
  totalOwners: number;
  okCount: number;
  failedCount: number;
  parsedRequirementSourceBlockCount: number;
  parsedRequirementAtomCandidateCount: number;
  parsedDegreeMapBlockCandidateCount: number;
  parsedRequirementGroupCount?: number;
  parsedRequirementCourseCount?: number;
  snapshotFallbackCount: number;
  countsByAdapterId: Record<string, number>;
  countsByAdapterFamily: Record<string, number>;
  countsByCampus: Record<string, number>;
  countsByResolutionStrategy: Record<string, number>;
  qualityWarningCount: number;
  qualityNoteCount: number;
  countsByQualitySignalCode: Record<string, number>;
};

export type TransferPlannerRequirementDiffClassificationKind =
  | "auto-promoted-exact-consensus"
  | "auto-promoted-single-sample-consensus"
  | "auto-promoted-guide-direct-equivalent"
  | "auto-promoted-guide-sequence-equivalent"
  | "auto-promoted-guide-reference-only-equivalent"
  | "auto-promoted-exact-title-metadata-match"
  | "auto-promoted-exact-title-alternative-paths"
  | "auto-promoted-course-family-consensus"
  | "auto-promoted-choice-set-resolved"
  | "source-backed-guide-sequence-equivalent"
  | "source-backed-guide-reference-only-equivalent"
  | "source-backed-choice-set-no-public-grc-path"
  | "source-backed-generic-topic-course"
  | "source-backed-exact-title-multiple-grc-matches"
  | "source-backed-campus-specific-no-public-grc-equivalent"
  | "source-backed-no-public-grc-equivalent";

export type TransferPlannerRequirementDiffClassificationEntry = {
  id: string;
  ownerId: string;
  planId: string;
  pathwayId: string | null;
  campusId: Exclude<TransferPlannerSourceSchoolId, "grc">;
  majorTitle: string;
  sourceUwCourseCode: string;
  classificationKind: TransferPlannerRequirementDiffClassificationKind;
  promotedRequirementAtomOverrideId: string | null;
  guideRuleId: string | null;
  displayPhase: TransferPlannerRequirementPhase | null;
  mappingConfidence: TransferPlannerSourceManifestConfidence | null;
  phaseConfidence: "high" | "medium" | "low" | null;
  grcCourseCodes: string[];
  alternativeCourseCodeSets: string[][];
  note: string;
  rationale: string;
  sourceLinks: TransferPlannerSourceLink[];
  validationNotes: string[];
};

export type TransferPlannerRequirementDiffClassificationSummary = {
  generatedAt: string;
  totalOwners: number;
  promotedCount: number;
  classifiedCount: number;
  nonPromotedClassificationCount: number;
  reviewCandidateCount: 0;
  unmappedCount: 0;
  countsByKind: Record<string, number>;
  countsByCampus: Record<string, number>;
};

export type TransferPlannerCourseSourceKind =
  | "track-term"
  | "track-catalog-year"
  | "track-slot-expansion"
  | "plan-checklist"
  | "plan-course-list"
  | "plan-degree-map"
  | "availability";

export type TransferPlannerEffectiveYearRange = {
  startLabel: string;
  endLabel: string | null;
  note?: string;
};

export type TransferPlannerCourseRegistryEntry = {
  id: string;
  schoolId: TransferPlannerSourceSchoolId;
  code: string;
  displayLabel: string;
  title: string | null;
  creditValue: number | null;
  creditLabel: string | null;
  catalogDescription: string | null;
  subjectCode: string;
  catalogNumber: string;
  level: number | null;
  sourceKinds: TransferPlannerCourseSourceKind[];
  sourceContexts: string[];
  referencedByPlanIds: string[];
  referencedByTrackIds: string[];
  sourceLinks: TransferPlannerSourceLink[];
  effectiveYearLabels: string[];
  effectiveYearRanges: TransferPlannerEffectiveYearRange[];
  prerequisiteCourseCodes: string[];
  prerequisiteAlternativeCourseCodeSets: string[][];
  prerequisiteNotes: string[];
  corequisiteCourseCodes: string[];
  corequisiteAlternativeCourseCodeSets: string[][];
  corequisiteNotes: string[];
  lastValidatedOn?: string | null;
  latestAvailabilitySummary?: string | null;
  latestPublishedQuarters?: string[];
  notes: string[];
};

export type TransferPlannerEquivalencyRuleType =
  | "direct-course"
  | "elective-credit"
  | "limited-credit"
  | "no-credit"
  | "sequence"
  | "full-credit-combo"
  | "alternate-path"
  | "chain-rule"
  | "technical-but-not-recommended";

export type TransferPlannerEquivalencyAcceptanceCategory =
  | "preferred"
  | "accepted"
  | "accepted-with-warning"
  | "legacy-accepted"
  | "no-credit";

export type TransferPlannerEquivalencyRuleStatus =
  | "active"
  | "legacy"
  | "deprecated";

export type TransferPlannerEquivalencyRuleSourceKind =
  | "uw-green-river-equivalency-guide"
  | "uw-green-river-equivalency-guide-derived";

export type TransferPlannerEquivalencyRule = {
  id: string;
  type: TransferPlannerEquivalencyRuleType;
  title: string;
  acceptanceCategory: TransferPlannerEquivalencyAcceptanceCategory;
  ruleStatus?: TransferPlannerEquivalencyRuleStatus;
  sourceKind?: TransferPlannerEquivalencyRuleSourceKind;
  sourceSchoolId: TransferPlannerSourceSchoolId;
  targetSchoolIds: TransferPlannerSourceSchoolId[];
  sourceCourseSets?: string[][];
  targetCourseCodes?: string[];
  targetOutcome: string;
  weakerThanRuleIds: string[];
  effectiveYearRanges: TransferPlannerEffectiveYearRange[];
  effectiveDateLabel?: string | null;
  guideDepartment?: string | null;
  sourceCourseLabel?: string | null;
  sourceCourseTitle?: string | null;
  targetRequirementTags?: string[];
  isObsoleteSourceCourse?: boolean;
  parsedFromOfficialGuide?: boolean;
  plannerWarnings: string[];
  notes: string[];
  sourceLinks: TransferPlannerSourceLink[];
};

export type TransferPlannerStudentCourseEvaluationOutcome =
  | "auto-approved"
  | "sequence-incomplete"
  | "legacy-rule-used"
  | "elective-credit"
  | "no-credit"
  | "not-applicable-to-major"
  | "source-unverified-hidden";

export type TransferPlannerStudentCourseEvaluation = {
  id: string;
  planId: string | null;
  pathwayId: string | null;
  courseCode: string;
  courseLabel: string;
  outcome: TransferPlannerStudentCourseEvaluationOutcome;
  studentFacing: boolean;
  appliedRequirementIds: string[];
  approvedRuleId: string | null;
  alternativeApprovedRuleIds: string[];
  ruleStatus: TransferPlannerEquivalencyRuleStatus | null;
  acceptanceCategory: TransferPlannerEquivalencyAcceptanceCategory | null;
  targetOutcome: string | null;
  targetRequirementTags: string[];
  sourceCreditAmount: number | null;
  targetCourseCodes: string[];
  sourceCourseSet: string[];
  missingSourceCourseCodes: string[];
  effectiveTermLabel: string | null;
  automaticGuidanceSummary: string | null;
  warnings: string[];
  notes: string[];
  sourceLinks: TransferPlannerSourceLink[];
};

export type TransferPlannerRequirementPhase =
  | "before-application"
  | "before-enrollment"
  | "stay-at-grc";

export type TransferPlannerMajorRequirementAtom = {
  id: string;
  planId: string;
  pathwayId?: string | null;
  campusId: Exclude<TransferPlannerSourceSchoolId, "grc">;
  majorTitle: string;
  phase: TransferPlannerRequirementPhase;
  displayPhase: TransferPlannerRequirementPhase;
  title: string;
  grcCourseCodes: string[];
  alternativeCourseCodeSets: string[][];
  minCompletedCount: number | null;
  note?: string;
  sourceLinks: TransferPlannerSourceLink[];
  validationNotes: string[];
};

export type TransferPlannerDegreeMapBlock = {
  id: string;
  planId: string;
  pathwayId?: string | null;
  campusId: Exclude<TransferPlannerSourceSchoolId, "grc">;
  majorTitle: string;
  title: string;
  itemLabels: string[];
  uwCourseCodes: string[];
  note?: string;
  sourceLinks: TransferPlannerSourceLink[];
  validationNotes: string[];
};

export type TransferPlannerPolicyEntry = {
  id: string;
  planId: string;
  pathwayId?: string | null;
  campusId: Exclude<TransferPlannerSourceSchoolId, "grc">;
  majorTitle: string;
  bestTrackId: string | null;
  recommendedTrackSummary: string;
  whyThisTrack: string[];
  advisorFlags: string[];
  grcCourseListGuidance?: string;
  plannerNote?: string;
  sourceLinks: TransferPlannerSourceLink[];
  validationNotes: string[];
};

export type TransferPlannerMajorPathwayEntry = {
  id: string;
  planId: string;
  pathwayId: string;
  campusId: Exclude<TransferPlannerSourceSchoolId, "grc">;
  majorTitle: string;
  label: string;
  summary: string;
  grcCourseList: string[];
  sourceLinks: TransferPlannerSourceLink[];
  validationNotes: string[];
};
