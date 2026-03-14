const cheerio = require('cheerio');

// Browser-like headers so sites don't immediately block us
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xhtml+xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.5',
  'Accept-Encoding': 'gzip, deflate, br',
  'Connection': 'keep-alive',
};

// Fetch a URL and return the HTML
async function fetchPage(url) {
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`Failed to fetch page (${res.status})`);
  return res.text();
}

// Clean up whitespace in extracted text
function clean(text) {
  return text
    .replace(/\s+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// ─── INDEED ──────────────────────────────────────────────────────────────────
async function scrapeIndeed(url) {
  const html = await fetchPage(url);
  const $ = cheerio.load(html);

  // Indeed job description container
  const description =
    $('#jobDescriptionText').text() ||
    $('[data-testid="jobsearch-jobDescriptionText"]').text() ||
    $('.jobsearch-jobDescriptionText').text();

  const title =
    $('h1.jobsearch-JobInfoHeader-title').text() ||
    $('[data-testid="jobsearch-JobInfoHeader-title"]').text() ||
    $('h1').first().text();

  const company =
    $('[data-testid="inlineHeader-companyName"]').text() ||
    $('.jobsearch-InlineCompanyRating-companyName').text();

  if (!description) throw new Error('Could not find job description on Indeed page.');

  return clean(`${title ? title + '\n' : ''}${company ? company + '\n\n' : ''}${description}`);
}

// ─── ZIPRECRUITER ─────────────────────────────────────────────────────────────
async function scrapeZipRecruiter(url) {
  const html = await fetchPage(url);
  const $ = cheerio.load(html);

  const description =
    $('[data-testid="job-description"]').text() ||
    $('.jobDescriptionSection').text() ||
    $('#job_desc').text() ||
    $('[class*="jobDescription"]').text();

  const title = $('h1').first().text();
  const company = $('[class*="company"]').first().text();

  if (!description) throw new Error('Could not find job description on ZipRecruiter page.');

  return clean(`${title ? title + '\n' : ''}${company ? company + '\n\n' : ''}${description}`);
}

// ─── LINKEDIN ─────────────────────────────────────────────────────────────────
// LinkedIn requires login for most pages — this is a best-effort attempt
// on public job pages. Will fail ~80% of the time and trigger WebView fallback.
async function scrapeLinkedIn(url) {
  const html = await fetchPage(url);
  const $ = cheerio.load(html);

  const description =
    $('.description__text').text() ||
    $('[class*="description"]').filter((_, el) => $(el).text().length > 200).first().text() ||
    $('.show-more-less-html__markup').text();

  if (!description || description.length < 100) {
    throw new Error('LINKEDIN_LOGIN_REQUIRED');
  }

  const title = $('h1').first().text();
  return clean(`${title ? title + '\n\n' : ''}${description}`);
}

// ─── GENERIC FALLBACK ─────────────────────────────────────────────────────────
// Tries common job description patterns on any site
async function scrapeGeneric(url) {
  const html = await fetchPage(url);
  const $ = cheerio.load(html);

  // Remove noise elements
  $('nav, header, footer, script, style, iframe, .cookie-banner, #cookie-notice').remove();

  // Try common job description selectors
  const candidates = [
    $('[class*="job-description"]'),
    $('[class*="jobDescription"]'),
    $('[id*="job-description"]'),
    $('[id*="jobDescription"]'),
    $('[class*="description"]').filter((_, el) => $(el).text().length > 300),
    $('article'),
    $('main'),
  ];

  for (const candidate of candidates) {
    const text = candidate.first().text();
    if (text && text.length > 200) return clean(text);
  }

  throw new Error('Could not extract job description from this page. Please paste the description manually.');
}

// ─── MAIN EXPORT ──────────────────────────────────────────────────────────────
async function scrapeJobUrl(url) {
  const lower = url.toLowerCase();

  try {
    if (lower.includes('indeed.com')) return { text: await scrapeIndeed(url), source: 'indeed' };
    if (lower.includes('ziprecruiter.com')) return { text: await scrapeZipRecruiter(url), source: 'ziprecruiter' };
    if (lower.includes('linkedin.com')) return { text: await scrapeLinkedIn(url), source: 'linkedin' };
    return { text: await scrapeGeneric(url), source: 'generic' };
  } catch (err) {
    // Signal to the client that LinkedIn needs the WebView approach
    if (err.message === 'LINKEDIN_LOGIN_REQUIRED') {
      const error = new Error('LinkedIn requires login to view this job. The app will open it in a browser for you.');
      error.code = 'LINKEDIN_LOGIN_REQUIRED';
      throw error;
    }
    throw err;
  }
}

module.exports = { scrapeJobUrl };
