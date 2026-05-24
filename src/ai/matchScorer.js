const { client } = require('../lib/anthropic');

async function scoreMatch(parsedResume, jobAnalysis) {
  const t0 = Date.now();
  console.log('[matchScorer] Starting');
  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    messages: [
      {
        role: 'user',
        content: `You are a senior ATS expert and executive resume strategist. Analyze how well a candidate's resume matches a job listing and return a comprehensive assessment.

Return ONLY valid JSON with this exact structure — no explanation, no markdown:
{
  "overall_score": 0,
  "breakdown": {
    "skills_match": 0,
    "experience_match": 0,
    "education_match": 0
  },
  "matched_keywords": [],
  "missing_keywords": [],
  "strengths": [],
  "weaknesses": [],
  "ats_issues": [],
  "recommendation": ""
}

Field definitions:
- overall_score: weighted average — skills 40%, experience 40%, education 20%. Score 0–100
- matched_keywords: keywords from the job's industry_keywords and required_skills that appear in the resume
- missing_keywords: important keywords from the job that are absent from the resume
- strengths: 2–4 specific things the resume does well for this role (e.g. "5+ years in regulated banking aligns with required experience")
- weaknesses: 2–4 honest gaps or areas where the resume underperforms for this role (e.g. "No mention of ETL or data infrastructure despite being a preferred qualification")
- ats_issues: specific formatting, keyword, or structural problems that would hurt ATS performance (e.g. "Missing exact phrase 'Product Owner' in experience bullets", "Education section lacks graduation dates which some ATS require")
- recommendation: 2–3 sentences of honest, prioritized advice on the most impactful changes to make

Candidate resume:
${JSON.stringify(parsedResume, null, 2)}

Job analysis:
${JSON.stringify(jobAnalysis, null, 2)}`,
      },
    ],
  });

  const content = response.content[0].text.trim().replace(/^```json\s*/i, '').replace(/```\s*$/, '');
  try {
    const parsed = JSON.parse(content);
    console.log(`[matchScorer] Done in ${Date.now() - t0}ms — score: ${parsed.overall_score}, stop_reason: ${response.stop_reason}`);
    return parsed;
  } catch (err) {
    console.error(`[matchScorer] JSON parse failed after ${Date.now() - t0}ms — raw response (first 200 chars):`, content.slice(0, 200));
    throw new Error(`matchScorer: Failed to parse Claude response as JSON: ${err.message}`);
  }
}

module.exports = { scoreMatch };
