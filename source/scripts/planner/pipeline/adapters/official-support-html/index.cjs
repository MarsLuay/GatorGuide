"use strict";

/** Official support / approved-list pages (P05-D). */

function looksLikeOfficialSupportHtml(sourceDocument) {
  const text = (sourceDocument?.pages || [])
    .flatMap((p) => p.textBlocks || [])
    .map((b) => b.text)
    .join("\n");
  return (
    /approved (course|elective) list/i.test(text) ||
    /upper-?division prerequisite/i.test(text) ||
    (/admissions?/i.test(text) && /prerequisite/i.test(text) && !/Bachelor of/i.test(text.slice(0, 400)))
  );
}

function createOfficialSupportPageAdapter() {
  return {
    id: "official-support-html",
    async matches(sourceDocument) {
      return looksLikeOfficialSupportHtml(sourceDocument);
    },
    async parse(sourceDocument) {
      return {
        adapterId: "official-support-html",
        status: "partial",
        schedulable: false,
        message: "support-only facts — must not create required rows",
        sourceUrl: sourceDocument?.sourceUrl || null,
      };
    },
  };
}

module.exports = {
  createOfficialSupportPageAdapter,
  looksLikeOfficialSupportHtml,
};
