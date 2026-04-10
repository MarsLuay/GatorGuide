/* global __dirname */
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
  TRANSFER_PLANNER_ALL_MAJOR_PLANS,
  TRANSFER_PLANNER_CAMPUSES,
} = require("../../constants/transfer-planner-data");
const {
  TRANSFER_PLANNER_GENERATED_GRC_ASSOCIATE_TRACKS,
} = require("../../constants/transfer-planner-source/grc-associate-tracks.generated");
const {
  TRANSFER_PLANNER_PROMOTED_PRIMARY_SOURCE_OVERRIDES,
} = require("../../constants/transfer-planner-source/source-manifest-primary-overrides.generated");
const {
  TRANSFER_PLANNER_PARSED_REQUIREMENT_SOURCE_BLOCK_REGISTRY,
} = require("../../constants/transfer-planner-source/registry");

const OUTPUT_PATH = path.resolve(
  __dirname,
  "..",
  "..",
  "constants",
  "transfer-planner-source",
  "bootstrap.generated.ts"
);
const DISABLED_UNVERIFIED_OFFICIAL_LINK_URLS = new Set([
  "https://admit.washington.edu/majors/english-language-literature-culture/",
  "https://ais.washington.edu/sites/ais/files/documents/ais_major_requirement_sheet_9.29.21.pdf",
  "https://chem.washington.edu/bs-chemistry",
  "https://chem.washington.edu/bs-chemistry-acs-certified",
  "https://chem.washington.edu/undergraduate-prerequisites-and-admissions-biochemistry",
  "https://chem.washington.edu/undergraduate-prerequisites-and-admissions-chemistry",
  "https://chid.washington.edu/undergraduate",
  "https://cinema.washington.edu/undergraduate-programs",
  "https://classics.washington.edu/ba-classical-studies",
  "https://classics.washington.edu/ba-classics",
  "https://classics.washington.edu/ba-latin",
  "https://classics.washington.edu/majors",
  "https://classics.washington.edu/undergraduate-program",
  "https://com.uw.edu/academics/undergraduate/communication-major/",
  "https://complit.washington.edu/undergraduate",
  "https://dance.washington.edu/undergraduate-program",
  "https://drama.washington.edu/ba-drama-program-requirements",
  "https://drama.washington.edu/undergraduate-programs",
  "https://econ.washington.edu/bachelor-arts",
  "https://econ.washington.edu/bachelor-science",
  "https://econ.washington.edu/choosing-your-economics-degree",
  "https://econ.washington.edu/undergraduate",
  "https://education.washington.edu/academics/program/ba-education-studies-0",
  "https://english.washington.edu/creative-writing",
  "https://english.washington.edu/english-language-literature-and-culture-option",
  "https://english.washington.edu/english-major-creative-writing-option",
  "https://english.washington.edu/how-apply-undergraduate-creative-writing-option",
  "https://english.washington.edu/language-literature-and-culture",
  "https://frenchitalian.washington.edu/major-french-studies",
  "https://frenchitalian.washington.edu/undergraduate-studies-french",
  "https://geography.washington.edu/ba-geography",
  "https://geography.washington.edu/ba-geography-data-science-option",
  "https://german.washington.edu/german-studies",
  "https://history.washington.edu/major",
  "https://history.washington.edu/undergraduate-programs",
  "https://linguistics.washington.edu/ba-linguistics",
  "https://linguistics.washington.edu/undergraduate-language-requirement",
  "https://linguistics.washington.edu/undergraduate-programs",
  "https://lsj.washington.edu/lsj-gold-curriculum-requirements",
  "https://math.washington.edu/bs-mathematics-major-requirements-0",
  "https://math.washington.edu/undergraduate-major-requirements",
  "https://music.washington.edu/ba-ethnomusicology",
  "https://music.washington.edu/bachelor-arts",
  "https://music.washington.edu/bachelor-arts-music-music-history-option",
  "https://music.washington.edu/bachelor-arts-music-music-theory-option",
  "https://music.washington.edu/bachelor-arts-music-voice-option",
  "https://music.washington.edu/bachelor-music",
  "https://music.washington.edu/bachelor-music-music-education-vocal-emphasis",
  "https://music.washington.edu/bachelor-music-organ",
  "https://music.washington.edu/bachelor-music-percussion-performance",
  "https://music.washington.edu/bachelor-music-piano",
  "https://music.washington.edu/bachelor-music-voice",
  "https://phys.washington.edu/bachelor-science-physics",
  "https://phys.washington.edu/physics-bs-degree-requirements",
  "https://religion.washington.edu/undergraduate",
  "https://scandinavian.washington.edu/ba-danish",
  "https://scandinavian.washington.edu/ba-finnish",
  "https://scandinavian.washington.edu/ba-scandinavian-area-studies",
  "https://scandinavian.washington.edu/ba-swedish",
  "https://scandinavian.washington.edu/undergraduate",
  "https://scandinavian.washington.edu/undergraduate-programs",
  "https://slavic.washington.edu/ba-global-literary-studies-glits",
  "https://slavic.washington.edu/undergraduate-policies",
  "https://slavic.washington.edu/undergraduate-programs",
  "https://soc.washington.edu/current-majors",
  "https://soc.washington.edu/declare-sociology-major",
  "https://spanport.washington.edu/admission-spanish-major",
  "https://spanport.washington.edu/spanish-major-requirements",
  "https://urbdp.be.uw.edu/academic-programs/undergraduate/community-environment-and-planning/",
  "https://web.geology.washington.edu/education/undergrad/degrees_ba.php",
  "https://web.geology.washington.edu/education/undergrad/degrees_bs.php",
  "https://www.be.washington.edu/academics/construction-management/",
  "https://www.biology.washington.edu/programs/undergraduate/admissions",
  "https://www.ce.washington.edu/future/undergrad/environmental/transfer",
  "https://www.ece.washington.edu/academics/bachelor-of-science/bs-admissions-requirements/",
  "https://www.polisci.washington.edu/political-science-major-declaration-and-requirements",
  "https://www.polisci.washington.edu/undergraduate-programs",
  "https://www.tacoma.uw.edu/sias-new/socs-new/individually-designed-concentration",
  "https://www.tacoma.uw.edu/sias/cac/communication-degree-requirements",
  "https://www.tacoma.uw.edu/sias/healthcare-leadership",
  "https://www.tacoma.uw.edu/sias/interdisciplinary-arts-and-sciences",
  "https://www.tacoma.uw.edu/sias/pppa/economics-and-policy-analysis-major-requirements",
  "https://www.tacoma.uw.edu/sias/pppa/politics-philosophy-and-economics-ppe",
  "https://www.tacoma.uw.edu/sias/sam/spanish-language-and-cultures",
  "https://www.tacoma.uw.edu/sias/sam/writing-studies",
  "https://www.tacoma.uw.edu/sias/socs/politics-philosophy-and-economics",
  "https://www.tacoma.uw.edu/soe/application-information",
  "https://www.tacoma.uw.edu/swcj/admissions",
  "https://www.uwb.edu/stem/undergraduate/majors/interactive-media-design",
]);
const PRESERVED_PRIMARY_SOURCE_URLS = new Set([
  ...TRANSFER_PLANNER_PROMOTED_PRIMARY_SOURCE_OVERRIDES.map((entry) => String(entry.url ?? "").trim()),
  ...TRANSFER_PLANNER_PARSED_REQUIREMENT_SOURCE_BLOCK_REGISTRY.flatMap((block) =>
    block.ok && !block.usedSnapshotFallback
      ? [String(block.primarySourceUrl ?? "").trim(), String(block.sourceUrl ?? "").trim()]
      : []
  ),
]);

