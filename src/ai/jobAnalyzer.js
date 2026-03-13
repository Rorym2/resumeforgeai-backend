const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function analyzeJob(rawJobText) {
  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: `You are a job listing analyzer. Extract the key information from the job description below and return it as structured JSON.

Return ONLY valid JSON with this exact structure — no explanation, no markdown, just the JSON object:
{
  "job_title": "",
  "company": "",
  "seniority_level": "",
  "required_skills": [],
  "preferred_skills": [],
  "key_responsibilities": [],
  "industry_keywords": [],
  "tone": ""
}

Field definitions:
- seniority_level: "entry", "mid", "senior", or "executive"
- required_skills: hard requirements explicitly stated (e.g. "3+ years Python", "Bachelor's degree")
- preferred_skills: nice-to-haves or "preferred" qualifications
- key_responsibilities: the core job duties in brief phrases
- industry_keywords: important domain-specific terms and buzzwords from the listing (great for ATS matching)
- tone: "formal", "casual", or "technical" — based on the overall writing style of the listing

Job description:
${rawJobText}`,
      },
    ],
  });

  const content = response.content[0].text.trim().replace(/^```json\s*/i, '').replace(/```\s*$/, '');
  return JSON.parse(content);
}

module.exports = { analyzeJob };
