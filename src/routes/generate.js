const express = require('express');
const { parseResume } = require('../ai/resumeParser');
const { analyzeJob } = require('../ai/jobAnalyzer');
const { scoreMatch } = require('../ai/matchScorer');
const { analyzeDifferentiators } = require('../ai/differentiatorAnalyzer');
const { optimizeResume } = require('../ai/resumeOptimizer');
const { generateCoverLetter } = require('../ai/coverLetterGenerator');
const supabase = require('../lib/supabase');

const router = express.Router();

const FREE_TIER_LIMIT = 3; // generations per month

// Get the current month as a string e.g. '2026-03'
function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

// Check how many generations this user has used this month
async function getUsageCount(userId) {
  const { data } = await supabase
    .from('usage_tracking')
    .select('generation_count')
    .eq('user_id', userId)
    .eq('month', currentMonth())
    .single();

  return data?.generation_count ?? 0;
}

// Increment the usage count for this user this month (insert or update)
async function incrementUsage(userId) {
  const month = currentMonth();

  const { data: existing } = await supabase
    .from('usage_tracking')
    .select('id, generation_count')
    .eq('user_id', userId)
    .eq('month', month)
    .single();

  if (existing) {
    await supabase
      .from('usage_tracking')
      .update({ generation_count: existing.generation_count + 1, updated_at: new Date() })
      .eq('id', existing.id);
  } else {
    await supabase
      .from('usage_tracking')
      .insert({ user_id: userId, month, generation_count: 1 });
  }
}

// POST /generate
// Body: { resume_text: string, job_text: string, resume_id?: string }
router.post('/', async (req, res) => {
  const { resume_text, job_text, resume_id } = req.body;
  const userId = req.user.id;

  if (!resume_text || resume_text.trim().length < 50) {
    return res.status(400).json({ error: 'resume_text is required and must be the full resume content.' });
  }

  if (!job_text || job_text.trim().length < 50) {
    return res.status(400).json({ error: 'job_text is required and must be the full job description.' });
  }

  // Check free tier limit (Phase 6 will add a bypass for paid users)
  const usageCount = await getUsageCount(userId);
  if (usageCount >= FREE_TIER_LIMIT) {
    return res.status(402).json({
      error: 'Free tier limit reached.',
      message: `You have used all ${FREE_TIER_LIMIT} free generations for this month. Upgrade to Pro for unlimited generations.`,
      usage: { used: usageCount, limit: FREE_TIER_LIMIT },
    });
  }

  console.log(`[generate] Starting pipeline for user ${userId} (${usageCount + 1}/${FREE_TIER_LIMIT} this month)`);
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

    // Save the full result to Supabase
    const { data: generation, error: saveError } = await supabase
      .from('generations')
      .insert({
        user_id: userId,
        resume_id: resume_id || null,
        job_text: job_text.trim(),
        job_analysis: jobAnalysis,
        match_score: matchScore,
        differentiators,
        optimized_resume: optimizedResume,
        cover_letter: coverLetter,
        duration_seconds: parseFloat(duration),
      })
      .select()
      .single();

    if (saveError) {
      console.error('[generate] Failed to save result:', saveError.message);
      // Don't fail the request — return the result even if saving failed
    }

    // Increment usage count
    await incrementUsage(userId);

    return res.json({
      success: true,
      generation_id: generation?.id ?? null,
      duration_seconds: parseFloat(duration),
      usage: { used: usageCount + 1, limit: FREE_TIER_LIMIT },
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
