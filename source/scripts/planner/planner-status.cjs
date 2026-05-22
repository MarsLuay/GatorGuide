const fs = require("fs");
const path = require("path");

require("ts-node").register({
  skipProject: true,
  transpileOnly: true,
  compilerOptions: {
    module: "CommonJS",
    moduleResolution: "node",
  },
});

const {
  TRANSFER_PLANNER_PARSED_REQUIREMENT_SOURCE_BLOCK_REGISTRY,
  TRANSFER_PLANNER_REQUIREMENT_DIFF_CLASSIFICATION_REGISTRY,
  TRANSFER_PLANNER_SOURCE_GAP_REGISTRY,
  TRANSFER_PLANNER_SOURCE_SUMMARY,
  getTransferPlannerAutoMatchedTrackRecommendation,
  getTransferPlannerMajorPlan,
  getTransferPlannerMajorsForCampus,
  getTransferPlannerPathwaysForPlan,
  getTransferPlannerStudentRuntimeMajorPlan,
  getTransferPlannerStudentRuntimePathwaysForPlan,
  getTransferPlannerTrack,
  isTransferPlannerStudentHiddenSourceGap,
} = require("../../constants/transfer-planner-source");
const {
  TRANSFER_PLANNER_DERIVED_SHARED_SOURCE_PLAN_ALIASES,
} = require("../../constants/transfer-planner-source/derived-shared-source-plans");

const REPO_ROOT = path.resolve(__dirname, "..", "..");
const TMP_DIR = path.resolve(REPO_ROOT, ".tmp");
const CAMPUSES = ["uw-bothell", "uw-seattle", "uw-tacoma"];

const REPORT_PATHS = {
  sourceGap: path.resolve(TMP_DIR, "transfer-planner-source-gaps.json"),
  requirementParse: path.resolve(TMP_DIR, "transfer-planner-requirement-source-parse-report.json"),
  sourcePipelineValidation: path.resolve(
    TMP_DIR,
    "transfer-planner-source-pipeline-validation.json"
  ),
  requirementDiff: path.resolve(TMP_DIR, "transfer-planner-requirement-diff-promotion-report.json"),
  ownerAudit: path.resolve(TMP_DIR, "transfer-planner-owner-audit.json"),
  hardening: path.resolve(TMP_DIR, "transfer-planner-hardening-report.json"),
  sourceYearCoverage: path.resolve(TMP_DIR, "transfer-planner-source-year-coverage.json"),
  plannerStatusJson: path.resolve(TMP_DIR, "transfer-planner-status.json"),
  plannerStatusMd: path.resolve(TMP_DIR, "transfer-planner-status.md"),
};

const DERIVED_ALIAS_BY_DERIVED_PLAN_ID = new Map(
  TRANSFER_PLANNER_DERIVED_SHARED_SOURCE_PLAN_ALIASES.map((alias) => [alias.derivedPlanId, alias])
);

function ensureTmpDir() {
  fs.mkdirSync(TMP_DIR, { recursive: true });
}

function readJsonOrNull(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function writeText(filePath, value) {
  fs.writeFileSync(filePath, value, "utf8");
}

function buildOwnerKey(planId, pathwayId) {
  return `${String(planId)}::${String(pathwayId ?? "")}`;
}

function pushUnique(list, value) {
  if (!value || list.includes(value)) {
    return;
  }

  list.push(value);
}

function pickFirst(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null && String(value).trim()) {
      return value;
    }
  }

  return null;
}

function countBy(values) {
  return values.reduce((counts, value) => {
    counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  }, {});
}

function escapeMarkdown(value) {
  return String(value ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/[|]/g, "\\|");
}

function addRequiredAction(queue, message) {
  if (!message || queue.includes(message)) {
    return;
  }
  queue.push(message);
}

function formatTrackLabel(trackId) {
  if (!trackId) {
    return "None";
  }

  const track = getTransferPlannerTrack(trackId);
  if (!track) {
    return trackId;
  }

  return `${track.title} (${trackId})`;
}

