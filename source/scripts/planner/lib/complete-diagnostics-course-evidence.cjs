function collectRequirementSourceUwCourseCodes(blocks, normalizeCourseCode = (value) => value) {
  return (blocks ?? []).flatMap((block) => [
    ...(block.parsedUwCourseCodes ?? []),
    ...(block.approvedFilterUwCourseCodes ?? []),
    ...(block.electiveListUwCourseCodes ?? []),
    ...(block.supportOnlyUwCourseCodes ?? []),
    ...(block.sourceOnlyUwCourseCodes ?? []),
    ...(block.structuredOnlyUwCourseCodes ?? []),
    ...(block.supportLists ?? []).flatMap((supportList) => supportList.acceptedUwCourseCodes ?? []),
  ]).map(normalizeCourseCode);
}

module.exports = {
  collectRequirementSourceUwCourseCodes,
};
