const express = require('express');
const Anthropic = require('@anthropic-ai/sdk');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '50kb' }));

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

app.get('/health', (req, res) => {
  res.json({ status: 'ok', app: 'ResumeForge AI Backend' });
});

app.post('/api/analyze', async (req, res) => {
  const { resumeText, jobDescription } = req.body;

  if (!resumeText || !jobDescription) {
    return res.status(400).json({ error: 'resumeText and jobDescription are required' });
  }

  try {
    const message = await anthropic.messages.create({
      model: 'claude-opus-4-7',
      max_tokens: 1024,
      system:
        'You are a resume analysis expert. Analyze resumes against job descriptions and return ONLY valid JSON with no markdown, no code blocks, no extra text.',
      messages: [
        {
          role: 'user',
          content: `Analyze this resume against the job description. Return a JSON object with exactly this structure:
{
  "overallScore": <integer 0-100, how well the resume currently matches>,
  "improvedScore": <integer 0-100, estimated score after AI optimization>,
  "categories": {
    "keywords": <integer 0-100>,
    "skills": <integer 0-100>,
    "experience": <integer 0-100>,
    "formatting": <integer 0-100>
  },
  "strengths": [<up to 4 specific strengths as strings>],
  "gaps": [<up to 4 specific gaps or missing elements as strings>],
  "suggestions": [<up to 4 concrete, actionable improvement suggestions as strings>]
}

RESUME:
${resumeText}

JOB DESCRIPTION:
${jobDescription}`,
        },
      ],
    });

    const raw = message.content[0].text.replace(/```json\n?|```\n?/g, '').trim();
    const analysis = JSON.parse(raw);
    res.json(analysis);
  } catch (err) {
    console.error('Analysis error:', err.message);
    res.status(500).json({ error: 'Analysis failed. Please try again.' });
  }
});

app.listen(PORT, () => {
  console.log(`ResumeForge AI backend running on port ${PORT}`);
});
