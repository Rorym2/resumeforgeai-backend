require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { rateLimit } = require('express-rate-limit');

const uploadRoutes = require('./src/routes/upload');
const scrapeRoutes = require('./src/routes/scrape');
const generateRoutes = require('./src/routes/generate');
const documentRoutes = require('./src/routes/documents');
const { requireAuth } = require('./src/middleware/auth');

const app = express();
const PORT = process.env.PORT || 3000;

// Trust Railway's proxy so express-rate-limit sees the real client IP
// (without this, every request looks like it comes from the same proxy IP)
app.set('trust proxy', 1);

// Allow the mobile app (and Postman) to connect
app.use(cors());

// Parse JSON request bodies
app.use(express.json({ limit: '10mb' }));

// General rate limit — 100 requests per 15 min per IP
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});

// Strict limit on /generate — protects Claude API costs (20 per 15 min per IP)
const generateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many generation requests, please try again later.' },
});

app.use(generalLimiter);

// Routes (all protected by JWT auth except health check)
app.use('/upload', requireAuth, uploadRoutes);
app.use('/scrape', requireAuth, scrapeRoutes);
app.use('/generate', requireAuth, generateLimiter, generateRoutes);
app.use('/documents', requireAuth, documentRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', app: 'ResumeForge AI Backend', version: '0.2.0' });
});

app.listen(PORT, () => {
  console.log(`ResumeForge AI backend running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});
