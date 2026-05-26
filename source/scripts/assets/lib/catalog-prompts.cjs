const { createInterface } = require("node:readline/promises");
const { stdin, stdout } = require("node:process");
const fs = require("node:fs");

const {
  CUSTOM_DEADLINE_LABEL_OPTION,
  CUSTOM_MAJOR_PROGRAM_OPTION,
  FIXED_DEADLINE_LABEL_OPTIONS,
  MAJOR_PROGRAM_FIELD_OPTIONS,
  ROLLING_DEADLINE_LABEL_OPTIONS,
  ensureSentenceEnding,
  isUnknownValue,
  normalizeMajorList,
  normalizeUrl,
  normalizeWhitespace,
  splitFlexibleListInput,
} = require("./catalog-schema.cjs");

const BACK_SIGNAL = Symbol("back");
const TITLE_SMALL_WORDS = new Set([
  "a",
  "an",
  "and",
  "as",
  "at",
  "by",
  "for",
  "from",
  "in",
  "of",
  "on",
  "or",
  "the",
  "to",
  "via",
  "with",
]);
const WORD_CASE_OVERRIDES = new Map([
  ["uw", "UW"],
  ["grc", "GRC"],
  ["wsos", "WSOS"],
  ["fafsa", "FAFSA"],
  ["wasfa", "WASFA"],
  ["mesa", "MESA"],
  ["stem", "STEM"],
  ["hcde", "HCDE"],
  ["ece", "ECE"],
  ["ctclink", "ctcLink"],
  ["wa", "WA"],
]);

function log(message = "") {
  stdout.write(`${message}\n`);
}

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

function isBackCommand(value) {
  return String(value ?? "").trim().toLowerCase() === "back";
}

function isBackSignal(value) {
  return value === BACK_SIGNAL;
}

function formatHintLine(value) {
  const text = normalizeWhitespace(value);
  if (!text) return null;
  return ensureSentenceEnding(text);
}

function printQuestionHeader(label, hint = null) {
  log("");
  const formattedHint = formatHintLine(hint);
  if (formattedHint) {
    log(`Hint: ${formattedHint}`);
  }
  return label;
}

function formatDefaultValue(value) {
  if (Array.isArray(value)) {
    return value.filter((item) => item != null && item !== "").join(", ");
  }
  return value == null ? "" : String(value);
}

function formatBooleanSummary(value) {
  if (value === true) return "Yes";
  if (value === false) return "No";
  return "Unknown";
}

function formatNumberSummary(value) {
  return value == null ? "Unknown" : String(value);
}

function formatListSummary(values) {
  return Array.isArray(values) && values.length ? values.join(", ") : "Unknown";
}

function formatMoneySummary(min, max, currency = "USD") {
  if (min == null && max == null) return "Unknown";
  if (min != null && max != null) {
    return `${currency} ${min} to ${max}`;
  }
  if (min != null) return `${currency} ${min}+`;
  return `Up to ${currency} ${max}`;
}

function formatSummaryValue(value) {
  return value == null || value === "" ? "Unknown" : value;
}

function printSummary(title, rows, options = {}) {
  const numbered = options.numbered ?? false;
  log("");
  log(title);
  rows.forEach((row, index) => {
    const [label, value] = Array.isArray(row) ? row : [row.label, row.value];
    const prefix = numbered ? `${index + 1}.` : "-";
    log(`${prefix} ${label}: ${formatSummaryValue(value)}`);
  });
}

async function askSummaryRowNumber(rl, label, rows) {
  while (true) {
    log("");
    const answer = await rl.question(`${label} `);
    const normalized = answer.trim();

    if (isBackCommand(normalized)) {
      return BACK_SIGNAL;
    }

    const selectedIndex = Number.parseInt(normalized, 10);
    if (
      Number.isFinite(selectedIndex) &&
      String(selectedIndex) === normalized &&
      selectedIndex >= 1 &&
      selectedIndex <= rows.length
    ) {
      return selectedIndex - 1;
    }

    log(`Enter a number from 1 to ${rows.length}.`);
  }
}

function formatDateSummary(value) {
  return value ? value : "No auto-delete date";
}

function loadAnswerFile(filePath) {
  if (!filePath) return null;
  if (!fs.existsSync(filePath)) {
    fail(`Could not find answers file: ${filePath}`);
  }

  return fs
    .readFileSync(filePath, "utf8")
    .split(/\r?\n/)
    .map((line) => line.replace(/\r/g, ""));
}

