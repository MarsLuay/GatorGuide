import { writeFileSync } from "fs";
import path from "path";

import {
  getTransferPlannerGrcCourseList,
  getTransferPlannerGrcCourseListGuidance,
  getTransferPlannerMajorsForCampus,
  getTransferPlannerTrack,
  type TransferPlannerCampusId,
  type TransferPlannerChecklistItem,
  type TransferPlannerDegreeMapSection,
  type TransferPlannerMajorPlan,
} from "../../constants/transfer-planner-source";

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

function sanitizePlannerDocText(value: string) {
  return String(value)
    .replace(
      /confirm the exact timing with an advisor if the major has multiple internal routes/gi,
      "the planner keeps this option only when the published source supports it and does not infer internal route timing beyond that source"
    )
    .replace(
      /support-only but strong /gi,
      "supplemental source-backed prep only; strong "
    )
    .replace(
      /support-only with strong /gi,
      "supplemental source-backed prep only; strong "
    )
    .replace(/support-only;/gi, "supplemental source-backed prep only;")
    .replace(/support-only/gi, "supplemental source-backed prep only")
    .replace(/review-needed/gi, "source-unverified-hidden");
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
    sequenceLines.push(`- Planner flag: ${flag}`);
  });

  (plan.validationNotes ?? []).forEach((note) => {
    sequenceLines.push(`- Source-backed note: ${sanitizePlannerDocText(note)}`);
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
  const plans = getTransferPlannerMajorsForCampus(campusId);

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
