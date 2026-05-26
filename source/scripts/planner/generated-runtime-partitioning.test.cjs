require("ts-node").register({
  skipProject: true,
  transpileOnly: true,
  compilerOptions: {
    module: "CommonJS",
    moduleResolution: "node",
    jsx: "react-jsx",
    baseUrl: ".",
    paths: {
      "@/*": ["./*"],
    },
  },
});
require("tsconfig-paths/register");

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const generatedRuntime = require("@/constants/transfer-planner-source/student-runtime.generated");
const studentRuntime = require("@/constants/transfer-planner-source/student-runtime");
const courseMetadataGenerated = require("@/constants/transfer-planner-source/course-metadata.generated");
const requirementSourceAdapters = require("@/constants/transfer-planner-source/requirement-source-adapters.generated");

const RUNTIME_DIR = path.resolve(
  __dirname,
  "../../constants/transfer-planner-source/student-runtime.generated"
);
const SOURCE_GENERATED_DIR = path.resolve(
  __dirname,
  "../../constants/transfer-planner-source"
);
const COURSE_METADATA_DIR = path.join(SOURCE_GENERATED_DIR, "course-metadata.generated");
const REQUIREMENT_ADAPTER_DIR = path.join(
  SOURCE_GENERATED_DIR,
  "requirement-source-adapters.generated"
);
const MB = 1024 * 1024;

function listRuntimeFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    return entry.isDirectory() ? listRuntimeFiles(fullPath) : [fullPath];
  });
}

test("generated runtime stores large planner collections in campus and plan partitions", () => {
  for (const fileName of [
    "major-plans.generated.json",
    "pathways-by-plan-id.generated.json",
    "primary-degree-sources-by-key.generated.json",
    "resolved-major-plans-by-key.generated.json",
    "parsed-requirement-block-registry.generated.json",
    "parsed-requirement-source-block-registry.generated.json",
  ]) {
    assert.equal(
      fs.existsSync(path.join(RUNTIME_DIR, fileName)),
      false,
      `${fileName} should stay partitioned instead of returning as a monolith`
    );
  }
  assert.equal(
    fs.existsSync(path.join(RUNTIME_DIR, "major-plans-by-campus")),
    false,
    "major plans should be plan-level chunks, not campus-level blobs"
  );

  for (const dirName of [
    "major-plans-by-plan-id",
    "pathways-by-plan-id",
    "primary-degree-sources-by-plan-id",
    "resolved-major-plans-by-plan-id",
    "parsed-requirement-blocks-by-plan-id",
  ]) {
    assert.equal(fs.statSync(path.join(RUNTIME_DIR, dirName)).isDirectory(), true);
  }

  const partitionedFiles = listRuntimeFiles(RUNTIME_DIR).filter((filePath) =>
    /(?:major-plans-by-plan-id|pathways-by-plan-id|primary-degree-sources-by-plan-id|resolved-major-plans-by-plan-id|parsed-requirement-blocks-by-plan-id)/.test(
      filePath
    )
  );
  const largestPlanPartitionBytes = Math.max(
    ...partitionedFiles.map((filePath) => fs.statSync(filePath).size)
  );
  assert.ok(
    largestPlanPartitionBytes < 5 * MB,
    `largest plan-level runtime partition is ${Math.round(largestPlanPartitionBytes / MB)}MB`
  );

  const majorPlanPartitionFiles = listRuntimeFiles(
    path.join(RUNTIME_DIR, "major-plans-by-plan-id")
  );
  const largestMajorPlanPartitionBytes = Math.max(
    ...majorPlanPartitionFiles.map((filePath) => fs.statSync(filePath).size)
  );
  assert.ok(
    largestMajorPlanPartitionBytes < MB,
    `largest major-plan runtime partition is ${Math.round(largestMajorPlanPartitionBytes / MB)}MB`
  );

  const campusIndexPath = path.join(RUNTIME_DIR, "major-plan-ids-by-campus.generated.json");
  assert.equal(fs.existsSync(campusIndexPath), true);
  assert.ok(
    fs.statSync(campusIndexPath).size < 100 * 1024,
    "major plan campus lookup should stay as a small id index"
  );
});

test("generated course metadata is indexed into small lazy JSON partitions", () => {
  assert.equal(
    fs.existsSync(path.join(SOURCE_GENERATED_DIR, "course-metadata.generated.data.json")),
    false,
    "course metadata should not be emitted as one monolithic JSON blob"
  );
  assert.equal(
    fs.existsSync(path.join(COURSE_METADATA_DIR, "partition-index.generated.json")),
    true
  );

  const metadataFiles = listRuntimeFiles(COURSE_METADATA_DIR);
  const largestMetadataPartitionBytes = Math.max(
    ...metadataFiles.map((filePath) => fs.statSync(filePath).size)
  );
  assert.ok(
    largestMetadataPartitionBytes < MB,
    `largest course metadata partition is ${Math.round(largestMetadataPartitionBytes / MB)}MB`
  );

  const calculus = courseMetadataGenerated.getTransferPlannerGeneratedCourseMetadataEntry(
    "grc",
    "MATH& 151"
  );
  assert.equal(calculus?.schoolId, "grc");
  assert.equal(calculus?.code, "MATH& 151");
});

