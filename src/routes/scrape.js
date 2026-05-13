const express = require('express');
const router = express.Router();
const { scrapeJobUrl } = require('../services/jobScraper');

// Private IP ranges to block (SSRF prevention)
const PRIVATE_IP_RANGES = [
  /^127\./,           // 127.0.0.0/8 (loopback)
  /^10\./,            // 10.0.0.0/8 (private)
  /^172\.(1[6-9]|2\d|3[01])\./, // 172.16.0.0/12 (private)
  /^192\.168\./,      // 192.168.0.0/16 (private)
  /^localhost$/i,     // localhost hostname
];

function isPrivateUrl(urlString) {
  try {
    const url = new URL(urlString);
    // Block non-https schemes
    if (url.protocol !== 'https:') return true;
    // Block private IPs and hostnames
    return PRIVATE_IP_RANGES.some(regex => regex.test(url.hostname));
  } catch {
    return false;
  }
}

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

  // URL validation + SSRF prevention
  try {
    new URL(url);
  } catch {
    return res.status(400).json({ error: 'Invalid URL. Please check the link and try again.' });
  }

  if (isPrivateUrl(url)) {
    return res.status(400).json({ error: 'Invalid URL. Only public HTTPS URLs are supported.' });
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
