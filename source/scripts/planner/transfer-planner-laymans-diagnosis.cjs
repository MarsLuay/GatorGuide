const fs = require("fs");
const path = require("path");
const { getTmpPath } = require("../lib/tmp-layout.cjs");
const { SOURCE_ROOT, getArgValue, hasArg } = require("./lib/script-harness.cjs");

function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

function normalizeText(value) {
  return String(value ?? "").trim();
}

function normalizeList(values) {
  return Array.isArray(values) ? values.filter(Boolean) : [];
}

function normalizeDisplayPath(filePath) {
  return String(filePath ?? "").split(path.sep).join("/");
}

function findDisplayRoot(projectRoot) {
  let current = path.resolve(projectRoot);

  while (true) {
    if (
      fs.existsSync(path.join(current, ".git")) ||
      fs.existsSync(path.join(current, "Course-Planner-Updater.bat"))
    ) {
      return current;
    }

    const parent = path.dirname(current);
    if (parent === current) {
      break;
    }

    current = parent;
  }

  return path.resolve(projectRoot);
}

function formatWhereToLookPath(projectRoot, targetPath) {
  const normalizedTargetPath = normalizeText(targetPath);
  if (!normalizedTargetPath) {
    return "";
  }

  const absoluteTargetPath = path.isAbsolute(normalizedTargetPath)
    ? path.resolve(normalizedTargetPath)
    : path.resolve(projectRoot, normalizedTargetPath);
  const displayRoot = findDisplayRoot(projectRoot);
  const relativePath = path.relative(displayRoot, absoluteTargetPath);

  if (!relativePath || relativePath.startsWith("..")) {
    return normalizeDisplayPath(absoluteTargetPath);
  }

  return normalizeDisplayPath(relativePath);
}

function formatTmpReportPath(projectRoot, fileName) {
  return formatWhereToLookPath(projectRoot, getTmpPath(projectRoot, fileName));
}

function addDiagnosis(target, diagnosis) {
  if (!diagnosis || !diagnosis.id) {
    return;
  }

  if (target.some((entry) => entry.id === diagnosis.id)) {
    return;
  }

  target.push(diagnosis);
}

function getSeverityRank(severity) {
  switch (severity) {
    case "error":
      return 3;
    case "warning":
      return 2;
    default:
      return 1;
  }
}

