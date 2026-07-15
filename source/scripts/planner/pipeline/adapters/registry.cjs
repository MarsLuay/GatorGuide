"use strict";

/**
 * Source-family adapter registry (P05-A).
 * Selection is structural — never by planId/ownerId/major title.
 */

function createAdapterRegistry(adapters = []) {
  const list = [...adapters];

  return {
    register(adapter) {
      if (!adapter?.id || typeof adapter.matches !== "function") {
        throw new Error("adapter requires id and matches()");
      }
      list.push(adapter);
      return this;
    },
    list() {
      return [...list];
    },
    async selectPrimary(sourceDocument, context = {}) {
      const matches = [];
      for (const adapter of list) {
        if (await adapter.matches(sourceDocument, context)) {
          matches.push(adapter);
        }
      }
      if (matches.length === 0) {
        return {
          ok: false,
          error: "unsupported-structure",
          matches: [],
        };
      }
      if (matches.length > 1) {
        return {
          ok: false,
          error: "ambiguous-adapter",
          matches: matches.map((a) => a.id),
        };
      }
      return { ok: true, adapter: matches[0], matches: [matches[0].id] };
    },
  };
}

/** Architecture guard helpers — forbidden dispatch keys in adapter matchers. */
const FORBIDDEN_DISPATCH_KEYS = Object.freeze([
  "planId",
  "ownerId",
  "majorTitle",
  "major",
]);

function assertNoIdentityDispatch(matcherSource) {
  const text = String(matcherSource || "");
  for (const key of FORBIDDEN_DISPATCH_KEYS) {
    if (new RegExp(`\\b${key}\\b`).test(text)) {
      throw new Error(`adapter matcher must not dispatch on ${key}`);
    }
  }
  return true;
}

module.exports = {
  createAdapterRegistry,
  FORBIDDEN_DISPATCH_KEYS,
  assertNoIdentityDispatch,
};
