import {
  assert,
  collectProjectTextFiles,
  copyFileSync,
  escapeRegExp,
  existsSync,
  hcdePlan,
  join,
  LEGACY_PLANNER_DATA_MODULE_NAME,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  seattleAcePlan,
  seattleAmericanIndianStudiesPlan,
  seattleArchitecturalDesignPlan,
  seattleArchitecturalStudiesPlan,
  seattleArtHistoryPlan,
  seattleArtPlan,
  seattleAsianLanguagesPlan,
  seattleAsianStudiesPlan,
  seattleCepPlan,
  seattleChinesePlan,
  seattleChiPlan,
  seattleCinemaMediaStudiesPlan,
  seattleClassicalStudiesPlan,
  seattleClassicsPlan,
  seattleCommunicationPlan,
  seattleComparativeLiteraturePlan,
  seattleComparativeReligionPlan,
  seattleConstructionManagementPlan,
  seattleStatisticsPlan,
  spawnSync,
  test,
  tmpdir,
  TRANSFER_PLANNER_GRC_COURSE_AVAILABILITY,
  TRANSFER_PLANNER_GRC_COURSE_AVAILABILITY_SOURCE_URLS,
  TRANSFER_PLANNER_PARSED_REQUIREMENT_SOURCE_BLOCKS,
  TRANSFER_PLANNER_REQUIREMENT_DIFF_CLASSIFICATION_REGISTRY_SUMMARY,
  TRANSFER_PLANNER_REQUIREMENT_SOURCE_ADAPTER_SUMMARY,
  writeFileSync,
} from "./transfer-planner.test-support";

test("Next Seattle planner-note hardening batch removes support-only phrasing (HCDE through Asian Studies)", () => {
  const hardenedPlans = [
    hcdePlan,
    seattleStatisticsPlan,
    seattleAmericanIndianStudiesPlan,
    seattleAcePlan,
    seattleArchitecturalDesignPlan,
    seattleArchitecturalStudiesPlan,
    seattleArtPlan,
    seattleArtHistoryPlan,
    seattleAsianLanguagesPlan,
    seattleAsianStudiesPlan,
  ];

  for (const plan of hardenedPlans) {
    assert.ok(plan, "Expected Seattle planner row to exist for planner-note hardening.");
    assert.equal(plan.coverage, "detailed");
    assert.doesNotMatch(String(plan.summary ?? ""), /advisor|adviser|manual review/i);
  }
});

test("Next Seattle planner-note hardening batch removes support-only phrasing (Chinese through Construction Management)", () => {
  const hardenedPlans = [
    seattleChinesePlan,
    seattleCinemaMediaStudiesPlan,
    seattleClassicalStudiesPlan,
    seattleClassicsPlan,
    seattleCommunicationPlan,
    seattleCepPlan,
    seattleChiPlan,
    seattleComparativeLiteraturePlan,
    seattleComparativeReligionPlan,
    seattleConstructionManagementPlan,
  ];

  for (const plan of hardenedPlans) {
    assert.ok(plan, "Expected Seattle planner row to exist for planner-note hardening.");
    assert.equal(plan.coverage, "detailed");
    assert.doesNotMatch(String(plan.summary ?? ""), /advisor|adviser|manual review/i);
  }
});

test("Generated Green River availability statuses now fully replace manual-review notes", () => {
  const countsByStatus = Object.values(TRANSFER_PLANNER_GRC_COURSE_AVAILABILITY).reduce(
    (counts, entry) => {
      counts[entry.status] = (counts[entry.status] ?? 0) + 1;
      return counts;
    },
    {} as Record<string, number>
  );

  assert.deepEqual(Object.keys(countsByStatus).sort(), [
    "catalog-listed-not-in-latest-schedules",
    "planner-course-no-current-public-source",
    "published-in-latest-schedule",
    "published-in-recent-history-not-latest",
  ]);
  assert.equal(
    Object.values(countsByStatus).reduce((sum, count) => sum + count, 0),
    Object.keys(TRANSFER_PLANNER_GRC_COURSE_AVAILABILITY).length
  );
  assert.ok((countsByStatus["published-in-latest-schedule"] ?? 0) > 0);
  assert.ok((countsByStatus["published-in-recent-history-not-latest"] ?? 0) > 0);
  assert.ok((countsByStatus["catalog-listed-not-in-latest-schedules"] ?? 0) > 0);
  assert.ok((countsByStatus["planner-course-no-current-public-source"] ?? 0) > 0);

  assert.equal(
    JSON.stringify(TRANSFER_PLANNER_GRC_COURSE_AVAILABILITY).includes("manual-review"),
    false
  );
  assert.equal(
    JSON.stringify(TRANSFER_PLANNER_GRC_COURSE_AVAILABILITY).includes("Confirm current availability"),
    false
  );
});

