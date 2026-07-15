const assert = require("node:assert/strict");
const test = require("node:test");

const { collectCourseCodesFromValue } = require("./course-code-snapshot.cjs");

test("bootstrap course snapshots ignore course-shaped prose and HTTP status text", () => {
  const courseCodes = new Set();
  collectCourseCodesFromValue(
    {
      reason: "HTTP 404",
      sourceHeading: "Discuss MATH 124 with an adviser",
      requirementGroup: {
        options: [
          {
            uwCourses: ["MATH 124"],
            equivalentUwCourseCodes: ["AMATH 124"],
          },
        ],
      },
      terms: [{ courses: ["ENGL 101"] }],
    },
    courseCodes
  );

  assert.deepEqual([...courseCodes].sort(), ["AMATH 124", "ENGL 101", "MATH 124"]);
  assert.equal(courseCodes.has("HTTP 404"), false);
});
