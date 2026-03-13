const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function analyzeDifferentiators(parsedResume, jobAnalysis) {
  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    messages: [
      {
        role: 'user',
        content: `You are a senior executive career strategist. Your job is to identify what makes a candidate genuinely stand out from other applicants for a specific role — not generic strengths, but specific, evidence-backed differentiators rooted in their actual career history.

Analyze the resume and target job below. Identify 3–5 differentiators that make this candidate more memorable and competitive than similar candidates.

Return ONLY valid JSON with this exact structure — no explanation, no markdown:
{
  "differentiators": [
    {
      "title": "",
      "why_it_matters": "",
      "evidence": [],
      "how_to_use_in_interviews": ""
    }
  ],
  "positioning_statement": "",
  "hidden_strengths": []
}

Field definitions:
- differentiators: 3–5 standout career themes or unique value points
  - title: short name for the differentiator (e.g. "Rare AI + Banking Hybrid")
  - why_it_matters: why this is valuable to employers hiring for this specific role
  - evidence: 2–3 specific examples from the resume that prove this differentiator
  - how_to_use_in_interviews: the type of question or situation where this differentiator lands best
- positioning_statement: one concise sentence (under 30 words) summarizing what makes this candidate uniquely valuable for this role
- hidden_strengths: 2–4 underrated qualities visible in the resume that the candidate may not be emphasizing enough

Candidate resume:
${JSON.stringify(parsedResume, null, 2)}

Target job:
${JSON.stringify(jobAnalysis, null, 2)}`,
      },
    ],
  });

  const content = response.content[0].text.trim().replace(/^```json\s*/i, '').replace(/```\s*$/, '');
  return JSON.parse(content);
}

module.exports = { analyzeDifferentiators };
