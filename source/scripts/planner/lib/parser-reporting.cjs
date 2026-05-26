const {
  writeJsonReport,
  writeMarkdownReport,
} = require("./planner-reporting.cjs");
const {
  getRequirementSourceRoleStatus,
} = require("./source-scope.cjs");

const DEFAULT_CAMPUS_ORDER = ["uw-seattle", "uw-bothell", "uw-tacoma"];

function buildParserRecoveryMarkdownReport(report) {
  const lines = [
    "# Transfer Planner Parser Recovery Report",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    `- Owners triggering parser recovery: ${report.triggeredOwnerCount}`,
    `- Owners recovered: ${report.successfulOwnerCount}`,
    `- Owners unrecovered: ${report.unrecoveredOwnerCount}`,
    `- Owners with recovered schedulable sources: ${report.recoveredScheduledSourceOwnerCount}`,
    `- Owners with recovered support sources: ${report.recoveredSupportSourceOwnerCount}`,
    "",
    "## Trigger Codes",
    "",
    ...Object.entries(report.countsByTriggerCode ?? {})
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([code, count]) => `- ${code}: ${count}`),
    "",
    "## Attempted Strategies",
    "",
    ...Object.entries(report.countsByAttemptedStrategy ?? {})
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([strategy, count]) => `- ${strategy}: ${count}`),
    "",
    "## Unrecovered Blockers",
    "",
    ...Object.entries(report.countsByBlockerType ?? {})
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([blockerType, count]) => `- ${blockerType}: ${count}`),
    "",
  ];

  const recoveredOwners = (report.owners ?? []).filter((owner) => owner.succeeded);
  if (recoveredOwners.length) {
    lines.push("## Recovered Owners", "");
    for (const owner of recoveredOwners.slice(0, 80)) {
      lines.push(`### ${owner.ownerTitle}`);
      lines.push("");
      lines.push(`- Owner id: ${owner.ownerId}`);
      lines.push(`- Original source: ${owner.originalSourceUrl}`);
      lines.push(`- Trigger: ${(owner.triggerCodes ?? []).join(", ") || "n/a"}`);
      lines.push(`- Attempted strategies: ${(owner.attemptedStrategies ?? []).join(", ") || "n/a"}`);
      lines.push(
        `- Before/after parsed UW course count: ${
          owner.before?.parsedUwCourseCodeCount ?? 0
        } -> ${owner.after?.parsedUwCourseCodeCount ?? 0}`
      );
      lines.push(
        `- Before/after warnings: ${(owner.before?.qualityWarningCodes ?? []).join(", ") || "none"} -> ${(owner.after?.qualityWarningCodes ?? []).join(", ") || "none"}`
      );
      for (const source of owner.recoveredSources ?? []) {
        lines.push(
          `- Recovered source: ${source.strategy}; ${source.sourceUrl}; parsed=${source.parsedUwCourseCodeCount}; fingerprint=${source.sourceEvidenceFingerprint}`
        );
      }
      for (const source of owner.supportSources ?? []) {
        lines.push(
          `- Support source: ${source.strategy}; ${source.sourceUrl}; accepted=${source.acceptedUwCourseCodeCount}; fingerprint=${source.sourceEvidenceFingerprint}`
        );
      }
      lines.push("");
    }
  }

  const unrecoveredOwners = (report.owners ?? []).filter((owner) => !owner.succeeded);
  if (unrecoveredOwners.length) {
    lines.push("## Unrecovered Owners", "");
    for (const owner of unrecoveredOwners.slice(0, 120)) {
      lines.push(`### ${owner.ownerTitle}`);
      lines.push("");
      lines.push(`- Owner id: ${owner.ownerId}`);
      lines.push(`- Original source: ${owner.originalSourceUrl}`);
      lines.push(`- Trigger: ${(owner.triggerCodes ?? []).join(", ") || "n/a"}`);
      lines.push(`- Blocker: ${owner.blockerType ?? "unknown"}`);
      lines.push(`- Attempted strategies: ${(owner.attemptedStrategies ?? []).join(", ") || "none"}`);
      lines.push(
        `- Before/after parsed UW course count: ${
          owner.before?.parsedUwCourseCodeCount ?? 0
        } -> ${owner.after?.parsedUwCourseCodeCount ?? 0}`
      );
      lines.push("");
    }
  }

  return `${lines.join("\n")}\n`;
}

function writeParserRecoveryReport(report, options = {}) {
  writeJsonReport(options.jsonPath, report);
  writeMarkdownReport(options.markdownPath, buildParserRecoveryMarkdownReport(report));
}

