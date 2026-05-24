const { client } = require('../lib/anthropic');

async function parseResume(rawText) {
  const t0 = Date.now();
  console.log(`[resumeParser] Starting — input length: ${rawText.length} chars`);
  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    messages: [
      {
        role: 'user',
        content: `You are a resume parser. Extract the information from the resume text below and return it as structured JSON.

Return ONLY valid JSON with this exact structure — no explanation, no markdown, just the JSON object:
{
  "contact": {
    "name": "",
    "email": "",
    "phone": "",
    "location": ""
  },
  "summary": "",
  "education": [
    {
      "institution": "",
      "location": "",
      "degree": "",
      "gpa": "",
      "graduation_date": "",
      "details": []
    }
  ],
  "experience": [
    {
      "organization": "",
      "location": "",
      "title": "",
      "start_date": "",
      "end_date": "",
      "bullets": []
    }
  ],
  "leadership_activities": [
    {
      "organization": "",
      "location": "",
      "role": "",
      "start_date": "",
      "end_date": "",
      "bullets": []
    }
  ],
  "skills": {
    "technical": [],
    "languages": [],
    "other": []
  }
}

Rules:
- If a field is not present in the resume, use an empty string "" or empty array []
- Never use the strings "undefined", "null", or "N/A" — use "" for any missing or unknown field
- Do not invent or infer any information not explicitly in the resume
- Preserve the exact wording of bullet points

Resume text:
${rawText}`,
      },
    ],
  });

  const content = response.content[0].text.trim().replace(/^```json\s*/i, '').replace(/```\s*$/, '');
  try {
    const parsed = JSON.parse(content);
    console.log(`[resumeParser] Done in ${Date.now() - t0}ms — stop_reason: ${response.stop_reason}`);
    return parsed;
  } catch (err) {
    console.error(`[resumeParser] JSON parse failed after ${Date.now() - t0}ms — raw response (first 200 chars):`, content.slice(0, 200));
    throw new Error(`resumeParser: Failed to parse Claude response as JSON: ${err.message}`);
  }
}

module.exports = { parseResume };
