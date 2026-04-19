// Enumerate runtime planner rows that would render the exact UW quarter-plan note
require("ts-node").register({
  skipProject: true,
  transpileOnly: true,
  compilerOptions: { module: "CommonJS", moduleResolution: "node" },
});

const path = require("path");
const fs = require("fs");

const tp = require("../constants/transfer-planner-source");

// Minimal local helpers copied from transfer-planner.service to avoid path-alias import issues
const COURSE_CODE_PATTERN = /\b[A-Z]{2,6}&?\s*\d{3}(?:\.\d+)?[A-Z]?\b/g;
const LEGACY_COURSE_CODE_ALIASES = new Map([["MATH& 254", "MATH& 264"]]);

function normalizeCourseCode(value) {
  const normalized = String(value ?? "").trim().toUpperCase().replace(/\s+/g, " ");
  return LEGACY_COURSE_CODE_ALIASES.get(normalized) ?? normalized;
}

function extractCourseCodes(value) {
  return Array.from(new Set((String(value ?? "").toUpperCase().match(COURSE_CODE_PATTERN) ?? []).map((m) => normalizeCourseCode(m))));
}

const OUT = path.resolve(__dirname, "quarter-note-results.json");

const UW_CAMPUSES = ["uw-seattle", "uw-bothell", "uw-tacoma"];

const exactBodyMessage =
  "This degree does not have a fixed quarter-by-quarter plan yet. Use the Green River class list and source-backed class-order notes above as your starting point. This planner only shows a source-backed plan, and unsupported majors, rules, or sequences stay hidden until public sources can verify them.";

function appendUniqueCourseCode(ordered, seen, code) {
  const normalized = String(normalizeCourseCode(code ?? "")).trim();
  if (!normalized || seen.has(normalized)) return;
  seen.add(normalized);
  ordered.push(normalized);
}

function appendUniqueCourseCodesFromLabels(ordered, seen, labels) {
  for (const label of labels ?? []) {
    const extracted = extractCourseCodes(String(label ?? ""));
    if (extracted && extracted.length) {
      for (const c of extracted) appendUniqueCourseCode(ordered, seen, c);
      continue;
    }
    appendUniqueCourseCode(ordered, seen, label);
  }
}

function getPreferredAlternativeCourseSet(alternativeCourseCodeSets, preferredSet) {
  if (!alternativeCourseCodeSets || !alternativeCourseCodeSets.length) return [];
  const found = alternativeCourseCodeSets.find((set) =>
    set.some((code) => preferredSet.has(String(normalizeCourseCode(code))))
  );
  return found ?? (alternativeCourseCodeSets[0] ?? []);
}

function buildRequiredPlannerCourseCodes(plan) {
  const ordered = [];
  const seen = new Set();
  const checklistItems = [...(plan.applicationChecklist || []), ...(plan.beforeEnrollmentChecklist || [])];

  for (const item of checklistItems) {
    appendUniqueCourseCodesFromLabels(ordered, seen, item.grcCourses ?? []);
  }

  const preferredPlanCourseCodes = new Set(
    (plan.grcCourseList || [])
      .flatMap((entry) => extractCourseCodes(String(entry ?? "")))
      .map((c) => String(normalizeCourseCode(c)))
      .filter(Boolean)
  );

  const classifications = Array.isArray(tp.getTransferPlannerRequirementDiffClassifications)
    ? tp.getTransferPlannerRequirementDiffClassifications(plan.id, plan.selectedPathwayId)
    : [];

  for (const classification of classifications || []) {
    if (classification.displayPhase === "stay-at-grc") continue;
    appendUniqueCourseCodesFromLabels(ordered, seen, classification.grcCourseCodes ?? []);
    appendUniqueCourseCodesFromLabels(
      ordered,
      seen,
      getPreferredAlternativeCourseSet(classification.alternativeCourseCodeSets ?? [], preferredPlanCourseCodes)
    );
  }

  if (!ordered.length) {
    appendUniqueCourseCodesFromLabels(ordered, seen, plan.grcCourseList ?? []);
  }

  return ordered;
}

function hasAnyDirectMajorEquivalencies(plan) {
  if (!plan) return false;
  const required = buildRequiredPlannerCourseCodes(plan);
  if (!required.length) return false;

  for (const courseCode of required) {
    const rules = tp.getTransferPlannerEquivalencyRulesForSourceCourse(String(courseCode ?? "")) || [];
    for (const rule of rules) {
      if (!Array.isArray(rule.targetSchoolIds)) continue;
      if (!rule.targetSchoolIds.includes(plan.campusId)) continue;
      if (rule.acceptanceCategory === "no-credit") continue;
      if (rule.type === "elective-credit" || rule.type === "limited-credit") continue;
      return true;
    }
  }

  return false;
}

