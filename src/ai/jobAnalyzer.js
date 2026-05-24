const { client } = require('../lib/anthropic');

async function analyzeJob(rawJobText) {
  const t0 = Date.now();
  console.log(`[jobAnalyzer] Starting — input length: ${rawJobText.length} chars`);
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
  try {
    const parsed = JSON.parse(content);
    console.log(`[jobAnalyzer] Done in ${Date.now() - t0}ms — stop_reason: ${response.stop_reason}`);
    return parsed;
  } catch (err) {
    console.error(`[jobAnalyzer] JSON parse failed after ${Date.now() - t0}ms — raw response (first 200 chars):`, content.slice(0, 200));
    throw new Error(`jobAnalyzer: Failed to parse Claude response as JSON: ${err.message}`);
  }
}

module.exports = { analyzeJob };
