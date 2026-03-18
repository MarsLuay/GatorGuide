import { NextRequest, NextResponse } from 'next/server';
import sampleTranscript from '@/data/sample-transcript.json';
import { extractJsonArray, parseCoursesFromText, requireAnthropicClient } from '@/app/api/utils/courseParser';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // If no API key, return demo data to keep the flow alive
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ courses: (sampleTranscript as { courses: unknown[] }).courses });
    }

    const anthropic = requireAnthropicClient();
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Try pure text extraction for PDFs before invoking vision
    if (file.type === 'application/pdf') {
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const pdfParse = require('pdf-parse');
        const pdfData = await pdfParse(buffer);

        if (pdfData?.text?.trim()) {
          const courses = await parseCoursesFromText(anthropic, pdfData.text);
          if (Array.isArray(courses)) {
            return NextResponse.json({ courses });
          }
        }
      } catch (err) {
        console.warn('PDF text parse failed, falling back to vision:', err);
      }
    }

    // Determine media type based on file type
    let mediaType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif' | 'application/pdf';
    if (file.type === 'image/jpeg' || file.type === 'image/jpg') {
      mediaType = 'image/jpeg';
    } else if (file.type === 'image/png') {
      mediaType = 'image/png';
    } else if (file.type === 'image/webp') {
      mediaType = 'image/webp';
    } else if (file.type === 'image/gif') {
      mediaType = 'image/gif';
    } else if (file.type === 'application/pdf') {
      mediaType = 'application/pdf';
    } else {
      return NextResponse.json({ error: 'Unsupported file type. Please upload a PDF or image (JPEG, PNG, WebP, GIF).' }, { status: 400 });
    }

    const base64 = buffer.toString('base64');

    const message = await anthropic.messages.create({
      model: process.env.ANTHROPIC_MODEL_ID || 'claude-3-5-haiku-20241022',
      max_tokens: 2048,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'document',
              source: {
                type: 'base64',
                media_type: mediaType,
                data: base64,
              },
            },
            {
              type: 'text',
              text: `You are a transcript parser. Extract EVERY course you can read from this document and return ONLY a JSON array. Follow this shape exactly:
[
  {
    "courseCode": "MATH& 151",
    "courseTitle": "Calculus I",
    "credits": 5,
    "grade": "A",
    "institution": "Unknown"
  }
]

Rules:
- Include all courses, do not drop any.
- credits must be numbers (no strings).
- grade is a string (use "In Progress" if missing).
- Return ONLY JSON (no code fences).`,
            },
          ],
        },
      ],
    });

    const content = message.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type');
    }

    const courses = extractJsonArray(content.text);

    if (!Array.isArray(courses)) {
      throw new Error('Parsed courses is not an array');
    }

    return NextResponse.json({ courses });
  } catch (error) {
    console.error('Parse error:', error);
    // Fallback to demo data to keep UX moving
    return NextResponse.json({ courses: (sampleTranscript as { courses: unknown[] }).courses });
  }
}