function buildFailureMessageDiagnosis(failureMessage, logPath, projectRoot) {
  const normalizedMessage = normalizeText(failureMessage);
  if (!normalizedMessage) {
    return [];
  }

  const diagnoses = [];
  const whereToLook = normalizeText(logPath)
    ? formatWhereToLookPath(projectRoot, logPath)
    : "the maintenance or refresh log";

  if (/Use either -OnlySection or -StartSection/i.test(normalizedMessage)) {
  addDiagnosis(diagnoses, {
    id: "invalid-section-selection",
    severity: "error",
    symptom: "The tool was given two section options that cannot be used together.",
    whyItMatters: "The tool cannot tell which part of the planner you want it to run.",
    likelyCause: "Two different section choices were entered at the same time.",
    nextAction: "Run the tool again and choose only one section option.",
    whereToLook,
  });
}

  if (/not installed or not on PATH/i.test(normalizedMessage)) {
    addDiagnosis(diagnoses, {
      id: "missing-toolchain",
      severity: "error",
      symptom: "A required tool is missing on this machine.",
      whyItMatters: "The planner cannot refresh, test, or validate anything until that tool exists.",
      likelyCause: "Node.js, npm, Windows PowerShell, or another required command is not installed or not visible to the terminal.",
      nextAction: "Install the missing tool, reopen the terminal, and rerun the launcher.",
      whereToLook,
    });
  }

  if (/Run repo health check failed|health:repo/i.test(normalizedMessage)) {
  addDiagnosis(diagnoses, {
    id: "repo-health-failed",
    severity: "error",
    symptom: "The project was not in a good enough state to safely start updating the planner.",
    whyItMatters: "If important project files or setup are broken, later planner steps can fail in confusing ways.",
    likelyCause: "Some project files, installed packages, or setup steps are missing, broken, or out of sync.",
    nextAction: "Fix the project setup issues, run npm install if needed, and then try the planner process again.",
    whereToLook,
  });
}

  if (/parse-transfer-planner-requirement-sources\.cjs|Parse UW major requirement sources/i.test(normalizedMessage)) {
    addDiagnosis(diagnoses, {
      id: "requirement-parse-command-failed",
      severity: "error",
      symptom: "The planner could not finish reading the official UW requirement pages.",
      whyItMatters: "If the parser cannot read those pages, the planner cannot build reliable class requirements.",
      likelyCause: "A source page changed shape, a link now points to a weak page, or the parser needs to be updated.",
      nextAction: "Check the parse report and repair the source link or parser adapter for the courses that failed.",
      whereToLook: formatTmpReportPath(projectRoot, "transfer-planner-requirement-source-parse-report.md"),
    });
  }

  if (/verify-transfer-planner-source-pipeline\.cjs|source pipeline invariants/i.test(normalizedMessage)) {
    addDiagnosis(diagnoses, {
      id: "source-pipeline-failed",
      severity: "error",
      symptom: "The planner source pipeline fell out of sync.",
      whyItMatters: "Generated outputs, source manifests, and parser inputs are no longer describing the same planner state.",
      likelyCause: "A source link, promotion, registry row, or generated file changed without the rest of the pipeline being rebuilt consistently.",
      nextAction: "Rebuild the affected source pipeline steps and fix the invariant report before trusting the planner output.",
      whereToLook: formatTmpReportPath(projectRoot, "transfer-planner-source-pipeline-validation.md"),
    });
  }

  if (/verify-transfer-planner-owner-audit\.cjs|owner audit/i.test(normalizedMessage)) {
    addDiagnosis(diagnoses, {
      id: "owner-audit-command-failed",
      severity: "error",
      symptom: "The planner course audit found majors or pathways with broken source coverage.",
      whyItMatters: "Those rows can look complete in code while still pointing at the wrong source or no usable source at all.",
      likelyCause: "A primary source is missing, invalid, or no longer producing usable parsed requirements.",
      nextAction: "Review the course audit and repair the affected source links or parser coverage.",
      whereToLook: formatTmpReportPath(projectRoot, "transfer-planner-owner-audit.md"),
    });
  }

  if (/verify-transfer-planner-hardening\.cjs|hardening/i.test(normalizedMessage)) {
  addDiagnosis(diagnoses, {
    id: "hardening-command-failed",
    severity: "error",
    symptom: "A planner safety check failed.",
    whyItMatters: "This usually means the updated planner broke one of the rules we use to make sure it is safe and reliable.",
    likelyCause: "A generated file changed unexpectedly, an important rule was broken, or unsafe planner text came back.",
    nextAction: "Open the hardening report, fix the failed checks, and do not continue until they pass.",
    whereToLook: formatTmpReportPath(projectRoot, "transfer-planner-hardening-report.md"),
  });
}

  if (/\btsc\b|TypeScript typecheck/i.test(normalizedMessage)) {
    addDiagnosis(diagnoses, {
      id: "typescript-failed",
      severity: "error",
      symptom: "The planner code or generated files no longer type-check cleanly.",
      whyItMatters: "That means the repo is no longer internally consistent, even if some output files were generated.",
      likelyCause: "A script changed data shapes, generated outputs are stale, or a new helper introduced a mismatch.",
      nextAction: "Fix the reported TypeScript errors and regenerate any stale planner files.",
      whereToLook,
    });
  }

  if (/qa:windows:ci|Windows QA smoke suite/i.test(normalizedMessage)) {
    addDiagnosis(diagnoses, {
      id: "windows-qa-failed",
      severity: "error",
      symptom: "The Windows smoke test did not pass.",
      whyItMatters: "The planner tooling may have refreshed correctly, but the maintained user flow no longer works cleanly in the browser on Windows.",
      likelyCause: "A UI or routing change broke the smoke path, or the QA environment is missing a required browser dependency.",
      nextAction: "Check the Windows QA output and repair the broken interaction before calling the maintenance flow healthy.",
      whereToLook,
    });
  }

  if (/playwright.+chromium|chromium/i.test(normalizedMessage)) {
    addDiagnosis(diagnoses, {
      id: "chromium-install-failed",
      severity: "error",
      symptom: "The browser dependency used for Windows QA could not be prepared.",
      whyItMatters: "The maintenance flow cannot run its browser smoke checks without that browser binary.",
      likelyCause: "Playwright could not download Chromium, or the local environment blocked the install.",
      nextAction: "Retry the browser install or rerun maintenance with Windows QA intentionally skipped if that is acceptable for the moment.",
      whereToLook,
    });
  }

  if (/refresh-transfer-planner-sources\.cjs|planner refresh failed/i.test(normalizedMessage)) {
    addDiagnosis(diagnoses, {
      id: "refresh-command-failed",
      severity: "error",
      symptom: "The refresh pipeline stopped before all planner data could be rebuilt.",
      whyItMatters: "Some reports or generated files may now be only partially refreshed.",
      likelyCause: "One of the source-audit, parsing, generation, or verification steps failed.",
      nextAction: "Use the step output and reports to find the first failed stage, fix that issue, and rerun from that section forward.",
      whereToLook,
    });
  }

  if (!diagnoses.length) {
    addDiagnosis(diagnoses, {
      id: "generic-failure",
      severity: "error",
      symptom: "The planner tooling stopped with an unhandled failure.",
      whyItMatters: "The current run did not finish cleanly, so at least some output should be treated as incomplete.",
      likelyCause: "The failing command needs a closer look in the log to see whether this was a source issue, tooling issue, or generated-file mismatch.",
      nextAction: "Read the first failing command in the log and rerun the smallest affected section after repairing it.",
      whereToLook,
    });
  }

  return diagnoses;
}

