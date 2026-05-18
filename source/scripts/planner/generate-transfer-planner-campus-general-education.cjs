const fs = require("fs");
const https = require("https");
const path = require("path");

require("ts-node").register({
  skipProject: true,
  transpileOnly: true,
  compilerOptions: {
    module: "Node16",
    moduleResolution: "node16",
  },
});
require("tsconfig-paths/register");

const {
  getTransferPlannerPrimaryDegreeRequirementsSource,
  getTransferPlannerStudentRuntimeMajorsForCampus,
} = require("../../constants/transfer-planner-source");

const REPO_ROOT = path.resolve(__dirname, "..", "..");
const OUTPUT_TS_PATH = path.resolve(
  REPO_ROOT,
  "constants",
  "transfer-planner-source",
  "campus-general-education.generated.ts"
);

const CAMPUS_SOURCES = [
  {
    campusId: "uw-bothell",
    title: "UW Bothell",
    generalEducationUrl: "https://www.uwb.edu/advising/general-education-requirements",
    diversityUrl: "https://www.uwb.edu/advising/general-education-requirements/diversity",
  },
  {
    campusId: "uw-tacoma",
    title: "UW Tacoma",
    generalEducationUrl: "https://www.tacoma.uw.edu/advising/general-education-requirements",
    diversityUrl: "https://www.tacoma.uw.edu/advising/general-education-requirements",
  },
  {
    campusId: "uw-seattle",
    title: "UW Seattle",
    generalEducationUrl:
      "https://advising.uw.edu/degree-overview/general-education/requirements-by-college-and-school/",
    diversityUrl: "https://advising.uw.edu/degree-overview/general-education/diversity/",
  },
];

function fetchText(url) {
  return new Promise((resolve, reject) => {
    https
      .get(
        url,
        {
          headers: {
            "User-Agent": "GatorGuideTransferPlannerCampusGeneralEducationParser/1.0",
            Accept: "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.5",
          },
        },
        (response) => {
          const statusCode = response.statusCode ?? 0;
          if (statusCode >= 300 && statusCode < 400 && response.headers.location) {
            const redirectedUrl = new URL(response.headers.location, url).toString();
            response.resume();
            fetchText(redirectedUrl).then(resolve, reject);
            return;
          }

          if (statusCode < 200 || statusCode >= 300) {
            response.resume();
            reject(new Error(`Failed to fetch ${url}: HTTP ${statusCode}`));
            return;
          }

          response.setEncoding("utf8");
          let body = "";
          response.on("data", (chunk) => {
            body += chunk;
          });
          response.on("end", () => resolve(body));
        }
      )
      .on("error", reject);
  });
}

function decodeHtmlEntities(value) {
  return String(value ?? "").replace(/&(?:#(\d+)|#x([0-9a-f]+)|([a-z]+));/gi, (match, decimal, hex, named) => {
    if (decimal) return String.fromCodePoint(Number.parseInt(decimal, 10));
    if (hex) return String.fromCodePoint(Number.parseInt(hex, 16));
    const entity = String(named).toLowerCase();
    if (entity === "nbsp") return " ";
    if (entity === "amp") return "&";
    if (entity === "quot") return '"';
    if (entity === "apos" || entity === "rsquo") return "'";
    if (entity === "ldquo" || entity === "rdquo") return '"';
    if (entity === "ndash" || entity === "mdash") return "-";
    return match;
  });
}

