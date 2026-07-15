"use strict";

/**
 * P17 localization automation harness — config-driven locales + changed-key translate.
 * No provider credentials enter app bundle (CI/dev only).
 */

function loadLocaleRegistry(config) {
  const locales = Array.isArray(config?.locales) ? config.locales : [];
  const enabled = locales.filter((l) => l.enabled !== false);
  return {
    codes: enabled.map((l) => l.code),
    rtl: enabled.filter((l) => l.rtl).map((l) => l.code),
    byCode: Object.fromEntries(enabled.map((l) => [l.code, l])),
  };
}

function hashEnglish(value) {
  let h = 0;
  const s = String(value ?? "");
  for (let i = 0; i < s.length; i += 1) {
    h = (h * 31 + s.charCodeAt(i)) >>> 0;
  }
  return `e${h.toString(16)}`;
}

function planChangedKeys({ english = {}, previousHashes = {} } = {}) {
  const changed = [];
  const hashes = {};
  for (const [key, value] of Object.entries(english)) {
    const hash = hashEnglish(value);
    hashes[key] = hash;
    if (previousHashes[key] !== hash) {
      changed.push(key);
    }
  }
  return { changed, hashes };
}

function shieldTokens(text) {
  const tokens = [];
  const shielded = String(text).replace(
    /(\{[a-zA-Z0-9_.]+\}|https?:\/\/\S+|MATH&\s?\d+[A-Z]?|UW\s(?:Seattle|Bothell|Tacoma))/g,
    (m) => {
      const id = tokens.length;
      tokens.push(m);
      return `__TOK${id}__`;
    }
  );
  return { shielded, tokens };
}

function restoreTokens(shielded, tokens) {
  return String(shielded).replace(/__TOK(\d+)__/g, (_, i) => tokens[Number(i)] ?? "");
}

function tokenMultiset(text) {
  const { tokens } = shieldTokens(text);
  return tokens.slice().sort();
}

async function translateChangedKeys({
  english,
  previousHashes = {},
  provider,
  targetLocale,
} = {}) {
  if (typeof provider !== "function") {
    throw new Error("provider required (CI/dev only)");
  }
  const { changed, hashes } = planChangedKeys({ english, previousHashes });
  const staged = {};
  try {
    for (const key of changed) {
      const { shielded, tokens } = shieldTokens(english[key]);
      const translated = await provider({
        locale: targetLocale,
        key,
        text: shielded,
      });
      staged[key] = restoreTokens(translated, tokens);
      if (
        JSON.stringify(tokenMultiset(english[key])) !==
        JSON.stringify(tokenMultiset(staged[key]))
      ) {
        throw new Error(`token-damage:${key}`);
      }
    }
    return { ok: true, translated: staged, hashes, changed };
  } catch (err) {
    return { ok: false, error: String(err?.message || err), hashes: previousHashes };
  }
}

module.exports = {
  loadLocaleRegistry,
  hashEnglish,
  planChangedKeys,
  shieldTokens,
  restoreTokens,
  tokenMultiset,
  translateChangedKeys,
};
