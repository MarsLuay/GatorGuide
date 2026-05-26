export const TRANSFER_EQUIVALENCY_TRACKED_TAGS = [
  "SSC",
  "AH",
  "NSC",
  "QSR",
  "COMM",
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

const TRANSFER_EQUIVALENCY_TAG_LABELS: Record<
  TransferEquivalencyTrackedTag,
  { shortLabel: string; longLabel: string }
> = {
  SSC: { shortLabel: "SSc", longLabel: "Social Sciences" },
  AH: { shortLabel: "A&H", longLabel: "Arts and Humanities" },
  NSC: { shortLabel: "NSc", longLabel: "Natural Sciences" },
  QSR: {
    shortLabel: "QSR",
    longLabel: "Quantitative and Symbolic Reasoning",
  },
  COMM: {
    shortLabel: "Communication",
    longLabel: "Basic Skills/Communication",
  },
  VLPA: {
    shortLabel: "VLPA",
    longLabel: "Visual, Literary, and Performing Arts",
  },
  DIV: { shortLabel: "DIV", longLabel: "Diversity" },
  NW: { shortLabel: "NW", longLabel: "Natural World" },
  IANDS: { shortLabel: "I&S", longLabel: "Individuals and Societies" },
};

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
  const normalized = normalizeTransferEquivalencyTag(normalizedTag);
  return (
    TRANSFER_EQUIVALENCY_TAG_LABELS[
      normalized as TransferEquivalencyTrackedTag
    ]?.shortLabel ?? normalized
  );
}

export function getTransferEquivalencyTagLongLabel(
  normalizedTag: string | null | undefined
) {
  const normalized = normalizeTransferEquivalencyTag(normalizedTag);
  return (
    TRANSFER_EQUIVALENCY_TAG_LABELS[
      normalized as TransferEquivalencyTrackedTag
    ]?.longLabel ?? normalized
  );
}

export function getTransferEquivalencyTagDisplayLabel(
  normalizedTag: string | null | undefined
) {
  const shortLabel = getTransferEquivalencyTagLabel(normalizedTag);
  const longLabel = getTransferEquivalencyTagLongLabel(normalizedTag);
  if (!longLabel || longLabel === shortLabel) {
    return shortLabel;
  }
  return `${shortLabel} (${longLabel})`;
}
