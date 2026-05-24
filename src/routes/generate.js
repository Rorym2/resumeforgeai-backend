const express = require('express');
const { parseResume } = require('../ai/resumeParser');
const { analyzeJob } = require('../ai/jobAnalyzer');
const { scoreMatch } = require('../ai/matchScorer');
const { analyzeDifferentiators } = require('../ai/differentiatorAnalyzer');
const { optimizeResume } = require('../ai/resumeOptimizer');
const { generateCoverLetter } = require('../ai/coverLetterGenerator');
const supabase = require('../lib/supabase');

const router = express.Router();

const FREE_TIER_LIMIT = 3;        // generations per month
const MAX_INPUT_LENGTH = 100 * 1024; // 100KB
const PIPELINE_TIMEOUT_MS = 180_000; // 3 minutes — covers 6 AI calls at ~30s each

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

// BUG FIX: Decrement usage by 1 if the pipeline fails after already incrementing.
// This compensates free-tier users who would otherwise lose a generation on a server/AI error.
// Best-effort only (accepts a tiny race window) — never throws.
async function decrementUsage(userId) {
  try {
    const { data } = await supabase
      .from('usage_tracking')
      .select('generation_count')
      .eq('user_id', userId)
      .eq('month', currentMonth())
      .maybeSingle();

    if (data && data.generation_count > 0) {
      await supabase
        .from('usage_tracking')
        .update({ generation_count: data.generation_count - 1, updated_at: new Date() })
        .eq('user_id', userId)
        .eq('month', currentMonth());
      console.log(`[generate] Usage decremented for user ${userId} after pipeline failure`);
    }
  } catch (err) {
    // Best-effort only — don't let this fail the error response
    console.warn('[generate] Failed to decrement usage on pipeline error:', err.message);
  }
}

// Fallback for if the RPC isn't set up yet. This has a race window where another request
// could increment between the SELECT and UPDATE, but for low-traffic fallback scenarios it's acceptable.
// The RPC-based approach is preferred since it's atomic.
async function fallbackCheckAndIncrement(userId, limit) {
  const { data, error: selectError } = await supabase
    .from('usage_tracking')
    .select('id, generation_count')
    .eq('user_id', userId)
    .eq('month', currentMonth())
    .maybeSingle();

  if (selectError && selectError.code !== 'PGRST116') {
    throw selectError;
  }

  const existing = data;
  const current = existing?.generation_count ?? 0;

  if (current >= limit) return { allowed: false, used: current };

  if (existing) {
    await supabase
      .from('usage_tracking')
      .update({ generation_count: current + 1, updated_at: new Date() })
      .eq('id', existing.id);
    return { allowed: true, used: current + 1 };
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

  if (resume_text.length > MAX_INPUT_LENGTH) {
    return res.status(400).json({ error: `resume_text exceeds maximum length of ${MAX_INPUT_LENGTH / 1024}KB.` });
  }

  if (!job_text || job_text.trim().length < 50) {
    return res.status(400).json({ error: 'job_text is required and must be the full job description.' });
  }

  if (job_text.length > MAX_INPUT_LENGTH) {
    return res.status(400).json({ error: `job_text exceeds maximum length of ${MAX_INPUT_LENGTH / 1024}KB.` });
  }

  // Pro users bypass the free tier limit entirely
  const pro = await isUserPro(userId);

  let usageResult = null;
  if (!pro) {
    // Check usage before running expensive pipeline
    usageResult = await checkAndIncrementUsage(userId, FREE_TIER_LIMIT);

    if (!usageResult.allowed) {
      return res.status(402).json({
        error: 'Free tier limit reached.',
        message: `You have used all ${FREE_TIER_LIMIT} free generations for this month. Upgrade to Pro for unlimited generations.`,
        usage: { used: usageResult.used, limit: FREE_TIER_LIMIT },
      });
    }

    console.log(`[generate] Starting pipeline for user ${userId} (${usageResult.used}/${FREE_TIER_LIMIT} this month)`);
  } else {
    console.log(`[generate] Starting pipeline for Pro user ${userId}`);
  }

  const startTime = Date.now();

  // Helper to ms-stamp each step for debugging slow pipelines
  function elapsed() { return `${((Date.now() - startTime) / 1000).toFixed(1)}s`; }

  try {
    // Wrap the entire pipeline in a timeout so a hung Claude call never stalls the server
    const pipelineResult = await Promise.race([
      runPipeline(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('PIPELINE_TIMEOUT')), PIPELINE_TIMEOUT_MS)
      ),
    ]);

    const { jobAnalysis, matchScore, differentiators, optimizedResume, coverLetter } = pipelineResult;
    const duration = elapsed();

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
      console.error('[generate] Failed to save result:', saveError.message, { user: userId });
      // Don't fail the request — return the result even if saving failed
    }

    // Build usage response
    const usageInfo = pro
      ? { used: null, limit: null, is_pro: true }
      : { used: usageResult.used, limit: FREE_TIER_LIMIT, is_pro: false };

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
    const isTimeout = err.message === 'PIPELINE_TIMEOUT';
    console.error(`[generate] Pipeline ${isTimeout ? 'timed out' : 'failed'} at ${elapsed()}:`, err.message, err.stack);

    // BUG FIX: Decrement the usage counter so free-tier users don't lose a generation
    // when the pipeline fails due to a server or AI error (not a user error).
    if (!pro && usageResult?.allowed) {
      await decrementUsage(userId);
    }

    const message = isTimeout
      ? 'Generation timed out. Please try again.'
      : 'Generation failed. Please try again.';
    return res.status(500).json({ error: message });
  }

  // The actual AI pipeline, extracted so it can be wrapped in Promise.race above
  async function runPipeline() {
    // Steps 1 & 2 can run in parallel — they don't depend on each other
    console.log(`[generate] Steps 1-2/6 — Parsing resume and analyzing job... (${elapsed()})`);
    const [parsedResume, jobAnalysis] = await Promise.all([
      parseResume(resume_text),
      analyzeJob(job_text),
    ]);
    console.log(`[generate] Steps 1-2 complete (${elapsed()})`);

    // Steps 3 & 4 depend on 1-2 but not on each other — run in parallel
    console.log(`[generate] Steps 3-4/6 — Scoring match and analyzing differentiators... (${elapsed()})`);
    const [matchScore, differentiators] = await Promise.all([
      scoreMatch(parsedResume, jobAnalysis),
      analyzeDifferentiators(parsedResume, jobAnalysis),
    ]);
    console.log(`[generate] Steps 3-4 complete (${elapsed()})`);

    console.log(`[generate] Step 5/6 — Optimizing resume... (${elapsed()})`);
    const optimizedResume = await optimizeResume(parsedResume, jobAnalysis);
    console.log(`[generate] Step 5 complete (${elapsed()})`);

    console.log(`[generate] Step 6/6 — Generating cover letter... (${elapsed()})`);
    const coverLetter = await generateCoverLetter(optimizedResume, jobAnalysis);
    console.log(`[generate] Pipeline complete in ${elapsed()}`);

    return { jobAnalysis, matchScore, differentiators, optimizedResume, coverLetter };
  }
});

module.exports = router;
