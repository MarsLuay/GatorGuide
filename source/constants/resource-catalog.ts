import { MaterialIcons } from "@expo/vector-icons";
import { unwrapJsonArrayModule } from "@/constants/json-array-module";

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

function loadResourceCatalog() {
  return unwrapJsonArrayModule(
    require("../data/resource-catalog.json") as ResourceCatalogSection[]
  );
}

export const RESOURCE_CATALOG: ResourceCatalogSection[] = loadResourceCatalog();
