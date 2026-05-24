const { client } = require('../lib/anthropic');

async function generateCoverLetter(optimizedResume, jobAnalysis) {
  const t0 = Date.now();
  console.log('[coverLetterGenerator] Starting');
  // BUG FIX: was 1024 — a 350-word body alone is ~470 tokens; with JSON envelope, subject line,
  // and candidate_name field, 1024 was regularly cutting off long cover letters mid-sentence.
  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    messages: [
      {
        role: 'user',
        content: `You are an expert cover letter writer. Write a tailored, professional cover letter for a job application.

Use the candidate's resume and job details below to write a cover letter that:
- Opens with a strong, specific hook (not "I am writing to apply for...")
- Highlights 2-3 of the candidate's most relevant experiences for this specific role
- Uses keywords and tone that match the job listing
- Closes with a confident, specific call to action
- Is 3 paragraphs, no longer than 350 words
- Matches the tone: ${jobAnalysis.tone}

RULES:
- Only reference experience that exists in the resume
- Do not invent achievements or skills
- Address it to the company: ${jobAnalysis.company || 'Hiring Team'}
- Use the candidate's name: ${optimizedResume.contact?.name || 'the candidate'}

Candidate's resume:
${JSON.stringify(optimizedResume, null, 2)}

Job details:
${JSON.stringify(jobAnalysis, null, 2)}

Return ONLY valid JSON with this structure:
{
  "subject_line": "",
  "body": "",
  "candidate_name": ""
}`,
      },
    ],
  });

  const content = response.content[0].text.trim().replace(/^```json\s*/i, '').replace(/```\s*$/, '');
  try {
    const parsed = JSON.parse(content);
    console.log(`[coverLetterGenerator] Done in ${Date.now() - t0}ms — stop_reason: ${response.stop_reason}`);
    return parsed;
  } catch (err) {
    console.error(`[coverLetterGenerator] JSON parse failed after ${Date.now() - t0}ms — raw response (first 200 chars):`, content.slice(0, 200));
    throw new Error(`coverLetterGenerator: Failed to parse Claude response as JSON: ${err.message}`);
  }
}

module.exports = { generateCoverLetter };
