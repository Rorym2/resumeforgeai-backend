const { client } = require('../lib/anthropic');

async function generateCoverLetter(optimizedResume, jobAnalysis) {
  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
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
    return JSON.parse(content);
  } catch (err) {
    throw new Error(`coverLetterGenerator: Failed to parse Claude response as JSON: ${err.message}`);
  }
}

module.exports = { generateCoverLetter };
