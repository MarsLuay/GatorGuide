"use strict";

/** P08-A/B catalog-year versioning + semantic change classification (harness). */

function classifySemanticChange(previousModel, nextModel) {
  const prev = JSON.stringify(previousModel ?? null);
  const next = JSON.stringify(nextModel ?? null);
  if (prev === next) {
    return { kind: "unchanged", publish: false };
  }
  const prevKeys = new Set(Object.keys(previousModel?.requirements || {}));
  const nextKeys = new Set(Object.keys(nextModel?.requirements || {}));
  const added = [...nextKeys].filter((k) => !prevKeys.has(k));
  const removed = [...prevKeys].filter((k) => !nextKeys.has(k));
  const changed = [...nextKeys].filter(
    (k) =>
      prevKeys.has(k) &&
      JSON.stringify(previousModel.requirements[k]) !==
        JSON.stringify(nextModel.requirements[k])
  );
  const material = added.length + removed.length + changed.length > 0;
  return {
    kind: material ? "semantic" : "cosmetic",
    added,
    removed,
    changed,
    publish: material,
  };
}

function attachCatalogYear(model, catalogYear) {
  if (!catalogYear || !/^\d{4}$/.test(String(catalogYear))) {
    throw new Error("catalogYear required (YYYY)");
  }
  return {
    ...model,
    catalogYear: String(catalogYear),
    // Identity must not depend only on fetch date.
    identityKey: `${model?.programId || "unknown"}@${catalogYear}`,
  };
}

module.exports = { classifySemanticChange, attachCatalogYear };