function plannerNarrativeMentionsTrack(scope, trackId) {
  if (!scope || !trackId) {
    return false;
  }

  const track = getTransferPlannerTrack(trackId);
  if (!track) {
    return false;
  }

  const plannerNarrative = [
    String(scope.recommendedTrackSummary ?? "").trim(),
    ...(scope.whyThisTrack ?? []).map((entry) => String(entry ?? "").trim()),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (!plannerNarrative) {
    return false;
  }

  return [track.code, track.title, trackId]
    .filter(Boolean)
    .some((token) => plannerNarrative.includes(String(token).toLowerCase()));
}

function buildGeneratedAndRuntimeRowMaps() {
  const generatedRowsByKey = new Map();
  const runtimeRowsByKey = new Map();

  for (const campusId of CAMPUSES) {
    for (const generatedPlan of getTransferPlannerMajorsForCampus(campusId)) {
      const planKey = buildOwnerKey(generatedPlan.id, null);
      const runtimePlan = getTransferPlannerStudentRuntimeMajorPlan(generatedPlan.id);

      generatedRowsByKey.set(planKey, {
        ownerKey: planKey,
        rowKind: "plan",
        planId: generatedPlan.id,
        pathwayId: null,
        campusId: generatedPlan.campusId,
        title: generatedPlan.title,
        row: generatedPlan,
      });

      if (runtimePlan) {
        runtimeRowsByKey.set(planKey, {
          ownerKey: planKey,
          rowKind: "plan",
          planId: generatedPlan.id,
          pathwayId: null,
          campusId: runtimePlan.campusId,
          title: runtimePlan.title,
          row: runtimePlan,
        });
      }

      const runtimePathwaysById = new Map(
        getTransferPlannerStudentRuntimePathwaysForPlan(runtimePlan).map((pathway) => [
          pathway.id,
          pathway,
        ])
      );

      for (const generatedPathway of getTransferPlannerPathwaysForPlan(generatedPlan)) {
        const pathwayKey = buildOwnerKey(generatedPlan.id, generatedPathway.id);
        const runtimePathway = runtimePathwaysById.get(generatedPathway.id) ?? null;

        generatedRowsByKey.set(pathwayKey, {
          ownerKey: pathwayKey,
          rowKind: "pathway",
          planId: generatedPlan.id,
          pathwayId: generatedPathway.id,
          campusId: generatedPlan.campusId,
          title: `${generatedPlan.title} - ${generatedPathway.label}`,
          row: generatedPathway,
        });

        if (runtimePathway) {
          runtimeRowsByKey.set(pathwayKey, {
            ownerKey: pathwayKey,
            rowKind: "pathway",
            planId: generatedPlan.id,
            pathwayId: generatedPathway.id,
            campusId: generatedPlan.campusId,
            title: `${generatedPlan.title} - ${runtimePathway.label}`,
            row: runtimePathway,
          });
        }
      }
    }
  }

  return {
    generatedRowsByKey,
    runtimeRowsByKey,
  };
}

function buildDiffEntriesByOwnerKey() {
  const diffEntriesByOwnerKey = new Map();

  for (const entry of TRANSFER_PLANNER_REQUIREMENT_DIFF_CLASSIFICATION_REGISTRY) {
    const ownerKey = buildOwnerKey(entry.planId, entry.pathwayId);
    const current = diffEntriesByOwnerKey.get(ownerKey) ?? [];
    current.push(entry);
    diffEntriesByOwnerKey.set(ownerKey, current);
  }

  return diffEntriesByOwnerKey;
}

function buildParsedBlockCountByOwnerKey() {
  const counts = new Map();

  for (const block of TRANSFER_PLANNER_PARSED_REQUIREMENT_SOURCE_BLOCK_REGISTRY) {
    if (!block.ok) {
      continue;
    }

    const ownerKey = buildOwnerKey(block.planId, block.pathwayId);
    counts.set(ownerKey, (counts.get(ownerKey) ?? 0) + 1);
  }

  return counts;
}

function buildPlannerCompletenessReport(reports, previousStatusReport = null) {
  const ownerAuditOwners = reports.ownerAudit?.owners ?? [];
  const parseOwners = reports.requirementParse?.owners ?? [];
  const sourceGapEntries = TRANSFER_PLANNER_SOURCE_GAP_REGISTRY;
  const parsedBlockCountByOwnerKey = buildParsedBlockCountByOwnerKey();
  const diffEntriesByOwnerKey = buildDiffEntriesByOwnerKey();
  const { generatedRowsByKey, runtimeRowsByKey } = buildGeneratedAndRuntimeRowMaps();

  const ownerAuditByKey = new Map(ownerAuditOwners.map((owner) => [owner.ownerKey, owner]));
  const parseOwnerByKey = new Map(
    parseOwners.map((owner) => [buildOwnerKey(owner.planId, owner.pathwayId), owner])
  );
  const sourceGapByKey = new Map(
    sourceGapEntries.map((entry) => [buildOwnerKey(entry.planId, entry.pathwayId), entry])
  );

  const allOwnerKeys = new Set([
    ...ownerAuditByKey.keys(),
    ...parseOwnerByKey.keys(),
    ...sourceGapByKey.keys(),
    ...generatedRowsByKey.keys(),
    ...runtimeRowsByKey.keys(),
  ]);

  const inventory = [...allOwnerKeys]
    .map((ownerKey) => {
      const generatedRow = generatedRowsByKey.get(ownerKey) ?? null;
      const runtimeRow = runtimeRowsByKey.get(ownerKey) ?? null;
      const generatedPlan = generatedRow?.rowKind === "plan" ? generatedRow.row : null;
      const runtimePlan = runtimeRow?.rowKind === "plan" ? runtimeRow.row : null;
      const directOwner = ownerAuditByKey.get(ownerKey) ?? null;
      const directParseOwner = parseOwnerByKey.get(ownerKey) ?? null;
      const sourceGap = sourceGapByKey.get(ownerKey) ?? null;

      const planId = pickFirst(
        generatedRow?.planId,
        runtimeRow?.planId,
        directOwner?.planId,
        directParseOwner?.planId,
        sourceGap?.planId
      );
      const pathwayId =
        pickFirst(
          generatedRow?.pathwayId,
          runtimeRow?.pathwayId,
          directOwner?.pathwayId,
          directParseOwner?.pathwayId,
          sourceGap?.pathwayId
        ) ?? null;
      const campusId = pickFirst(
        generatedRow?.campusId,
        runtimeRow?.campusId,
        directOwner?.campusId,
        directParseOwner?.campusId,
        sourceGap?.campusId
      );
      const derivedAlias = DERIVED_ALIAS_BY_DERIVED_PLAN_ID.get(planId ?? "") ?? null;
      const canonicalPlanId = derivedAlias?.sourcePlanId ?? planId;
      const canonicalOwnerKey = buildOwnerKey(canonicalPlanId, pathwayId);
      const canonicalOwner = ownerAuditByKey.get(canonicalOwnerKey) ?? directOwner;
      const canonicalParseOwner = parseOwnerByKey.get(canonicalOwnerKey) ?? directParseOwner;
      const parsedSourceBlock = Boolean(
        parsedBlockCountByOwnerKey.get(canonicalOwnerKey) ?? parsedBlockCountByOwnerKey.get(ownerKey)
      );
      const diffEntries =
        diffEntriesByOwnerKey.get(canonicalOwnerKey) ??
        diffEntriesByOwnerKey.get(ownerKey) ??
        [];
      const noPublicClassificationCount = diffEntries.filter((entry) =>
        String(entry.classificationKind ?? "").includes("no-public")
      ).length;
      const generatedPlanRow = generatedPlan ?? getTransferPlannerMajorPlan(planId ?? "");
      const hiddenSourceGap =
        Boolean(sourceGap?.studentVisibility === "hidden") ||
        Boolean(isTransferPlannerStudentHiddenSourceGap(planId, pathwayId));
      const studentVisibility = hiddenSourceGap ? "hidden" : "visible";
      const sourceBacked = Boolean(
        !hiddenSourceGap &&
          (canonicalOwner ||
            canonicalParseOwner ||
            parsedSourceBlock ||
            (derivedAlias &&
              (ownerAuditByKey.has(canonicalOwnerKey) || parseOwnerByKey.has(canonicalOwnerKey))))
      );
      const emittedGeneratedRow = Boolean(generatedRow);
      const emittedRuntimeRow = Boolean(runtimeRow);
      const runtimeScope = runtimeRow?.row ?? null;
      const generatedScope = generatedRow?.row ?? null;
      const bestTrackId = runtimeScope?.bestTrackId ?? null;
      const bestTrackPresent = Boolean(bestTrackId);
      const runtimeCourseList = runtimeScope?.grcCourseList ?? [];
      const fullRuntimeRecommendation = emittedRuntimeRow
        ? getTransferPlannerAutoMatchedTrackRecommendation(runtimeCourseList, bestTrackId)
        : null;
      const currentTrackNarrativeMatch = plannerNarrativeMentionsTrack(runtimeScope, bestTrackId);
      const recommendedTrackNarrativeMatch = plannerNarrativeMentionsTrack(
        runtimeScope,
        fullRuntimeRecommendation?.trackId ?? null
      );
      const bestTrackLooksWrong = Boolean(
        bestTrackId &&
          fullRuntimeRecommendation?.trackId &&
          fullRuntimeRecommendation.trackId !== bestTrackId &&
          recommendedTrackNarrativeMatch &&
          !currentTrackNarrativeMatch
      );
      const missingBestTrackDespiteSupport = Boolean(
        emittedRuntimeRow && !bestTrackId && fullRuntimeRecommendation?.trackId
      );
      const intentionallyUnmatched = Boolean(
        emittedRuntimeRow &&
          !bestTrackId &&
          !fullRuntimeRecommendation?.trackId &&
          !hiddenSourceGap
      );
      const notes = [];

      if (derivedAlias) {
        pushUnique(
          notes,
          `Derived shared-source alias of ${derivedAlias.sourcePlanId}; inherits source-backed coverage from the canonical owner.`
        );
      }

      if ((canonicalOwner?.rootIssues ?? []).length > 0) {
        pushUnique(
          notes,
          `Owner-audit signals: ${(canonicalOwner.rootIssues ?? [])
            .map((issue) => issue.code)
            .join(", ")}.`
        );
      }

      if (hiddenSourceGap) {
        pushUnique(
          notes,
          sourceGap?.sourceGapReason
            ? `Hidden source gap: ${sourceGap.sourceGapReason}`
            : "Hidden source gap: no planner-safe primary source or parser support is currently available."
        );
      }

      if (bestTrackLooksWrong) {
        pushUnique(
          notes,
          `Current best track ${formatTrackLabel(bestTrackId)} conflicts with the full runtime course-pool recommendation ${formatTrackLabel(
            fullRuntimeRecommendation.trackId
          )}.`
        );
        pushUnique(notes, "Root cause: narrowed checklist seed weakness.");
      }

      if (missingBestTrackDespiteSupport) {
        pushUnique(
          notes,
          `Runtime row has planner-visible GRC support for ${formatTrackLabel(
            fullRuntimeRecommendation.trackId
          )}, but bestTrackId is still null.`
        );
      }

      if (intentionallyUnmatched && runtimeCourseList.length === 0) {
        pushUnique(
          notes,
          noPublicClassificationCount > 0
            ? `Intentional safe-empty state: ${noPublicClassificationCount} source-backed requirement classifications still land in no-public/no-path families, so no planner-safe GRC course pool is emitted.`
            : "Intentional safe-empty state: no planner-safe student-visible GRC course pool is emitted for this row."
        );
      }

      if (intentionallyUnmatched && runtimeCourseList.length > 0) {
        pushUnique(
          notes,
          `Intentional non-match: ${runtimeCourseList.join(
            ", "
          )} survives into the runtime course pool, but no associate track reaches a stable overlap on the full visible course list.`
        );
      }

      let bucket = "complete-matched";
      let finalState = "matched";
      let reasonCode = "matched";

      if (hiddenSourceGap) {
        bucket = "true hidden source gap";
        finalState = "hidden-source-gap";
        reasonCode = "hidden-source-gap";
      } else if (!sourceBacked) {
        bucket = "source discovery missing";
        finalState = "incomplete";
        reasonCode = "source-discovery-missing";
      } else if (parsedSourceBlock && !emittedGeneratedRow) {
        bucket = "parsed source exists but no structured generation";
        finalState = "incomplete";
        reasonCode = "structured-generation-missing";
      } else if (emittedGeneratedRow && !emittedRuntimeRow) {
        bucket = "structured generation exists but no runtime materialization";
        finalState = "incomplete";
        reasonCode = "runtime-materialization-missing";
      } else if (bestTrackLooksWrong) {
        bucket = pathwayId ? "pathway-specific drift" : "runtime row exists but best-track looks wrong";
        finalState = "incomplete";
        reasonCode = "best-track-drift";
      } else if (missingBestTrackDespiteSupport) {
        bucket = "runtime row exists but no best-track match";
        finalState = "incomplete";
        reasonCode = "missing-best-track-despite-support";
      } else if (intentionallyUnmatched && runtimeCourseList.length === 0) {
        bucket = "safe intentional empty state";
        finalState = "intentionally-unmatched";
        reasonCode = "safe-intentional-empty-state";
      } else if (intentionallyUnmatched) {
        bucket = "runtime row exists but no best-track match";
        finalState = "intentionally-unmatched";
        reasonCode = "intentional-weak-signal-non-match";
      }

      return {
        ownerId:
          canonicalOwner?.ownerId ??
          sourceGap?.ownerId ??
          directParseOwner?.ownerId ??
          planId ??
          ownerKey,
        ownerKey,
        canonicalOwnerKey,
        planId,
        pathwayId,
        rowKind: pathwayId ? "pathway" : "plan",
        campusId,
        title:
          pickFirst(
            runtimeRow?.title,
            generatedRow?.title,
            canonicalOwner?.title,
            directParseOwner?.ownerTitle,
            sourceGap?.majorTitle
          ) ?? ownerKey,
        studentVisibility,
        hiddenSourceGap,
        sourceBacked,
        parsedSourceBlock,
        emittedGeneratedRow,
        emittedStudentRuntimeRow: emittedRuntimeRow,
        bestTrackPresent,
        bestTrackId,
        bestTrackTitle: bestTrackId ? getTransferPlannerTrack(bestTrackId)?.title ?? null : null,
        intentionallyUnmatched,
        notes,
        bucket,
        finalState,
        reasonCode,
        isDerivedSharedSourceAlias: Boolean(derivedAlias),
        derivedSourcePlanId: derivedAlias?.sourcePlanId ?? null,
        ownerWarningCodes: (canonicalOwner?.rootIssues ?? []).map((issue) => issue.code),
        runtimeGrcCourseCount: runtimeCourseList.length,
        runtimeGrcCourseList: [...runtimeCourseList],
        recommendedTrackId: fullRuntimeRecommendation?.trackId ?? null,
        recommendedTrackTitle: fullRuntimeRecommendation?.trackId
          ? getTransferPlannerTrack(fullRuntimeRecommendation.trackId)?.title ?? null
          : null,
        recommendedTrackMatchCount: fullRuntimeRecommendation?.matchCount ?? 0,
        noPublicClassificationCount,
        diffClassificationKinds: [...new Set(diffEntries.map((entry) => entry.classificationKind))],
        generatedCoverage: generatedPlanRow?.coverage ?? null,
        generatedPathwayCount: getTransferPlannerPathwaysForPlan(generatedPlanRow).length,
      };
    })
    .sort((left, right) => {
      if (left.campusId !== right.campusId) {
        return String(left.campusId).localeCompare(String(right.campusId));
      }
      if (left.planId !== right.planId) {
        return String(left.planId).localeCompare(String(right.planId));
      }
      return String(left.pathwayId ?? "").localeCompare(String(right.pathwayId ?? ""));
    });

  const visibleRows = inventory.filter((row) => row.studentVisibility === "visible");
  const hiddenRows = inventory.filter((row) => row.hiddenSourceGap);
  const visibleSourceBackedRows = visibleRows.filter((row) => row.sourceBacked);
  const visibleGeneratedRows = visibleRows.filter((row) => row.emittedGeneratedRow);
  const visibleRuntimeRows = visibleRows.filter((row) => row.emittedStudentRuntimeRow);
  const matchedRows = visibleRows.filter((row) => row.finalState === "matched");
  const intentionallyUnmatchedRows = inventory.filter(
    (row) => row.finalState === "intentionally-unmatched"
  );
  const attentionRows = inventory.filter((row) => row.finalState === "incomplete");
  const unexpectedNullRuntimeRows = visibleSourceBackedRows.filter(
    (row) => !row.emittedStudentRuntimeRow
  );
  const visibleOwnerRows = inventory.filter(
    (row) => row.sourceBacked && row.studentVisibility === "visible" && !row.isDerivedSharedSourceAlias
  );
  const visibleMajorCount = visibleRows.filter((row) => row.rowKind === "plan").length;
  const visiblePathwayCount = visibleRows.filter((row) => row.rowKind === "pathway").length;
  const attentionCountsByBucket = countBy(attentionRows.map((row) => row.bucket));
  const intentionallyUnmatchedCountsByReasonCode = countBy(
    intentionallyUnmatchedRows.map((row) => row.reasonCode)
  );
  const dominantIncompleteBucket = Object.entries(attentionCountsByBucket).sort(
    (left, right) => right[1] - left[1] || left[0].localeCompare(right[0])
  )[0]?.[0] ?? null;
  const dominantExceptionBucket = Object.entries(intentionallyUnmatchedCountsByReasonCode).sort(
    (left, right) => right[1] - left[1] || left[0].localeCompare(right[0])
  )[0]?.[0] ?? null;
  const previouslyIntentionallyUnmatchedOwnerKeys = new Set(
    (previousStatusReport?.intentionallyUnmatchedRows ?? []).map((row) => row.ownerKey)
  );
  const newlyConvertedFromIntentionalUnmatchedRows = matchedRows.filter((row) =>
    previouslyIntentionallyUnmatchedOwnerKeys.has(row.ownerKey)
  );

  return {
    generatedAt: new Date().toISOString(),
    summary: {
      totalPlannerOwners: reports.ownerAudit?.totalOwners ?? ownerAuditByKey.size,
      totalStudentVisibleRows: visibleRows.length,
      totalStudentVisibleMajors: visibleMajorCount,
      totalStudentVisiblePathways: visiblePathwayCount,
      totalHiddenSourceGapOwners: hiddenRows.length,
      totalSourceBackedVisibleOwners: visibleOwnerRows.length,
      totalVisibleSourceBackedRows: visibleSourceBackedRows.length,
      totalEmittedGeneratedRows: visibleGeneratedRows.length,
      totalEmittedRuntimeRows: visibleRuntimeRows.length,
      totalRowsWithBestTrackMatches: matchedRows.length,
      totalRowsWithBestTrackIds: visibleRows.filter((row) => row.bestTrackPresent).length,
      totalIntentionallyUnmatchedRows: intentionallyUnmatchedRows.length,
      newlyConvertedFromIntentionalUnmatchedCount:
        newlyConvertedFromIntentionalUnmatchedRows.length,
      unexpectedNullRuntimeRowsAmongVisibleSourceBackedOwners: unexpectedNullRuntimeRows.length,
      derivedSharedSourceVisibleRows: visibleRows.filter((row) => row.isDerivedSharedSourceAlias).length,
      hiddenSourceGapRowCount: hiddenRows.length,
      rowsNeedingAttentionCount: attentionRows.length,
    },
    finalStateCounts: countBy(inventory.map((row) => row.finalState)),
    bucketCounts: countBy(inventory.map((row) => row.bucket)),
    attentionCountsByBucket,
    intentionallyUnmatchedCountsByReasonCode,
    dominantIncompleteBucket,
    dominantExceptionBucket,
    ownerAuditSummary: reports.ownerAudit
      ? {
          ownersWithErrorsCount: reports.ownerAudit.ownersWithErrorsCount,
          ownersWithWarningsCount: reports.ownerAudit.ownersWithWarningsCount,
          ownersWithSourceOnlyUwCourseCodesCount:
            reports.ownerAudit.ownersWithSourceOnlyUwCourseCodesCount,
          totalSourceOnlyUwCourseCodes: reports.ownerAudit.totalSourceOnlyUwCourseCodes,
        }
      : null,
    parseSummary: reports.requirementParse
      ? {
          totalOwners: reports.requirementParse.totalOwners,
          okCount: reports.requirementParse.okCount,
          parsedRequirementSourceBlockCount:
            reports.requirementParse.parsedRequirementSourceBlockCount,
          withNoParsedCourseCodesCount: reports.requirementParse.withNoParsedCourseCodesCount,
          ownersWithQualityWarningsCount: reports.requirementParse.ownersWithQualityWarningsCount,
        }
      : null,
    sourceSummary: {
      sourceGeneratedMajorPlanCount: TRANSFER_PLANNER_SOURCE_SUMMARY.sourceGeneratedMajorPlanCount,
      studentVisibleMajorPlanCount: TRANSFER_PLANNER_SOURCE_SUMMARY.studentVisibleMajorPlanCount,
      sourceGeneratedPathwayCount: TRANSFER_PLANNER_SOURCE_SUMMARY.sourceGeneratedPathwayCount,
      studentVisiblePathwayCount: TRANSFER_PLANNER_SOURCE_SUMMARY.studentVisiblePathwayCount,
      parsedRequirementSourceBlockCount:
        TRANSFER_PLANNER_SOURCE_SUMMARY.parsedRequirementSourceBlockCount,
      hiddenSourceGapCount: TRANSFER_PLANNER_SOURCE_SUMMARY.sourceGapCount,
    },
    attentionRows,
    intentionallyUnmatchedRows,
    newlyConvertedFromIntentionalUnmatchedRows,
    hiddenRows,
    inventory,
  };
}

function buildRequiredUpdateQueue(reports, statusReport) {
  const queue = [];

  if (reports.sourceGap && Number(reports.sourceGap.totalSourceGapOwners) > 0) {
    addRequiredAction(
      queue,
      "Resolve source gaps: add stronger official source discovery/parser support until hidden source-gap owners reaches 0."
    );
  }

  if (reports.requirementParse && Number(reports.requirementParse.failedCount) > 0) {
    addRequiredAction(
      queue,
      "Fix requirement parsing failures: update source manifest links or parser adapters for owners that did not parse cleanly."
    );
  }

  if (
    reports.sourcePipelineValidation &&
    String(reports.sourcePipelineValidation.outcome).toLowerCase() !== "passed"
  ) {
    addRequiredAction(
      queue,
      "Clear source-pipeline invariant failures: align discovery, promotions, canonical registry, parser input, and fingerprints before rerunning owner audit."
    );
  }

  if (
    reports.requirementDiff &&
    (Number(reports.requirementDiff.reviewCandidateCount) > 0 ||
      Number(reports.requirementDiff.unmappedCount) > 0)
  ) {
    addRequiredAction(
      queue,
      "Resolve requirement diff promotion debt: reduce review-needed/unmapped requirement diffs to 0 through parser or mapping updates."
    );
  }

  const ownerErrors = Number(reports.ownerAudit?.issueCounts?.error ?? 0);
  const ownerWarnings = Number(reports.ownerAudit?.issueCounts?.warning ?? 0);
  if (reports.ownerAudit && (ownerErrors > 0 || ownerWarnings > 0)) {
    addRequiredAction(
      queue,
      "Address owner-audit issues: fix missing/invalid primary sources, manifest gaps, and parser fallback warnings."
    );
  }

  if (reports.hardening && String(reports.hardening.outcome).toLowerCase() !== "passed") {
    addRequiredAction(
      queue,
      "Clear hardening failures: fix failing checks in transfer-planner-hardening-report.md before shipping planner updates."
    );
  }

  if (reports.sourceYearCoverage && String(reports.sourceYearCoverage.outcome).toLowerCase() !== "ok") {
    const actions = Array.isArray(reports.sourceYearCoverage.requiredActions)
      ? reports.sourceYearCoverage.requiredActions
      : [];
    if (actions.length) {
      for (const action of actions) {
        addRequiredAction(queue, action);
      }
    } else {
      addRequiredAction(
        queue,
        "Source year coverage needs attention: latest schedule coverage is not aligned with current/future academic year baselines."
      );
    }
  }

  if (Number(statusReport?.summary?.rowsNeedingAttentionCount ?? 0) > 0) {
    addRequiredAction(
      queue,
      `Clear planner completeness gaps: ${statusReport.summary.rowsNeedingAttentionCount} row(s) still need attention (${statusReport.dominantIncompleteBucket ?? "mixed"}).`
    );
  }

  if (Number(statusReport?.summary?.unexpectedNullRuntimeRowsAmongVisibleSourceBackedOwners ?? 0) > 0) {
    addRequiredAction(
      queue,
      "Restore runtime materialization: visible source-backed rows should not be missing student runtime plans."
    );
  }

  return queue;
}

function buildMarkdownReport(statusReport, queue) {
  const lines = [];
  const summaryRows = [
    ["Total planner owners", statusReport.summary.totalPlannerOwners],
    ["Visible majors/pathways", statusReport.summary.totalStudentVisibleRows],
    ["Visible majors", statusReport.summary.totalStudentVisibleMajors],
    ["Visible pathways", statusReport.summary.totalStudentVisiblePathways],
    ["Hidden source-gap owners", statusReport.summary.totalHiddenSourceGapOwners],
    ["Visible source-backed owners", statusReport.summary.totalSourceBackedVisibleOwners],
    ["Visible source-backed rows", statusReport.summary.totalVisibleSourceBackedRows],
    ["Emitted generated rows", statusReport.summary.totalEmittedGeneratedRows],
    ["Emitted runtime rows", statusReport.summary.totalEmittedRuntimeRows],
    ["Rows with best-track matches", statusReport.summary.totalRowsWithBestTrackMatches],
    ["Rows with best-track ids", statusReport.summary.totalRowsWithBestTrackIds],
    ["Intentionally unmatched rows", statusReport.summary.totalIntentionallyUnmatchedRows],
    [
      "Rows newly converted from intentional-unmatched to matched",
      statusReport.summary.newlyConvertedFromIntentionalUnmatchedCount,
    ],
    [
      "Unexpected null runtime rows among visible source-backed owners",
      statusReport.summary.unexpectedNullRuntimeRowsAmongVisibleSourceBackedOwners,
    ],
    ["Rows needing attention", statusReport.summary.rowsNeedingAttentionCount],
  ];

  lines.push("# Transfer Planner Status");
  lines.push("");
  lines.push(`Generated at: ${statusReport.generatedAt}`);
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  lines.push("| Metric | Value |");
  lines.push("| --- | ---: |");
  for (const [label, value] of summaryRows) {
    lines.push(`| ${escapeMarkdown(label)} | ${escapeMarkdown(value)} |`);
  }

  lines.push("");
  lines.push("## Classification counts");
  lines.push("");
  lines.push("| Bucket | Count |");
  lines.push("| --- | ---: |");
  for (const [bucket, count] of Object.entries(statusReport.bucketCounts).sort((left, right) =>
    left[0].localeCompare(right[0])
  )) {
    lines.push(`| ${escapeMarkdown(bucket)} | ${count} |`);
  }

  lines.push("");
  lines.push("## Rows needing attention");
  lines.push("");
  if (!statusReport.attentionRows.length) {
    lines.push("- None.");
  } else {
    for (const row of statusReport.attentionRows) {
      lines.push(
        `- ${row.ownerKey} — ${row.bucket} — ${row.notes.join(" ") || "No notes captured."}`
      );
    }
  }

  lines.push("");
  lines.push("## Intentionally unmatched rows");
  lines.push("");
  if (!statusReport.intentionallyUnmatchedRows.length) {
    lines.push("- None.");
  } else {
    for (const row of statusReport.intentionallyUnmatchedRows) {
      lines.push(
        `- ${row.ownerKey} — ${row.reasonCode} — ${row.notes.join(" ") || "No notes captured."}`
      );
    }
  }

  lines.push("");
  lines.push("## Newly converted rows");
  lines.push("");
  if (!statusReport.newlyConvertedFromIntentionalUnmatchedRows.length) {
    lines.push("- None.");
  } else {
    for (const row of statusReport.newlyConvertedFromIntentionalUnmatchedRows) {
      lines.push(
        `- ${row.ownerKey} — matched — ${row.bestTrackId ?? "No best track id recorded."} — ${row.notes.join(" ") || "No notes captured."}`
      );
    }
  }

  lines.push("");
  lines.push("## Hidden source-gap rows");
  lines.push("");
  if (!statusReport.hiddenRows.length) {
    lines.push("- None.");
  } else {
    for (const row of statusReport.hiddenRows) {
      lines.push(
        `- ${row.ownerKey} — ${row.reasonCode} — ${row.notes.join(" ") || "No notes captured."}`
      );
    }
  }

  lines.push("");
  lines.push("## Required update queue");
  lines.push("");
  if (!queue.length) {
    lines.push("- None. All monitored automation gates and planner completeness checks are clean.");
  } else {
    for (const item of queue) {
      lines.push(`- ${item}`);
    }
  }

  lines.push("");
  lines.push("## Inventory");
  lines.push("");
  lines.push(
    `Full machine-readable inventory with owner/runtime/matching fields is available in ${path.basename(
      REPORT_PATHS.plannerStatusJson
    )}.`
  );

  return `${lines.join("\n")}\n`;
}

function main() {
  ensureTmpDir();
  const previousStatusReport = readJsonOrNull(REPORT_PATHS.plannerStatusJson);

  const reports = {
    sourceGap: readJsonOrNull(REPORT_PATHS.sourceGap),
    requirementParse: readJsonOrNull(REPORT_PATHS.requirementParse),
    sourcePipelineValidation: readJsonOrNull(REPORT_PATHS.sourcePipelineValidation),
    requirementDiff: readJsonOrNull(REPORT_PATHS.requirementDiff),
    ownerAudit: readJsonOrNull(REPORT_PATHS.ownerAudit),
    hardening: readJsonOrNull(REPORT_PATHS.hardening),
    sourceYearCoverage: readJsonOrNull(REPORT_PATHS.sourceYearCoverage),
  };

  const statusReport = buildPlannerCompletenessReport(reports, previousStatusReport);
  const queue = buildRequiredUpdateQueue(reports, statusReport);
  const markdownReport = buildMarkdownReport(statusReport, queue);

  writeJson(REPORT_PATHS.plannerStatusJson, {
    ...statusReport,
    requiredUpdateQueue: queue,
  });
  writeText(REPORT_PATHS.plannerStatusMd, markdownReport);

  console.log("Planner completeness status:");
  console.log(`- Planner owners: ${statusReport.summary.totalPlannerOwners}`);
  console.log(
    `- Visible rows: ${statusReport.summary.totalStudentVisibleRows} (${statusReport.summary.totalStudentVisibleMajors} majors, ${statusReport.summary.totalStudentVisiblePathways} pathways)`
  );
  console.log(
    `- Visible source-backed rows: ${statusReport.summary.totalVisibleSourceBackedRows}`
  );
  console.log(
    `- Emitted rows: ${statusReport.summary.totalEmittedGeneratedRows} generated / ${statusReport.summary.totalEmittedRuntimeRows} runtime`
  );
  console.log(
    `- Best-track matches: ${statusReport.summary.totalRowsWithBestTrackMatches}`
  );
  console.log(
    `- Intentionally unmatched rows: ${statusReport.summary.totalIntentionallyUnmatchedRows}`
  );
  console.log(
    `- Newly converted rows: ${statusReport.summary.newlyConvertedFromIntentionalUnmatchedCount}`
  );
  console.log(
    `- Rows needing attention: ${statusReport.summary.rowsNeedingAttentionCount}`
  );
  console.log(
    `- Unexpected null runtime rows among visible source-backed owners: ${statusReport.summary.unexpectedNullRuntimeRowsAmongVisibleSourceBackedOwners}`
  );
  console.log("");
  console.log("Required update queue:");
  if (!queue.length) {
    console.log("- None. All monitored automation gates and planner completeness checks are clean.");
  } else {
    for (const item of queue) {
      console.log(`- ${item}`);
    }
  }
  console.log("");
  console.log(`Wrote ${path.relative(REPO_ROOT, REPORT_PATHS.plannerStatusJson)}`);
  console.log(`Wrote ${path.relative(REPO_ROOT, REPORT_PATHS.plannerStatusMd)}`);
}

main();
