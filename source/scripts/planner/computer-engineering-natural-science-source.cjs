const ALLEN_SCHOOL_CE_NATURAL_SCIENCE_SOURCE_URL =
  "https://www.cs.washington.edu/academics/undergraduate/degree-requirements/courses/#core";

const CE_NATURAL_SCIENCE_SUBJECTS = [
  { labelPattern: /\bbiolog(?:y|ical sciences?)\b/i, code: "BIOL" },
  { labelPattern: /\bchemistry\b/i, code: "CHEM" },
  { labelPattern: /\bphysics\b/i, code: "PHYS" },
  { labelPattern: /\bearth\s*(?:&|and)\s*space\s+sciences?\b|\bess\b/i, code: "ESS" },
  { labelPattern: /\bastronomy\b|\bastr\b/i, code: "ASTR" },
  { labelPattern: /\batmospheric\s+sciences?\b|\batmos\b/i, code: "ATMOS" },
];

function stripHtmlToText(value) {
  return String(value ?? "")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&(nbsp|amp|#8211|ndash|#8217|rsquo);/gi, (entity) => {
      const normalized = entity.toLowerCase();
      if (normalized === "&nbsp;") return " ";
      if (normalized === "&amp;") return "&";
      if (normalized === "&#8211;" || normalized === "&ndash;") return "-";
      return "'";
    })
    .replace(/\s+/g, " ")
    .trim();
}

function unique(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

function getSubjectHeadingMatches(text) {
  return CE_NATURAL_SCIENCE_SUBJECTS.flatMap((subject) => {
    const matches = [];
    const pattern = new RegExp(`${subject.labelPattern.source}\\s*:`, "gi");
    let match = pattern.exec(text);
    while (match) {
      matches.push({ index: match.index, endIndex: pattern.lastIndex, code: subject.code });
      match = pattern.exec(text);
    }
    return matches;
  }).sort((left, right) => left.index - right.index);
}

function getHtmlSubjectHeadingMatches(html) {
  const matches = [];
  const markerPattern =
    /<span[^>]*class=["'][^"']*\bbtn-text\b[^"']*["'][^>]*>\s*([^<]+?)\s*<\/span>/gi;
  let match = markerPattern.exec(html);
  while (match) {
    const label = stripHtmlToText(match[1]);
    const subject = CE_NATURAL_SCIENCE_SUBJECTS.find((candidate) =>
      candidate.labelPattern.test(label)
    );
    if (subject) {
      matches.push({
        index: match.index,
        endIndex: markerPattern.lastIndex,
        code: subject.code,
      });
    }
    match = markerPattern.exec(html);
  }
  return matches.sort((left, right) => left.index - right.index);
}

function extractSubjectCourseCodes(segment, subjectCode) {
  const trimmedSegment = String(segment ?? "")
    .split(/\b(?:courses?\s+not\s+included|other\s+graded\s+400\s+level|by\s+petition|check\s+with)\b/i)[0];
  const numbers = trimmedSegment.match(/\b\d{3}\b/g) ?? [];
  return unique(numbers.map((number) => `${subjectCode} ${number}`));
}

function isolateComputerEngineeringNaturalScienceText(text) {
  const normalized = stripHtmlToText(text);
  const startMatch =
    normalized.match(/\bComputer Engineering Natural Science\b/i) ??
    normalized.match(/\bFor Computer Engineering\b[^.]{0,120}\bNatural Science\b/i);
  if (startMatch?.index == null) {
    return normalized;
  }

  const startIndex = startMatch.index;
  const afterStart = normalized.slice(startIndex);
  const endMatch =
    afterStart.match(/\bComputer Engineering Mathematics\s*&\s*Science\b/i) ??
    afterStart.match(/\bMathematics\s*&\s*Science\b/i);
  return endMatch?.index ? afterStart.slice(0, endMatch.index) : afterStart;
}

function isolateComputerEngineeringNaturalScienceHtml(value) {
  const html = String(value ?? "");
  const startIndex = html.search(/id=["']ce-natural-science["']/i);
  if (startIndex < 0) {
    return null;
  }

  const afterStart = html.slice(startIndex);
  const endIndex = afterStart.search(/<h[1-6][^>]*\bid=["']electives["']/i);
  return endIndex >= 0 ? afterStart.slice(0, endIndex) : afterStart;
}

function extractComputerEngineeringApprovedNaturalScienceUwCourseCodesFromText(text) {
  const htmlSection = isolateComputerEngineeringNaturalScienceHtml(text);
  if (htmlSection) {
    const htmlHeadings = getHtmlSubjectHeadingMatches(htmlSection);
    const htmlExtractedCourseCodes = [];
    for (let index = 0; index < htmlHeadings.length; index += 1) {
      const heading = htmlHeadings[index];
      const nextHeading = htmlHeadings[index + 1] ?? null;
      const segment = stripHtmlToText(
        htmlSection.slice(heading.endIndex, nextHeading?.index ?? htmlSection.length)
      );
      htmlExtractedCourseCodes.push(...extractSubjectCourseCodes(segment, heading.code));
    }
    if (htmlExtractedCourseCodes.length) {
      return unique(htmlExtractedCourseCodes);
    }
  }

  const sectionText = isolateComputerEngineeringNaturalScienceText(text);
  const headings = getSubjectHeadingMatches(sectionText);
  const extractedCourseCodes = [];

  for (let index = 0; index < headings.length; index += 1) {
    const heading = headings[index];
    const nextHeading = headings[index + 1] ?? null;
    const segment = sectionText.slice(heading.endIndex, nextHeading?.index ?? sectionText.length);
    extractedCourseCodes.push(...extractSubjectCourseCodes(segment, heading.code));
  }

  return unique(extractedCourseCodes);
}

async function main() {
  const response = await fetch(ALLEN_SCHOOL_CE_NATURAL_SCIENCE_SOURCE_URL);
  if (!response.ok) {
    throw new Error(
      `Unable to fetch Allen School CE Natural Science source: ${response.status} ${response.statusText}`
    );
  }

  const html = await response.text();
  const approvedUwCourseCodes =
    extractComputerEngineeringApprovedNaturalScienceUwCourseCodesFromText(html);
  console.log(
    JSON.stringify(
      {
        officialSource: ALLEN_SCHOOL_CE_NATURAL_SCIENCE_SOURCE_URL,
        approvedUwCourseCodes,
      },
      null,
      2
    )
  );
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

module.exports = {
  ALLEN_SCHOOL_CE_NATURAL_SCIENCE_SOURCE_URL,
  extractComputerEngineeringApprovedNaturalScienceUwCourseCodesFromText,
};
