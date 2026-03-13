const { createClient } = require('@supabase/supabase-js');

// Anon key client — used only to verify incoming JWTs from the mobile app
const supabaseAuth = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// Middleware that protects any route it is applied to.
// Expects: Authorization: Bearer <token> header
// If valid: attaches req.user and calls next()
// If invalid: returns 401
async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authorization header required. Format: Bearer <token>' });
  }

  const token = authHeader.split(' ')[1];

  const { data: { user }, error } = await supabaseAuth.auth.getUser(token);

  if (error || !user) {
    return res.status(401).json({ error: 'Invalid or expired token. Please log in again.' });
  }

  req.user = user;
  next();
}

module.exports = { requireAuth };