function createPrompter() {
  const answersFilePath = String(process.env.GATORGUIDE_ANSWERS_FILE ?? "").trim();
  const scriptedAnswers = loadAnswerFile(answersFilePath);

  if (scriptedAnswers) {
    return {
      async question(prompt) {
        stdout.write(prompt);
        const nextAnswer = scriptedAnswers.length ? scriptedAnswers.shift() : "";
        stdout.write(`${nextAnswer}\n`);
        return nextAnswer;
      },
      close() {
        // no-op for scripted runs
      },
    };
  }

  return createInterface({
    input: stdin,
    output: stdout,
  });
}

async function askText(rl, label, options = {}) {
  const required = options.required ?? false;
  const defaultValue = options.defaultValue ?? "";
  const hint =
    options.hint !== undefined
      ? options.hint
      : required
        ? ""
        : "Press Enter if unknown";

  while (true) {
    const suffix = defaultValue ? ` [default: ${defaultValue}]` : "";
    const promptLabel = printQuestionHeader(`${label}${suffix}`, hint);
    const answer = await rl.question(`${promptLabel} `);
    const trimmed = answer.trim();

    if (isBackCommand(trimmed)) {
      return BACK_SIGNAL;
    }

    if (!trimmed && defaultValue) {
      return String(defaultValue);
    }

    if (!trimmed) {
      if (required) {
        log("Please enter a value for this field.");
        continue;
      }
      return null;
    }

    if (required && isUnknownValue(trimmed)) {
      log("This field is required, so it cannot be left unknown.");
      continue;
    }

    if (!required && isUnknownValue(trimmed)) {
      return null;
    }

    return trimmed;
  }
}

async function askChoice(rl, label, options, config = {}) {
  const defaultValue = config.defaultValue ?? null;
  const invalidMessage = config.invalidMessage ?? "Please choose one of the listed options.";
  const showDefaultLabel = config.showDefaultLabel ?? true;

  while (true) {
    log("");
    log(label);
    options.forEach((option, index) => {
      const isDefault =
        showDefaultLabel && option.value === defaultValue ? " (default)" : "";
      log(`  ${index + 1}. ${option.label}${isDefault}`);
    });

    const answer = await rl.question("Choose a number and press Enter: ");
    const trimmed = answer.trim();

    if (isBackCommand(trimmed)) {
      return BACK_SIGNAL;
    }

    if (!trimmed && defaultValue != null) {
      return defaultValue;
    }

    const numericIndex = Number.parseInt(trimmed, 10);
    if (Number.isFinite(numericIndex) && numericIndex >= 1 && numericIndex <= options.length) {
      return options[numericIndex - 1].value;
    }

    const matchingOption = options.find(
      (option) => option.value.toLowerCase() === trimmed.toLowerCase()
    );
    if (matchingOption) return matchingOption.value;

    log(invalidMessage);
  }
}

async function askYesNoUnknown(rl, label, config = {}) {
  const defaultValue = config.defaultValue;
  const defaultHint =
    defaultValue === true ? "yes" : defaultValue === false ? "no" : "unknown";
  const hint =
    config.hint ?? `Type yes, no, or press Enter for unknown [default: ${defaultHint}].`;

  while (true) {
    const promptLabel = printQuestionHeader(label, hint);
    const answer = await rl.question(`${promptLabel} `);
    const normalized = answer.trim().toLowerCase();

    if (normalized === "back") return BACK_SIGNAL;

    if (!normalized) return defaultValue ?? null;
    if (["y", "yes"].includes(normalized)) return true;
    if (["n", "no"].includes(normalized)) return false;
    if (isUnknownValue(normalized)) return null;

    log("Please type yes, no, or press Enter for unknown.");
  }
}

async function askNumber(rl, label, config = {}) {
  const min = config.min ?? Number.NEGATIVE_INFINITY;
  const max = config.max ?? Number.POSITIVE_INFINITY;
  const allowDecimals = config.allowDecimals ?? true;
  const hint = config.hint ?? "Press Enter if unknown";
  const defaultValue = config.defaultValue;
  const defaultSuffix =
    defaultValue != null && defaultValue !== "" ? ` [default: ${defaultValue}]` : "";

  while (true) {
    const promptLabel = printQuestionHeader(`${label}${defaultSuffix}`, hint);
    const answer = await rl.question(`${promptLabel} `);
    const trimmed = answer.trim();
    if (isBackCommand(trimmed)) return BACK_SIGNAL;
    if (!trimmed) return defaultValue ?? null;
    if (isUnknownValue(trimmed)) return null;

    const parsed = allowDecimals
      ? Number(trimmed)
      : Number.parseInt(trimmed, 10);

    if (!Number.isFinite(parsed)) {
      log("Please enter a valid number.");
      continue;
    }

    if (parsed < min || parsed > max) {
      log(`Please enter a value between ${min} and ${max}.`);
      continue;
    }

    return parsed;
  }
}

