const express = require('express');
const router = express.Router();

// GET /documents
// Returns user's generated documents — stub until Supabase is connected in Phase 3
router.get('/', (req, res) => {
  return res.json({
    success: true,
    documents: [],
    message: 'Document persistence coming in Phase 3 (Supabase).',
  });
});

// GET /documents/:id
// Returns a specific document — stub until Phase 3
router.get('/:id', (req, res) => {
  return res.status(404).json({
    error: 'Document not found.',
    message: 'Document persistence coming in Phase 3 (Supabase).',
  });
});

module.exports = router;
