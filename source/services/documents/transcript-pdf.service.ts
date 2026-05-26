import { inflate } from "pako";
import { Platform } from "react-native";
import { fetchArrayBufferWithHandling } from "@/services/network/fetch-with-handling";
import { readBase64File } from "@/services/storage/file-system-adapter.service";

export type ParsedTranscriptCourse = {
  code: string;
  title: string;
  label: string;
  credits: number | null;
  termLabel: string | null;
  termStartDate: string | null;
  termEndDate: string | null;
  catalogYearLabel: string | null;
};

export type ParsedTranscriptData = {
  completedCourses: ParsedTranscriptCourse[];
  earnedCreditsTotal: number | null;
  gpa: string | null;
  diagnostics?: TranscriptPdfParseDiagnostics;
};

export type TranscriptPdfParseDiagnostics = {
  uriKind: string;
  uriLength: number;
  byteLength: number;
  readBytesMs: number;
  extractLinesMs: number;
  parseCourseLinesMs: number;
  extractGpaMs: number;
  totalMs: number;
  totalStreamCount: number;
  flateStreamCount: number;
  skippedNonContentStreamCount: number;
  extractedFlateStreamCount: number;
  inflatedStreamCount: number;
  inflateFailureCount: number;
  skippedNoTextOperatorCount: number;
  textCandidateStreamCount: number;
  textItemCount: number;
  lineCount: number;
  binaryStringMs: number;
  streamInflateMs: number;
  textItemExtractionMs: number;
  lineBuildMs: number;
  maxInflatedStreamChars: number;
};

const CREDIT_PATTERN = /^\d+\.\d{3}$/;
const BASE64_CHARS =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const COURSE_LINE_PATTERN =
  /^([A-Z]{2,6}&?)\s+(\d{3}[A-Z]?)\s+(.+?)\s+(\d+\.\d{3})\s+(\d+\.\d{3})\s+(\d+(?:\.\d+)?|[A-Z][A-Z+\-]*)\s+(\d+\.\d{3})$/;
const TERM_HEADING_PATTERN =
  /^(FALL|WINTER|SPRING|SUMMER)\s+(\d{4})\s+\((\d{2}\/\d{2}\/\d{4})\s*-\s*(\d{2}\/\d{2}\/\d{4})\)$/i;

type PdfTextItem = {
  str?: string;
  x?: number;
  y?: number;
  transform?: number[];
};

type PdfFlateStream = {
  data: Uint8Array;
  dictionary: string;
};

type FlateStreamExtractionResult = {
  streams: PdfFlateStream[];
  totalStreamCount: number;
  flateStreamCount: number;
  skippedNonContentStreamCount: number;
  binaryStringMs: number;
};

type TranscriptLineExtractionResult = {
  lines: string[];
  diagnostics: Pick<
    TranscriptPdfParseDiagnostics,
    | "extractLinesMs"
    | "totalStreamCount"
    | "flateStreamCount"
    | "skippedNonContentStreamCount"
    | "extractedFlateStreamCount"
    | "inflatedStreamCount"
    | "inflateFailureCount"
    | "skippedNoTextOperatorCount"
    | "textCandidateStreamCount"
    | "textItemCount"
    | "lineCount"
    | "binaryStringMs"
    | "streamInflateMs"
    | "textItemExtractionMs"
    | "lineBuildMs"
    | "maxInflatedStreamChars"
  >;
};

function nowMs() {
  return typeof performance !== "undefined" && typeof performance.now === "function"
    ? performance.now()
    : Date.now();
}

function roundMs(value: number) {
  return Math.round(value * 10) / 10;
}

function getTranscriptUriKind(value: string) {
  const raw = String(value ?? "").trim();
  if (!raw) return "missing";
  if (raw.startsWith("data:")) return "data-url";
  if (raw.startsWith("blob:")) return "blob-url";
  if (raw.startsWith("http://") || raw.startsWith("https://")) return "remote-url";
  if (raw.startsWith("file://")) return "file-url";
  if (/^[A-Za-z]:[\\/]/.test(raw)) return "windows-local-path";
  if (raw.startsWith("/")) return "local-path";
  return "other";
}

function normalizeWhitespace(value: string) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function normalizeCourseCode(subject: string, number: string) {
  return normalizeWhitespace(`${subject} ${number}`).toUpperCase();
}

function normalizeTranscriptDate(value: string) {
  const raw = String(value ?? "").trim();
  const match = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return null;
  const [, month, day, year] = match;
  return `${year}-${month}-${day}`;
}

