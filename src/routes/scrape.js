const express = require('express');
const router = express.Router();

// POST /scrape/job
// Accepts either { text: "raw job description" } or { url: "https://..." }
router.post('/job', async (req, res) => {
  const { text, url } = req.body;

  if (!text && !url) {
    return res.status(400).json({ error: 'Provide either "text" (raw job description) or "url" (job listing URL).' });
  }

  // URL scraping is coming in Phase 7 — return a clear message for now
  if (url) {
    return res.status(501).json({
      error: 'URL scraping is not yet available.',
      message: 'Please paste the job description text directly using the "text" field.',
      coming_soon: true,
    });
  }

  if (text.trim().length < 50) {
    return res.status(400).json({ error: 'Job description is too short. Please paste the full job listing.' });
  }

  return res.json({
    success: true,
    source: 'text',
    text: text.trim(),
  });
});

module.exports = router;