function buildRequirementSourceParseMarkdownLines(report, options = {}) {
  const campusOrder = options.campusOrder ?? DEFAULT_CAMPUS_ORDER;
  const recoveryMarkdownPath = options.recoveryMarkdownPath ?? "n/a";
  const lines = [
    "# Transfer Planner Requirement Source Parse Report",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    `- Primary degree sources parsed: ${report.totalOwners}`,
    `- Parsed successfully: ${report.okCount}`,
    `- Parse failures: ${report.failedCount}`,
    `- Parsed requirement source adapter blocks: ${report.parsedRequirementSourceBlockCount}`,
    `- Parsed requirement atom candidates: ${report.parsedRequirementAtomCandidateCount}`,
    `- Parsed degree-map block candidates: ${report.parsedDegreeMapBlockCandidateCount}`,
    `- Parsed structured requirement course entries: ${report.parsedRequirementCourseCount}`,
    `- Parsed from cached snapshots after live-source failures: ${report.snapshotFallbackCount}`,
    `- Parsed from alternate official source URLs: ${report.countsByResolutionStrategy["alternate-official-source"] ?? 0}`,
    `- Owners with parsed UW course codes: ${report.withParsedCourseCodesCount}`,
    `- Owners with source-only UW course codes not currently in structured degree-map blocks: ${report.withSourceOnlyCourseCodesCount}`,
    `- Owners with no parsed UW course codes: ${report.withNoParsedCourseCodesCount}`,
    `- Owners with parser-quality warnings: ${report.ownersWithQualityWarningsCount}`,
    `- Owners with parser-quality notes: ${report.ownersWithQualityNotesCount}`,
    `- Owners triggering parser auto-recovery: ${report.parserRecoveryReport?.triggeredOwnerCount ?? 0}`,
    `- Owners recovered by parser auto-recovery: ${report.parserRecoveryReport?.successfulOwnerCount ?? 0}`,
    "",
    "## Parser Adapters",
    "",
    ...Object.entries(report.countsByAdapterId)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([adapterId, count]) => `- ${adapterId}: ${count}`),
    "",
    "## Resolution Strategies",
    "",
    ...Object.entries(report.countsByResolutionStrategy)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([resolutionStrategy, count]) => `- ${resolutionStrategy}: ${count}`),
    "",
    "## Source Roles",
    "",
    ...Object.entries(report.countsBySourceRole ?? {})
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([sourceRole, count]) => `- ${sourceRole}: ${count}`),
    "",
    "## Source Role Statuses",
    "",
    ...Object.entries(report.countsBySourceRoleStatus ?? {})
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([sourceRoleStatus, count]) => `- ${sourceRoleStatus}: ${count}`),
    `- can-create-schedulable-rows: ${report.canCreateSchedulableRowCount ?? 0}`,
    `- can-create-required-rows: ${report.canCreateRequiredRowCount ?? 0}`,
    `- can-create-option-groups: ${report.canCreateOptionGroupCount ?? 0}`,
    `- can-create-approved-filters: ${report.canCreateApprovedFilterCount ?? 0}`,
    `- can-create-elective-lists: ${report.canCreateElectiveListCount ?? 0}`,
    `- support-only sources: ${report.supportOnlySourceCount ?? 0}`,
    `- non-schedulable sources: ${report.nonSchedulableSourceCount ?? 0}`,
    "",
    "## Parser Quality Signals",
    "",
    ...Object.entries(report.countsByQualitySignalCode)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([code, count]) => `- ${code}: ${count}`),
    "",
    "## Parser Auto-Recovery",
    "",
    `- Triggered owners: ${report.parserRecoveryReport?.triggeredOwnerCount ?? 0}`,
    `- Successful recoveries: ${report.parserRecoveryReport?.successfulOwnerCount ?? 0}`,
    `- Unrecovered owners: ${report.parserRecoveryReport?.unrecoveredOwnerCount ?? 0}`,
    `- Recovered schedulable source owners: ${report.parserRecoveryReport?.recoveredScheduledSourceOwnerCount ?? 0}`,
    `- Recovered support source owners: ${report.parserRecoveryReport?.recoveredSupportSourceOwnerCount ?? 0}`,
    `- Detailed report: ${recoveryMarkdownPath}`,
    "",
  ];

  if (report.uwMseCourseExtractionAudit) {
    const audit = report.uwMseCourseExtractionAudit;
    lines.push("## UW MSE Course Extraction Audit", "");
    lines.push(`- Total parsed official entries: ${audit.totalParsedOfficialEntries}`);
    lines.push(
      `- Required / option / alias / note-only counts: ${audit.requiredVsOptionCounts.required} / ${audit.requiredVsOptionCounts.option} / ${audit.requiredVsOptionCounts.alias} / ${audit.requiredVsOptionCounts.noteOnly}`
    );
    lines.push(
      `- Missing expected courses: ${audit.missingExpectedCourses.length ? audit.missingExpectedCourses.join(", ") : "none"}`
    );
    lines.push(
      `- Duplicate normalized course codes: ${audit.duplicateNormalizedCourseCodes.length ? audit.duplicateNormalizedCourseCodes.join(", ") : "none"}`
    );
    lines.push(
      `- Unclassified course codes: ${audit.unclassifiedCourseCodes.length ? audit.unclassifiedCourseCodes.join(", ") : "none"}`
    );
    lines.push(
      `- Courses missing group/type/source metadata: ${audit.coursesMissingRequiredMetadata.length ? audit.coursesMissingRequiredMetadata.join(", ") : "none"}`
    );
    lines.push("- Grouped counts by category:");
    for (const [category, count] of Object.entries(audit.groupedCountsByCategory).sort(([left], [right]) =>
      left.localeCompare(right)
    )) {
      lines.push(`  - ${category}: ${count}`);
    }
    if (audit.noteOrRestrictionEntries.length) {
      lines.push("- Courses with notes or restrictions:");
      for (const entry of audit.noteOrRestrictionEntries.slice(0, 25)) {
        lines.push(
          `  - ${entry.normalizedCourseCode}: ${(entry.notes ?? []).join(" | ")}`
        );
      }
    }
    lines.push("");
  }

  if ((report.sourceSectionAuditLines ?? []).length) {
    lines.push("## Source Section Audit", "");
    for (const auditLine of report.sourceSectionAuditLines) {
      lines.push(`- ${auditLine}`);
    }
    lines.push("");
  }

  if ((report.sourceSectionFilterAuditLines ?? []).length) {
    lines.push("## Parser Prerequisite Filter Audit", "");
    for (const auditLine of report.sourceSectionFilterAuditLines.slice(0, 400)) {
      lines.push(`- ${auditLine}`);
    }
    if (report.sourceSectionFilterAuditLines.length > 400) {
      lines.push(
        `- ... ${report.sourceSectionFilterAuditLines.length - 400} additional parser prerequisite filter audit rows omitted from markdown.`
      );
    }
    lines.push("");
  }

  if ((report.parserSequenceChoiceAuditLines ?? []).length) {
    lines.push("## Parser Sequence-Choice Audit", "");
    for (const auditLine of report.parserSequenceChoiceAuditLines.slice(0, 400)) {
      lines.push(`- ${auditLine}`);
    }
    if (report.parserSequenceChoiceAuditLines.length > 400) {
      lines.push(
        `- ... ${report.parserSequenceChoiceAuditLines.length - 400} additional parser sequence-choice audit rows omitted from markdown.`
      );
    }
    lines.push("");
  }

  if ((report.sourceScopeAuditLines ?? []).length) {
    lines.push("## Source Scope Audit", "");
    for (const auditLine of report.sourceScopeAuditLines.slice(0, 400)) {
      lines.push(`- ${auditLine}`);
    }
    if (report.sourceScopeAuditLines.length > 400) {
      lines.push(`- ... ${report.sourceScopeAuditLines.length - 400} additional source-scope audit rows omitted from markdown.`);
    }
    lines.push("");
  }

  for (const campusId of campusOrder) {
    const campusOwners = report.owners.filter((owner) => owner.campusId === campusId);
    if (!campusOwners.length) {
      continue;
    }

    lines.push(`## ${campusId}`, "");

    const qualityOwners = campusOwners.filter((owner) =>
      (owner.qualitySignals ?? []).some((signal) => signal.severity === "warning")
    );
    if (qualityOwners.length) {
      lines.push("### Parser-quality warnings", "");
      qualityOwners.slice(0, 50).forEach((owner) => {
        lines.push(`#### ${owner.ownerTitle}`);
        lines.push("");
        lines.push(`- Source: ${owner.sourceUrl}`);
        lines.push(`- Parse confidence: ${owner.parseConfidence}`);
        lines.push(
          `- Quality warnings: ${owner.qualitySignals
            .filter((signal) => signal.severity === "warning")
            .map((signal) => `${signal.code}${signal.details ? ` (${signal.details})` : ""}`)
            .join(" | ")}`
        );
        if (owner.primarySourceUrl !== owner.sourceUrl) {
          lines.push(`- Primary source: ${owner.primarySourceUrl}`);
        }
        lines.push("");
      });
    }

    const driftOwners = campusOwners.filter((owner) => owner.sourceOnlyUwCourseCodes.length > 0);
    if (driftOwners.length) {
      lines.push("### Possible source-vs-structured drift", "");
      driftOwners.slice(0, 50).forEach((owner) => {
        lines.push(`#### ${owner.ownerTitle}`);
        lines.push("");
        lines.push(`- Source: ${owner.sourceUrl}`);
        if (owner.primarySourceUrl !== owner.sourceUrl) {
          lines.push(`- Primary source: ${owner.primarySourceUrl}`);
        }
        lines.push(`- Parser type: ${owner.parserType}`);
        lines.push(`- Source role: ${owner.sourceRole ?? "ignored"}`);
        lines.push(
          `- Source role status: ${
            owner.sourceRoleStatus ?? getRequirementSourceRoleStatus(owner.sourceRole ?? "ignored")
          }`
        );
        lines.push(
          `- Can create schedulable rows: ${owner.canCreateSchedulableRows !== false ? "yes" : "no"}`
        );
        lines.push(`- Parser adapter: ${owner.adapterId}`);
        lines.push(`- Resolution strategy: ${owner.resolutionStrategy}`);
        lines.push(`- Parse confidence: ${owner.parseConfidence}`);
        if (owner.usedSnapshotFallback) {
          lines.push(`- Snapshot fallback: ${owner.snapshotFallbackReason ?? "used cached source snapshot"}`);
        }
        lines.push(`- Source-only UW course codes: ${owner.sourceOnlyUwCourseCodes.join(", ")}`);
        if (owner.structuredOnlyUwCourseCodes.length) {
          lines.push(
            `- Structured-only UW course codes not seen in the parsed source: ${owner.structuredOnlyUwCourseCodes.join(", ")}`
          );
        }
        if (owner.requirementCueLines.length) {
          lines.push(`- Requirement cues: ${owner.requirementCueLines.slice(0, 3).join(" | ")}`);
        }
        if (owner.sourceSectionAudit?.line) {
          lines.push(`- ${owner.sourceSectionAudit.line}`);
        }
        lines.push(`- Snapshot: ${owner.snapshotPath ?? "n/a"}`);
        lines.push("");
      });
    }

    const noCourseOwners = campusOwners.filter(
      (owner) => owner.ok && owner.parsedUwCourseCodes.length === 0
    );
    if (noCourseOwners.length) {
      lines.push("### Parsed but no UW course codes found", "");
      noCourseOwners.slice(0, 50).forEach((owner) => {
        lines.push(`- ${owner.ownerTitle}`);
        lines.push(`  - Source: ${owner.sourceUrl}`);
        lines.push(`  - Source role: ${owner.sourceRole ?? "ignored"}`);
        lines.push(
          `  - Source role status: ${
            owner.sourceRoleStatus ?? getRequirementSourceRoleStatus(owner.sourceRole ?? "ignored")
          }`
        );
        lines.push(
          `  - Can create schedulable rows: ${owner.canCreateSchedulableRows !== false ? "yes" : "no"}`
        );
        lines.push(`  - Parser type: ${owner.parserType}`);
        if (owner.sourceSectionAudit?.line) {
          lines.push(`  - ${owner.sourceSectionAudit.line}`);
        }
        lines.push(`  - Requirement cues found: ${owner.requirementCueLines.length}`);
      });
      lines.push("");
    }

    const failedOwners = campusOwners.filter((owner) => !owner.ok);
    if (failedOwners.length) {
      lines.push("### Parse failures", "");
      failedOwners.slice(0, 50).forEach((owner) => {
        lines.push(`- ${owner.ownerTitle}`);
        lines.push(`  - Source: ${owner.sourceUrl}`);
        lines.push(`  - Source role: ${owner.sourceRole ?? "ignored"}`);
        lines.push(
          `  - Source role status: ${
            owner.sourceRoleStatus ?? getRequirementSourceRoleStatus(owner.sourceRole ?? "ignored")
          }`
        );
        lines.push(`  - Error: ${owner.error ?? "unknown error"}`);
      });
      lines.push("");
    }
  }

  return lines;
}

function buildRequirementSourceParseMarkdownReport(report, options = {}) {
  return `${buildRequirementSourceParseMarkdownLines(report, options).join("\n")}\n`;
}

function writeRequirementSourceParseMarkdownReport(report, options = {}) {
  writeMarkdownReport(
    options.markdownPath,
    buildRequirementSourceParseMarkdownReport(report, options)
  );
}

module.exports = {
  DEFAULT_CAMPUS_ORDER,
  buildParserRecoveryMarkdownReport,
  buildRequirementSourceParseMarkdownLines,
  buildRequirementSourceParseMarkdownReport,
  writeParserRecoveryReport,
  writeRequirementSourceParseMarkdownReport,
};