function normalizeTranscriptTermLabel(term: string, year: string) {
  const normalizedTerm = String(term ?? "").trim().toLowerCase();
  return `${normalizedTerm.charAt(0).toUpperCase()}${normalizedTerm.slice(1)} ${year}`;
}

function formatGrcCatalogYearLabel(startYear: number) {
  return `${startYear}-${startYear + 1}`;
}

function formatExtractedGpa(value: unknown) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;

  const match = raw.match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;

  const num = Number.parseFloat(match[0]);
  if (!Number.isFinite(num)) return null;

  const clamped = Math.max(0, Math.min(num, 4.0));
  const truncated = Math.floor(clamped * 100) / 100;
  return truncated.toFixed(2).replace(/\.0+$|0+$/g, "");
}

export function inferGrcCatalogYearLabelFromTranscriptTerm(
  termLabel: string | null | undefined,
  termStartDate: string | null | undefined
) {
  const termMatch = String(termLabel ?? "").match(/\b(Fall|Autumn|Winter|Spring|Summer)\s+(\d{4})\b/i);
  if (termMatch) {
    const term = String(termMatch[1] ?? "").toLowerCase();
    const year = Number.parseInt(termMatch[2] ?? "", 10);
    if (Number.isFinite(year)) {
      return formatGrcCatalogYearLabel(term === "fall" || term === "autumn" ? year : year - 1);
    }
  }

  const dateMatch = String(termStartDate ?? "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateMatch) {
    const year = Number.parseInt(dateMatch[1] ?? "", 10);
    const month = Number.parseInt(dateMatch[2] ?? "", 10);
    if (Number.isFinite(year) && Number.isFinite(month)) {
      return formatGrcCatalogYearLabel(month >= 8 ? year : year - 1);
    }
  }

  return null;
}

function base64ToUint8Array(base64: string) {
  const cleaned = String(base64 ?? "").replace(/\s+/g, "");
  const bytes: number[] = [];

  for (let i = 0; i < cleaned.length; i += 4) {
    const chunk = cleaned.slice(i, i + 4);
    const enc1 = BASE64_CHARS.indexOf(chunk[0] ?? "A");
    const enc2 = BASE64_CHARS.indexOf(chunk[1] ?? "A");
    const enc3 = chunk[2] === "=" ? -1 : BASE64_CHARS.indexOf(chunk[2] ?? "A");
    const enc4 = chunk[3] === "=" ? -1 : BASE64_CHARS.indexOf(chunk[3] ?? "A");

    const chr1 = (enc1 << 2) | (enc2 >> 4);
    bytes.push(chr1 & 0xff);

    if (enc3 >= 0) {
      const chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
      bytes.push(chr2 & 0xff);
    }

    if (enc4 >= 0 && enc3 >= 0) {
      const chr3 = ((enc3 & 3) << 6) | enc4;
      bytes.push(chr3 & 0xff);
    }
  }

  return new Uint8Array(bytes);
}

function binaryStringToUint8Array(value: string) {
  const bytes = new Uint8Array(value.length);
  for (let i = 0; i < value.length; i += 1) {
    bytes[i] = value.charCodeAt(i) & 0xff;
  }
  return bytes;
}

function uint8ArrayToBinaryString(bytes: Uint8Array) {
  let result = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    result += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return result;
}

function decodeDataUrlToBytes(fileUri: string) {
  const commaIndex = fileUri.indexOf(",");
  if (commaIndex < 0) {
    throw new Error("Transcript data URL is invalid.");
  }

  const meta = fileUri.slice(0, commaIndex);
  const payload = fileUri.slice(commaIndex + 1);

  if (/;base64/i.test(meta)) {
    return base64ToUint8Array(payload);
  }

  return new TextEncoder().encode(decodeURIComponent(payload));
}

async function readPdfBytes(fileUri: string) {
  const normalizedUri = String(fileUri ?? "").trim();
  if (!normalizedUri) {
    throw new Error("Transcript file URL is missing.");
  }

  if (normalizedUri.startsWith("data:")) {
    return decodeDataUrlToBytes(normalizedUri);
  }

  if (
    Platform.OS === "web" ||
    normalizedUri.startsWith("http://") ||
    normalizedUri.startsWith("https://") ||
    normalizedUri.startsWith("blob:")
  ) {
    const arrayBuffer = await fetchArrayBufferWithHandling(normalizedUri, {
      operation: "Transcript PDF read",
      timeoutMs: 15000,
    });
    return new Uint8Array(arrayBuffer);
  }

  const base64 = await readBase64File(normalizedUri);
  return base64ToUint8Array(base64);
}

