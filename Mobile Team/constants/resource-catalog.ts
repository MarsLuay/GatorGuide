import { MaterialIcons } from "@expo/vector-icons";

export type ResourceCatalogItem = {
  title?: string;
  titleKey?: string;
  description?: string;
  descriptionKey?: string;
  url: string;
  tags?: string[];
};

export type ResourceCatalogSection = {
  id: string;
  title?: string;
  titleKey?: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  items: ResourceCatalogItem[];
};

type RawResourceCatalog = ResourceCatalogSection[] | { default?: ResourceCatalogSection[] };

function loadResourceCatalog() {
  const rawCatalog = require("../data/resource-catalog.json") as RawResourceCatalog;
  if (Array.isArray(rawCatalog)) return rawCatalog;
  if (Array.isArray(rawCatalog?.default)) return rawCatalog.default;
  return [];
}

export const RESOURCE_CATALOG: ResourceCatalogSection[] = loadResourceCatalog();
