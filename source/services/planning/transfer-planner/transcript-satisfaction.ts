import { extractCourseCodes, normalizeCourseCode } from "./course-code";

export type TranscriptSatisfactionResolution<OptionGroup> = {
  groupId: string;
  categoryOptionLabel: string;
  chosenTranscriptSatisfier?: string | null;
  optionGroup: OptionGroup;
};

type TranscriptSatisfactionCourse<OptionGroup> = {
  label: string;
  guidanceSummary?: string | null;
  optionGroup?: OptionGroup | null;
};

type TranscriptSatisfactionQuarter<Course> = {
  phase: "completed" | "current" | "planned";
  courses: Course[];
};

function joinGuidanceSummaries(...parts: (string | null | undefined)[]) {
  const cleaned = parts.map((part) => String(part ?? "").trim()).filter(Boolean);
  return cleaned.length ? cleaned.join(" ") : null;
}

export function attachSelectedCategoryTranscriptSatisfactionToPlan<
  OptionGroup extends { id?: string | null },
  Course extends TranscriptSatisfactionCourse<OptionGroup>,
  Quarter extends TranscriptSatisfactionQuarter<Course>,
>(input: {
  suggestedPlan: Quarter[];
  satisfiedCategoryResolutions: TranscriptSatisfactionResolution<OptionGroup>[];
  joinGuidance?: (...parts: (string | null | undefined)[]) => string | null;
}) {
  if (!input.satisfiedCategoryResolutions.length) {
    return input.suggestedPlan;
  }

  const resolutionsByCourseCode = new Map<
    string,
    TranscriptSatisfactionResolution<OptionGroup>[]
  >();
  const satisfiedCategoryKeys = new Set<string>();
  for (const resolution of input.satisfiedCategoryResolutions) {
    const courseCode = normalizeCourseCode(resolution.chosenTranscriptSatisfier ?? "");
    if (!courseCode) {
      continue;
    }
    resolutionsByCourseCode.set(courseCode, [
      ...(resolutionsByCourseCode.get(courseCode) ?? []),
      resolution,
    ]);
    satisfiedCategoryKeys.add(`${resolution.groupId}||${resolution.categoryOptionLabel}`);
  }

  const joinGuidance = input.joinGuidance ?? joinGuidanceSummaries;

  return input.suggestedPlan.map<Quarter>((quarter) => ({
    ...quarter,
    courses: quarter.courses
      .filter((course) => {
        if (quarter.phase !== "planned" && quarter.phase !== "current") {
          return true;
        }
        const optionGroupId = String(course.optionGroup?.id ?? "");
        const label = String(course.label ?? "").replace(/\s+/g, " ").trim();
        return !satisfiedCategoryKeys.has(`${optionGroupId}||${label}`);
      })
      .map<Course>((course) => {
        if (quarter.phase !== "completed") {
          return course;
        }

        const courseCode = normalizeCourseCode(extractCourseCodes(course.label)[0] ?? course.label);
        const [resolution] = resolutionsByCourseCode.get(courseCode) ?? [];
        if (!resolution) {
          return course;
        }

        return {
          ...course,
          optionGroup: course.optionGroup ?? resolution.optionGroup,
          guidanceSummary: joinGuidance(
            course.guidanceSummary,
            `${resolution.categoryOptionLabel} is satisfied by this completed transcript course.`
          ),
        } as Course;
      }),
  }));
}
