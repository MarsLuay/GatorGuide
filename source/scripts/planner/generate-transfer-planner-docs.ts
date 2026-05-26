const { writeFileSync } = require("fs");
const path = require("path");

const {
  getTransferPlannerGrcCourseList,
  getTransferPlannerGrcCourseListGuidance,
  getTransferPlannerMajorsForCampus,
  getTransferPlannerTrack,
} = require("../../constants/transfer-planner-source/index");

type TransferPlannerCampusId =
  import("../../constants/transfer-planner-source/index").TransferPlannerCampusId;
type TransferPlannerChecklistItem =
  import("../../constants/transfer-planner-source/index").TransferPlannerChecklistItem;
type TransferPlannerMajorPlan =
  import("../../constants/transfer-planner-source/index").TransferPlannerMajorPlan;

type CampusDocConfig = {
  fileName: string;
  heading: string;
  introLines: string[];
  sectionHeading: string;
};

const CAMPUS_DOCS: Record<TransferPlannerCampusId, CampusDocConfig> = {
  "uw-seattle": {
    fileName: "UWS_DEGREE_COURSES.md",
    heading: "# UWS Degree Courses",
    introLines: [
      "This doc lists every current `GRC -> UW Seattle` degree row tracked by the planner.",
      "Each degree section includes the planner coverage, the current Green River base track when one exists, the links used for the UW degree reference, the exact UW degree-map courses when known, the planner's explicit GRC equivalent course list, and the requirement sequences the planner currently tracks for application, enrollment, or stronger transfer prep.",
      "This doc already folds together the current planner rows, the Seattle department guidance stored on each major, and the Green River equivalency assumptions that affect Seattle transfer planning.",
    ],
    sectionHeading: "## UWS Degrees + GRC Equivalent Courses",
  },
  "uw-bothell": {
    fileName: "UWB_DEGREE_COURSES.md",
    heading: "# UWB Degree Courses",
    introLines: [
      "This doc lists every current `GRC -> UW Bothell` degree row tracked by the planner.",
      "Each degree section includes the planner coverage, the current Green River base track when one exists, the links used for the UW degree reference, the exact UW degree-map courses when known, the planner's explicit GRC equivalent course list, and the requirement sequences the planner currently tracks for application, enrollment, or stronger transfer prep.",
      "This doc already folds together the current planner rows plus the Bothell equivalency guide, major planning worksheet logic, and the Bothell-specific transfer assumptions the planner uses.",
    ],
    sectionHeading: "## UWB Degrees + GRC Equivalent Courses",
  },
  "uw-tacoma": {
    fileName: "UWT_DEGREE_COURSES.md",
    heading: "# UWT Degree Courses",
    introLines: [
      "This doc lists every current `GRC -> UW Tacoma` degree row tracked by the planner.",
      "Each degree section includes the planner coverage, the current Green River base track when one exists, the links used for the UW degree reference, the exact UW degree-map courses when known, the planner's explicit GRC equivalent course list, and the requirement sequences the planner currently tracks for application, enrollment, or stronger transfer prep.",
      "This doc already folds together the current planner rows plus Tacoma catalog guidance, the Tacoma equivalency guide, and the Tacoma-specific transfer assumptions the planner uses.",
    ],
    sectionHeading: "## UWT Degrees + GRC Equivalent Courses",
  },
};

function formatCourseList(courses: string[], guidance?: string | null) {
  if (!courses.length) return sanitizePlannerDocText(guidance ?? "On To Do list.");
  return courses.map((course) => `- \`${course}\``).join("\n");
}

function decodeHtmlEntities(value: string) {
  const namedEntities: Record<string, string> = {
    amp: "&",
    apos: "'",
    gt: ">",
    lt: "<",
    nbsp: " ",
    quot: '"',
  };

  return String(value)
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&([a-z]+);/gi, (match, entity) => namedEntities[entity.toLowerCase()] ?? match);
}

function repairPlannerDocEncoding(value: string) {
  const text = String(value ?? "");
  if (!/[\u00e2\u00c3\u00ef]/.test(text)) {
    return text;
  }

  try {
    const repaired = Buffer.from(text, "latin1").toString("utf8");
    return repaired.includes("\uFFFD") ? text : repaired;
  } catch {
    return text;
  }
}

