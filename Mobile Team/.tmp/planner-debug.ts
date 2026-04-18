// @ts-nocheck

import {
  getTransferPlannerEquivalencyRulesForSourceCourse,
  getTransferPlannerGrcCourseList,
  getTransferPlannerMajorPlan,
  getTransferPlannerParsedRequirementSourceBlocks,
  getTransferPlannerRequirementDiffClassifications,
  getTransferPlannerStudentRuntimeMajorPlan,
  getTransferPlannerTrack,
  resolveTransferPlannerMajorPlan,
} from "../constants/transfer-planner-source";
import {
  buildGeneralEducationRequirementTargets,
  buildRequirementStatuses,
  buildSuggestedQuarterPlan,
} from "../services/planning/transfer-planner.service";

const planIds = [
  "uw-seattle-chemical-engineering",
  "uw-seattle-electrical-computer-engineering",
  "uw-seattle-civil-engineering",
  "uw-seattle-industrial-systems-engineering",
  "uw-seattle-materials-science-engineering",
  "uw-seattle-aeronautics-astronautics",
  "uw-seattle-applied-and-computational-mathematical-sciences",
  "uw-seattle-biology",
  "uw-seattle-bioengineering",
  "uw-seattle-applied-mathematics",
  "uw-seattle-american-ethnic-studies",
  "uw-seattle-global-literary-studies",
];

for (const planId of planIds) {
  const plan = getTransferPlannerMajorPlan(planId);
  const resolved = plan ? resolveTransferPlannerMajorPlan(plan, plan.pathways?.[0]?.id ?? null) : null;
  const blocks = getTransferPlannerParsedRequirementSourceBlocks(planId, null);
  const classifications = getTransferPlannerRequirementDiffClassifications(planId, null).filter((entry) =>
    ["CHEM 142", "CSE 121", "CSE 123", "MATH 124", "PHYS 121"].includes(entry.sourceUwCourseCode)
  );

  console.log(
    JSON.stringify(
      {
        planId,
        exists: Boolean(plan),
        degreeMapTitles: resolved?.degreeMapSections?.map((section) => section.title) ?? [],
        grcCourseList: resolved ? getTransferPlannerGrcCourseList(resolved) : [],
        parsedBlocks: blocks.map((block) => ({
          ownerId: block.ownerId,
          parsedUwCourseCodes: block.parsedUwCourseCodes,
          sourceOnlyUwCourseCodes: block.sourceOnlyUwCourseCodes,
          candidateHints: (block.parsedRequirementAtomCandidates ?? [])
            .filter((candidate) =>
              ["CHEM 142", "CSE 121", "CSE 123", "MATH 124", "PHYS 121"].includes(candidate.uwCourseCode)
            )
            .map((candidate) => ({
              uwCourseCode: candidate.uwCourseCode,
              sourceLineHints: candidate.sourceLineHints,
            })),
        })),
        classifications: classifications.map((classification) => ({
          sourceUwCourseCode: classification.sourceUwCourseCode,
          classificationKind: classification.classificationKind,
          guideRuleId: classification.guideRuleId,
          grcCourseCodes: classification.grcCourseCodes,
          alternativeCourseCodeSets: classification.alternativeCourseCodeSets,
          validationNotes: classification.validationNotes,
        })),
      },
      null,
      2
    )
  );
}

for (const sourceCourseCode of ["CHEM 142", "CSE 123", "MATH 124", "PHYS 121", "CSE 121"]) {
  console.log(
    JSON.stringify(
      {
        sourceCourseCode,
        guideRules: getTransferPlannerEquivalencyRulesForSourceCourse(sourceCourseCode)
          .filter((rule) => String(rule.sourceKind).includes("equivalency-guide"))
          .map((rule) => ({
            id: rule.id,
            type: rule.type,
            ruleStatus: rule.ruleStatus,
            acceptanceCategory: rule.acceptanceCategory,
            sourceCourseSets: rule.sourceCourseSets,
            title: rule.title,
            sourceCourseLabel: rule.sourceCourseLabel,
            plannerWarnings: rule.plannerWarnings,
            notes: rule.notes,
          })),
      },
      null,
      2
    )
  );
}

const appliedMathPlan = getTransferPlannerMajorPlan("uw-seattle-applied-mathematics");
if (appliedMathPlan) {
  const track = {
    id: "test-apmath-general-education-placeholders",
    code: "TEST-APMATH",
    title: "Applied Mathematics placeholder track",
    summary: "Synthetic Applied Mathematics placeholder-only track for planner tests.",
    bestFor: ["testing"],
    terms: [
      {
        label: "Year 1 Fall",
        courses: ["Humanities", "Social Science", "Humanities or Social Science"],
      },
    ],
    notes: [],
  };
  console.log(
    JSON.stringify(
      {
        planId: appliedMathPlan.id,
        requirementTargets: buildGeneralEducationRequirementTargets(appliedMathPlan),
        suggestedQuarterPlan: buildSuggestedQuarterPlan({
          plan: appliedMathPlan,
          applicationStatuses: [],
          beforeEnrollmentStatuses: [],
          stayAtGrcStatuses: [],
          completedCourses: [],
          track,
          includeStayAtGrcCourses: true,
          referenceDate: new Date("2026-01-15T12:00:00.000Z"),
        }),
      },
      null,
      2
    )
  );
}

const americanEthnicStudiesRuntimePlan = getTransferPlannerStudentRuntimeMajorPlan(
  "uw-seattle-american-ethnic-studies"
);
if (americanEthnicStudiesRuntimePlan) {
  console.log(
    JSON.stringify(
      {
        planId: americanEthnicStudiesRuntimePlan.id,
        requirementTargets: buildGeneralEducationRequirementTargets(americanEthnicStudiesRuntimePlan),
        quarterPlan: buildSuggestedQuarterPlan({
          plan: americanEthnicStudiesRuntimePlan,
          applicationStatuses: buildRequirementStatuses(
            americanEthnicStudiesRuntimePlan.applicationChecklist,
            []
          ),
          beforeEnrollmentStatuses: buildRequirementStatuses(
            americanEthnicStudiesRuntimePlan.beforeEnrollmentChecklist,
            []
          ),
          stayAtGrcStatuses: buildRequirementStatuses(
            americanEthnicStudiesRuntimePlan.stayAtGrcChecklist,
            []
          ),
          completedCourses: [],
          track: getTransferPlannerTrack(americanEthnicStudiesRuntimePlan.bestTrackId ?? null),
          includeStayAtGrcCourses: true,
          referenceDate: new Date("2026-01-15T12:00:00.000Z"),
        }),
      },
      null,
      2
    )
  );
}
