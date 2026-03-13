const express = require('express');
const router = express.Router();

// POST /auth/register
// Stub — real implementation coming in Phase 3 (Supabase Auth)
router.post('/register', (req, res) => {
  return res.status(501).json({
    error: 'Auth not yet implemented.',
    message: 'User registration is coming in Phase 3 (Supabase Auth).',
    coming_in: 'phase/3-database-auth',
  });
});

// POST /auth/login
// Stub — real implementation coming in Phase 3 (Supabase Auth)
router.post('/login', (req, res) => {
  return res.status(501).json({
    error: 'Auth not yet implemented.',
    message: 'User login is coming in Phase 3 (Supabase Auth).',
    coming_in: 'phase/3-database-auth',
  });
});

module.exports = router;