function buildReportDiagnoses(reports, projectRoot, options = {}) {
  const diagnoses = [];
  const targetPlanId = normalizeText(options.targetPlanId);

  if (Number(reports.sourceGap?.totalSourceGapOwners ?? 0) > 0) {
    addDiagnosis(diagnoses, {
      id: "source-gaps",
      severity: "warning",
      symptom: `Some majors still do not have a strong official source page the planner can rely on (${reports.sourceGap.totalSourceGapOwners} owner(s)).`,
      whyItMatters: "Those majors may stay hidden or incomplete until the planner can prove a real source for them.",
      likelyCause: "The source link is weak, missing, or points at a page the parser cannot use well.",
      nextAction: "Replace the source with a stronger official requirements page or extend the parser for that source shape.",
      whereToLook: formatTmpReportPath(projectRoot, "transfer-planner-source-gaps.md"),
    });
  }

  if (Number(reports.requirementParse?.failedCount ?? 0) > 0) {
    addDiagnosis(diagnoses, {
      id: "parse-failures",
      severity: "error",
      symptom: `Some official source pages could not be parsed at all (${reports.requirementParse.failedCount} owner(s)).`,
      whyItMatters: "Those majors cannot produce trustworthy planner requirements until parsing works again.",
      likelyCause: "The page structure changed, the source link is weak, or the parser adapter no longer matches the page.",
      nextAction: "Fix the source link or parser adapter, then rerun requirement parsing.",
      whereToLook: formatTmpReportPath(projectRoot, "transfer-planner-requirement-source-parse-report.md"),
    });
  }

  if (Number(reports.requirementParse?.withNoParsedCourseCodesCount ?? 0) > 0) {
  addDiagnosis(diagnoses, {
    id: "no-parsed-course-codes",
    severity: "warning",
    symptom: `The planner found source pages for ${reports.requirementParse.withNoParsedCourseCodesCount} item(s), but still could not pull out a usable UW course list.`,
    whyItMatters: "Those majors may have source information available, but the planner still cannot turn it into useful class guidance.",
    likelyCause: "The page may be too general, the actual requirements may be on a different page, or the planner could only read headings instead of the course list.",
    nextAction: "Use a stronger official requirements page or improve how the planner reads those page formats.",
    whereToLook: formatTmpReportPath(projectRoot, "transfer-planner-requirement-source-parse-report.md"),
  });
}

  if (Number(reports.requirementParse?.ownersWithQualityWarningsCount ?? 0) > 0) {
    addDiagnosis(diagnoses, {
      id: "parser-quality-warnings",
      severity: "warning",
      symptom: `The parser finished, but ${reports.requirementParse.ownersWithQualityWarningsCount} owner(s) still look suspicious.`,
      whyItMatters: "The planner may be missing classes, over-trusting old structure, or depending on weak fallback content for those majors.",
      likelyCause: "The official page partially changed and the parser recovered only part of the intended requirement structure.",
      nextAction: "Review the parse warnings and tighten source selection or parser logic before those warnings turn into bad planner output.",
      whereToLook: formatTmpReportPath(projectRoot, "transfer-planner-requirement-source-parse-report.md"),
    });
  }

  if (
    Number(reports.requirementDiff?.reviewCandidateCount ?? 0) > 0 ||
    Number(reports.requirementDiff?.unmappedCount ?? 0) > 0
  ) {
    addDiagnosis(diagnoses, {
      id: "requirement-diff-debt",
      severity: "warning",
      symptom: "The planner found requirement differences it still cannot classify or map automatically.",
      whyItMatters: "That means some parsed course changes are still not being turned into clean planner rows.",
      likelyCause: "The source changed faster than the mapping and promotion rules.",
      nextAction: "Resolve the review-needed or unmapped diff entries and rerun the pipeline.",
      whereToLook: formatTmpReportPath(projectRoot, "transfer-planner-requirement-diff-promotion-report.md"),
    });
  }

  if (Number(reports.ownerAudit?.issueCounts?.error ?? 0) > 0) {
    addDiagnosis(diagnoses, {
      id: "owner-audit-errors",
      severity: "error",
      symptom: `The course audit still has ${reports.ownerAudit.issueCounts.error} blocking error(s).`,
      whyItMatters: "Some planner courses are not wired to a safe or usable source setup.",
      likelyCause: "A source manifest row is missing or invalid, or a promoted primary source no longer lines up with parsed output.",
      nextAction: "Repair the course-audit errors before trusting the planner output.",
      whereToLook: formatTmpReportPath(projectRoot, "transfer-planner-owner-audit.md"),
    });
  }

  if (Number(reports.ownerAudit?.countsByIssueCode?.["no-parsed-uw-course-codes"] ?? 0) > 0) {
    addDiagnosis(diagnoses, {
      id: "owner-audit-no-parsed-codes",
      severity: "warning",
      symptom: `The course audit confirms ${reports.ownerAudit.countsByIssueCode["no-parsed-uw-course-codes"]} course(s) with no usable parsed UW course codes.`,
      whyItMatters: "The parser cannot find any parsable courses from the links provided for these majors.",
      likelyCause: "The pages used are not structured for easy parsing, or there are no parsable courses available (Ex: Math 151 is instead labelled as Calculus 1).",
      nextAction: "Find better sources with actual parsable courses, or extend the parser for their current page if the courses are there but it is still not getting detected.",
      whereToLook: formatTmpReportPath(projectRoot, "transfer-planner-owner-audit.md"),
    });
  }

  if (normalizeText(reports.sourcePipelineValidation?.outcome).toLowerCase() && normalizeText(reports.sourcePipelineValidation?.outcome).toLowerCase() !== "passed") {
    addDiagnosis(diagnoses, {
      id: "pipeline-validation-failed",
      severity: "error",
      symptom: "The source pipeline validation report is failing.",
      whyItMatters: "Parts of the planner are no longer matching up correctly, which can lead to missing or incorrect results.",
      likelyCause: "A source file or generated file was changed, but related parts were not updated to match.",
      nextAction: "Review the validation errors, fix the mismatched parts, and run the check again before releasing changes.",
      whereToLook: formatTmpReportPath(projectRoot, "transfer-planner-source-pipeline-validation.md"),
    });
  }

  if (normalizeText(reports.hardening?.outcome).toLowerCase() && normalizeText(reports.hardening?.outcome).toLowerCase() !== "passed") {
  addDiagnosis(diagnoses, {
    id: "hardening-failed",
    severity: "error",
    symptom: "A planner safety check is failing.",
    whyItMatters: "The planner is currently breaking one of the checks we use to make sure it is safe and working properly.",
    likelyCause: "Something changed in the planner data or files, and an older or mismatched result may have been left behind.",
    nextAction: "Open the hardening report, fix the listed problems, and run maintenance again.",
    whereToLook: formatTmpReportPath(projectRoot, "transfer-planner-hardening-report.md"),
  });
}

  if (
    !targetPlanId &&
    normalizeText(reports.sourceYearCoverage?.outcome).toLowerCase() &&
    normalizeText(reports.sourceYearCoverage?.outcome).toLowerCase() !== "ok"
  ) {
    addDiagnosis(diagnoses, {
      id: "source-year-coverage",
      severity: "warning",
      symptom: "The schedule-year coverage is out of date for the current planner baseline.",
      whyItMatters: "Green River availability and year-sensitive guidance may be based on stale published schedules.",
      likelyCause: "The latest annual schedule links changed or a new academic year rolled over.",
      nextAction: "Refresh the schedule discovery data and repair the year-coverage report.",
      whereToLook: formatTmpReportPath(projectRoot, "transfer-planner-source-year-coverage.md"),
    });
  }

  if (!targetPlanId && Number(reports.status?.summary?.rowsNeedingAttentionCount ?? 0) > 0) {
  addDiagnosis(diagnoses, {
    id: "rows-needing-attention",
    severity: "warning",
    symptom: `The planner still has ${reports.status.summary.rowsNeedingAttentionCount} item(s) that need review.`,
    whyItMatters: "Some majors or pathways are still not showing up correctly in the planner.",
    likelyCause: normalizeText(reports.status?.dominantIncompleteBucket)
      ? `The most common remaining issue is "${reports.status.dominantIncompleteBucket}".`
      : "Some parts of the planner data are still incomplete.",
    nextAction: "Open the planner status report and fix the most common issue first.",
    whereToLook: formatTmpReportPath(projectRoot, "transfer-planner-status.md"),
  });
}

  if (
    !targetPlanId &&
    Number(reports.status?.summary?.unexpectedNullRuntimeRowsAmongVisibleSourceBackedOwners ?? 0) > 0
  ) {
    addDiagnosis(diagnoses, {
      id: "null-runtime-rows",
      severity: "warning",
      symptom: `The planner built some visible rows, but ${reports.status.summary.unexpectedNullRuntimeRowsAmongVisibleSourceBackedOwners} of them still do not produce runtime planner rows.`,
      whyItMatters: "The parser found eligible data, but the student-facing planner still cannot turn it into a usable class list.",
      likelyCause: "Structured generation or runtime materialization is missing for some courses.",
      nextAction: "Inspect the planner status report and repair the generated/runtime path for those rows.",
      whereToLook: formatTmpReportPath(projectRoot, "transfer-planner-status.md"),
    });
  }

  return diagnoses;
}