const PLANNER_OWNED_TEXT_REPLACEMENTS = [
  [/\bAdvisor-approved custom Green River prep\b/gi, "Custom source-backed Green River prep"],
  [/\bbefore final advisor review\b/gi, "as the current source-backed baseline"],
  [/\bbefore final adviser review\b/gi, "as the current source-backed baseline"],
  [
    /\bprogram-by-program advisor confirmation for final admission strategy\b/gi,
    "a source-backed baseline only; unsupported admission-strategy details stay hidden until public-source coverage improves",
  ],
  [
    /\badvisor review is still needed for final degree planning\b/gi,
    "unsupported degree-planning details stay hidden until public sources can verify them",
  ],
  [
    /\badvisor review is still smart before freezing the final term order\b/gi,
    "unsupported term-order details stay hidden until public sources can verify them",
  ],
  [
    /\bconfirm the exact class mix with an advisor\b/gi,
    "follow the current source-backed degree guidance instead of inventing an unsupported class mix",
  ],
  [
    /\byear-specific advisor review is still recommended\b/gi,
    "year-specific differences should stay hidden until public sources verify them",
  ],
  [
    /\bstays under advisor review\b/gi,
    "stays hidden until public sources verify the substitution",
  ],
  [
    /\bUse advisor review before treating any one ACMS option as the final four-year finish, because\b/gi,
    "Keep ACMS option-specific finishes hidden until public sources verify them, because",
  ],
  [
    /\bUse adviser review before treating any one ACMS option as the final four-year finish, because\b/gi,
    "Keep ACMS option-specific finishes hidden until public sources verify them, because",
  ],
  [
    /\bstill deserve advisor review when building the exact final list\b/gi,
    "should stay hidden unless public sources verify the exact final list",
  ],
  [
    /\bstill deserve adviser review when building the exact final list\b/gi,
    "should stay hidden unless public sources verify the exact final list",
  ],
  [
    /\bUse advisor review if a student plans to submit with one in-progress prerequisite exception\b/gi,
    "Hide the in-progress-prerequisite exception unless public sources verify it",
  ],
  [
    /\bUse adviser review if a student plans to submit with one in-progress prerequisite exception\b/gi,
    "Hide the in-progress-prerequisite exception unless public sources verify it",
  ],
  [
    /\bUse advisor review if the student wants the lightest possible science mix versus the strongest long-term engineering prep\b/gi,
    "Show the strongest source-backed science mix; lighter alternatives stay hidden until public sources verify them",
  ],
  [
    /\bUse adviser review if the student wants the lightest possible science mix versus the strongest long-term engineering prep\b/gi,
    "Show the strongest source-backed science mix; lighter alternatives stay hidden until public sources verify them",
  ],
  [
    /\badvisor review is still important when a student is following an older catalog year\b/gi,
    "older catalog-year differences should stay hidden until public sources verify them",
  ],
  [
    /\badviser review is still important when a student is following an older catalog year\b/gi,
    "older catalog-year differences should stay hidden until public sources verify them",
  ],
  [
    /\badvisor review is still needed to lock the exact B\.A\. versus B\.S\. finish\b/gi,
    "the exact B.A. versus B.S. finish should stay hidden until public sources verify it",
  ],
  [
    /\badviser review is still needed to lock the exact B\.A\. versus B\.S\. finish\b/gi,
    "the exact B.A. versus B.S. finish should stay hidden until public sources verify it",
  ],
  [
    /\badvisor review is still important before locking the final upper-division sequence\b/gi,
    "upper-division sequencing differences should stay hidden until public sources verify them",
  ],
  [
    /\badviser review is still important before locking the final upper-division sequence\b/gi,
    "upper-division sequencing differences should stay hidden until public sources verify them",
  ],
  [/\badvisor-reviewed transfer strategy\b/gi, "source-backed transfer strategy"],
  [/\badviser-reviewed transfer strategy\b/gi, "source-backed transfer strategy"],
  [/\bwith advisor approval\b/gi, "under the published approval rules"],
  [/\bwith adviser approval\b/gi, "under the published approval rules"],
  [/\bsubject to advisor approval\b/gi, "subject to the published approval rules"],
  [/\bsubject to adviser approval\b/gi, "subject to the published approval rules"],
  [/\badvisor approval\b/gi, "published approval rules"],
  [/\badviser approval\b/gi, "published approval rules"],
  [/\badvisor input\b/gi, "the published sequence"],
  [/\badviser input\b/gi, "the published sequence"],
  [/\badvisor review matters here because\b/gi, "This source-backed planner row stays broad because"],
  [/\badviser review matters here because\b/gi, "This source-backed planner row stays broad because"],
  [/\bUse advisor review whenever\b/gi, "Keep this planner row broad whenever"],
  [/\bUse adviser review whenever\b/gi, "Keep this planner row broad whenever"],
  [/\badvisor-approved\b/gi, "source-backed"],
  [/\badviser-approved\b/gi, "source-backed"],
  [
    /\bthe public page explicitly notes that students who entered before Autumn 2024 follow older requirements and should use adviser review\b/gi,
    "The public page explicitly notes that students who entered before Autumn 2024 follow older requirements, so older cohorts stay hidden until public-source coverage expands",
  ],
  [
    /\bthe public page explicitly notes that students who entered before Autumn 2024 follow older requirements and should use advisor review\b/gi,
    "The public page explicitly notes that students who entered before Autumn 2024 follow older requirements, so older cohorts stay hidden until public-source coverage expands",
  ],
  [/\buse advisor review to decide whether\b/gi, "use the published path guidance to decide whether"],
  [/\buse adviser review to decide whether\b/gi, "use the published path guidance to decide whether"],
  [/\buse advisor review to place\b/gi, "use the source-backed plan to place"],
  [/\buse adviser review to place\b/gi, "use the source-backed plan to place"],
  [/\buse advisor review for the remaining\b/gi, "keep the remaining"],
  [/\buse adviser review for the remaining\b/gi, "keep the remaining"],
  [/\bSIAS adviser review\b/gi, "the published SIAS proposal process"],
  [/\bSIAS advisor review\b/gi, "the published SIAS proposal process"],
  [/\badviser review\b/gi, "source-backed planning"],
  [/\badvisor review\b/gi, "source-backed planning"],
  [/\bsupport-only but strong /gi, "supplemental source-backed prep only with strong "],
  [/\bsupport-only with strong /gi, "supplemental source-backed prep only with strong "],
  [/\bsupport-only;/gi, "supplemental source-backed prep only;"],
  [/\bsupport-only\b/gi, "supplemental source-backed prep only"],
];

