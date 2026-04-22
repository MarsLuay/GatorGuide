export const TRANSFER_EQUIVALENCY_TRACKED_TAGS = [
  "SSC",
  "AH",
  "NSC",
  "QSR",
  "VLPA",
  "DIV",
  "NW",
  "IANDS",
] as const;

export type TransferEquivalencyTrackedTag =
  (typeof TRANSFER_EQUIVALENCY_TRACKED_TAGS)[number];

const TRACKED_TRANSFER_EQUIVALENCY_TAGS = new Set<string>(
  TRANSFER_EQUIVALENCY_TRACKED_TAGS
);

export const TRANSFER_EQUIVALENCY_ALL_TRACKED_TAGS_PARAM =
  TRANSFER_EQUIVALENCY_TRACKED_TAGS.join(",");

export function normalizeTransferEquivalencyTag(
  value: string | null | undefined
) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z]/g, "");
}

export function isTransferEquivalencyTrackedTag(
  value: string | null | undefined
): value is TransferEquivalencyTrackedTag {
  return TRACKED_TRANSFER_EQUIVALENCY_TAGS.has(
    normalizeTransferEquivalencyTag(value)
  );
}

export function getTransferEquivalencyTagLabel(
  normalizedTag: string | null | undefined
) {
  switch (normalizeTransferEquivalencyTag(normalizedTag)) {
    case "AH":
      return "A&H";
    case "SSC":
      return "SSc";
    case "NSC":
      return "NSc";
    case "QSR":
      return "QSR";
    case "VLPA":
      return "VLPA";
    case "DIV":
      return "DIV";
    case "NW":
      return "NW";
    case "IANDS":
      return "I&S";
    default:
      return normalizeTransferEquivalencyTag(normalizedTag);
  }
}