function loadReports(projectRoot) {
  return {
    sourceGap: readJsonIfExists(getTmpPath(projectRoot, "transfer-planner-source-gaps.json")),
    requirementParse: readJsonIfExists(
      getTmpPath(projectRoot, "transfer-planner-requirement-source-parse-report.json")
    ),
    requirementDiff: readJsonIfExists(
      getTmpPath(projectRoot, "transfer-planner-requirement-diff-promotion-report.json")
    ),
    ownerAudit: readJsonIfExists(getTmpPath(projectRoot, "transfer-planner-owner-audit.json")),
    hardening: readJsonIfExists(getTmpPath(projectRoot, "transfer-planner-hardening-report.json")),
    sourceYearCoverage: readJsonIfExists(
      getTmpPath(projectRoot, "transfer-planner-source-year-coverage.json")
    ),
    sourcePipelineValidation: readJsonIfExists(
      getTmpPath(projectRoot, "transfer-planner-source-pipeline-validation.json")
    ),
    status: readJsonIfExists(getTmpPath(projectRoot, "transfer-planner-status.json")),
  };
}

function buildLaymansDiagnosis(options = {}) {
  const projectRoot = path.resolve(options.projectRoot ?? SOURCE_ROOT);
  const reports = loadReports(projectRoot);
  const diagnoses = [];

  for (const entry of buildFailureMessageDiagnosis(options.failureMessage, options.logPath, projectRoot)) {
    addDiagnosis(diagnoses, entry);
  }

  const reportDiagnoses = buildReportDiagnoses(reports, projectRoot, {
    targetPlanId: options.targetPlanId,
  });
  const includeWarnings =
    options.includeWarnings !== false || normalizeText(options.failureMessage).length > 0;

  for (const entry of reportDiagnoses) {
    if (entry.severity === "warning" && !includeWarnings) {
      continue;
    }
    addDiagnosis(diagnoses, entry);
  }

  return diagnoses.sort((left, right) => {
    const severityDelta = getSeverityRank(right.severity) - getSeverityRank(left.severity);
    if (severityDelta !== 0) {
      return severityDelta;
    }
    return left.symptom.localeCompare(right.symptom);
  });
}