async function askDateOnly(rl, label, config = {}) {
  const hint = config.hint ?? "Use YYYY-MM-DD format. Press Enter if unknown";
  const defaultValue = config.defaultValue ?? null;
  const defaultSuffix = defaultValue ? ` [default: ${defaultValue}]` : "";

  while (true) {
    const promptLabel = printQuestionHeader(`${label}${defaultSuffix}`, hint);
    const answer = await rl.question(`${promptLabel} `);
    const trimmed = answer.trim();
    if (isBackCommand(trimmed)) return BACK_SIGNAL;
    if (!trimmed) return defaultValue ?? null;
    if (isUnknownValue(trimmed)) {
      if (config.required) {
        log("This date is required for the deadline mode you chose.");
        continue;
      }
      return null;
    }

    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return trimmed;
    }

    log("Please use YYYY-MM-DD.");
  }
}

async function askCommaList(rl, label, config = {}) {
  const defaultValue = Array.isArray(config.defaultValue) ? config.defaultValue : [];
  const defaultSuffix = defaultValue.length
    ? ` [default: ${formatDefaultValue(defaultValue)}]`
    : "";
  const promptLabel = printQuestionHeader(
    `${label}${defaultSuffix}`,
    "Separate multiple answers with commas or spaces. Use commas when one answer has multiple words. Press Enter if unknown"
  );
  const answer = await rl.question(`${promptLabel} `);
  if (isBackCommand(answer)) return BACK_SIGNAL;
  if (!answer.trim()) return [...defaultValue];
  if (isUnknownValue(answer)) return [];
  return Array.from(
    new Set(
      splitFlexibleListInput(answer)
    )
  );
}

async function askMultiSelect(rl, label, options, config = {}) {
  const defaultValue = Array.isArray(config.defaultValue) ? config.defaultValue : [];

  while (true) {
    const promptLabel = printQuestionHeader(label, config.hint ?? null);
    log(promptLabel);
    if (defaultValue.length) {
      const currentLabels = defaultValue
        .map((selected) => options.find((option) => option.value === selected)?.label ?? selected)
        .join(", ");
      log(`Current selection: ${currentLabels}`);
    }
    options.forEach((option, index) => {
      log(`  ${index + 1}. ${option.label}`);
    });
    const answer = await rl.question(
      config.promptText ??
        "Enter numbers separated by commas or spaces, or press Enter if none/unknown: "
    );
    const trimmed = answer.trim();
    if (isBackCommand(trimmed)) return BACK_SIGNAL;
    if (!trimmed) return [...defaultValue];
    if (isUnknownValue(trimmed)) return [];

    const parts = trimmed
      .split(/[,\s]+/)
      .map((part) => Number.parseInt(part.trim(), 10))
      .filter((value) => Number.isFinite(value));

    if (!parts.length || parts.some((value) => value < 1 || value > options.length)) {
      log(
        config.invalidMessage ??
          "Please use the numbers from the list, separated by commas or spaces."
      );
      continue;
    }

    return Array.from(new Set(parts)).map((value) => options[value - 1].value);
  }
}

async function askMajorProgramFieldSelection(rl, defaultValue = []) {
  const normalizedDefault = normalizeMajorList(defaultValue);
  const knownOptionValues = new Set(MAJOR_PROGRAM_FIELD_OPTIONS.map((option) => option.value));
  const knownDefaults = normalizedDefault.filter((value) => knownOptionValues.has(value));
  const customDefaults = normalizedDefault.filter((value) => !knownOptionValues.has(value));

  while (true) {
    const selectedValues = await askMultiSelect(
      rl,
      "Relevant majors, programs, or fields:",
      [...MAJOR_PROGRAM_FIELD_OPTIONS, CUSTOM_MAJOR_PROGRAM_OPTION],
      {
        defaultValue: [
          ...knownDefaults,
          ...(customDefaults.length ? [CUSTOM_MAJOR_PROGRAM_OPTION.value] : []),
        ],
        hint:
          'Choose any that apply. You can type numbers like 4, 5, 6, 1. Pick "Type custom major(s), program(s), or field(s)" if you need something not listed here.',
      }
    );

    if (isBackSignal(selectedValues)) return BACK_SIGNAL;

    const includesCustom = selectedValues.includes(CUSTOM_MAJOR_PROGRAM_OPTION.value);
    if (!includesCustom) {
      return normalizeMajorList(selectedValues);
    }

    const customValues = await askCommaList(
      rl,
      "Type any additional majors, programs, or fields not listed above:",
      {
        defaultValue: customDefaults,
      }
    );

    if (isBackSignal(customValues)) {
      continue;
    }

    return normalizeMajorList([
      ...selectedValues.filter((value) => value !== CUSTOM_MAJOR_PROGRAM_OPTION.value),
      ...customValues,
    ]);
  }
}