function buildPageLines(items: PdfTextItem[]) {
  const lineMap = new Map<number, { x: number; text: string }[]>();

  for (const item of items) {
    const text = normalizeWhitespace(item?.str ?? "");
    if (!text) continue;

    const ySource = item?.y ?? item?.transform?.[5] ?? 0;
    const xSource = item?.x ?? item?.transform?.[4] ?? 0;
    const y = Math.round(Number(ySource) * 10) / 10;
    const x = Number(xSource);

    if (!lineMap.has(y)) {
      lineMap.set(y, []);
    }

    lineMap.get(y)?.push({ x, text });
  }

  return [...lineMap.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([, entries]) =>
      entries
        .sort((a, b) => a.x - b.x)
        .map((entry) => entry.text)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim()
    )
    .filter(Boolean);
}

function parseTranscriptCourseLines(lines: string[]) {
  const parsed: ParsedTranscriptCourse[] = [];
  const seen = new Set<string>();
  let earnedCreditsTotal = 0;
  let hasEarnedCredits = false;
  let currentTermLabel: string | null = null;
  let currentTermStartDate: string | null = null;
  let currentTermEndDate: string | null = null;

  for (const line of lines) {
    const termMatch = line.match(TERM_HEADING_PATTERN);
    if (termMatch) {
      currentTermLabel = normalizeTranscriptTermLabel(termMatch[1], termMatch[2]);
      currentTermStartDate = normalizeTranscriptDate(termMatch[3]);
      currentTermEndDate = normalizeTranscriptDate(termMatch[4]);
      continue;
    }

    const match = line.match(COURSE_LINE_PATTERN);
    if (!match) continue;

    const [, subject, number, rawTitle, attempted, earned, , points] = match;
    if (
      !CREDIT_PATTERN.test(attempted) ||
      !CREDIT_PATTERN.test(earned) ||
      !CREDIT_PATTERN.test(points)
    ) {
      continue;
    }

    if (Number.parseFloat(earned) <= 0) continue;
    const earnedCredits = Number.parseFloat(earned);

    const title = normalizeWhitespace(rawTitle);
    if (!title || title.toLowerCase().startsWith("description ")) {
      continue;
    }

    earnedCreditsTotal += earnedCredits;
    hasEarnedCredits = true;

    const code = normalizeCourseCode(subject, number);
    if (seen.has(code)) {
      continue;
    }

    seen.add(code);
    parsed.push({
      code,
      title,
      label: `${code} ${title}`.trim(),
      credits: earnedCredits,
      termLabel: currentTermLabel,
      termStartDate: currentTermStartDate,
      termEndDate: currentTermEndDate,
      catalogYearLabel: inferGrcCatalogYearLabelFromTranscriptTerm(
        currentTermLabel,
        currentTermStartDate
      ),
    });
  }

  return {
    completedCourses: parsed,
    earnedCreditsTotal: hasEarnedCredits
      ? Math.round(earnedCreditsTotal * 1000) / 1000
      : null,
  };
}

export function extractCumulativeGpaFromTranscriptLines(lines: string[]) {
  const patterns = [
    /\bCum(?:ulative)?\s+GPA\b\s*[:\-]?\s*(\d(?:\.\d{1,4})?)/i,
    /\bOverall\s+GPA\b\s*[:\-]?\s*(\d(?:\.\d{1,4})?)/i,
    /\b(?:Cumulative|Overall)\s+Grade\s+Point\s+Average\b\s*[:\-]?\s*(\d(?:\.\d{1,4})?)/i,
  ];

  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const line = lines[index] ?? "";
    for (const pattern of patterns) {
      const match = line.match(pattern);
      const formatted = formatExtractedGpa(match?.[1]);
      if (formatted) return formatted;
    }
  }

  return null;
}

function shouldSkipFlateStreamDictionary(dictionary: string) {
  return (
    /\/Subtype\s*\/Image\b/.test(dictionary) ||
    /\/Type\s*\/XRef\b/.test(dictionary) ||
    /\/Type\s*\/ObjStm\b/.test(dictionary)
  );
}

