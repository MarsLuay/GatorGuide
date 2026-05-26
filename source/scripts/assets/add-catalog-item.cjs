#!/usr/bin/env node
/* global __dirname, Buffer */

const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const MOBILE_TEAM_ROOT = path.resolve(__dirname, "..", "..");
const REPO_ROOT = path.resolve(MOBILE_TEAM_ROOT, "..");
const OPPORTUNITIES_PATH =
  process.env.GATORGUIDE_OPPORTUNITIES_PATH ||
  path.join(MOBILE_TEAM_ROOT, "data", "starter-opportunities.json");
const RESOURCES_PATH =
  process.env.GATORGUIDE_RESOURCES_PATH ||
  path.join(MOBILE_TEAM_ROOT, "data", "resource-catalog.json");
const RESOURCE_EXCEL_EXPORT_PATH =
  process.env.GATORGUIDE_RESOURCE_EXCEL_EXPORT_PATH ||
  path.join(REPO_ROOT, "resource-catalog-export.xlsx");
const RESOURCE_COMMIT_MESSAGE = "Added resources";
const GOOGLE_SHEETS_EXPORT_URL =
  process.env.GATORGUIDE_GOOGLE_SHEETS_EXPORT_URL || "https://sheets.new";


const {
  FINANCIAL_AID_TAG_OPTIONS,
  RESIDENCY_OPTIONS,
  RESOURCE_ICON_OPTIONS,
  RESOURCE_KIND_OPTIONS,
  asList,
  buildDueAtIso,
  defaultOpportunitySummary,
  expandResidencyValues,
  formatOpportunityListingKind,
  getDefaultOpportunityListingKind,
  getMonthDay,
  getOpportunityListingKindOptions,
  hasDisplayTitle,
  normalizeMajorList,
  normalizeOpportunityListingKind,
  normalizeRegionText,
  normalizeTags,
  normalizeWhitespace,
  polishedSentence,
  slugify,
  smartTitleCase,
  usesOpportunityListingKind,
} = require("./lib/catalog-schema.cjs");
const {
  BACK_SIGNAL,
  askChoice,
  askCommaList,
  askDateOnly,
  askDeadlineLabelSelection,
  askMajorProgramFieldSelection,
  askMultiSelect,
  askNumber,
  askSummaryRowNumber,
  askText,
  askUrl,
  askYesNoUnknown,
  confirmAction,
  createPrompter,
  fail,
  formatBooleanSummary,
  formatDateSummary,
  formatListSummary,
  formatMoneySummary,
  formatNumberSummary,
  isBackSignal,
  log,
  printSummary,
  runWizard,
} = require("./lib/catalog-prompts.cjs");
const {
  formatSectionPath,
  safeDisplayLabel,
} = require("./lib/catalog-translations.cjs");
const {
  buildResourceExportWorkbookSheets,
  createXlsxBuffer,
  ensureXlsxFilePath,
  getResourceExportRows,
  parseResourceCatalogSpreadsheet,
  resourceCatalogToCsv,
} = require("./lib/catalog-export.cjs");
function loadJsonArray(filePath) {
  if (!fs.existsSync(filePath)) return [];
  const raw = fs.readFileSync(filePath, "utf8");
  if (!raw.trim()) return [];
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    fail(`Expected an array in ${filePath}.`);
  }
  return parsed;
}

