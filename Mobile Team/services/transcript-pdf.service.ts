import * as FileSystem from "expo-file-system";
import { Platform } from "react-native";

export type ParsedTranscriptCourse = {
  code: string;
  title: string;
  label: string;
};

const CREDIT_PATTERN = /^\d+\.\d{3}$/;
const BASE64_CHARS =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const COURSE_LINE_PATTERN =
  /^([A-Z]{2,6}&?)\s+(\d{3}[A-Z]?)\s+(.+?)\s+(\d+\.\d{3})\s+(\d+\.\d{3})\s+(\d+(?:\.\d+)?|[A-Z][A-Z+\-]*)\s+(\d+\.\d{3})$/;

function normalizeWhitespace(value: string) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function normalizeCourseCode(subject: string, number: string) {
  return normalizeWhitespace(`${subject} ${number}`).toUpperCase();
}

type PdfTextItem = {
  str?: string;
  transform?: number[];
};

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

async function readPdfBytes(fileUri: string) {
  const normalizedUri = String(fileUri ?? "").trim();
  if (!normalizedUri) {
    throw new Error("Transcript file URL is missing.");
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

    const y = Math.round(Number(item?.transform?.[5] ?? 0) * 10) / 10;
    const x = Number(item?.transform?.[4] ?? 0);

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

  for (const line of lines) {
    const match = line.match(COURSE_LINE_PATTERN);
    if (!match) continue;

    const [, subject, number, rawTitle, attempted, earned, , points] = match;
    if (!CREDIT_PATTERN.test(attempted) || !CREDIT_PATTERN.test(earned) || !CREDIT_PATTERN.test(points)) {
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
    });
  }

  return parsed;
}

class TranscriptPdfService {
  async extractCompletedCoursesFromPdf(fileUri: string): Promise<ParsedTranscriptCourse[]> {
    const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const data = await readPdfBytes(fileUri);
    const document = await pdfjsLib.getDocument({
      data,
      useWorkerFetch: false,
      isEvalSupported: false,
    }).promise;

    const allLines: string[] = [];
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const text = await page.getTextContent();
      const pageLines = buildPageLines(text.items as PdfTextItem[]);
      allLines.push(...pageLines);
    }

    return parseTranscriptCourseLines(allLines);
  }
}

export const transcriptPdfService = new TranscriptPdfService();
