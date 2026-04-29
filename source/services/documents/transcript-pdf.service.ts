import * as FileSystem from "expo-file-system";
import { inflate } from "pako";
import { Platform } from "react-native";

export type ParsedTranscriptCourse = {
  code: string;
  title: string;
  label: string;
  termLabel: string | null;
  termStartDate: string | null;
  termEndDate: string | null;
  catalogYearLabel: string | null;
};

export type ParsedTranscriptData = {
  completedCourses: ParsedTranscriptCourse[];
  gpa: string | null;
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
    const response = await fetch(normalizedUri);
    const arrayBuffer = await response.arrayBuffer();
    return new Uint8Array(arrayBuffer);
  }

  const encoding = (FileSystem as any).EncodingType?.Base64 ?? "base64";
  const base64 = await FileSystem.readAsStringAsync(normalizedUri, { encoding });
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

    const title = normalizeWhitespace(rawTitle);
    if (!title || title.toLowerCase().startsWith("description ")) {
      continue;
    }

    const code = normalizeCourseCode(subject, number);
    if (seen.has(code)) {
      continue;
    }

    seen.add(code);
    parsed.push({
      code,
      title,
      label: `${code} ${title}`.trim(),
      termLabel: currentTermLabel,
      termStartDate: currentTermStartDate,
      termEndDate: currentTermEndDate,
      catalogYearLabel: inferGrcCatalogYearLabelFromTranscriptTerm(
        currentTermLabel,
        currentTermStartDate
      ),
    });
  }

  return parsed;
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

function extractFlateStreams(data: Uint8Array) {
  const binary = uint8ArrayToBinaryString(data);
  const streams: Uint8Array[] = [];
  let searchIndex = 0;

  while (searchIndex < binary.length) {
    const streamIndex = binary.indexOf("stream", searchIndex);
    if (streamIndex < 0) break;

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
      streams.push(binaryStringToUint8Array(binary.slice(dataStart, dataEnd)));
    }

    searchIndex = endstreamIndex + "endstream".length;
  }

  return streams;
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

function extractTranscriptLinesFromPdf(data: Uint8Array) {
  const allLines: string[] = [];

  for (const stream of extractFlateStreams(data)) {
    try {
      const content = inflate(stream, { to: "string" });
      if (!content.includes("Tj") && !content.includes("TJ")) {
        continue;
      }

      const streamItems = extractTextItemsFromStreamContent(content);
      if (!streamItems.length) {
        continue;
      }

      // Keep each PDF text stream isolated so page-local Y positions do not
      // collide across multiple transcript pages.
      allLines.push(...buildPageLines(streamItems));
    } catch {
      continue;
    }
  }

  return allLines;
}

class TranscriptPdfService {
  async extractTranscriptDataFromPdf(fileUri: string): Promise<ParsedTranscriptData> {
    const data = await readPdfBytes(fileUri);
    const allLines = extractTranscriptLinesFromPdf(data);

    if (!allLines.length) {
      throw new Error("No readable transcript text found in PDF.");
    }

    return {
      completedCourses: parseTranscriptCourseLines(allLines),
      gpa: extractCumulativeGpaFromTranscriptLines(allLines),
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