function getRecommendedDeadlineLabel(deadlineMode, deadlineType) {
  if (deadlineMode === "rolling") {
    return "Rolling applications";
  }

  if (deadlineType === "priority") {
    return "Priority deadline";
  }

  return "Application deadline";
}

async function askDeadlineLabelSelection(rl, state) {
  const optionSet =
    state.deadlineMode === "rolling"
      ? ROLLING_DEADLINE_LABEL_OPTIONS
      : FIXED_DEADLINE_LABEL_OPTIONS;
  const currentValue = normalizeWhitespace(state.deadlineLabel ?? "");
  const recommendedValue = getRecommendedDeadlineLabel(state.deadlineMode, state.deadlineType);
  const matchingOption = optionSet.find(
    (option) => option.value.toLowerCase() === currentValue.toLowerCase()
  );
  const defaultValue = currentValue
    ? (matchingOption?.value ?? CUSTOM_DEADLINE_LABEL_OPTION.value)
    : recommendedValue;

  const selectedValue = await askChoice(
    rl,
    "Which deadline text should students see?",
    [...optionSet, CUSTOM_DEADLINE_LABEL_OPTION],
    {
      defaultValue,
      invalidMessage:
        optionSet.length === 2
          ? "Enter in 1, 2, or 3 for your choice."
          : "Enter in 1, 2, 3, or 4 for your choice.",
      showDefaultLabel: false,
    }
  );

  if (isBackSignal(selectedValue)) {
    return BACK_SIGNAL;
  }

  if (selectedValue !== CUSTOM_DEADLINE_LABEL_OPTION.value) {
    return selectedValue;
  }

  const customValue = await askText(rl, "Type the deadline text students should see:", {
    hint: `Press Enter to use: "${recommendedValue}".`,
    defaultValue: matchingOption ? recommendedValue : currentValue || recommendedValue,
  });

  if (isBackSignal(customValue)) {
    return BACK_SIGNAL;
  }

  return customValue;
}

async function confirmAction(rl, label, defaultValue = false) {
  const confirmed = await askYesNoUnknown(rl, label, { defaultValue });
  if (isBackSignal(confirmed)) return BACK_SIGNAL;
  return confirmed === true;
}

async function askUrl(rl, label, options = {}) {
  while (true) {
    const raw = await askText(rl, label, options);
    if (isBackSignal(raw)) return BACK_SIGNAL;

    const normalized = normalizeUrl(raw);
    if (normalized || !options.required) {
      return normalized;
    }

    log(options.invalidMessage ?? "A valid link is required.");
  }
}

async function runWizard(rl, steps, initialState = {}, startIndex = 0) {
  const state = initialState;
  let index = Math.max(0, Number.isFinite(startIndex) ? startIndex : 0);

  while (index < steps.length) {
    const step = steps[index];
    if (step.when && !step.when(state)) {
      index += 1;
      continue;
    }

    const result = await step.prompt(rl, state);
    if (isBackSignal(result)) {
      let previousIndex = index - 1;
      while (previousIndex >= 0) {
        const previousStep = steps[previousIndex];
        if (!previousStep.when || previousStep.when(state)) {
          break;
        }
        previousIndex -= 1;
      }

      if (previousIndex < 0) {
        log("You are already at the first question.");
        continue;
      }

      index = previousIndex;
      continue;
    }

    step.assign(state, result);
    index += 1;
  }

  return state;
}

module.exports = {
  BACK_SIGNAL,
  log,
  fail,
  isBackCommand,
  isBackSignal,
  formatDefaultValue,
  formatBooleanSummary,
  formatNumberSummary,
  formatListSummary,
  formatMoneySummary,
  formatDateSummary,
  printSummary,
  askSummaryRowNumber,
  createPrompter,
  askText,
  askChoice,
  askYesNoUnknown,
  askNumber,
  askDateOnly,
  askCommaList,
  askMultiSelect,
  askMajorProgramFieldSelection,
  askDeadlineLabelSelection,
  confirmAction,
  askUrl,
  runWizard,
};
