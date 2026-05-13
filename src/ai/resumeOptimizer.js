const { client } = require('../lib/anthropic');

async function optimizeResume(parsedResume, jobAnalysis) {
  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: `You are an expert resume writer and ATS optimization specialist. Your job is to rewrite a candidate's resume to be better aligned with a specific job posting.

CRITICAL RULES — you must follow these exactly:
1. NEVER invent, fabricate, or add any experience, skills, or qualifications the candidate did not already have
2. ONLY reword, reframe, and restructure what already exists in their resume
3. Naturally incorporate the job's keywords and industry terms where they genuinely apply
4. Keep bullet points concise, action-verb led, and quantified where the original had numbers
5. Do not change dates, titles, company names, or institutions
6. Return ONLY valid JSON — no explanation, no markdown

Here is the candidate's parsed resume:
${JSON.stringify(parsedResume, null, 2)}

Here is the target job analysis:
${JSON.stringify(jobAnalysis, null, 2)}

Rewrite the resume optimized for this job. Return the same JSON structure as the input resume, with only the text content of bullets and summary rewritten. Do not change any factual fields (dates, titles, organizations, institutions, contact info).`,
      },
    ],
  });

  const content = response.content[0].text.trim().replace(/^```json\s*/i, '').replace(/```\s*$/, '');
  try {
    return JSON.parse(content);
  } catch (err) {
    throw new Error(`resumeOptimizer: Failed to parse Claude response as JSON: ${err.message}`);
  }
}

module.exports = { optimizeResume };
