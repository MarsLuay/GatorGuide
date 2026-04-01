import assert from "node:assert/strict";
import test from "node:test";

import {
  TRANSFER_PLANNER_MAJOR_PLANS,
  getTransferPlannerTrack,
  type TransferPlannerMajorPlan,
} from "@/constants/transfer-planner-data";
import {
  buildRequirementStatuses,
  buildSuggestedQuarterPlan,
  type TranscriptCourseEntry,
} from "@/services/transfer-planner.service";

function getRequiredPlan(id: string) {
  const plan = TRANSFER_PLANNER_MAJOR_PLANS.find(
    (entry) => entry.id === id
  );
  if (!plan) {
    throw new Error(`Missing transfer planner data for ${id}.`);
  }
  return plan;
}

const compEPlan = getRequiredPlan("uw-seattle-computer-engineering");
const bioEPlan = getRequiredPlan("uw-seattle-bioengineering");
const chemEPlan = getRequiredPlan("uw-seattle-chemical-engineering");
const hcdePlan = getRequiredPlan("uw-seattle-human-centered-design-engineering");

const compETrack = getTransferPlannerTrack(compEPlan.bestTrackId);
const bioETrack = getTransferPlannerTrack(bioEPlan.bestTrackId);
const chemETrack = getTransferPlannerTrack(chemEPlan.bestTrackId);
const hcdeTrack = getTransferPlannerTrack(hcdePlan.bestTrackId);

function buildTranscriptCourses(...codes: string[]): TranscriptCourseEntry[] {
  return codes.map((code) => ({
    code,
    label: code,
  }));
}

function buildCompEStatuses(completedCourses: TranscriptCourseEntry[]) {
  return buildStatuses(compEPlan, completedCourses);
}

function buildCompEQuarterPlan(completedCourses: TranscriptCourseEntry[]) {
  return buildQuarterPlan(compEPlan, compETrack, completedCourses);
}

function findCalcStatus(completedCourses: TranscriptCourseEntry[]) {
  const { applicationStatuses } = buildCompEStatuses(completedCourses);
  const calcStatus = applicationStatuses.find((status) => status.item.id === "calc123");
  assert.ok(calcStatus, "Expected Seattle CompE planner to include calc123.");
  return calcStatus;
}

function getUpcomingCourseLabels(completedCourses: TranscriptCourseEntry[]) {
  return buildCompEQuarterPlan(completedCourses)
    .filter((quarter) => quarter.phase !== "completed")
    .flatMap((quarter) => quarter.courses.map((course) => course.label));
}

function buildStatuses(plan: TransferPlannerMajorPlan, completedCourses: TranscriptCourseEntry[]) {
  return {
    applicationStatuses: buildRequirementStatuses(plan.applicationChecklist, completedCourses),
    beforeEnrollmentStatuses: buildRequirementStatuses(
      plan.beforeEnrollmentChecklist,
      completedCourses
    ),
    stayAtGrcStatuses: buildRequirementStatuses(plan.stayAtGrcChecklist, completedCourses),
  };
}

function buildQuarterPlan(
  plan: TransferPlannerMajorPlan,
  track: ReturnType<typeof getTransferPlannerTrack>,
  completedCourses: TranscriptCourseEntry[]
) {
  const statuses = buildStatuses(plan, completedCourses);
  return buildSuggestedQuarterPlan({
    ...statuses,
    completedCourses,
    track,
    includeStayAtGrcCourses: false,
    referenceDate: new Date("2026-01-15T12:00:00.000Z"),
  });
}

function findStatus(
  plan: TransferPlannerMajorPlan,
  completedCourses: TranscriptCourseEntry[],
  itemId: string
) {
  const statuses = buildStatuses(plan, completedCourses);
  const allStatuses = [
    ...statuses.applicationStatuses,
    ...statuses.beforeEnrollmentStatuses,
    ...statuses.stayAtGrcStatuses,
  ];
  const status = allStatuses.find((entry) => entry.item.id === itemId);
  assert.ok(status, `Expected planner ${plan.id} to include ${itemId}.`);
  return status;
}

test("Seattle CompE accepts MATH& 163 as the Calc III path without scheduling MATH& 254", () => {
  const completedCourses = buildTranscriptCourses("MATH& 151", "MATH& 152", "MATH& 163");
  const calcStatus = findCalcStatus(completedCourses);

  assert.equal(calcStatus.matched, true);
  assert.deepEqual(calcStatus.explicitCourseCodes, ["MATH& 151", "MATH& 152", "MATH& 163"]);

  const upcomingCourseLabels = getUpcomingCourseLabels(completedCourses);
  assert.equal(upcomingCourseLabels.includes("MATH& 254"), false);
  assert.equal(upcomingCourseLabels.includes("MATH& 163"), false);
});