test("Phase 10 refresh pipeline is the single rebuild and verification entry point", () => {
  const refreshScript = readFileSync(
    "scripts/planner/refresh-transfer-planner-sources.cjs",
    "utf8"
  );
  const requiredPipelineScripts = [
    "scripts/planner/check-transfer-planner-sources.cjs",
    "scripts/planner/discover-transfer-planner-primary-sources.cjs",
    "scripts/planner/build-transfer-planner-source-gap-report.cjs",
    "scripts/planner/parse-transfer-planner-requirement-sources.cjs",
    "scripts/planner/build-transfer-planner-source-fingerprints.cjs",
    "scripts/planner/build-transfer-planner-requirement-diff-report.cjs",
    "scripts/planner/generate-transfer-planner-source-bootstrap.cjs",
    "scripts/planner/parse-transfer-planner-equivalency-guide.cjs",
    "scripts/planner/ingest-grc-catalog.cjs",
    "scripts/planner/ingest-uw-catalog.cjs",
    "scripts/planner/generate-transfer-planner-course-metadata.cjs",
    "scripts/planner/generate-transfer-planner-grc-availability.cjs",
    "scripts/planner/generate-transfer-planner-student-runtime.cjs",
    "scripts/planner/generate-transfer-planner-docs.ts",
    "scripts/planner/transfer-planner.service.test.ts",
  ];

  for (const scriptPath of requiredPipelineScripts) {
    assert.match(refreshScript, new RegExp(scriptPath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.match(refreshScript, /--verify-only/);
  assert.match(refreshScript, /tsc",\s*"--noEmit"/);
  assert.match(refreshScript, /Classify hidden source gaps/);
  assert.match(refreshScript, /Refresh summary:/);
  assert.match(refreshScript, /GATORGUIDE_PLANNER_CACHE_ONLY/);
  assert.match(refreshScript, /reuseCachedArtifact/);
  assert.match(refreshScript, /PRIMARY_SOURCE_DISCOVERY_REPORT_PATH/);
  assert.match(refreshScript, /REQUIREMENT_PARSE_REPORT_PATH/);

  const noDownloadPlanProcess = spawnSync(
    "node",
    [
      "scripts/planner/refresh-transfer-planner-sources.cjs",
      "--print-step-plan-json",
      "--skip-downloads",
      "--skip-verify",
    ],
    { encoding: "utf8" }
  );
  assert.equal(noDownloadPlanProcess.status, 0, noDownloadPlanProcess.stderr);
  const noDownloadPlan = JSON.parse(noDownloadPlanProcess.stdout);
  const noDownloadLabels = new Set(noDownloadPlan.labels);
  for (const skippedLiveSourceStep of [
    "Discover Green River public materials",
    "Generate Green River associate tracks",
    "Check official source links",
    "Discover primary official sources",
    "Parse UW major requirement sources",
    "Snapshot Green River annual schedules",
    "Refresh deadline sources",
    "Parse UW Green River equivalency guide",
    "Ingest Green River course catalog",
    "Ingest UW course catalogs",
  ]) {
    assert.equal(
      noDownloadLabels.has(skippedLiveSourceStep),
      false,
      `${skippedLiveSourceStep} should not run in no-download mode.`
    );
  }
  assert.equal(noDownloadLabels.has("Build primary-source automation queue"), true);
  assert.equal(noDownloadLabels.has("Build source fingerprints and classify changes"), true);
  assert.equal(noDownloadLabels.has("Generate merged course metadata"), true);

  const noDownloadFullPlanProcess = spawnSync(
    "node",
    [
      "scripts/planner/refresh-transfer-planner-sources.cjs",
      "--print-step-plan-json",
      "--skip-downloads",
    ],
    { encoding: "utf8" }
  );
  assert.equal(noDownloadFullPlanProcess.status, 0, noDownloadFullPlanProcess.stderr);
  const noDownloadFullPlan = JSON.parse(noDownloadFullPlanProcess.stdout);
  assert.equal(
    noDownloadFullPlan.labels.includes("Run closed-loop auto-repair pass"),
    false,
    "No-download mode must not launch auto-repair because it can refresh online source parsers."
  );
});

test("Bootstrap generators stay parser-first and never import legacy planner data module", () => {
  const guardedBootstrapScripts = [
    "scripts/planner/generate-transfer-planner-source-bootstrap.cjs",
    "scripts/planner/generate-transfer-planner-grc-associate-tracks.cjs",
  ];
  const legacyModulePattern = new RegExp(
    `${escapeRegExp(LEGACY_PLANNER_DATA_MODULE_NAME)}(?:\\b|$)`,
    "i"
  );

  for (const scriptPath of guardedBootstrapScripts) {
    const scriptContents = readFileSync(scriptPath, "utf8");
    assert.doesNotMatch(
      scriptContents,
      legacyModulePattern,
      `${scriptPath} must not import ${LEGACY_PLANNER_DATA_MODULE_NAME}.`
    );
  }
});

test("Project files do not reference the legacy planner data module", () => {
  const legacyModuleNeedle = LEGACY_PLANNER_DATA_MODULE_NAME.toLowerCase();
  const matchingPaths = collectProjectTextFiles(process.cwd()).filter((relativePath) => {
    const contents = readFileSync(relativePath, "utf8").toLowerCase();
    return contents.includes(legacyModuleNeedle);
  });

  assert.deepEqual(
    matchingPaths,
    [],
    `Unexpected references to ${LEGACY_PLANNER_DATA_MODULE_NAME}: ${matchingPaths.join(", ")}`
  );
});

test("Windows planner maintenance launcher runs refresh, installs Chromium, runs QA, and writes a summary", () => {
  const maintenanceScript = readFileSync(
    "scripts/run-transfer-planner-maintenance.ps1",
    "utf8"
  );
  const updaterBat = readFileSync("scripts/Course-Planner-Updater.bat", "utf8");
  const rootUpdaterBat = readFileSync("../Course-Planner-Updater.bat", "utf8");
  const refreshScript = readFileSync("scripts/run-transfer-planner-refresh.ps1", "utf8");
  const maintenanceCommon = readFileSync("scripts/transfer-planner-maintenance-common.ps1", "utf8");
  const diagnosisScript = readFileSync(
    "scripts/planner/transfer-planner-laymans-diagnosis.cjs",
    "utf8"
  );
  const linkManagerScript = readFileSync("scripts/planner/course-planner-link-manager.cjs", "utf8");
  const manualSourceOverrideData = readFileSync(
    "constants/transfer-planner-source/manual-source-link-overrides.data.ts",
    "utf8"
  );
  const windowsQaScript = readFileSync("scripts/qa/run-windows-qa.cjs", "utf8");
  const windowsInteractionsScript = readFileSync(".tools/windows-interactions.mjs", "utf8");
  const packageJson = readFileSync("package.json", "utf8");
  const readme = readFileSync("README.md", "utf8");

  assert.match(maintenanceScript, /run-transfer-planner-refresh\.ps1/);
  assert.match(maintenanceScript, /Get-InteractiveMaintenanceSelection/);
  assert.match(maintenanceScript, /Show-CacheSummary/);
  assert.match(maintenanceScript, /Edit course links/);
  assert.match(maintenanceScript, /Invoke-CourseLinkEditor/);
  assert.match(maintenanceScript, /Choose an institution/);
  assert.match(maintenanceScript, /Select-TransferPlannerRefreshTargetPlan/);
  assert.match(maintenanceScript, /Update one major\/pathway only/);
  assert.match(maintenanceScript, /Update using one part of workflow only/);
  assert.match(maintenanceScript, /Update this \$itemLabel with current links/);
  assert.match(maintenanceScript, /Invoke-CourseLinkUpdateCurrentLinksFlow/);
  assert.match(maintenanceScript, /course-planner-link-manager\.cjs/);
  assert.match(maintenanceScript, /TargetPlanId/);
  assert.match(maintenanceScript, /Write-TransferPlannerLaymansDiagnosis/);
  assert.match(maintenanceScript, /Show-LaymansDiagnosis/);
  assert.match(maintenanceScript, /ShowLaymansDiagnosis/);
  assert.match(maintenanceScript, /Get-RefreshTrackedPlan/);
  assert.match(maintenanceScript, /Update-RefreshMaintenanceProgressFromOutputLine/);
  assert.match(maintenanceScript, /Tracked maintenance steps:/);
  assert.doesNotMatch(maintenanceScript, /X\. Exit/);
  assert.doesNotMatch(maintenanceScript, /B=Back,\s*X=Exit/);
  assert.doesNotMatch(maintenanceScript, /Write-Host "5\. Edit course links"/);
  assert.match(maintenanceScript, /Write-Host "6\. Back"/);
  assert.match(maintenanceScript, /playwright",\s*"install",\s*"chromium"/);
  assert.match(
    maintenanceScript,
    /-FilePath\s+"npm\.cmd"[\s\S]*-Arguments\s+@\("run",\s*"qa:windows:ci"\)/
  );
  assert.match(maintenanceScript, /verify-transfer-planner-hardening\.cjs/);
  assert.match(maintenanceScript, /transfer-planner-maintenance-summary\.md/);
  assert.match(maintenanceScript, /transfer-planner-hardening-report\.md/);
  assert.match(maintenanceScript, /transfer-planner-source-backed-coverage-audit\.md/);
  assert.match(maintenanceScript, /Start-Process/);
  assert.match(maintenanceScript, /Tee-Object\s+-FilePath\s+\$logPath\s+-Append/);
  assert.match(maintenanceScript, /-OnlySection/);
  assert.match(maintenanceScript, /-StartSection/);

  assert.match(updaterBat, /\.\.\\\.\.\\Course-Planner-Updater\.bat/);
  assert.match(rootUpdaterBat, /run-transfer-planner-maintenance\.ps1/);
  assert.match(rootUpdaterBat, /run-transfer-planner-refresh\.ps1/);
  assert.match(rootUpdaterBat, /maintenance-no-downloads/);
  assert.match(rootUpdaterBat, /refresh-no-downloads/);
  assert.match(rootUpdaterBat, /cache-summary/);
  assert.match(rootUpdaterBat, /edit-course-links/);
  assert.match(rootUpdaterBat, /laymans-diagnosis/);
  assert.match(rootUpdaterBat, /echo 1\. Course updates \+ tests/);
  assert.match(rootUpdaterBat, /echo 2\. Course updates only/);
  assert.match(rootUpdaterBat, /echo 3\. Show cache summary/);
  assert.match(rootUpdaterBat, /echo 4\. Edit course links/);
  assert.match(rootUpdaterBat, /echo 5\. Laymans Diagnosis/);
  assert.match(rootUpdaterBat, /echo 6\. Back/);
  assert.doesNotMatch(rootUpdaterBat, /echo 2\. Course updates \+ tests \^\(skip downloads\^\)/);
  assert.doesNotMatch(rootUpdaterBat, /echo 4\. Course updates only \^\(skip downloads\^\)/);
  assert.match(rootUpdaterBat, /echo 2\. Skip downloads/);
  assert.match(rootUpdaterBat, /echo B\. Back/);
  assert.match(refreshScript, /--only-section/);
  assert.match(refreshScript, /--start-section/);
  assert.match(refreshScript, /TargetPlanId/);
  assert.match(refreshScript, /--target-plan-id/);
  assert.match(refreshScript, /Write-TransferPlannerLaymansDiagnosis/);
  assert.match(maintenanceCommon, /Get-TransferPlannerLaymansDiagnosis/);
  assert.match(diagnosisScript, /Laymans Diagnosis/);
  assert.match(diagnosisScript, /no-parsed-uw-course-codes/);
  assert.match(diagnosisScript, /rowsNeedingAttentionCount/);
  assert.match(linkManagerScript, /--add-link/);
  assert.match(linkManagerScript, /--replace-link/);
  assert.match(linkManagerScript, /--remove-link/);
  assert.match(linkManagerScript, /--set-primary/);
  assert.match(linkManagerScript, /--update-current-links/);
  assert.match(linkManagerScript, /manual-source-link-overrides\.data\.ts/);
  assert.match(manualSourceOverrideData, /TRANSFER_PLANNER_MANUAL_SOURCE_LINK_OVERRIDES/);
  assert.equal(existsSync("../Course-Planner-Updater.bat"), true);
  assert.equal(existsSync("scripts/run-planner-maintenance.cmd"), false);
  assert.equal(existsSync("scripts/run-planner-maintenance.bat"), false);
  assert.equal(existsSync("scripts/run-planner-refresh.cmd"), false);
  assert.equal(existsSync("scripts/run-planner-refresh-no-downloads.cmd"), false);

  assert.match(windowsQaScript, /const npxCommand = process\.platform === "win32" \? "npx\.cmd" : "npx"/);
  assert.doesNotMatch(windowsQaScript, /shell:\s*true/);
  assert.match(windowsInteractionsScript, /async function waitForPathname\(page,\s*expectedPathname\)/);
  assert.match(windowsInteractionsScript, /searchInput\.fill\("WSOS"\)/);
  assert.match(windowsInteractionsScript, /searchInput\.fill\("Deadline Calendar"\)/);
  assert.match(windowsInteractionsScript, /waitForPathname\(page,\s*"\/calendar"\)/);
  assert.match(windowsInteractionsScript, /waitForPathname\(page,\s*"\/about"\)/);
  assert.match(windowsInteractionsScript, /waitForPathname\(page,\s*"\/privacy"\)/);

  assert.match(packageJson, /"planner:hardening:verify":/);
  assert.match(packageJson, /"planner:audit:source-backed-coverage":/);
  assert.match(packageJson, /"planner:windows:maintenance":/);
  assert.match(packageJson, /"planner:full:verify":/);
  assert.match(readme, /planner:windows:maintenance/);
  assert.match(readme, /transfer-planner-hardening-report\.md/);
  assert.match(readme, /transfer-planner-source-backed-coverage-audit\.md/);
  assert.match(readme, /Course-Planner-Updater\.bat/);
  assert.doesNotMatch(readme, /run-planner-maintenance\.cmd/);
  assert.match(readme, /transfer-planner-maintenance-summary\.md/);
});

test("Windows planner cache summary tolerates an empty cache state", () => {
  if (process.platform !== "win32") {
    return;
  }

  const tempRoot = mkdtempSync(join(tmpdir(), "gg-cache-summary-"));
  const scriptsDir = join(tempRoot, "scripts");
  const plannerDir = join(scriptsDir, "planner");

  mkdirSync(plannerDir, { recursive: true });
  copyFileSync(
    "scripts/run-transfer-planner-maintenance.ps1",
    join(scriptsDir, "run-transfer-planner-maintenance.ps1")
  );
  copyFileSync(
    "scripts/transfer-planner-maintenance-common.ps1",
    join(scriptsDir, "transfer-planner-maintenance-common.ps1")
  );
  writeFileSync(
    join(plannerDir, "refresh-transfer-planner-sources.cjs"),
    `if (process.argv.includes("--print-step-plan-json")) {
  process.stdout.write(JSON.stringify({
    count: 0,
    labels: [],
    sections: [],
    availableSections: [],
    selectedSectionIds: [],
  }));
}
`,
    "utf8"
  );

  const result = spawnSync(
    "powershell",
    [
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      join(scriptsDir, "run-transfer-planner-maintenance.ps1"),
      "-ShowCacheSummary",
      "-NoPrompt",
      "-NoOpenSummary",
    ],
    {
      cwd: tempRoot,
      encoding: "utf8",
    }
  );

  assert.equal(
    result.status,
    0,
    `Expected cache summary to handle an empty cache state.\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`
  );
  assert.match(result.stdout, /== Cached status ==/);
  assert.match(result.stdout, /Last maintenance summary: missing/);
  assert.match(result.stdout, /Latest maintenance log: missing/);
  assert.doesNotMatch(`${result.stdout}\n${result.stderr}`, /Index was outside the bounds of the array/);
});

test("Course link manager builds inventory and laymans diagnosis returns plain-language follow-up items", () => {
  const { buildMajorInventory, getPlanDetails } = require("./course-planner-link-manager.cjs");
  const { buildLaymansDiagnosis } = require("./transfer-planner-laymans-diagnosis.cjs");

  const inventory = buildMajorInventory();
  const institutionLabels = inventory.institutions.map((institution: { label: string }) => institution.label);
  assert.deepEqual(institutionLabels, ["University of Washington", "Green River College"]);

  const uwInstitution = inventory.institutions.find(
    (institution: { label: string }) => institution.label === "University of Washington"
  );
  const grcInstitution = inventory.institutions.find(
    (institution: { label: string }) => institution.label === "Green River College"
  );
  assert.ok(
    uwInstitution?.groups.some(
      (group: { label: string; items: unknown[] }) =>
        group.label === "UW Seattle" && group.items.length > 0
    ),
    "Expected the UW institution branch to expose campus-grouped majors."
  );
  assert.ok(grcInstitution?.groups.length > 0, "Expected Green River to expose program groups.");

  const firstPlanId = uwInstitution?.groups[0]?.items[0]?.planId ?? null;
  assert.ok(firstPlanId, "Expected the course link inventory to expose a plan id.");
  const planDetails = getPlanDetails(firstPlanId);
  assert.equal(planDetails.planId, firstPlanId);
  assert.equal(planDetails.institutionLabel, "University of Washington");
  assert.ok(planDetails.sourceOfTruthPath.endsWith("manual-source-link-overrides.data.ts"));
  assert.match(
    planDetails.automaticValidationCommand,
    /-OnlySection source-audit/,
    "Expected course-link validation to stay scoped to the minimum source-audit refresh."
  );

  const firstGrcTrackId = grcInstitution?.groups[0]?.items[0]?.planId ?? null;
  assert.ok(firstGrcTrackId, "Expected the Green River branch to expose an editable track id.");
  const grcDetails = getPlanDetails(firstGrcTrackId);
  assert.equal(grcDetails.institutionLabel, "Green River College");
  assert.ok(grcDetails.currentLinks.length > 0, "Expected Green River track links to resolve through the source manifest.");

  const diagnoses = buildLaymansDiagnosis({
    projectRoot: process.cwd(),
    includeWarnings: true,
  });
  assert.ok(diagnoses.length > 0, "Expected laymans diagnosis items from the current planner reports.");
  const diagnosisPaths = diagnoses
    .map((entry: { whereToLook?: string }) => String(entry.whereToLook ?? ""))
    .filter(Boolean);
  assert.ok(
    diagnosisPaths.some((value: string) => value.startsWith("source/.tmp/")),
    "Expected laymans diagnosis report paths to stay repo-root-relative for the root launcher."
  );
  assert.ok(
    diagnosisPaths.every((value: string) => !value.startsWith(".tmp/")),
    "Expected laymans diagnosis report paths to avoid ambiguous app-relative .tmp hints."
  );
  assert.ok(
    diagnoses.some((entry: { whereToLook?: string; symptom?: string }) =>
      String(entry.whereToLook ?? "").includes("transfer-planner-status.md") ||
      /usable UW course list|need follow-up/i.test(String(entry.symptom ?? ""))
    ),
    "Expected laymans diagnosis to explain at least one current planner follow-up area."
  );
});

test("Generated Green River availability sources now include future-year published schedules", () => {
  assert.ok(
    TRANSFER_PLANNER_GRC_COURSE_AVAILABILITY_SOURCE_URLS.some((url) =>
      /2026-2027.*Annual.*Schedule/i.test(url)
    )
  );
  assert.ok(TRANSFER_PLANNER_GRC_COURSE_AVAILABILITY_SOURCE_URLS.length >= 3);
});

test("Single-pass planner hardening invariants hold across the five robustness fixes", () => {
  const sourceGapReport = JSON.parse(
    readFileSync(".tmp/transfer-planner-source-gaps.json", "utf8")
  );
  const requirementParseReport = JSON.parse(
    readFileSync(".tmp/transfer-planner-requirement-source-parse-report.json", "utf8")
  );
  const requirementDiffReport = JSON.parse(
    readFileSync(".tmp/transfer-planner-requirement-diff-promotion-report.json", "utf8")
  );
  const sourceBackedCoverageAudit = JSON.parse(
    readFileSync(".tmp/transfer-planner-source-backed-coverage-audit.json", "utf8")
  );
  const allowedAvailabilityStatuses = new Set([
    "published-in-latest-schedule",
    "published-in-recent-history-not-latest",
    "catalog-listed-not-in-latest-schedules",
    "planner-course-no-current-public-source",
    "legacy-track-only-no-current-public-source",
  ]);
  const availabilityEntries = Object.values(TRANSFER_PLANNER_GRC_COURSE_AVAILABILITY) as Array<{
    status: string;
  }>;
  const invalidAvailabilityStatuses = Array.from(
    new Set(
      availabilityEntries.map((entry) => entry.status).filter(
        (status) => !allowedAvailabilityStatuses.has(status)
      )
    )
  );
  const toolSummary = readFileSync("docs/planner/TRANSFER_PLANNER_TOOL_SUMMARY.md", "utf8");

  assert.equal(sourceGapReport.totalSourceGapOwners, 0);
  assert.equal(requirementParseReport.failedCount, 0);
  assert.equal(requirementParseReport.okCount, requirementParseReport.totalOwners);
  assert.equal(requirementDiffReport.reviewCandidateCount, 0);
  assert.equal(requirementDiffReport.unmappedCount, 0);
  assert.equal(
    Object.prototype.hasOwnProperty.call(
      TRANSFER_PLANNER_REQUIREMENT_DIFF_CLASSIFICATION_REGISTRY_SUMMARY.countsByKind,
      "source-backed-no-clean-grc-consensus"
    ),
    false
  );
  assert.equal(
    JSON.stringify(TRANSFER_PLANNER_GRC_COURSE_AVAILABILITY).includes("manual-review"),
    false
  );
  assert.deepEqual(invalidAvailabilityStatuses, []);
  assert.equal(sourceBackedCoverageAudit.outcome, "passed");
  assert.equal(sourceBackedCoverageAudit.summary.failedRegressionCheckCount, 0);
  assert.ok(sourceBackedCoverageAudit.summary.requirementCoverageRowCount > 0);
  assert.match(toolSummary, /source-backed/i);
});

test("Owner audit does not surface transient Seattle music/language fetch noise as owner warnings", () => {
  const ownerAuditReport = JSON.parse(
    readFileSync(".tmp/transfer-planner-owner-audit.json", "utf8")
  );
  const ownerById = new Map<
    string,
    {
      issueCounts: { warning: number };
      rootIssues: Array<{ code: string }>;
    }
  >(
    ownerAuditReport.owners.map(
      (owner: {
        ownerId: string;
        issueCounts: { warning: number };
        rootIssues: Array<{ code: string }>;
      }) => [owner.ownerId, owner] as const
    )
  );
  const percussionOwner = ownerById.get("uw-seattle-percussion-performance-b-m");
  const pianoOwner = ownerById.get("uw-seattle-piano-b-m");
  const norwegianOwner = ownerById.get("uw-seattle-norwegian");

  assert.ok(percussionOwner);
  assert.ok(pianoOwner);
  assert.ok(norwegianOwner);
  assert.equal(percussionOwner.issueCounts.warning, 0);
  assert.equal(pianoOwner.issueCounts.warning, 0);
  assert.equal(norwegianOwner.issueCounts.warning, 0);
});

test("Planner hardening verifier script checks the five robustness contracts in one pass", () => {
  const verifierScript = readFileSync(
    "scripts/planner/verify-transfer-planner-hardening.cjs",
    "utf8"
  );
  const docsReadme = readFileSync("docs/README.md", "utf8");

  assert.match(verifierScript, /transfer-planner-source-gaps\.json/);
  assert.match(verifierScript, /transfer-planner-requirement-source-parse-report\.json/);
  assert.match(verifierScript, /transfer-planner-requirement-diff-promotion-report\.json/);
  assert.match(verifierScript, /TRANSFER_PLANNER_GRC_COURSE_AVAILABILITY/);
  assert.match(verifierScript, /source-backed-no-clean-grc-consensus/);
  assert.match(verifierScript, /source-backed-clean-title-no-shared-grc-match/);
  assert.match(verifierScript, /source-backed-campus-specific-no-clean-grc-match/);
  assert.match(verifierScript, /manual-review/);
  assert.match(verifierScript, /TransferPlannerPage\.tsx/);
  assert.match(verifierScript, /audit-transfer-planner-source-backed-coverage\.cjs/);
  assert.match(verifierScript, /transfer-planner-source-backed-coverage-audit\.json/);
  assert.match(verifierScript, /transfer-planner-hardening-report\.md/);
  assert.match(docsReadme, /transfer-planner-source-backed-coverage-audit\.md/);
  assert.match(docsReadme, /transfer-planner-hardening-report\.md/);
  assert.match(docsReadme, /planner:full:verify/);
});

test("Source-backed coverage maintainer audit guards today's planner regressions", () => {
  const auditScript = readFileSync(
    "scripts/planner/audit-transfer-planner-source-backed-coverage.cjs",
    "utf8"
  );
  const auditReport = JSON.parse(
    readFileSync(".tmp/transfer-planner-source-backed-coverage-audit.json", "utf8")
  );
  const requiredIssueTypes = [
    "missing-detected-course",
    "unmapped-uw-only",
    "over-scheduled-alternatives",
    "stale-match-count",
    "gen-ed-scope-leak",
    "option-group-disappears-after-refresh",
    "prep-credit-counted-as-main",
  ];
  const requiredCheckIds = [
    "uw-mechanical-engineering:visible-courses",
    "uw-civil-engineering:chem152-visible",
    "uw-bioengineering:match-count-fresh",
    "uw-mse-nme:option-groups",
    "uw-ece-photonics:programming-and-science",
    "grc-accounting-aaa:selected-total-90",
    "grc-ast2-computer-electrical:total-98-no-prep",
    "grc-ast2-civil-mechanical:official-total-107",
  ];

  for (const issueType of requiredIssueTypes) {
    assert.match(auditScript, new RegExp(escapeRegExp(issueType)));
    assert.ok(
      Object.prototype.hasOwnProperty.call(
        auditReport.summary.issueCountsByType,
        issueType
      )
    );
  }

  assert.equal(auditReport.outcome, "passed");
  assert.equal(auditReport.summary.failedRegressionCheckCount, 0);
  for (const checkId of requiredCheckIds) {
    assert.ok(
      auditReport.regressionChecks.some(
        (check: { id: string; status: string }) =>
          check.id === checkId && check.status === "passed"
      ),
      `Expected maintainer audit check ${checkId} to pass.`
    );
  }
  assert.ok(
    auditReport.requirementCoverageRows.some(
      (row: { majorId: string; uwRequirementLabel: string; copyOnlyDebugText: string }) =>
        row.majorId === "uw-seattle-bioengineering" &&
        row.uwRequirementLabel === "CHEM 162" &&
        /^\[copy-only source-backed requirement audit\]/.test(row.copyOnlyDebugText)
    )
  );
});

test("Planner docs now use source-gap and source-backed language instead of review queues", () => {
  const toolSummary = readFileSync("docs/planner/TRANSFER_PLANNER_TOOL_SUMMARY.md", "utf8");
  const docsReadme = readFileSync("docs/README.md", "utf8");
  const bootstrapSource = readFileSync(
    "constants/transfer-planner-source/bootstrap.generated.ts",
    "utf8"
  );
  const seattleDoc = readFileSync("docs/planner/UWS_DEGREE_COURSES.md", "utf8");
  const bothellDoc = readFileSync("docs/planner/UWB_DEGREE_COURSES.md", "utf8");
  const tacomaDoc = readFileSync("docs/planner/UWT_DEGREE_COURSES.md", "utf8");
  const docsGenerator = readFileSync("scripts/planner/generate-transfer-planner-docs.ts", "utf8");

  assert.match(toolSummary, /source-gap/i);
  assert.match(toolSummary, /source-backed/i);
  assert.doesNotMatch(toolSummary, /advisor review/i);
  assert.doesNotMatch(toolSummary, /review queue/i);
  assert.match(toolSummary, /planner:windows:maintenance/);
  assert.match(toolSummary, /Course-Planner-Updater\.bat/);
  assert.doesNotMatch(toolSummary, /run-planner-maintenance\.cmd/);
  assert.doesNotMatch(toolSummary, /run-planner-refresh\.cmd/);

  assert.match(docsReadme, /planner:windows:maintenance/);
  assert.match(docsReadme, /Course-Planner-Updater\.bat/);
  assert.doesNotMatch(docsReadme, /run-planner-maintenance\.cmd/);
  assert.match(docsReadme, /generated from the planner source layer/i);

  assert.doesNotMatch(bootstrapSource, /advisor review/i);
  assert.doesNotMatch(bootstrapSource, /support-only/i);
  assert.doesNotMatch(bootstrapSource, /before final advisor review/i);

  assert.match(docsGenerator, /function sanitizePlannerDocText/);
  assert.match(docsGenerator, /Source-backed note:/);
  assert.doesNotMatch(docsGenerator, /Manual review note:/);
  assert.match(docsGenerator, /confirm the exact timing with an advisor/i);

  for (const campusDoc of [seattleDoc, bothellDoc, tacomaDoc]) {
    assert.doesNotMatch(campusDoc, /support-only/i);
    assert.doesNotMatch(campusDoc, /confirm the exact timing with an advisor/i);
  }
});

test("Phase 10 generated snapshot-fallback metadata stays internally consistent", () => {
  const fallbackBlocks = TRANSFER_PLANNER_PARSED_REQUIREMENT_SOURCE_BLOCKS.filter(
    (block) => block.usedSnapshotFallback
  );
  const alternateBlocks = TRANSFER_PLANNER_PARSED_REQUIREMENT_SOURCE_BLOCKS.filter(
    (block) => block.resolutionStrategy === "alternate-official-source"
  );
  const failedBlocks = TRANSFER_PLANNER_PARSED_REQUIREMENT_SOURCE_BLOCKS.filter(
    (block) => !block.ok
  );

  assert.equal(
    TRANSFER_PLANNER_REQUIREMENT_SOURCE_ADAPTER_SUMMARY.snapshotFallbackCount,
    fallbackBlocks.length
  );
  for (const block of fallbackBlocks) {
    assert.equal(block.ok, true);
    assert.ok(block.snapshotPath, `${block.ownerId} fallback block should keep its snapshot path.`);
    assert.ok(
      block.snapshotFallbackReason,
      `${block.ownerId} fallback block should record the live-source failure reason.`
    );
    assert.equal(block.error, null);
  }
  for (const block of alternateBlocks) {
    assert.equal(block.ok, true);
    assert.notEqual(block.primarySourceUrl, block.sourceUrl);
    assert.equal(block.usedSnapshotFallback, false);
    assert.equal(block.error, null);
  }
  for (const block of failedBlocks) {
    assert.equal(block.usedSnapshotFallback, false);
    assert.equal(block.snapshotFallbackReason, null);
  }
  assert.equal(failedBlocks.length, 0);
});
