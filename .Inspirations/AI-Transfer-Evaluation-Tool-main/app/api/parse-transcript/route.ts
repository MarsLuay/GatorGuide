import { NextRequest, NextResponse } from 'next/server';
import sampleTranscript from '@/data/sample-transcript.json';
import { parseCoursesFromText, requireAnthropicClient } from '@/app/api/utils/courseParser';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { transcriptText } = await req.json();

    if (!transcriptText || typeof transcriptText !== 'string') {
      return NextResponse.json({ error: 'No transcript text provided' }, { status: 400 });
    }

    // Fallback to demo data if no API key present
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ courses: (sampleTranscript as { courses: unknown[] }).courses });
    }

    const anthropic = requireAnthropicClient();
    const courses = await parseCoursesFromText(anthropic, transcriptText);

    return NextResponse.json({ courses });
  } catch (error) {
    console.error('Parse error:', error);
    // Fallback to demo data to avoid blocking users
    return NextResponse.json({ courses: (sampleTranscript as { courses: unknown[] }).courses });
  }
}
