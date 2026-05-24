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
    console.warn(`[auth] Missing or malformed Authorization header — ${req.method} ${req.path}`);
    return res.status(401).json({ error: 'Authorization header required. Format: Bearer <token>' });
  }

  const token = authHeader.split(' ')[1];

  const { data: { user }, error } = await supabaseAuth.auth.getUser(token);

  if (error || !user) {
    console.warn(`[auth] Token rejected — ${req.method} ${req.path} — ${error?.message ?? 'no user returned'}`);
    return res.status(401).json({ error: 'Invalid or expired token. Please log in again.' });
  }

  console.log(`[auth] Authenticated user=${user.id} — ${req.method} ${req.path}`);
  req.user = user;
  next();
}

module.exports = { requireAuth };