test("Seattle CompE also accepts the older MATH& 153 plus MATH& 254 path", () => {
  const completedCourses = buildTranscriptCourses(
    "MATH& 151",
    "MATH& 152",
    "MATH& 153",
    "MATH& 254"
  );
  const calcStatus = findCalcStatus(completedCourses);

  assert.equal(calcStatus.matched, true);
  assert.deepEqual(calcStatus.explicitCourseCodes, [
    "MATH& 151",
    "MATH& 152",
    "MATH& 153",
    "MATH& 254",
  ]);

  const upcomingCourseLabels = getUpcomingCourseLabels(completedCourses);
  assert.equal(upcomingCourseLabels.includes("MATH& 163"), false);
});

test("Seattle CompE finishes the older path with MATH& 254 when MATH& 153 is already done", () => {
  const completedCourses = buildTranscriptCourses("MATH& 151", "MATH& 152", "MATH& 153");
  const calcStatus = findCalcStatus(completedCourses);

  assert.equal(calcStatus.matched, false);
  assert.deepEqual(calcStatus.explicitCourseCodes, [
    "MATH& 151",
    "MATH& 152",
    "MATH& 153",
    "MATH& 254",
  ]);

  const upcomingCourseLabels = getUpcomingCourseLabels(completedCourses);
  assert.equal(upcomingCourseLabels.includes("MATH& 254"), true);
  assert.equal(upcomingCourseLabels.includes("MATH& 163"), false);
});

test("Seattle CompE defaults to the current MATH& 163 path when only Calc I and II are done", () => {
  const completedCourses = buildTranscriptCourses("MATH& 151", "MATH& 152");
  const calcStatus = findCalcStatus(completedCourses);

  assert.equal(calcStatus.matched, false);
  assert.deepEqual(calcStatus.explicitCourseCodes, ["MATH& 151", "MATH& 152", "MATH& 163"]);

  const upcomingCourseLabels = getUpcomingCourseLabels(completedCourses);
  assert.equal(upcomingCourseLabels.includes("MATH& 163"), true);
  assert.equal(upcomingCourseLabels.includes("MATH& 254"), false);
});

test("HCDE accepts two completed calculus classes without requiring the third one", () => {
  const completedCourses = buildTranscriptCourses("MATH& 151", "MATH& 152");
  const calcStatus = findStatus(hcdePlan, completedCourses, "ten-calc-credits");

  assert.equal(calcStatus.matched, true);
  assert.deepEqual(calcStatus.explicitCourseCodes, ["MATH& 151", "MATH& 152", "MATH& 163"]);

  const upcomingCourseLabels = buildQuarterPlan(hcdePlan, hcdeTrack, completedCourses)
    .filter((quarter) => quarter.phase !== "completed")
    .flatMap((quarter) => quarter.courses.map((course) => course.label));
  assert.equal(upcomingCourseLabels.includes("MATH& 163"), false);
});

test("ChemE asks for CHEM& 163 when the student has only CHEM& 161 and CHEM& 162", () => {
  const completedCourses = buildTranscriptCourses("CHEM& 161", "CHEM& 162");
  const chemStatus = findStatus(chemEPlan, completedCourses, "chem142-162");

  assert.equal(chemStatus.matched, false);
  assert.deepEqual(chemStatus.explicitCourseCodes, [
    "CHEM& 161",
    "CHEM& 162",
    "CHEM& 163",
  ]);

  const upcomingCourseLabels = buildQuarterPlan(chemEPlan, chemETrack, completedCourses)
    .filter((quarter) => quarter.phase !== "completed")
    .flatMap((quarter) => quarter.courses.map((course) => course.label));
  assert.equal(upcomingCourseLabels.includes("CHEM& 163"), true);
  assert.equal(upcomingCourseLabels.includes("CHEM& 162"), false);
});

test("BioE uses the full BIOL& 211-213 sequence for the BIOL 180 pathway", () => {
  const completedCourses = buildTranscriptCourses(
    "MATH& 151",
    "MATH& 152",
    "MATH& 163",
    "CHEM& 161",
    "CHEM& 162",
    "CHEM& 163",
    "PHYS& 221",
    "PHYS& 222",
    "CHEM& 261",
    "ENGR 250",
    "ENGL& 101",
    "BIOL& 211"
  );
  const biologyStatus = findStatus(bioEPlan, completedCourses, "biol180");

  assert.equal(biologyStatus.matched, false);
  assert.deepEqual(biologyStatus.explicitCourseCodes, [
    "BIOL& 211",
    "BIOL& 212",
    "BIOL& 213",
  ]);

  const upcomingCourseLabels = buildQuarterPlan(bioEPlan, bioETrack, completedCourses)
    .filter((quarter) => quarter.phase !== "completed")
    .flatMap((quarter) => quarter.courses.map((course) => course.label));
  const biol212Index = upcomingCourseLabels.indexOf("BIOL& 212");
  const biol213Index = upcomingCourseLabels.indexOf("BIOL& 213");

  assert.notEqual(biol212Index, -1);
  assert.notEqual(biol213Index, -1);
  assert.equal(biol212Index < biol213Index, true);
});