function normalizePlannerDocMojibake(value: string) {
  let normalized = String(value);
  const replacements: Array<[string, string]> = [
    ["\u00e2\u20ac\u2122", "'"],
    ["\u00e2\u20ac\u0153", '"'],
    ["\u00e2\u20ac\u009c", '"'],
    ["\u00e2\u20ac\u009d", '"'],
    ["\u00e2\u20ac\u0093", "-"],
    ["\u00e2\u20ac\u201c", "-"],
    ["\u00e2\u20ac\u0094", "-"],
    ["\u00e2\u20ac\u201d", "-"],
    ["\u00ef\u0081\u00b4", ""],
  ];

  for (const [search, replacement] of replacements) {
    normalized = normalized.split(search).join(replacement);
  }

  return normalized;
}

function wrapLiteralUrls(value: string) {
  return String(value).replace(/https?:\/\/\S+/g, (rawUrl) => {
    const trimmedUrl = rawUrl.replace(/[),.;]+$/, "");
    const suffix = rawUrl.slice(trimmedUrl.length);
    return `<${trimmedUrl}>${suffix}`;
  });
}

function wrapLiteralEmails(value: string) {
  const text = String(value);
  return text.replace(
    /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,
    (email, offset) => {
      const before = text[offset - 1];
      const after = text[offset + email.length];
      if (before === "<" && after === ">") {
        return email;
      }
      return `<${email}>`;
    }
  );
}

function escapePlannerDocMarkdown(value: string) {
  return String(value)
    .replace(/\\/g, "\\\\")
    .replace(/\*/g, "\\*")
    .replace(/\[/g, "\\[")
    .replace(/\]/g, "\\]")
    .replace(/&(?!(?:[a-z]+|#\d+|#x[0-9a-f]+);)/gi, "&amp;");
}

function sanitizePlannerDocText(value: string) {
  const normalized = String(value)
    .replace(
      /confirm the exact timing with an advisor if the major has multiple internal routes/gi,
      "the planner keeps this option only when the published source supports it and does not infer internal route timing beyond that source"
    )
    .replace(
      /support-only but strong /gi,
      "supplemental prep only; strong "
    )
    .replace(
      /support-only with strong /gi,
      "supplemental prep only; strong "
    )
    .replace(/support-only;/gi, "supplemental prep only;")
    .replace(/support-only/gi, "supplemental prep only")
    .replace(/review-needed/gi, "source-unverified-hidden");

  return escapePlannerDocMarkdown(
    wrapLiteralEmails(
      wrapLiteralUrls(
        normalizePlannerDocMojibake(
          decodeHtmlEntities(repairPlannerDocEncoding(normalized))
        )
      )
    )
  );
}

function formatLinksUsed(plan: TransferPlannerMajorPlan) {
  if (!plan.officialLinks.length) {
    return ["##### Links Used", "", "On To Do list.", ""];
  }

  const lines = ["##### Links Used", ""];

  plan.officialLinks.forEach((link) => {
    const note = link.note ? ` - ${sanitizePlannerDocText(link.note)}` : "";
    lines.push(`- [${link.label}](${link.url})${note}`);
  });

  lines.push("");

  return lines;
}

function formatChecklistItem(prefix: string, item: TransferPlannerChecklistItem) {
  let line = `${prefix}: ${sanitizePlannerDocText(item.title)}`;

  if (item.grcCourses.length) {
    line += ` -> ${item.grcCourses.map((course) => `\`${course}\``).join(", ")}`;
  }

  if (typeof item.minCompletedCount === "number") {
    const courseWord = item.minCompletedCount === 1 ? "course" : "courses";
    line += `. complete at least ${item.minCompletedCount} ${courseWord} from this set`;
  }

  if (item.alternatives?.length) {
    const alternatives = item.alternatives
      .map((sequence) => sequence.map((course) => `\`${course}\``).join(", "))
      .join(" or ");
    line += `. alternate path ${alternatives}`;
  }

  if (item.note) {
    line += `. note: ${sanitizePlannerDocText(item.note)}`;
  }

  return `- ${line}`;
}

