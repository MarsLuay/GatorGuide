import Anthropic from '@anthropic-ai/sdk';
import { NextRequest, NextResponse } from 'next/server';
import bellevueEquivalencies from '@/data/bellevue-uw-equivalencies.json';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  let courses: Array<{ courseCode: string; courseTitle: string; credits: number; grade: string }> = [];
  try {
    const { courses: incomingCourses, major } = await req.json();

    if (!Array.isArray(incomingCourses)) {
      return NextResponse.json({ error: 'Invalid courses payload' }, { status: 400 });
    }

    courses = incomingCourses;

    // Pre-filter equivalency database to only relevant courses
    // This reduces token count and speeds up API calls
    const studentCourseCodes = courses.map((c: { courseCode: string }) => c.courseCode);
    const relevantEquivalencies = bellevueEquivalencies.courses.filter(
      (eq: { bellevueCourse?: string; bcCourse?: string }) => {
        const code = eq.bellevueCourse || eq.bcCourse;
        return code ? studentCourseCodes.includes(code) : false;
      }
    );

    // Local deterministic matcher if no Anthropic key available
    if (!process.env.ANTHROPIC_API_KEY) {
      const matches = courses.map((course: { courseCode: string; courseTitle: string; credits: number; grade: string }) => {
        const eq = relevantEquivalencies.find(
          (item: { bellevueCourse?: string; bcCourse?: string }) =>
            (item.bellevueCourse || item.bcCourse) === course.courseCode
        );

        if (eq) {
          const isElective = eq.uwEquivalent?.includes('XX') || eq.directTransfer === false;
          const matchType = isElective ? 'elective' : 'exact';
          return {
            studentCourse: course,
            uwEquivalent: eq.uwEquivalent || 'Elective Credit',
            uwTitle: eq.uwTitle || 'General Elective',
            transferCredits: eq.uwCredits || course.credits || 0,
            category: eq.category || '',
            matchType,
            reasoning: isElective
              ? 'Maps to UW elective per equivalency guide.'
              : 'Direct equivalency found in Bellevue → UW guide.',
          };
        }

        return {
          studentCourse: course,
          uwEquivalent: 'Requires Review',
          uwTitle: 'Needs Evaluation',
          transferCredits: course.credits || 0,
          category: '',
          matchType: 'review',
          reasoning: 'No direct equivalency found; flag for advisor review.',
        };
      });

      const summary = matches.reduce(
        (acc, m) => {
          acc.totalCreditsAttempted += m.studentCourse.credits || 0;
          if (m.matchType === 'review') {
            acc.needsReview += 1;
          } else if (m.matchType === 'elective') {
            acc.electiveCredits += m.transferCredits;
            acc.totalCreditsTransferred += m.transferCredits;
          } else {
            acc.directTransfers += 1;
            acc.totalCreditsTransferred += m.transferCredits;
          }
          return acc;
        },
        {
          totalCreditsAttempted: 0,
          totalCreditsTransferred: 0,
          directTransfers: 0,
          electiveCredits: 0,
          needsReview: 0,
        }
      );

      return NextResponse.json({ matches, summary });
    }

    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    const message = await anthropic.messages.create({
      model: process.env.ANTHROPIC_MODEL_ID || 'claude-3-5-haiku-20241022',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: `You are a UW transfer credit evaluator. Match each student course to UW equivalents.

Student's intended major: ${major || 'Undeclared'}

Relevant UW Transfer Equivalencies (only for courses the student took):
${JSON.stringify(relevantEquivalencies, null, 2)}

Student's Courses:
${JSON.stringify(courses, null, 2)}

For each student course:
1. Find exact matches in the database by courseCode
2. If no exact match, use semantic similarity on course titles to find the best UW equivalent
3. If still no match, mark as "Requires Advisor Review"

Return a JSON object with this structure:
{
  "matches": [
    {
      "studentCourse": {courseCode, courseTitle, credits, grade},
      "uwEquivalent": "COURSE CODE" or "Elective Credit" or "Requires Review",
      "uwTitle": "Course Title" or "General Elective" or "Needs Evaluation",
      "transferCredits": number,
      "category": "category name",
      "matchType": "exact" | "semantic" | "elective" | "review",
      "reasoning": "brief explanation"
    }
  ],
  "summary": {
    "totalCreditsAttempted": number,
    "totalCreditsTransferred": number,
    "directTransfers": number,
    "electiveCredits": number,
    "needsReview": number
  }
}`,
        },
      ],
    });

    const content = message.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type');
    }

    // Extract JSON from response (handle markdown code blocks)
    let jsonText = content.text.trim();
    if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    }

    const result = JSON.parse(jsonText);

    const totalAttempted = courses.reduce(
      (acc: number, c: { credits?: number }) => acc + (c.credits || 0),
      0
    );
    const totalTransferredRaw =
      result.summary?.totalCreditsTransferred ??
      result.matches?.reduce(
        (acc: number, m: { transferCredits?: number }) => acc + (m.transferCredits || 0),
        0
      ) ??
      0;

    const totalTransferred = Math.min(totalTransferredRaw || totalAttempted, 90);
    const degreeApplicable = totalTransferred;
    const unappliedCredits = Math.max((totalTransferredRaw || totalAttempted) - 90, 0);

    result.summary.totalCreditsAttempted = totalAttempted;
    result.summary.totalCreditsTransferred = totalTransferred;
    result.summary.degreeApplicable = degreeApplicable;
    result.summary.unappliedCredits = unappliedCredits;

    return NextResponse.json(result);
  } catch (error) {
    console.error('Match error:', error);
    // Fallback: basic deterministic mapping so users still get a result
    try {
      const matches = courses.map((course) => {
        const eq = bellevueEquivalencies.courses.find(
          (item: { bellevueCourse?: string; bcCourse?: string }) =>
            (item.bellevueCourse || item.bcCourse) === course.courseCode
        );

        if (eq) {
          const isElective = eq.uwEquivalent?.includes('XX') || eq.directTransfer === false;
          const matchType = isElective ? 'elective' : 'exact';
          return {
            studentCourse: course,
            uwEquivalent: eq.uwEquivalent || 'Elective Credit',
            uwTitle: eq.uwTitle || 'General Elective',
            transferCredits: eq.uwCredits || course.credits || 0,
            category: eq.category || '',
            matchType,
            reasoning: isElective
              ? 'Maps to UW elective per equivalency guide.'
              : 'Direct equivalency found in Bellevue → UW guide.',
          };
        }

        return {
          studentCourse: course,
          uwEquivalent: 'Requires Review',
          uwTitle: 'Needs Evaluation',
          transferCredits: course.credits || 0,
          category: '',
          matchType: 'review',
          reasoning: 'No direct equivalency found; flag for advisor review.',
        };
      });

      const summary = matches.reduce(
        (acc, m) => {
          acc.totalCreditsAttempted += m.studentCourse.credits || 0;
          if (m.matchType === 'review') {
            acc.needsReview += 1;
          } else if (m.matchType === 'elective') {
            acc.electiveCredits += m.transferCredits;
            acc.totalCreditsTransferred += m.transferCredits;
          } else {
            acc.directTransfers += 1;
            acc.totalCreditsTransferred += m.transferCredits;
          }
          return acc;
        },
        {
          totalCreditsAttempted: 0,
          totalCreditsTransferred: 0,
          directTransfers: 0,
          electiveCredits: 0,
          needsReview: 0,
        }
      );

      const totalTransferred = Math.min(summary.totalCreditsTransferred || summary.totalCreditsAttempted, 90);
      const degreeApplicable = totalTransferred;
      const unappliedCredits = Math.max(summary.totalCreditsTransferred - 90, 0);

      return NextResponse.json({
        matches,
        summary: {
          ...summary,
          totalCreditsTransferred: totalTransferred,
          degreeApplicable,
          unappliedCredits,
        },
      });
    } catch {
      return NextResponse.json(
        { error: 'Failed to match courses' },
        { status: 500 }
      );
    }
  }
}
