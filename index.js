require('dotenv').config();
const express = require('express');
const cors = require('cors');

const uploadRoutes = require('./src/routes/upload');
const scrapeRoutes = require('./src/routes/scrape');
const generateRoutes = require('./src/routes/generate');
const documentRoutes = require('./src/routes/documents');
const { requireAuth } = require('./src/middleware/auth');

const app = express();
const PORT = process.env.PORT || 3000;

// Allow the mobile app (and Postman) to connect
app.use(cors());

// Parse JSON request bodies
app.use(express.json({ limit: '10mb' }));

// Routes (all protected by JWT auth except health check)
app.use('/upload', requireAuth, uploadRoutes);
app.use('/scrape', requireAuth, scrapeRoutes);
app.use('/generate', requireAuth, generateRoutes);
app.use('/documents', requireAuth, documentRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', app: 'ResumeForge AI Backend', version: '0.2.0' });
});

app.listen(PORT, () => {
  console.log(`ResumeForge AI backend running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});
