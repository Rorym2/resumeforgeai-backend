const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function parseResume(rawText) {
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
- Do not invent or infer any information not explicitly in the resume
- Preserve the exact wording of bullet points

Resume text:
${rawText}`,
      },
    ],
  });

  const content = response.content[0].text.trim().replace(/^```json\s*/i, '').replace(/```\s*$/, '');
  return JSON.parse(content);
}

module.exports = { parseResume };
