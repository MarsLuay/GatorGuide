import { NextRequest, NextResponse } from 'next/server';
import { requireAnthropicClient } from '@/app/api/utils/courseParser';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { matches, studentName, major } = await req.json();

    const coursesNeedingReview = (Array.isArray(matches) ? matches : []).filter(
      (m: { matchType?: string }) => m.matchType === 'review' || m.matchType === 'elective'
    );

    const anthropic = requireAnthropicClient();

    const message = await anthropic.messages.create({
      model: process.env.ANTHROPIC_MODEL_ID || 'claude-3-5-haiku-20241022',
      max_tokens: 2048,
      messages: [
        {
          role: 'user',
          content: `Generate a professional email to a UW academic advisor requesting review of transfer credits.

Student Name: ${studentName || 'Student'}
Intended Major: ${major || 'Undeclared'}

Courses needing review:
${JSON.stringify(coursesNeedingReview, null, 2)}

Write a concise, professional email that:
1. Introduces the student and their transfer institution
2. Lists courses that need evaluation
3. Requests clarification on how these credits will transfer
4. Thanks the advisor for their time

Return only the email body text, ready to send.`,
        },
      ],
    });

    const content = message.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type');
    }

    return NextResponse.json({ emailBody: content.text });
  } catch (error) {
    console.error('Generate request error:', error);
    return NextResponse.json(
      { error: 'Failed to generate advisor request' },
      { status: 500 }
    );
  }
}
