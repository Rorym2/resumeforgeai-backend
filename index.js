const express = require('express');
const { requireAuth } = require('./src/middleware/auth');

const generateRouter  = require('./src/routes/generate');
const uploadRouter    = require('./src/routes/upload');
const documentsRouter = require('./src/routes/documents');
const scrapeRouter    = require('./src/routes/scrape');

const app  = express();
const PORT = process.env.PORT || 3000;

app.set('trust proxy', 1);
// BUG FIX: was 50kb — generate route allows up to 100kb per field (resume + job text).
// A combined body of two 100kb fields + JSON overhead needs at least 250kb of headroom.
// Previously any body > 50kb was rejected with a cryptic 413 before reaching route handlers.
app.use(express.json({ limit: '300kb' }));

app.get('/health', (req, res) => {
  res.json({ status: 'ok', app: 'ResumeForge AI Backend' });
});

// All routes below require a valid Supabase JWT
app.use('/upload',    requireAuth, uploadRouter);
app.use('/scrape',    requireAuth, scrapeRouter);
app.use('/generate',  requireAuth, generateRouter);
app.use('/documents', requireAuth, documentsRouter);

// Global error handler — catches errors passed via next(err) from any route/middleware.
// Handles multer errors (file type/size rejections) and any other unhandled Express errors.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('[server] Unhandled error:', err.message, { path: req.path, method: req.method });

  // Multer-specific error codes
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'File too large. Maximum upload size is 10MB.' });
  }
  if (err.message === 'Only PDF and DOCX files are allowed') {
    return res.status(400).json({ error: err.message });
  }

  // JSON body parser syntax error
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Invalid JSON in request body.' });
  }

  // JSON body too large (413 from express.json)
  if (err.status === 413 || err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Request body too large.' });
  }

  return res.status(500).json({ error: 'An unexpected server error occurred.' });
});

app.listen(PORT, () => {
  console.log(`ResumeForge AI backend running on port ${PORT}`);
});