function sanitizePlannerOwnedText(value) {
  let text = String(value ?? "").trim();
  if (!text) return "";

  for (const [pattern, replacement] of PLANNER_OWNED_TEXT_REPLACEMENTS) {
    text = text.replace(pattern, replacement);
  }

  return text.trim();
}

function normalizeOfficialLinks(value) {
  const normalizedLinks = [];
  const seenUrls = new Set();

  for (const rawLink of Array.isArray(value) ? value : []) {
    if (!rawLink || typeof rawLink !== "object") {
      continue;
    }

    const url = String(rawLink.url ?? "").trim();
    if (
      !url ||
      (DISABLED_UNVERIFIED_OFFICIAL_LINK_URLS.has(url) && !PRESERVED_PRIMARY_SOURCE_URLS.has(url)) ||
      seenUrls.has(url)
    ) {
      continue;
    }

    seenUrls.add(url);
    normalizedLinks.push(sanitizeValue(rawLink));
  }

  return normalizedLinks;
}

function sanitizeValue(value) {
  if (typeof value === "string") {
    return sanitizePlannerOwnedText(value);
  }

  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeValue(entry));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entryValue]) => [
        key,
        key === "officialLinks" ? normalizeOfficialLinks(entryValue) : sanitizeValue(entryValue),
      ])
    );
  }

  return value;
}