function extractFlateStreams(data: Uint8Array): FlateStreamExtractionResult {
  const binaryStart = nowMs();
  const binary = uint8ArrayToBinaryString(data);
  const binaryStringMs = roundMs(nowMs() - binaryStart);
  const streams: PdfFlateStream[] = [];
  let searchIndex = 0;
  let totalStreamCount = 0;
  let flateStreamCount = 0;
  let skippedNonContentStreamCount = 0;

  while (searchIndex < binary.length) {
    const streamIndex = binary.indexOf("stream", searchIndex);
    if (streamIndex < 0) break;
    totalStreamCount += 1;

    const dictionaryStart = binary.lastIndexOf("<<", streamIndex);
    const dictionaryEnd = binary.lastIndexOf(">>", streamIndex);
    const dictionary =
      dictionaryStart >= 0 && dictionaryEnd > dictionaryStart
        ? binary.slice(dictionaryStart, dictionaryEnd + 2)
        : "";

    let dataStart = streamIndex + "stream".length;
    if (binary.slice(dataStart, dataStart + 2) === "\r\n") {
      dataStart += 2;
    } else if (binary[dataStart] === "\r" || binary[dataStart] === "\n") {
      dataStart += 1;
    }

    const endstreamIndex = binary.indexOf("endstream", dataStart);
    if (endstreamIndex < 0) break;

    let dataEnd = endstreamIndex;
    if (binary.slice(dataEnd - 2, dataEnd) === "\r\n") {
      dataEnd -= 2;
    } else if (binary[dataEnd - 1] === "\r" || binary[dataEnd - 1] === "\n") {
      dataEnd -= 1;
    }

    if (/\/FlateDecode\b/.test(dictionary) && dataEnd > dataStart) {
      flateStreamCount += 1;

      if (shouldSkipFlateStreamDictionary(dictionary)) {
        skippedNonContentStreamCount += 1;
      } else {
        streams.push({
          data: binaryStringToUint8Array(binary.slice(dataStart, dataEnd)),
          dictionary,
        });
      }
    }

    searchIndex = endstreamIndex + "endstream".length;
  }

  return {
    streams,
    totalStreamCount,
    flateStreamCount,
    skippedNonContentStreamCount,
    binaryStringMs,
  };
}

function decodePdfString(value: string) {
  let result = "";

  for (let index = 0; index < value.length; index += 1) {
    const current = value[index];
    if (current !== "\\") {
      result += current;
      continue;
    }

    const next = value[index + 1];
    if (!next) break;

    if (/[0-7]/.test(next)) {
      let octal = next;
      let step = 1;
      while (step < 3 && /[0-7]/.test(value[index + step + 1] ?? "")) {
        octal += value[index + step + 1];
        step += 1;
      }
      result += String.fromCharCode(Number.parseInt(octal, 8));
      index += octal.length;
      continue;
    }

    switch (next) {
      case "n":
        result += "\n";
        break;
      case "r":
        result += "\r";
        break;
      case "t":
        result += "\t";
        break;
      case "b":
        result += "\b";
        break;
      case "f":
        result += "\f";
        break;
      case "(":
      case ")":
      case "\\":
        result += next;
        break;
      default:
        result += next;
        break;
    }

    index += 1;
  }

  return normalizeWhitespace(result);
}

function extractTextItemsFromStreamContent(content: string) {
  const items: PdfTextItem[] = [];
  let currentX = 0;
  let currentY = 0;

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    const matrixMatch = line.match(
      /(?:-?\d+(?:\.\d+)?\s+){4}(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s+Tm\b/
    );
    if (matrixMatch) {
      currentX = Number(matrixMatch[1] ?? 0);
      currentY = Number(matrixMatch[2] ?? 0);
    }

    const relativeMatch = line.match(/(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s+Td\b/);
    if (relativeMatch) {
      currentX += Number(relativeMatch[1] ?? 0);
      currentY += Number(relativeMatch[2] ?? 0);
    }

    for (const match of line.matchAll(/\(((?:\\.|[^\\)])*)\)\s*Tj/g)) {
      const text = decodePdfString(match[1] ?? "");
      if (!text) continue;
      items.push({ str: text, x: currentX, y: currentY });
    }

    for (const match of line.matchAll(/\[(.*?)\]\s*TJ/g)) {
      const text = [...String(match[1] ?? "").matchAll(/\(((?:\\.|[^\\)])*)\)/g)]
        .map((part) => decodePdfString(part[1] ?? ""))
        .join("");

      if (!text) continue;
      items.push({ str: text, x: currentX, y: currentY });
    }
  }

  return items;
}

