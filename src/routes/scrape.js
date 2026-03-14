const express = require('express');
const router = express.Router();
const { scrapeJobUrl } = require('../services/jobScraper');

// POST /scrape/job
// Accepts { text: "raw job description" } for paste fallback
router.post('/job', async (req, res) => {
  const { text } = req.body;

  if (!text) {
    return res.status(400).json({ error: 'Provide "text" (raw job description).' });
  }

  if (text.trim().length < 50) {
    return res.status(400).json({ error: 'Job description is too short. Please paste the full job listing.' });
  }

  return res.json({ success: true, source: 'text', text: text.trim() });
});

// POST /scrape/job-url
// Accepts { url: "https://..." } — scrapes the job description from the page
router.post('/job-url', async (req, res) => {
  const { url } = req.body;

  if (!url) {
    return res.status(400).json({ error: 'Provide a "url" to scrape.' });
  }

  // Basic URL validation
  try {
    new URL(url);
  } catch {
    return res.status(400).json({ error: 'Invalid URL. Please check the link and try again.' });
  }

  try {
    const result = await scrapeJobUrl(url);
    return res.json({ success: true, ...result });
  } catch (err) {
    // LinkedIn needs the in-app browser (WebView) — tell the client
    if (err.code === 'LINKEDIN_LOGIN_REQUIRED') {
      return res.status(422).json({
        error: err.message,
        code: 'LINKEDIN_LOGIN_REQUIRED',
      });
    }

    return res.status(422).json({
      error: err.message || 'Could not extract job description from this URL.',
      fallback: true,
    });
  }
});

module.exports = router;