function formatLaymansDiagnosisMarkdown(diagnoses) {
  if (!diagnoses.length) {
    return ["## Laymans Diagnosis", "", "- None. The run did not leave any simple-language follow-up notes."];
  }

  const lines = ["## Laymans Diagnosis", ""];
  for (const diagnosis of diagnoses) {
    lines.push(`- What went wrong: ${diagnosis.symptom}`);
    lines.push(`  Why it matters: ${diagnosis.whyItMatters}`);
    lines.push(`  Likely cause: ${diagnosis.likelyCause}`);
    lines.push(`  Next action: ${diagnosis.nextAction}`);
    lines.push(`  Where to look: ${diagnosis.whereToLook}`);
  }
  return lines;
}

module.exports = {
  buildLaymansDiagnosis,
  formatLaymansDiagnosisMarkdown,
  loadReports,
};

if (require.main === module) {
  const diagnoses = buildLaymansDiagnosis({
    projectRoot: getArgValue("--project-root"),
    failureMessage: getArgValue("--failure-message"),
    logPath: getArgValue("--log-path"),
    targetPlanId: getArgValue("--target-plan-id"),
    includeWarnings: hasArg("--include-warnings"),
  });
  const format = normalizeText(getArgValue("--format")).toLowerCase() || "json";

  if (format === "markdown") {
    process.stdout.write(`${formatLaymansDiagnosisMarkdown(diagnoses).join("\n")}\n`);
  } else {
    process.stdout.write(`${JSON.stringify(diagnoses, null, 2)}\n`);
  }
}