function serializeExport(name, typeName, value) {
  return `export const ${name}: ${typeName} = ${JSON.stringify(sanitizeValue(value), null, 2)};\n`;
}

const fileContents = `/* eslint-disable */
/* auto-generated by scripts/planner/generate-transfer-planner-source-bootstrap.cjs */

import type {
  TransferPlannerCampus,
  TransferPlannerMajorPlan,
  TransferPlannerTrack,
} from "../transfer-planner-types";

${serializeExport(
  "TRANSFER_PLANNER_BOOTSTRAP_CAMPUSES",
  "TransferPlannerCampus[]",
  TRANSFER_PLANNER_CAMPUSES
)}
${serializeExport(
  "TRANSFER_PLANNER_BOOTSTRAP_TRACKS",
  "TransferPlannerTrack[]",
  TRANSFER_PLANNER_GENERATED_GRC_ASSOCIATE_TRACKS
)}
${serializeExport(
  "TRANSFER_PLANNER_BOOTSTRAP_ALL_MAJOR_PLANS",
  "TransferPlannerMajorPlan[]",
  TRANSFER_PLANNER_ALL_MAJOR_PLANS
)}
`;

fs.writeFileSync(OUTPUT_PATH, fileContents);
console.log(`Wrote ${OUTPUT_PATH}`);