test("requirement source adapters use block-level JSON partitions behind a plan accessor", () => {
  const staleTsChunks = listRuntimeFiles(REQUIREMENT_ADAPTER_DIR).filter((filePath) =>
    /\.generated\.ts$/i.test(filePath)
  );
  assert.deepEqual(staleTsChunks, []);
  assert.equal(
    fs.statSync(path.join(REQUIREMENT_ADAPTER_DIR, "blocks-by-block-id")).isDirectory(),
    true
  );

  const adapterFiles = listRuntimeFiles(REQUIREMENT_ADAPTER_DIR);
  const largestAdapterPartitionBytes = Math.max(
    ...adapterFiles.map((filePath) => fs.statSync(filePath).size)
  );
  assert.ok(
    largestAdapterPartitionBytes < 2 * MB,
    `largest requirement-source adapter partition is ${Math.round(largestAdapterPartitionBytes / MB)}MB`
  );

  const computerScienceBlocks =
    requirementSourceAdapters.getTransferPlannerParsedRequirementBlocksForPlanId(
      "uw-seattle-computer-science"
    );
  assert.ok(computerScienceBlocks.length > 0);
  assert.ok(
    computerScienceBlocks.every((block) => block.planId === "uw-seattle-computer-science")
  );
});

test("generated runtime partition accessors return scoped data", () => {
  const planId = "uw-seattle-computer-science";
  const pathwayId = "data-science-option";

  const seattlePlans = generatedRuntime.getTransferPlannerRuntimeMajorPlansForCampus("uw-seattle");
  assert.ok(seattlePlans.length > 0);
  assert.ok(seattlePlans.every((plan) => plan.campusId === "uw-seattle"));

  const seattlePlanIds = generatedRuntime.getTransferPlannerRuntimeMajorPlanIdsForCampus(
    "uw-seattle"
  );
  assert.ok(seattlePlanIds.includes(planId));

  const computerScience = generatedRuntime.getTransferPlannerRuntimeMajorPlanById(planId);
  assert.equal(computerScience?.id, planId);
  assert.equal(computerScience?.campusId, "uw-seattle");

  const pathways = generatedRuntime.getTransferPlannerRuntimePathwaysForPlanId(planId);
  assert.ok(pathways.some((pathway) => pathway.id === pathwayId));

  const resolvedPlan = generatedRuntime.getTransferPlannerRuntimeResolvedMajorPlanByKey(
    `${planId}::${pathwayId}`
  );
  assert.equal(resolvedPlan?.id, planId);
  assert.equal(resolvedPlan?.selectedPathwayId, pathwayId);

  const primarySource = generatedRuntime.getTransferPlannerRuntimePrimaryDegreeSourceByKey(
    `${planId}::${pathwayId}`
  );
  assert.match(primarySource?.url ?? "", /^https?:\/\//);

  const sourceBlocks = generatedRuntime.getTransferPlannerRuntimeParsedRequirementBlocksForPlanId(
    planId
  );
  assert.ok(sourceBlocks.length > 0);
  assert.ok(sourceBlocks.every((block) => block.planId === planId));
});

test("student runtime uses partitioned accessors for common campus and plan lookups", () => {
  const planId = "uw-seattle-computer-science";
  const pathwayId = "data-science-option";

  const seattleMajors = studentRuntime.getTransferPlannerStudentRuntimeMajorsForCampus(
    "uw-seattle"
  );
  assert.ok(seattleMajors.some((plan) => plan.id === planId));

  const plan = studentRuntime.getTransferPlannerMajorPlan(planId);
  assert.equal(plan?.id, planId);

  const pathways = studentRuntime.getTransferPlannerStudentRuntimePathwaysForPlan(plan);
  assert.ok(pathways.some((pathway) => pathway.id === pathwayId));

  const resolvedPlan = studentRuntime.resolveTransferPlannerStudentRuntimeMajorPlan(
    plan,
    pathwayId
  );
  assert.equal(resolvedPlan?.selectedPathwayId, pathwayId);

  const sourceBlocks = studentRuntime.getTransferPlannerParsedRequirementSourceBlocks(
    planId,
    pathwayId
  );
  assert.ok(sourceBlocks.length > 0);
  assert.ok(sourceBlocks.every((block) => block.planId === planId));
});
