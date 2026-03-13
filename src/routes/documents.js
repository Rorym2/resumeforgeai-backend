const express = require('express');
const supabase = require('../lib/supabase');

const router = express.Router();

// GET /documents
// Returns all generations for the logged-in user, newest first
router.get('/', async (req, res) => {
  const { data, error } = await supabase
    .from('generations')
    .select('id, job_text, job_analysis, match_score, duration_seconds, created_at, resume_id')
    .eq('user_id', req.user.id)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Documents fetch error:', error);
    return res.status(500).json({ error: 'Failed to fetch documents.', detail: error.message });
  }

  return res.json({
    success: true,
    count: data.length,
    documents: data,
  });
});

// GET /documents/:id
// Returns a single generation with full content
router.get('/:id', async (req, res) => {
  const { data, error } = await supabase
    .from('generations')
    .select('*')
    .eq('id', req.params.id)
    .eq('user_id', req.user.id) // ensure users can only fetch their own documents
    .single();

  if (error || !data) {
    return res.status(404).json({ error: 'Document not found.' });
  }

  return res.json({
    success: true,
    document: data,
  });
});

module.exports = router;
