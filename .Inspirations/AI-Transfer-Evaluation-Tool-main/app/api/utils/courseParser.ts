import Anthropic from '@anthropic-ai/sdk';

const MODEL_ID = process.env.ANTHROPIC_MODEL_ID || 'claude-3-5-haiku-20241022';

const BASE_PARSE_PROMPT = `You are a transcript parser. Extract EVERY course from the transcript and return ONLY a JSON array.

Each item must include:
- courseCode (string, e.g. "MATH& 151")
- courseTitle (string)
- credits (number)
- grade (string; use "In Progress" if missing)
- institution (string; use "Unknown" if not present)

Rules:
- Do not drop courses.
- Credits must be numbers (no strings like "5 credits").
- Return raw JSON array, no markdown or prose.`;

export function requireAnthropicClient() {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('Missing ANTHROPIC_API_KEY');
  }

  return new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });
}

export async function parseCoursesFromText(anthropic: Anthropic, transcriptText: string) {
  const message = await anthropic.messages.create({
    model: MODEL_ID,
    max_tokens: 2048,
    messages: [
      {
        role: 'user',
        content: `${BASE_PARSE_PROMPT}\n\nTranscript:\n${transcriptText}`,
      },
    ],
  });

  const content = message.content[0];
  if (content.type !== 'text') {
    throw new Error('Unexpected response type');
  }

  return extractJsonArray(content.text);
}

export function extractJsonArray(rawText: string) {
  let jsonText = rawText.trim();

  const fenced = jsonText.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced?.[1]) {
    jsonText = fenced[1];
  }

  const arrayMatch = jsonText.match(/\[[\s\S]*]/);
  if (arrayMatch) {
    jsonText = arrayMatch[0];
  }

  const parsed = JSON.parse(jsonText);

  if (!Array.isArray(parsed)) {
    throw new Error('Parsed content is not an array');
  }

  return parsed;
}