function writeJsonArray(filePath, value) {
  const backupPath = `${filePath}.bak`;
  if (fs.existsSync(filePath)) {
    fs.copyFileSync(filePath, backupPath);
  }
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function resolveUserFilePath(value, defaultPath) {
  const raw = String(value ?? "").trim();
  const chosen = raw || defaultPath;
  const unquoted = chosen.replace(/^["']|["']$/g, "");
  if (path.isAbsolute(unquoted)) return unquoted;
  return path.resolve(REPO_ROOT, unquoted);
}

function toGitPath(filePath) {
  return path.relative(REPO_ROOT, filePath).split(path.sep).join("/");
}

function openUrlInDefaultBrowser(url) {
  if (process.platform === "win32") {
    execFileSync("cmd", ["/c", "start", "", url], {
      stdio: "ignore",
      windowsHide: true,
    });
    return;
  }

  if (process.platform === "darwin") {
    execFileSync("open", [url], { stdio: "ignore" });
    return;
  }

  execFileSync("xdg-open", [url], { stdio: "ignore" });
}

function openGoogleSheetsAfterExport() {
  if (process.env.GATORGUIDE_OPEN_GOOGLE_SHEETS_AFTER_EXPORT === "0") {
    return;
  }

  try {
    log(`Opening Google Sheets in your default browser: ${GOOGLE_SHEETS_EXPORT_URL}`);
    openUrlInDefaultBrowser(GOOGLE_SHEETS_EXPORT_URL);
  } catch (error) {
    log(
      `Could not open Google Sheets automatically. Open ${GOOGLE_SHEETS_EXPORT_URL} manually.`
    );
  }
}

function runGitCapture(args) {
  return execFileSync("git", args, {
    cwd: REPO_ROOT,
    encoding: "utf8",
  });
}

function runGitDisplay(args) {
  execFileSync("git", args, {
    cwd: REPO_ROOT,
    stdio: "inherit",
  });
}


async function resolveOpportunityId(rl, opportunities, baseId) {
  let candidateId = baseId || `opportunity-${Date.now()}`;
  const existingIndex = opportunities.findIndex(
    (item) => String(item.opportunityId ?? "").trim() === candidateId
  );

  if (existingIndex === -1) {
    return { opportunityId: candidateId, replaceIndex: -1 };
  }

  const action = await askChoice(
    rl,
    `An entry with the ID "${candidateId}" already exists. What would you like to do?`,
    [
      { value: "replace", label: "Replace the existing entry" },
      { value: "new-id", label: "Create a new unique ID automatically" },
      { value: "cancel", label: "Cancel without saving anything" },
    ]
  );

  if (action === "cancel") {
    log("Cancelled. No files were changed.");
    process.exit(0);
  }

  if (action === "replace") {
    return { opportunityId: candidateId, replaceIndex: existingIndex };
  }

  let suffix = 2;
  while (
    opportunities.some(
      (item) => String(item.opportunityId ?? "").trim() === `${candidateId}-${suffix}`
    )
  ) {
    suffix += 1;
  }
  return { opportunityId: `${candidateId}-${suffix}`, replaceIndex: -1 };
}


async function addOpportunity(rl, type) {
  log("");
  log("You're adding a new opportunity.");
  log("For questions you don't have answers to, just skip it by pressing Enter on your keyboard.");
  log('Type "back" at any prompt to return to the previous question.');

  const opportunities = loadJsonArray(OPPORTUNITIES_PATH);
  const nowIso = new Date().toISOString();
  let answers = {};

  const opportunitySteps = [
    {
      prompt: (_, state) =>
        askText(rl, "Enter the name of the new resource:", {
          required: true,
          hint: "",
          defaultValue: state.title ?? "",
        }),
      assign(state, value) {
        state.title = value;
      },
    },
    {
      prompt: (_, state) =>
        askText(rl, "Organization or provider name:", {
          defaultValue: state.organizationName ?? "",
        }),
      assign(state, value) {
        state.organizationName = value;
      },
    },
    {
      prompt: (_, state) =>
        askText(rl, "Short description / summary shown to students:", {
          defaultValue: state.summary ?? "",
        }),
      assign(state, value) {
        state.summary = value;
      },
    },
    {
      prompt: (_, state) =>
        askUrl(rl, "Official public link or application URL:", {
          defaultValue: state.externalUrl ?? "",
        }),
      assign(state, value) {
        state.externalUrl = value;
      },
    },
    {
      prompt: (_, state) =>
        askChoice(
          rl,
          "How should the deadline be tracked?",
          [
            { value: "one-time", label: "One-time fixed date" },
            { value: "yearly", label: "Yearly recurring date" },
            { value: "rolling", label: "Rolling / no fixed date" },
          ],
          { defaultValue: state.deadlineMode ?? "rolling" }
        ),
      assign(state, value) {
        state.deadlineMode = value;
        if (value === "rolling") {
          state.deadlineType = "rolling";
          state.dueDate = null;
        } else if (!state.deadlineType || state.deadlineType === "rolling") {
          state.deadlineType = "final";
        }
      },
    },
    {
      when: (state) => state.deadlineMode !== "rolling",
      prompt: (_, state) =>
        askChoice(
          rl,
          "What kind of deadline is this?",
          [
            { value: "final", label: "Final deadline" },
            { value: "priority", label: "Priority deadline" },
          ],
          { defaultValue: state.deadlineType ?? "final" }
        ),
      assign(state, value) {
        state.deadlineType = value;
      },
    },
    {
      when: (state) => state.deadlineMode !== "rolling",
      prompt: (_, state) =>
        askDateOnly(rl, "Deadline date:", {
          required: true,
          defaultValue: state.dueDate ?? null,
        }),
      assign(state, value) {
        state.dueDate = value;
      },
    },
    {
      prompt: (_, state) => askDeadlineLabelSelection(rl, state),
      assign(state, value) {
        state.deadlineLabel = value;
      },
    },
    {
      prompt: (_, state) =>
        askMultiSelect(
          rl,
          "Which financial-aid tags fit this opportunity?",
          FINANCIAL_AID_TAG_OPTIONS,
          { defaultValue: state.financialAidTags ?? [] }
        ),
      assign(state, value) {
        state.financialAidTags = value;
      },
    },
    {
      prompt: (_, state) => askMajorProgramFieldSelection(rl, state.suggestedMajors ?? []),
      assign(state, value) {
        state.suggestedMajors = value;
      },
    },
    {
      prompt: (_, state) =>
        askYesNoUnknown(
          rl,
          "Does a student need to match one of those majors/programs to qualify?",
          { defaultValue: state.hasToBeMajor ?? false }
        ),
      assign(state, value) {
        state.hasToBeMajor = value ?? false;
      },
    },
    {
      prompt: (_, state) =>
        askNumber(rl, "Minimum GPA:", {
          min: 0,
          max: 5,
          allowDecimals: true,
          defaultValue: state.gpaMin ?? null,
        }),
      assign(state, value) {
        state.gpaMin = value;
      },
    },
    {
      prompt: (_, state) =>
        askMultiSelect(rl, "Does it have residency restrictions?", RESIDENCY_OPTIONS, {
          defaultValue: state.residencySelection ?? [],
        }),
      assign(state, value) {
        state.residencySelection = value;
      },
    },
    {
      prompt: (_, state) =>
        askYesNoUnknown(rl, "Is this only for transfer students?", {
          defaultValue: state.transferOnly ?? false,
        }),
      assign(state, value) {
        state.transferOnly = value ?? false;
      },
    },
    {
      prompt: (_, state) =>
        askYesNoUnknown(rl, "Are recommendation letters required?", {
          defaultValue: state.needsRecommendations ?? false,
        }),
      assign(state, value) {
        state.needsRecommendations = value ?? false;
        if (!(value ?? false)) {
          state.recommendationCountMin = 0;
        }
      },
    },
    {
      when: (state) => state.needsRecommendations,
      prompt: (_, state) =>
        askNumber(rl, "Minimum recommendation count:", {
          min: 1,
          max: 12,
          allowDecimals: false,
          defaultValue: state.recommendationCountMin ?? 1,
        }),
      assign(state, value) {
        state.recommendationCountMin = value ?? 1;
      },
    },
    {
      prompt: (_, state) =>
        askNumber(rl, "How many essays or short-answer sections are required?", {
          min: 0,
          max: 20,
          allowDecimals: false,
          defaultValue: state.essayCount ?? 0,
        }),
      assign(state, value) {
        state.essayCount = value ?? 0;
      },
    },
    {
      prompt: (_, state) =>
        askNumber(rl, "Minimum award amount in dollars:", {
          min: 0,
          max: 100000000,
          allowDecimals: true,
          defaultValue: state.amountMin ?? null,
        }),
      assign(state, value) {
        state.amountMin = value;
      },
    },
    {
      prompt: (_, state) =>
        askNumber(rl, "Maximum award amount in dollars:", {
          min: 0,
          max: 100000000,
          allowDecimals: true,
          defaultValue: state.amountMax ?? null,
        }),
      assign(state, value) {
        state.amountMax = value;
      },
    },
    {
      prompt: (_, state) =>
        askText(rl, "Award currency code:", {
          defaultValue: state.awardCurrency ?? "USD",
        }),
      assign(state, value) {
        state.awardCurrency = value ?? "USD";
      },
    },
    {
      prompt: (_, state) =>
        askText(
          rl,
          "Award text shown to students (example: Up to $1,500 per quarter):",
          {
            defaultValue: state.amountText ?? "",
          }
        ),
      assign(state, value) {
        state.amountText = value;
      },
    },
    {
      prompt: (_, state) =>
        askYesNoUnknown(rl, "Is this renewable beyond one term/cycle?", {
          defaultValue: state.renewable ?? null,
        }),
      assign(state, value) {
        state.renewable = value;
      },
    },
    {
      prompt: (_, state) =>
        askYesNoUnknown(rl, "Is this tied to a specific college or school?", {
          defaultValue: state.tiedToCollege ?? (type === "college_deadline"),
        }),
      assign(state, value) {
        const tiedToCollege = value == null ? type === "college_deadline" : value;
        state.tiedToCollege = tiedToCollege;
        if (!tiedToCollege) {
          state.collegeName = null;
          state.collegeCity = null;
          state.collegeState = null;
          state.collegeWebsite = null;
        }
      },
    },
    {
      when: (state) => state.tiedToCollege,
      prompt: (_, state) =>
        askText(rl, "College or school name:", {
          defaultValue: state.collegeName ?? "",
        }),
      assign(state, value) {
        state.collegeName = value;
      },
    },
    {
      when: (state) => state.tiedToCollege,
      prompt: (_, state) =>
        askText(rl, "College city:", {
          defaultValue: state.collegeCity ?? "",
        }),
      assign(state, value) {
        state.collegeCity = value;
      },
    },
    {
      when: (state) => state.tiedToCollege,
      prompt: (_, state) =>
        askText(rl, "College state or region:", {
          defaultValue: state.collegeState ?? "",
        }),
      assign(state, value) {
        state.collegeState = value;
      },
    },
    {
      when: (state) => state.tiedToCollege,
      prompt: (_, state) =>
        askUrl(rl, "College website:", {
          defaultValue: state.collegeWebsite ?? "",
        }),
      assign(state, value) {
        state.collegeWebsite = value;
      },
    },
    {
      prompt: (_, state) =>
        askUrl(rl, "Where did you verify this information?", {
          defaultValue: state.sourceUrl ?? "",
        }),
      assign(state, value) {
        state.sourceUrl = value;
      },
    },
    {
      prompt: (_, state) =>
        askText(
          rl,
          "Source label (example: official scholarship page, department flyer):",
          {
            defaultValue: state.sourceLabel ?? "",
          }
        ),
      assign(state, value) {
        state.sourceLabel = value;
      },
    },
    {
      when: () => usesOpportunityListingKind(type),
      prompt: (_, state) =>
        askChoice(
          rl,
          "How should this be grouped inside the Resources tab?",
          getOpportunityListingKindOptions(type),
          {
            defaultValue:
              state.listingKind ?? getDefaultOpportunityListingKind(type),
          }
        ),
      assign(state, value) {
        state.listingKind = value;
      },
    },
    {
      prompt: (_, state) =>
        askYesNoUnknown(rl, "Should this appear in the app right away?", {
          defaultValue: state.showImmediately ?? true,
        }),
      assign(state, value) {
        state.showImmediately = value ?? true;
      },
    },
  ];

  answers = await runWizard(rl, opportunitySteps, answers);

  while (true) {
    const title = smartTitleCase(answers.title);
    const organizationName = smartTitleCase(answers.organizationName ?? title);
    const summary = polishedSentence(answers.summary ?? defaultOpportunitySummary(title, type));
    const externalUrl = answers.externalUrl ?? null;
    const deadlineMode = answers.deadlineMode;
    const deadlineType = deadlineMode === "rolling" ? "rolling" : answers.deadlineType;
    const dueDate = answers.dueDate ?? null;
    const deadlineLabel =
      smartSentenceCase(
        answers.deadlineLabel ??
          (deadlineMode === "rolling" ? "Rolling applications" : null)
      );
    const financialAidTags = answers.financialAidTags ?? [];
    const suggestedMajors = normalizeMajorList(answers.suggestedMajors ?? []);
    const hasToBeMajor = answers.hasToBeMajor ?? false;
    const gpaMin = answers.gpaMin ?? null;
    const residencySelection = answers.residencySelection ?? [];
    const communityTags = asList(answers.communityTags);
    const transferOnly = answers.transferOnly ?? false;
    const needsRecommendations = answers.needsRecommendations ?? false;
    const recommendationCountMin = needsRecommendations
      ? answers.recommendationCountMin ?? 1
      : 0;
    const essayCount = answers.essayCount ?? 0;
    const amountMin = answers.amountMin ?? null;
    const amountMax = answers.amountMax ?? null;
    const awardCurrency = normalizeWhitespace(answers.awardCurrency ?? "USD").toUpperCase();
    const amountText = polishedSentence(answers.amountText ?? null);
    const renewable = answers.renewable ?? null;
    const tiedToCollege = answers.tiedToCollege ?? (type === "college_deadline");
    const collegeName = tiedToCollege ? smartTitleCase(answers.collegeName ?? null) : null;
    const collegeCity = tiedToCollege ? smartTitleCase(answers.collegeCity ?? null) : null;
    const collegeState = tiedToCollege ? normalizeRegionText(answers.collegeState ?? null) : null;
    const collegeWebsite = tiedToCollege ? answers.collegeWebsite ?? null : null;
    const sourceUrl = answers.sourceUrl ?? externalUrl;
    const sourceLabel = smartTitleCase(
      answers.sourceLabel ?? "Added with batch catalog tool"
    );
    const listingKind = normalizeOpportunityListingKind(
      answers.listingKind,
      type
    );
    const showImmediately = answers.showImmediately ?? true;

    answers = {
      ...answers,
      title,
      organizationName,
      summary,
      externalUrl,
      deadlineMode,
      deadlineType,
      dueDate,
      deadlineLabel,
      financialAidTags,
      suggestedMajors,
      hasToBeMajor,
      gpaMin,
      residencySelection,
      communityTags,
      transferOnly,
      needsRecommendations,
      recommendationCountMin,
      essayCount,
      amountMin,
      amountMax,
      awardCurrency,
      amountText,
      renewable,
      tiedToCollege,
      collegeName,
      collegeCity,
      collegeState,
      collegeWebsite,
      sourceUrl,
      sourceLabel,
      listingKind,
      showImmediately,
    };

    const reviewRows = [
      {
        label: "Type",
        value: type,
        editStepIndex: null,
      },
      {
        label: "Title",
        value: title,
        editStepIndex: 0,
      },
      {
        label: "Organization",
        value: organizationName,
        editStepIndex: 1,
      },
      {
        label: "Summary",
        value: summary,
        editStepIndex: 2,
      },
      {
        label: "Official link",
        value: externalUrl,
        editStepIndex: 3,
      },
      {
        label: "Deadline tracking",
        value: deadlineMode,
        editStepIndex: 4,
      },
      {
        label: "Deadline kind",
        value: deadlineType,
        editStepIndex: deadlineMode === "rolling" ? 4 : 5,
      },
      {
        label: "Deadline date",
        value: dueDate,
        editStepIndex: deadlineMode === "rolling" ? 4 : 6,
      },
      {
        label: "Deadline label",
        value: deadlineLabel,
        editStepIndex: 7,
      },
      {
        label: "Financial-aid tags",
        value: formatListSummary(financialAidTags),
        editStepIndex: 8,
      },
      {
        label: "Relevant majors",
        value: formatListSummary(suggestedMajors),
        editStepIndex: 9,
      },
      {
        label: "Must match major",
        value: formatBooleanSummary(hasToBeMajor),
        editStepIndex: 10,
      },
      {
        label: "Minimum GPA",
        value: formatNumberSummary(gpaMin),
        editStepIndex: 11,
      },
      {
        label: "Residency restrictions",
        value: formatListSummary(residencySelection),
        editStepIndex: 12,
      },
      {
        label: "Transfer only",
        value: formatBooleanSummary(transferOnly),
        editStepIndex: 13,
      },
      {
        label: "Needs recommendations",
        value: formatBooleanSummary(needsRecommendations),
        editStepIndex: 14,
      },
      {
        label: "Recommendation minimum",
        value: formatNumberSummary(recommendationCountMin),
        editStepIndex: needsRecommendations ? 15 : 14,
      },
      {
        label: "Essay count",
        value: formatNumberSummary(essayCount),
        editStepIndex: 16,
      },
      {
        label: "Award amount",
        value: formatMoneySummary(amountMin, amountMax, awardCurrency),
        editStepIndex: 17,
      },
      {
        label: "Award text",
        value: amountText,
        editStepIndex: 20,
      },
      {
        label: "Renewable",
        value: formatBooleanSummary(renewable),
        editStepIndex: 21,
      },
      {
        label: "College name",
        value: collegeName,
        editStepIndex: tiedToCollege ? 23 : 22,
      },
      {
        label: "College city",
        value: collegeCity,
        editStepIndex: tiedToCollege ? 24 : 22,
      },
      {
        label: "College state",
        value: collegeState,
        editStepIndex: tiedToCollege ? 25 : 22,
      },
      {
        label: "College website",
        value: collegeWebsite,
        editStepIndex: tiedToCollege ? 26 : 22,
      },
      {
        label: "Source URL",
        value: sourceUrl,
        editStepIndex: 27,
      },
      {
        label: "Source label",
        value: sourceLabel,
        editStepIndex: 28,
      },
      ...(
        usesOpportunityListingKind(type)
          ? [
              {
                label: "Resource group",
                value: formatOpportunityListingKind(listingKind, type),
                editStepIndex: 29,
              },
            ]
          : []
      ),
      {
        label: "Show right away",
        value: formatBooleanSummary(showImmediately),
        editStepIndex: usesOpportunityListingKind(type) ? 30 : 29,
      },
    ];

    printSummary("Review this new opportunity before saving.", reviewRows, {
      numbered: true,
    });

    const reviewAction = await askChoice(
      rl,
      "What would you like to do with this information?",
      [
        { value: "save", label: "Save" },
        { value: "edit", label: "Make changes" },
        { value: "discard", label: "Discard" },
      ],
      {
        invalidMessage: "Enter in 1, 2, or 3 for your choice.",
      }
    );

    if (reviewAction === "discard") {
      log("Discarded. No files were changed.");
      return;
    }

    if (reviewAction === "edit") {
      const selectedReviewRowIndex = await askSummaryRowNumber(
        rl,
        'Enter the number of the item you want to change, or type "back" to return:',
        reviewRows
      );

      if (isBackSignal(selectedReviewRowIndex)) {
        continue;
      }

      const selectedReviewRow = reviewRows[selectedReviewRowIndex];
      if (selectedReviewRow.editStepIndex == null) {
        log("Type cannot be changed from this review screen. Choose Discard and start over to change it.");
        continue;
      }

      answers = await runWizard(
        rl,
        opportunitySteps,
        answers,
        selectedReviewRow.editStepIndex
      );
      continue;
    }

    break;
  }

  const {
    title,
    organizationName,
    summary,
    externalUrl,
    deadlineMode,
    deadlineType,
    dueDate,
    deadlineLabel,
    financialAidTags,
    suggestedMajors,
    hasToBeMajor,
    gpaMin,
    residencySelection,
    communityTags,
    transferOnly,
    needsRecommendations,
    recommendationCountMin,
    essayCount,
    amountMin,
    amountMax,
    awardCurrency,
    amountText,
    renewable,
    collegeName,
    collegeCity,
    collegeState,
    collegeWebsite,
    sourceUrl,
    sourceLabel,
    listingKind,
    showImmediately,
  } = answers;
  const recurrence =
    deadlineMode === "rolling"
      ? {
          isYearly: false,
          month: null,
          day: null,
          timezone: "America/Los_Angeles",
        }
      : {
          isYearly: deadlineMode === "yearly",
          month: deadlineMode === "yearly" ? getMonthDay(dueDate).month : null,
          day: deadlineMode === "yearly" ? getMonthDay(dueDate).day : null,
          timezone: "America/Los_Angeles",
        };

  const baseId = slugify(title);
  const { opportunityId, replaceIndex } = await resolveOpportunityId(
    rl,
    opportunities,
    baseId
  );
  const existing = replaceIndex >= 0 ? opportunities[replaceIndex] : null;

  const finalAmountMin =
    amountMin != null && amountMax != null && amountMin > amountMax
      ? amountMax
      : amountMin;
  const finalAmountMax =
    amountMin != null && amountMax != null && amountMin > amountMax
      ? amountMin
      : amountMax;

  const nextOpportunity = {
    schemaVersion: 1,
    opportunityId,
    type,
    listingKind,
    status: showImmediately ? "active" : "draft",
    title,
    organizationName,
    summary,
    externalUrl,
    dueAt: deadlineMode === "rolling" ? null : buildDueAtIso(dueDate),
    recurrence,
    deadline: {
      type: deadlineType,
      label: deadlineLabel,
    },
    matching: {
      financialAidTags,
      suggestedMajors,
      hasToBeMajor,
    },
    eligibility: {
      gpaMin,
      residencyTypes: expandResidencyValues(residencySelection),
      communityTags: asList(communityTags),
      transferOnly,
    },
    requirements: {
      needsRecommendations,
      recommendationCountMin,
      essayCount,
    },
    award: {
      amountMin: finalAmountMin,
      amountMax: finalAmountMax,
      currency: awardCurrency.toUpperCase(),
      amountText,
      renewable,
    },
    college: {
      collegeId: null,
      collegeName,
      city: collegeCity,
      state: collegeState,
      website: collegeWebsite,
    },
    source: {
      kind: "manual",
      sourceUrl,
      sourceLabel,
      model: null,
      fetchedAt: nowIso,
      verifiedAt: nowIso,
    },
    createdAt: existing?.createdAt ?? nowIso,
    updatedAt: nowIso,
  };

  const nextOpportunities = [...opportunities];
  if (replaceIndex >= 0) {
    nextOpportunities[replaceIndex] = nextOpportunity;
  } else {
    nextOpportunities.push(nextOpportunity);
  }

  nextOpportunities.sort((left, right) =>
    String(left.title ?? "").localeCompare(String(right.title ?? ""))
  );

  writeJsonArray(OPPORTUNITIES_PATH, nextOpportunities);

  log("");
  log(`Saved ${type} "${title}" to ${OPPORTUNITIES_PATH}`);
  log(`Generated ID: ${opportunityId}`);
  log(`Backup written to ${OPPORTUNITIES_PATH}.bak`);
}

async function addResource(rl) {
  log("");
  log("You're adding a new resource.");
  log("For questions you don't have answers to, just skip it by pressing Enter on your keyboard.");
  log('Type "back" at any prompt to return to the previous question.');

  const resourceCatalog = loadJsonArray(RESOURCES_PATH);
  const existingSectionOptions = resourceCatalog.flatMap((section) => {
    const options = [
      {
        value: section.id,
        label: safeDisplayLabel(section),
      },
    ];

    if (Array.isArray(section.subsections)) {
      options.push(
        ...section.subsections.map((subsection) => ({
          value: `${section.id}::${subsection.id}`,
          label: formatSectionPath(section, subsection),
        }))
      );
    }

    return options;
  });
  let answers = {};

  while (true) {
    answers = await runWizard(rl, [
    {
      prompt: (_, state) =>
        askChoice(rl, "What kind of resource is this?", RESOURCE_KIND_OPTIONS, {
          defaultValue: state.resourceKind ?? "student-tools",
        }),
      assign(state, value) {
        state.resourceKind = value;
        if (value !== "__other_existing__") {
          state.sectionChoice = null;
        }
        if (value !== "__new__") {
          state.sectionTitle = null;
          state.sectionIcon = null;
        }
      },
    },
    {
      when: (state) => state.resourceKind === "__other_existing__",
      prompt: (_, state) =>
        askChoice(
          rl,
          "Which existing section should this resource go into?",
          existingSectionOptions,
          {
            defaultValue: state.sectionChoice ?? null,
          }
        ),
      assign(state, value) {
        state.sectionChoice = value;
      },
    },
    {
      when: (state) => state.resourceKind === "__new__",
      prompt: (_, state) =>
        askText(rl, "New section title:", {
          required: true,
          hint: "",
          defaultValue: state.sectionTitle ?? "",
        }),
      assign(state, value) {
        state.sectionTitle = value;
      },
    },
    {
      when: (state) => state.resourceKind === "__new__",
      prompt: (_, state) =>
        askChoice(
          rl,
          "Choose an icon for the new section:",
          RESOURCE_ICON_OPTIONS,
          { defaultValue: state.sectionIcon ?? "link" }
        ),
      assign(state, value) {
        state.sectionIcon = value;
      },
    },
    {
      prompt: (_, state) =>
        askText(rl, "Enter the name of the new resource:", {
          required: true,
          hint: "",
          defaultValue: state.title ?? "",
        }),
      assign(state, value) {
        state.title = value;
      },
    },
    {
      prompt: (_, state) =>
        askText(rl, "Short description shown to students:", {
          defaultValue: state.description ?? "",
        }),
      assign(state, value) {
        state.description = value;
      },
    },
    {
      prompt: (_, state) =>
        askUrl(rl, "Resource URL or app:// route:", {
          required: true,
          hint: "You can paste a normal website link or an app:// route.",
          invalidMessage: "A valid link is required for a resource.",
          defaultValue: state.url ?? "",
        }),
      assign(state, value) {
        state.url = value;
      },
    },
    {
      prompt: (_, state) =>
        askYesNoUnknown(rl, "Should this resource auto-delete after a certain date?", {
          defaultValue: state.hasExpiry ?? false,
        }),
      assign(state, value) {
        state.hasExpiry = value ?? false;
        if (!(value ?? false)) {
          state.expiresAt = null;
        }
      },
    },
    {
      when: (state) => state.hasExpiry,
      prompt: (_, state) =>
        askDateOnly(rl, "Auto-delete date:", {
          required: true,
          defaultValue: state.expiresAt ?? null,
          hint: "Use YYYY-MM-DD format. The resource will disappear after this date",
        }),
      assign(state, value) {
        state.expiresAt = value;
      },
    },
    {
      prompt: (_, state) =>
        askCommaList(
          rl,
          "Search tags (examples: scholarship, transfer, resume):",
          {
            defaultValue: state.tags ?? [],
          }
        ),
      assign(state, value) {
        state.tags = normalizeTags(Array.isArray(value) ? value.join(", ") : value);
      },
    },
  ], answers);

    let targetSection = null;
    let targetSubsection = null;
    if (
      answers.resourceKind !== "__other_existing__" &&
      answers.resourceKind !== "__new__"
    ) {
      const location = findTargetResourceLocation(resourceCatalog, answers.resourceKind);
      targetSection = location.section;
      targetSubsection = location.subsection;
    }

    if (!targetSection && answers.resourceKind === "__other_existing__") {
      const [sectionId, subsectionId] = String(answers.sectionChoice ?? "").split("::");
      targetSection =
        resourceCatalog.find((section) => String(section.id) === sectionId) ?? null;
      targetSubsection =
        targetSection && subsectionId
          ? (Array.isArray(targetSection.subsections)
              ? targetSection.subsections.find((subsection) => String(subsection.id) === subsectionId) ?? null
              : null)
          : null;
    }

    const sectionLabel = targetSection
      ? formatSectionPath(targetSection, targetSubsection)
      : smartTitleCase(answers.sectionTitle);
    const title = smartTitleCase(answers.title);
    const description = polishedSentence(answers.description ?? `${title} resource link.`);
    const url = answers.url;
    const expiresAt = answers.hasExpiry ? answers.expiresAt ?? null : null;
    const tags = answers.tags ?? [];

    printSummary("Review this new resource before saving.", [
      ["Resource kind", answers.resourceKind === "__new__" ? "New custom section" : answers.resourceKind],
      ["Section", sectionLabel ?? "Unknown"],
      ["Title", title],
      ["Description", description],
      ["URL", url ?? "Unknown"],
      ["Auto-delete date", formatDateSummary(expiresAt)],
      ["Tags", formatListSummary(tags)],
    ]);

    const reviewAction = await askChoice(
      rl,
      "What would you like to do with this information?",
      [
        { value: "save", label: "Save" },
        { value: "edit", label: "Make changes" },
        { value: "discard", label: "Discard" },
      ],
      {
        invalidMessage: "Enter in 1, 2, or 3 for your choice.",
      }
    );

    if (reviewAction === "discard") {
      log("Discarded. No files were changed.");
      return;
    }

    if (reviewAction === "edit") {
      continue;
    }

    answers = {
      ...answers,
      sectionTitle: sectionLabel ?? answers.sectionTitle,
      title,
      description,
      url,
      expiresAt,
      tags,
    };
    break;
  }

  let targetSection = null;
  let targetSubsection = null;
  if (
    answers.resourceKind !== "__other_existing__" &&
    answers.resourceKind !== "__new__"
  ) {
    const location = findTargetResourceLocation(resourceCatalog, answers.resourceKind);
    targetSection = location.section;
    targetSubsection = location.subsection;
  }

  if (!targetSection && answers.resourceKind === "__other_existing__") {
    const [sectionId, subsectionId] = String(answers.sectionChoice ?? "").split("::");
    targetSection =
      resourceCatalog.find((section) => String(section.id) === sectionId) ?? null;
    targetSubsection =
      targetSection && subsectionId
        ? (Array.isArray(targetSection.subsections)
            ? targetSection.subsections.find((subsection) => String(subsection.id) === subsectionId) ?? null
            : null)
        : null;
  }

  if (!targetSection) {
    targetSection = {
      id: slugify(answers.sectionTitle) || `section-${Date.now()}`,
      title: smartTitleCase(answers.sectionTitle),
      icon: answers.sectionIcon,
      items: [],
    };
    resourceCatalog.push(targetSection);
  }

  const title = answers.title;
  const description = answers.description;
  const url = answers.url;
  const expiresAt = answers.expiresAt ?? null;
  const tags = answers.tags ?? [];

  const targetItemList =
    targetSubsection && Array.isArray(targetSubsection.items)
      ? targetSubsection.items
      : targetSection.items;

  targetItemList.push({
    title,
    description,
    url,
    expiresAt,
    tags,
  });

  writeJsonArray(RESOURCES_PATH, resourceCatalog);

  log("");
  log(`Saved resource "${title}" to ${RESOURCES_PATH}`);
  log(`Section: ${formatSectionPath(targetSection, targetSubsection)}`);
  log(`Backup written to ${RESOURCES_PATH}.bak`);
}

async function removeOpportunity(rl) {
  log("");
  log("You are removing an existing opportunity.");
  log('Type "back" at any prompt to return to the previous question.');

  const opportunities = loadJsonArray(OPPORTUNITIES_PATH);
  if (!opportunities.length) {
    log("There are no opportunities to remove.");
    return;
  }

  const answers = await runWizard(rl, [
    {
      prompt: () =>
        askChoice(
          rl,
          "Which kind of opportunity would you like to remove?",
          [
            { value: "scholarship", label: "Scholarship (database or individual)" },
            {
              value: "internship",
              label: "Internship / work opportunity (database or individual)",
            },
            { value: "college_deadline", label: "College deadline" },
            { value: "general_deadline", label: "General deadline" },
            { value: "quarter-start", label: "Quarter start" },
            { value: "quarter-end", label: "Quarter end" },
            { value: "__all__", label: "Show all opportunities" },
          ],
          { defaultValue: "__all__" }
        ),
      assign(state, value) {
        state.typeChoice = value;
      },
    },
    {
      prompt: (state) => {
        const filtered = opportunities.filter((item) =>
          state.typeChoice === "__all__" ? true : item.type === state.typeChoice
        );
        if (!filtered.length) {
          log("There are no matching opportunities to remove.");
          return BACK_SIGNAL;
        }
        return askChoice(
          rl,
          "Which opportunity would you like to remove?",
          filtered.map((item) => ({
            value: String(item.opportunityId ?? ""),
            label: `${item.title} (${item.type})`,
          }))
        );
      },
      assign(state, value) {
        state.choice = value;
      },
    },
    {
      prompt: (state) => {
        const filtered = opportunities.filter((item) =>
          state.typeChoice === "__all__" ? true : item.type === state.typeChoice
        );
        const selectedMatch = filtered.find(
          (item) => String(item.opportunityId ?? "") === state.choice
        );
        return confirmAction(
          rl,
          `Remove "${selectedMatch?.title ?? "this opportunity"}" from the opportunity catalog?`
        );
      },
      assign(state, value) {
        state.confirmed = value;
      },
    },
  ]);

  if (!answers.confirmed) {
    log("Cancelled. No files were changed.");
    return;
  }

  const filteredOpportunities = opportunities.filter((item) =>
    answers.typeChoice === "__all__" ? true : item.type === answers.typeChoice
  );
  const selected = filteredOpportunities.find(
    (item) => String(item.opportunityId ?? "") === answers.choice
  );
  if (!selected) {
    log("Could not find the selected opportunity.");
    return;
  }

  const nextOpportunities = opportunities.filter(
    (item) => String(item.opportunityId ?? "") !== answers.choice
  );
  writeJsonArray(OPPORTUNITIES_PATH, nextOpportunities);

  log("");
  log(`Removed opportunity "${selected.title}" from ${OPPORTUNITIES_PATH}`);
  log(`Backup written to ${OPPORTUNITIES_PATH}.bak`);
}

async function removeResource(rl) {
  log("");
  log("You are removing an existing resource.");
  log('Type "back" at any prompt to return to the previous question.');

  const resourceCatalog = loadJsonArray(RESOURCES_PATH);
  const nonEmptyLocations = resourceCatalog.flatMap((section) => {
    const locations = [];

    if (Array.isArray(section.items) && section.items.some(hasDisplayTitle)) {
      locations.push({
        value: section.id,
        label: safeDisplayLabel(section),
      });
    }

    if (Array.isArray(section.subsections)) {
      locations.push(
        ...section.subsections
          .filter(
            (subsection) => Array.isArray(subsection.items) && subsection.items.some(hasDisplayTitle)
          )
          .map((subsection) => ({
            value: `${section.id}::${subsection.id}`,
            label: formatSectionPath(section, subsection),
          }))
      );
    }

    return locations;
  });

  if (!nonEmptyLocations.length) {
    log("There are no resources to remove.");
    return;
  }

  const answers = await runWizard(rl, [
    {
      prompt: () =>
        askChoice(
          rl,
          "Which section contains the resource you want to remove?",
          nonEmptyLocations
        ),
      assign(state, value) {
        state.sectionChoice = value;
      },
    },
    {
      prompt: (state) => {
        const [sectionId, subsectionId] = String(state.sectionChoice ?? "").split("::");
        const section =
          resourceCatalog.find((item) => String(item.id) === sectionId) ?? null;
        const itemList =
          section && subsectionId
            ? (Array.isArray(section.subsections)
                ? section.subsections.find((subsection) => String(subsection.id) === subsectionId)?.items ?? null
                : null)
            : section?.items ?? null;

        if (!section || !Array.isArray(itemList) || !itemList.length) {
          log("Could not find any items in that section.");
          return BACK_SIGNAL;
        }

        return askChoice(
          rl,
          "Which resource would you like to remove?",
          itemList.flatMap((item, index) =>
            hasDisplayTitle(item)
              ? [
                  {
                    value: String(index),
                    label: normalizeWhitespace(item.title ?? item.titleKey),
                  },
                ]
              : []
          )
        );
      },
      assign(state, value) {
        state.itemChoice = value;
      },
    },
    {
      prompt: (state) => {
        const [sectionId, subsectionId] = String(state.sectionChoice ?? "").split("::");
        const section =
          resourceCatalog.find((item) => String(item.id) === sectionId) ?? null;
        const subsection =
          section && subsectionId
            ? (Array.isArray(section.subsections)
                ? section.subsections.find((item) => String(item.id) === subsectionId) ?? null
                : null)
            : null;
        const selectedIndex = Number.parseInt(state.itemChoice, 10);
        const selectedItem = subsection
          ? subsection.items?.[selectedIndex]
          : section?.items?.[selectedIndex];
        const selectedLabel = normalizeWhitespace(
          selectedItem?.title ?? selectedItem?.titleKey
        );
        return confirmAction(
          rl,
          `Remove "${selectedLabel || "this resource"}" from ${formatSectionPath(section, subsection)}?`
        );
      },
      assign(state, value) {
        state.confirmed = value;
      },
    },
  ]);

  if (!answers.confirmed) {
    log("Cancelled. No files were changed.");
    return;
  }

  const [sectionId, subsectionId] = String(answers.sectionChoice ?? "").split("::");
  const targetSection =
    resourceCatalog.find((section) => String(section.id) === sectionId) ?? null;
  const targetSubsection =
    targetSection && subsectionId
      ? (Array.isArray(targetSection.subsections)
          ? targetSection.subsections.find((subsection) => String(subsection.id) === subsectionId) ?? null
          : null)
      : null;
  const selectedIndex = Number.parseInt(answers.itemChoice, 10);
  const selectedItem = targetSubsection
    ? targetSubsection.items?.[selectedIndex]
    : targetSection?.items?.[selectedIndex];
  const selectedLabel = normalizeWhitespace(selectedItem?.title ?? selectedItem?.titleKey);

  if (!targetSection || !selectedItem || !selectedLabel) {
    log("Could not find the selected resource.");
    return;
  }

  if (targetSubsection) {
    targetSubsection.items.splice(selectedIndex, 1);
  } else {
    targetSection.items.splice(selectedIndex, 1);
  }
  writeJsonArray(RESOURCES_PATH, resourceCatalog);

  log("");
  log(`Removed resource "${selectedLabel}" from ${RESOURCES_PATH}`);
  log(`Section: ${formatSectionPath(targetSection, targetSubsection)}`);
  log(`Backup written to ${RESOURCES_PATH}.bak`);
}

async function publishUpdatedResources(rl) {
  const resourceGitPath = toGitPath(RESOURCES_PATH);
  let statusOutput = "";

  try {
    statusOutput = runGitCapture(["status", "--porcelain", "--", resourceGitPath]);
  } catch (error) {
    fail(`Could not inspect the repo status. ${error instanceof Error ? error.message : String(error)}`);
  }

  if (!statusOutput.trim()) {
    log("");
    log("There are no updated resources to publish right now.");
    return;
  }

  const confirmed = await confirmAction(
    rl,
    `Publish updated resources to repo with commit message "${RESOURCE_COMMIT_MESSAGE}"?`,
    true
  );

  if (isBackSignal(confirmed) || !confirmed) {
    log("Cancelled. No files were changed.");
    return;
  }

  try {
    log("");
    log("Creating the resources commit...");
    runGitDisplay([
      "commit",
      "--only",
      "-m",
      RESOURCE_COMMIT_MESSAGE,
      "--",
      resourceGitPath,
    ]);
    log("");
    log("Pushing the new commit...");
    runGitDisplay(["push"]);
  } catch (error) {
    fail(`Could not publish updated resources. ${error instanceof Error ? error.message : String(error)}`);
  }

  log("");
  log(`Published updated resources with commit message "${RESOURCE_COMMIT_MESSAGE}".`);
}

async function exportResourcesAsExcelFile() {
  const requestedOutputPath = RESOURCE_EXCEL_EXPORT_PATH;
  const outputPath =
    path.extname(requestedOutputPath).toLowerCase() === ".csv"
      ? requestedOutputPath
      : ensureXlsxFilePath(requestedOutputPath);
  const resourceCatalog = loadJsonArray(RESOURCES_PATH);
  const opportunities = loadJsonArray(OPPORTUNITIES_PATH);

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });

  log("");
  if (path.extname(outputPath).toLowerCase() === ".csv") {
    fs.writeFileSync(outputPath, `${resourceCatalogToCsv(resourceCatalog)}\n`, "utf8");
    log(`Saved Excel-compatible CSV to ${outputPath}`);
    log(`Exported ${getResourceExportRows(resourceCatalog).length} resources.`);
    log("Set GATORGUIDE_RESOURCE_EXCEL_EXPORT_PATH to an .xlsx path for the default workbook export.");
    openGoogleSheetsAfterExport();
    return;
  }

  const workbookSheets = buildResourceExportWorkbookSheets(resourceCatalog, opportunities);
  const workbook = createXlsxBuffer(workbookSheets);
  const sheetCounts = Object.fromEntries(
    workbookSheets.map((sheet) => [sheet.name, sheet.count ?? 0])
  );
  fs.writeFileSync(outputPath, workbook);
  log(`Saved Excel workbook to ${outputPath}`);
  log(`Exported ${sheetCounts.Resources ?? 0} resource links.`);
  log(
    `Included ${sheetCounts.Scholarships ?? 0} scholarships, ${sheetCounts.Internships ?? 0} internships, ${sheetCounts.Deadlines ?? 0} deadlines, and ${sheetCounts.Legacy ?? 0} legacy links.`
  );
  log("The Resources sheet can be edited and imported back through this same menu; the other sheets are export-only references.");
  openGoogleSheetsAfterExport();
}

async function importResourcesAsExcelFile(rl) {
  const inputPathInput = await askText(rl, "Which XLSX or CSV file should be imported?", {
    defaultValue: RESOURCE_EXCEL_EXPORT_PATH,
    hint: "Use an XLSX exported from this tool. CSV imports are still supported.",
  });
  if (isBackSignal(inputPathInput)) return;

  const inputPath = resolveUserFilePath(inputPathInput, RESOURCE_EXCEL_EXPORT_PATH);
  if (!fs.existsSync(inputPath)) {
    fail(`Could not find import file: ${inputPath}`);
  }

  const nextCatalog = parseResourceCatalogSpreadsheet(inputPath);
  const itemCount = nextCatalog.reduce(
    (sum, section) =>
      sum +
      (section.items?.length ?? 0) +
      (section.subsections ?? []).reduce(
        (subSum, subsection) => subSum + (subsection.items?.length ?? 0),
        0
      ),
    0
  );

  printSummary("Review this import before saving.", [
    ["Import file", inputPath],
    ["Sections", String(nextCatalog.length)],
    ["Resources", String(itemCount)],
    ["Target catalog", RESOURCES_PATH],
  ]);

  const confirmed = await confirmAction(
    rl,
    "Replace the current resource catalog with this import?",
    false
  );
  if (isBackSignal(confirmed) || !confirmed) {
    log("Cancelled. No files were changed.");
    return;
  }

  writeJsonArray(RESOURCES_PATH, nextCatalog);

  log("");
  log(`Imported ${itemCount} resources into ${RESOURCES_PATH}`);
  log(`Backup written to ${RESOURCES_PATH}.bak`);
}

async function importExportResourcesAsExcelFile(rl) {
  const choice = await askChoice(
    rl,
    "Import/export resources as Excel workbook",
    [
      { value: "export", label: "Export resources to Excel file" },
      { value: "import", label: "Import resources from Excel file" },
      { value: "__back__", label: "Back" },
    ],
    {
      defaultValue: "export",
      invalidMessage: "Enter in 1, 2, or 3 for your choice.",
      showDefaultLabel: false,
    }
  );

  if (choice === "__back__" || isBackSignal(choice)) return;
  if (choice === "import") {
    await importResourcesAsExcelFile(rl);
    return;
  }

  await exportResourcesAsExcelFile();
}

async function main() {
  const rl = createPrompter();

  try {
    log("GatorGuide catalog helper");
    log("This tool adds or removes scholarships, internships, deadlines, and resources without hand-editing code.");
    log("");
    log("Tip: for most fields, you can press Enter if the information is unknown.");
    log('Tip: type "back" to return to the previous question.');

    const entryFlow = await runWizard(rl, [
      {
        prompt: () =>
          askChoice(
            rl,
            "What would you like to do?",
            [
              { value: "add", label: "Add a new item" },
              { value: "remove", label: "Remove an existing item" },
              { value: "publish", label: "Publish updated resources to repo" },
              { value: "excel", label: "Import/Export resources as excel file" },
            ],
            {
              defaultValue: "add",
              invalidMessage: "Enter in 1, 2, 3, or 4 for your choice.",
              showDefaultLabel: false,
            }
          ),
        assign(state, value) {
          state.action = value;
        },
      },
      {
        when: (state) => state.action !== "publish" && state.action !== "excel",
        prompt: async (state) => {
          const options = [
            { value: "scholarship", label: "Scholarship (database or individual)" },
            {
              value: "internship",
              label: "Internship / work opportunity (database or individual)",
            },
            { value: "college_deadline", label: "College deadline" },
            { value: "general_deadline", label: "General deadline" },
            { value: "quarter-start", label: "Quarter start" },
            { value: "quarter-end", label: "Quarter end" },
            {
              value: "resource",
              label:
                "Resource / helpful link (student tool, Green River transfer link, university link, transfer guide, or similar)",
            },
            { value: "__back__", label: "Back" },
          ];

          const choice = await askChoice(
            rl,
            state.action === "remove" ? "What would you like to remove?" : "What would you like to add?",
            options,
            {
              invalidMessage: "Enter a listed number for your choice.",
            }
          );

          if (choice === "__back__") return BACK_SIGNAL;
          return choice;
        },
        assign(state, value) {
          state.entryType = value;
        },
      },
    ]);

    const action = entryFlow.action;
    const entryType = entryFlow.entryType;

    if (action === "publish") {
      await publishUpdatedResources(rl);
      return;
    }

    if (action === "excel") {
      await importExportResourcesAsExcelFile(rl);
      return;
    }

    if (action === "remove") {
      if (entryType === "resource") {
        await removeResource(rl);
        return;
      }

      await removeOpportunity(rl);
      return;
    }

    if (entryType === "resource") {
      await addResource(rl);
      return;
    }

    await addOpportunity(rl, entryType);
  } finally {
    rl.close();
  }
}

void main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
});