function stripHtml(value) {
  return decodeHtmlEntities(
    String(value ?? "")
      .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, " ")
      .replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi, " ")
      .replace(/<\/(?:p|li|h[1-6]|div|section|tr)>/gi, "\n")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
  )
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeText(value) {
  return String(value ?? "")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

function extractSourceSentence(text, pattern) {
  const normalized = normalizeText(text);
  const sentences = normalized
    .split(/(?<=[.!?])\s+(?=[A-Z0-9])/)
    .map((sentence) => normalizeText(sentence))
    .filter(Boolean);
  return sentences.find((sentence) => pattern.test(sentence)) ?? null;
}

function extractSourceFragment(text, pattern) {
  const normalized = normalizeText(text);
  return normalizeText(normalized.match(pattern)?.[0] ?? "") || null;
}

function parseCredit(text, patterns) {
  for (const pattern of patterns) {
    const match = normalizeText(text).match(pattern);
    const parsed = Number.parseInt(match?.[1] ?? "", 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return null;
}

function parseRequiredCredits(text, pattern, label) {
  const parsed = parseCredit(text, [pattern]);
  if (!parsed) {
    throw new Error(`Could not parse ${label} credits.`);
  }

  return parsed;
}

function parseBothellGeneralEducationSource(args) {
  const generalText = stripHtml(args.generalHtml);
  const diversityText = stripHtml(args.diversityHtml);
  const areasSourceLine =
    extractSourceSentence(
      generalText,
      /\bat least \d+\s+credits in each\b.*\bArts\s*&\s*Humanities\b.*\bSocial Sciences\b.*\bNatural Sciences\b/i
    ) ??
    extractSourceSentence(
      generalText,
      /\bEvery degree requires\b.*\bat least \d+\s+credits in each\b.*\bAreas of Inquiry\b/i
    );
  const diversitySourceLine =
    extractSourceSentence(diversityText, /\bat least \d+\s+credits\b.*\bdivers/i) ??
    extractSourceSentence(generalText, /\bDiversity:\b.*\bno fewer than \d+\s+credits\b/i);

  const areaCredits = parseCredit(areasSourceLine ?? generalText, [
    /\bat least\s+(\d+)\s+credits in each\b/i,
    /\bcomplete at least\s+(\d+)\s+credits in each\b/i,
  ]);
  const diversityCredits = parseCredit(diversitySourceLine ?? diversityText, [
    /\bat least\s+(\d+)\s+credits\b/i,
    /\bno fewer than\s+(\d+)\s+credits\b/i,
    /\bDiversity[^0-9]*(\d+)\s+credits\b/i,
  ]);

  if (!areaCredits) {
    throw new Error("Could not parse UW Bothell Areas of Inquiry credits.");
  }
  if (!diversityCredits) {
    throw new Error("Could not parse UW Bothell Diversity credits.");
  }

  return {
    targets: {
      ahCredits: areaCredits,
      sscCredits: areaCredits,
      nscCredits: areaCredits,
      breadthCredits: null,
      electiveCredits: null,
    },
    items: [
      {
        id: "ah",
        label: "Arts & Humanities",
        credits: areaCredits,
        sourceLine: areasSourceLine,
        sourceUrl: args.generalEducationUrl,
      },
      {
        id: "ssc",
        label: "Social Sciences",
        credits: areaCredits,
        sourceLine: areasSourceLine,
        sourceUrl: args.generalEducationUrl,
      },
      {
        id: "nsc",
        label: "Natural Sciences",
        credits: areaCredits,
        sourceLine: areasSourceLine,
        sourceUrl: args.generalEducationUrl,
      },
      {
        id: "div",
        label: "Diversity",
        credits: diversityCredits,
        sourceLine: diversitySourceLine,
        sourceUrl: args.diversityUrl,
        overlapsWithAreaOfInquiry: true,
      },
    ],
  };
}

function parseTacomaGeneralEducationSource(args) {
  const generalText = stripHtml(args.generalHtml);
  const areasSourceLine =
    extractSourceFragment(
      generalText,
      /\b\d+\s+credits of Areas of Inquiry\s*\[AoI\][^.]{0,180}\bNatural Sciences\s*\[NSc\]/i
    ) ??
    extractSourceSentence(
      generalText,
      /\bAreas of Inquiry\b.*\bno fewer than \d+\s+credits in each area of study\b/i
    );
  const diversitySourceLine =
    extractSourceFragment(
      generalText,
      /\b\d+\s+credits\s*\(min\)\s+in diversity coursework[^.]*\./i
    ) ??
    extractSourceFragment(generalText, /\bDiversity\s*\[?DIV\]?\D{0,16}\d+\s+credits\b/i);

  const areasTotalCredits = parseRequiredCredits(
    areasSourceLine ?? generalText,
    /\b(\d+)\s+credits of Areas of Inquiry\b/i,
    "UW Tacoma Areas of Inquiry total"
  );
  const minimumAreaCredits = parseRequiredCredits(
    areasSourceLine ?? generalText,
    /\bno fewer than\s+(\d+)\s+credits in each area of study\b/i,
    "UW Tacoma Areas of Inquiry minimum area"
  );
  const diversityCredits = parseRequiredCredits(
    diversitySourceLine ?? generalText,
    /\b(\d+)\s+credits\s*\(min\)\s+in diversity coursework\b/i,
    "UW Tacoma Diversity"
  );

  return {
    targets: {
      ahCredits: minimumAreaCredits,
      sscCredits: minimumAreaCredits,
      nscCredits: minimumAreaCredits,
      breadthCredits: null,
      electiveCredits: null,
    },
    items: [
      {
        id: "areas-of-inquiry-total",
        label: "Areas of Inquiry",
        credits: areasTotalCredits,
        valueText: `${areasTotalCredits} credits total`,
        note: `Includes no fewer than ${minimumAreaCredits} credits in each area of study.`,
        sourceLine: areasSourceLine,
        sourceUrl: args.generalEducationUrl,
      },
      {
        id: "ah",
        label: "Arts & Humanities",
        credits: minimumAreaCredits,
        sourceLine: areasSourceLine,
        sourceUrl: args.generalEducationUrl,
      },
      {
        id: "ssc",
        label: "Social Sciences",
        credits: minimumAreaCredits,
        sourceLine: areasSourceLine,
        sourceUrl: args.generalEducationUrl,
      },
      {
        id: "nsc",
        label: "Natural Sciences",
        credits: minimumAreaCredits,
        sourceLine: areasSourceLine,
        sourceUrl: args.generalEducationUrl,
      },
      {
        id: "div",
        label: "Diversity",
        credits: diversityCredits,
        sourceLine: diversitySourceLine,
        sourceUrl: args.diversityUrl,
        overlapsWithAreaOfInquiry: false,
      },
    ],
  };
}

function normalizeMatchText(value) {
  return normalizeText(value)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseSeattleRequirementRows(html) {
  const tableMatches = Array.from(
    String(html ?? "").matchAll(/<h3><a[^>]*>(.*?)<\/a><\/h3>[\s\S]*?<tbody>([\s\S]*?)<\/tbody>/gi)
  );
  return tableMatches.flatMap((tableMatch) => {
    const schoolTitle = stripHtml(tableMatch[1] ?? "");
    const rowHtml = tableMatch[2] ?? "";
    return Array.from(rowHtml.matchAll(/<tr>([\s\S]*?)(?=<tr>|$)/gi))
      .map((rowMatch) => stripHtml(rowMatch[1] ?? ""))
      .map((rowText) => {
        const normalizedRowText = normalizeText(rowText);
        const majorTitle =
          normalizedRowText.match(/\bMajor\s+[\u2013-]\s*(.*?)\s+Areas of Inquiry\s+[\u2013-]/i)?.[1] ??
          null;
        const areasText =
          normalizedRowText.match(/\bAreas of Inquiry\s+[\u2013-]\s*(.*?)\s+English Composition\s+[\u2013-]/i)?.[1] ??
          null;
        if (!majorTitle || !areasText) {
          return null;
        }

        return {
          schoolTitle,
          majorTitle: normalizeText(majorTitle),
          areasText: normalizeText(areasText),
          sourceLine: normalizedRowText,
        };
      })
      .filter(Boolean);
  });
}

function parseSeattleAreaCredits(areasText) {
  const fixedCreditFor = (pattern) => {
    const match = normalizeText(areasText).match(pattern);
    const parsed = Number.parseInt(match?.[1] ?? "", 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  };
  const ahCredits = fixedCreditFor(/\b(\d+)\s*A&H\b/i);
  const sscCredits = fixedCreditFor(/\b(\d+)(?:\s*-\s*\d+)?\s*SSc\b/i);
  const nscCredits = fixedCreditFor(/\b(\d+)\s*\+?\s*NSc\b/i);
  const additionalAhSscCredits = fixedCreditFor(/\b(\d+)(?:\s*-\s*\d+)?\s+additional\s+A&H\s+or\s+SSc\b/i);
  const additionalAnyCredits = additionalAhSscCredits === null
    ? fixedCreditFor(/\b(?:and\s+)?(\d+)\s+additional\b/i)
    : null;

  return {
    ahCredits,
    sscCredits,
    nscCredits,
    breadthCredits: additionalAhSscCredits,
    electiveCredits: additionalAnyCredits,
  };
}

function buildSeattleItemsFromTargets(targets, input) {
  const items = [];
  const pushCategory = (id, label, credits) => {
    if (credits === null) return;
    items.push({
      id,
      label,
      credits,
      sourceLine: input.sourceLine,
      sourceUrl: input.sourceUrl,
    });
  };

  pushCategory("ah", "Arts & Humanities", targets.ahCredits);
  pushCategory("ssc", "Social Sciences", targets.sscCredits);
  pushCategory("nsc", "Natural Sciences", targets.nscCredits);

  if (targets.breadthCredits !== null) {
    items.push({
      id: "additional-ah-ssc",
      label: "Additional Arts & Humanities / Social Sciences",
      credits: targets.breadthCredits,
      sourceLine: input.sourceLine,
      sourceUrl: input.sourceUrl,
    });
  }

  if (targets.electiveCredits !== null) {
    items.push({
      id: "additional-areas-of-inquiry",
      label: "Additional Areas of Inquiry",
      credits: targets.electiveCredits,
      sourceLine: input.sourceLine,
      sourceUrl: input.sourceUrl,
    });
  }

  items.push({
    id: "div",
    label: "Diversity",
    credits: 5,
    sourceLine: "Students entering the University in Autumn of 2014 (or later) must also meet a Diversity requirement.",
    sourceUrl: input.diversityUrl,
    overlapsWithAreaOfInquiry: true,
  });

  return items;
}

function getSeattleSchoolKeyForPlan(plan) {
  const primarySource = getTransferPlannerPrimaryDegreeRequirementsSource(plan.id, null);
  const searchable = normalizeMatchText(
    [
      plan.id,
      plan.title,
      primarySource?.url,
      primarySource?.label,
      ...(plan.officialLinks ?? []).flatMap((link) => [link.url, link.label]),
    ].join(" ")
  );

  if (/\bmedical laboratory science\b|\bdlmp uw edu\b/.test(searchable)) return "School of Medicine";
  if (/\bnursing\b/.test(searchable)) return "School of Nursing";
  if (/\bsocial welfare\b|\bsocial work\b|\bsocialwork\b/.test(searchable)) return "School of Social Work";
  if (/\bfoster\b|\bbusiness administration\b|\bbusiness\b/.test(searchable)) {
    return "Michael G. Foster School of Business";
  }
  if (/\binformatics\b|\bischool\b|\binformation school\b/.test(searchable)) return "Information School";
  if (/\bpublic service and policy\b|\bevans\b|\bpublic policy\b/.test(searchable)) {
    return "Daniel J. Evans School of Public Policy & Governance";
  }
  if (/\bpublic health\b|\benvironmental public health\b|\bfood systems\b|\bsph washington\b/.test(searchable)) {
    return "School of Public Health";
  }
  if (/\bearly childhood and family studies\b|\beducation communities\b|\beducation studies\b|\bcollegeofeducation\b|\beducation washington edu\b/.test(searchable)) {
    return "College of Education";
  }
  if (/\barchitectural\b|\barchitecture\b|\bconstruction management\b|\blandscape architecture\b|\breal estate\b|\bcommunity environment and planning\b|\barch be uw\b|\bcm be uw\b|\bbe uw\b/.test(searchable)) {
    return "College of Built Environments";
  }
  if (/\baquatic\b|\batmospheric\b|\bclimate science\b|\bearth and space\b|\benvironmental design\b|\benvironmental science\b|\benvironmental studies\b|\bmarine biology\b|\boceanography\b|\bsefs\b|\bfish uw\b|\bess\b|\bocean washington\b/.test(searchable)) {
    return "College of the Environment";
  }
  if (/\baeronautics\b|\bastronautics\b|\bbioengineering\b|\bchemical engineering\b|\bcivil engineering\b|\bcomputer engineering\b|\bcomputer science\b|\belectrical\b|\benvironmental engineering\b|\bhuman centered design\b|\bindustrial\b|\bmechanical engineering\b|\bmaterials science\b|\bsustainable bioresource\b|\baa washington\b|\bbioe uw\b|\bcheme washington\b|\bce washington\b|\bcs washington\b|\bece uw\b|\bhcde washington\b|\bise washington\b|\bme washington\b|\bmse washington\b/.test(searchable)) {
    return "College of Engineering";
  }

  return "College of Arts and Sciences";
}

function getSeattleMajorRequirementRowForPlan(plan, rows) {
  const planTitle = normalizeMatchText(plan.title);
  const exactRow = rows.find(
    (row) =>
      normalizeMatchText(row.majorTitle) !== "all majors" &&
      normalizeMatchText(row.majorTitle) === planTitle
  );
  if (exactRow) return exactRow;

  if (plan.id === "uw-seattle-architectural-studies") {
    return rows.find((row) => normalizeMatchText(row.majorTitle) === "architecture") ?? null;
  }

  const schoolKey = getSeattleSchoolKeyForPlan(plan);
  return (
    rows.find(
      (row) =>
        row.schoolTitle === schoolKey && normalizeMatchText(row.majorTitle) === "all majors"
    ) ?? null
  );
}

function parseSeattleGeneralEducationSource(args) {
  const rows = parseSeattleRequirementRows(args.generalHtml);
  const planEntries = getTransferPlannerStudentRuntimeMajorsForCampus("uw-seattle")
    .map((plan) => {
      const row = getSeattleMajorRequirementRowForPlan(plan, rows);
      if (!row) return null;

      const targets = parseSeattleAreaCredits(row.areasText);
      if (
        targets.ahCredits === null &&
        targets.sscCredits === null &&
        targets.nscCredits === null
      ) {
        return null;
      }

      return {
        campusId: "uw-seattle",
        title: `${args.title}: ${plan.title}`,
        planIds: [plan.id],
        schoolTitle: row.schoolTitle,
        majorTitle: row.majorTitle,
        sourceUrls: [args.generalEducationUrl, args.diversityUrl],
        generatedAt: args.generatedAt,
        targets,
        items: buildSeattleItemsFromTargets(targets, {
          sourceLine: row.sourceLine,
          sourceUrl: args.generalEducationUrl,
          diversityUrl: args.diversityUrl,
        }),
      };
    })
    .filter(Boolean);

  if (!planEntries.length) {
    throw new Error("Could not build UW Seattle plan-specific gen-ed entries.");
  }

  return planEntries;
}

function parseCampusGeneralEducationSource(args) {
  switch (args.campusId) {
    case "uw-bothell":
      return parseBothellGeneralEducationSource(args);
    case "uw-tacoma":
      return parseTacomaGeneralEducationSource(args);
    case "uw-seattle":
      return parseSeattleGeneralEducationSource(args);
    default:
      throw new Error(`No campus gen-ed parser configured for ${args.campusId}.`);
  }
}

function serializeTs(value) {
  return JSON.stringify(value, null, 2);
}

async function main() {
  const generatedAt = new Date().toISOString();
  const campusRequirements = [];

  for (const source of CAMPUS_SOURCES) {
    const [generalHtml, diversityHtml] = await Promise.all([
      fetchText(source.generalEducationUrl),
      fetchText(source.diversityUrl),
    ]);
    const parsed = parseCampusGeneralEducationSource({
      ...source,
      generalHtml,
      diversityHtml,
      generatedAt,
    });
    const parsedEntries = Array.isArray(parsed) ? parsed : [parsed];
    campusRequirements.push(
      ...parsedEntries.map((entry) => ({
        campusId: source.campusId,
        title: source.title,
        sourceUrls: [source.generalEducationUrl, source.diversityUrl],
        generatedAt,
        ...entry,
      }))
    );
  }

  const lines = [
    "// Generated by scripts/planner/generate-transfer-planner-campus-general-education.cjs.",
    "// Do not edit by hand.",
    "",
    "export type TransferPlannerCampusGeneralEducationRequirement = {",
    "  campusId: string;",
    "  title: string;",
    "  planIds?: string[];",
    "  schoolTitle?: string;",
    "  majorTitle?: string;",
    "  sourceUrls: string[];",
    "  generatedAt: string;",
    "  targets: {",
    "    ahCredits: number | null;",
    "    sscCredits: number | null;",
    "    nscCredits: number | null;",
    "    breadthCredits: number | null;",
    "    electiveCredits: number | null;",
    "  };",
    "  items: {",
    "    id: string;",
    "    label: string;",
    "    credits: number;",
    "    valueText?: string;",
    "    note?: string;",
    "    sourceLine: string | null;",
    "    sourceUrl: string;",
    "    overlapsWithAreaOfInquiry?: boolean;",
    "  }[];",
    "};",
    "",
    "export const TRANSFER_PLANNER_CAMPUS_GENERAL_EDUCATION_REQUIREMENTS: TransferPlannerCampusGeneralEducationRequirement[] =",
    `  ${serializeTs(campusRequirements)};`,
    "",
    "export function getTransferPlannerCampusGeneralEducationRequirement(",
    "  campusId: string | null | undefined,",
    "  input: { planId?: string | null | undefined } = {}",
    ") {",
    "  const planId = input.planId ?? null;",
    "  if (planId) {",
    "    const planSpecificEntry = TRANSFER_PLANNER_CAMPUS_GENERAL_EDUCATION_REQUIREMENTS.find(",
    "      (entry) => entry.campusId === campusId && entry.planIds?.includes(planId)",
    "    );",
    "    if (planSpecificEntry) return planSpecificEntry;",
    "  }",
    "  return (",
    "    TRANSFER_PLANNER_CAMPUS_GENERAL_EDUCATION_REQUIREMENTS.find(",
    "      (entry) => entry.campusId === campusId && !entry.planIds?.length",
    "    ) ?? null",
    "  );",
    "}",
    "",
  ];

  fs.writeFileSync(OUTPUT_TS_PATH, `${lines.join("\n")}\n`);
  console.log(
    `Generated campus general education requirements: ${OUTPUT_TS_PATH} (${campusRequirements.length})`
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
