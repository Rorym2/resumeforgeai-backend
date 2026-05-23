const express = require('express');
const { requireAuth } = require('./src/middleware/auth');

const generateRouter  = require('./src/routes/generate');
const uploadRouter    = require('./src/routes/upload');
const documentsRouter = require('./src/routes/documents');
const scrapeRouter    = require('./src/routes/scrape');

const app  = express();
const PORT = process.env.PORT || 3000;

app.set('trust proxy', 1);
app.use(express.json({ limit: '50kb' }));

app.get('/health', (req, res) => {
  res.json({ status: 'ok', app: 'ResumeForge AI Backend' });
});

// All routes below require a valid Supabase JWT
app.use('/upload',    requireAuth, uploadRouter);
app.use('/scrape',    requireAuth, scrapeRouter);
app.use('/generate',  requireAuth, generateRouter);
app.use('/documents', requireAuth, documentsRouter);

app.listen(PORT, () => {
  console.log(`ResumeForge AI backend running on port ${PORT}`);
});