function extractTranscriptLinesFromPdf(data: Uint8Array): TranscriptLineExtractionResult {
  const extractionStart = nowMs();
  const streamExtraction = extractFlateStreams(data);
  const allLines: string[] = [];
  let inflatedStreamCount = 0;
  let inflateFailureCount = 0;
  let skippedNoTextOperatorCount = 0;
  let textCandidateStreamCount = 0;
  let textItemCount = 0;
  let streamInflateMs = 0;
  let textItemExtractionMs = 0;
  let lineBuildMs = 0;
  let maxInflatedStreamChars = 0;

  for (const stream of streamExtraction.streams) {
    try {
      const inflateStart = nowMs();
      const content = inflate(stream.data, { to: "string" });
      streamInflateMs += nowMs() - inflateStart;
      inflatedStreamCount += 1;
      maxInflatedStreamChars = Math.max(maxInflatedStreamChars, content.length);

      if (!content.includes("Tj") && !content.includes("TJ")) {
        skippedNoTextOperatorCount += 1;
        continue;
      }

      textCandidateStreamCount += 1;
      const textItemStart = nowMs();
      const streamItems = extractTextItemsFromStreamContent(content);
      textItemExtractionMs += nowMs() - textItemStart;
      textItemCount += streamItems.length;

      if (!streamItems.length) {
        continue;
      }

      // Keep each PDF text stream isolated so page-local Y positions do not
      // collide across multiple transcript pages.
      const lineBuildStart = nowMs();
      allLines.push(...buildPageLines(streamItems));
      lineBuildMs += nowMs() - lineBuildStart;
    } catch {
      inflateFailureCount += 1;
      continue;
    }
  }

  return {
    lines: allLines,
    diagnostics: {
      extractLinesMs: roundMs(nowMs() - extractionStart),
      totalStreamCount: streamExtraction.totalStreamCount,
      flateStreamCount: streamExtraction.flateStreamCount,
      skippedNonContentStreamCount: streamExtraction.skippedNonContentStreamCount,
      extractedFlateStreamCount: streamExtraction.streams.length,
      inflatedStreamCount,
      inflateFailureCount,
      skippedNoTextOperatorCount,
      textCandidateStreamCount,
      textItemCount,
      lineCount: allLines.length,
      binaryStringMs: streamExtraction.binaryStringMs,
      streamInflateMs: roundMs(streamInflateMs),
      textItemExtractionMs: roundMs(textItemExtractionMs),
      lineBuildMs: roundMs(lineBuildMs),
      maxInflatedStreamChars,
    },
  };
}

class TranscriptPdfService {
  async extractTranscriptDataFromPdf(fileUri: string): Promise<ParsedTranscriptData> {
    const totalStart = nowMs();
    const normalizedUri = String(fileUri ?? "").trim();
    const readStart = nowMs();
    const data = await readPdfBytes(fileUri);
    const readBytesMs = roundMs(nowMs() - readStart);
    const extracted = extractTranscriptLinesFromPdf(data);
    const allLines = extracted.lines;

    if (!allLines.length) {
      throw new Error("No readable transcript text found in PDF.");
    }

    const parseCourseLinesStart = nowMs();
    const parsedCourseData = parseTranscriptCourseLines(allLines);
    const parseCourseLinesMs = roundMs(nowMs() - parseCourseLinesStart);
    const extractGpaStart = nowMs();
    const gpa = extractCumulativeGpaFromTranscriptLines(allLines);
    const extractGpaMs = roundMs(nowMs() - extractGpaStart);

    return {
      completedCourses: parsedCourseData.completedCourses,
      earnedCreditsTotal: parsedCourseData.earnedCreditsTotal,
      gpa,
      diagnostics: {
        uriKind: getTranscriptUriKind(normalizedUri),
        uriLength: normalizedUri.length,
        byteLength: data.byteLength,
        readBytesMs,
        parseCourseLinesMs,
        extractGpaMs,
        totalMs: roundMs(nowMs() - totalStart),
        ...extracted.diagnostics,
      },
    };
  }

  async extractCompletedCoursesFromPdf(fileUri: string): Promise<ParsedTranscriptCourse[]> {
    return (await this.extractTranscriptDataFromPdf(fileUri)).completedCourses;
  }

  async extractGpaFromPdf(fileUri: string): Promise<string | null> {
    return (await this.extractTranscriptDataFromPdf(fileUri)).gpa;
  }
}

export const transcriptPdfService = new TranscriptPdfService();
