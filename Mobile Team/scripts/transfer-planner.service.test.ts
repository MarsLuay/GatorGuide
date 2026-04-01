import assert from "node:assert/strict";
import test from "node:test";

import {
  TRANSFER_PLANNER_ALL_MAJOR_PLANS,
  TRANSFER_PLANNER_MAJOR_PLANS,
  getTransferPlannerGrcCourseList,
  getTransferPlannerMajorsForCampus,
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
const ecePlan = getRequiredPlan("uw-seattle-electrical-computer-engineering");
const civilPlan = getRequiredPlan("uw-seattle-civil-engineering");
const isePlan = getRequiredPlan("uw-seattle-industrial-systems-engineering");
const msePlan = getRequiredPlan("uw-seattle-materials-science-engineering");
const envePlan = getRequiredPlan("uw-seattle-environmental-engineering");
const bioEPlan = getRequiredPlan("uw-seattle-bioengineering");
const chemEPlan = getRequiredPlan("uw-seattle-chemical-engineering");
const hcdePlan = getRequiredPlan("uw-seattle-human-centered-design-engineering");

const compETrack = getTransferPlannerTrack(compEPlan.bestTrackId);
const bioETrack = getTransferPlannerTrack(bioEPlan.bestTrackId);
const chemETrack = getTransferPlannerTrack(chemEPlan.bestTrackId);
const hcdeTrack = getTransferPlannerTrack(hcdePlan.bestTrackId);
const bothellCssePlan = getTransferPlannerMajorsForCampus("uw-bothell").find(
  (entry) => entry.id === "uw-bothell-csse"
);
const bothellCsseTrack = getTransferPlannerTrack(bothellCssePlan?.bestTrackId ?? null);
const generatedPlan = TRANSFER_PLANNER_ALL_MAJOR_PLANS.find(
  (entry) => entry.sourceType === "master-generated"
);
const tacomaCompEPlan = getTransferPlannerMajorsForCampus("uw-tacoma").find(
  (entry) => entry.id === "uw-tacoma-computer-engineering"
);
const tacomaCompETrack = getTransferPlannerTrack(tacomaCompEPlan?.bestTrackId ?? null);
const tacomaEePlan = getTransferPlannerMajorsForCampus("uw-tacoma").find(
  (entry) => entry.id === "uw-tacoma-electrical-engineering"
);
const tacomaEeTrack = getTransferPlannerTrack(tacomaEePlan?.bestTrackId ?? null);

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

test("HCDE accepts the full biology sequence as an alternate science bundle", () => {
  const completedCourses = buildTranscriptCourses("BIOL& 211", "BIOL& 212", "BIOL& 213");
  const scienceStatus = findStatus(hcdePlan, completedCourses, "science-three");

  assert.equal(scienceStatus.matched, true);
  assert.deepEqual(scienceStatus.explicitCourseCodes, [
    "BIOL& 211",
    "BIOL& 212",
    "BIOL& 213",
  ]);
});

test("HCDE now exposes structured degree-map sections and engineering-fundamentals head starts", () => {
  assert.ok(hcdePlan.degreeMapSections, "Expected Seattle HCDE to include degree-map sections.");
  assert.equal(hcdePlan.degreeMapSections.length >= 4, true);
  assert.equal(hcdePlan.degreeMapSections[0]?.title, "HCDE degree structure");

  const grcCourseList = getTransferPlannerGrcCourseList(hcdePlan);

  assert.equal(grcCourseList.includes("ENGR 250"), true);
  assert.equal(grcCourseList.includes("ENGR& 214"), true);
  assert.equal(grcCourseList.includes("ENGR& 225"), true);
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

test("ChemE now exposes structured degree-map sections without treating UW-only cohort courses as GRC equivalents", () => {
  assert.ok(chemEPlan.degreeMapSections, "Expected Seattle ChemE to include degree-map sections.");
  assert.equal(chemEPlan.degreeMapSections.length >= 4, true);
  assert.equal(chemEPlan.degreeMapSections[0]?.title, "ChemE degree structure");

  const grcCourseList = getTransferPlannerGrcCourseList(chemEPlan);

  assert.equal(grcCourseList.includes("ENGR 250"), true);
  assert.equal(grcCourseList.includes("MATH& 254"), true);
  assert.equal(grcCourseList.includes("CHEM E 310"), false);
  assert.equal(grcCourseList.includes("CHEM E 375"), false);
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

test("BioE treats ENGR 250 as the cleanest Green River programming requirement", () => {
  const completedCourses = buildTranscriptCourses(
    "MATH& 151",
    "MATH& 152",
    "MATH& 163",
    "CHEM& 161",
    "CHEM& 162",
    "CHEM& 163",
    "PHYS& 221",
    "PHYS& 222",
    "BIOL& 211",
    "BIOL& 212",
    "BIOL& 213",
    "CHEM& 261",
    "CS 121",
    "CS 122",
    "CS 123",
    "ENGL& 101"
  );
  const programmingStatus = findStatus(bioEPlan, completedCourses, "programming");

  assert.equal(programmingStatus.matched, false);
  assert.deepEqual(programmingStatus.explicitCourseCodes, ["ENGR 250"]);

  const upcomingCourseLabels = buildQuarterPlan(bioEPlan, bioETrack, completedCourses)
    .filter((quarter) => quarter.phase !== "completed")
    .flatMap((quarter) => quarter.courses.map((course) => course.label));

  assert.equal(upcomingCourseLabels.includes("ENGR 250"), true);
});

test("BioE now exposes structured degree-map sections", () => {
  assert.ok(bioEPlan.degreeMapSections, "Expected Seattle BioE to include degree-map sections.");
  assert.equal(bioEPlan.degreeMapSections.length >= 3, true);
  assert.equal(bioEPlan.degreeMapSections[0]?.title, "BioE engineering fundamentals");
});

test("Detailed majors expose an explicit per-major Green River course list", () => {
  const grcCourseList = getTransferPlannerGrcCourseList(compEPlan);

  assert.ok(grcCourseList.length > 0);
  assert.equal(grcCourseList.includes("CS 121"), true);
  assert.equal(grcCourseList.includes("MATH& 151"), true);
  assert.equal(grcCourseList.includes("CHEM& 161"), true);
  assert.equal(new Set(grcCourseList).size, grcCourseList.length);
});

test("Seattle ECE now exposes structured degree-map sections", () => {
  assert.ok(ecePlan.degreeMapSections, "Expected Seattle ECE to include degree-map sections.");
  assert.equal(ecePlan.degreeMapSections.length >= 3, true);
  assert.equal(ecePlan.degreeMapSections[0]?.title, "BSECE degree structure");
});

test("Seattle Civil now tracks BSCE degree-map head starts at Green River", () => {
  const grcCourseList = getTransferPlannerGrcCourseList(civilPlan);

  assert.equal(grcCourseList.includes("ENGL 128"), true);
  assert.equal(grcCourseList.includes("ECON& 201"), true);
  assert.equal(grcCourseList.includes("MATH 238"), true);
});

test("Seattle Environmental Engineering now includes optional AUT25 degree-sheet add-ons", () => {
  const grcCourseList = getTransferPlannerGrcCourseList(envePlan);

  assert.ok(envePlan.degreeMapSections, "Expected Seattle EnvE to include degree-map sections.");
  assert.equal(grcCourseList.includes("ECON& 201"), true);
  assert.equal(grcCourseList.includes("MATH 240"), true);
  assert.equal(grcCourseList.includes("CHEM& 163"), true);
});

test("Seattle ISE and MSE expose deeper degree-map data from the latest extraction pass", () => {
  assert.ok(isePlan.degreeMapSections, "Expected Seattle ISE to include degree-map sections.");
  assert.ok(msePlan.degreeMapSections, "Expected Seattle MSE to include degree-map sections.");

  const iseCourseList = getTransferPlannerGrcCourseList(isePlan);
  const mseCourseList = getTransferPlannerGrcCourseList(msePlan);

  assert.equal(iseCourseList.includes("ENGL 128"), true);
  assert.equal(mseCourseList.includes("MATH& 254"), true);
  assert.equal(mseCourseList.includes("ENGR& 224"), true);
});

test("Master-generated partial majors also materialize a Green River course list", () => {
  assert.ok(generatedPlan, "Expected at least one master-generated planner row.");

  const grcCourseList = getTransferPlannerGrcCourseList(generatedPlan);

  assert.ok(grcCourseList.length > 0);
  assert.equal(new Set(grcCourseList).size, grcCourseList.length);
});

test("Bothell CSSE accepts the public two-course calculus and programming minimums", () => {
  assert.ok(bothellCssePlan, "Expected a Bothell CSSE planner row.");
  assert.ok(bothellCsseTrack, "Expected a Bothell CSSE track.");

  const completedCourses = buildTranscriptCourses(
    "MATH& 151",
    "MATH& 152",
    "CS 121",
    "CS 122",
    "ENGL& 101"
  );

  const calcStatus = findStatus(bothellCssePlan, completedCourses, "bothell-csse-calc");
  const programmingStatus = findStatus(bothellCssePlan, completedCourses, "bothell-csse-cs");

  assert.equal(calcStatus.matched, true);
  assert.equal(programmingStatus.matched, true);

  const upcomingCourseLabels = buildQuarterPlan(bothellCssePlan, bothellCsseTrack, completedCourses)
    .filter((quarter) => quarter.phase !== "completed")
    .flatMap((quarter) => quarter.courses.map((course) => course.label));

  assert.equal(upcomingCourseLabels.includes("MATH& 163"), true);
  assert.equal(upcomingCourseLabels.includes("CS 123"), true);
});

test("Tacoma CompE now requires differential equations and circuit prep in the planner", () => {
  assert.ok(tacomaCompEPlan, "Expected a Tacoma CompE planner row.");
  assert.ok(tacomaCompETrack, "Expected a Tacoma CompE track.");

  const completedCourses = buildTranscriptCourses(
    "MATH& 151",
    "MATH& 152",
    "MATH& 163",
    "PHYS& 221",
    "PHYS& 222",
    "CS 121",
    "CS 122",
    "ENGL& 101"
  );

  const math207Status = findStatus(tacomaCompEPlan, completedCourses, "tacoma-compe-math207");
  const circuitsStatus = findStatus(tacomaCompEPlan, completedCourses, "tacoma-compe-circuits");

  assert.equal(math207Status.matched, false);
  assert.equal(circuitsStatus.matched, false);

  const upcomingCourseLabels = buildQuarterPlan(tacomaCompEPlan, tacomaCompETrack, completedCourses)
    .filter((quarter) => quarter.phase !== "completed")
    .flatMap((quarter) => quarter.courses.map((course) => course.label));

  assert.equal(upcomingCourseLabels.includes("MATH 238"), true);
  assert.equal(upcomingCourseLabels.includes("ENGR& 204"), true);
});

test("Tacoma EE accepts one programming course but still recommends a second one", () => {
  assert.ok(tacomaEePlan, "Expected a Tacoma EE planner row.");
  assert.ok(tacomaEeTrack, "Expected a Tacoma EE track.");

  const completedCourses = buildTranscriptCourses(
    "MATH& 151",
    "MATH& 152",
    "MATH& 163",
    "MATH 238",
    "PHYS& 221",
    "PHYS& 222",
    "CS 121",
    "ENGR& 204",
    "ENGL& 101"
  );

  const firstProgrammingStatus = findStatus(
    tacomaEePlan,
    completedCourses,
    "tacoma-ee-programming1"
  );
  const secondProgrammingStatus = findStatus(
    tacomaEePlan,
    completedCourses,
    "tacoma-ee-programming2"
  );

  assert.equal(firstProgrammingStatus.matched, true);
  assert.equal(secondProgrammingStatus.matched, false);
});