function formatDegreeMapSections(plan: TransferPlannerMajorPlan) {
  const sections = plan.degreeMapSections;

  if (!sections?.length) {
    return [
      "#### Exact UW Courses Needed for Full Degree at UW",
      "",
      ...formatLinksUsed(plan),
      "On To Do list.",
      "",
    ];
  }

  const lines = [
    "#### Exact UW Courses Needed for Full Degree at UW",
    "",
    ...formatLinksUsed(plan),
  ];

  sections.forEach((section) => {
    lines.push(`##### ${sanitizePlannerDocText(section.title)}`, "");
    section.items.forEach((item) => lines.push(`- ${sanitizePlannerDocText(item)}`));

    if (section.note) {
      lines.push(`- Note: ${sanitizePlannerDocText(section.note)}`);
    }

    lines.push("");
  });

  return lines;
}

function dedupeLines(lines: string[]) {
  const seen = new Set<string>();
  const deduped: string[] = [];

  lines.forEach((line) => {
    if (!seen.has(line)) {
      seen.add(line);
      deduped.push(line);
    }
  });

  return deduped;
}

function formatRequiredSequences(plan: TransferPlannerMajorPlan) {
  const lines = ["#### Required sequences for specific credits", ""];
  const sequenceLines: string[] = [];

  plan.applicationChecklist.forEach((item) => {
    sequenceLines.push(formatChecklistItem("Required before application", item));
  });

  plan.beforeEnrollmentChecklist.forEach((item) => {
    sequenceLines.push(formatChecklistItem("Required before enrollment", item));
  });

  plan.stayAtGrcChecklist.forEach((item) => {
    sequenceLines.push(formatChecklistItem("Worth finishing at Green River", item));
  });

  plan.advisorFlags.forEach((flag) => {
    sequenceLines.push(`- Planner flag: ${sanitizePlannerDocText(flag)}`);
  });

  (plan.validationNotes ?? []).forEach((note) => {
    sequenceLines.push(`- note: ${sanitizePlannerDocText(note)}`);
  });

  const dedupedSequenceLines = dedupeLines(sequenceLines);

  if (!dedupedSequenceLines.length) {
    dedupedSequenceLines.push(
      "- No specific requirement sequences are stored yet beyond the current GRC equivalent course list."
    );
  }

  return [...lines, ...dedupedSequenceLines, ""];
}

function formatSummary(plan: TransferPlannerMajorPlan) {
  const trackCode = getTransferPlannerTrack(plan.bestTrackId)?.code ?? "custom";
  return [
    "#### Summary",
    "",
    `Planner coverage: \`${plan.coverage}\`. Best Green River base: \`${trackCode}\`.`,
    sanitizePlannerDocText(plan.summary),
    "",
  ];
}

function formatMajor(plan: TransferPlannerMajorPlan) {
  const grcCourseList = getTransferPlannerGrcCourseList(plan);
  const grcCourseListGuidance = getTransferPlannerGrcCourseListGuidance(plan);

  return [
    `### ${plan.title}`,
    "",
    ...formatSummary(plan),
    ...formatDegreeMapSections(plan),
    "#### GRC Equivalent Courses",
    "",
    formatCourseList(grcCourseList, grcCourseListGuidance),
    "",
    ...formatRequiredSequences(plan),
  ];
}

function buildCampusDoc(campusId: TransferPlannerCampusId) {
  const config = CAMPUS_DOCS[campusId];
  const plans: TransferPlannerMajorPlan[] = getTransferPlannerMajorsForCampus(campusId);

  const lines = [
    config.heading,
    "",
    "## Summary of this doc and what it contains",
    "",
    ...config.introLines,
    "",
    config.sectionHeading,
    "",
  ];

  plans.forEach((plan, index) => {
    lines.push(...formatMajor(plan));

    if (index < plans.length - 1) {
      lines.push("");
    }
  });

  return lines.join("\r\n");
}

function main() {
  const plannerDocsDir = path.resolve(process.cwd(), "docs", "planner");

  (Object.keys(CAMPUS_DOCS) as TransferPlannerCampusId[]).forEach((campusId) => {
    const config = CAMPUS_DOCS[campusId];
    const docPath = path.join(plannerDocsDir, config.fileName);
    writeFileSync(docPath, buildCampusDoc(campusId), "utf8");
  });
}

main();
