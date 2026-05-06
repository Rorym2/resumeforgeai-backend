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

// Check RevenueCat to see if this user has an active 'pro' entitlement.
// Returns false if REVENUECAT_API_KEY is not set (safe default — treat as free).
async function isUserPro(userId) {
  const apiKey = process.env.REVENUECAT_API_KEY;
  if (!apiKey) return false;

  try {
    const res = await fetch(
      `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(userId)}`,
      { headers: { Authorization: `Bearer ${apiKey}` } }
    );
    if (!res.ok) return false;
    const data = await res.json();
    const active = data.subscriber?.entitlements?.active ?? {};
    return 'pro' in active;
  } catch (err) {
    console.error('[generate] RevenueCat check failed:', err.message);
    return false; // fail open — don't block user if RC is unreachable
  }
}

// Atomically check the usage count and increment it in a single DB round-trip.
// Uses a Postgres function to avoid the read-modify-write race condition.
// Returns { allowed: boolean, used: number }
//
// Run this SQL once in your Supabase SQL editor to create the function:
//
//   CREATE OR REPLACE FUNCTION check_and_increment_usage(
//     p_user_id UUID, p_month TEXT, p_limit INT
//   ) RETURNS TABLE(allowed BOOLEAN, used INT) LANGUAGE plpgsql AS $$
//   DECLARE v_count INT;
//   BEGIN
//     INSERT INTO usage_tracking (user_id, month, generation_count)
//     VALUES (p_user_id, p_month, 1)
//     ON CONFLICT (user_id, month) DO UPDATE
//       SET generation_count = CASE
//         WHEN usage_tracking.generation_count < p_limit
//         THEN usage_tracking.generation_count + 1
//         ELSE usage_tracking.generation_count
//       END,
//       updated_at = NOW()
//     RETURNING generation_count INTO v_count;
//     RETURN QUERY SELECT (v_count <= p_limit), v_count;
//   END; $$;
//
async function checkAndIncrementUsage(userId, limit) {
  const { data, error } = await supabase.rpc('check_and_increment_usage', {
    p_user_id: userId,
    p_month: currentMonth(),
    p_limit: limit,
  });

  if (error) {
    // If the RPC function hasn't been created yet, fall back to the old approach
    console.warn('[generate] check_and_increment_usage RPC not found, falling back:', error.message);
    return fallbackCheckAndIncrement(userId, limit);
  }

  // data is an array of rows from RETURNS TABLE — grab the first
  const row = Array.isArray(data) ? data[0] : data;
  return { allowed: row.allowed, used: row.used };
}

// Fallback for if the RPC isn't set up yet — has a small race window but fine for low traffic
async function fallbackCheckAndIncrement(userId, limit) {
  const { data } = await supabase
    .from('usage_tracking')
    .select('generation_count')
    .eq('user_id', userId)
    .eq('month', currentMonth())
    .single();

  const current = data?.generation_count ?? 0;
  if (current >= limit) return { allowed: false, used: current };

  const { data: existing } = await supabase
    .from('usage_tracking')
    .select('id, generation_count')
    .eq('user_id', userId)
    .eq('month', currentMonth())
    .single();

  if (existing) {
    await supabase
      .from('usage_tracking')
      .update({ generation_count: existing.generation_count + 1, updated_at: new Date() })
      .eq('id', existing.id);
    return { allowed: true, used: existing.generation_count + 1 };
  } else {
    await supabase
      .from('usage_tracking')
      .insert({ user_id: userId, month: currentMonth(), generation_count: 1 });
    return { allowed: true, used: 1 };
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

  // Pro users bypass the free tier limit entirely
  const pro = await isUserPro(userId);

  if (!pro) {
    // Atomically check + increment usage — prevents race conditions
    const { allowed, used } = await checkAndIncrementUsage(userId, FREE_TIER_LIMIT);

    if (!allowed) {
      return res.status(402).json({
        error: 'Free tier limit reached.',
        message: `You have used all ${FREE_TIER_LIMIT} free generations for this month. Upgrade to Pro for unlimited generations.`,
        usage: { used, limit: FREE_TIER_LIMIT },
      });
    }

    console.log(`[generate] Starting pipeline for user ${userId} (${used}/${FREE_TIER_LIMIT} this month)`);
  } else {
    console.log(`[generate] Starting pipeline for Pro user ${userId}`);
  }

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

    // Get final usage count for response (Pro users skip this)
    let usageInfo = pro
      ? { used: null, limit: null, is_pro: true }
      : null;

    if (!usageInfo) {
      const { data: usageRow } = await supabase
        .from('usage_tracking')
        .select('generation_count')
        .eq('user_id', userId)
        .eq('month', currentMonth())
        .single();
      usageInfo = { used: usageRow?.generation_count ?? 1, limit: FREE_TIER_LIMIT, is_pro: false };
    }

    return res.json({
      success: true,
      generation_id: generation?.id ?? null,
      duration_seconds: parseFloat(duration),
      usage: usageInfo,
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
