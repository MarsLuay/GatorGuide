import { MaterialIcons } from "@expo/vector-icons";

export type ResourceCatalogItem = {
  title?: string;
  titleKey?: string;
  description?: string;
  descriptionKey?: string;
  url: string;
  tags?: string[];
  expiresAt?: string | null;
};

export type ResourceCatalogSubsection = {
  id: string;
  title?: string;
  titleKey?: string;
  items: ResourceCatalogItem[];
};

export type ResourceCatalogSection = {
  id: string;
  title?: string;
  titleKey?: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  items: ResourceCatalogItem[];
  subsections?: ResourceCatalogSubsection[];
};

type RawResourceCatalog = ResourceCatalogSection[] | { default?: ResourceCatalogSection[] };

function loadResourceCatalog() {
  const rawCatalog = require("../data/resource-catalog.json") as RawResourceCatalog;
  if (Array.isArray(rawCatalog)) return rawCatalog;
  if (Array.isArray(rawCatalog?.default)) return rawCatalog.default;
  return [];
}

export const RESOURCE_CATALOG: ResourceCatalogSection[] = loadResourceCatalog();
