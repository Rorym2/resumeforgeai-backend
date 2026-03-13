const express = require('express');
const { parseResume } = require('../ai/resumeParser');
const { analyzeJob } = require('../ai/jobAnalyzer');
const { scoreMatch } = require('../ai/matchScorer');
const { analyzeDifferentiators } = require('../ai/differentiatorAnalyzer');
const { optimizeResume } = require('../ai/resumeOptimizer');
const { generateCoverLetter } = require('../ai/coverLetterGenerator');

const router = express.Router();

// POST /generate
// Body: { resume_text: string, job_text: string }
router.post('/', async (req, res) => {
  const { resume_text, job_text } = req.body;

  if (!resume_text || resume_text.trim().length < 50) {
    return res.status(400).json({ error: 'resume_text is required and must be the full resume content.' });
  }

  if (!job_text || job_text.trim().length < 50) {
    return res.status(400).json({ error: 'job_text is required and must be the full job description.' });
  }

  console.log(`[generate] Starting pipeline for resume (${resume_text.length} chars) + job (${job_text.length} chars)`);
  const startTime = Date.now();

  try {
    // Step 1: Parse the resume into structured JSON
    console.log('[generate] Step 1/6 — Parsing resume...');
    const parsedResume = await parseResume(resume_text);

    // Step 2: Analyze the job listing
    console.log('[generate] Step 2/6 — Analyzing job...');
    const jobAnalysis = await analyzeJob(job_text);

    // Step 3: Score how well the original resume matches the job
    console.log('[generate] Step 3/6 — Scoring match...');
    const matchScore = await scoreMatch(parsedResume, jobAnalysis);

    // Step 4: Find candidate differentiators
    console.log('[generate] Step 4/6 — Analyzing differentiators...');
    const differentiators = await analyzeDifferentiators(parsedResume, jobAnalysis);

    // Step 5: Rewrite the resume optimized for this job
    console.log('[generate] Step 5/6 — Optimizing resume...');
    const optimizedResume = await optimizeResume(parsedResume, jobAnalysis);

    // Step 6: Generate the cover letter
    console.log('[generate] Step 6/6 — Generating cover letter...');
    const coverLetter = await generateCoverLetter(optimizedResume, jobAnalysis);

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[generate] Pipeline complete in ${duration}s`);

    return res.json({
      success: true,
      duration_seconds: parseFloat(duration),
      job_analysis: jobAnalysis,
      match_score: matchScore,
      differentiators,
      optimized_resume: optimizedResume,
      cover_letter: coverLetter,
    });
  } catch (err) {
    console.error('[generate] Pipeline failed:', err.message);
    return res.status(500).json({ error: 'Generation failed.', detail: err.message });
  }
});

module.exports = router;