const results = {
  byCampus: {},
  totals: {
    totalMatchingRows: 0,
    matchingMajorsCount: 0,
    matchingPathwaysCount: 0,
    countByCampus: {},
  },
  similarButNotExact: [],
};

for (const campusId of UW_CAMPUSES) {
  const rows = [];
  const majors = tp.getTransferPlannerMajorsForCampus(campusId) || [];

  for (const generatedPlan of majors) {
    const planId = generatedPlan.id;
    const runtimePlan = tp.getTransferPlannerStudentRuntimeMajorPlan(planId) || null;

    // plan-level checks
    if (runtimePlan) {
      const hasStructured =
        (runtimePlan.applicationChecklist || []).length > 0 ||
        (runtimePlan.beforeEnrollmentChecklist || []).length > 0 ||
        (runtimePlan.stayAtGrcChecklist || []).length > 0;

      const anyDirect = hasAnyDirectMajorEquivalencies(runtimePlan);
      const hasNoDirect = !anyDirect;

      const showUwUiMessage = !hasStructured && !hasNoDirect; // runtimePlan exists and is UW campus

      const runtimePlannerNote = String(runtimePlan.plannerNote ?? "").trim();
      const runtimePlannerNoteExact = runtimePlannerNote === exactBodyMessage;
      const runtimePlannerNoteSimilar = /does not have a fixed quarter-by-quarter plan yet/i.test(runtimePlannerNote);

      if (showUwUiMessage || runtimePlannerNoteExact) {
        rows.push({
          ownerId: runtimePlan.id,
          planId: runtimePlan.id,
          pathwayId: null,
          title: runtimePlan.title,
          campus: runtimePlan.campusId,
          coverage: runtimePlan.coverage ?? null,
          rowKind: "major",
          noteSource: runtimePlannerNoteExact ? "runtime-plannerNote-field" : "ui-fallback",
          plannerNoteField: runtimePlan.plannerNote ?? null,
        });

        results.totals.totalMatchingRows += 1;
        results.totals.matchingMajorsCount += 1;
      } else if (runtimePlannerNoteSimilar) {
        results.similarButNotExact.push({
          ownerId: runtimePlan.id,
          planId: runtimePlan.id,
          pathwayId: null,
          title: runtimePlan.title,
          campus: runtimePlan.campusId,
          coverage: runtimePlan.coverage ?? null,
          rowKind: "major",
          plannerNoteField: runtimePlan.plannerNote ?? null,
        });
      }

      // pathway-level rows: include them if the plan-level UI would render the UW message
      const runtimePathways = tp.getTransferPlannerStudentRuntimePathwaysForPlan(runtimePlan) || [];
      for (const pathway of runtimePathways) {
        const pathwayNote = String(pathway.plannerNote ?? "").trim();
        const pathwayNoteExact = pathwayNote === exactBodyMessage;
        const pathwayNoteSimilar = /\bdoes not have a fixed quarter-by-quarter plan yet/i.test(pathwayNote);

        if (showUwUiMessage || pathwayNoteExact) {
          rows.push({
            ownerId: `${runtimePlan.id}::${pathway.id}`,
            planId: runtimePlan.id,
            pathwayId: pathway.id,
            title: `${runtimePlan.title} - ${pathway.label}`,
            campus: runtimePlan.campusId,
            coverage: runtimePlan.coverage ?? null,
            rowKind: "pathway",
            noteSource: pathwayNoteExact ? "runtime-plannerNote-field" : showUwUiMessage ? "ui-fallback" : "other",
            plannerNoteField: pathway.plannerNote ?? null,
          });

          results.totals.totalMatchingRows += 1;
          results.totals.matchingPathwaysCount += 1;
        } else if (pathwayNoteSimilar) {
          results.similarButNotExact.push({
            ownerId: `${runtimePlan.id}::${pathway.id}`,
            planId: runtimePlan.id,
            pathwayId: pathway.id,
            title: `${runtimePlan.title} - ${pathway.label}`,
            campus: runtimePlan.campusId,
            coverage: runtimePlan.coverage ?? null,
            rowKind: "pathway",
            plannerNoteField: pathway.plannerNote ?? null,
          });
        }
      }
    }
  }

  results.byCampus[campusId] = rows;
  results.totals.countByCampus[campusId] = rows.length;
}

fs.writeFileSync(OUT, JSON.stringify(results, null, 2) + "\n", "utf8");
console.log(JSON.stringify(results, null, 2));
process.exit(0);
